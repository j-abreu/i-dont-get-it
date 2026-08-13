import type { ExplainRequest } from '@i-dont-get-it/contracts';

export type ExplanationProviderResult = {
  text: string;
};

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
      text: `In the context of ${subject}, “${request.selection.selectedText}” describes the role or idea expressed by the surrounding passage. The API is running in deterministic mode; configure the OpenAI provider for a model-generated explanation.`,
    };
  },
};
