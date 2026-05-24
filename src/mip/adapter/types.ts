/**
 * UI-kit adapter contract.
 *
 * The renderer is deliberately decoupled from any one component library: a
 * `UiKitAdapter` is a bag of renderers keyed by `WidgetType`. Untitled UI is
 * the first adapter (`src/mip/adapters/untitled`), but shadcn / MUI / a plain
 * adapter can be dropped in by implementing the same interface and swapping it
 * at the `UiKitProvider`. Nothing below imports a concrete component library.
 */

import type { ReactElement } from "react";
import type { MipWidget, WidgetType } from "@/mip/schema";

/** Lifecycle of a widget's bound data source, mirrored from the original app. */
export type WidgetDataStatus = "idle" | "loading" | "error" | "success";

export interface WidgetDataState {
    status: WidgetDataStatus;
    data?: unknown;
    error?: string;
}

export const IDLE_DATA_STATE: WidgetDataState = { status: "idle" };

export interface WidgetRenderProps {
    widget: MipWidget;
    dataState: WidgetDataState;
}

export type WidgetRenderer = (props: WidgetRenderProps) => ReactElement | null;

export interface UiKitAdapter {
    /** Stable id, e.g. "untitled-ui". */
    id: string;
    /** Human label for settings/UI. */
    name: string;
    /** Renderers keyed by widget type. Partial — unmapped types use `fallback`. */
    widgets: Partial<Record<WidgetType, WidgetRenderer>>;
    /** Rendered when a widget type has no registered renderer. */
    fallback?: WidgetRenderer;
}
