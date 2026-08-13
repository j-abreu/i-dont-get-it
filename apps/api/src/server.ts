import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

import { buildApp } from './app.js';
import { createConfiguredExplanationProvider } from './provider-config.js';

if (existsSync('.env')) {
  loadEnvFile('.env');
}

const host = process.env.API_HOST ?? '127.0.0.1';
const parsedPort = Number.parseInt(process.env.API_PORT ?? '8787', 10);
const port = Number.isSafeInteger(parsedPort) ? parsedPort : 8787;

const app = buildApp({ provider: createConfiguredExplanationProvider() });

try {
  await app.listen({ host, port });
} catch (error: unknown) {
  app.log.error(error);
  process.exitCode = 1;
}
