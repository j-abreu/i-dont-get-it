import { describe, expect, it } from 'vitest';

import { createConfiguredExplanationProvider } from '../src/provider-config.js';

describe('provider configuration', () => {
  it('defaults to the deterministic provider for key-free development', async () => {
    const provider = createConfiguredExplanationProvider({});

    await expect(
      provider.explain({
        version: 1,
        selection: {
          selectedText: 'selected text',
          context: { containingBlock: 'selected text in context' },
          page: { title: 'Article', url: '', hostname: '' },
        },
        preferences: { level: 'simple' },
      }),
    ).resolves.toMatchObject({ text: expect.stringContaining('deterministic mode') });
  });

  it('fails fast when OpenAI configuration is incomplete', () => {
    expect(() =>
      createConfiguredExplanationProvider({ EXPLANATION_PROVIDER: 'openai' }),
    ).toThrow('requires OPENAI_API_KEY and OPENAI_MODEL');
  });

  it('rejects unknown providers', () => {
    expect(() =>
      createConfiguredExplanationProvider({ EXPLANATION_PROVIDER: 'unknown' }),
    ).toThrow('Unsupported EXPLANATION_PROVIDER');
  });
});
