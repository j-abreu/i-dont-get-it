import { describe, expect, it } from 'vitest';

import {
  EXPLANATION_CONTRACT_VERSION,
  isExplainRequest,
  isExplainResponse,
} from '../src/index.js';

describe('explanation contracts', () => {
  it('accepts a bounded versioned request', () => {
    expect(isExplainRequest(createRequest())).toBe(true);
  });

  it('rejects unknown versions, levels, and oversized selections', () => {
    expect(isExplainRequest({ ...createRequest(), version: 2 })).toBe(false);
    expect(
      isExplainRequest({
        ...createRequest(),
        preferences: { level: 'academic' },
      }),
    ).toBe(false);
    expect(
      isExplainRequest({
        ...createRequest(),
        selection: { ...createRequest().selection, selectedText: 'x'.repeat(5_001) },
      }),
    ).toBe(false);
  });

  it('distinguishes valid success and error responses', () => {
    expect(
      isExplainResponse({
        version: EXPLANATION_CONTRACT_VERSION,
        requestId: 'request-1',
        explanation: { text: 'A useful explanation.' },
      }),
    ).toBe(true);
    expect(
      isExplainResponse({
        version: EXPLANATION_CONTRACT_VERSION,
        error: { code: 'invalid_request', message: 'Invalid request.', retryable: false },
      }),
    ).toBe(true);
  });
});

function createRequest() {
  return {
    version: EXPLANATION_CONTRACT_VERSION,
    selection: {
      selectedText: 'contextual representation',
      context: { containingBlock: 'A model learns a contextual representation.' },
      page: {
        title: 'How models learn',
        url: 'https://example.com/models',
        hostname: 'example.com',
        language: 'en',
      },
    },
    preferences: { level: 'simple' },
  };
}
