import { EXPLANATION_CONTRACT_VERSION, type ExplainRequest } from '@i-dont-get-it/contracts';
import { describe, expect, it, vi } from 'vitest';

import { handleRequest, type ExplainRateLimiter } from '../src/handler.js';
import {
  ExplanationProviderError,
  type ExplanationProvider,
} from '../src/provider.js';

describe('Cloudflare Worker API', () => {
  it('reports health without consuming rate-limit or inference capacity', async () => {
    const provider: ExplanationProvider = { explain: vi.fn() };
    const rateLimiter = allowAll();
    const response = await handleRequest(new Request('https://api.example.com/health'), {
      provider,
      rateLimiter,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
    expect(rateLimiter.limit).not.toHaveBeenCalled();
    expect(provider.explain).not.toHaveBeenCalled();
  });

  it('validates and explains a request through the provider boundary', async () => {
    const provider: ExplanationProvider = {
      explain: vi.fn().mockResolvedValue({
        explanation: 'A Worker-generated contextual explanation.',
      }),
    };
    const response = await handleRequest(explainRequest(createRequest()), {
      provider,
      rateLimiter: allowAll(),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      version: EXPLANATION_CONTRACT_VERSION,
      explanation: {
        explanation: 'A Worker-generated contextual explanation.',
      },
    });
    expect(provider.explain).toHaveBeenCalledWith(createRequest());
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('rejects malformed and oversized requests before inference', async () => {
    const provider: ExplanationProvider = { explain: vi.fn() };

    const malformed = await handleRequest(explainRequest({ version: 1 }), {
      provider,
      rateLimiter: allowAll(),
    });
    const oversized = await handleRequest(
      new Request('https://api.example.com/explain', {
        method: 'POST',
        body: JSON.stringify({ padding: 'x'.repeat(33 * 1024) }),
      }),
      { provider, rateLimiter: allowAll() },
    );

    expect(malformed.status).toBe(400);
    expect(oversized.status).toBe(400);
    expect(provider.explain).not.toHaveBeenCalled();
  });

  it('rate limits before parsing or invoking inference', async () => {
    const provider: ExplanationProvider = { explain: vi.fn() };
    const response = await handleRequest(explainRequest(createRequest()), {
      provider,
      rateLimiter: {
        limit: vi.fn().mockResolvedValue({ success: false }),
      },
    });

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(await response.json()).toMatchObject({
      error: { code: 'service_unavailable', retryable: true },
    });
    expect(provider.explain).not.toHaveBeenCalled();
  });

  it('maps provider failures to safe public errors', async () => {
    const response = await handleRequest(explainRequest(createRequest()), {
      provider: {
        explain: vi
          .fn()
          .mockRejectedValue(new ExplanationProviderError('service_unavailable', true)),
      },
      rateLimiter: allowAll(),
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: 'service_unavailable', retryable: true },
    });
  });
});

function allowAll(): ExplainRateLimiter {
  return { limit: vi.fn().mockResolvedValue({ success: true }) };
}

function explainRequest(body: unknown): Request {
  return new Request('https://api.example.com/explain', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-installation-id': 'test-installation-id-0001',
    },
    body: JSON.stringify(body),
  });
}

function createRequest(): ExplainRequest {
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
