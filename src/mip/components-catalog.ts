/**
 * Design-system component catalog (directive #2/#3) — the reusable building
 * blocks (atoms/molecules/patterns) that widgets compose/reference by id, each
 * with its variants, sizes, and the design tokens it consumes.
 *
 * SINGLE SOURCE OF TRUTH: `./data/components.json` — a checked-in JSON catalog.
 * This module imports + types it (the offline/static catalog) and overlays DB
 * rows via `loadComponents()`. The SAME JSON seeds the `components` DB
 * collection (server seed_components), so the frontend, the DB seed, and any
 * other consumer share one definition — no hardcoded maps. Degrade-safe.
 *
 * NOTE: this is the catalog foundation. Wiring the adapter registry to RESOLVE
 * widgets from these component rows (so atoms become placeable, DB-driven
 * widgets with token-bound variants) is the next step.
 */

import { dbAvailable, dbList } from "./api";
import catalog from "./data/components.json";

export type ComponentKind = "atom" | "molecule" | "pattern";

export interface ComponentDef {
    id: string;
    kind: ComponentKind;
    label: string;
    group: string;
    description: string;
    /** Named visual variants (e.g. button colors, badge styles). */
    variants?: string[];
    /** Supported size keys. */
    sizes?: string[];
    /** CSS custom-property tokens this component reads (token refs). */
    tokenRefs?: string[];
    /** Display order within the catalog. */
    order: number;
}

const RAW = (catalog as { components: ComponentDef[] }).components;

/** The canonical catalog — one entry per component, keyed by id. */
export const COMPONENT_CATALOG: Record<string, ComponentDef> = Object.fromEntries(RAW.map((c) => [c.id, c]));

/** Catalog entries in display order. */
export const COMPONENT_LIST: ComponentDef[] = [...RAW].sort((a, b) => a.order - b.order);

/** Synchronous lookup against the static catalog. */
export const componentDef = (id: string): ComponentDef | undefined => COMPONENT_CATALOG[id];

/** Load the catalog, overlaying DB `components` rows when the backend is up.
 *  Degrade-safe: returns the static catalog on any failure / DB off / empty. */
export async function loadComponents(): Promise<ComponentDef[]> {
    try {
        if (!(await dbAvailable())) return COMPONENT_LIST;
        const rows = await dbList<ComponentDef>("components");
        if (!rows.length) return COMPONENT_LIST;
        const byId = new Map(COMPONENT_LIST.map((c) => [c.id, c]));
        for (const r of rows) byId.set(r.id, { ...byId.get(r.id), ...r.data, id: r.id } as ComponentDef);
        return [...byId.values()].sort((a, b) => a.order - b.order);
    } catch {
        return COMPONENT_LIST;
    }
}
