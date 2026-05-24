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
 * Build the per-widget card style from the Design-tab color overrides. We set
 * the *utility-facing* CSS vars (the ones Tailwind's text-/bg- utilities read,
 * e.g. `--text-color-primary`) so overrides actually recolor the rendered text,
 * plus the brand ramp for accents (chart series / progress / badges). Border and
 * background are applied directly. Empty values inherit the theme.
 */
export function widgetCardStyle(widget: MipWidget): CSSProperties {
    const c = widget.style?.colors ?? {};
    const vars: Record<string, string> = {};

    if (c.text) vars["--text-color-primary"] = c.text;
    if (c.subtext) {
        vars["--text-color-secondary"] = c.subtext;
        vars["--text-color-tertiary"] = c.subtext;
        vars["--text-color-quaternary"] = c.subtext;
    }
    if (c.accent) {
        for (const n of [400, 500, 600, 700]) {
            vars[`--color-utility-brand-${n}`] = c.accent;
            vars[`--color-brand-${n}`] = c.accent;
        }
    }

    const background = c.background || widget.style?.backgroundColor || DEFAULT_BACKGROUND_COLOR;
    const border = c.border || widget.style?.borderColor || DEFAULT_BORDER_COLOR;
    if (c.background) vars["--background-color-primary"] = c.background;

    return { ...vars, backgroundColor: background, border: `1px solid ${border}` } as CSSProperties;
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
