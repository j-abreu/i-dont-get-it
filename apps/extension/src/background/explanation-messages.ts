import { requestExplanation } from './api-client';
import { isExplainRequestMessage } from '../shared/explanation-message';

export function registerExplanationMessageHandler(): void {
  browser.runtime.onMessage.addListener((message: unknown) => {
    if (!isExplainRequestMessage(message)) {
      return undefined;
    }

    return requestExplanation(message.request);
  });
}
