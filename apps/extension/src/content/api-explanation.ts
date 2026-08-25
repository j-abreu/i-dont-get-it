import {
  EXPLANATION_CONTRACT_VERSION,
  isExplainSuccessResponse,
  type ExplainRequest,
} from '@i-dont-get-it/contracts';

import type { ExplanationProvider } from './explanation-provider';
import {
  EXPLAIN_REQUEST_MESSAGE_TYPE,
  type ExplainRequestMessage,
} from '../shared/explanation-message';

export const generateApiExplanation: ExplanationProvider = async (snapshot, options) => {
  const request: ExplainRequest = {
    version: EXPLANATION_CONTRACT_VERSION,
    selection: snapshot,
    preferences: {
      level: options.level,
      ...(snapshot.page.language === undefined
        ? {}
        : { responseLanguage: snapshot.page.language }),
    },
  };
  const message: ExplainRequestMessage = {
    type: EXPLAIN_REQUEST_MESSAGE_TYPE,
    request,
  };
  const response: unknown = await browser.runtime.sendMessage(message);

  if (!isExplainSuccessResponse(response)) {
    throw new Error('The explanation service did not return a usable response.');
  }

  return response.explanation;
};
