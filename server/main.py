"""
MIP-Tailwind backend — a lightweight FastAPI service.

Two jobs, both so the browser never holds provider keys and isn't blocked by CORS:
  POST /api/chat           -> proxy a chat completion to an OpenAI-compatible (or
                              Anthropic) provider using the caller-supplied base
                              URL / key / model. Powers the in-app AI assistant.
  POST /api/test-endpoint  -> proxy an arbitrary REST request (the Connections
                              editor's "Test selected endpoint"), returning status
                              + parsed body.

Run:  uvicorn main:app --reload --port 8799   (see README.md)
Deps: fastapi, uvicorn, httpx   (requirements.txt)
"""

from __future__ import annotations

import time
from typing import Any

import os
import re
import tempfile

import json

import httpx
from fastapi import Body, FastAPI, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import db

app = FastAPI(title="MIP-Tailwind backend", version="0.1.0")


@app.on_event("startup")
async def _startup() -> None:
    await db.init_db()


@app.on_event("shutdown")
async def _shutdown() -> None:
    await db.dispose()

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
    jsonMode: bool = False          # force a JSON-object response (OpenAI-compatible)


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
            body: dict[str, Any] = {"model": req.model, "messages": msgs, "temperature": req.temperature}
            if req.jsonMode:
                body["response_format"] = {"type": "json_object"}
            resp = await client.post(url, headers=headers, json=body)
            data = resp.json()
            if resp.status_code >= 400:
                return {"ok": False, "status": resp.status_code, "error": data}
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            return {"ok": True, "content": content, "raw": data}
    except Exception as exc:  # noqa: BLE001 - surface the error to the client
        return {"ok": False, "error": str(exc)}


@app.post("/api/chat/stream")
async def chat_stream(req: ChatRequest) -> StreamingResponse:
    """Stream a completion as Server-Sent Events. Each event is `data: <text-delta>`
    (the delta JSON-encoded); the stream ends with `data: [DONE]`. Works for
    OpenAI-compatible providers and Anthropic."""

    async def gen():
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                if req.provider == "anthropic":
                    url = req.baseUrl.rstrip("/") + "/v1/messages"
                    headers = {"x-api-key": req.apiKey or "", "anthropic-version": "2023-06-01", "content-type": "application/json"}
                    payload: dict[str, Any] = {"model": req.model, "max_tokens": 1024, "stream": True, "messages": [m.model_dump() for m in req.messages]}
                    if req.system:
                        payload["system"] = req.system
                    async with client.stream("POST", url, headers=headers, json=payload) as resp:
                        if resp.status_code >= 400:
                            body = (await resp.aread()).decode("utf-8", "ignore")
                            yield f"data: {json.dumps({'__error': body})}\n\n"
                            return
                        async for line in resp.aiter_lines():
                            if not line.startswith("data:"):
                                continue
                            chunk = line[5:].strip()
                            try:
                                evt = json.loads(chunk)
                            except Exception:
                                continue
                            if evt.get("type") == "content_block_delta":
                                t = evt.get("delta", {}).get("text", "")
                                if t:
                                    yield f"data: {json.dumps(t)}\n\n"
                    yield "data: [DONE]\n\n"
                    return

                # OpenAI-compatible
                url = _normalize_openai_url(req.baseUrl)
                headers = {"content-type": "application/json"}
                if req.apiKey:
                    headers["authorization"] = f"Bearer {req.apiKey}"
                msgs = ([{"role": "system", "content": req.system}] if req.system else []) + [m.model_dump() for m in req.messages]
                body: dict[str, Any] = {"model": req.model, "messages": msgs, "temperature": req.temperature, "stream": True}
                if req.jsonMode:
                    body["response_format"] = {"type": "json_object"}
                async with client.stream("POST", url, headers=headers, json=body) as resp:
                    if resp.status_code >= 400:
                        err = (await resp.aread()).decode("utf-8", "ignore")
                        yield f"data: {json.dumps({'__error': err})}\n\n"
                        return
                    async for line in resp.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        chunk = line[5:].strip()
                        if chunk == "[DONE]":
                            break
                        try:
                            evt = json.loads(chunk)
                        except Exception:
                            continue
                        delta = evt.get("choices", [{}])[0].get("delta", {}).get("content")
                        if delta:
                            yield f"data: {json.dumps(delta)}\n\n"
                yield "data: [DONE]\n\n"
        except Exception as exc:  # noqa: BLE001
            yield f"data: {json.dumps({'__error': str(exc)})}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


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
async def health() -> dict[str, Any]:
    return {"status": "ok", "db": db.is_enabled()}


# ---------------------------------------------------------------------------
# Page fetch — lets the assistant read a URL's content (CORS-safe, server-side).
# Returns the page title + a plain-text extraction (HTML stripped), truncated.
# ---------------------------------------------------------------------------

