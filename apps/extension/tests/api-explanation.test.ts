import { EXPLANATION_CONTRACT_VERSION } from '@i-dont-get-it/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { generateApiExplanation } from '../src/content/api-explanation';
import type { SelectionSnapshot } from '../src/shared/selection';

describe('generateApiExplanation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends a simple explanation request through extension messaging', async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      version: EXPLANATION_CONTRACT_VERSION,
      requestId: 'request-1',
      explanation: { text: 'A live-boundary explanation.' },
    });
    vi.stubGlobal('browser', { runtime: { sendMessage } });

    await expect(generateApiExplanation(createSnapshot())).resolves.toEqual({
      text: 'A live-boundary explanation.',
    });
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'i-dont-get-it/explain',
        request: expect.objectContaining({
          version: EXPLANATION_CONTRACT_VERSION,
          selection: createSnapshot(),
          preferences: { level: 'simple', responseLanguage: 'en' },
        }),
      }),
    );
  });

  it('rejects public API errors so the card can render its retry state', async () => {
    vi.stubGlobal('browser', {
      runtime: {
        sendMessage: vi.fn().mockResolvedValue({
          version: EXPLANATION_CONTRACT_VERSION,
          error: { code: 'service_unavailable', message: 'Unavailable.', retryable: true },
        }),
      },
    });

    await expect(generateApiExplanation(createSnapshot())).rejects.toThrow(
      'did not return a usable response',
    );
  });
});

function createSnapshot(): SelectionSnapshot {
  return {
    selectedText: 'selected text',
    context: { containingBlock: 'A paragraph with selected text.' },
    page: {
      title: 'Article',
      url: 'https://example.com/article',
      hostname: 'example.com',
      language: 'en',
    },
  };
}
