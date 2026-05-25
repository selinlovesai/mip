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

/** Parse an agent reply — tolerant of fences, surrounding prose, or a bare array.
 *  Returns null only when nothing parses as JSON (genuine prose). */
export function parseAgentReply(text: string): AgentReply | null {
    const candidates: string[] = [];
    const fence = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/i);
    if (fence) candidates.push(fence[1]!);
    const obj = text.match(/\{[\s\S]*\}/); // any JSON object, even unfenced
    if (obj) candidates.push(obj[0]);
    const arr = text.match(/\[[\s\S]*\]/); // a bare ops array
    if (arr) candidates.push(arr[0]);
    candidates.push(text.trim());
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

/** Heuristic: does `say` claim a surface-changing action? Used by the agent loop
 *  to catch "I added a widget" when no mutating op actually ran. */
export function claimsAction(say?: string): boolean {
    return !!say && /\b(added|created|updated|built|inserted|placed|removed|deleted|set up|rendered|changed)\b/i.test(say);
}
