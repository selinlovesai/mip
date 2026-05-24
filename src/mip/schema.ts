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
    /** Raw CSS color overrides (Design tab) — any CSS color or "transparent". */
    borderColor?: string;
    backgroundColor?: string;
}

export interface MipPermissions {
    read: boolean;
    write: boolean;
}
