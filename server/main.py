"""
MIP-Tailwind backend — a lightweight FastAPI service.

Two jobs, both so the browser never holds provider keys and isn't blocked by CORS:
  POST /api/chat           -> proxy a chat completion to an OpenAI-compatible (or
                              Anthropic) provider using the caller-supplied base
                              URL / key / model. Powers the in-app AI assistant.
  POST /api/test-endpoint  -> proxy an arbitrary REST request (the Connections
                              editor's "Test selected endpoint"), returning status
                              + parsed body.

Run:  uvicorn main:app --reload --port 8787   (see README.md)
Deps: fastapi, uvicorn, httpx   (requirements.txt)
"""

from __future__ import annotations

import time
from typing import Any

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="MIP-Tailwind backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5183",
        "http://127.0.0.1:5183",
        "http://localhost:5173",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Chat proxy
# ---------------------------------------------------------------------------

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    provider: str = "openai"        # "openai" | "anthropic" | any OpenAI-compatible
    baseUrl: str                    # e.g. https://api.deepseek.com, http://localhost:11434
    apiKey: str | None = None
    model: str = "gpt-4o-mini"
    messages: list[ChatMessage]
    system: str | None = None
    temperature: float = 0.7


def _normalize_openai_url(base: str) -> str:
    base = base.rstrip("/")
    if base.endswith("/chat/completions"):
        return base
    if base.endswith("/v1"):
        return base + "/chat/completions"
    return base + "/v1/chat/completions"


@app.post("/api/chat")
async def chat(req: ChatRequest) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            if req.provider == "anthropic":
                url = req.baseUrl.rstrip("/") + "/v1/messages"
                headers = {
                    "x-api-key": req.apiKey or "",
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                }
                payload: dict[str, Any] = {
                    "model": req.model,
                    "max_tokens": 1024,
                    "messages": [m.model_dump() for m in req.messages],
                }
                if req.system:
                    payload["system"] = req.system
                resp = await client.post(url, headers=headers, json=payload)
                data = resp.json()
                if resp.status_code >= 400:
                    return {"ok": False, "status": resp.status_code, "error": data}
                text = "".join(block.get("text", "") for block in data.get("content", []) if block.get("type") == "text")
                return {"ok": True, "content": text, "raw": data}

            # OpenAI-compatible (OpenAI, DeepSeek, Mistral, Perplexity, Ollama, vLLM, ...)
            url = _normalize_openai_url(req.baseUrl)
            headers = {"content-type": "application/json"}
            if req.apiKey:
                headers["authorization"] = f"Bearer {req.apiKey}"
            msgs = ([{"role": "system", "content": req.system}] if req.system else []) + [m.model_dump() for m in req.messages]
            resp = await client.post(url, headers=headers, json={"model": req.model, "messages": msgs, "temperature": req.temperature})
            data = resp.json()
            if resp.status_code >= 400:
                return {"ok": False, "status": resp.status_code, "error": data}
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            return {"ok": True, "content": content, "raw": data}
    except Exception as exc:  # noqa: BLE001 - surface the error to the client
        return {"ok": False, "error": str(exc)}


# ---------------------------------------------------------------------------
# Endpoint test proxy (Connections editor)
# ---------------------------------------------------------------------------

class TestRequest(BaseModel):
    method: str = "GET"
    url: str
    headers: dict[str, str] = {}
    body: Any | None = None


@app.post("/api/test-endpoint")
async def test_endpoint(req: TestRequest) -> dict[str, Any]:
    started = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            kwargs: dict[str, Any] = {"headers": req.headers}
            if req.body is not None and req.method.upper() not in ("GET", "HEAD"):
                kwargs["json"] = req.body
            resp = await client.request(req.method.upper(), req.url, **kwargs)
            duration_ms = round((time.perf_counter() - started) * 1000)
            try:
                parsed = resp.json()
            except Exception:  # noqa: BLE001
                parsed = resp.text[:5000]
            return {"ok": resp.status_code < 400, "status": resp.status_code, "durationMs": duration_ms, "body": parsed}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc), "durationMs": round((time.perf_counter() - started) * 1000)}


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
