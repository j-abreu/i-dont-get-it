import { EXPLANATION_CONTRACT_VERSION } from '@i-dont-get-it/contracts';
import { describe, expect, it } from 'vitest';

import { isExplainRequestMessage } from '../src/shared/explanation-message';

describe('isExplainRequestMessage', () => {
  it('accepts only the extension explanation message and a valid request', () => {
    const request = {
      version: EXPLANATION_CONTRACT_VERSION,
      selection: {
        selectedText: 'selected text',
        context: {
          immediate: 'Selected text in context.',
          containingBlock: 'Selected text in context.',
        },
        page: { title: 'Article', hostname: '' },
      },
      preferences: { level: 'simple' },
    };

    expect(isExplainRequestMessage({ type: 'i-dont-get-it/explain', request })).toBe(true);
    expect(isExplainRequestMessage({ type: 'unrelated', request })).toBe(false);
    expect(isExplainRequestMessage({ type: 'i-dont-get-it/explain', request: {} })).toBe(false);
  });
});
