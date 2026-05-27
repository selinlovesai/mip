/**
 * Addable-widget catalog for the picker + `makeWidget`.
 *
 * Label / group / default size come from the single source of truth — the
 * `widget_types` catalog (`src/mip/data/widget-types.json` via
 * `@/mip/widget-types`). This module only owns the EXAMPLE/placeholder content
 * (sample settings + form fields) used when a widget is first dropped, and the
 * ordered list of types the picker offers.
 */

import type { MipWidget, WidgetType } from "@/mip/schema";
import { WIDGET_TYPE_CATALOG } from "@/mip/widget-types";

export interface CatalogEntry {
    type: WidgetType;
    label: string;
    group: string;
    w: number;
    h: number;
    settings?: Record<string, unknown>;
    fields?: MipWidget["fields"];
}

/** Example/placeholder content per type — illustrative data shown when a widget
 *  is first added (NOT config; the structural metadata lives in the JSON catalog). */
const EXAMPLE_CONTENT: Partial<Record<WidgetType, { settings?: Record<string, unknown>; fields?: MipWidget["fields"] }>> = {
    kpi: { settings: { value: 1234, delta: 5.2, deltaLabel: "vs. last period" } },
    progress: { settings: { value: 60, target: 100 } },
    table: { settings: { columns: [{ key: "name", label: "Name" }, { key: "status", label: "Status" }], rows: [{ name: "Item A", status: "Active" }, { name: "Item B", status: "Pending" }] } },
    list: { settings: { primaryKey: "name", secondaryKey: "detail", items: [{ name: "Olivia Rhye", detail: "olivia@acme.com" }, { name: "Phoenix Baker", detail: "phoenix@globex.com" }] } },
    detail: { settings: { fields: [{ key: "plan", label: "Plan" }, { key: "seats", label: "Seats" }], record: { plan: "Pro", seats: 25 } } },
    lineChart: { settings: { points: [{ label: "Mon", value: 12 }, { label: "Tue", value: 19 }, { label: "Wed", value: 14 }, { label: "Thu", value: 23 }] } },
    barChart: { settings: { points: [{ label: "A", value: 40 }, { label: "B", value: 28 }, { label: "C", value: 16 }] } },
    areaChart: { settings: { points: [{ label: "Q1", value: 120 }, { label: "Q2", value: 210 }, { label: "Q3", value: 180 }, { label: "Q4", value: 320 }] } },
    pieChart: { settings: { points: [{ label: "A", value: 45 }, { label: "B", value: 30 }, { label: "C", value: 25 }] } },
    donutChart: { settings: { points: [{ label: "A", value: 45 }, { label: "B", value: 30 }, { label: "C", value: 25 }] } },
    markdown: { settings: { content: "## Heading\n\nSome **markdown** content." } },
    card: { settings: { heading: "Card title", body: "Card body text." } },
    tabs: { settings: { tabs: [{ label: "Tab 1", content: "First panel." }, { label: "Tab 2", content: "Second panel." }] } },
    image: { settings: { url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600" } },
    button: { settings: { label: "Click me" } },
    form: { fields: [{ name: "name", type: "text", label: "Name", required: true }, { name: "email", type: "email", label: "Email" }] },
    hero: { settings: { heading: "Hero heading", subheading: "Supporting subheading.", ctaLabel: "Get started" } },
    cta: { settings: { heading: "Ready to start?", body: "Join today.", buttonLabel: "Sign up" } },
    featureGrid: { settings: { heading: "Features", features: [{ icon: "Zap", title: "Fast", description: "Quick." }, { icon: "Shield01", title: "Secure", description: "Safe." }] } },
    statsGrid: { settings: { stats: [{ value: "10K+", label: "Users" }, { value: "99.9%", label: "Uptime" }] } },
    testimonial: { settings: { quote: "“Great product.”", author: "Jane Doe", role: "CEO", rating: 5 } },
    pricing: { settings: { tiers: [{ name: "Basic", price: "$9", period: "mo", features: ["Feature A"], ctaLabel: "Choose" }, { name: "Pro", price: "$29", period: "mo", features: ["Everything"], highlighted: true, ctaLabel: "Choose" }] } },
    faq: { settings: { items: [{ question: "Question one?", answer: "Answer one." }, { question: "Question two?", answer: "Answer two." }] } },
    flowchart: {},
    sequenceDiagram: {},
    ganttChart: {},
    googleMap: { settings: { query: "San Francisco, CA", zoom: 12 } },
};

/** Types the picker offers, in display order (catalog order from the JSON). */
const PICKER_TYPES = Object.keys(EXAMPLE_CONTENT) as WidgetType[];

/** Built from the JSON catalog (label/group/layout) + the example content. */
export const WIDGET_CATALOG: CatalogEntry[] = PICKER_TYPES.map((type) => {
    const meta = WIDGET_TYPE_CATALOG[type];
    const ex = EXAMPLE_CONTENT[type] ?? {};
    return {
        type,
        label: meta.label,
        group: meta.group,
        w: meta.layout.w,
        h: meta.layout.h,
        ...(ex.settings ? { settings: ex.settings } : {}),
        ...(ex.fields ? { fields: ex.fields } : {}),
    };
}).sort((a, b) => WIDGET_TYPE_CATALOG[a.type].order - WIDGET_TYPE_CATALOG[b.type].order);

export function makeWidget(entry: CatalogEntry): MipWidget {
    return {
        id: `${entry.type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: entry.type,
        title: entry.label,
        // Catalog sizes are authored on the legacy 12-col grid; the live grid is
        // 24-col (GRID_COLS) for finer steps, so double w/h at construction.
        layout: { x: 0, y: 0, w: entry.w * 2, h: entry.h * 2 },
        ...(entry.settings ? { settings: entry.settings } : {}),
        ...(entry.fields ? { fields: entry.fields } : {}),
    };
}
