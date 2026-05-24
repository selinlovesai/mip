# MIP-Tailwind backend

A tiny FastAPI service so the browser never holds provider API keys and isn't
blocked by CORS.

## Endpoints

| Route | Purpose |
|---|---|
| `POST /api/chat` | Proxy a chat completion to an OpenAI-compatible or Anthropic provider. Body: `{ provider, baseUrl, apiKey, model, messages, system? }`. Returns `{ ok, content, raw }`. |
| `POST /api/test-endpoint` | Proxy an arbitrary REST request (Connections → "Test selected endpoint"). Body: `{ method, url, headers, body? }`. Returns `{ ok, status, durationMs, body }`. |
| `GET /api/health` | Liveness. |

Works with OpenAI, DeepSeek, Mistral, Perplexity, Anthropic, and any
OpenAI-compatible local server (Ollama, LM Studio, llama.cpp, vLLM).

## Run

```bash
cd server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8787
```

The frontend calls `http://localhost:8787` by default (override with
`VITE_MIP_API` in the Vite app).
