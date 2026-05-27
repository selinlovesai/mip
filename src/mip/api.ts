/**
 * Client for the FastAPI backend (server/). Base URL from VITE_MIP_API or
 * http://localhost:8799. Used by the assistant (chat) and the Connections
 * editor (endpoint test).
 */

const BASE = (import.meta.env.VITE_MIP_API as string | undefined)?.replace(/\/$/, "") ?? "http://localhost:8799";

export interface ChatResult {
    ok: boolean;
    content?: string;
    error?: unknown;
    status?: number;
}

export async function chat(args: {
    provider: string;
    baseUrl: string;
    apiKey?: string;
    model: string;
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
    system?: string;
    jsonMode?: boolean;
    signal?: AbortSignal;
}): Promise<ChatResult> {
    const { signal, ...payload } = args;
    try {
        const res = await fetch(`${BASE}/api/chat`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
            signal,
        });
        return (await res.json()) as ChatResult;
    } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return { ok: false, error: "Stopped." };
        return { ok: false, error: err instanceof Error ? err.message : "Backend unreachable. Is the server running on " + BASE + "?" };
    }
}

/** Streaming chat: POSTs to /api/chat/stream and calls `onDelta` with the
 *  accumulated text as SSE chunks arrive. Resolves with the final content.
 *  Falls back to a clear error on abort/transport failure. */
export async function chatStream(
    args: {
        provider: string;
        baseUrl: string;
        apiKey?: string;
        model: string;
        messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
        system?: string;
        jsonMode?: boolean;
        signal?: AbortSignal;
    },
    onDelta: (accumulated: string) => void,
): Promise<ChatResult> {
    const { signal, ...payload } = args;
    try {
        const res = await fetch(`${BASE}/api/chat/stream`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
            signal,
        });
        if (!res.ok || !res.body) return { ok: false, status: res.status, error: `Stream failed (${res.status}).` };
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let content = "";
        let streamError: string | undefined;
        for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const events = buf.split("\n\n");
            buf = events.pop() ?? ""; // keep the trailing partial event
            for (const ev of events) {
                const line = ev.split("\n").find((l) => l.startsWith("data:"));
                if (!line) continue;
                const data = line.slice(5).trim();
                if (data === "[DONE]") continue;
                let piece: unknown;
                try {
                    piece = JSON.parse(data);
                } catch {
                    continue;
                }
                if (piece && typeof piece === "object" && "__error" in piece) {
                    streamError = String((piece as { __error: unknown }).__error);
                    continue;
                }
                if (typeof piece === "string") {
                    content += piece;
                    onDelta(content);
                }
            }
        }
        if (streamError && !content) return { ok: false, error: streamError };
        return { ok: true, content };
    } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return { ok: false, error: "Stopped." };
        return { ok: false, error: err instanceof Error ? err.message : "Backend unreachable." };
    }
}

export interface TestResult {
    ok: boolean;
    status?: number;
    durationMs?: number;
    body?: unknown;
    error?: unknown;
}

export async function testEndpoint(args: { method: string; url: string; headers?: Record<string, string>; body?: unknown; signal?: AbortSignal }): Promise<TestResult> {
    const { signal, ...payload } = args;
    try {
        const res = await fetch(`${BASE}/api/test-endpoint`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
            signal,
        });
        return (await res.json()) as TestResult;
    } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return { ok: false, error: "Stopped." };
        return { ok: false, error: err instanceof Error ? err.message : "Backend unreachable. Is the server running on " + BASE + "?" };
    }
}

export const API_BASE = BASE;

// ---------------------------------------------------------------------------
// Generic document-store client (Postgres-backed CRUD on the FastAPI backend).
// Collections: dashboards · connections · settings · tokens · components · apps
//            · conversations · themes · templates · users · access_tokens.
// Every call degrades gracefully: when the backend/DB is down, reads resolve to
// null/[] and writes resolve to false, so callers keep using localStorage.
// ---------------------------------------------------------------------------

export type DbCollection =
    | "dashboards"
    | "connections"
    | "settings"
    | "tokens"
    | "components"
    | "widget_types"
    | "apps"
    | "conversations"
    | "themes"
    | "templates"
    | "users"
    | "access_tokens";

export interface DbRecord<T = unknown> {
    id: string;
    data: T;
    updatedAt: string;
}

/** True if the backend is reachable AND has a live DB connection. */
export async function dbAvailable(): Promise<boolean> {
    try {
        const res = await fetch(`${BASE}/api/health`);
        const json = (await res.json()) as { db?: boolean };
        return json.db === true;
    } catch {
        return false;
    }
}

