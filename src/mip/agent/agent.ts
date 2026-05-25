/**
 * The Agent loop — the bridge between the Brain (LLM) and the Tools.
 *
 *   Brain ──{say,ops}──▶ [parse] ──▶ [dispatch each op] ──▶ results ──▶ Brain
 *
 * It tolerates off-schema replies (via reply.ts), nudges the model once when it
 * narrates instead of emitting tools, and guards against false "I added it"
 * claims by checking whether any MUTATING op actually ran this turn.
 */

import type { ChatResult } from "../api";
import { dispatch, isMutating } from "./tools";
import { parseAgentReply, claimsAction } from "./reply";
import type { AgentOp, ApiMsg, OpResult, Surface, ToolContext } from "./types";

/** The Brain: a single chat completion call (cancellable via signal). */
export type Brain = (messages: ApiMsg[], system?: string, jsonMode?: boolean, signal?: AbortSignal) => Promise<ChatResult>;

export interface RunAgentOptions {
    initial: ApiMsg[];
    surface: Surface;
    /** The system prompt, or a thunk re-evaluated EACH round so live facts
     *  (e.g. widgets just added) stay current across multi-round turns. */
    system: string | (() => string);
    jsonMode: boolean;
    brain: Brain;
    ctx: ToolContext;
    /** Render an assistant line in the chat. */
    say: (text: string) => void;
    /** Report each tool call + its result (for the transcript's tool entries). */
    onTool?: (entry: { op: AgentOp; result: OpResult; mutating: boolean }) => void;
    /** Abort the whole loop (Stop button) — cancels the model call and halts. */
    signal?: AbortSignal;
    /** True when the user's message is a question — relaxes the "you didn't act" nudge. */
    userAskedQuestion?: boolean;
    /** Max tool rounds before giving up. */
    maxRounds?: number;
}

/** Shrink a tool result for the feed-back message: clip long strings and cap
 *  array lengths, keeping VALID JSON (the old raw `.slice(4000)` corrupted it). */
function summarizeResult(value: unknown, depth = 0): unknown {
    if (typeof value === "string") return value.length > 1500 ? value.slice(0, 1500) + `…(+${value.length - 1500} chars)` : value;
    if (Array.isArray(value)) {
        const capped = value.slice(0, 20).map((v) => summarizeResult(v, depth + 1));
        if (value.length > 20) capped.push(`…(+${value.length - 20} more)`);
        return capped;
    }
    if (value && typeof value === "object") {
        if (depth > 4) return "…";
        return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, summarizeResult(v, depth + 1)]));
    }
    return value;
}

export async function runAgent(opts: RunAgentOptions): Promise<void> {
    const { initial, surface, system, jsonMode, brain, ctx, say, signal, userAskedQuestion } = opts;
    const buildSystem = typeof system === "function" ? system : () => system;
    const maxRounds = opts.maxRounds ?? 8;

    let msgs = initial.slice();
    let nudged = false; // recovered a non-JSON / refusal reply
    let actNudged = false; // recovered a false "I did it" claim
    let mutated = false; // did any mutating op run this turn?
    let said = false; // emitted any non-blank assistant text?
    let lastError: string | undefined; // last tool error, for a useful fallback
    /** Show assistant text only when non-blank (no empty bubbles). */
    const emit = (t?: string) => {
        if (t && t.trim()) {
            said = true;
            say(t);
        }
    };
    /** End the turn — if nothing was said, surface the last error or a neutral note. */
    const finish = (lastSay?: string) => {
        emit(lastSay);
        if (!said) say(lastError ? `I couldn't complete that — ${lastError}` : "I don't have anything to add.");
    };

    for (let round = 0; round < maxRounds; round++) {
        if (signal?.aborted) return;
        const result = await brain(msgs, buildSystem(), jsonMode, signal);
        if (signal?.aborted) return; // stopped while the model was responding
        if (!result.ok) {
            say(`**Couldn't reach the model.**\n\n${typeof result.error === "string" ? result.error : "Request failed."}`);
            return;
        }
        const text = result.content ?? "";
        const parsed = parseAgentReply(text);

        if (!parsed) {
            // Pure prose / refusal — nudge once to emit tools.
            if (!nudged) {
                nudged = true;
                msgs = [
                    ...msgs,
                    { role: "assistant", content: text },
                    { role: "user", content: 'Do NOT refuse and do NOT explain limitations — your fetch/search and surface tools are real and run on the host. Reply with ONLY a JSON object {"say":"…","ops":[…]}. Use ops to ACTUALLY act, then summarize. Describing an action does nothing.' },
                ];
                continue;
            }
            finish(text);
            return;
        }

        if (!parsed.ops.length) {
            // Model ended the turn. If it CLAIMS a change but nothing mutating ran,
            // it only read data — make it actually act.
            if (claimsAction(parsed.say) && !mutated && !actNudged && !userAskedQuestion) {
                actNudged = true;
                msgs = [
                    ...msgs,
                    { role: "assistant", content: text },
                    { role: "user", content: `You have not changed the ${surface} yet — reading data (fetch/search/callApi/listConnections) does not count. Emit the op that actually performs the change NOW, then summarize. Do not claim success without the op.` },
                ];
                continue;
            }
            finish(parsed.say);
            return;
        }

        emit(parsed.say);
        const results: unknown[] = [];
        for (const op of parsed.ops as AgentOp[]) {
            if (signal?.aborted) return;
            const mut = isMutating(String(op.kind), surface);
            if (mut) mutated = true;
            const res = await dispatch(op, surface, ctx);
            if (res && res.ok === false && typeof res.error === "string") lastError = res.error;
            opts.onTool?.({ op, result: res, mutating: mut });
            results.push(res);
        }
        msgs = [
            ...msgs,
            { role: "assistant", content: text },
            {
                role: "user",
                content:
                    "Tool results:\n```json\n" +
                    JSON.stringify(summarizeResult(results)) +
                    `\n\`\`\`\nIf the ${surface} already matches the request, you are DONE: reply with EXACTLY {"say":"<one-line summary>","ops":[]} and nothing else — do NOT repeat the data or emit other keys. Otherwise continue with more ops — do not re-add anything already present.`,
            },
        ];
    }
    say(`Reached the ${surface} step limit.`);
}
