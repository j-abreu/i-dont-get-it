import {
  EXPLANATION_CONTRACT_VERSION,
  isExplainRequest,
  type ExplainErrorResponse,
  type ExplainSuccessResponse,
} from '@i-dont-get-it/contracts';
import Fastify from 'fastify';

import {
  deterministicExplanationProvider,
  type ExplanationProvider,
} from './provider.js';

const REQUEST_BODY_LIMIT_BYTES = 32 * 1024;

type BuildAppOptions = {
  provider?: ExplanationProvider;
};

export function buildApp(options: BuildAppOptions = {}) {
  const provider = options.provider ?? deterministicExplanationProvider;
  const app = Fastify({
    bodyLimit: REQUEST_BODY_LIMIT_BYTES,
    disableRequestLogging: true,
  });

  app.get('/health', async () => ({ status: 'ok' }));

  app.post('/explain', async (request, reply) => {
    if (!isExplainRequest(request.body)) {
      const response: ExplainErrorResponse = {
        version: EXPLANATION_CONTRACT_VERSION,
        requestId: request.id,
        error: {
          code: 'invalid_request',
          message: 'The explanation request is invalid.',
          retryable: false,
        },
      };
      return reply.code(400).send(response);
    }

    try {
      const explanation = await provider.explain(request.body);
      const response: ExplainSuccessResponse = {
        version: EXPLANATION_CONTRACT_VERSION,
        requestId: request.id,
        explanation,
      };
      return reply.code(200).send(response);
    } catch {
      const response: ExplainErrorResponse = {
        version: EXPLANATION_CONTRACT_VERSION,
        requestId: request.id,
        error: {
          code: 'service_unavailable',
          message: 'The explanation service is temporarily unavailable.',
          retryable: true,
        },
      };
      return reply.code(503).send(response);
    }
  });

  return app;
}
