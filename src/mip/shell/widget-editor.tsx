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
import { useSettings, type Connection, type ConnectionAuth } from "@/mip/settings/settings-store";
import { WIDGET_TYPES, type HttpMethod, type MipElementStyle, type MipWidget, type MipWidgetColors, type WidgetType } from "@/mip/schema";
import { testEndpoint } from "@/mip/api";
import { CELL_FORMATS } from "@/mip/adapters/untitled/format";
import { CELL_ANIMATIONS } from "@/mip/adapters/untitled/data";
import { cx } from "@/utils/cx";
import { buildHeaders, buildUrl } from "./use-widget-data";
import { widgetElements } from "./widget-chrome";

const prettyType = (t: string) => t.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

/** Content widgets — static body, no data mapping (markdown / diagrams / image). */
const DIAGRAM_TYPES = new Set(["flowchart", "sequenceDiagram", "mindmap", "timeline", "ganttChart"]);
const isDiagramType = (t: string) => DIAGRAM_TYPES.has(t);
const isContentType = (t: string) => t === "markdown" || t === "image" || isDiagramType(t);

/** Custom one-off auth modes (mirrors the legacy Postman editor). */
const AUTH_MODES = [
    { id: "none", label: "No auth" },
    { id: "bearer", label: "Bearer token" },
    { id: "apiKeyHeader", label: "API key (header)" },
    { id: "basic", label: "Basic auth" },
];

/** Flatten a tested response into JSONPath suggestions: array collections
 *  ($.path) plus a few leaf field names off the first array element / object,
 *  so the mapping inputs can offer autocomplete after a Test. */
function detectFields(data: unknown): { collections: string[]; fields: string[] } {
    const collections = new Set<string>();
    const fields = new Set<string>();
    const walk = (val: unknown, path: string, depth: number) => {
        if (depth > 4 || val == null) return;
        if (Array.isArray(val)) {
            collections.add(path || "$");
            const first = val[0];
            if (first && typeof first === "object" && !Array.isArray(first)) for (const k of Object.keys(first)) fields.add(k);
            return;
        }
        if (typeof val === "object") {
            for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
                const next = path ? `${path}.${k}` : `$.${k}`;
                if (v != null && typeof v !== "object") fields.add(next);
                walk(v, next, depth + 1);
            }
        }
    };
    walk(data, "$", 0);
    return { collections: [...collections], fields: [...fields] };
}

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
/** A table/detail column row in the editor. */
interface ColRow {
    id: string;
    key: string;
    label: string;
    format: string;
    animation: string;
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
    const { connections, getConnection, addConnection } = useSettings();
    const pages = state.pages;
    const [tab, setTab] = useState<EditorTab>("settings");

    // The page this widget actually lives on (so Move-to-page and delete target
    // the right page even if the active page changed under the slideout).
    const currentPage = useMemo(() => pages.find((p) => p.widgets.some((w) => w.id === widget.id)) ?? activePage, [pages, activePage, widget.id]);
    const dashboardPages = useMemo(() => pages.filter((p) => (p.kind ?? "dashboard") === "dashboard"), [pages]);

    const [title, setTitle] = useState(widget.title ?? "");
    const [widgetType, setWidgetType] = useState<WidgetType>(widget.type);

    // Data source / live request. sourceId "" = inline · "__custom" = ad-hoc REST.
    const boundReq = widget.data?.request;
    const [sourceId, setSourceId] = useState<string>(widget.data?.sourceId ?? "");
    const [method, setMethod] = useState<string>(boundReq?.method ?? "GET");
    const [path, setPath] = useState<string>(boundReq?.path ?? "");
    const [paramRows, setParamRows] = useState<KV[]>(recordToRows(boundReq?.params as Record<string, unknown> | undefined));
    const [headerRows, setHeaderRows] = useState<KV[]>(recordToRows(boundReq?.headers));
    const [bodyText, setBodyText] = useState(boundReq?.body != null ? JSON.stringify(boundReq.body, null, 2) : "");
    const isCustom = sourceId === "__custom";
    const isContent = isContentType(widget.type);

