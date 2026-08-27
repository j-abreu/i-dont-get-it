import { EXPLANATION_CONTRACT_VERSION, type ExplainRequest } from '@i-dont-get-it/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../src/app.js';
import { ExplanationProviderError, type ExplanationProvider } from '../src/provider.js';

const apps: ReturnType<typeof buildApp>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('API', () => {
  it('reports health without invoking a provider', async () => {
    const app = track(buildApp());
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('validates and explains a request through the provider boundary', async () => {
    const provider: ExplanationProvider = {
      explain: vi.fn().mockResolvedValue({
        explanation: 'A server-generated contextual explanation.',
        relatedTerms: [],
      }),
    };
    const app = track(buildApp({ provider }));
    const response = await app.inject({ method: 'POST', url: '/explain', payload: createRequest() });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      version: EXPLANATION_CONTRACT_VERSION,
      explanation: {
        explanation: 'A server-generated contextual explanation.',
        relatedTerms: [],
      },
    });
    expect(provider.explain).toHaveBeenCalledWith(createRequest());
  });

  it('rejects malformed input before invoking the provider', async () => {
    const provider: ExplanationProvider = { explain: vi.fn() };
    const app = track(buildApp({ provider }));
    const response = await app.inject({ method: 'POST', url: '/explain', payload: { version: 1 } });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: 'invalid_request', retryable: false },
    });
    expect(provider.explain).not.toHaveBeenCalled();
  });

  it('maps provider failures to a safe public response', async () => {
    const app = track(
      buildApp({
        provider: {
          explain: vi
            .fn()
            .mockRejectedValue(new ExplanationProviderError('service_unavailable', true)),
        },
      }),
    );
    const response = await app.inject({ method: 'POST', url: '/explain', payload: createRequest() });

    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain('provider secret');
    expect(response.json()).toMatchObject({
      error: { code: 'service_unavailable', retryable: true },
    });
  });
});

function track(app: ReturnType<typeof buildApp>) {
  apps.push(app);
  return app;
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
