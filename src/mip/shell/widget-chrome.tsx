/**
 * Grid-cell chrome around a rendered widget: a drag handle (the only draggable
 * surface, matched by the grid's `dragConfig.handle`), an edit button and a
 * delete button, revealed on hover while in edit mode. The widget itself renders
 * via WidgetView. Per-widget Design overrides (border / background color) from
 * `widget.style` are applied to the card container.
 */

import type { CSSProperties } from "react";
import { ArrowRight, DotsGrid, LinkExternal01, Trash01 } from "@untitledui/icons";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { WidgetView } from "@/mip/adapter/registry";
import type { MipElementStyle, MipWidget, WidgetType } from "@/mip/schema";
import { useDashboard } from "@/mip/store";
import { cx } from "@/utils/cx";
import { useWidgetData } from "./use-widget-data";
import { WidgetEditorButton } from "./widget-editor";

const isSafeHttpUrl = (v: string) => /^https?:\/\//i.test(v.trim());

export interface WidgetElementDef {
    key: string;
    label: string;
    /** CSS selector relative to the widget root; "" = the card itself. */
    selector: string;
}

/** Styleable parts per widget type — drives the Design tab's element tabs. */
export function widgetElements(type: WidgetType): WidgetElementDef[] {
    const card: WidgetElementDef = { key: "card", label: "Widget", selector: "" };
    const title: WidgetElementDef = { key: "title", label: "Title", selector: "h3" };
    if (/Chart$/.test(type)) {
        return [card, title, { key: "axis", label: "Axis", selector: ".recharts-cartesian-axis text" }, { key: "grid", label: "Grid", selector: ".recharts-cartesian-grid line" }];
    }
    switch (type) {
        case "kpi":
            return [card, { key: "value", label: "Value", selector: ".text-display-sm" }, title];
        case "table":
            return [card, title, { key: "header", label: "Header", selector: "th" }, { key: "cell", label: "Cell", selector: "td" }];
        case "list":
            return [card, title, { key: "item", label: "Item", selector: "li" }];
        case "progress":
            return [card, title, { key: "bar", label: "Bar", selector: '[role="progressbar"] > *' }];
        default:
            return [card, title];
    }
}

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

/** Scope a raw custom-CSS block to a selector. `&` → that selector; a bare
 *  declaration list is wrapped in it. */
export function scopeCss(selector: string, css?: string): string {
    const trimmed = (css ?? "").trim();
    if (!trimmed) return "";
    if (trimmed.includes("{")) return trimmed.replaceAll("&", selector);
    return `${selector}{${trimmed}}`;
}

const CSS_PROP: Record<string, string> = {
    fontSize: "font-size",
    fontWeight: "font-weight",
    textAlign: "text-align",
    letterSpacing: "letter-spacing",
    lineHeight: "line-height",
    padding: "padding",
    borderRadius: "border-radius",
    boxShadow: "box-shadow",
    opacity: "opacity",
};
const UNIT_PROPS = new Set(["fontSize", "letterSpacing", "padding", "borderRadius"]);

/** Build the !important declaration list for a sub-element's colors + css. */
function elementDecls(st: MipElementStyle): string[] {
    const out: string[] = [];
    const c = st.colors ?? {};
    if (c.text) out.push(`color:${c.text} !important`);
    if (c.background) out.push(`background-color:${c.background} !important`);
    if (c.border) out.push(`border-color:${c.border} !important`);
    if (c.accent) out.push(`fill:${c.accent} !important`, `stroke:${c.accent} !important`);
    for (const [key, prop] of Object.entries(CSS_PROP)) {
        const v = st.css?.[key];
        if (v) out.push(`${prop}:${UNIT_PROPS.has(key) ? withUnit(v) : v} !important`);
    }
    return out;
}