    // Custom one-off REST source — base URL + auth, built into a saved Connection
    // on save and bound to the widget (mirrors the legacy Postman editor).
    const [customBaseUrl, setCustomBaseUrl] = useState("");
    const [customAuthMode, setCustomAuthMode] = useState("none");
    const [customToken, setCustomToken] = useState("");
    const [customKeyName, setCustomKeyName] = useState("");
    const [customKeyValue, setCustomKeyValue] = useState("");
    const [customUser, setCustomUser] = useState("");
    const [customPass, setCustomPass] = useState("");
    const buildCustomAuth = (): ConnectionAuth => {
        if (customAuthMode === "bearer") return { type: "bearer", token: customToken };
        if (customAuthMode === "apiKeyHeader") return { type: "apiKeyHeader", keyName: customKeyName, keyValue: customKeyValue };
        if (customAuthMode === "basic") return { type: "basic", username: customUser, password: customPass };
        return { type: "none" };
    };

    // Test / Load fields — run the live request and surface response paths as
    // autocomplete suggestions (a shared <datalist>) for the mapping inputs.
    const [detected, setDetected] = useState<string[]>([]);
    const [testing, setTesting] = useState(false);
    const [testMsg, setTestMsg] = useState<string | null>(null);
    const fieldsListId = `wf-${widget.id}`;

    // Content widgets — markdown body / diagram source / image url+alt.
    const [contentText, setContentText] = useState(() =>
        isDiagramType(widget.type)
            ? typeof widget.settings?.source === "string" ? widget.settings.source : ""
            : typeof widget.settings?.content === "string" ? widget.settings.content : typeof widget.settings?.markdown === "string" ? widget.settings.markdown : "",
    );
    const [imageUrl, setImageUrl] = useState(typeof widget.settings?.url === "string" ? widget.settings.url : typeof widget.settings?.src === "string" ? widget.settings.src : "");
    const [imageAlt, setImageAlt] = useState(typeof widget.settings?.alt === "string" ? widget.settings.alt : "");

    // Table / detail columns — key + label + per-column format + animation.
    const initialColumns = (Array.isArray(widget.settings?.columns) ? widget.settings.columns : Array.isArray(widget.settings?.fields) ? widget.settings.fields : []) as unknown[];
    const [columnRows, setColumnRows] = useState<ColRow[]>(() =>
        initialColumns.map((c) => {
            if (typeof c === "string") return { id: kvId(), key: c, label: c, format: "auto", animation: "none" };
            const r = c as Record<string, unknown>;
            return { id: kvId(), key: String(r.key ?? ""), label: String(r.label ?? r.key ?? ""), format: String(r.format ?? "auto"), animation: String(r.animation ?? "none") };
        }),
    );

