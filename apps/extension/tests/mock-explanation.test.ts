import { describe, expect, it, vi } from 'vitest';

import { generateMockExplanation } from '../src/content/mock-explanation';
import type { SelectionSnapshot } from '../src/shared/selection';

describe('generateMockExplanation', () => {
  it('returns a deterministic asynchronous prototype explanation', async () => {
    vi.useFakeTimers();
    const promise = generateMockExplanation(createSnapshot());
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toEqual({
      text: expect.stringContaining('“contextual representation”'),
    });
    vi.useRealTimers();
  });
});

function createSnapshot(): SelectionSnapshot {
  return {
    selectedText: 'contextual representation',
    context: {
      heading: 'How models learn',
      containingBlock: 'A model learns a contextual representation from examples.',
    },
    page: {
      title: 'Contextual article',
      url: 'https://example.com/article',
      hostname: 'example.com',
      language: 'en',
    },
  };
}
