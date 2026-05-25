/**
 * Integration tools — the agent's connections to the outside world. These run
 * host-side (CORS-safe) and return data to the model:
 *   · fetch    — anonymous web page text
 *   · search   — web search via the connected Tavily app
 *   · callApi  — a SAVED connection's endpoint, using its baseUrl + auth
 * All are read-only (mutating: false).
 */

import type { Tool, ToolContext, AgentOp, OpResult } from "../types";

const fetchTool: Tool = {
    name: "fetch",
    doc: "fetch { url }                          — read a web page's readable text (returns {title, text})",
    surfaces: ["dashboard", "canvas"],
    mutating: false,
    validate: (op) => (typeof op.url === "string" && op.url.trim() ? null : "fetch needs a `url`."),
    run: async (op: AgentOp, ctx: ToolContext): Promise<OpResult> => {
        const r = await ctx.fetchPage(String(op.url ?? ""));
        return { kind: "fetch", url: op.url, ok: r.ok, title: r.title, text: (r.text ?? "").slice(0, 4000), ...(r.error ? { error: String(r.error) } : {}) };
    },
};

const searchTool: Tool = {
    name: "search",
    doc: "search { query }                       — web search via the connected Tavily app (returns results: title/url/content)",
    surfaces: ["dashboard", "canvas"],
    mutating: false,
    validate: (op) => (typeof op.query === "string" && op.query.trim() ? null : "search needs a `query`."),
    run: async (op: AgentOp, ctx: ToolContext): Promise<OpResult> => {
        const tavily = ctx.tavily;
        if (!tavily?.auth?.token) return { kind: "search", ok: false, error: "No Tavily connection — add one in Settings → Apps." };
        const r = await ctx.testEndpoint({
            method: "POST",
            url: `${(tavily.baseUrl ?? "https://api.tavily.com").replace(/\/$/, "")}/search`,
            headers: { Authorization: `Bearer ${tavily.auth.token}` },
            body: { query: op.query, max_results: 5, search_depth: "basic" },
        });
        const body = r.body as { results?: Array<{ title?: string; url?: string; content?: string }> } | undefined;
        return {
            kind: "search",
            ok: r.ok,
            ...(r.ok && body?.results ? { results: body.results.map((x) => ({ title: x.title, url: x.url, content: (x.content ?? "").slice(0, 400) })) } : {}),
            ...(r.ok ? {} : { error: typeof r.error === "string" ? r.error : `status ${r.status ?? "?"}` }),
        };
    },
};

const callApiTool: Tool = {
    name: "callApi",
    doc: "callApi { sourceId, path?, method?, params?, body? } — call a SAVED connection's endpoint with its baseUrl + auth (returns {status, data}); use for named/authed APIs instead of guessing a URL with fetch",
    surfaces: ["dashboard", "canvas"],
    mutating: false,
    validate: (op) => (op.sourceId != null && String(op.sourceId).trim() ? null : "callApi needs a `sourceId` — call listConnections first to get one."),
    run: async (op: AgentOp, ctx: ToolContext): Promise<OpResult> => {
        const src = ctx.resolveConnection(op.sourceId);
        if (!src) return { kind: "callApi", ok: false, error: `No connection matching "${String(op.sourceId)}". Call listConnections and use one of the returned ids.` };
        const path = typeof op.path === "string" ? op.path : (src.endpoints?.[0]?.path ?? "/");
        const base = (src.baseUrl ?? "").replace(/\/$/, "");
        let url = /^https?:\/\//.test(path) ? path : base + (path.startsWith("/") ? path : `/${path}`);
        const params = op.params as Record<string, unknown> | undefined;
        if (params && Object.keys(params).length) {
            const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
            url += (url.includes("?") ? "&" : "?") + qs.toString();
        }
        const headers: Record<string, string> = {};
        for (const h of src.headers ?? []) if (h.key) headers[h.key] = h.value;
        if (src.auth?.type === "bearer" && src.auth.token) headers["Authorization"] = `Bearer ${src.auth.token}`;
        else if (src.auth?.type === "apiKeyHeader" && src.auth.keyName) headers[src.auth.keyName] = src.auth.keyValue ?? "";
        const r = await ctx.testEndpoint({ method: typeof op.method === "string" ? op.method : "GET", url, headers, body: op.body });
        if (r.ok) {
            ctx.apiCalls.push({ sourceId: src.id, path });
            return { kind: "callApi", ok: true, status: r.status, data: JSON.stringify(r.body).slice(0, 4000) };
        }
        // Guide the model back to REAL endpoints instead of guessing more paths.
        const eps = src.endpoints ?? [];
        const reqMethod = (typeof op.method === "string" ? op.method : "GET").toUpperCase();
        const known = eps.map((e) => `${e.method.toUpperCase()} ${e.path}`);
        const isKnown = known.includes(`${reqMethod} ${path}`);
        // Endpoints sharing a word with the attempted path, then the GET resource map.
        const tokens = path.split(/[/\-_]/).filter((t) => t.length >= 4).map((t) => t.toLowerCase());
        const matched = [...new Set(eps.filter((e) => tokens.some((t) => e.path.toLowerCase().includes(t))).map((e) => `${e.method} ${e.path}`))].slice(0, 15);
        const resourceAreas = [...new Set(eps.filter((e) => e.method.toUpperCase() === "GET").map((e) => e.path.split("/").slice(0, 4).join("/")))].slice(0, 30);
        return {
            kind: "callApi",
            ok: false,
            status: r.status,
            error: typeof r.error === "string" ? r.error : `status ${r.status ?? "?"}`,
            hint: isKnown
                ? "That endpoint exists but errored — check auth/params (replace :placeholders with real ids)."
                : "That path is NOT a real endpoint — do NOT keep guessing. Pick a path from this connection's listed endpoints (see listConnections) that matches the task, and replace :placeholders.",
            ...(matched.length ? { didYouMean: matched } : { resourceAreas }),
        };
    },
};

export const integrationTools: Tool[] = [fetchTool, searchTool, callApiTool];
