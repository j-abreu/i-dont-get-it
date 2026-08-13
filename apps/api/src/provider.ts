import type { ExplainRequest } from '@i-dont-get-it/contracts';

export type ExplanationProviderResult = {
  text: string;
};

export type ExplanationProvider = {
  explain: (request: ExplainRequest) => Promise<ExplanationProviderResult>;
};

export const deterministicExplanationProvider: ExplanationProvider = {
  async explain(request) {
    const subject = request.selection.context.heading || request.selection.page.title || 'this passage';

    return {
      text: `In the context of ${subject}, “${request.selection.selectedText}” describes the role or idea expressed by the surrounding passage. This response crossed the local API boundary; a later slice will replace the deterministic provider with a model-generated explanation.`,
    };
  },
};
