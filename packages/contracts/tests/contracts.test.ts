import { describe, expect, it } from 'vitest';

import {
  EXPLANATION_CONTRACT_VERSION,
  isExplainRequest,
  isExplainResponse,
  isStructuredExplanation,
  STRUCTURED_EXPLANATION_JSON_SCHEMA,
} from '../src/index.js';

describe('explanation contracts', () => {
  it('accepts a bounded versioned request', () => {
    expect(isExplainRequest(createRequest())).toBe(true);
    expect(
      isExplainRequest({
        ...createRequest(),
        preferences: { level: 'beginner' },
      }),
    ).toBe(true);
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
        selection: {
          ...createRequest().selection,
          page: { ...createRequest().selection.page, url: 'https://example.com/private-path' },
        },
      }),
    ).toBe(false);
    expect(
      isExplainRequest({
        ...createRequest(),
        preferences: { level: 'concise' },
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
        explanation: {
          definition: 'A standalone definition.',
          contextualMeaning: 'Its meaning in this passage.',
          synonyms: [],
        },
      }),
    ).toBe(true);
    expect(
      isExplainResponse({
        version: EXPLANATION_CONTRACT_VERSION,
        error: { code: 'invalid_request', message: 'Invalid request.', retryable: false },
      }),
    ).toBe(true);
  });

  it('requires the exact structured explanation shape', () => {
    const valid = {
      definition: 'A standalone definition.',
      contextualMeaning: 'Its meaning in this passage.',
      synonyms: ['alternate name'],
    };

    expect(isStructuredExplanation(valid)).toBe(true);
    expect(isStructuredExplanation({ ...valid, definition: null, synonyms: [] })).toBe(true);
    expect(isStructuredExplanation({ ...valid, definition: null })).toBe(false);
    expect(isStructuredExplanation({ ...valid, synonyms: undefined })).toBe(false);
    expect(isStructuredExplanation({ ...valid, extra: 'not allowed' })).toBe(false);
    expect(isStructuredExplanation({ ...valid, synonyms: Array(6).fill('alias') })).toBe(false);
    expect(isStructuredExplanation({ ...valid, definition: 'x'.repeat(1_501) })).toBe(false);
    expect(isStructuredExplanation({ ...valid, contextualMeaning: 'x'.repeat(4_001) })).toBe(false);
    expect(STRUCTURED_EXPLANATION_JSON_SCHEMA).toMatchObject({
      additionalProperties: false,
      required: ['definition', 'contextualMeaning', 'synonyms'],
      properties: {
        definition: { type: ['string', 'null'], maxLength: 1_500 },
        contextualMeaning: { maxLength: 4_000 },
        synonyms: { maxItems: 5 },
      },
    });
  });
});

function createRequest() {
  return {
    version: EXPLANATION_CONTRACT_VERSION,
    selection: {
      selectedText: 'contextual representation',
      context: {
        immediate: 'A model learns a contextual representation.',
        containingBlock: 'A model learns a contextual representation.',
      },
      page: {
        title: 'How models learn',
        hostname: 'example.com',
        language: 'en',
      },
    },
    preferences: { level: 'simple' },
  };
}