    /** Settings keys owned by a dedicated editor — excluded from custom/advanced. */
    const ownedKeys = useMemo(() => {
        const s = new Set<string>(MAPPING_SETTINGS_KEYS);
        // Footer citation fields are edited by dedicated inputs.
        s.add("caption");
        s.add("captionHref");
        s.add("description");
        s.add("source");
        if (widget.type === "table") s.add("columns");
        if (widget.type === "detail") { s.add("fields"); s.add("columns"); }
        if (widget.type === "markdown") { s.add("content"); s.add("markdown"); }
        if (isDiagramType(widget.type)) s.add("source");
        if (widget.type === "image") { s.add("url"); s.add("src"); s.add("alt"); }
        return s;
    }, [widget.type]);

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
            .filter(([k, v]) => !ownedKeys.has(k) && (typeof v === "string" || typeof v === "number" || typeof v === "boolean"))
            .map(([key, value]) => ({ id: kvId(), key, value: String(value) })),
    );
    const [customOpen, setCustomOpen] = useState(false);
    // Advanced — the COMPLEX (object/array) settings not owned by a dedicated
    // editor (chart points, list inline data, featureGrid features…). Editable so
    // inline (non-bound) data widgets aren't read-only.
    const [advancedText, setAdvancedText] = useState(() => {
        const complex = Object.fromEntries(Object.entries(widget.settings ?? {}).filter(([k, v]) => v != null && typeof v === "object" && !ownedKeys.has(k)));
        return Object.keys(complex).length ? JSON.stringify(complex, null, 2) : "";
    });
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [targetPageId, setTargetPageId] = useState(currentPage.id);

    // Footer — citation (source) text + link, and a "Link to page" that shows a
    // Read-more pointing at another dashboard (stored as details.route = page id).
    const [captionText, setCaptionText] = useState(() => {
        const c = widget.settings?.caption ?? widget.settings?.description ?? widget.settings?.source;
        return typeof c === "string" ? c : "";
    });
    const [captionHref, setCaptionHref] = useState(typeof widget.settings?.captionHref === "string" ? widget.settings.captionHref : "");
    const [linkPageId, setLinkPageId] = useState(typeof widget.details?.route === "string" ? widget.details.route : "");
    const linkablePages = useMemo(() => dashboardPages.filter((p) => p.id !== currentPage.id), [dashboardPages, currentPage.id]);

    // Run the live request now and detect response fields for autocomplete.
    const runTest = async () => {
        setTesting(true);
        setTestMsg(null);
        const conn: Connection = isCustom
            ? { id: "__test", name: "test", type: "rest", baseUrl: customBaseUrl, auth: buildCustomAuth(), headers: headerRows.map((r) => ({ key: r.key, value: r.value })) }
            : getConnection(sourceId) ?? { id: "__test", name: "test", type: "rest" };
        const url = buildUrl(conn, path, rowsToRecord(paramRows));
        const headers = buildHeaders(conn, rowsToRecord(headerRows));
        let body: unknown;
        try {
            body = bodyText.trim() ? JSON.parse(bodyText) : undefined;
        } catch {
            /* ignore — send no body if it isn't valid JSON */
        }
        const res = await testEndpoint({ method, url, headers, body });
        setTesting(false);
        if (res.ok) {
            const det = detectFields(res.body);
            setDetected([...det.collections, ...det.fields]);
            setTestMsg(`OK — ${det.collections.length} collection(s), ${det.fields.length} field(s) detected.`);
            const collSlot = slots.find((s) => s.target === "map" && ["series", "items", "rows", "record"].includes(s.key));
            if (collSlot && !(slotValues[collSlot.key] ?? "").trim() && det.collections[0]) setSlot(collSlot.key, det.collections[0]);
        } else {
            setDetected([]);
            setTestMsg(typeof res.error === "string" ? res.error : `Request failed (${res.status ?? "?"}).`);
        }
    };

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
        // Dedicated content editors → settings.
        if (widget.type === "markdown") {
            if (contentText.trim()) settings.content = contentText;
            else delete settings.content;
            delete settings.markdown;
        } else if (isDiagramType(widget.type)) {
            if (contentText.trim()) settings.source = contentText;
            else delete settings.source;
        } else if (widget.type === "image") {
            if (imageUrl.trim()) settings.url = imageUrl.trim();
            else delete settings.url;
            delete settings.src;
            if (imageAlt.trim()) settings.alt = imageAlt.trim();
            else delete settings.alt;
        }
        // Table / detail columns (key + label + format + animation).
        if (widgetType === "table" || widgetType === "detail") {
            const cols = columnRows
                .filter((c) => c.key.trim())
                .map((c) => ({
                    key: c.key.trim(),
                    label: c.label.trim() || c.key.trim(),
                    ...(c.format && c.format !== "auto" ? { format: c.format } : {}),
                    ...(c.animation && c.animation !== "none" ? { animation: c.animation } : {}),
                }));
            const colKey = widgetType === "detail" ? "fields" : "columns";
            if (cols.length) settings[colKey] = cols;
            else delete settings[colKey];
        }
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
        // Footer citation (source) — write the dedicated fields; clear stale aliases.
        delete settings.description;
        delete settings.source;
        if (captionText.trim()) settings.caption = captionText.trim();
        else delete settings.caption;
        if (captionHref.trim()) settings.captionHref = captionHref.trim();
        else delete settings.captionHref;
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
        // A custom one-off becomes a real saved Connection so the widget can read
        // it live just like any other binding.
        const params = rowsToRecord(paramRows);
        const headers = rowsToRecord(headerRows);
        const effSourceId =
            isBound && isCustom
                ? addConnection({ name: title.trim() || prettyType(widgetType), type: "rest", baseUrl: customBaseUrl.trim() || undefined, auth: buildCustomAuth(), headers: [], endpoints: [] })
                : sourceId;
        const data = isBound
            ? {
                  sourceId: effSourceId,
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
        // Link to page → details.route (target page id) for the footer's Read more.
        const details = linkPageId ? { ...widget.details, route: linkPageId } : undefined;
        const patch: Partial<MipWidget> = {
            title: title.trim() || undefined,
            type: widgetType,
            settings,
            data,
            details,
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
                        {/* Autocomplete suggestions for mapping/column inputs after a Test. */}
                        {detected.length ? (
                            <datalist id={fieldsListId}>
                                {detected.map((d) => (
                                    <option key={d} value={d} />
                                ))}
                            </datalist>
                        ) : null}

                        <Input label="Name" value={title} onChange={setTitle} placeholder="Widget name" />

                        {isContent ? (
                            /* Content widgets — markdown body / diagram source / image. */
                            <Section title={widget.type === "image" ? "Image" : isDiagramType(widget.type) ? "Diagram" : "Content"}>
                                {widget.type === "image" ? (
                                    <>
                                        <Input label="Image URL" value={imageUrl} onChange={setImageUrl} placeholder="https://… or data:image/…" />
                                        <Input label="Alt text" value={imageAlt} onChange={setImageAlt} placeholder="Describe the image for accessibility" />
                                        {imageUrl.trim() && /^(https?:|data:image\/)/i.test(imageUrl.trim()) ? (
                                            <img src={imageUrl.trim()} alt={imageAlt || "Preview"} className="max-h-40 w-full rounded-lg object-cover ring-1 ring-secondary" />
                                        ) : null}
                                    </>
                                ) : (
                                    <TextArea
                                        label={isDiagramType(widget.type) ? "Diagram source (Mermaid)" : "Content (Markdown)"}
                                        hint={isDiagramType(widget.type) ? "Mermaid syntax — rendered as a diagram on save." : "Markdown — headings (#), **bold**, and - lists."}
                                        value={contentText}
                                        onChange={setContentText}
                                        rows={12}
                                        textAreaClassName={cx(isDiagramType(widget.type) && "font-mono text-xs")}
                                    />
                                )}
                            </Section>
                        ) : (
                            <>
                                {isDataType(widget.type) ? (
                                    <Select label="Widget" aria-label="Widget type" selectedKey={widgetType} items={DATA_WIDGET_TYPES.map((t) => ({ id: t, label: prettyType(t) }))} onSelectionChange={(k) => setWidgetType(String(k) as WidgetType)}>
                                        {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                                    </Select>
                                ) : null}

                                <Select
                                    label="Data source"
                                    aria-label="Data source"
                                    selectedKey={sourceId === "" ? "__inline" : sourceId}
                                    items={[
                                        { id: "__inline", label: "Inline (no live data)" },
                                        { id: "__custom", label: "Custom one-off (REST)" },
                                        ...connections.map((c) => ({ id: c.id, label: c.name })),
                                        ...(sourceId && sourceId !== "__custom" && !connections.some((c) => c.id === sourceId) ? [{ id: sourceId, label: `${sourceId} (current)` }] : []),
                                    ]}
                                    onSelectionChange={(k) => { const v = String(k); setSourceId(v === "__inline" ? "" : v); setDetected([]); setTestMsg(null); setError(null); }}
                                >
                                    {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                                </Select>

                                {isCustom ? (
                                    <Section title="Custom source">
                                        <Input label="Base URL" value={customBaseUrl} onChange={setCustomBaseUrl} placeholder="https://api.example.com" />
                                        <Select label="Auth" aria-label="Auth mode" selectedKey={customAuthMode} items={AUTH_MODES} onSelectionChange={(k) => setCustomAuthMode(String(k))}>
                                            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                                        </Select>
                                        {customAuthMode === "bearer" ? <Input label="Token" value={customToken} onChange={setCustomToken} placeholder="Bearer token" /> : null}
                                        {customAuthMode === "apiKeyHeader" ? (
                                            <>
                                                <Input label="Header name" value={customKeyName} onChange={setCustomKeyName} placeholder="X-API-Key" />
                                                <Input label="Header value" value={customKeyValue} onChange={setCustomKeyValue} placeholder="key…" />
                                            </>
                                        ) : null}
                                        {customAuthMode === "basic" ? (
                                            <>
                                                <Input label="Username" value={customUser} onChange={setCustomUser} />
                                                <Input label="Password" value={customPass} onChange={setCustomPass} />
                                            </>
                                        ) : null}
                                    </Section>
                                ) : null}

                                {isBound ? (
                                    <>
                                        {/* Request — method / path / params / headers / body / test. */}
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
                                            <div className="flex items-center gap-2">
                                                <Button color="secondary" size="sm" onClick={runTest} isLoading={testing} isDisabled={testing}>
                                                    Test / Load fields
                                                </Button>
                                                {testMsg ? <span className="text-xs text-tertiary">{testMsg}</span> : null}
                                            </div>
                                        </Section>

                                        {/* Field mapping — structured per widget type. */}
                                        {slots.length ? (
                                            <Section title="Field mapping">
                                                {slots.map((s) => (
                                                    <Row key={s.key} label={s.label}>
                                                        <input
                                                            className={inputCls}
                                                            list={fieldsListId}
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

                                {/* Columns — table & detail (key · label · format · animation). */}
                                {widgetType === "table" || widgetType === "detail" ? (
                                    <Section title={widgetType === "detail" ? "Fields" : "Columns"}>
                                        {columnRows.map((c) => (
                                            <div key={c.id} className="flex flex-col gap-1.5 rounded-md bg-secondary p-2 ring-1 ring-secondary">
                                                <div className="flex items-center gap-1.5">
                                                    <input className={inputCls} list={fieldsListId} value={c.key} placeholder="field key" onChange={(e) => setColumnRows((rows) => rows.map((r) => (r.id === c.id ? { ...r, key: e.target.value } : r)))} />
                                                    <input className={inputCls} value={c.label} placeholder="Label" onChange={(e) => setColumnRows((rows) => rows.map((r) => (r.id === c.id ? { ...r, label: e.target.value } : r)))} />
                                                    <button type="button" aria-label="Remove column" onClick={() => setColumnRows((rows) => rows.filter((r) => r.id !== c.id))} className="shrink-0 rounded-md p-1.5 text-tertiary hover:text-error-primary">
                                                        <Minus className="size-3.5" />
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <select className={inputCls} aria-label="Format" value={c.format} onChange={(e) => setColumnRows((rows) => rows.map((r) => (r.id === c.id ? { ...r, format: e.target.value } : r)))}>
                                                        {CELL_FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                                                    </select>
                                                    <select className={inputCls} aria-label="Animation" value={c.animation} onChange={(e) => setColumnRows((rows) => rows.map((r) => (r.id === c.id ? { ...r, animation: e.target.value } : r)))}>
                                                        {CELL_ANIMATIONS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        ))}
                                        <button type="button" onClick={() => setColumnRows((rows) => [...rows, { id: kvId(), key: "", label: "", format: "auto", animation: "none" }])} className="flex w-fit items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-tertiary ring-1 ring-dashed ring-secondary hover:text-secondary">
                                            <Plus className="size-3" /> Add column
                                        </button>
                                        <p className="text-xs text-tertiary">Leave empty to auto-infer columns from the data.</p>
                                    </Section>
                                ) : null}
                            </>
                        )}

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

                        {/* Footer — source citation + Read-more page link. */}
                        <Section title="Footer">
                            <Input label="Source / citation" value={captionText} onChange={setCaptionText} placeholder="e.g. Statista, 2025" />
                            <Input label="Source link (URL)" value={captionHref} onChange={setCaptionHref} placeholder="https://… (shown as a citation link)" />
                            <Select
                                label="Link to page (Read more)"
                                aria-label="Link to page"
                                selectedKey={linkPageId || "__none"}
                                items={[{ id: "__none", label: "No linked page" }, ...linkablePages.map((p) => ({ id: p.id, label: p.title }))]}
                                onSelectionChange={(k) => setLinkPageId(String(k) === "__none" ? "" : String(k))}
                            >
                                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                            </Select>
                            <p className="text-xs text-tertiary">The footer shows only when a source or a linked page is set.</p>
                        </Section>

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
