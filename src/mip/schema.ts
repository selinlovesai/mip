/**
 * MIP widget contract — ported from the original vanilla-CSS app
 * (`packages/mip-schema`). This is the single source of truth for what a
 * widget *is*; it is intentionally UI-kit agnostic. Renderers live in
 * `src/mip/adapters/*` and consume this contract — they never extend it.
 *
 * Only the widget-facing portion of the original schema is ported here.
 * Data-source / navigation / theme types come over as they are needed.
 */

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export const WIDGET_TYPES = [
    "kpi",
    "progress",
    "lineChart",
    "barChart",
    "areaChart",
    "pieChart",
    "donutChart",
    "table",
    "list",
    "detail",
    "markdown",
    "image",
    "flowchart",
    "sequenceDiagram",
    "mindmap",
    "timeline",
    "ganttChart",
    "form",
    "button",
    "pageHeader",
    "card",
    "tabs",
    "modal",
    "drawer",
    "googleMap",
    // Design blocks
    "contentSection",
    "cta",
    "faq",
    "featureGrid",
    "hero",
    "pricing",
    "statsGrid",
    "testimonial",
] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];

/** Default grid size per widget type, in a 12-column grid with ~70px rows.
 *  KPIs are small (3×2), charts are square-ish (6×6), tables/sections wide. */
export const DEFAULT_WIDGET_SIZES: Record<WidgetType, { w: number; h: number }> = {
    kpi: { w: 3, h: 2 },
    progress: { w: 3, h: 2 },
    lineChart: { w: 6, h: 6 },
    barChart: { w: 6, h: 6 },
    areaChart: { w: 6, h: 6 },
    pieChart: { w: 4, h: 6 },
    donutChart: { w: 4, h: 6 },
    table: { w: 6, h: 8 },
    list: { w: 4, h: 6 },
    detail: { w: 4, h: 4 },
    markdown: { w: 4, h: 4 },
    image: { w: 4, h: 6 },
    flowchart: { w: 6, h: 6 },
    sequenceDiagram: { w: 6, h: 6 },
    mindmap: { w: 6, h: 6 },
    timeline: { w: 6, h: 6 },
    ganttChart: { w: 8, h: 6 },
    form: { w: 4, h: 6 },
    button: { w: 2, h: 2 },
    pageHeader: { w: 12, h: 2 },
    card: { w: 3, h: 3 },
    tabs: { w: 6, h: 6 },
    modal: { w: 3, h: 2 },
    drawer: { w: 3, h: 2 },
    googleMap: { w: 6, h: 6 },
    contentSection: { w: 12, h: 6 },
    cta: { w: 12, h: 4 },
    faq: { w: 8, h: 6 },
    featureGrid: { w: 8, h: 6 },
    hero: { w: 12, h: 6 },
    pricing: { w: 12, h: 8 },
    statsGrid: { w: 8, h: 4 },
    testimonial: { w: 4, h: 6 },
};

/** Default seed settings per widget type, surfaced (and editable) in
 *  Settings → Widgets and used when a widget is added. Merged OVER the catalog's
 *  example settings, so it can extend or override them. Icons are icon-class /
 *  Untitled-name strings (see WidgetIcon), not emojis. */
export const DEFAULT_WIDGET_SETTINGS: Partial<Record<WidgetType, Record<string, unknown>>> = {
    // Charts — legend position: bottom (default) | top | left | right | none.
    lineChart: { legendPosition: "bottom" },
    barChart: { legendPosition: "bottom" },
    areaChart: { legendPosition: "bottom" },
    pieChart: { legendPosition: "bottom" },
    donutChart: { legendPosition: "bottom" },
    // Diagrams — mermaid source.
    flowchart: { source: "graph TD\n  A[Start] --> B{Approved?}\n  B -->|Yes| C[Ship]\n  B -->|No| D[Revise]\n  D --> B" },
    sequenceDiagram: { source: "sequenceDiagram\n  Client->>API: Request\n  API->>DB: Query\n  DB-->>API: Rows\n  API-->>Client: Response" },
    mindmap: { source: "mindmap\n  root((Dashboard))\n    Widgets\n      Charts\n      Tables\n    Data\n      Sources" },
    timeline: { source: "timeline\n  title Roadmap\n  2026 Q1 : Scaffold\n  2026 Q2 : Renderers\n  2026 Q3 : Cutover" },
    ganttChart: { source: "gantt\n  title Plan\n  dateFormat YYYY-MM-DD\n  section Build\n  Adapter :a1, 2026-01-01, 14d\n  Widgets :after a1, 21d" },
    // Layout / overlay blocks.
    pageHeader: { heading: "Page title", subheading: "Supporting text", actionLabel: "", actionUrl: "#", alignment: "left" },
    modal: { triggerLabel: "Open modal", heading: "Details", body: "Modal body text." },
    drawer: { triggerLabel: "Open drawer", heading: "Details", body: "Drawer body text." },
    contentSection: { heading: "Section heading", body: "Body text…", imageUrl: "", imagePosition: "top", alignment: "left" },
    // Map — place query or lat/lng + marker.
    googleMap: { query: "San Francisco, CA", zoom: 12, lat: null, lng: null, marker: true },
    // Button — link + presentation.
    button: { label: "Click me", url: "#", target: "_self", className: "", title: "" },
    // Hero — background image + alignment.
    hero: { alignment: "center", backgroundImage: "" },
    cta: { alignment: "center" },
    card: { alignment: "left" },
    // Feature grid — icon-class / Untitled-name icons (no emojis).
    featureGrid: {
        heading: "Features",
        features: [
            { icon: "Zap", title: "Fast", description: "Lightning-quick performance." },
            { icon: "Shield01", title: "Secure", description: "Encrypted end to end." },
            { icon: "Globe01", title: "Global", description: "Available everywhere." },
        ],
    },
};

