# MIP-Tailwind backend

A tiny FastAPI service so the browser never holds provider API keys and isn't
blocked by CORS.

## Endpoints

| Route | Purpose |
|---|---|
| `POST /api/chat` | Proxy a chat completion to an OpenAI-compatible or Anthropic provider. Body: `{ provider, baseUrl, apiKey, model, messages, system? }`. Returns `{ ok, content, raw }`. |
| `POST /api/test-endpoint` | Proxy an arbitrary REST request (Connections → "Test selected endpoint"). Body: `{ method, url, headers, body? }`. Returns `{ ok, status, durationMs, body }`. |
| `POST /api/transcribe` | Speech-to-text via local Whisper (faster-whisper). Multipart `file` = recorded audio; returns `{ ok, text }`. Model size via `WHISPER_MODEL` (tiny/base/small/…; default `base`, CPU/int8). Weights download on first use. |
| `GET /api/health` | Liveness + `{ db: bool }` (whether Postgres is connected). |
| `GET /api/db/{collection}` | List records in a collection. |
| `GET /api/db/{collection}/{id}` | Get one record. |
| `PUT /api/db/{collection}/{id}` | Upsert (body = the document JSON). |
| `DELETE /api/db/{collection}/{id}` | Delete a record. |

Works with OpenAI, DeepSeek, Mistral, Perplexity, Anthropic, and any
OpenAI-compatible local server (Ollama, LM Studio, llama.cpp, vLLM).

## Persistence (Postgres)

The DB routes back a single generic `records` table keyed by
`(collection, id)` with a `jsonb` payload — one table for every entity
(`dashboards`, `connections`, `settings`, `tokens`, `components`, `apps`,
`conversations`, `themes`, `templates`, `users`, `access_tokens`). The schema is
created automatically on startup.

**Graceful degradation:** if `DATABASE_URL` is unset or the DB is unreachable,
the service still runs — `/api/health` reports `db: false` and the CRUD routes
return `{ ok: false, db: false }`, so the frontend keeps working off its
localStorage cache.

## Run

```bash
cd server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Postgres (optional — omit to run without persistence)
createdb mip_tailwind
export DATABASE_URL="postgresql+asyncpg://localhost/mip_tailwind"

uvicorn main:app --reload --port 8799
```

> **Port:** mip-tailwind uses **8799** (the original mip data-proxy owns 8787, so
> both stacks can run side by side).

`DATABASE_URL` defaults to `postgresql+asyncpg://localhost/mip_tailwind`; a plain
`postgres://…` URL is auto-rewritten to the asyncpg driver. The frontend calls
`http://localhost:8799` by default (override with `VITE_MIP_API`).
