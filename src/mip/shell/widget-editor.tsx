/**
 * Widget editor — Untitled UI slide-out with two tabs:
 *   · Settings — title, settings JSON, and (for data-bound widgets) auto-refresh.
 *   · Design   — a compact, Figma-style inspector: Color (text/sub-text/accent),
 *                Fill, Stroke (color/width/style/radius), Text (size/weight/
 *                align/spacing), Effects (shadow/opacity), Spacing (padding), and
 *                a raw Custom CSS block. Writes to widget.style (colors / css /
 *                customCss); empty fields inherit the theme.
 */

import { useState, type ReactNode } from "react";
import { ChevronRight, Edit03 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { TextArea } from "@/components/base/textarea/textarea";
import { SlideoutMenu } from "@/components/application/slideout-menus/slideout-menu";
import { COLOR_TOKEN_GROUPS } from "@/mip/design-tokens";
import { useDashboard } from "@/mip/store";
import { useSettings } from "@/mip/settings/settings-store";
import type { HttpMethod, MipElementStyle, MipWidget, MipWidgetColors } from "@/mip/schema";
import { cx } from "@/utils/cx";
import { widgetElements } from "./widget-chrome";

/** One element's editable style in the inspector. */
interface ElState {
    colors: MipWidgetColors;
    css: Record<string, string>;
    customCss: string;
}

type EditorTab = "settings" | "design";

const REFRESH_OPTIONS = [
    { id: "0", label: "Off" },
    { id: "15000", label: "Every 15s" },
    { id: "30000", label: "Every 30s" },
    { id: "60000", label: "Every 60s" },
];

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => ({ id: m, label: m }));

const inputCls = "h-7 w-full min-w-0 rounded-md bg-primary px-2 text-xs text-primary ring-1 ring-secondary outline-none focus:ring-2 focus:ring-brand";

// ---- compact inspector primitives -----------------------------------------

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="flex flex-col gap-2">
            <h4 className="text-[10px] font-semibold uppercase tracking-wide text-quaternary">{title}</h4>
            {children}
        </section>
    );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-xs text-tertiary">{label}</span>
            <div className="flex min-w-0 flex-1 items-center gap-1.5">{children}</div>
        </div>
    );
}

