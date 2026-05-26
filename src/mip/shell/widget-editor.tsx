/**
 * Widget editor — Untitled UI slide-out with two tabs:
 *   · Settings — title, settings JSON, and (for data-bound widgets) auto-refresh.
 *   · Design   — a compact, Figma-style inspector: Color (text/sub-text/accent),
 *                Fill, Stroke (color/width/style/radius), Text (size/weight/
 *                align/spacing), Effects (shadow/opacity), Spacing (padding), and
 *                a raw Custom CSS block. Writes to widget.style (colors / css /
 *                customCss); empty fields inherit the theme.
 */

import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Edit03, Minus, Plus, Settings01, Trash01 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { TextArea } from "@/components/base/textarea/textarea";
import { SlideoutMenu } from "@/components/application/slideout-menus/slideout-menu";
import { COLOR_TOKEN_GROUPS } from "@/mip/design-tokens";
import { useDashboard } from "@/mip/store";
import { useSettings } from "@/mip/settings/settings-store";
import { WIDGET_TYPES, type HttpMethod, type MipElementStyle, type MipWidget, type MipWidgetColors, type WidgetType } from "@/mip/schema";
import { cx } from "@/utils/cx";
import { widgetElements } from "./widget-chrome";

const prettyType = (t: string) => t.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

/** Data-bearing widget types — the ones that can bind to a connection + carry a
 *  field mapping. Mirrors the legacy DataConnectionModal's DATA_WIDGET_TYPES. */
const DATA_WIDGET_TYPES = WIDGET_TYPES.filter((t) =>
    ["kpi", "progress", "lineChart", "barChart", "areaChart", "pieChart", "donutChart", "table", "list", "detail"].includes(t),
) as WidgetType[];
const isDataType = (t: string): t is WidgetType => (DATA_WIDGET_TYPES as readonly string[]).includes(t);

/** One field-mapping slot. `target:"map"` writes a JSONPath into widget.data.map
 *  (collection / value paths the renderer fetches); `target:"settings"` writes a
 *  bare field name into widget.settings (the key the renderer reads off each row). */
interface MapSlot {
    key: string;
    label: string;
    target: "map" | "settings";
    placeholder: string;
}
const CHART_SLOTS: MapSlot[] = [
    { key: "series", label: "Series", target: "map", placeholder: "$.data" },
    { key: "labelKey", label: "Label field", target: "settings", placeholder: "label" },
    { key: "valueKey", label: "Value field", target: "settings", placeholder: "value" },
];
/** Per-type field-mapping slots. Used to render the structured mapping editor. */
const MAPPING_SLOTS: Partial<Record<WidgetType, MapSlot[]>> = {
    kpi: [
        { key: "value", label: "Value", target: "map", placeholder: "$.value" },
        { key: "delta", label: "Delta", target: "map", placeholder: "$.change" },
    ],
    progress: [
        { key: "value", label: "Value", target: "map", placeholder: "$.value" },
        { key: "max", label: "Max", target: "map", placeholder: "$.max" },
    ],
    lineChart: CHART_SLOTS,
    barChart: CHART_SLOTS,
    areaChart: CHART_SLOTS,
    pieChart: CHART_SLOTS,
    donutChart: CHART_SLOTS,
    list: [
        { key: "items", label: "Items", target: "map", placeholder: "$.data" },
        { key: "primaryKey", label: "Primary field", target: "settings", placeholder: "name" },
        { key: "secondaryKey", label: "Secondary field", target: "settings", placeholder: "email" },
        { key: "valueKey", label: "Value field", target: "settings", placeholder: "amount" },
    ],
    table: [{ key: "rows", label: "Rows", target: "map", placeholder: "$.data" }],
    detail: [{ key: "record", label: "Record", target: "map", placeholder: "$.data" }],
};

/** Settings keys the mapping editor owns — excluded from the free-form custom
 *  settings list so they aren't edited in two places. */
const MAPPING_SETTINGS_KEYS = new Set(
    Object.values(MAPPING_SLOTS)
        .flat()
        .filter((s): s is MapSlot => !!s && s.target === "settings")
        .map((s) => s.key),
);

interface KV {
    id: string;
    key: string;
    value: string;
}
const kvId = () => Math.random().toString(36).slice(2);
const recordToRows = (rec?: Record<string, unknown>): KV[] =>
    rec ? Object.entries(rec).map(([key, value]) => ({ id: kvId(), key, value: typeof value === "string" ? value : JSON.stringify(value) })) : [];
const rowsToRecord = (rows: KV[]): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const r of rows) if (r.key.trim()) out[r.key.trim()] = r.value;
    return out;
};

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

