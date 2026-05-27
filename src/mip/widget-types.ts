/**
 * Widget-type registry catalog (directive #2/#3) — the per-type metadata the
 * picker, the AI prompt/injection, and (later) the registry read from:
 * label · group · description · default layout · data-map key+shape · accent ·
 * refreshable · chart/diagram/design-block flags.
 *
 * SINGLE SOURCE OF TRUTH: `./data/widget-types.json` — a checked-in JSON catalog
 * edited by hand. This module just imports + types it (the offline/static
 * catalog) and overlays DB rows via `loadWidgetTypes()`. The SAME JSON file
 * seeds the `widget_types` DB collection (server/seed.py), so the frontend, the
 * DB seed, and any other consumer share one definition — no hardcoded maps.
 */

import type { WidgetType } from "./schema";
import { dbAvailable, dbList } from "./api";
import catalog from "./data/widget-types.json";

export interface WidgetTypeMeta {
    type: WidgetType;
    label: string;
    group: string;
    description: string;
    /** Where the widget's primary data lives in a bound response + its shape. */
    dataMap?: { key: string; shape: "array" | "object" | "scalar" };
    /** Badge tone used in the picker. */
    accent?: string;
    /** Whether a bound instance can poll (refreshMs). */
    refreshable: boolean;
    isChart: boolean;
    isDiagram: boolean;
    isDesignBlock: boolean;
    /** Default grid layout (12-col authored; the grid scales ×2 at construction). */
    layout: { w: number; h: number; minW?: number; minH?: number; maxW?: number; maxH?: number };
    /** Display order within the catalog. */
    order: number;
}

const RAW = (catalog as { types: WidgetTypeMeta[] }).types;

/** The canonical catalog — one entry per widget type, in catalog order. */
export const WIDGET_TYPE_CATALOG: Record<WidgetType, WidgetTypeMeta> = Object.fromEntries(RAW.map((m) => [m.type, m])) as Record<WidgetType, WidgetTypeMeta>;

/** Catalog entries in display order. */
export const WIDGET_TYPE_LIST: WidgetTypeMeta[] = [...RAW].sort((a, b) => a.order - b.order);

/** Synchronous lookup against the static catalog. */
export const widgetTypeMeta = (type: WidgetType): WidgetTypeMeta | undefined => WIDGET_TYPE_CATALOG[type];

/** Load the catalog, overlaying DB `widget_types` rows when the backend is up.
 *  Degrade-safe: returns the static catalog on any failure or when the DB is off
 *  or the collection is empty. DB rows are merged onto the static defaults so a
 *  partial row (e.g. just an edited label) still resolves every field. */
export async function loadWidgetTypes(): Promise<Record<WidgetType, WidgetTypeMeta>> {
    try {
        if (!(await dbAvailable())) return WIDGET_TYPE_CATALOG;
        const rows = await dbList<Partial<WidgetTypeMeta>>("widget_types");
        if (!rows.length) return WIDGET_TYPE_CATALOG;
        const merged: Record<WidgetType, WidgetTypeMeta> = { ...WIDGET_TYPE_CATALOG };
        for (const r of rows) {
            const t = r.id as WidgetType;
            if (t in merged) merged[t] = { ...merged[t], ...r.data, type: t };
        }
        return merged;
    } catch {
        return WIDGET_TYPE_CATALOG;
    }
}
