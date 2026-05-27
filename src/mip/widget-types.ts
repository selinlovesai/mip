/**
 * Widget-type registry catalog (directive #2/#3) — the per-type metadata the
 * picker, the AI prompt/injection, and (later) the registry read from:
 * label · group · description · default layout · data-map key+shape · accent ·
 * refreshable · chart/diagram/design-block flags.
 *
 * This TS map is the canonical, always-available source (and the offline
 * fallback). When the backend DB is up, the same catalog is seeded into the
 * `widget_types` collection (`server/seed/widget_types.json`, generated from the
 * same data) and `loadWidgetTypes()` overlays any DB rows on top — so the
 * catalog becomes editable/syncable without a rebuild, degrade-safe when the DB
 * is off.
 */

import { WIDGET_TYPES, DEFAULT_WIDGET_SIZES, type WidgetType } from "./schema";
import { WIDGET_CATALOG } from "./shell/widget-catalog";
import { dbAvailable, dbList } from "./api";

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

const DESCRIPTIONS: Partial<Record<WidgetType, string>> = {
    kpi: "Single metric summary",
    progress: "Goal and progress bar",
    lineChart: "Trend over time",
    barChart: "Category bars",
    areaChart: "Filled trend chart",
    pieChart: "Share breakdown",
    donutChart: "Share breakdown ring",
    table: "Structured rows",
    list: "Bordered item list",
    detail: "Record fields",
    markdown: "Formatted text",
    image: "Image from a URL",
    flowchart: "Boxes-and-arrows process diagram",
    sequenceDiagram: "Actor interactions over time",
    mindmap: "Branching idea map",
    timeline: "Chronological events",
    ganttChart: "Project schedule bars",
    form: "Data collection",
    button: "Action trigger",
    pageHeader: "Section header",
    card: "Content container",
    tabs: "Tabbed surface",
    modal: "Overlay placeholder",
    drawer: "Side panel placeholder",
    googleMap: "Interactive map with markers and layers",
    contentSection: "Rich content block with heading and body",
    cta: "Conversion call-to-action banner",
    faq: "Expandable Q&A accordion",
    featureGrid: "Icon + text feature showcase",
    hero: "Large hero banner with heading and CTA",
    pricing: "Multi-tier pricing comparison",
    statsGrid: "KPI metrics in a card grid",
    testimonial: "Customer quote with attribution",
};

const ACCENT: Partial<Record<WidgetType, string>> = {
    progress: "success",
    form: "success",
    barChart: "info",
    list: "info",
    detail: "info",
    pieChart: "warning",
    donutChart: "warning",
};

const CHART = new Set<WidgetType>(["lineChart", "barChart", "areaChart", "pieChart", "donutChart"]);
const DIAGRAM = new Set<WidgetType>(["flowchart", "sequenceDiagram", "mindmap", "timeline", "ganttChart"]);
const DESIGN = new Set<WidgetType>(["hero", "cta", "pricing", "contentSection", "testimonial", "featureGrid", "statsGrid", "faq"]);
const REFRESH = new Set<WidgetType>(["kpi", "progress", "lineChart", "barChart", "areaChart", "pieChart", "donutChart", "table", "list", "detail"]);

/** Where each data widget's primary payload lives + its shape — aligned to the
 *  actual mip-tailwind renderers (charts read `series`, not legacy `slices`). */
const DATA_MAP: Partial<Record<WidgetType, WidgetTypeMeta["dataMap"]>> = {
    kpi: { key: "value", shape: "scalar" },
    progress: { key: "value", shape: "scalar" },
    lineChart: { key: "series", shape: "array" },
    barChart: { key: "series", shape: "array" },
    areaChart: { key: "series", shape: "array" },
    pieChart: { key: "series", shape: "array" },
    donutChart: { key: "series", shape: "array" },
    table: { key: "rows", shape: "array" },
    list: { key: "items", shape: "array" },
    detail: { key: "record", shape: "object" },
};

/** Group + label fallbacks for types the picker catalog doesn't list. */
const GROUP_FALLBACK: Partial<Record<WidgetType, string>> = {
    mindmap: "Diagrams",
    timeline: "Diagrams",
    pageHeader: "Content",
    modal: "Content",
    drawer: "Content",
    contentSection: "Marketing",
};
const titleCase = (t: string) => t.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

const catalogByType = new Map(WIDGET_CATALOG.map((e) => [e.type, e] as const));

/** The canonical catalog — one entry per widget type, in catalog order. */
export const WIDGET_TYPE_CATALOG: Record<WidgetType, WidgetTypeMeta> = Object.fromEntries(
    WIDGET_TYPES.map((type, order) => {
        const cat = catalogByType.get(type);
        const size = DEFAULT_WIDGET_SIZES[type];
        const meta: WidgetTypeMeta = {
            type,
            label: cat?.label ?? titleCase(type),
            group: cat?.group ?? GROUP_FALLBACK[type] ?? "Content",
            description: DESCRIPTIONS[type] ?? "",
            ...(DATA_MAP[type] ? { dataMap: DATA_MAP[type] } : {}),
            ...(ACCENT[type] ? { accent: ACCENT[type] } : {}),
            refreshable: REFRESH.has(type),
            isChart: CHART.has(type),
            isDiagram: DIAGRAM.has(type),
            isDesignBlock: DESIGN.has(type),
            layout: { w: cat?.w ?? size.w, h: cat?.h ?? size.h },
            order,
        };
        return [type, meta] as const;
    }),
) as Record<WidgetType, WidgetTypeMeta>;

/** Synchronous lookup against the static catalog. */
export const widgetTypeMeta = (type: WidgetType): WidgetTypeMeta => WIDGET_TYPE_CATALOG[type];

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
