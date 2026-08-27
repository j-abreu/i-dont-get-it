# i-dont-get-it

<p align="center">
  <img src="apps/extension/public/icon/128.png" alt="i-dont-get-it teacher robot icon" width="128">
</p>

A browser extension and supporting API that explain selected text using the context of the page the user is reading.

The initial product targets Chromium browsers and regular web pages. A user selects a term, sentence, or paragraph, invokes the extension, and receives a contextual explanation without leaving the page.

## Status

The first browser vertical slice and API boundary are complete. The Fastify API supports deterministic local responses and live model explanations through a server-side OpenAI Responses API adapter. Production extension builds use the deployed Cloudflare Worker and Workers AI. Version `1.0.0` introduces a breaking structured explanation contract.

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

## Versioning

The extension follows semantic versioning. Small fixes and adjustments increment the patch version, new features increment the minor version, and large or breaking changes increment the major version.

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

Development extension builds call the local Fastify API at `http://127.0.0.1:8787`. Production builds call the deployed Cloudflare Worker at `https://i-dont-get-it-api.jere-lab.workers.dev`. WXT generates only the matching host permission for each mode. `WXT_API_BASE_URL` can override the origin; production builds reject HTTP, loopback, credential-bearing, or path-bearing overrides.

The deployed Worker still needs an installation-credential flow before unrestricted public use. The current rate limiter falls back to the connecting address when no installation identifier is supplied; that is abuse friction, not authentication.

## Current extension behavior

The current **I don't get it!** action captures a selection snapshot and displays the explanation returned by the configured API:

1. Select text on a normal HTTP(S) page.
2. Either choose **I don't get it!** from the context menu or press `Ctrl+Shift+Y` (`Control+Shift+Y` on macOS).
3. A floating explanation card appears near the selection.

The shortcut is scoped to Chrome and can be changed or restored at `chrome://extensions/shortcuts` if it conflicts with another installed extension.

The explanation card supports loading, close, error, and retry states and includes a collapsible view of the context used. Each result contains one **In this context** explanation of the exact selection. After a simple explanation succeeds, **Explain Like I'm 5** requests an accessible explanation for a complete beginner, while **Explain in more detail** requests additional depth. Both reuse the same bounded selection context and replace the answer when successful. The refinement buttons remain visible so the user can switch modes; the currently displayed mode is disabled. If a refinement fails, the last successful answer remains visible and can be retried. The card is isolated from page styling with Shadow DOM. Repeating the action replaces the existing card, and `Escape` closes it.

The beginner action sends only the internal explanation level `beginner`; its user-facing button text is not included in the model prompt. Beginner guidance requests common words, short sentences, immediate explanations for unavoidable terminology, and a simple example or analogy when useful—without talking down to the reader or mentioning age.

Development builds also log the full local snapshot—including selected text and nearby context—to make extraction behavior inspectable. Production builds log only a summary. The extension service worker sends the snapshot to the API origin selected for the build mode. Development uses the provider configured in `apps/api/.env`; deterministic mode remains the default. Production uses the deployed Cloudflare Worker and Workers AI.

The contract supports three explanation levels: `simple`, `beginner`, and `detailed`. Guidance controls each prose field separately so beginner explanations can use more accessible language without being mistaken for merely shorter answers.

The extension captures the sentence containing the exact DOM or text-control selection as immediate context and retains surrounding blocks only as secondary evidence. The shared model prompt keeps the selected passage as the subject, treats page content as untrusted data, and uses the page language only as a hint unless a future explicit user preference overrides it. Both model providers request a JSON Schema response containing one contextual `explanation` field; the API validates that structure before the extension renders it.

If the API is stopped or unavailable, the card displays its existing error state and **Try again** control.

Current capture limits:

- Selected text: 5,000 characters
- Each surrounding context block: 2,000 characters
- Page title: 500 characters
- Only the page hostname is retained; the full URL is not captured or sent
- Textareas, text inputs, and contenteditable regions are supported; password inputs remain excluded

The shared explanation package includes 60 synthetic evaluation cases spanning all three levels, selection types, multilingual passages, code and formulas, and adversarial page content. Run offline corpus checks with `pnpm --filter @i-dont-get-it/explanation-core eval`; live provider runs are opt-in and documented in `packages/explanation-core/evals/README.md`.

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