/** Compact color row: small swatch (opens native picker) + text + preset palette. */
function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    const [open, setOpen] = useState(false);
    const isHex = /^#[0-9a-fA-F]{6}$/.test(value);
    return (
        <div className="flex flex-col gap-1.5">
            <Row label={label}>
                <span className="relative size-6 shrink-0 overflow-hidden rounded ring-1 ring-inset ring-secondary" style={{ background: value || "transparent" }}>
                    <input type="color" aria-label={`${label} color picker`} value={isHex ? value : "#000000"} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" />
                </span>
                <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="inherit" className={inputCls} />
                <button type="button" aria-label={`${label} presets`} onClick={() => setOpen((o) => !o)} className="shrink-0 rounded-md p-1 text-tertiary hover:text-secondary">
                    <ChevronRight className={cx("size-3.5 transition-transform", open && "rotate-90")} />
                </button>
            </Row>
            {open ? (
                <div className="ml-[4.5rem] flex flex-col gap-1.5 rounded-lg bg-secondary p-2 ring-1 ring-secondary">
                    {COLOR_TOKEN_GROUPS.map((g) => (
                        <div key={g.group} className="flex flex-wrap gap-1">
                            {g.tokens.map((token) => {
                                const v = `var(${token})`;
                                return (
                                    <button
                                        key={token}
                                        type="button"
                                        title={token.replace(/^--color-/, "")}
                                        aria-label={token}
                                        onClick={() => { onChange(v); setOpen(false); }}
                                        className={cx("size-5 rounded ring-1 ring-inset ring-black/10 transition", value === v ? "outline outline-2 outline-offset-1 outline-brand" : "hover:scale-110")}
                                        style={{ backgroundColor: v }}
                                    />
                                );
                            })}
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

const WEIGHTS = ["", "400", "500", "600", "700", "800"];
const BORDER_STYLES = ["", "solid", "dashed", "dotted", "none"];
const SHADOWS: Array<[string, string]> = [
    ["", "None"],
    ["var(--shadow-xs)", "XS"],
    ["var(--shadow-sm)", "SM"],
    ["var(--shadow-md)", "MD"],
    ["var(--shadow-lg)", "LG"],
    ["var(--shadow-xl)", "XL"],
    ["var(--shadow-2xl)", "2XL"],
];
const ALIGNS = ["left", "center", "right"] as const;

function EditorPanel({ widget, close }: { widget: MipWidget; close: () => void }) {
    const { updateWidget } = useDashboard();
    const { getConnection } = useSettings();
    const [tab, setTab] = useState<EditorTab>("settings");
    const [title, setTitle] = useState(widget.title ?? "");
    const [settingsText, setSettingsText] = useState(JSON.stringify(widget.settings ?? {}, null, 2));

    // For API-bound widgets: edit the actual live request + response mapping
    // (the source of the data), not the inline placeholder settings.
    const boundReq = widget.data?.request;
    const source = widget.data ? getConnection(widget.data.sourceId) : undefined;
    const [method, setMethod] = useState<string>(boundReq?.method ?? "GET");
    const [path, setPath] = useState<string>(boundReq?.path ?? "");
    const [bodyText, setBodyText] = useState(boundReq?.body != null ? JSON.stringify(boundReq.body, null, 2) : "");
    const [mapText, setMapText] = useState(widget.data?.map ? JSON.stringify(widget.data.map, null, 2) : "");

    const defs = widgetElements(widget.type);
    const [elStyles, setElStyles] = useState<Record<string, ElState>>(() => {
        const map: Record<string, ElState> = {};
        for (const d of defs) {
            if (d.key === "card") {
                map.card = {
                    colors: {
                        text: widget.style?.colors?.text ?? "",
                        subtext: widget.style?.colors?.subtext ?? "",
                        accent: widget.style?.colors?.accent ?? "",
                        border: widget.style?.colors?.border ?? widget.style?.borderColor ?? "",
                        background: widget.style?.colors?.background ?? widget.style?.backgroundColor ?? "",
                    },
                    css: { ...(widget.style?.css ?? {}) },
                    customCss: widget.style?.customCss ?? "",
                };
            } else {
                const e = widget.style?.elements?.[d.key];
                map[d.key] = { colors: { ...(e?.colors ?? {}) }, css: { ...(e?.css ?? {}) }, customCss: e?.customCss ?? "" };
            }
        }
        return map;
    });
    const [activeEl, setActiveEl] = useState<string>("card");
    const [refreshMs, setRefreshMs] = useState<string>(String(widget.data?.refreshMs ?? 0));
    const [error, setError] = useState<string | null>(null);

    const isBound = !!widget.data?.sourceId;
    const cur = elStyles[activeEl]!;
    const setColor = (key: keyof MipWidgetColors, v: string) =>
        setElStyles((s) => ({ ...s, [activeEl]: { ...s[activeEl]!, colors: { ...s[activeEl]!.colors, [key]: v } } }));
    const setProp = (key: string, v: string) =>
        setElStyles((s) => ({ ...s, [activeEl]: { ...s[activeEl]!, css: { ...s[activeEl]!.css, [key]: v } } }));
    const setCustom = (v: string) => setElStyles((s) => ({ ...s, [activeEl]: { ...s[activeEl]!, customCss: v } }));

    const save = () => {
        let settings: Record<string, unknown>;
        try {
            settings = settingsText.trim() ? JSON.parse(settingsText) : {};
        } catch (err) {
            setError(`Display settings: ${err instanceof Error ? err.message : "Invalid JSON"}`);
            setTab("settings");
            return;
        }
        // Parse the bound request body + mapping (when this widget reads live data).
        let body: unknown;
        let map: Record<string, string> | undefined;
        if (isBound) {
            try {
                body = bodyText.trim() ? JSON.parse(bodyText) : undefined;
            } catch (err) {
                setError(`Request body: ${err instanceof Error ? err.message : "Invalid JSON"}`);
                setTab("settings");
                return;
            }
            try {
                map = mapText.trim() ? (JSON.parse(mapText) as Record<string, string>) : undefined;
            } catch (err) {
                setError(`Response mapping: ${err instanceof Error ? err.message : "Invalid JSON"}`);
                setTab("settings");
                return;
            }
        }
        const cleanColors = (src: MipWidgetColors) => {
            const out: MipWidgetColors = {};
            (Object.keys(src) as Array<keyof MipWidgetColors>).forEach((k) => { if (src[k]?.trim()) out[k] = src[k]; });
            return out;
        };
        const cleanCss = (src: Record<string, string>) => {
            const out: Record<string, string> = {};
            Object.entries(src).forEach(([k, v]) => { if (v?.trim()) out[k] = v.trim(); });
            return out;
        };
        const card = elStyles.card!;
        const elements: Record<string, MipElementStyle> = {};
        for (const d of defs) {
            if (d.key === "card") continue;
            const st = elStyles[d.key]!;
            const cc = cleanColors(st.colors);
            const cs = cleanCss(st.css);
            const custom = st.customCss.trim();
            if (Object.keys(cc).length || Object.keys(cs).length || custom) {
                elements[d.key] = { ...(Object.keys(cc).length ? { colors: cc } : {}), ...(Object.keys(cs).length ? { css: cs } : {}), ...(custom ? { customCss: custom } : {}) };
            }
        }
        const ms = Number(refreshMs) || 0;
        updateWidget(widget.id, {
            title: title.trim() || undefined,
            settings,
            style: {
                ...widget.style,
                borderColor: undefined,
                backgroundColor: undefined,
                colors: cleanColors(card.colors),
                css: cleanCss(card.css),
                customCss: card.customCss.trim() || undefined,
                elements: Object.keys(elements).length ? elements : undefined,
            },
            ...(widget.data
                ? {
                      data: {
                          ...widget.data,
                          request: { ...widget.data.request, method: method as HttpMethod, path: path.trim() || widget.data.request.path, body },
                          map,
                          refreshMs: ms || undefined,
                      },
                  }
                : {}),
        });
        close();
    };

    const TABS: Array<{ id: EditorTab; label: string }> = [
        { id: "settings", label: "Settings" },
        { id: "design", label: "Design" },
    ];

    return (
        <>
            <SlideoutMenu.Header onClose={close}>
                <h3 className="text-lg font-semibold text-primary">Edit widget</h3>
                <p className="text-sm text-tertiary">
                    <span className="font-mono">{widget.type}</span>
                </p>
            </SlideoutMenu.Header>
            <SlideoutMenu.Content className="flex flex-col gap-4">
                <div className="flex gap-1 border-b border-secondary">
                    {TABS.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={cx("-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors", tab === t.id ? "border-brand text-brand-secondary" : "border-transparent text-tertiary hover:text-secondary")}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {tab === "settings" ? (
                    <div className="flex flex-col gap-4">
                        <Input label="Title" value={title} onChange={setTitle} placeholder="Widget title" />

                        {isBound ? (
                            <>
                                {/* Live data: edit the actual request + mapping, not the inline placeholder. */}
                                <div className="rounded-lg bg-secondary px-3 py-2 text-xs text-tertiary ring-1 ring-secondary">
                                    Live data from <span className="font-medium text-secondary">{source?.name ?? widget.data!.sourceId}</span>
                                </div>
                                <div className="flex items-end gap-2">
                                    <div className="w-28 shrink-0">
                                        <Select label="Method" aria-label="Request method" selectedKey={method} items={METHODS} onSelectionChange={(k) => setMethod(String(k))}>
                                            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                                        </Select>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <Input label="Path" value={path} onChange={(v) => { setPath(v); setError(null); }} placeholder="/endpoint" />
                                    </div>
                                </div>
                                <TextArea
                                    label="Request body (JSON)"
                                    hint="Sent with POST/PUT/PATCH. Leave blank for none."
                                    value={bodyText}
                                    onChange={(next) => { setBodyText(next); setError(null); }}
                                    rows={6}
                                    textAreaClassName="font-mono text-xs"
                                />
                                <TextArea
                                    label="Response mapping (JSONPath)"
                                    hint={'How the response maps to the widget, e.g. {"value":"$.count","delta":"$.change"}.'}
                                    value={mapText}
                                    onChange={(next) => { setMapText(next); setError(null); }}
                                    rows={5}
                                    textAreaClassName="font-mono text-xs"
                                />
                                <TextArea
                                    label="Display settings (JSON)"
                                    hint="Formatting & labels (not data) — e.g. valueFormat, labelKey. Must be valid JSON."
                                    value={settingsText}
                                    onChange={(next) => { setSettingsText(next); setError(null); }}
                                    rows={6}
                                    textAreaClassName="font-mono text-xs"
                                />
                                {error ? <p className="text-sm text-error-primary">{error}</p> : null}
                                <div className="flex flex-col gap-1.5 border-t border-secondary pt-4">
                                    <span className="text-sm font-medium text-secondary">Auto-refresh</span>
                                    <Select aria-label="Auto-refresh interval" selectedKey={refreshMs} items={REFRESH_OPTIONS} onSelectionChange={(k) => setRefreshMs(String(k))}>
                                        {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                                    </Select>
                                    <span className="text-xs text-tertiary">Re-fetch this widget's live data on an interval. Off by default.</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <TextArea
                                    label="Settings (JSON)"
                                    hint="The widget's data/configuration. Must be valid JSON."
                                    value={settingsText}
                                    onChange={(next) => { setSettingsText(next); setError(null); }}
                                    rows={12}
                                    textAreaClassName="font-mono text-xs"
                                />
                                {error ? <p className="text-sm text-error-primary">{error}</p> : null}
                            </>
                        )}
                    </div>
                ) : (
                    /* ---- Figma-style inspector (per-element) ---- */
                    <div className="flex flex-col gap-5">
                        {/* element tabs */}
                        <div className="-mx-1 flex flex-wrap gap-1 border-b border-secondary px-1 pb-2">
                            {defs.map((d) => (
                                <button
                                    key={d.key}
                                    type="button"
                                    onClick={() => setActiveEl(d.key)}
                                    className={cx("rounded-md px-2 py-1 text-xs font-medium transition-colors", activeEl === d.key ? "bg-secondary text-primary" : "text-tertiary hover:text-secondary")}
                                >
                                    {d.label}
                                </button>
                            ))}
                        </div>

                        <Section title="Color">
                            {activeEl === "card" ? (
                                <>
                                    <ColorRow label="Text" value={cur.colors.text ?? ""} onChange={(v) => setColor("text", v)} />
                                    <ColorRow label="Sub-text" value={cur.colors.subtext ?? ""} onChange={(v) => setColor("subtext", v)} />
                                    <ColorRow label="Accent" value={cur.colors.accent ?? ""} onChange={(v) => setColor("accent", v)} />
                                </>
                            ) : (
                                <>
                                    <ColorRow label="Color" value={cur.colors.text ?? ""} onChange={(v) => setColor("text", v)} />
                                    <ColorRow label="Accent" value={cur.colors.accent ?? ""} onChange={(v) => setColor("accent", v)} />
                                </>
                            )}
                        </Section>

                        <Section title="Fill">
                            <ColorRow label="Background" value={cur.colors.background ?? ""} onChange={(v) => setColor("background", v)} />
                        </Section>

                        <Section title="Stroke">
                            <ColorRow label="Border" value={cur.colors.border ?? ""} onChange={(v) => setColor("border", v)} />
                            <Row label="Width">
                                <input className={inputCls} value={cur.css.borderWidth ?? ""} onChange={(e) => setProp("borderWidth", e.target.value)} placeholder="1" />
                                <select className={inputCls} value={cur.css.borderStyle ?? ""} onChange={(e) => setProp("borderStyle", e.target.value)} aria-label="Border style">
                                    {BORDER_STYLES.map((s) => <option key={s} value={s}>{s || "solid"}</option>)}
                                </select>
                            </Row>
                            <Row label="Radius">
                                <input className={inputCls} value={cur.css.borderRadius ?? ""} onChange={(e) => setProp("borderRadius", e.target.value)} placeholder="12" />
                            </Row>
                        </Section>

                        <Section title="Text">
                            <Row label="Size">
                                <input className={inputCls} value={cur.css.fontSize ?? ""} onChange={(e) => setProp("fontSize", e.target.value)} placeholder="px" />
                                <select className={inputCls} value={cur.css.fontWeight ?? ""} onChange={(e) => setProp("fontWeight", e.target.value)} aria-label="Font weight">
                                    {WEIGHTS.map((w) => <option key={w} value={w}>{w || "weight"}</option>)}
                                </select>
                            </Row>
                            <Row label="Align">
                                <div className="flex gap-1">
                                    {ALIGNS.map((a) => (
                                        <button
                                            key={a}
                                            type="button"
                                            onClick={() => setProp("textAlign", cur.css.textAlign === a ? "" : a)}
                                            className={cx("rounded-md px-2 py-1 text-xs capitalize ring-1 transition-colors", cur.css.textAlign === a ? "text-brand-secondary ring-brand" : "text-tertiary ring-secondary hover:text-secondary")}
                                        >
                                            {a}
                                        </button>
                                    ))}
                                </div>
                            </Row>
                            <Row label="Spacing">
                                <input className={inputCls} value={cur.css.letterSpacing ?? ""} onChange={(e) => setProp("letterSpacing", e.target.value)} placeholder="letter-spacing" />
                            </Row>
                        </Section>

                        <Section title="Effects">
                            <Row label="Shadow">
                                <select className={inputCls} value={cur.css.boxShadow ?? ""} onChange={(e) => setProp("boxShadow", e.target.value)} aria-label="Shadow">
                                    {SHADOWS.map(([v, l]) => <option key={l} value={v}>{l}</option>)}
                                </select>
                            </Row>
                            <Row label="Opacity">
                                <input className={inputCls} value={cur.css.opacity ?? ""} onChange={(e) => setProp("opacity", e.target.value)} placeholder="0–1" />
                            </Row>
                        </Section>

                        <Section title="Spacing">
                            <Row label="Padding">
                                <input className={inputCls} value={cur.css.padding ?? ""} onChange={(e) => setProp("padding", e.target.value)} placeholder="px" />
                            </Row>
                        </Section>

                        <Section title="Custom CSS">
                            <textarea
                                value={cur.customCss}
                                onChange={(e) => setCustom(e.target.value)}
                                rows={4}
                                placeholder={"declarations, or rules with & = this element:\n& path { stroke-width: 3px }"}
                                className="w-full rounded-md bg-primary p-2 font-mono text-xs text-primary ring-1 ring-secondary outline-none focus:ring-2 focus:ring-brand"
                            />
                        </Section>
                    </div>
                )}
            </SlideoutMenu.Content>
            <SlideoutMenu.Footer>
                <div className="flex justify-end gap-2">
                    <Button color="secondary" size="md" onClick={close}>
                        Cancel
                    </Button>
                    <Button color="primary" size="md" onClick={save}>
                        Save changes
                    </Button>
                </div>
            </SlideoutMenu.Footer>
        </>
    );
}

export function WidgetEditorButton({ widget }: { widget: MipWidget }) {
    return (
        <SlideoutMenu.Trigger>
            <ButtonUtility color="tertiary" size="xs" icon={Edit03} tooltip="Edit widget" />
            <SlideoutMenu>{({ close }) => <EditorPanel widget={widget} close={close} />}</SlideoutMenu>
        </SlideoutMenu.Trigger>
    );
}
