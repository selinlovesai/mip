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

/** Append `px` to a bare number; pass through anything else (var(), %, etc.). */
function withUnit(v: string): string {
    return /^-?\d+(\.\d+)?$/.test(v.trim()) ? `${v.trim()}px` : v;
}

/**
 * Build the per-widget card style from the Design-tab inspector. Colors set the
 * *utility-facing* CSS vars (the ones Tailwind's text-/bg- utilities read, e.g.
 * `--text-color-primary`) so they actually recolor rendered text, plus the brand
 * ramp for accents (chart series / progress / badges). Structured CSS values
 * (typography, spacing, radius, shadow, border width/style) apply directly to
 * the card. Empty values inherit the theme.
 */
export function widgetCardStyle(widget: MipWidget): CSSProperties {
    const c = widget.style?.colors ?? {};
    const css = widget.style?.css ?? {};
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
    const borderColor = c.border || widget.style?.borderColor || DEFAULT_BORDER_COLOR;
    if (c.background) vars["--background-color-primary"] = c.background;

    const borderWidth = css.borderWidth ? withUnit(css.borderWidth) : "1px";
    const borderStyle = css.borderStyle || "solid";

    const extra: Record<string, string | number> = {};
    if (css.fontSize) extra.fontSize = withUnit(css.fontSize);
    if (css.fontWeight) extra.fontWeight = css.fontWeight;
    if (css.textAlign) extra.textAlign = css.textAlign;
    if (css.letterSpacing) extra.letterSpacing = withUnit(css.letterSpacing);
    if (css.lineHeight) extra.lineHeight = css.lineHeight;
    if (css.padding) extra.padding = withUnit(css.padding);
    if (css.borderRadius) extra.borderRadius = withUnit(css.borderRadius);
    if (css.boxShadow) extra.boxShadow = css.boxShadow;
    if (css.opacity) extra.opacity = Number(css.opacity);

    return { ...vars, ...extra, backgroundColor: background, border: `${borderWidth} ${borderStyle} ${borderColor}` } as CSSProperties;
}

/** Scope a raw custom-CSS block to the widget. `&` → the widget selector; a bare
 *  declaration list is wrapped in the widget selector. */
export function scopedCustomCss(widgetId: string, css?: string): string {
    const trimmed = (css ?? "").trim();
    if (!trimmed) return "";
    const sel = `.mip-w-${widgetId}`;
    if (trimmed.includes("{")) return trimmed.replaceAll("&", sel);
    return `${sel}{${trimmed}}`;
}

export function WidgetChrome({ widget, editMode, onDelete }: { widget: MipWidget; editMode: boolean; onDelete: (id: string) => void }) {
    const dataState = useWidgetData(widget);
    const customCss = scopedCustomCss(widget.id, widget.style?.customCss);
    return (
        <div className={cx("group relative h-full", editMode && "rounded-xl ring-1 ring-transparent transition-shadow hover:ring-brand")}>
            {customCss ? <style>{customCss}</style> : null}
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
                so the chosen colors are the ones actually shown. The
                `mip-w-<id>` class is the scope target for custom CSS. */}
            <div
                className={cx("mip-w-" + widget.id, "h-full overflow-hidden rounded-xl [&>section]:!rounded-none [&>section]:!bg-transparent [&>section]:!ring-0")}
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
