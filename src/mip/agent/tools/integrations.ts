/**
 * Integration tools — the agent's connections to the outside world. These run
 * host-side (CORS-safe) and return data to the model:
 *   · fetch    — anonymous web page text
 *   · search   — web search via the connected Tavily app
 *   · callApi  — a SAVED connection's endpoint, using its baseUrl + auth
 * All are read-only (mutating: false).
 */

import type { Tool, ToolContext, AgentOp, OpResult } from "../types";

type Endpoint = { method: string; path: string };

/** Does `actual` match an endpoint `template`? Template segments that start with
 *  ":" or are pure example ids (digits) act as wildcards, so /x/123 matches both
 *  /x/:id and /x/1. Query strings are ignored. */
function pathMatchesTemplate(template: string, actual: string): boolean {
    const t = template.split("?")[0].split("/").filter(Boolean);
    const a = actual.split("?")[0].split("/").filter(Boolean);
    if (t.length !== a.length) return false;
    return t.every((seg, i) => seg.startsWith(":") || /^\d+$/.test(seg) || seg === a[i]);
}

/** Suggestions for a missed path: keyword-matched endpoints, else the GET resource map. */
function endpointSuggestions(eps: Endpoint[], path: string): { didYouMean: string[] } | { resourceAreas: string[] } {
    const tokens = path.split(/[/\-_]/).filter((t) => t.length >= 4).map((t) => t.toLowerCase());
    const matched = [...new Set(eps.filter((e) => tokens.some((t) => e.path.toLowerCase().includes(t))).map((e) => `${e.method} ${e.path}`))].slice(0, 15);
    if (matched.length) return { didYouMean: matched };
    return { resourceAreas: [...new Set(eps.filter((e) => e.method.toUpperCase() === "GET").map((e) => e.path.split("/").slice(0, 4).join("/")))].slice(0, 30) };
}

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
        const method = (typeof op.method === "string" ? op.method : "GET").toUpperCase();
        const eps = src.endpoints ?? [];
        const cleanPath = path.split("?")[0];

        // STRUCTURAL GUARD: when the connection enumerates endpoints, reject any
        // path that isn't one of them (placeholder/numeric-aware) BEFORE hitting
        // the network — guessing is impossible, not just discouraged.
        if (eps.length && !/^https?:\/\//.test(path) && !eps.some((e) => e.method.toUpperCase() === method && pathMatchesTemplate(e.path, cleanPath))) {
            return {
                kind: "callApi",
                ok: false,
                error: `"${method} ${cleanPath}" is not an endpoint of "${src.name}". Do NOT guess paths.`,
                hint: "Use findEndpoints { sourceId, query } to get a real path, then call exactly that (replace :placeholders).",
                ...endpointSuggestions(eps, cleanPath),
            };
        }

        const base = (src.baseUrl ?? "").replace(/\/$/, "");
        let url = /^https?:\/\//.test(path) ? path : base + (path.startsWith("/") ? path : `/${path}`);
        const params = op.params as Record<string, unknown> | undefined;
        if (params && Object.keys(params).length) {
            const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
            url += (url.includes("?") ? "&" : "?") + qs.toString();
        }
        const headers: Record<string, string> = {};
        for (const h of src.headers ?? []) if (h.key) headers[h.key] = h.value;
        // Apply the connection's configured auth (all types; tolerate token OR keyValue).
        const a = src.auth;
        const token = a?.token || a?.keyValue;
        if (a?.type === "bearer" && token) headers["Authorization"] = `Bearer ${token}`;
        else if ((a?.type === "apiKeyHeader" || a?.type === "custom") && a?.keyName) headers[a.keyName] = a.keyValue ?? "";
        else if (a?.type === "basic" && a?.username) headers["Authorization"] = `Basic ${btoa(`${a.username}:${a.password ?? ""}`)}`;
        else if (a?.type === "apiKeyQuery" && a?.keyName) url += (url.includes("?") ? "&" : "?") + `${encodeURIComponent(a.keyName)}=${encodeURIComponent(a.keyValue ?? "")}`;
        const r = await ctx.testEndpoint({ method, url, headers, body: op.body });
        if (r.ok) {
            ctx.apiCalls.push({ sourceId: src.id, path });
            return { kind: "callApi", ok: true, status: r.status, data: JSON.stringify(r.body).slice(0, 4000) };
        }
        // The path is real (passed the guard) but the call errored — almost always
        // auth or an unfilled :placeholder.
        return {
            kind: "callApi",
            ok: false,
            status: r.status,
            error: typeof r.error === "string" ? r.error : `status ${r.status ?? "?"}`,
            hint: "This endpoint exists but errored — check the connection's API key/auth and replace any :placeholders with real ids.",
        };
    },
};

const findEndpointsTool: Tool = {
    name: "findEndpoints",
    doc: "findEndpoints { sourceId, query } — search a SAVED connection's own endpoints by keyword (e.g. 'analytics', 'links', 'blog'); returns matching {method, path}. Use this to pick a REAL path on a big API instead of guessing or scrolling listConnections.",
    surfaces: ["dashboard", "canvas"],
    mutating: false,
    validate: (op) => (op.sourceId != null && String(op.sourceId).trim() ? null : "findEndpoints needs a `sourceId` (from listConnections)."),
    run: async (op: AgentOp, ctx: ToolContext): Promise<OpResult> => {
        const src = ctx.resolveConnection(op.sourceId);
        if (!src) return { kind: "findEndpoints", ok: false, error: `No connection matching "${String(op.sourceId)}".` };
        const tokens = String(op.query ?? "")
            .toLowerCase()
            .split(/[\s/,_-]+/)
            .filter((t) => t.length >= 2);
        const eps = src.endpoints ?? [];
        const hit = (p: string, m: string) => tokens.length === 0 || tokens.some((t) => p.toLowerCase().includes(t) || m.toLowerCase() === t);
        const endpoints = [...new Set(eps.filter((e) => hit(e.path, e.method)).map((e) => `${e.method} ${e.path}`))].slice(0, 40);
        return { kind: "findEndpoints", ok: true, query: op.query, count: endpoints.length, endpoints };
    },
};

export const integrationTools: Tool[] = [fetchTool, searchTool, callApiTool, findEndpointsTool];
