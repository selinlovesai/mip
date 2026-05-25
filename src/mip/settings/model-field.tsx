/**
 * ModelField — a model picker that lists the models actually available from the
 * selected connection's provider, fetched live (with a per-provider fallback so
 * the dropdown is never empty without an API key). Backed by a native
 * <datalist>, so it's a real dropdown that still accepts a custom/pinned id.
 */

import { useEffect, useId, useState } from "react";
import { Loading02 } from "@untitledui/icons";
import { HintText } from "@/components/base/input/hint-text";
import { Label } from "@/components/base/input/label";
import { testEndpoint } from "@/mip/api";
import type { Connection } from "./settings-store";

/** Known models per provider — shown when a live fetch isn't possible (no key). */
const FALLBACK_MODELS: Record<string, string[]> = {
    openai: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "o3-mini"],
    anthropic: ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest", "claude-3-opus-latest"],
    deepseek: ["deepseek-chat", "deepseek-reasoner"],
    mistral: ["mistral-large-latest", "mistral-small-latest", "open-mistral-nemo"],
    gemini: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
};

function fallbackFor(conn?: Connection): string[] {
    if (!conn) return [];
    const key = (conn.aiProvider ?? "openai").toLowerCase();
    const byName = /gemini|google/i.test(conn.name) ? "gemini" : /mistral/i.test(conn.name) ? "mistral" : undefined;
    return FALLBACK_MODELS[key] ?? (byName ? FALLBACK_MODELS[byName] : undefined) ?? [];
}

/** Fetch the provider's model list via the connection's own `/models` endpoint. */
async function fetchModels(conn: Connection): Promise<string[]> {
    if (!conn.baseUrl) return [];
    const ep = conn.endpoints?.find((e) => /models/i.test(e.path) && (e.method ?? "GET").toUpperCase() === "GET");
    const base = conn.baseUrl.replace(/\/$/, "");
    const path = ep?.path ?? "/v1/models";
    const url = /^https?:\/\//.test(path) ? path : base + (path.startsWith("/") ? path : `/${path}`);
    const key = conn.auth?.token ?? conn.auth?.keyValue;
    const headers: Record<string, string> = {};
    if ((conn.aiProvider ?? "").toLowerCase() === "anthropic") {
        if (key) headers["x-api-key"] = key;
        headers["anthropic-version"] = "2023-06-01";
    } else if (key) {
        headers["Authorization"] = `Bearer ${key}`;
    }
    const r = await testEndpoint({ method: "GET", url, headers });
    if (!r.ok) return [];
    const body = r.body as { data?: unknown[]; models?: unknown[] } | undefined;
    const data = body?.data ?? body?.models;
    if (!Array.isArray(data)) return [];
    return data
        .map((m) => (typeof m === "string" ? m : ((m as { id?: string; name?: string }).id ?? (m as { name?: string }).name?.replace(/^models\//, ""))))
        .filter((m): m is string => !!m);
}

/** Live model list for a connection, merged with the provider fallback. */
export function useModels(conn?: Connection): { models: string[]; loading: boolean } {
    const [models, setModels] = useState<string[]>(() => fallbackFor(conn));
    const [loading, setLoading] = useState(false);
    const depKey = conn ? `${conn.id}:${conn.baseUrl}:${conn.auth?.token ?? conn.auth?.keyValue ?? ""}` : "";

    useEffect(() => {
        if (!conn) {
            setModels([]);
            return;
        }
        let cancelled = false;
        setModels(fallbackFor(conn));
        setLoading(true);
        void fetchModels(conn).then((fetched) => {
            if (cancelled) return;
            setLoading(false);
            if (fetched.length) setModels([...new Set([...fetched])].sort());
        });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [depKey]);

    return { models, loading };
}

export function ModelField({ conn, value, onChange, label = "Model", hint, placeholder }: { conn?: Connection; value: string; onChange: (v: string) => void; label?: string; hint?: string; placeholder?: string }) {
    const { models, loading } = useModels(conn);
    const listId = useId();
    return (
        <div className="flex flex-col gap-1.5">
            <Label>{label}</Label>
            <div className="relative">
                <input
                    list={listId}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder ?? conn?.aiModel ?? "Select or type a model id"}
                    className="w-full rounded-lg bg-primary px-3 py-2 text-sm text-primary shadow-xs outline-none ring-1 ring-primary ring-inset placeholder:text-placeholder focus:ring-2 focus:ring-brand"
                />
                {loading ? <Loading02 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-quaternary" /> : null}
                <datalist id={listId}>
                    {models.map((m) => (
                        <option key={m} value={m} />
                    ))}
                </datalist>
            </div>
            {hint ? <HintText>{hint}</HintText> : null}
        </div>
    );
}
