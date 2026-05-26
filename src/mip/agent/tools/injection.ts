/**
 * Injection tools — the two ways the agent puts a widget on the dashboard:
 *
 *   ① injectJson       — direct: the model supplies the data inline as `settings`.
 *   ② injectConnection — bound:  the widget reads live from a saved REST
 *                        connection (sourceId + request + map), refreshing via
 *                        useWidgetData.
 *
 * Both build a MipWidget from the catalog defaults for the type, then hand it to
 * the store's addWidget. `addWidget` is kept as a tolerant alias (data ⇒ bound,
 * else direct) so older prompt patterns keep working.
 */

import { DEFAULT_WIDGET_SETTINGS, WIDGET_TYPES, type MipWidget, type WidgetType } from "../../schema";
import { WIDGET_CATALOG, makeWidget } from "../../shell/widget-catalog";
import type { Tool, ToolContext, AgentOp, OpResult } from "../types";

const isWidgetType = (t: unknown): t is WidgetType => typeof t === "string" && (WIDGET_TYPES as readonly string[]).includes(t);
const prettyType = (t: string) => t.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

/** Widget types that carry data and therefore SHOULD bind to a connection when
 *  one is in play. Everything else (headers, text, CTAs, images…) is static and
 *  may always be added with injectJson, even in API mode. */
const BINDABLE_TYPES = new Set(["kpi", "progress", "lineChart", "barChart", "areaChart", "pieChart", "donutChart", "table", "list", "detail"]);

/** Build a MipWidget from an op's {type,title,settings,w,h}. Size comes from the
 *  op if given, else the user's configured default for the type (Settings →
 *  Widgets); other defaults (example settings) come from the catalog. */
function buildWidget(op: AgentOp, ctx: ToolContext): MipWidget | { error: string } {
    if (!isWidgetType(op.type)) return { error: `Unknown widget type "${String(op.type)}". Valid types: ${WIDGET_TYPES.join(", ")}.` };
    const type = op.type;
    // A catalog entry isn't required — every WIDGET_TYPES type has a renderer.
    // Fall back to schema defaults for size/label/settings when uncatalogued.
    const base = WIDGET_CATALOG.find((c) => c.type === type);
    const size = ctx.widgetSize(type);
    // The catalog's `settings` are SAMPLE display values (e.g. kpi value:1234,
    // delta:5.2) meant for the widget-browser preview only. DEFAULT_WIDGET_SETTINGS
    // are STRUCTURAL (legend position, diagram source skeletons, etc.).
    //  · AI supplied settings → merge structural defaults only, NEVER the sample
    //    data — otherwise an omitted field (e.g. delta) silently inherits the mock
    //    5.2 in every widget.
    //  · AI supplied nothing  → fall back to the full sample so a bare add still
    //    renders something illustrative.
    const structural = DEFAULT_WIDGET_SETTINGS[type] ?? {};
    const sample = { ...(base?.settings ?? {}), ...structural };
    const hasOpSettings = op.settings != null && typeof op.settings === "object";
    const settings = hasOpSettings ? { ...structural, ...(op.settings as Record<string, unknown>) } : sample;
    return makeWidget({
        type,
        group: base?.group ?? "",
        label: typeof op.title === "string" ? op.title : (base?.label ?? prettyType(type)),
        w: typeof op.w === "number" ? op.w : size.w,
        h: typeof op.h === "number" ? op.h : size.h,
        ...(Object.keys(settings).length ? { settings } : {}),
        ...(base?.fields ? { fields: base.fields } : {}),
    });
}

type WidgetData = NonNullable<MipWidget["data"]>;
type WidgetRequest = WidgetData["request"];

/** Attach a live REST binding, normalizing sourceId to the real stored id. */
function bind(widget: MipWidget, op: AgentOp, ctx: ToolContext): { ok: true } | { error: string } {
    const rawData = (op.data && typeof op.data === "object" ? op.data : op) as Record<string, unknown>;
    const src = ctx.resolveConnection(rawData.sourceId);
    if (!src) return { error: `No connection matching "${String(rawData.sourceId)}". Call listConnections and use a returned id.` };
    const request: WidgetRequest =
        rawData.request && typeof rawData.request === "object"
            ? (rawData.request as WidgetRequest)
            : {
                  method: (typeof op.method === "string" ? op.method : "GET") as WidgetRequest["method"],
                  path: typeof op.path === "string" ? op.path : (src.endpoints?.[0]?.path ?? "/"),
                  ...(op.params ? { params: op.params as Record<string, unknown> } : {}),
              };
    widget.data = {
        sourceId: src.id,
        request,
        ...(rawData.map && typeof rawData.map === "object" ? { map: rawData.map as Record<string, string> } : {}),
        ...(typeof rawData.refreshMs === "number" ? { refreshMs: rawData.refreshMs } : {}),
    };
    return { ok: true };
}

