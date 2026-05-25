/**
 * Tool registry — the single source of truth tying an op `kind` to its
 * implementation, its docs, surface, mutation flag, and argument validation.
 * Keeping these together kills the drift between prompt and dispatcher.
 *
 * Tools are split for the prompt into "always" (full doc inline) and "catalog"
 * (compact one-liner; the agent fetches full usage with `describeTool`). This
 * keeps the per-turn prompt lean while every tool stays discoverable.
 */

import type { AgentOp, OpResult, Surface, Tool, ToolContext } from "../types";
import { integrationTools } from "./integrations";
import { injectionTools } from "./injection";
import { coreTools } from "./core";

/** `describeTool` — defined here (after the registry) so it can read every tool's
 *  full doc without a circular import. Lets the agent expand a catalog entry. */
const describeTool: Tool = {
    name: "describeTool",
    doc: "describeTool { name }                  — get the full usage of a tool listed in the tool catalog",
    summary: "describeTool { name } — full usage of a catalogued tool",
    surfaces: ["dashboard", "canvas"],
    mutating: false,
    run: async (op: AgentOp): Promise<OpResult> => {
        const t = BY_NAME.get(String(op.name ?? ""));
        if (!t) return { kind: "describeTool", ok: false, error: `No tool named "${String(op.name)}".` };
        return { kind: "describeTool", ok: true, name: t.name, usage: t.doc || t.summary || t.name };
    },
};

export const ALL_TOOLS: Tool[] = [...integrationTools, ...injectionTools, ...coreTools, describeTool];

const BY_NAME = new Map<string, Tool>(ALL_TOOLS.map((t) => [t.name, t]));

/** Tools available on a surface. */
export function toolsFor(surface: Surface): Tool[] {
    return ALL_TOOLS.filter((t) => t.surfaces.includes(surface));
}

/** Full-doc lines for the "always" tools on a surface (with a non-empty doc). */
export function catalogFor(surface: Surface): string {
    return toolsFor(surface)
        .filter((t) => !t.catalog && t.doc)
        .map((t) => t.doc)
        .join("\n");
}

/** Compact one-liners for the on-demand ("catalog") tools on a surface. */
export function toolIndexFor(surface: Surface): string {
    return toolsFor(surface)
        .filter((t) => t.catalog)
        .map((t) => `- ${t.name} — ${t.summary ?? t.doc}`)
        .join("\n");
}

/** True if running `kind` on `surface` changes the surface (vs. a read). */
export function isMutating(kind: string, surface: Surface): boolean {
    const t = BY_NAME.get(kind);
    return !!t && t.surfaces.includes(surface) && t.mutating;
}

/** Run a single op: resolve the tool, validate args, run. Unknown/cross-surface
 *  ops and validation failures return a typed error the model can self-correct. */
export async function dispatch(op: AgentOp, surface: Surface, ctx: ToolContext): Promise<OpResult> {
    const tool = BY_NAME.get(op.kind);
    if (!tool || !tool.surfaces.includes(surface)) {
        return { kind: op.kind, ok: false, error: `Unknown ${surface} op "${op.kind}".` };
    }
    const invalid = tool.validate?.(op);
    if (invalid) return { kind: op.kind, ok: false, error: invalid };
    try {
        return await tool.run(op, ctx);
    } catch (err) {
        return { kind: op.kind, ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}
