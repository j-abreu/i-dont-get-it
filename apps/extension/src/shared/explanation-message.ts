import { isExplainRequest, type ExplainRequest } from '@i-dont-get-it/contracts';

export const EXPLAIN_REQUEST_MESSAGE_TYPE = 'i-dont-get-it/explain' as const;

export type ExplainRequestMessage = {
  type: typeof EXPLAIN_REQUEST_MESSAGE_TYPE;
  request: ExplainRequest;
};

export function isExplainRequestMessage(value: unknown): value is ExplainRequestMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === EXPLAIN_REQUEST_MESSAGE_TYPE &&
    'request' in value &&
    isExplainRequest(value.request)
  );
}
