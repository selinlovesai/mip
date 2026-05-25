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

import type { MipWidget } from "../../schema";
import { WIDGET_CATALOG, makeWidget } from "../../shell/widget-catalog";
import type { Tool, ToolContext, AgentOp, OpResult } from "../types";

/** Build a MipWidget from an op's {type,title,settings,w,h}. Size comes from the
 *  op if given, else the user's configured default for the type (Settings →
 *  Widgets); other defaults (example settings) come from the catalog. */
function buildWidget(op: AgentOp, ctx: ToolContext): MipWidget | { error: string } {
    const type = op.type as MipWidget["type"];
    const base = WIDGET_CATALOG.find((c) => c.type === type);
    if (!base) return { error: `Unknown widget type "${String(type)}". Pick one from the documented list.` };
    const size = ctx.widgetSize(String(type));
    return makeWidget({
        ...base,
        ...(typeof op.title === "string" ? { label: op.title } : {}),
        w: typeof op.w === "number" ? op.w : size.w,
        h: typeof op.h === "number" ? op.h : size.h,
        ...(op.settings && typeof op.settings === "object" ? { settings: { ...base.settings, ...(op.settings as Record<string, unknown>) } } : {}),
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
    run: async (op: AgentOp, ctx: ToolContext): Promise<OpResult> => {
        // Strict REST: if a saved API was called this turn, the data must be bound
        // live — refuse to snapshot it into static settings.
        const api = ctx.apiCalls[ctx.apiCalls.length - 1];
        if (api) {
            return {
                kind: op.kind,
                ok: false,
                error: `This data came from a saved API (sourceId "${api.sourceId}"${api.path ? `, path "${api.path}"` : ""}). Do NOT snapshot API data with injectJson — use injectConnection so the widget reads it live, e.g. {"kind":"injectConnection","type":"${String(op.type)}","sourceId":"${api.sourceId}","request":{"method":"GET","path":"${api.path ?? "/"}"},"map":{…}}.`,
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
    run: async (op: AgentOp, ctx: ToolContext): Promise<OpResult> => {
        const widget = buildWidget(op, ctx);
        if ("error" in widget) return { kind: op.kind, ok: false, error: widget.error };
        const bound = bind(widget, op, ctx);
        if ("error" in bound) return { kind: op.kind, ok: false, error: bound.error };
        ctx.addWidget(widget);
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
