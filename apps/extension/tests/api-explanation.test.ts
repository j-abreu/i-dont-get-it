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

    await expect(generateApiExplanation(createSnapshot(), { level: 'simple' })).resolves.toEqual({
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

  it('forwards a detailed explanation level without changing the selection snapshot', async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      version: EXPLANATION_CONTRACT_VERSION,
      requestId: 'request-2',
      explanation: { text: 'A detailed explanation.' },
    });
    vi.stubGlobal('browser', { runtime: { sendMessage } });
    const snapshot = createSnapshot();

    await generateApiExplanation(snapshot, { level: 'detailed' });

    expect(sendMessage).toHaveBeenCalledWith({
      type: 'i-dont-get-it/explain',
      request: {
        version: EXPLANATION_CONTRACT_VERSION,
        selection: snapshot,
        preferences: { level: 'detailed', responseLanguage: 'en' },
      },
    });
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

    await expect(generateApiExplanation(createSnapshot(), { level: 'simple' })).rejects.toThrow(
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
