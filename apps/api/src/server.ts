import { buildApp } from './app.js';

const host = process.env.API_HOST ?? '127.0.0.1';
const parsedPort = Number.parseInt(process.env.API_PORT ?? '8787', 10);
const port = Number.isSafeInteger(parsedPort) ? parsedPort : 8787;

const app = buildApp();

try {
  await app.listen({ host, port });
} catch (error: unknown) {
  app.log.error(error);
  process.exitCode = 1;
}
