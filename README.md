# i-dont-get-it

A browser extension and supporting API that explain selected text using the context of the page the user is reading.

The initial product targets Chromium browsers and regular web pages. A user selects a term, sentence, or paragraph, invokes the extension, and receives a contextual explanation without leaving the page.

## Status

The project is implementing its first vertical slice. The current build is a minimal Manifest V3 extension foundation; selection and explanation behavior have not been added yet. The API is planned but has not been scaffolded.

## Repository structure

```text
apps/
├── extension/  WXT browser extension
└── api/        Reserved for the future backend
```

Shared packages, including request and response contracts, will be introduced under `packages/` only when they are needed.

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

The development extension is generated in `apps/extension/.output/chrome-mv3-dev`. The production extension is generated in `apps/extension/.output/chrome-mv3`.

## Current extension behavior

The current **Explain selection** action captures a local selection snapshot:

1. Select text on a normal HTTP(S) page.
2. Right-click the selection.
3. Choose **Explain selection**.
4. Inspect the extension service worker console to see the snapshot summary and development payload.

Development builds log the full local snapshot—including selected text and nearby context—to make extraction behavior inspectable. Production builds log only a summary. No network request is made. A visible explanation interface is introduced in a later slice.

Current capture limits:

- Selected text: 5,000 characters
- Each surrounding context block: 2,000 characters
- Page title: 500 characters
- URL query parameters, fragments, and credentials are removed
- Editable fields are unsupported

## Documentation

Development and usage files live in this repository. Product planning, scope, project tracking, and decision records live in the Obsidian vault at:

`/Users/jeremias/Documents/Obsidian Vault/Projects/i-dont-get-it`

Start with `Project home.md` in that folder.

## Initial product boundary

- Chromium browsers using Manifest V3
- Regular HTML pages
- Selection capture and nearby-page context extraction
- In-page explanation UI
- LLM access through a backend gateway
- No embedded provider credentials

PDF support, persistent annotations, accounts, billing, and additional browsers are later milestones.
