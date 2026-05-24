/**
 * Connection editor — full data-source editor mirroring the original mip app.
 * Rendered by the Connections tab when a connection is selected. Edits a local
 * draft of the connection and persists via updateConnection on save.
 */

import { useMemo, useState } from "react";
import { Plus, Trash01, X } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { CloseButton } from "@/components/base/buttons/close-button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { TextArea } from "@/components/base/textarea/textarea";
import { cx } from "@/utils/cx";
import { testEndpoint } from "@/mip/api";
import {
    useSettings,
    type AuthType,
    type Connection,
    type ConnectionEndpoint,
    type ConnectionHeader,
    type DataSourceType,
} from "./settings-store";

const SOURCE_TYPES: { id: DataSourceType; label: string }[] = [
    { id: "rest", label: "REST API" },
    { id: "json", label: "JSON" },
    { id: "csv", label: "CSV" },
];

const AUTH_TYPES: { id: AuthType; label: string }[] = [
    { id: "none", label: "No auth" },
    { id: "bearer", label: "Bearer token" },
    { id: "basic", label: "Basic auth" },
    { id: "apiKeyHeader", label: "API key (header)" },
    { id: "apiKeyQuery", label: "API key (query param)" },
    { id: "digest", label: "Digest auth" },
    { id: "custom", label: "Custom header" },
];

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => ({ id: m, label: m }));

const AI_PROVIDERS = [
    { id: "openai", label: "OpenAI" },
    { id: "anthropic", label: "Anthropic" },
    { id: "custom", label: "Custom" },
];