/** All scoped CSS for a widget: the card's custom CSS + every sub-element rule. */
export function widgetScopedCss(widget: MipWidget): string {
    const root = `.mip-w-${widget.id}`;
    let out = scopeCss(root, widget.style?.customCss);
    const elements = widget.style?.elements ?? {};
    for (const def of widgetElements(widget.type)) {
        if (def.key === "card") continue;
        const st = elements[def.key];
        if (!st) continue;
        const sel = def.selector ? `${root} ${def.selector}` : root;
        const decls = elementDecls(st);
        if (decls.length) out += `${sel}{${decls.join(";")}}`;
        if (st.customCss?.trim()) out += scopeCss(sel, st.customCss);
    }
    return out;
}

export function WidgetChrome({ widget, editMode, onDelete }: { widget: MipWidget; editMode: boolean; onDelete: (id: string) => void }) {
    const dataState = useWidgetData(widget);
    const scopedCss = widgetScopedCss(widget);
    const { state, activePage, setActivePage } = useDashboard();

    // --- Footer: a citation (source) link on the left + a "Read more" page link
    // on the right. Hidden entirely when the widget has neither. Mirrors the
    // legacy WidgetChrome footer (settings.caption / captionHref + details.route).
    const settings = (widget.settings ?? {}) as Record<string, unknown>;
    const captionRaw = settings.caption ?? settings.description ?? settings.source;
    const caption = typeof captionRaw === "string" ? captionRaw.trim() : "";
    const explicitHref = typeof settings.captionHref === "string" ? settings.captionHref.trim() : "";
    const captionHref = isSafeHttpUrl(explicitHref) ? explicitHref : isSafeHttpUrl(caption) ? caption : "";
    // "Read more" → another dashboard page, by id in details.route.
    const detailsRoute = typeof widget.details?.route === "string" ? widget.details.route.trim() : "";
    const linkPage = detailsRoute ? state.pages.find((p) => p.id === detailsRoute && p.id !== activePage.id) : undefined;
    const detailsLabel = (typeof widget.details?.label === "string" && widget.details.label.trim()) || "Read more";
    const showFooter = !!(caption || captionHref || linkPage);

    return (
        <div className={cx("group relative h-full", editMode && "rounded-xl ring-1 ring-transparent transition-shadow hover:ring-brand")}>
            {scopedCss ? <style>{scopedCss}</style> : null}
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
                `mip-w-<id>` class is the scope target for custom CSS. The card is
                a flex column so the footer pins to the bottom and the widget body
                fills the rest. */}
            <div
                className={cx(
                    "mip-w-" + widget.id,
                    "flex h-full flex-col overflow-hidden rounded-xl [&>section]:!rounded-none [&>section]:!bg-transparent [&>section]:!ring-0 [&>section]:min-h-0 [&>section]:flex-1",
                )}
                style={widgetCardStyle(widget)}
            >
                <WidgetView widget={widget} dataState={dataState} />
                {showFooter ? (
                    <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-secondary px-3.5 py-1.5 text-xs">
                        <span className="min-w-0 flex-1 truncate text-tertiary">
                            {captionHref ? (
                                <a
                                    href={captionHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={caption ? `${caption} — ${captionHref}` : captionHref}
                                    className="inline-flex max-w-full items-center gap-1 truncate text-brand-secondary hover:underline"
                                >
                                    <LinkExternal01 className="size-3 shrink-0" />
                                    <span className="truncate">{caption || captionHref}</span>
                                </a>
                            ) : caption ? (
                                <span className="truncate" title={caption}>
                                    {caption}
                                </span>
                            ) : null}
                        </span>
                        {linkPage ? (
                            <button
                                type="button"
                                onClick={() => setActivePage(linkPage.id)}
                                title={`Go to ${linkPage.title}`}
                                className="inline-flex shrink-0 items-center gap-1 font-medium text-brand-secondary hover:underline"
                            >
                                {detailsLabel}
                                <ArrowRight className="size-3" />
                            </button>
                        ) : null}
                    </footer>
                ) : null}
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
