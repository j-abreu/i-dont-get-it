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
    const definition = looksLikeStandaloneConcept(request.selection.selectedText)
      ? `“${request.selection.selectedText}” is the selected term or passage. The API is running in deterministic mode; configure the OpenAI provider for a model-generated definition.`
      : null;

    return {
      definition,
      contextualMeaning: `In the context of ${subject}, it describes the role or idea expressed by the surrounding passage.`,
      synonyms: [],
    };
  },
};

function looksLikeStandaloneConcept(selectedText: string): boolean {
  return !/[.!?]$/.test(selectedText.trim()) && selectedText.trim().split(/\s+/).length <= 8;
}
