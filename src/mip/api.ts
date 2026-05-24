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
}): Promise<ChatResult> {
    try {
        const res = await fetch(`${BASE}/api/chat`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(args),
        });
        return (await res.json()) as ChatResult;
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Backend unreachable. Is the server running on " + BASE + "?" };
    }
}

export interface TestResult {
    ok: boolean;
    status?: number;
    durationMs?: number;
    body?: unknown;
    error?: unknown;
}

export async function testEndpoint(args: { method: string; url: string; headers?: Record<string, string>; body?: unknown }): Promise<TestResult> {
    try {
        const res = await fetch(`${BASE}/api/test-endpoint`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(args),
        });
        return (await res.json()) as TestResult;
    } catch (err) {
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
// Speech-to-text — POST a recorded audio blob to the backend, which runs a
// local Whisper model (faster-whisper) and returns the transcript.
// ---------------------------------------------------------------------------

export interface TranscribeResult {
    ok: boolean;
    text?: string;
    error?: unknown;
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
