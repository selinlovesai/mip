/**
 * Reply parsing — turn a raw model message into {say, ops}.
 *
 * Under JSON mode the model returns *valid* JSON but not always our schema, so
 * this is deliberately tolerant: it accepts the canonical {say, ops[]}, a bare
 * ops array, ops under an alternate key, a single op object, or a say-only
 * answer — and never lets raw JSON leak into the chat. Pure + unit-testable.
 */

import type { AgentOp, AgentReply } from "./types";

/** Coerce a parsed JSON value into {say, ops}. Returns null only for non-objects. */
export function coerceReply(o: unknown): AgentReply | null {
    if (Array.isArray(o)) return { ops: o as AgentOp[] };
    if (!o || typeof o !== "object") return null;
    const rec = o as Record<string, unknown>;
    const say = typeof rec.say === "string" ? rec.say : typeof rec.message === "string" ? rec.message : undefined;
    for (const key of ["ops", "operations", "actions", "tools", "tool_calls"]) {
        if (Array.isArray(rec[key])) return { say, ops: rec[key] as AgentOp[] };
    }
    // A single op object, e.g. {"kind":"addWidget", ...} or {"say","kind",...}.
    if (typeof rec.kind === "string") {
        const { say: _s, message: _m, ...op } = rec;
        return { say, ops: [op as unknown as AgentOp] };
    }
    // A say-only object (model answered with no actions) — valid, no ops.
    if (say !== undefined) return { say, ops: [] };
    // Any other JSON object (e.g. the model echoing raw data after it already
    // acted) — terminal no-op so we never dump raw JSON into the chat.
    return { ops: [] };
}

/** All top-level BALANCED {...} (or [...]) regions, respecting strings/escapes.
 *  Beats a greedy regex (over-captures trailing prose) and a lazy one (truncates
 *  nested objects at the first "}"); returning ALL of them lets the caller skip a
 *  stray `{curly}` in prose and find the real payload. */
function allBalanced(text: string, open: "{" | "[", close: "}" | "]"): string[] {
    const out: string[] = [];
    let depth = 0;
    let start = -1;
    let inStr = false;
    let esc = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inStr) {
            if (esc) esc = false;
            else if (ch === "\\") esc = true;
            else if (ch === '"') inStr = false;
            continue;
        }
        if (ch === '"') inStr = true;
        else if (ch === open) {
            if (depth === 0) start = i;
            depth++;
        } else if (ch === close && depth > 0 && --depth === 0) {
            out.push(text.slice(start, i + 1));
        }
    }
    return out;
}

/** Parse an agent reply — tolerant of fences, surrounding prose, or a bare array.
 *  Returns null only when nothing parses as JSON (genuine prose). */
export function parseAgentReply(text: string): AgentReply | null {
    const candidates: string[] = [];
    const fence = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/i);
    if (fence) candidates.push(fence[1]!);
    // Objects first (our schema is an object), then arrays, then the whole text.
    candidates.push(...allBalanced(text, "{", "}"), ...allBalanced(text, "[", "]"), text.trim());
    for (const c of candidates) {
        try {
            const coerced = coerceReply(JSON.parse(c.trim()));
            if (coerced) return coerced;
        } catch {
            /* try next candidate */
        }
    }
    return null;
}

/** Pull the (possibly incomplete) `say` value out of a streaming JSON reply, so
 *  the message can be shown token-by-token before the full object arrives. */
export function extractPartialSay(text: string): string {
    const m = text.match(/"say"\s*:\s*"((?:\\.|[^"\\])*)/);
    if (!m) return "";
    try {
        return JSON.parse(`"${m[1]}"`) as string; // complete + valid escapes
    } catch {
        return m[1]!.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    }
}

/** Heuristic: does `say` claim a surface-changing action? Used by the agent loop
 *  to catch "I added a widget" when no mutating op actually ran. */
export function claimsAction(say?: string): boolean {
    return !!say && /\b(added|created|updated|built|inserted|placed|removed|deleted|set up|rendered|changed)\b/i.test(say);
}
