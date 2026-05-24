/**
 * useWidgetData — resolves a widget's bound data source into a live
 * `WidgetDataState`. When `widget.data.sourceId` points at a saved connection:
 *   · mock / json / csv  → parse the connection's inline payload locally;
 *   · rest               → build the URL (baseUrl + request.path + params) with
 *                          the connection's headers + auth and fetch it through
 *                          the backend proxy (`/api/test-endpoint`, CORS-safe).
 * Renderers then map the payload via `widget.data.map` (JSONPath). Widgets with
 * no binding stay idle and render their authored `settings`.
 */

import { useEffect, useState } from "react";
import { IDLE_DATA_STATE, type WidgetDataState } from "@/mip/adapter/types";
import { testEndpoint } from "@/mip/api";
import type { MipWidget } from "@/mip/schema";
import { useSettings, type Connection } from "@/mip/settings/settings-store";

function buildUrl(conn: Connection, path: string, params?: Record<string, unknown>): string {
    const base = (conn.baseUrl ?? "").replace(/\/$/, "");
    let url = /^https?:\/\//.test(path) ? path : base + (path.startsWith("/") ? path : `/${path}`);
    if (params && Object.keys(params).length) {
        const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
        url += (url.includes("?") ? "&" : "?") + qs.toString();
    }
    return url;
}

function buildHeaders(conn: Connection, extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = { ...extra };
    for (const h of conn.headers ?? []) if (h.key) headers[h.key] = h.value;
    const auth = conn.auth;
    if (auth?.type === "bearer" && auth.token) headers["Authorization"] = `Bearer ${auth.token}`;
    else if (auth?.type === "apiKeyHeader" && auth.keyName) headers[auth.keyName] = auth.keyValue ?? "";
    return headers;
}

export function useWidgetData(widget: MipWidget): WidgetDataState {
    const { getConnection } = useSettings();
    const binding = widget.data;
    const conn = binding?.sourceId ? getConnection(binding.sourceId) : undefined;

    const [state, setState] = useState<WidgetDataState>(IDLE_DATA_STATE);

    // Re-fetch when the binding or the resolved connection's request-affecting fields change.
    const depKey = JSON.stringify({
        b: binding,
        c: conn && { t: conn.type, u: conn.baseUrl, h: conn.headers, a: conn.auth, d: conn.detail },
    });

    useEffect(() => {
        if (!binding?.sourceId) {
            setState(IDLE_DATA_STATE);
            return;
        }
        if (!conn) {
            setState({ status: "error", error: `Connection “${binding.sourceId}” not found.` });
            return;
        }

        let cancelled = false;
        setState({ status: "loading" });

        (async () => {
            // Inline payloads (mock/json/csv) — parse locally, no network.
            if (conn.type !== "rest") {
                try {
                    const data = conn.detail ? JSON.parse(conn.detail) : {};
                    if (!cancelled) setState({ status: "success", data });
                } catch {
                    if (!cancelled) setState({ status: "error", error: "Invalid inline payload (expected JSON)." });
                }
                return;
            }

            const req = binding.request;
            const url = buildUrl(conn, req?.path ?? "", req?.params as Record<string, unknown> | undefined);
            const headers = buildHeaders(conn, req?.headers);
            const res = await testEndpoint({ method: req?.method ?? "GET", url, headers, body: req?.body });
            if (cancelled) return;
            if (res.ok) setState({ status: "success", data: res.body });
            else setState({ status: "error", error: typeof res.error === "string" ? res.error : `Request failed (${res.status ?? "?"}).` });
        })();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [depKey]);

    return binding?.sourceId ? state : IDLE_DATA_STATE;
}
