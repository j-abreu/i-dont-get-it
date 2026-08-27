import { EXPLANATION_CONTRACT_VERSION, type ExplainRequest } from '@i-dont-get-it/contracts';
import { describe, expect, it, vi } from 'vitest';

import { requestExplanation } from '../src/background/api-client';

describe('requestExplanation', () => {
  it('posts the contract to the configured API', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          version: EXPLANATION_CONTRACT_VERSION,
          requestId: 'request-1',
          explanation: {
            explanation: 'A response from the API.',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    await expect(
      requestExplanation(createRequest(), {
        fetch: fetcher,
        apiBaseUrl: 'http://127.0.0.1:9999',
      }),
    ).resolves.toMatchObject({
      explanation: {
        explanation: 'A response from the API.',
      },
    });
    expect(fetcher).toHaveBeenCalledWith(
      new URL('http://127.0.0.1:9999/explain'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify(createRequest()) }),
    );
  });

  it('returns a safe error when transport or response validation fails', async () => {
    const failingFetch = vi.fn<typeof fetch>().mockRejectedValue(new Error('connection refused'));
    const invalidFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ provider: 'details' }), { status: 500 }),
    );

    await expect(
      requestExplanation(createRequest(), {
        fetch: failingFetch,
        apiBaseUrl: 'http://127.0.0.1:8787',
      }),
    ).resolves.toMatchObject({ error: { code: 'service_unavailable', retryable: true } });
    await expect(
      requestExplanation(createRequest(), {
        fetch: invalidFetch,
        apiBaseUrl: 'http://127.0.0.1:8787',
      }),
    ).resolves.toMatchObject({ error: { code: 'service_unavailable', retryable: true } });
  });
});

function createRequest(): ExplainRequest {
  return {
    version: EXPLANATION_CONTRACT_VERSION,
    selection: {
      selectedText: 'selected text',
      context: {
        immediate: 'A paragraph with selected text.',
        containingBlock: 'A paragraph with selected text.',
      },
      page: {
        title: 'Article',
        hostname: 'example.com',
      },
    },
    preferences: { level: 'simple' },
  };
}