export async function dbList<T = unknown>(collection: DbCollection): Promise<DbRecord<T>[]> {
    try {
        const res = await fetch(`${BASE}/api/db/${collection}`);
        const json = (await res.json()) as { ok: boolean; records?: DbRecord<T>[] };
        return json.ok && json.records ? json.records : [];
    } catch {
        return [];
    }
}

export async function dbGet<T = unknown>(collection: DbCollection, id: string): Promise<DbRecord<T> | null> {
    try {
        const res = await fetch(`${BASE}/api/db/${collection}/${encodeURIComponent(id)}`);
        const json = (await res.json()) as { ok: boolean; record?: DbRecord<T> | null };
        return json.ok ? (json.record ?? null) : null;
    } catch {
        return null;
    }
}

export async function dbPut<T = unknown>(collection: DbCollection, id: string, data: T): Promise<boolean> {
    try {
        const res = await fetch(`${BASE}/api/db/${collection}/${encodeURIComponent(id)}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(data),
        });
        const json = (await res.json()) as { ok: boolean };
        return json.ok === true;
    } catch {
        return false;
    }
}

export async function dbDelete(collection: DbCollection, id: string): Promise<boolean> {
    try {
        const res = await fetch(`${BASE}/api/db/${collection}/${encodeURIComponent(id)}`, { method: "DELETE" });
        const json = (await res.json()) as { ok: boolean; deleted?: boolean };
        return json.ok === true && json.deleted !== false;
    } catch {
        return false;
    }
}

// ---------------------------------------------------------------------------
// Typed design tokens (directive #2). Backed by the `tokens` table; the
// Appearance browser reads + edits these and the app injects the emitted CSS at
// boot. All calls degrade gracefully (reads → [], writes → false) so a DB-less
// run keeps the bundled theme.css.
// ---------------------------------------------------------------------------

export type TokenMode = "light" | "dark";

export interface DesignToken {
    name: string; // CSS var, e.g. "--color-brand-600"
    mode: TokenMode;
    value: string; // verbatim CSS value
    kind: string; // "color" | "typography" | "radius" | "shadow"
    group: string;
    updatedAt: string;
}

export async function listTokens(kind?: string): Promise<DesignToken[]> {
    try {
        const res = await fetch(`${BASE}/api/tokens${kind ? `?kind=${encodeURIComponent(kind)}` : ""}`);
        const json = (await res.json()) as { ok: boolean; tokens?: DesignToken[] };
        return json.ok && json.tokens ? json.tokens : [];
    } catch {
        return [];
    }
}

export async function putToken(name: string, mode: TokenMode, value: string, kind = "color", group = ""): Promise<boolean> {
    try {
        const res = await fetch(`${BASE}/api/tokens/${encodeURIComponent(name)}/${mode}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ value, kind, group }),
        });
        const json = (await res.json()) as { ok: boolean };
        return json.ok === true;
    } catch {
        return false;
    }
}

/** Fetch the DB tokens compiled to CSS. `scope: "root"` for runtime injection,
 *  `"theme"` for the build-time `@theme` artifact. null when the DB is off. */
export async function fetchTokensCss(scope: "root" | "theme" = "root"): Promise<string | null> {
    try {
        const res = await fetch(`${BASE}/api/tokens.css?scope=${scope}`);
        return res.ok ? await res.text() : null;
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Speech-to-text — POST a recorded audio blob to the backend, which runs a
// local Whisper model (faster-whisper) and returns the transcript.
// ---------------------------------------------------------------------------

export interface TranscribeResult {
    ok: boolean;
    text?: string;
    error?: unknown;
}

// ---------------------------------------------------------------------------
// Page fetch — read a URL's content server-side (CORS-safe). Returns plain text.
// ---------------------------------------------------------------------------

export interface FetchPageResult {
    ok: boolean;
    url?: string;
    title?: string;
    text?: string;
    status?: number;
    error?: unknown;
}

export async function fetchPage(url: string, maxChars = 8000, signal?: AbortSignal): Promise<FetchPageResult> {
    try {
        const res = await fetch(`${BASE}/api/fetch`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ url, maxChars }),
            signal,
        });
        return (await res.json()) as FetchPageResult;
    } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return { ok: false, error: "Stopped." };
        return { ok: false, error: err instanceof Error ? err.message : `Backend unreachable at ${BASE}.` };
    }
}

export async function transcribe(blob: Blob): Promise<TranscribeResult> {
    try {
        const form = new FormData();
        form.append("file", blob, "audio.webm");
        const res = await fetch(`${BASE}/api/transcribe`, { method: "POST", body: form });
        return (await res.json()) as TranscribeResult;
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : `Backend unreachable at ${BASE}.` };
    }
}
