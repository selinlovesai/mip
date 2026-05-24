/**
 * Client for the FastAPI backend (server/). Base URL from VITE_MIP_API or
 * http://localhost:8787. Used by the assistant (chat) and the Connections
 * editor (endpoint test).
 */

const BASE = (import.meta.env.VITE_MIP_API as string | undefined)?.replace(/\/$/, "") ?? "http://localhost:8787";

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
