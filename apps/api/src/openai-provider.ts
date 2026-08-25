import OpenAI, { APIConnectionError, APIConnectionTimeoutError, APIError } from 'openai';
import {
  isStructuredExplanation,
  STRUCTURED_EXPLANATION_JSON_SCHEMA,
} from '@i-dont-get-it/contracts';

import { buildExplanationPrompt } from './prompt.js';
import {
  ExplanationProviderError,
  type ExplanationProvider,
} from './provider.js';

export type ResponsesClient = {
  responses: {
    create: (request: {
      model: string;
      instructions: string;
      input: Array<{
        role: 'user';
        content: Array<{ type: 'input_text'; text: string }>;
      }>;
      max_output_tokens: number;
      reasoning: { effort: 'none' | 'minimal' };
      store: false;
      text: {
        format: {
          type: 'json_schema';
          name: 'structured_explanation';
          description: 'A standalone definition and its meaning in the supplied context.';
          strict: true;
          schema: typeof STRUCTURED_EXPLANATION_JSON_SCHEMA;
        };
      };
    }) => Promise<{ output_text: string }>;
  };
};

type OpenAIProviderOptions = {
  apiKey: string;
  model: string;
  client?: ResponsesClient;
};

export function createOpenAIExplanationProvider(
  options: OpenAIProviderOptions,
): ExplanationProvider {
  const apiKey = options.apiKey.trim();
  const model = options.model.trim();

  if (apiKey.length === 0 || model.length === 0) {
    throw new Error('The OpenAI provider requires OPENAI_API_KEY and OPENAI_MODEL.');
  }

  const client: ResponsesClient = options.client ?? new OpenAI({ apiKey });
  const reasoningEffort = model === 'gpt-5-nano' ? 'minimal' : 'none';

  return {
    async explain(request) {
      const prompt = buildExplanationPrompt(request);

      try {
        const response = await client.responses.create({
          model,
          instructions: prompt.instructions,
          input: [
            {
              role: 'user',
              content: [{ type: 'input_text', text: prompt.input }],
            },
          ],
          max_output_tokens: prompt.maxOutputTokens,
          reasoning: { effort: reasoningEffort },
          store: false,
          text: {
            format: {
              type: 'json_schema',
              name: 'structured_explanation',
              description: 'A standalone definition and its meaning in the supplied context.',
              strict: true,
              schema: STRUCTURED_EXPLANATION_JSON_SCHEMA,
            },
          },
        });
        const explanation = parseStructuredExplanation(response.output_text);

        if (explanation === undefined) {
          throw new ExplanationProviderError('internal_error', false);
        }

        return explanation;
      } catch (error: unknown) {
        if (error instanceof ExplanationProviderError) {
          throw error;
        }

        throw classifyOpenAIError(error);
      }
    },
  };
}

function parseStructuredExplanation(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    return isStructuredExplanation(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function classifyOpenAIError(error: unknown): ExplanationProviderError {
  if (error instanceof APIConnectionTimeoutError) {
    return new ExplanationProviderError('timeout', true);
  }

  if (error instanceof APIConnectionError) {
    return new ExplanationProviderError('service_unavailable', true);
  }

  if (error instanceof APIError) {
    if (error.status === 429 || (error.status !== undefined && error.status >= 500)) {
      return new ExplanationProviderError('service_unavailable', true);
    }

    return new ExplanationProviderError('internal_error', false);
  }

  if (isRecord(error)) {
    if (error.name === 'APIConnectionTimeoutError') {
      return new ExplanationProviderError('timeout', true);
    }

    if (error.name === 'APIConnectionError' || error.status === 429) {
      return new ExplanationProviderError('service_unavailable', true);
    }

    if (typeof error.status === 'number' && error.status >= 500) {
      return new ExplanationProviderError('service_unavailable', true);
    }
  }

  return new ExplanationProviderError('internal_error', false);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
