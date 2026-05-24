/** Catalog of addable widgets — default settings + grid size per type, used by the picker. */

import type { MipWidget, WidgetType } from "@/mip/schema";

export interface CatalogEntry {
    type: WidgetType;
    label: string;
    group: string;
    w: number;
    h: number;
    settings?: Record<string, unknown>;
    fields?: MipWidget["fields"];
}

export const WIDGET_CATALOG: CatalogEntry[] = [
    { type: "kpi", label: "KPI", group: "Data", w: 4, h: 1, settings: { value: 1234, delta: 5.2, deltaLabel: "vs. last period" } },
    { type: "progress", label: "Progress", group: "Data", w: 4, h: 1, settings: { value: 60, target: 100 } },
    { type: "table", label: "Table", group: "Data", w: 6, h: 2, settings: { columns: [{ key: "name", label: "Name" }, { key: "status", label: "Status" }], rows: [{ name: "Item A", status: "Active" }, { name: "Item B", status: "Pending" }] } },
    { type: "list", label: "List", group: "Data", w: 4, h: 2, settings: { primaryKey: "name", secondaryKey: "detail", items: [{ name: "Olivia Rhye", detail: "olivia@acme.com" }, { name: "Phoenix Baker", detail: "phoenix@globex.com" }] } },
    { type: "detail", label: "Detail", group: "Data", w: 4, h: 2, settings: { fields: [{ key: "plan", label: "Plan" }, { key: "seats", label: "Seats" }], record: { plan: "Pro", seats: 25 } } },
    { type: "lineChart", label: "Line chart", group: "Charts", w: 6, h: 2, settings: { points: [{ label: "Mon", value: 12 }, { label: "Tue", value: 19 }, { label: "Wed", value: 14 }, { label: "Thu", value: 23 }] } },
    { type: "barChart", label: "Bar chart", group: "Charts", w: 6, h: 2, settings: { points: [{ label: "A", value: 40 }, { label: "B", value: 28 }, { label: "C", value: 16 }] } },
    { type: "areaChart", label: "Area chart", group: "Charts", w: 6, h: 2, settings: { points: [{ label: "Q1", value: 120 }, { label: "Q2", value: 210 }, { label: "Q3", value: 180 }, { label: "Q4", value: 320 }] } },
    { type: "pieChart", label: "Pie chart", group: "Charts", w: 4, h: 2, settings: { points: [{ label: "A", value: 45 }, { label: "B", value: 30 }, { label: "C", value: 25 }] } },
    { type: "donutChart", label: "Donut chart", group: "Charts", w: 4, h: 2, settings: { points: [{ label: "A", value: 45 }, { label: "B", value: 30 }, { label: "C", value: 25 }] } },
    { type: "markdown", label: "Markdown", group: "Content", w: 4, h: 2, settings: { content: "## Heading\n\nSome **markdown** content." } },
    { type: "card", label: "Card", group: "Content", w: 4, h: 1, settings: { heading: "Card title", body: "Card body text." } },
    { type: "tabs", label: "Tabs", group: "Content", w: 6, h: 2, settings: { tabs: [{ label: "Tab 1", content: "First panel." }, { label: "Tab 2", content: "Second panel." }] } },
    { type: "image", label: "Image", group: "Content", w: 4, h: 2, settings: { url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600" } },
    { type: "button", label: "Button", group: "Content", w: 2, h: 1, settings: { label: "Click me" } },
    { type: "form", label: "Form", group: "Content", w: 4, h: 2, fields: [{ name: "name", type: "text", label: "Name", required: true }, { name: "email", type: "email", label: "Email" }] },
    { type: "hero", label: "Hero", group: "Marketing", w: 12, h: 3, settings: { heading: "Hero heading", subheading: "Supporting subheading.", ctaLabel: "Get started" } },
    { type: "cta", label: "CTA", group: "Marketing", w: 12, h: 2, settings: { heading: "Ready to start?", body: "Join today.", buttonLabel: "Sign up" } },
    { type: "featureGrid", label: "Feature grid", group: "Marketing", w: 8, h: 2, settings: { heading: "Features", features: [{ icon: "⚡", title: "Fast", description: "Quick." }, { icon: "🔒", title: "Secure", description: "Safe." }] } },
    { type: "statsGrid", label: "Stats grid", group: "Marketing", w: 8, h: 1, settings: { stats: [{ value: "10K+", label: "Users" }, { value: "99.9%", label: "Uptime" }] } },
    { type: "testimonial", label: "Testimonial", group: "Marketing", w: 4, h: 2, settings: { quote: "“Great product.”", author: "Jane Doe", role: "CEO", rating: 5 } },
    { type: "pricing", label: "Pricing", group: "Marketing", w: 12, h: 3, settings: { tiers: [{ name: "Basic", price: "$9", period: "mo", features: ["Feature A"], ctaLabel: "Choose" }, { name: "Pro", price: "$29", period: "mo", features: ["Everything"], highlighted: true, ctaLabel: "Choose" }] } },
    { type: "faq", label: "FAQ", group: "Marketing", w: 8, h: 2, settings: { items: [{ question: "Question one?", answer: "Answer one." }, { question: "Question two?", answer: "Answer two." }] } },
    { type: "flowchart", label: "Flowchart", group: "Diagrams", w: 6, h: 3 },
    { type: "sequenceDiagram", label: "Sequence", group: "Diagrams", w: 6, h: 3 },
    { type: "ganttChart", label: "Gantt", group: "Diagrams", w: 8, h: 2 },
    { type: "googleMap", label: "Map", group: "Integrations", w: 6, h: 2, settings: { query: "San Francisco, CA", zoom: 12 } },
];

export function makeWidget(entry: CatalogEntry): MipWidget {
    return {
        id: `${entry.type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: entry.type,
        title: entry.label,
        layout: { x: 0, y: 0, w: entry.w, h: entry.h },
        ...(entry.settings ? { settings: entry.settings } : {}),
        ...(entry.fields ? { fields: entry.fields } : {}),
    };
}
