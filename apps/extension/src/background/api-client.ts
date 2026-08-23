import {
  EXPLANATION_CONTRACT_VERSION,
  isExplainResponse,
  type ExplainErrorResponse,
  type ExplainRequest,
  type ExplainResponse,
} from '@i-dont-get-it/contracts';

import { resolveApiBaseUrl } from '../shared/api-config';

export async function requestExplanation(
  request: ExplainRequest,
  options: {
    fetch?: typeof fetch;
    apiBaseUrl?: string;
  } = {},
): Promise<ExplainResponse> {
  const fetcher = options.fetch ?? fetch;
  const apiBaseUrl =
    options.apiBaseUrl ??
    resolveApiBaseUrl(import.meta.env.MODE, import.meta.env.WXT_API_BASE_URL);

  try {
    const response = await fetcher(new URL('/explain', apiBaseUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    });
    const body: unknown = await response.json();

    if (isExplainResponse(body)) {
      return body;
    }
  } catch {
    // The stable public error below intentionally hides transport details.
  }

  return createUnavailableResponse();
}

function createUnavailableResponse(): ExplainErrorResponse {
  return {
    version: EXPLANATION_CONTRACT_VERSION,
    error: {
      code: 'service_unavailable',
      message: 'The explanation service is unavailable.',
      retryable: true,
    },
  };
}
