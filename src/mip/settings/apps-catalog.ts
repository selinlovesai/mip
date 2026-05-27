/**
 * App connector catalog: the AI-app ecosystem surfaced in Settings > Apps
 * (id, name, category, supported auth methods, description, install status, a
 * brand color, and AI/connection defaults).
 *
 * SOURCE OF TRUTH: `src/mip/data/apps.json` — the canonical catalog, imported
 * here as the static/offline list and seeded into the `apps` DB collection
 * (server seed_apps). `loadApps()` overlays DB rows on top, degrade-safe.
 */

import { dbAvailable, dbList } from "@/mip/api";
import catalog from "@/mip/data/apps.json";

export type AuthMethod = "apiKey" | "oauth";

/** Install/availability state for a connector, matching the original app. */
export type AppStatus = "active" | "coming_soon" | "scheduled";

/** Endpoint template (no id — ids are assigned when the connection is created).
 *  `body` may contain `{{model}}`, substituted with the connection's model. */
export interface AiEndpointTemplate {
    label: string;
    method: string;
    path: string;
    mapPath?: string;
    description?: string;
    body?: string;
}

export interface AiDefaults {
    baseUrl: string;
    provider: string;
    model: string;
    endpoints: AiEndpointTemplate[];
}

export interface AppConnector {
    id: string;
    name: string;
    category: string;
    auth: AuthMethod[];
    /** One-line summary shown on the connector card. */
    description: string;
    /** Whether the connector is installable now, soon, or scheduled. */
    status: AppStatus;
    /** Brand-ish hex used as the logo tile background. */
    color: string;
    /** For AI providers: defaults used to create a real AI-model Connection. */
    ai?: AiDefaults;
    /** For non-AI connectable tools (e.g. Tavily): REST connection defaults. */
    connection?: { baseUrl: string; endpoints: AiEndpointTemplate[] };
}

/** Static catalog from the canonical JSON (offline + fallback). */
export const APP_CATALOG: AppConnector[] = (catalog as { apps: AppConnector[] }).apps;

export const APP_CATEGORIES = [...new Set(APP_CATALOG.map((a) => a.category))];

/** Load the catalog, overlaying DB `apps` rows when the backend is up.
 *  Degrade-safe: returns the static catalog on any failure / DB off / empty. */
export async function loadApps(): Promise<AppConnector[]> {
    try {
        if (!(await dbAvailable())) return APP_CATALOG;
        const rows = await dbList<AppConnector>("apps");
        if (!rows.length) return APP_CATALOG;
        const byId = new Map(APP_CATALOG.map((a) => [a.id, a]));
        for (const r of rows) byId.set(r.id, { ...byId.get(r.id), ...r.data, id: r.id } as AppConnector);
        return [...byId.values()];
    } catch {
        return APP_CATALOG;
    }
}

/** Two-letter initials for a connector logo placeholder. */
export function appInitials(name: string): string {
    const words = name.split(" ").filter(Boolean);
    return words.slice(0, 2).map((w) => (w[0] ?? "").toUpperCase()).join("");
}
