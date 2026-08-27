import { EXPLANATION_CONTRACT_VERSION, type ExplainRequest } from '@i-dont-get-it/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  createOpenAIExplanationProvider,
  type ResponsesClient,
} from '../src/openai-provider.js';
import { ExplanationProviderError } from '../src/provider.js';

describe('OpenAI explanation provider', () => {
  it('uses structured output and returns the validated explanation', async () => {
    const explanation = structured('A model contextual explanation.');
    const create = vi
      .fn<ResponsesClient['responses']['create']>()
      .mockResolvedValue({ output_text: JSON.stringify(explanation) });
    const provider = createProvider(create);

    await expect(provider.explain(createRequest())).resolves.toEqual(explanation);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'configured-model',
        metadata: { prompt_version: '2026-08-27-v6' },
        reasoning: { effort: 'none' },
        store: false,
        text: {
          format: expect.objectContaining({
            type: 'json_schema',
            name: 'structured_explanation',
            strict: true,
            schema: expect.objectContaining({
              additionalProperties: false,
              required: ['explanation', 'relatedTerms'],
            }),
          }),
        },
        instructions: expect.stringContaining('untrusted quoted page data'),
        input: [
          {
            role: 'user',
            content: [{ type: 'input_text', text: expect.any(String) }],
          },
        ],
      }),
    );
  });

  it('uses minimal reasoning for gpt-5-nano compatibility', async () => {
    const create = vi
      .fn<ResponsesClient['responses']['create']>()
      .mockResolvedValue({
        output_text: JSON.stringify(structured('A concise explanation.')),
      });
    const client: ResponsesClient = { responses: { create } };
    const provider = createOpenAIExplanationProvider({
      apiKey: 'test-key',
      model: 'gpt-5-nano',
      client,
    });

    await provider.explain(createRequest());

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ reasoning: { effort: 'minimal' } }),
    );
  });

  it('rejects malformed structured output as a non-retryable internal error', async () => {
    const provider = createProvider(
      vi.fn<ResponsesClient['responses']['create']>().mockResolvedValue({
        output_text: JSON.stringify({ definition: 'Missing required fields.' }),
      }),
    );

    await expect(provider.explain(createRequest())).rejects.toMatchObject({
      code: 'internal_error',
      retryable: false,
    });
  });

  it.each([
    [{ name: 'APIConnectionTimeoutError' }, 'timeout'],
    [{ name: 'APIConnectionError' }, 'service_unavailable'],
    [{ status: 429 }, 'service_unavailable'],
    [{ status: 500 }, 'service_unavailable'],
    [{ status: 400 }, 'internal_error'],
  ])('maps provider failure %o to %s', async (failure, code) => {
    const provider = createProvider(
      vi.fn<ResponsesClient['responses']['create']>().mockRejectedValue(failure),
    );

    await expect(provider.explain(createRequest())).rejects.toMatchObject({
      code,
    });
  });

  it('requires both server-side configuration values', () => {
    expect(() =>
      createOpenAIExplanationProvider({ apiKey: '', model: 'configured-model' }),
    ).toThrow('requires OPENAI_API_KEY and OPENAI_MODEL');
  });
});

function createProvider(create: ResponsesClient['responses']['create']) {
  const client: ResponsesClient = { responses: { create } };
  return createOpenAIExplanationProvider({
    apiKey: 'test-key',
    model: 'configured-model',
    client,
  });
}

function structured(explanation: string) {
  return { explanation, relatedTerms: [] };
}

function createRequest(): ExplainRequest {
  return {
    version: EXPLANATION_CONTRACT_VERSION,
    selection: {
      selectedText: 'contextual representation',
      context: {
        immediate: 'A model learns a contextual representation.',
        containingBlock: 'A model learns a contextual representation.',
      },
      page: {
        title: 'Models',
        hostname: 'example.com',
      },
    },
    preferences: { level: 'simple' },
  };
}
