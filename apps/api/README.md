# API

The local API validates explanation requests and keeps model-provider credentials outside the browser extension.

Slice 1 uses a deterministic provider so the complete extension-to-server boundary can be tested without an API key. A later slice will add the live provider adapter behind the same interface.

Start it from the repository root with:

```sh
pnpm dev:api
```

The server listens on `http://127.0.0.1:8787` by default. Override the host or port with `API_HOST` and `API_PORT`.

Endpoints:

- `GET /health`
- `POST /explain`
