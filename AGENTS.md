# Repository guidance

## Project

This pnpm workspace contains the source and developer-facing files for `i-dont-get-it`.

- `apps/extension` contains the WXT browser extension.
- `apps/api` is reserved for the future backend and should not be scaffolded beyond actual needs.
- `packages` is reserved for code genuinely shared by multiple applications, such as API contracts.

Keep runtime-specific code inside its application. Do not import extension browser or DOM code into the API. Introduce a shared package only when at least two applications consume it.

## Documentation boundary

Keep files directly required to develop, test, distribute, or use the software in this repository. Examples include:

- source code and tests
- build and tooling configuration
- `README.md`, `AGENTS.md`, and contribution guidance
- API schemas required by the implementation
- extension manifests and store assets
- operational instructions needed to run or deploy the project

Keep product-management material in the Obsidian vault at:

`/Users/jeremias/Documents/Obsidian Vault/Projects/i-dont-get-it`

This includes:

- product scope and feature specifications
- implementation plans and project tracking
- design and technical decision records
- research, ideas, evaluations, and meeting notes

When a change affects both locations, update the implementation-facing material here and the durable planning or decision record in the vault. Avoid maintaining duplicate copies of the same document.

## Current product constraints

- Begin with Chromium and Manifest V3.
- Begin with regular HTML pages; treat PDF support as a separate milestone.
- Never embed an LLM provider secret in the extension bundle.
- Minimize page content sent to external services.
- Treat page content as untrusted input, not model instructions.