function uid(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Build the request headers for a test from auth + custom headers. */
function buildHeaders(conn: Connection): Record<string, string> {
    const headers: Record<string, string> = {};
    for (const h of conn.headers ?? []) {
        if (h.key.trim()) headers[h.key.trim()] = h.value;
    }
    const auth = conn.auth;
    if (auth) {
        switch (auth.type) {
            case "bearer":
                if (auth.token) headers["Authorization"] = `Bearer ${auth.token}`;
                break;
            case "basic":
            case "digest":
                if (auth.username != null) {
                    const encoded = typeof btoa === "function" ? btoa(`${auth.username}:${auth.password ?? ""}`) : "";
                    headers["Authorization"] = `${auth.type === "digest" ? "Digest" : "Basic"} ${encoded}`;
                }
                break;
            case "apiKeyHeader":
            case "custom":
                if (auth.keyName) headers[auth.keyName] = auth.keyValue ?? "";
                break;
            default:
                break;
        }
    }
    return headers;
}

function joinUrl(base: string | undefined, path: string): string {
    const b = (base ?? "").replace(/\/$/, "");
    const p = path.startsWith("/") || path === "" ? path : `/${path}`;
    return `${b}${p}`;
}

interface TestState {
    ok: boolean;
    message: string;
    body?: unknown;
}

export function ConnectionEditor({ id, onClose }: { id: string; onClose: () => void }) {
    const { connections, getConnection, updateConnection, removeConnection } = useSettings();
    const stored = getConnection(id);

    // Local draft seeded from the stored connection.
    const [draft, setDraft] = useState<Connection>(() => ({
        ...(stored ?? { id, name: "Connection", type: "rest" }),
        auth: stored?.auth ?? { type: "none" },
        headers: stored?.headers ?? [],
        endpoints: stored?.endpoints ?? [],
    }));
    const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);
    const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(stored?.endpoints?.[0]?.id ?? null);
    const [collectionJson, setCollectionJson] = useState("");
    const [test, setTest] = useState<TestState | null>(null);
    const [showPreview, setShowPreview] = useState(false);

    const patch = (p: Partial<Connection>) => setDraft((d) => ({ ...d, ...p }));
    const patchAuth = (p: Partial<NonNullable<Connection["auth"]>>) =>
        setDraft((d) => ({ ...d, auth: { type: d.auth?.type ?? "none", ...d.auth, ...p } }));

    const auth = draft.auth ?? { type: "none" };
    const headers = draft.headers ?? [];
    const endpoints = draft.endpoints ?? [];

    const connectionItems = useMemo(
        () => connections.map((c) => ({ id: c.id, label: c.name, supportingText: c.type.toUpperCase() })),
        [connections],
    );

    // --- Headers ---
    const setHeader = (index: number, p: Partial<ConnectionHeader>) =>
        patch({ headers: headers.map((h, i) => (i === index ? { ...h, ...p } : h)) });
    const addHeader = () => patch({ headers: [...headers, { key: "", value: "" }] });
    const removeHeader = (index: number) => patch({ headers: headers.filter((_, i) => i !== index) });

    // --- Endpoints ---
    const setEndpoint = (epId: string, p: Partial<ConnectionEndpoint>) =>
        patch({ endpoints: endpoints.map((e) => (e.id === epId ? { ...e, ...p } : e)) });
    const addEndpoint = () => {
        const ep: ConnectionEndpoint = { id: uid("ep"), label: "New endpoint", method: "GET", path: "/" };
        patch({ endpoints: [...endpoints, ep] });
        setExpandedEndpoint(ep.id);
        setSelectedEndpointId(ep.id);
    };
    const discoverEndpoints = () => {
        const ep: ConnectionEndpoint = { id: uid("ep"), label: "Health", method: "GET", path: "/health", mapPath: "$" };
        patch({ endpoints: [...endpoints, ep] });
        setSelectedEndpointId(ep.id);
    };
    const removeEndpoint = (epId: string) => {
        patch({ endpoints: endpoints.filter((e) => e.id !== epId) });
        if (expandedEndpoint === epId) setExpandedEndpoint(null);
        if (selectedEndpointId === epId) setSelectedEndpointId(null);
    };

    // --- Postman import ---
    const importCollection = () => {
        try {
            const parsed = JSON.parse(collectionJson) as { item?: unknown[] };
            const items = Array.isArray(parsed.item) ? parsed.item : [];
            const imported: ConnectionEndpoint[] = [];
            for (const raw of items) {
                const it = raw as {
                    name?: string;
                    request?: { method?: string; url?: { raw?: string; path?: string[] } | string; body?: { raw?: string } };
                };
                const req = it.request;
                if (!req) continue;
                let path = "/";
                if (typeof req.url === "string") path = req.url;
                else if (req.url?.path) path = `/${req.url.path.join("/")}`;
                else if (req.url?.raw) path = req.url.raw;
                imported.push({
                    id: uid("ep"),
                    label: it.name ?? "Imported",
                    method: (req.method ?? "GET").toUpperCase(),
                    path,
                    body: req.body?.raw,
                });
            }
            if (imported.length) {
                patch({ endpoints: [...endpoints, ...imported] });
                setCollectionJson("");
            }
        } catch {
            /* ignore parse errors (best-effort) */
        }
    };

    // --- Actions ---
    const save = () => {
        const { id: _id, ...rest } = draft;
        updateConnection(id, rest);
    };

    const handleTest = async () => {
        const ep = endpoints.find((e) => e.id === selectedEndpointId) ?? endpoints[0];
        if (!ep) {
            setTest({ ok: false, message: "Select an endpoint to test." });
            return;
        }
        const result = await testEndpoint({
            method: ep.method,
            url: joinUrl(draft.baseUrl, ep.path),
            headers: buildHeaders(draft),
            body: ep.body,
        });
        if (result.ok) {
            setTest({ ok: true, message: `✓ Endpoint test passed.${result.status ? ` (${result.status})` : ""}`, body: result.body });
            setShowPreview(true);
        } else {
            const errMsg = result.error instanceof Error ? result.error.message : String(result.error ?? "Request failed");
            setTest({ ok: false, message: `Test failed: ${errMsg}`, body: result.body });
            if (result.body !== undefined) setShowPreview(true);
        }
    };

    const handleDelete = () => {
        removeConnection(id);
        onClose();
    };

    const cardCls = "flex flex-col gap-4 rounded-xl bg-primary p-5 ring-1 ring-secondary";

    return (
        <div className="flex flex-col gap-6">
            <header className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold text-primary">{draft.name || "Connection"}</h1>
                    <p className="mt-1 text-sm text-tertiary">Edit this data source. Close returns to the connection list.</p>
                </div>
                <CloseButton size="sm" label="Close" onPress={onClose} />
            </header>

            {/* Row: data source switcher / source type / name */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Select
                    label="Data source"
                    selectedKey={id}
                    items={connectionItems}
                    onSelectionChange={() => {
                        /* switching handled by parent via row click; keep current */
                    }}
                    isDisabled
                >
                    {(item) => (
                        <Select.Item id={item.id} supportingText={item.supportingText}>
                            {item.label}
                        </Select.Item>
                    )}
                </Select>

                <Select
                    label="Source type"
                    selectedKey={draft.type}
                    items={SOURCE_TYPES}
                    onSelectionChange={(key) => patch({ type: key as DataSourceType })}
                >
                    {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                </Select>

                <Input label="Name" value={draft.name} onChange={(v) => patch({ name: v })} placeholder="My data source" />
            </div>

            {/* Row: base URL + auth */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                    label="Base URL"
                    value={draft.baseUrl ?? ""}
                    onChange={(v) => patch({ baseUrl: v })}
                    placeholder="https://api.example.com"
                />
                <Select
                    label="Authentication"
                    selectedKey={auth.type}
                    items={AUTH_TYPES}
                    onSelectionChange={(key) => patchAuth({ type: key as AuthType })}
                >
                    {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                </Select>
            </div>

            {/* Auth value fields */}
            {auth.type === "bearer" && (
                <Input
                    label="Token"
                    type="password"
                    value={auth.token ?? ""}
                    onChange={(v) => patchAuth({ token: v })}
                    placeholder="sk-..."
                />
            )}
            {(auth.type === "basic" || auth.type === "digest") && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input label="Username" value={auth.username ?? ""} onChange={(v) => patchAuth({ username: v })} />
                    <Input label="Password" type="password" value={auth.password ?? ""} onChange={(v) => patchAuth({ password: v })} />
                </div>
            )}
            {(auth.type === "apiKeyHeader" || auth.type === "apiKeyQuery" || auth.type === "custom") && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                        label={auth.type === "apiKeyQuery" ? "Query param name" : "Header name"}
                        value={auth.keyName ?? ""}
                        onChange={(v) => patchAuth({ keyName: v })}
                        placeholder={auth.type === "apiKeyQuery" ? "api_key" : "X-Api-Key"}
                    />
                    <Input label="Value" type="password" value={auth.keyValue ?? ""} onChange={(v) => patchAuth({ keyValue: v })} />
                </div>
            )}

            {/* AI model toggle */}
            <div className={cardCls}>
                <Checkbox
                    isSelected={!!draft.isAiModel}
                    onChange={(selected) => patch({ isAiModel: selected })}
                    label="This connection provides an AI model"
                    hint="Turn on to make this connection selectable as the sidebar assistant's model — e.g. a self-hosted or OpenAI-compatible LLM (Ollama, LM Studio, llama.cpp, vLLM)."
                />
                {draft.isAiModel && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Select
                            label="AI provider"
                            selectedKey={draft.aiProvider ?? "openai"}
                            items={AI_PROVIDERS}
                            onSelectionChange={(key) => patch({ aiProvider: String(key) })}
                        >
                            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                        </Select>
                        <Input
                            label="Model"
                            value={draft.aiModel ?? ""}
                            onChange={(v) => patch({ aiModel: v })}
                            placeholder="gpt-4o-mini / deepseek-chat"
                        />
                    </div>
                )}
            </div>

            {/* Connection headers */}
            <div className={cardCls}>
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-primary">Connection headers</h2>
                </div>
                {headers.length === 0 ? (
                    <p className="text-sm text-tertiary">No headers yet.</p>
                ) : (
                    <div className="flex flex-col gap-3">
                        {headers.map((h, i) => (
                            <div key={i} className="flex items-end gap-3">
                                <div className="flex-1">
                                    <Input label={i === 0 ? "Header" : undefined} value={h.key} onChange={(v) => setHeader(i, { key: v })} placeholder="X-Custom-Header" />
                                </div>
                                <div className="flex-1">
                                    <Input label={i === 0 ? "Value" : undefined} value={h.value} onChange={(v) => setHeader(i, { value: v })} placeholder="value" />
                                </div>
                                <ButtonUtility size="sm" color="tertiary" icon={Trash01} tooltip="Remove header" onClick={() => removeHeader(i)} />
                            </div>
                        ))}
                    </div>
                )}
                <div>
                    <Button color="secondary" size="sm" iconLeading={Plus} onClick={addHeader}>
                        Add header
                    </Button>
                </div>
            </div>

            {/* Endpoint index */}
            <div className={cardCls}>
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-primary">Endpoint index</h2>
                    <div className="flex gap-2">
                        <Button color="secondary" size="sm" onClick={discoverEndpoints}>
                            Discover endpoints
                        </Button>
                        <Button color="secondary" size="sm" iconLeading={Plus} onClick={addEndpoint}>
                            Add endpoint
                        </Button>
                    </div>
                </div>
                {endpoints.length === 0 ? (
                    <p className="text-sm text-tertiary">No endpoints yet.</p>
                ) : (
                    <div className="divide-y divide-secondary overflow-hidden rounded-lg ring-1 ring-secondary">
                        {endpoints.map((ep) => {
                            const isExpanded = expandedEndpoint === ep.id;
                            const isSelected = selectedEndpointId === ep.id;
                            return (
                                <div key={ep.id} className={cx("bg-primary", isSelected && "bg-secondary/40")}>
                                    <button
                                        type="button"
                                        className="flex w-full items-center gap-3 px-4 py-3 text-left"
                                        onClick={() => {
                                            setSelectedEndpointId(ep.id);
                                            setExpandedEndpoint(isExpanded ? null : ep.id);
                                        }}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-primary">{ep.label || "Untitled endpoint"}</p>
                                            <p className="truncate text-xs text-tertiary">
                                                {ep.method} {ep.path}
                                            </p>
                                        </div>
                                    </button>
                                    {isExpanded && (
                                        <div className="flex flex-col gap-4 border-t border-secondary px-4 py-4">
                                            <Input label="Endpoint label" value={ep.label} onChange={(v) => setEndpoint(ep.id, { label: v })} />
                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                <Select
                                                    label="Method"
                                                    selectedKey={ep.method}
                                                    items={METHODS}
                                                    onSelectionChange={(key) => setEndpoint(ep.id, { method: String(key) })}
                                                >
                                                    {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                                                </Select>
                                                <Input label="Path" value={ep.path} onChange={(v) => setEndpoint(ep.id, { path: v })} placeholder="/v1/items" />
                                            </div>
                                            <Input
                                                label="Default map path"
                                                value={ep.mapPath ?? ""}
                                                onChange={(v) => setEndpoint(ep.id, { mapPath: v })}
                                                placeholder="$.data"
                                            />
                                            <TextArea
                                                label="Description"
                                                value={ep.description ?? ""}
                                                onChange={(v) => setEndpoint(ep.id, { description: v })}
                                                rows={2}
                                            />
                                            <TextArea
                                                label="Body"
                                                value={ep.body ?? ""}
                                                onChange={(v) => setEndpoint(ep.id, { body: v })}
                                                rows={4}
                                                placeholder={'{\n  "key": "value"\n}'}
                                            />
                                            <div>
                                                <Button color="secondary-destructive" size="sm" iconLeading={Trash01} onClick={() => removeEndpoint(ep.id)}>
                                                    Delete endpoint
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Postman import */}
            <div className={cardCls}>
                <h2 className="text-sm font-semibold text-primary">Import Postman collection</h2>
                <TextArea
                    label="Collection JSON"
                    value={collectionJson}
                    onChange={setCollectionJson}
                    rows={5}
                    placeholder={'{ "item": [ { "name": "List", "request": { "method": "GET", "url": { "path": ["v1","items"] } } } ] }'}
                />
                <div>
                    <Button color="secondary" size="sm" isDisabled={!collectionJson.trim()} onClick={importCollection}>
                        Import collection
                    </Button>
                </div>
            </div>

            {/* Response preview */}
            {showPreview && test?.body !== undefined && (
                <div className={cardCls}>
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-primary">Response preview</h2>
                        <CloseButton size="sm" label="Close preview" onPress={() => setShowPreview(false)} />
                    </div>
                    <pre className="max-h-80 overflow-auto rounded-lg bg-secondary p-4 text-xs text-secondary">
                        {(() => {
                            try {
                                return JSON.stringify(test.body, null, 2);
                            } catch {
                                return String(test.body);
                            }
                        })()}
                    </pre>
                </div>
            )}

            {/* Footer actions */}
            <div className="flex flex-wrap items-center gap-3 border-t border-secondary pt-5">
                <Button color="primary" size="md" onClick={save}>
                    Save connection
                </Button>
                <Button color="secondary" size="md" onClick={handleTest}>
                    Test selected endpoint
                </Button>
                <Button color="secondary-destructive" size="md" iconLeading={Trash01} onClick={handleDelete}>
                    Delete
                </Button>
                <Button color="tertiary" size="md" onClick={onClose}>
                    Close
                </Button>
                {test && (
                    <span className={cx("flex items-center gap-1 text-sm", test.ok ? "text-success-primary" : "text-error-primary")}>
                        {!test.ok && <X className="size-4" />}
                        {test.message}
                    </span>
                )}
            </div>
        </div>
    );
}
