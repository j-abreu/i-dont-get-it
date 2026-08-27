import type { ExplainRequest, StructuredExplanation } from '@i-dont-get-it/contracts';

export type ExplanationProviderResult = StructuredExplanation;

export type ExplanationProvider = {
  explain: (request: ExplainRequest) => Promise<ExplanationProviderResult>;
};

export type ExplanationProviderErrorCode = 'timeout' | 'service_unavailable' | 'internal_error';

export class ExplanationProviderError extends Error {
  constructor(
    readonly code: ExplanationProviderErrorCode,
    readonly retryable: boolean,
  ) {
    super('The explanation provider failed.');
    this.name = 'ExplanationProviderError';
  }
}

export const deterministicExplanationProvider: ExplanationProvider = {
  async explain(request) {
    const subject = request.selection.context.heading || request.selection.page.title || 'this passage';

    return {
      explanation: `In the context of ${subject}, the selected passage describes the role or idea expressed by the surrounding text.`,
      relatedTerms: [],
    };
  },
};
