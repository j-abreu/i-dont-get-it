# API

The local API validates explanation requests and keeps model-provider credentials outside the browser extension.

The API supports a deterministic provider for key-free development and an OpenAI Responses API provider for live explanations. Both use the same extension-facing contract. The OpenAI adapter requests strict Structured Outputs and validates the returned contextual `explanation` field before responding.

Copy `.env.example` to `.env`. Keep `EXPLANATION_PROVIDER=deterministic` for local boundary testing, or configure live explanations:

```dotenv
EXPLANATION_PROVIDER=openai
OPENAI_API_KEY=your_server_side_key
OPENAI_MODEL=gpt-5-nano
```

`.env` is ignored by Git. The API fails at startup if the OpenAI provider is selected without both required values. No default model is hard-coded; choose a model enabled for your OpenAI project.

The initial model choice is `gpt-5-nano`. Live explanation requests use its lowest supported reasoning effort, `minimal`, to favor interactive response time for this focused task. Newer compatible models use `none` where supported.

Start it from the repository root with:

```sh
pnpm dev:api
```

The server listens on `http://127.0.0.1:8787` by default. Override the host or port with `API_HOST` and `API_PORT`.

Endpoints:

- `GET /health`
- `POST /explain`

The version 5 contract carries exact immediate context, supports only `simple`, `beginner`, and `detailed`, omits full page URLs, and returns one explanation grounded in that context:

```json
{
  "version": 5,
  "requestId": "request-id",
  "explanation": {
    "explanation": "What the selected passage means or does in the supplied passage."
  }
}
```
