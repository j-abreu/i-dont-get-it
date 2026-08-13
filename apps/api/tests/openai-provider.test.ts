import { EXPLANATION_CONTRACT_VERSION, type ExplainRequest } from '@i-dont-get-it/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  createOpenAIExplanationProvider,
  type ResponsesClient,
} from '../src/openai-provider.js';
import { ExplanationProviderError } from '../src/provider.js';

describe('OpenAI explanation provider', () => {
  it('uses the configured model, disables storage, and returns output text', async () => {
    const create = vi
      .fn<ResponsesClient['responses']['create']>()
      .mockResolvedValue({ output_text: '  A model explanation.  ' });
    const provider = createProvider(create);

    await expect(provider.explain(createRequest())).resolves.toEqual({
      text: 'A model explanation.',
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'configured-model',
        reasoning: { effort: 'none' },
        store: false,
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
      .mockResolvedValue({ output_text: 'A concise explanation.' });
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

  it('rejects an empty model response as a non-retryable internal error', async () => {
    const provider = createProvider(
      vi.fn<ResponsesClient['responses']['create']>().mockResolvedValue({ output_text: '   ' }),
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

function createRequest(): ExplainRequest {
  return {
    version: EXPLANATION_CONTRACT_VERSION,
    selection: {
      selectedText: 'contextual representation',
      context: { containingBlock: 'A model learns a contextual representation.' },
      page: {
        title: 'Models',
        url: 'https://example.com/models',
        hostname: 'example.com',
      },
    },
    preferences: { level: 'simple' },
  };
}
