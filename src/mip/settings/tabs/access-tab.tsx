/**
 * Access settings tab — proxy auth + API access tokens (mirrors mip's
 * Settings → Access). Two sections:
 *   · This device's token — the proxy bearer credential stored in this browser
 *     (localStorage `mip:proxy-token`), sent on every backend request.
 *   · Manage access tokens (admin) — mint scoped tokens (Data / Admin) with an
 *     expiry; the secret is shown once. Revoke (don't delete) marks them dead.
 *
 * NOTE: real token verification lives in the backend (not yet built). This tab
 * persists the device token locally and keeps a client-side token registry as
 * the UI surface for the future `access_tokens` table.
 */

import { useEffect, useState } from "react";
import { Copy01, Key01, Plus } from "@untitledui/icons";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";

const PROXY_TOKEN_KEY = "mip:proxy-token";
const TOKENS_KEY = "mip:access-tokens-v1";

type Scope = "data" | "admin";

interface AccessToken {
    id: string;
    name: string;
    scope: Scope;
    prefix: string; // shown in the list (secret itself is not retained)
    expiresInDays: number;
    createdAt: string;
    revoked?: boolean;
}

const SCOPES = [
    { id: "data", label: "Data" },
    { id: "admin", label: "Admin" },
];

const cardCls = "flex flex-col gap-4 rounded-xl bg-secondary p-5 ring-1 ring-secondary";

function randomToken(): string {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return `mip_${b64}`;
}

function loadTokens(): AccessToken[] {
    try {
        const raw = localStorage.getItem(TOKENS_KEY);
        if (raw) return JSON.parse(raw) as AccessToken[];
    } catch {
        /* ignore */
    }
    return [];
}

export function AccessTab() {
    // --- device proxy token ---
    const [token, setToken] = useState("");
    const [savedAt, setSavedAt] = useState<string | null>(null);

    useEffect(() => {
        try {
            setToken(localStorage.getItem(PROXY_TOKEN_KEY) ?? "");
        } catch {
            /* ignore */
        }
    }, []);

    const saveToken = () => {
        try {
            if (token.trim()) localStorage.setItem(PROXY_TOKEN_KEY, token.trim());
            else localStorage.removeItem(PROXY_TOKEN_KEY);
            setSavedAt(new Date().toLocaleTimeString());
        } catch {
            /* ignore */
        }
    };

    const clearToken = () => {
        setToken("");
        try {
            localStorage.removeItem(PROXY_TOKEN_KEY);
        } catch {
            /* ignore */
        }
        setSavedAt(null);
    };

    // --- admin access tokens ---
    const [tokens, setTokens] = useState<AccessToken[]>(loadTokens);
    const [name, setName] = useState("");
    const [scope, setScope] = useState<Scope>("data");
    const [expires, setExpires] = useState("30");
    const [freshSecret, setFreshSecret] = useState<string | null>(null);

    useEffect(() => {
        try {
            localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
        } catch {
            /* ignore */
        }
    }, [tokens]);

    const createToken = () => {
        const secret = randomToken();
        const entry: AccessToken = {
            id: `tok-${Date.now()}`,
            name: name.trim() || "Untitled token",
            scope,
            prefix: secret.slice(0, 12),
            expiresInDays: Number(expires) || 30,
            createdAt: new Date().toISOString(),
        };
        setTokens((t) => [entry, ...t]);
        setFreshSecret(secret);
        setName("");
    };

    const revoke = (id: string) => setTokens((t) => t.map((tok) => (tok.id === id ? { ...tok, revoked: true } : tok)));

    return (
        <div className="flex flex-col gap-8">
            <header>
                <h1 className="text-xl font-semibold text-primary">Access</h1>
                <p className="mt-1 text-sm text-tertiary">Proxy authentication for this device and API access tokens.</p>
            </header>

            {/* device proxy token */}
            <section className={cardCls}>
                <div>
                    <h2 className="text-sm font-semibold text-primary">This device's token</h2>
                    <p className="mt-1 text-sm text-tertiary">The proxy bearer credential stored in this browser. Sent as <code className="font-mono text-xs">Authorization: Bearer …</code> on every backend request.</p>
                </div>
                <Input aria-label="Proxy token" icon={Key01} type="password" value={token} onChange={setToken} placeholder="mip_…" />
                <div className="flex items-center gap-3">
                    <Button color="primary" size="md" onClick={saveToken}>
                        Save token
                    </Button>
                    <Button color="secondary" size="md" onClick={clearToken}>
                        Clear
                    </Button>
                    {savedAt ? <span className="text-sm text-utility-green-500">Saved ✓ {savedAt}</span> : null}
                </div>
            </section>

            {/* admin token management */}
            <section className={cardCls}>
                <div>
                    <h2 className="text-sm font-semibold text-primary">Manage access tokens</h2>
                    <p className="mt-1 text-sm text-tertiary">Mint scoped API tokens. The secret is shown once at creation — copy it now.</p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
                    <Input label="Name" value={name} onChange={setName} placeholder="CI pipeline" />
                    <div className="sm:w-36">
                        <Select label="Scope" selectedKey={scope} items={SCOPES} onSelectionChange={(key) => setScope(key as Scope)}>
                            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                        </Select>
                    </div>
                    <div className="sm:w-28">
                        <Input label="Expires (days)" type="number" value={expires} onChange={setExpires} />
                    </div>
                    <Button color="primary" size="md" iconLeading={Plus} onClick={createToken}>
                        Create token
                    </Button>
                </div>

                {freshSecret ? (
                    <div className="flex items-center justify-between gap-3 rounded-lg bg-utility-green-50 px-4 py-3 ring-1 ring-utility-green-200">
                        <div className="min-w-0">
                            <p className="text-xs font-medium text-utility-green-700">New token — copy it now, it won't be shown again:</p>
                            <code className="block truncate font-mono text-sm text-primary">{freshSecret}</code>
                        </div>
                        <ButtonUtility color="tertiary" size="sm" icon={Copy01} tooltip="Copy" onClick={() => navigator.clipboard?.writeText(freshSecret)} />
                    </div>
                ) : null}

                {tokens.length === 0 ? (
                    <p className="text-sm text-tertiary">No access tokens yet.</p>
                ) : (
                    <ul className="flex flex-col divide-y divide-secondary">
                        {tokens.map((tok) => (
                            <li key={tok.id} className="flex items-center justify-between gap-3 py-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="truncate text-sm font-medium text-primary">{tok.name}</span>
                                        <Badge size="sm" color={tok.scope === "admin" ? "warning" : "gray"}>{tok.scope}</Badge>
                                        {tok.revoked ? <Badge size="sm" color="error">revoked</Badge> : <Badge size="sm" color="success">active</Badge>}
                                    </div>
                                    <p className="mt-0.5 truncate font-mono text-xs text-tertiary">{tok.prefix}… · expires in {tok.expiresInDays}d</p>
                                </div>
                                {!tok.revoked ? (
                                    <Button color="secondary-destructive" size="sm" onClick={() => revoke(tok.id)}>
                                        Revoke
                                    </Button>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
