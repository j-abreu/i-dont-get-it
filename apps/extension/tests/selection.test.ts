import { describe, expect, it } from 'vitest';

import {
  applyContextMenuFallback,
  isSelectionCaptureResult,
  MAX_CONTEXT_BLOCK_CHARACTERS,
  normalizeReadableText,
  truncateContextText,
} from '../src/shared/selection';

const PAGE = {
  title: 'Article',
  hostname: 'example.com',
};

describe('selection result helpers', () => {
  it('accepts a valid captured snapshot', () => {
    expect(
      isSelectionCaptureResult({
        status: 'captured',
        source: 'dom',
        snapshot: {
          selectedText: 'selected text',
          context: {
            immediate: 'A paragraph with selected text.',
            containingBlock: 'A paragraph with selected text.',
          },
          page: PAGE,
        },
      }),
    ).toBe(true);
  });

  it('rejects incomplete and unrelated results', () => {
    expect(isSelectionCaptureResult(undefined)).toBe(false);
    expect(isSelectionCaptureResult({ status: 'captured' })).toBe(false);
    expect(isSelectionCaptureResult({ status: 'failed' })).toBe(false);
  });

  it('normalizes whitespace while preserving paragraph boundaries', () => {
    expect(normalizeReadableText(' First   line \n\n Second\tline ')).toBe(
      'First line\n\nSecond line',
    );
  });

  it('bounds context text without exceeding the limit', () => {
    const result = truncateContextText('a'.repeat(MAX_CONTEXT_BLOCK_CHARACTERS + 100));

    expect(result).toHaveLength(MAX_CONTEXT_BLOCK_CHARACTERS);
    expect(result.endsWith('…')).toBe(true);
  });

  it('creates a local snapshot from context-menu text as a fallback', () => {
    const result = applyContextMenuFallback(
      {
        status: 'rejected',
        reason: 'empty-selection',
        message: 'Select some text.',
        page: PAGE,
      },
      '  selected   text  ',
    );

    expect(result).toEqual({
      status: 'captured',
      source: 'context-menu-fallback',
      snapshot: {
        selectedText: 'selected text',
        context: { immediate: 'selected text', containingBlock: 'selected text' },
        page: PAGE,
      },
    });
  });
});