/** A repeatable key/value rows editor — used for query params, headers, and the
 *  collapsible custom settings (mirrors the legacy modal's key-value rows). */
function KeyValueRows({ rows, onChange, keyPlaceholder = "Key", valuePlaceholder = "Value" }: { rows: KV[]; onChange: (rows: KV[]) => void; keyPlaceholder?: string; valuePlaceholder?: string }) {
    const set = (id: string, patch: Partial<KV>) => onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    return (
        <div className="flex flex-col gap-1.5">
            {rows.map((r) => (
                <div key={r.id} className="flex items-center gap-1.5">
                    <input className={inputCls} value={r.key} placeholder={keyPlaceholder} onChange={(e) => set(r.id, { key: e.target.value })} />
                    <input className={inputCls} value={r.value} placeholder={valuePlaceholder} onChange={(e) => set(r.id, { value: e.target.value })} />
                    <button type="button" aria-label="Remove row" onClick={() => onChange(rows.filter((x) => x.id !== r.id))} className="shrink-0 rounded-md p-1.5 text-tertiary hover:text-error-primary">
                        <Minus className="size-3.5" />
                    </button>
                </div>
            ))}
            <button type="button" onClick={() => onChange([...rows, { id: kvId(), key: "", value: "" }])} className="flex w-fit items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-tertiary ring-1 ring-dashed ring-secondary hover:text-secondary">
                <Plus className="size-3" /> Add
            </button>
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
    const { updateWidget, removeWidget, addWidget, state, activePage } = useDashboard();
    const { connections } = useSettings();
    const pages = state.pages;
    const [tab, setTab] = useState<EditorTab>("settings");

    // The page this widget actually lives on (so Move-to-page and delete target
    // the right page even if the active page changed under the slideout).
    const currentPage = useMemo(() => pages.find((p) => p.widgets.some((w) => w.id === widget.id)) ?? activePage, [pages, activePage, widget.id]);
    const dashboardPages = useMemo(() => pages.filter((p) => (p.kind ?? "dashboard") === "dashboard"), [pages]);

    const [title, setTitle] = useState(widget.title ?? "");
    const [widgetType, setWidgetType] = useState<WidgetType>(widget.type);

    // Data source / live request. sourceId "" = inline (no connection).
    const boundReq = widget.data?.request;
    const [sourceId, setSourceId] = useState<string>(widget.data?.sourceId ?? "");
    const [method, setMethod] = useState<string>(boundReq?.method ?? "GET");
    const [path, setPath] = useState<string>(boundReq?.path ?? "");
    const [paramRows, setParamRows] = useState<KV[]>(recordToRows(boundReq?.params as Record<string, unknown> | undefined));
    const [headerRows, setHeaderRows] = useState<KV[]>(recordToRows(boundReq?.headers));
    const [bodyText, setBodyText] = useState(boundReq?.body != null ? JSON.stringify(boundReq.body, null, 2) : "");

    // Structured field-mapping: one input per slot for the active widget type.
    const slots = MAPPING_SLOTS[widgetType] ?? [];
    const [slotValues, setSlotValues] = useState<Record<string, string>>(() => {
        const out: Record<string, string> = {};
        for (const list of Object.values(MAPPING_SLOTS)) {
            for (const s of list ?? []) {
                const v = s.target === "map" ? widget.data?.map?.[s.key] : widget.settings?.[s.key];
                if (typeof v === "string") out[s.key] = v;
            }
        }
        return out;
    });
    const setSlot = (key: string, v: string) => setSlotValues((s) => ({ ...s, [key]: v }));

    // Free-form custom settings (collapsible) — scalar settings not owned by a
    // mapping slot. Complex (object/array) settings are preserved untouched.
    const [customRows, setCustomRows] = useState<KV[]>(() =>
        Object.entries(widget.settings ?? {})
            .filter(([k, v]) => !MAPPING_SETTINGS_KEYS.has(k) && (typeof v === "string" || typeof v === "number" || typeof v === "boolean"))
            .map(([key, value]) => ({ id: kvId(), key, value: String(value) })),
    );
    const [customOpen, setCustomOpen] = useState(false);
    // Advanced — the COMPLEX (object/array) settings that the key-value editor
    // can't represent: chart points, table rows/columns, list/detail inline data,
    // markdown content, featureGrid features. Editable so inline (non-bound) data
    // widgets aren't read-only.
    const [advancedText, setAdvancedText] = useState(() => {
        const complex = Object.fromEntries(Object.entries(widget.settings ?? {}).filter(([, v]) => v != null && typeof v === "object"));
        return Object.keys(complex).length ? JSON.stringify(complex, null, 2) : "";
    });
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [targetPageId, setTargetPageId] = useState(currentPage.id);

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

    const isBound = !!sourceId;
    const cur = elStyles[activeEl]!;
    const setColor = (key: keyof MipWidgetColors, v: string) =>
        setElStyles((s) => ({ ...s, [activeEl]: { ...s[activeEl]!, colors: { ...s[activeEl]!.colors, [key]: v } } }));
    const setProp = (key: string, v: string) =>
        setElStyles((s) => ({ ...s, [activeEl]: { ...s[activeEl]!, css: { ...s[activeEl]!.css, [key]: v } } }));
    const setCustom = (v: string) => setElStyles((s) => ({ ...s, [activeEl]: { ...s[activeEl]!, customCss: v } }));

    const save = () => {
        // Complex (object/array) settings — chart points, table rows/columns,
        // featureGrid features, markdown content — come from the editable Advanced
        // JSON block; the scalar custom settings + mapping field-keys layer on top.
        let settings: Record<string, unknown> = {};
        if (advancedText.trim()) {
            try {
                const parsed = JSON.parse(advancedText);
                if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) settings = parsed as Record<string, unknown>;
            } catch (err) {
                setError(`Advanced settings: ${err instanceof Error ? err.message : "Invalid JSON"}`);
                setTab("settings");
                return;
            }
        }
        for (const r of customRows) if (r.key.trim()) settings[r.key.trim()] = r.value;
        // Bound request body (only the body field is raw JSON now).
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
            map = {};
            for (const s of slots) {
                const v = (slotValues[s.key] ?? "").trim();
                if (!v) continue;
                if (s.target === "map") map[s.key] = v;
                else settings[s.key] = v;
            }
            if (!Object.keys(map).length) map = undefined;
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
        // Build the live binding from the selected source (or drop it when inline).
        const params = rowsToRecord(paramRows);
        const headers = rowsToRecord(headerRows);
        const data = isBound
            ? {
                  sourceId,
                  request: {
                      method: method as HttpMethod,
                      path: path.trim() || boundReq?.path || "/",
                      ...(Object.keys(params).length ? { params } : {}),
                      ...(Object.keys(headers).length ? { headers } : {}),
                      ...(body !== undefined ? { body } : {}),
                  },
                  ...(map ? { map } : {}),
                  ...(ms ? { refreshMs: ms } : {}),
              }
            : undefined;
        const patch: Partial<MipWidget> = {
            title: title.trim() || undefined,
            type: widgetType,
            settings,
            data,
            style: {
                ...widget.style,
                borderColor: undefined,
                backgroundColor: undefined,
                colors: cleanColors(card.colors),
                css: cleanCss(card.css),
                customCss: card.customCss.trim() || undefined,
                elements: Object.keys(elements).length ? elements : undefined,
            },
        };
        // Move to another page = remove from the current page + add to the target.
        if (targetPageId !== currentPage.id) {
            removeWidget(widget.id, currentPage.id);
            addWidget({ ...widget, ...patch }, targetPageId);
        } else {
            updateWidget(widget.id, patch, currentPage.id);
        }
        close();
    };

    const onDelete = () => {
        removeWidget(widget.id, currentPage.id);
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
                    <div className="flex flex-col gap-5">
                        <Input label="Name" value={title} onChange={setTitle} placeholder="Widget name" />

                        {isDataType(widget.type) ? (
                            <Select label="Widget" aria-label="Widget type" selectedKey={widgetType} items={DATA_WIDGET_TYPES.map((t) => ({ id: t, label: prettyType(t) }))} onSelectionChange={(k) => setWidgetType(String(k) as WidgetType)}>
                                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                            </Select>
                        ) : null}

                        <Select
                            label="Data source"
                            aria-label="Data source"
                            selectedKey={sourceId || "__inline"}
                            items={[{ id: "__inline", label: "Inline (no live data)" }, ...connections.map((c) => ({ id: c.id, label: c.name }))]}
                            onSelectionChange={(k) => { setSourceId(String(k) === "__inline" ? "" : String(k)); setError(null); }}
                        >
                            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                        </Select>

                        {isBound ? (
                            <>
                                {/* Request — method / path / params / headers / body. */}
                                <Section title="Request">
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
                                    <div className="flex flex-col gap-1.5">
                                        <span className="text-xs font-medium text-secondary">Query params</span>
                                        <KeyValueRows rows={paramRows} onChange={setParamRows} keyPlaceholder="param" valuePlaceholder="value" />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <span className="text-xs font-medium text-secondary">Headers</span>
                                        <KeyValueRows rows={headerRows} onChange={setHeaderRows} keyPlaceholder="Header" valuePlaceholder="value" />
                                    </div>
                                    {method !== "GET" ? (
                                        <TextArea
                                            label="Body (JSON)"
                                            hint="Sent with POST/PUT/PATCH. Leave blank for none."
                                            value={bodyText}
                                            onChange={(next) => { setBodyText(next); setError(null); }}
                                            rows={5}
                                            textAreaClassName="font-mono text-xs"
                                        />
                                    ) : null}
                                </Section>

                                {/* Field mapping — structured per widget type. */}
                                {slots.length ? (
                                    <Section title="Field mapping">
                                        {slots.map((s) => (
                                            <Row key={s.key} label={s.label}>
                                                <input
                                                    className={inputCls}
                                                    value={slotValues[s.key] ?? ""}
                                                    placeholder={s.placeholder}
                                                    onChange={(e) => { setSlot(s.key, e.target.value); setError(null); }}
                                                />
                                            </Row>
                                        ))}
                                        <p className="text-xs text-tertiary">
                                            Paths (e.g. <span className="font-mono">$.data</span>) point into the response; field names (e.g. <span className="font-mono">label</span>) are read off each row.
                                        </p>
                                    </Section>
                                ) : null}

                                <div className="flex flex-col gap-1.5">
                                    <span className="text-sm font-medium text-secondary">Auto-refresh</span>
                                    <Select aria-label="Auto-refresh interval" selectedKey={refreshMs} items={REFRESH_OPTIONS} onSelectionChange={(k) => setRefreshMs(String(k))}>
                                        {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                                    </Select>
                                    <span className="text-xs text-tertiary">Re-fetch this widget's live data on an interval. Off by default.</span>
                                </div>
                            </>
                        ) : null}

                        {/* Widget custom settings — collapsible key/value (legacy parity). */}
                        <div className="rounded-lg ring-1 ring-secondary">
                            <button
                                type="button"
                                onClick={() => setCustomOpen((o) => !o)}
                                className="flex w-full items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-primary"
                            >
                                {customOpen ? <ChevronDown className="size-4 text-tertiary" /> : <ChevronRight className="size-4 text-tertiary" />}
                                <Settings01 className="size-4 text-tertiary" />
                                Widget settings
                                {customRows.length ? <span className="text-xs text-tertiary">({customRows.length})</span> : null}
                            </button>
                            {customOpen ? (
                                <div className="flex flex-col gap-2 border-t border-secondary px-3 py-3">
                                    <p className="text-xs text-tertiary">Formatting &amp; labels (not data) — e.g. valueFormat, unit, deltaLabel. Strings only.</p>
                                    <KeyValueRows rows={customRows} onChange={setCustomRows} />
                                </div>
                            ) : null}
                        </div>

                        {/* Advanced — complex/inline data (chart points, table rows, etc.). */}
                        <div className="rounded-lg ring-1 ring-secondary">
                            <button
                                type="button"
                                onClick={() => setAdvancedOpen((o) => !o)}
                                className="flex w-full items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-primary"
                            >
                                {advancedOpen ? <ChevronDown className="size-4 text-tertiary" /> : <ChevronRight className="size-4 text-tertiary" />}
                                <Settings01 className="size-4 text-tertiary" />
                                Advanced data (JSON)
                            </button>
                            {advancedOpen ? (
                                <div className="flex flex-col gap-2 border-t border-secondary px-3 py-3">
                                    <p className="text-xs text-tertiary">Inline / complex settings this widget renders — e.g. chart points, table rows &amp; columns, list items, markdown content. Must be a valid JSON object.</p>
                                    <textarea
                                        value={advancedText}
                                        onChange={(e) => { setAdvancedText(e.target.value); setError(null); }}
                                        rows={10}
                                        placeholder="{\n  \n}"
                                        spellCheck={false}
                                        className="w-full rounded-md bg-primary p-2 font-mono text-xs text-primary ring-1 ring-secondary outline-none focus:ring-2 focus:ring-brand"
                                    />
                                </div>
                            ) : null}
                        </div>

                        {/* Page settings. */}
                        {dashboardPages.length > 1 ? (
                            <Select label="Move to page" aria-label="Move to page" selectedKey={targetPageId} items={dashboardPages.map((p) => ({ id: p.id, label: p.title }))} onSelectionChange={(k) => setTargetPageId(String(k))}>
                                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                            </Select>
                        ) : null}

                        {error ? <p className="text-sm text-error-primary">{error}</p> : null}
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
                <div className="flex items-center justify-between gap-2">
                    <Button color="tertiary-destructive" size="md" iconLeading={Trash01} onClick={onDelete}>
                        Delete widget
                    </Button>
                    <div className="flex gap-2">
                        <Button color="secondary" size="md" onClick={close}>
                            Cancel
                        </Button>
                        <Button color="primary" size="md" onClick={save}>
                            Save changes
                        </Button>
                    </div>
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