export const FIELD_TYPES = ["text", "email", "number", "date", "select", "checkbox", "toggle", "textarea"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const SIZE_VALUES = ["sm", "md", "lg", "xl"] as const;
export type SizeValue = (typeof SIZE_VALUES)[number];

export const RADIUS_VALUES = ["none", "sm", "md", "lg", "xl"] as const;
export type RadiusValue = (typeof RADIUS_VALUES)[number];

export const DENSITY_VALUES = ["compact", "comfortable"] as const;
export type DensityValue = (typeof DENSITY_VALUES)[number];

export const BUTTON_VARIANTS = ["primary", "secondary", "ghost", "danger"] as const;
export type ButtonVariant = (typeof BUTTON_VARIANTS)[number];

export const COLOR_TOKEN_VALUES = ["primary", "background", "surface", "text", "success", "warning", "danger", "info"] as const;
export type ColorTokenValue = (typeof COLOR_TOKEN_VALUES)[number];

export interface MipWidget {
    id: string;
    type: WidgetType;
    title?: string;
    layout: MipWidgetLayout;
    details?: MipWidgetDetails;
    data?: MipWidgetData;
    fields?: MipFormField[];
    submit?: MipWidgetSubmit;
    settings?: Record<string, unknown>;
    style?: MipWidgetStyle;
    permissions?: MipPermissions;
    actions?: string[];
}

export interface MipWidgetDetails {
    route?: string;
    label?: string;
}

export interface MipWidgetLayout {
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    minH?: number;
    maxW?: number;
    maxH?: number;
}

export interface MipWidgetData {
    sourceId: string;
    request: MipRequest;
    map?: Record<string, string>;
    /** Auto-refresh interval in ms. 0/undefined = fetch once (no polling). */
    refreshMs?: number;
}

export interface MipWidgetSubmit {
    sourceId: string;
    request: MipRequest;
}

export interface MipRequest {
    method: HttpMethod;
    path: string;
    params?: Record<string, unknown>;
    headers?: Record<string, string>;
    body?: unknown;
}

export interface MipFormField {
    name: string;
    type: FieldType;
    label: string;
    required?: boolean;
    options?: Array<{ label: string; value: string }>;
}

export interface MipWidgetStyle {
    background?: ColorTokenValue;
    padding?: SizeValue;
    radius?: RadiusValue;
    border?: boolean;
    accentColor?: ColorTokenValue;
    density?: DensityValue;
    variant?: ButtonVariant;
    size?: SizeValue;
    /** Legacy raw color overrides (superseded by `colors`; kept for back-compat). */
    borderColor?: string;
    backgroundColor?: string;
    /**
     * Per-widget color overrides (Design tab). Each is any CSS color / var() /
     * "transparent"; empty/undefined means inherit the theme. Applied as scoped
     * CSS vars on the widget so they recolor whatever the widget renders.
     */
    colors?: MipWidgetColors;
    /**
     * Structured CSS values from the Design inspector (Figma-style): fontSize,
     * fontWeight, textAlign, letterSpacing, lineHeight, padding, borderRadius,
     * borderWidth, borderStyle, boxShadow, opacity. Bare numbers get `px`.
     */
    css?: Record<string, string>;
    /** Raw custom CSS applied scoped to the widget (`&` = the widget). */
    customCss?: string;
    /**
     * Per-element overrides (Design tab → element tabs). Keyed by element key
     * (e.g. "value", "title", "axis"); each targets a selector inside the widget
     * and is emitted as a scoped, !important CSS rule. The widget root ("card")
     * is the top-level `colors`/`css`/`customCss` above.
     */
    elements?: Record<string, MipElementStyle>;
}

export interface MipWidgetColors {
    text?: string; // primary text (titles, values)
    subtext?: string; // secondary/tertiary/quaternary (labels, captions)
    border?: string;
    background?: string;
    accent?: string; // chart series, progress, badges (brand ramp)
}

export interface MipElementStyle {
    colors?: MipWidgetColors; // text→color, background, border, accent→fill/stroke
    css?: Record<string, string>;
    customCss?: string;
}

export interface MipPermissions {
    read: boolean;
    write: boolean;
}
