/**
 * Agent types — the shared contracts between the Brain (LLM), the Agent loop,
 * the Tool registry, and the host app.
 *
 *   Brain ──prompt──▶ Agent ──ops──▶ Tools ──results──▶ Agent ──▶ Brain
 *
 * Tools are surface-aware (dashboard / canvas) and declare whether they MUTATE
 * the surface, so the agent loop can tell "I added a widget" claims from mere
 * reads. Everything a tool needs from the running app arrives via ToolContext,
 * which keeps tools pure-ish and unit-testable.
 */

import type { CanvasOp, CanvasOpResult } from "../shell/canvas-runtime";
import type { MipWidget } from "../schema";
import type { Connection } from "../settings/settings-store";

export type Surface = "dashboard" | "canvas";

/** A model-emitted tool call. `kind` selects the tool; the rest are its args. */
export type AgentOp = Record<string, unknown> & { kind: string };

/** Result handed back to the model after running an op. */
export type OpResult = Record<string, unknown>;

/** The normalized shape of every model reply. */
export interface AgentReply {
    say?: string;
    ops: AgentOp[];
}

export type ApiMsg = { role: "user" | "assistant" | "system"; content: string };

/** Lightweight view of a fetched page (from the backend `/api/fetch`). */
export interface FetchPageLike {
    ok: boolean;
    url?: string;
    title?: string;
    text?: string;
    error?: unknown;
}

/** Lightweight view of an endpoint call (from the backend `/api/test-endpoint`). */
export interface TestEndpointLike {
    ok: boolean;
    status?: number;
    body?: unknown;
    error?: unknown;
}

/**
 * Everything the tools need from the live app. Supplied once per turn by the
 * chat panel so the tool implementations stay free of React/store coupling.
 */
export interface ToolContext {
    // Integrations (host-side, CORS-safe)
    fetchPage: (url: string, maxChars?: number) => Promise<FetchPageLike>;
    testEndpoint: (args: { method: string; url: string; headers?: Record<string, string>; body?: unknown }) => Promise<TestEndpointLike>;

    // Saved data sources / APIs
    connections: Connection[];
    resolveConnection: (ref: unknown) => Connection | undefined;
    tavily?: Connection;

    // Canvas surface
    canvasSend: (op: CanvasOp) => Promise<CanvasOpResult>;

    // Dashboard surface (store actions)
    listWidgets: () => Array<{ id: string; type: string; title?: string }>;
    addWidget: (widget: MipWidget) => void;
    removeWidget: (id: string) => void;
    /** The user's default grid size for a widget type (Settings → Widgets). */
    widgetSize: (type: string) => { w: number; h: number };

    // The page's "AI assistant context (system prompt)" — read + update.
    getContext: () => string;
    setContext: (text: string) => void;

    // Turn-scoped scratch: saved-API calls made this turn. callApi appends here;
    // injectJson reads it to refuse snapshotting live API data (use injectConnection).
    apiCalls: { sourceId: string; path?: string }[];

    // Composer injection toggle: "auto" | "json" | "api". When "api", injectJson
    // is hard-refused; when "json", the post-callApi strict-REST guard is relaxed.
    injectMode?: "auto" | "json" | "api";

    // Look up an on-demand skill's content by name/id (for the loadSkill tool).
    getSkill: (ref: string) => { name: string; content: string } | undefined;

    // Read a widget on the active page (for edit ops to merge layout/settings).
    getWidget: (id: string) => MipWidget | undefined;
    // Patch an existing widget (title/settings/layout).
    updateWidget: (id: string, patch: Partial<MipWidget>) => void;

    // Human-in-the-loop gate for higher-risk actions the model might be steered
    // into by injected content — state-changing API calls (non-GET/HEAD) and
    // self-modifying the persisted page context. Returns true to proceed. When
    // unset, callers MUST treat the action as denied (fail safe).
    confirmAction?: (summary: string) => boolean | Promise<boolean>;
}

/** A single capability the agent can invoke. */
export interface Tool {
    /** The op `kind` that selects this tool. */
    name: string;
    /** Full usage doc shown to the model (empty = documented elsewhere). */
    doc: string;
    /** Short one-line summary for the on-demand tool index. Defaults to `doc`. */
    summary?: string;
    /** On-demand: listed compactly in the catalog; full `doc` fetched via describeTool. */
    catalog?: boolean;
    /** Surfaces this tool is available on. */
    surfaces: Surface[];
    /** True if running this op changes the surface (vs. a read). */
    mutating: boolean;
    /** Optional argument check — return an error string to reject before run(). */
    validate?: (op: AgentOp) => string | null;
    run: (op: AgentOp, ctx: ToolContext) => Promise<OpResult>;
}
