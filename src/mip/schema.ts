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
}

export interface MipWidgetColors {
    text?: string; // primary text (titles, values)
    subtext?: string; // secondary/tertiary/quaternary (labels, captions)
    border?: string;
    background?: string;
    accent?: string; // chart series, progress, badges (brand ramp)
}

export interface MipPermissions {
    read: boolean;
    write: boolean;
}
