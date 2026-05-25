/**
 * Tool registry — the single source of truth that ties an op `kind` to its
 * implementation, its catalog documentation, and whether it mutates the surface.
 * Keeping these together kills the drift between the prompt text and the
 * dispatcher that caused earlier bugs (documented ops that didn't run, etc.).
 */

import type { AgentOp, OpResult, Surface, Tool, ToolContext } from "../types";
import { integrationTools } from "./integrations";
import { injectionTools } from "./injection";
import { coreTools } from "./core";

export const ALL_TOOLS: Tool[] = [...integrationTools, ...injectionTools, ...coreTools];

const BY_NAME = new Map<string, Tool>(ALL_TOOLS.map((t) => [t.name, t]));

/** Tools available on a surface. */
export function toolsFor(surface: Surface): Tool[] {
    return ALL_TOOLS.filter((t) => t.surfaces.includes(surface));
}

/** Catalog lines (non-empty docs) for a surface, for the system prompt. */
export function catalogFor(surface: Surface): string {
    return toolsFor(surface)
        .map((t) => t.doc)
        .filter(Boolean)
        .join("\n");
}

/** True if running `kind` on `surface` changes the surface (vs. a read). */
export function isMutating(kind: string, surface: Surface): boolean {
    const t = BY_NAME.get(kind);
    return !!t && t.surfaces.includes(surface) && t.mutating;
}

/** Run a single op against the context. Unknown/cross-surface ops return an error. */
export async function dispatch(op: AgentOp, surface: Surface, ctx: ToolContext): Promise<OpResult> {
    const tool = BY_NAME.get(op.kind);
    if (!tool || !tool.surfaces.includes(surface)) {
        return { kind: op.kind, ok: false, error: `Unknown ${surface} op "${op.kind}".` };
    }
    try {
        return await tool.run(op, ctx);
    } catch (err) {
        return { kind: op.kind, ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}
