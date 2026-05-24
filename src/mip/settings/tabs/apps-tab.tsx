/**
 * Apps settings tab — connector gallery + connect flow.
 *
 * Renders the AI-app catalog grouped by category, with search, per-app connect
 * state (Connected badge + Disconnect), and a modal connect flow that supports
 * API-key and/or OAuth credentials depending on the connector. Credentials are
 * not persisted — connecting only records which apps are linked (client demo).
 */

import { useMemo, useState } from "react";
import { CheckCircle, SearchMd } from "@untitledui/icons";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Avatar } from "@/components/base/avatar/avatar";
import { BadgeWithDot } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { CloseButton } from "@/components/base/buttons/close-button";
import { Input } from "@/components/base/input/input";
import { cx } from "@/utils/cx";
import { APP_CATALOG, APP_CATEGORIES, appInitials, type AppConnector, type AuthMethod } from "../apps-catalog";
import { useSettings } from "../settings-store";

const METHOD_LABEL: Record<AuthMethod, string> = {
    apiKey: "API key",
    oauth: "OAuth",
};

export function AppsTab() {
    const { isAppConnected, connectApp, disconnectApp } = useSettings();
    const [query, setQuery] = useState("");
    const [active, setActive] = useState<AppConnector | null>(null);

    const groups = useMemo(() => {
        const q = query.trim().toLowerCase();
        const filtered = q
            ? APP_CATALOG.filter((app) => app.name.toLowerCase().includes(q) || app.category.toLowerCase().includes(q))
            : APP_CATALOG;
        return APP_CATEGORIES.map((category) => ({
            category,
            apps: filtered.filter((app) => app.category === category),
        })).filter((group) => group.apps.length > 0);
    }, [query]);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                    <h2 className="text-lg font-semibold text-primary">Apps</h2>
                    <p className="text-sm text-tertiary">Connect AI providers and tools.</p>
                </div>
                <Input
                    size="sm"
                    icon={SearchMd}
                    aria-label="Search apps"
                    placeholder="Search apps…"
                    value={query}
                    onChange={setQuery}
                    wrapperClassName="max-w-sm"
                />
            </div>

            {groups.length === 0 ? (
                <p className="text-sm text-tertiary">No apps match “{query}”.</p>
            ) : (
                groups.map((group) => (
                    <section key={group.category} className="flex flex-col gap-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-quaternary">{group.category}</h3>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {group.apps.map((app) => {
                                const connected = isAppConnected(app.id);
                                return (
                                    <div key={app.id} className="flex items-start gap-3 rounded-xl p-4 ring-1 ring-secondary">
                                        <Avatar size="md" rounded={false} initials={appInitials(app.name)} />
                                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                                            <div className="flex min-w-0 flex-col">
                                                <span className="truncate text-sm font-semibold text-primary">{app.name}</span>
                                                <span className="truncate text-xs text-tertiary">{app.category}</span>
                                            </div>
                                            {connected ? (
                                                <div className="flex items-center gap-2">
                                                    <BadgeWithDot type="pill-color" color="success" size="sm">
                                                        Connected
                                                    </BadgeWithDot>
                                                    <Button size="sm" color="link-gray" onClick={() => disconnectApp(app.id)}>
                                                        Disconnect
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div>
                                                    <Button size="sm" color="secondary" onClick={() => setActive(app)}>
                                                        Connect
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                ))
            )}

            <ConnectModal
                app={active}
                onClose={() => setActive(null)}
                onConnect={(method) => {
                    if (active) connectApp(active.id, method);
                    setActive(null);
                }}
            />
        </div>
    );
}

function ConnectModal({
    app,
    onClose,
    onConnect,
}: {
    app: AppConnector | null;
    onClose: () => void;
    onConnect: (method: AuthMethod) => void;
}) {
    return (
        <ModalOverlay isOpen={!!app} onOpenChange={(isOpen) => !isOpen && onClose()} isDismissable>
            <Modal className="max-w-md">
                <Dialog>{app ? <ConnectForm app={app} onClose={onClose} onConnect={onConnect} /> : <span />}</Dialog>
            </Modal>
        </ModalOverlay>
    );
}

function ConnectForm({
    app,
    onClose,
    onConnect,
}: {
    app: AppConnector;
    onClose: () => void;
    onConnect: (method: AuthMethod) => void;
}) {
    const [method, setMethod] = useState<AuthMethod>(app.auth[0]);
    const [apiKey, setApiKey] = useState("");
    const [clientId, setClientId] = useState("");
    const [clientSecret, setClientSecret] = useState("");

    const canConnect = method === "apiKey" ? apiKey.trim().length > 0 : clientId.trim().length > 0 && clientSecret.trim().length > 0;

    return (
        <div className="flex w-full flex-col overflow-hidden rounded-xl bg-primary shadow-xl ring-1 ring-secondary">
            <div className="flex items-start justify-between gap-4 border-b border-secondary px-5 py-4">
                <div className="flex items-center gap-3">
                    <Avatar size="sm" rounded={false} initials={appInitials(app.name)} />
                    <div className="flex flex-col">
                        <h2 className="text-lg font-semibold text-primary">Connect {app.name}</h2>
                        <span className="text-xs text-tertiary">{app.category}</span>
                    </div>
                </div>
                <CloseButton onPress={onClose} label="Close" />
            </div>

            <div className="flex flex-col gap-4 px-5 py-5">
                {app.auth.length > 1 && (
                    <div className="flex flex-col gap-1.5">
                        <span className="text-sm font-medium text-secondary">Authentication method</span>
                        <div className="flex gap-2">
                            {app.auth.map((m) => (
                                <Button
                                    key={m}
                                    size="sm"
                                    color={m === method ? "primary" : "secondary"}
                                    iconLeading={m === method ? CheckCircle : undefined}
                                    onClick={() => setMethod(m)}
                                >
                                    {METHOD_LABEL[m]}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}

                {method === "apiKey" ? (
                    <Input
                        type="password"
                        label="API key"
                        placeholder="Paste your API key"
                        value={apiKey}
                        onChange={setApiKey}
                        autoFocus
                    />
                ) : (
                    <>
                        <Input label="Client ID" placeholder="Client ID" value={clientId} onChange={setClientId} autoFocus />
                        <Input
                            type="password"
                            label="Client secret"
                            placeholder="Client secret"
                            value={clientSecret}
                            onChange={setClientSecret}
                        />
                    </>
                )}

                <p className={cx("text-xs text-tertiary")}>Credentials are used only for this demo session and are not stored.</p>
            </div>

            <div className="flex justify-end gap-3 border-t border-secondary px-5 py-4">
                <Button size="sm" color="secondary" onClick={onClose}>
                    Cancel
                </Button>
                <Button size="sm" color="primary" isDisabled={!canConnect} onClick={() => onConnect(method)}>
                    Connect
                </Button>
            </div>
        </div>
    );
}
