/**
 * Connections settings tab — data-source manager mirroring the original mip app.
 * List view: quick-connect cards for installed apps + saved connections list +
 * a custom-connection button. Selecting any of these opens the inline editor.
 */

import { useMemo, useState } from "react";
import { Plus } from "@untitledui/icons";
import { Avatar } from "@/components/base/avatar/avatar";
import { Badge, type BadgeColor } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { cx } from "@/utils/cx";
import { APP_CATALOG, appInitials } from "../apps-catalog";
import { useSettings, type DataSourceType } from "../settings-store";
import { ConnectionEditor } from "../connection-editor";

const TYPE_BADGE: Record<DataSourceType, { color: BadgeColor<"pill-color">; label: string }> = {
    mock: { color: "gray", label: "Mock" },
    rest: { color: "blue", label: "REST" },
    json: { color: "brand", label: "JSON" },
    csv: { color: "success", label: "CSV" },
};

export function ConnectionsTab() {
    const { connections, apps, addConnection } = useSettings();
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // Installed apps resolved through the catalog, EXCLUDING any that already
    // have a saved connection (quick-connect creates one named after the app, so
    // match by name) — no point offering to connect something already connected.
    const installedApps = useMemo(() => {
        const connectedNames = new Set(connections.map((c) => c.name.trim().toLowerCase()));
        return apps
            .map((a) => APP_CATALOG.find((c) => c.id === a.appId))
            .filter((c): c is (typeof APP_CATALOG)[number] => !!c && !connectedNames.has(c.name.trim().toLowerCase()));
    }, [apps, connections]);

    if (selectedId) {
        return <ConnectionEditor id={selectedId} onClose={() => setSelectedId(null)} />;
    }

    const quickConnect = (appName: string) => {
        const id = addConnection({ name: appName, type: "rest", auth: { type: "none" }, headers: [], endpoints: [] });
        setSelectedId(id);
    };

    const addCustom = () => {
        const id = addConnection({ name: "Custom connection", type: "rest", auth: { type: "none" }, headers: [], endpoints: [] });
        setSelectedId(id);
    };

    return (
        <div className="flex flex-col gap-8">
            <header>
                <h1 className="text-xl font-semibold text-primary">Connections</h1>
                <p className="mt-1 text-sm text-tertiary">
                    Configure reusable data sources once, then select them from any widget data mapping panel.
                </p>
            </header>

            {/* Quick connect from installed apps */}
            {installedApps.length > 0 && (
                <section className="flex flex-col gap-4">
                    <h2 className="text-xs font-semibold tracking-wide text-tertiary uppercase">Quick connect from installed apps</h2>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {installedApps.map((app) => (
                            <button
                                key={app.id}
                                type="button"
                                onClick={() => quickConnect(app.name)}
                                className="flex items-center gap-3 rounded-xl bg-primary p-4 text-left ring-1 ring-secondary transition hover:ring-brand"
                            >
                                <Avatar size="md" initials={appInitials(app.name)} alt={app.name} />
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-primary">{app.name}</p>
                                    <p className="truncate text-xs text-tertiary">{app.category}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </section>
            )}

            {/* Saved connections */}
            <section className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xs font-semibold tracking-wide text-tertiary uppercase">Saved connections</h2>
                    <Button color="secondary" size="sm" iconLeading={Plus} onClick={addCustom}>
                        Custom connection
                    </Button>
                </div>
                <div className="divide-y divide-secondary overflow-hidden rounded-xl ring-1 ring-secondary">
                    {connections.length === 0 ? (
                        <p className="px-4 py-6 text-center text-sm text-tertiary">No connections yet.</p>
                    ) : (
                        connections.map((conn) => {
                            const badge = TYPE_BADGE[conn.type];
                            const source = conn.baseUrl || (conn.type === "mock" ? "sample data" : "inline payload");
                            return (
                                <button
                                    key={conn.id}
                                    type="button"
                                    onClick={() => setSelectedId(conn.id)}
                                    className={cx("flex w-full items-center gap-3 bg-primary px-4 py-3 text-left transition hover:bg-secondary/40")}
                                >
                                    <Avatar size="sm" initials={appInitials(conn.name)} alt={conn.name} />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-primary">{conn.name}</p>
                                        <p className="truncate text-xs text-tertiary">{source}</p>
                                    </div>
                                    <Badge type="pill-color" color={badge.color} size="sm">
                                        {badge.label}
                                    </Badge>
                                </button>
                            );
                        })
                    )}
                </div>
            </section>
        </div>
    );
}
