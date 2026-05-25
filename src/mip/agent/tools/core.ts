/**
 * Core tools — the agent's built-in surface controls:
 *   · dashboard: listConnections, listWidgets, removeWidget
 *   · canvas:    the DOM ops (replace/append/insert/setStyle/…/runJs/query),
 *                all routed to the sandboxed-iframe runtime via canvasSend.
 *
 * Injection (addWidget / injectJson / injectConnection) lives in ./injection.
 */

import type { CanvasOp } from "../../shell/canvas-runtime";
import type { Tool, ToolContext, AgentOp, OpResult } from "../types";

const listConnections: Tool = {
    name: "listConnections",
    doc: "listConnections {}                     — list saved data sources/APIs as [{id, name, type, baseUrl, endpoints:[{method,path}]}]. Use to FIND an API before calling or binding it.",
    surfaces: ["dashboard"],
    mutating: false,
    run: async (_op: AgentOp, ctx: ToolContext): Promise<OpResult> => ({
        kind: "listConnections",
        ok: true,
        connections: ctx.connections.map((c) => ({
            id: c.id,
            name: c.name,
            type: c.type,
            baseUrl: c.baseUrl,
            endpoints: (c.endpoints ?? []).map((e) => ({ method: e.method, path: e.path })),
        })),
    }),
};

const listWidgets: Tool = {
    name: "listWidgets",
    doc: "listWidgets {}                         — list the current widgets on this page as [{id, type, title}]",
    surfaces: ["dashboard"],
    mutating: false,
    run: async (_op: AgentOp, ctx: ToolContext): Promise<OpResult> => ({ kind: "listWidgets", ok: true, widgets: ctx.listWidgets() }),
};

const removeWidget: Tool = {
    name: "removeWidget",
    doc: "removeWidget { id }                    — remove a widget by id (use listWidgets first)",
    surfaces: ["dashboard"],
    mutating: true,
    run: async (op: AgentOp, ctx: ToolContext): Promise<OpResult> => {
        if (typeof op.id !== "string") return { kind: "removeWidget", ok: false, error: "removeWidget needs a string id." };
        ctx.removeWidget(op.id);
        return { kind: "removeWidget", ok: true, removed: op.id };
    },
};

const getContext: Tool = {
    name: "getContext",
    doc: "getContext {}                          — read this page's AI assistant context (the persistent system-prompt note for this dashboard)",
    surfaces: ["dashboard"],
    mutating: false,
    run: async (_op: AgentOp, ctx: ToolContext): Promise<OpResult> => ({ kind: "getContext", ok: true, context: ctx.getContext() }),
};

const setContext: Tool = {
    name: "setContext",
    doc: "setContext { text, append? }           — update this page's AI assistant context (persisted, injected at the top of future prompts). append:true adds to it; otherwise replaces.",
    surfaces: ["dashboard"],
    mutating: true,
    run: async (op: AgentOp, ctx: ToolContext): Promise<OpResult> => {
        const text = String(op.text ?? "");
        const next = op.append ? [ctx.getContext().trim(), text].filter(Boolean).join("\n\n") : text;
        ctx.setContext(next);
        return { kind: "setContext", ok: true, context: next };
    },
};

/** Canvas DOM ops handled uniformly by the sandboxed-iframe runtime. `query` is
 *  the only read; the rest mutate. Their per-op docs live in CANVAS_TOOLS_DOC. */
const CANVAS_DOM_KINDS = ["replace", "append", "prepend", "insert", "setStyle", "setText", "setValue", "setAttr", "click", "remove", "addStyle", "runJs", "query"] as const;

const canvasDomTools: Tool[] = CANVAS_DOM_KINDS.map((kind) => ({
    name: kind,
    doc: "", // documented as a block via CANVAS_TOOLS_DOC in the prompt
    surfaces: ["canvas"],
    mutating: kind !== "query",
    run: async (op: AgentOp, ctx: ToolContext): Promise<OpResult> => {
        const r = await ctx.canvasSend(op as CanvasOp);
        return { kind, ok: r.ok, ...(r.error ? { error: r.error } : {}), ...(r.result !== undefined ? { result: r.result } : {}) };
    },
}));

export const coreTools: Tool[] = [listConnections, listWidgets, removeWidget, getContext, setContext, ...canvasDomTools];
