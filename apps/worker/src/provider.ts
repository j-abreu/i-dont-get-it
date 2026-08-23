import type { ExplainRequest } from '@i-dont-get-it/contracts';
import { buildExplanationPrompt } from '@i-dont-get-it/explanation-core';

export const WORKERS_AI_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast' as const;

export type ExplanationProviderResult = {
  text: string;
};

export type ExplanationProvider = {
  explain: (request: ExplainRequest) => Promise<ExplanationProviderResult>;
};

export type WorkersAiBinding = {
  run(
    model: typeof WORKERS_AI_MODEL,
    input: {
      messages: Array<{ role: 'system' | 'user'; content: string }>;
      max_tokens: number;
      temperature: number;
      stream: false;
    },
  ): Promise<unknown>;
};

export type ExplanationProviderErrorCode = 'timeout' | 'service_unavailable' | 'internal_error';

export class ExplanationProviderError extends Error {
  constructor(
    readonly code: ExplanationProviderErrorCode,
    readonly retryable: boolean,
  ) {
    super('The explanation provider failed.');
    this.name = 'ExplanationProviderError';
  }
}

export function createWorkersAiExplanationProvider(ai: WorkersAiBinding): ExplanationProvider {
  return {
    async explain(request) {
      const prompt = buildExplanationPrompt(request);

      try {
        const result = await ai.run(WORKERS_AI_MODEL, {
          messages: [
            { role: 'system', content: prompt.instructions },
            { role: 'user', content: prompt.input },
          ],
          max_tokens: prompt.maxOutputTokens,
          temperature: 0.2,
          stream: false,
        });
        const text = extractText(result);

        if (text === undefined || text.length === 0) {
          console.error('Workers AI returned no usable explanation.', describeResultShape(result));
          throw new ExplanationProviderError('internal_error', false);
        }

        return { text };
      } catch (error: unknown) {
        if (error instanceof ExplanationProviderError) {
          throw error;
        }

        console.error('Workers AI request failed.', describeError(error));
        throw classifyWorkersAiError(error);
      }
    },
  };
}

function extractText(result: unknown): string | undefined {
  if (!isRecord(result)) {
    return undefined;
  }

  if (typeof result.response === 'string') {
    return result.response.trim();
  }

  const firstChoice = Array.isArray(result.choices) ? result.choices[0] : undefined;
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    return undefined;
  }

  return typeof firstChoice.message.content === 'string'
    ? firstChoice.message.content.trim()
    : undefined;
}

function classifyWorkersAiError(error: unknown): ExplanationProviderError {
  if (!isRecord(error)) {
    return new ExplanationProviderError('internal_error', false);
  }

  const status = typeof error.status === 'number' ? error.status : undefined;
  const name = typeof error.name === 'string' ? error.name : '';
  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';

  if (name === 'AbortError' || message.includes('timeout') || message.includes('timed out')) {
    return new ExplanationProviderError('timeout', true);
  }

  if (status === 429 || (status !== undefined && status >= 500)) {
    return new ExplanationProviderError('service_unavailable', true);
  }

  return new ExplanationProviderError('internal_error', false);
}

function describeResultShape(result: unknown): Record<string, unknown> {
  if (!isRecord(result)) {
    return { resultType: typeof result };
  }

  const firstChoice = Array.isArray(result.choices) ? result.choices[0] : undefined;
  const message = isRecord(firstChoice) && isRecord(firstChoice.message)
    ? firstChoice.message
    : undefined;

  return {
    resultKeys: Object.keys(result),
    responseType: typeof result.response,
    choicesLength: Array.isArray(result.choices) ? result.choices.length : undefined,
    firstChoiceKeys: isRecord(firstChoice) ? Object.keys(firstChoice) : undefined,
    messageKeys: message === undefined ? undefined : Object.keys(message),
    contentType: message === undefined ? undefined : typeof message.content,
  };
}

function describeError(error: unknown): Record<string, unknown> {
  if (!isRecord(error)) {
    return { errorType: typeof error };
  }

  return {
    name: typeof error.name === 'string' ? error.name : undefined,
    status: typeof error.status === 'number' ? error.status : undefined,
    code: typeof error.code === 'number' || typeof error.code === 'string' ? error.code : undefined,
    message: typeof error.message === 'string' ? error.message.slice(0, 300) : undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