class FetchRequest(BaseModel):
    url: str
    maxChars: int = 8000


def _html_to_text(html: str) -> str:
    # Drop scripts/styles, then strip tags and collapse whitespace.
    no_blocks = re.sub(r"<(script|style|noscript)[\s\S]*?</\1>", " ", html, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", no_blocks)
    text = re.sub(r"&nbsp;", " ", text)
    return re.sub(r"\s+", " ", text).strip()


@app.post("/api/fetch")
async def fetch_page(req: FetchRequest) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True, headers={"user-agent": "Mozilla/5.0 (compatible; MIP-Tailwind/0.1)"}) as client:
            resp = await client.get(req.url)
        html = resp.text
        title_m = re.search(r"<title[^>]*>(.*?)</title>", html, flags=re.IGNORECASE | re.DOTALL)
        title = re.sub(r"\s+", " ", title_m.group(1)).strip() if title_m else ""
        text = _html_to_text(html)[: max(500, req.maxChars)]
        return {"ok": resp.status_code < 400, "status": resp.status_code, "url": str(resp.url), "title": title, "text": text}
    except Exception as exc:  # noqa: BLE001 - never return an empty message
        msg = str(exc).strip() or exc.__class__.__name__
        return {"ok": False, "error": f"Could not fetch {req.url}: {msg}"}


# ---------------------------------------------------------------------------
# Speech-to-text — local Whisper (faster-whisper)
# ---------------------------------------------------------------------------
# The model is lazy-loaded (singleton) so startup isn't blocked and the ~150MB
# weights are only downloaded on first use. Model size via WHISPER_MODEL
# (tiny/base/small/medium/large-v3); defaults to "base" on CPU/int8.

_whisper_model = None


def _get_whisper():
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel  # imported lazily

        name = os.environ.get("WHISPER_MODEL", "base")
        _whisper_model = WhisperModel(name, device="cpu", compute_type="int8")
    return _whisper_model


def _transcribe_file(path: str) -> str:
    model = _get_whisper()
    segments, _info = model.transcribe(path, beam_size=1)
    return " ".join(seg.text.strip() for seg in segments).strip()


@app.post("/api/transcribe")
async def transcribe(file: UploadFile = File(...)) -> dict[str, Any]:
    suffix = os.path.splitext(file.filename or "")[1] or ".webm"
    try:
        data = await file.read()
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(data)
            tmp_path = tmp.name
        try:
            text = await run_in_threadpool(_transcribe_file, tmp_path)
            return {"ok": True, "text": text}
        finally:
            os.unlink(tmp_path)
    except ModuleNotFoundError:
        return {"ok": False, "error": "Whisper not installed. Run: pip install faster-whisper"}
    except Exception as exc:  # noqa: BLE001 - surface to the client
        return {"ok": False, "error": str(exc)}


# ---------------------------------------------------------------------------
# Generic document-store CRUD (Postgres)
#   GET    /api/db/{collection}          -> list records
#   GET    /api/db/{collection}/{id}     -> one record
#   PUT    /api/db/{collection}/{id}     -> upsert (body = the document)
#   DELETE /api/db/{collection}/{id}     -> delete
# When the DB is unavailable, every route returns {ok: False, db: False} so the
# frontend keeps working off its localStorage cache.
# ---------------------------------------------------------------------------

def _check(collection: str) -> dict[str, Any] | None:
    if not db.is_enabled():
        return {"ok": False, "db": False, "error": "database not configured"}
    if collection not in db.COLLECTIONS:
        raise HTTPException(status_code=404, detail=f"unknown collection '{collection}'")
    return None


@app.get("/api/db/{collection}")
async def db_list(collection: str) -> dict[str, Any]:
    if (early := _check(collection)) is not None:
        return early
    return {"ok": True, "db": True, "records": await db.list_records(collection)}


@app.get("/api/db/{collection}/{rid}")
async def db_get(collection: str, rid: str) -> dict[str, Any]:
    if (early := _check(collection)) is not None:
        return early
    record = await db.get_record(collection, rid)
    if record is None:
        return {"ok": True, "db": True, "record": None}
    return {"ok": True, "db": True, "record": record}


@app.put("/api/db/{collection}/{rid}")
async def db_put(collection: str, rid: str, data: Any = Body(...)) -> dict[str, Any]:
    if (early := _check(collection)) is not None:
        return early
    return {"ok": True, "db": True, "record": await db.upsert_record(collection, rid, data)}


@app.delete("/api/db/{collection}/{rid}")
async def db_delete(collection: str, rid: str) -> dict[str, Any]:
    if (early := _check(collection)) is not None:
        return early
    return {"ok": True, "db": True, "deleted": await db.delete_record(collection, rid)}
