# i-dont-get-it

A browser extension and supporting API that explain selected text using the context of the page the user is reading.

The initial product targets Chromium browsers and regular web pages. A user selects a term, sentence, or paragraph, invokes the extension, and receives a contextual explanation without leaving the page.

## Status

The first browser vertical slice and local API boundary are complete. The Fastify API supports deterministic local responses and live model explanations through a server-side OpenAI Responses API adapter. A separate Cloudflare Worker production target is now available for Workers AI evaluation.

## Repository structure

```text
apps/
├── extension/  WXT browser extension
├── api/        Fastify/OpenAI local and reference gateway
└── worker/     Cloudflare Workers/Workers AI production target
packages/
├── contracts/        Shared versioned request and response validation
└── explanation-core/ Shared prompt construction and safety boundary
```

## Requirements

- Node.js 22 or newer
- pnpm 11
- A Chromium-based browser

## Development

Install dependencies:

```sh
pnpm install
```

Start WXT's development mode:

```sh
pnpm dev
```

In a second terminal, start the local explanation API:

```sh
pnpm dev:api
```

To develop the separate Cloudflare target instead, authenticate Wrangler as described in `apps/worker/README.md`, then run:

```sh
pnpm dev:worker
```

The deterministic provider requires no credentials. For live explanations, copy `apps/api/.env.example` to `apps/api/.env`, set `EXPLANATION_PROVIDER=openai`, and provide `OPENAI_API_KEY`. The initial recommended model is `gpt-5-nano`. Credentials remain in the API process and are never bundled into the extension.

The root command starts the extension development server. It watches the extension source and produces a development build. Load it manually:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select `apps/extension/.output/chrome-mv3-dev` from this repository.

Run the project checks:

```sh
pnpm typecheck
pnpm test
pnpm build
```

Run the deterministic browser test fixture:

```sh
pnpm --filter @i-dont-get-it/extension test:fixture
```

Then open `http://127.0.0.1:4173/`. The fixture includes article prose, inline and multi-paragraph selections, link-heavy navigation, a dark panel, dynamic content, editable text, and a viewport-edge case.

The development extension is generated in `apps/extension/.output/chrome-mv3-dev`. The production extension is generated in `apps/extension/.output/chrome-mv3`.

The Worker application is deliberately not wired into the extension yet. A deployed Worker still needs the installation-credential flow and production extension URL/host-permission configuration before public use.

## Current extension behavior

The current **Explain selection** action captures a local selection snapshot and displays a deterministic explanation returned by the local API:

1. Select text on a normal HTTP(S) page.
2. Right-click the selection.
3. Choose **Explain selection**.
4. A floating explanation card appears near the selection.

The prototype card supports loading, close, error, and retry states and includes a collapsible view of the context used. It is isolated from page styling with Shadow DOM. Repeating the action replaces the existing card, and `Escape` closes it.

Development builds also log the full local snapshot—including selected text and nearby context—to make extraction behavior inspectable. Production builds log only a summary. The selection snapshot is sent to `http://127.0.0.1:8787/explain` by the extension service worker. The API uses the provider configured in `apps/api/.env`; deterministic mode remains the default.

If the API is stopped or unavailable, the card displays its existing error state and **Try again** control.

Current capture limits:

- Selected text: 5,000 characters
- Each surrounding context block: 2,000 characters
- Page title: 500 characters
- URL query parameters, fragments, and credentials are removed
- Textareas, text inputs, and contenteditable regions are supported; password inputs remain excluded

## Documentation

Development and usage documentation lives in this repository, primarily in this README and the application-specific READMEs. Internal product planning and decision records are maintained separately and are not part of the public repository.

## Initial product boundary

- Chromium browsers using Manifest V3
- Regular HTML pages
- Selection capture and nearby-page context extraction
- In-page explanation UI
- LLM access through a backend gateway
- No embedded provider credentials

PDF support, persistent annotations, accounts, billing, and additional browsers are later milestones.
