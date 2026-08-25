# Cloudflare Worker API

This application is the Cloudflare production target for `i-dont-get-it`. It is separate from `apps/api`, which remains the Fastify/OpenAI implementation and local reference service.

The Worker exposes the same versioned endpoints:

- `GET /health`
- `POST /explain`

Explanation requests use the shared contracts and prompt builder, run through the `AI` binding with `@cf/meta/llama-3.1-8b-instruct-fast`, and are limited to 10 requests per minute per installation identifier or fallback client address. Workers AI JSON Schema mode returns separate `definition`, `contextualMeaning`, and `synonyms` fields; the Worker validates the exact structure before returning it.

## Local checks

From the workspace root:

```sh
pnpm install
pnpm --filter @i-dont-get-it/worker typecheck
pnpm --filter @i-dont-get-it/worker test
pnpm --filter @i-dont-get-it/worker build
```

Start Wrangler development mode with:

```sh
pnpm --filter @i-dont-get-it/worker dev
```

Workers AI calls require Cloudflare authentication and may use remote resources even while the request handler is developed locally. Run `pnpm --filter @i-dont-get-it/worker exec wrangler login` before the first live inference test.

## Deploy

Review the Worker name, compatibility date, rate-limit namespace, observability settings, and account in `wrangler.jsonc`, then run:

```sh
pnpm --filter @i-dont-get-it/worker run deploy
```

Do not point a public extension build at the deployed URL yet. The current `x-installation-id` is only a rate-limit key and is not authenticated. A Turnstile-backed installation credential flow and extension production URL configuration remain required before public release.

Worker logs must stay metadata-only. Never add the request body, selected text, page metadata, prompt, or model output to logs.

## Cloudflare references

- [Workers AI binding](https://developers.cloudflare.com/workers-ai/configuration/bindings/)
- [Workers AI JSON mode](https://developers.cloudflare.com/workers-ai/features/json-mode/)
- [Llama 3.1 8B Instruct Fast model](https://developers.cloudflare.com/ai/models/%40cf/meta/llama-3.1-8b-instruct-fast/)
- [Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
