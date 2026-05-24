/**
 * Grid-cell chrome around a rendered widget: a drag handle (the only draggable
 * surface, matched by the grid's `dragConfig.handle`), an edit button and a
 * delete button, revealed on hover while in edit mode. The widget itself renders
 * via WidgetView. Per-widget Design overrides (border / background color) from
 * `widget.style` are applied to the card container.
 */

import type { CSSProperties } from "react";
import { DotsGrid, Trash01 } from "@untitledui/icons";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { WidgetView } from "@/mip/adapter/registry";
import type { MipWidget } from "@/mip/schema";
import { cx } from "@/utils/cx";
import { useWidgetData } from "./use-widget-data";
import { WidgetEditorButton } from "./widget-editor";

/** Design-tab defaults — match the widget card's normal look (white surface,
 *  secondary border) so the controls visibly change a real surface. */
export const DEFAULT_BORDER_COLOR = "var(--color-border-secondary)";
export const DEFAULT_BACKGROUND_COLOR = "var(--color-bg-primary)";

/**
 * Token overrides for a per-widget light/dark scheme. We remap the *semantic*
 * tokens (which inherit into the card's descendants) to that mode's own neutral
 * shades — so text, sub-text, labels, border and surface each get the right
 * value, not a single flat color.
 */
const SCHEME_VARS: Record<"light" | "dark", Record<string, string>> = {
    light: {
        "--color-text-primary": "var(--color-neutral-900)",
        "--color-text-secondary": "var(--color-neutral-700)",
        "--color-text-tertiary": "var(--color-neutral-600)",
        "--color-text-quaternary": "var(--color-neutral-500)",
        "--color-border-secondary": "var(--color-neutral-200)",
        "--color-bg-primary": "var(--color-white, #fff)",
        "--color-bg-secondary": "var(--color-neutral-50)",
    },
    dark: {
        "--color-text-primary": "var(--color-neutral-50)",
        "--color-text-secondary": "var(--color-neutral-300)",
        "--color-text-tertiary": "var(--color-neutral-400)",
        "--color-text-quaternary": "var(--color-neutral-400)",
        "--color-border-secondary": "var(--color-neutral-800)",
        "--color-bg-primary": "var(--color-neutral-950)",
        "--color-bg-secondary": "var(--color-neutral-900)",
    },
};

export function widgetCardStyle(widget: MipWidget): CSSProperties {
    const scheme = widget.style?.colorScheme;
    const schemeVars = scheme ? SCHEME_VARS[scheme] : {};
    const borderColor = widget.style?.borderColor ?? DEFAULT_BORDER_COLOR;
    const backgroundColor = widget.style?.backgroundColor ?? DEFAULT_BACKGROUND_COLOR;
    return { ...schemeVars, backgroundColor, border: `1px solid ${borderColor}` } as CSSProperties;
}

export function WidgetChrome({ widget, editMode, onDelete }: { widget: MipWidget; editMode: boolean; onDelete: (id: string) => void }) {
    const dataState = useWidgetData(widget);
    return (
        <div className={cx("group relative h-full", editMode && "rounded-xl ring-1 ring-transparent transition-shadow hover:ring-brand")}>
            {editMode ? (
                <div className="absolute right-2 top-2 z-10 flex items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                    <span className="mip-drag-handle flex size-7 cursor-grab items-center justify-center rounded-md bg-primary text-tertiary ring-1 ring-secondary hover:text-secondary active:cursor-grabbing" aria-label="Drag widget" title="Drag">
                        <DotsGrid className="size-4" />
                    </span>
                    <WidgetEditorButton widget={widget} />
                    <ButtonUtility color="tertiary" size="xs" icon={Trash01} tooltip="Delete widget" onClick={() => onDelete(widget.id)} />
                </div>
            ) : null}
            {/* The chrome owns the card surface (border + background from the
                Design tab). Neutralize the inner WidgetCard's own bg/ring/radius
                so the chosen colors are the ones actually shown. */}
            <div
                className="h-full overflow-hidden rounded-xl [&>section]:!rounded-none [&>section]:!bg-transparent [&>section]:!ring-0"
                style={widgetCardStyle(widget)}
            >
                <WidgetView widget={widget} dataState={dataState} />
            </div>
            {/* Resize affordance: a corner grip in the SE corner during edit mode.
                Purely visual (pointer-events-none) — react-grid-layout's own
                resize handle sits on top and does the actual resizing. */}
            {editMode ? (
                <span aria-hidden className="pointer-events-none absolute bottom-0.5 right-0.5 z-20 text-fg-brand-primary/70">
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <path d="M10 2 L2 10 M10 6 L6 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </span>
            ) : null}
        </div>
    );
}