const injectJson: Tool = {
    name: "injectJson",
    doc: "injectJson { type, title?, settings?, w?, h? } — add a widget with INLINE data (you provide settings). Use for one-off values you fetched/computed.",
    surfaces: ["dashboard"],
    mutating: true,
    validate: (op) => (isWidgetType(op.type) ? null : `injectJson needs a valid widget \`type\` (got "${String(op.type)}").`),
    run: async (op: AgentOp, ctx: ToolContext): Promise<OpResult> => {
        // Only DATA-bearing widgets need to bind to a connection. Static/utility
        // widgets (headers, text, CTAs, images…) are always fine as injectJson —
        // exempt them from the API-mode and strict-REST guards.
        const bindable = BINDABLE_TYPES.has(String(op.type));
        // Hard enforcement of the composer's API toggle (data widgets only).
        if (ctx.injectMode === "api" && bindable) {
            return {
                kind: op.kind,
                ok: false,
                error: "API injection mode is selected — do NOT use injectJson for data widgets. Bind with injectConnection to a saved connection (listConnections → callApi → injectConnection). If no connection fits, ask the user to add one in Settings → Apps.",
            };
        }
        // Strict REST: if a saved API was called this turn, a DATA widget MIGHT be
        // a snapshot of that API — nudge ONCE toward injectConnection. This is a
        // one-shot, non-fatal guard: we clear ctx.apiCalls when it fires so the
        // rest of a mixed web+API dashboard build (web-search-sourced KPIs/charts)
        // is NOT blocked. We can't tell web-search data from API data here, so we
        // refuse at most once rather than rejecting every data widget in the turn.
        // Relaxed entirely when the user forced JSON mode.
        const api = ctx.injectMode === "json" || !bindable ? undefined : ctx.apiCalls[ctx.apiCalls.length - 1];
        if (api) {
            ctx.apiCalls.length = 0; // one-shot: don't block subsequent data widgets
            return {
                kind: op.kind,
                ok: false,
                error: `Data from a saved API should bind live, not snapshot. If THIS widget's data came from the API "${api.sourceId}"${api.path ? `, path "${api.path}"` : ""}, re-emit it as injectConnection, e.g. {"kind":"injectConnection","type":"${String(op.type)}","sourceId":"${api.sourceId}","request":{"method":"GET","path":"${api.path ?? "/"}"},"map":{…}}. If this data came from web search / a fetch / values you were given (NOT that API), just re-emit the same injectJson and it will succeed.`,
            };
        }
        const widget = buildWidget(op, ctx);
        if ("error" in widget) return { kind: op.kind, ok: false, error: widget.error };
        ctx.addWidget(widget);
        return { kind: op.kind, ok: true, id: widget.id, type: widget.type, bound: false };
    },
};

const injectConnection: Tool = {
    name: "injectConnection",
    doc: "injectConnection { type, title?, sourceId, request:{method,path,params?}, map?, refreshMs?, settings?, w?, h? } — add a widget bound to a SAVED connection for LIVE data. map is JSONPath: charts→{series:\"$.arr\"}+settings.labelKey/valueKey, list→{items:\"$.arr\"}+settings.primaryKey, kpi→{value:\"$.x\",delta:\"$.y\"}.",
    surfaces: ["dashboard"],
    mutating: true,
    validate: (op) => {
        if (!isWidgetType(op.type)) return `injectConnection needs a valid widget \`type\` (got "${String(op.type)}").`;
        const sid = (op.data as { sourceId?: unknown } | undefined)?.sourceId ?? op.sourceId;
        return sid != null && String(sid).trim() ? null : "injectConnection needs a `sourceId` (the saved connection). Call listConnections first.";
    },
    run: async (op: AgentOp, ctx: ToolContext): Promise<OpResult> => {
        const widget = buildWidget(op, ctx);
        if ("error" in widget) return { kind: op.kind, ok: false, error: widget.error };
        const bound = bind(widget, op, ctx);
        if ("error" in bound) return { kind: op.kind, ok: false, error: bound.error };
        ctx.addWidget(widget);
        // This API's data is now bound live — drop its calls from the turn buffer so
        // the strict-REST guard doesn't later mistake a web-sourced widget for a
        // snapshot of it.
        if (widget.data?.sourceId) {
            const sid = widget.data.sourceId;
            ctx.apiCalls = ctx.apiCalls.filter((c) => c.sourceId !== sid);
        }
        return { kind: op.kind, ok: true, id: widget.id, type: widget.type, bound: true };
    },
};

/** Tolerant alias: `data` present ⇒ connection injection, else JSON injection. */
const addWidgetAlias: Tool = {
    name: "addWidget",
    doc: "addWidget { type, title?, settings?, data?, w?, h? } — alias: with `data` it binds to a connection (see injectConnection), without it injects inline JSON (see injectJson).",
    surfaces: ["dashboard"],
    mutating: true,
    run: async (op: AgentOp, ctx: ToolContext): Promise<OpResult> =>
        op.data && typeof op.data === "object" ? injectConnection.run(op, ctx) : injectJson.run(op, ctx),
};

export const injectionTools: Tool[] = [injectJson, injectConnection, addWidgetAlias];
