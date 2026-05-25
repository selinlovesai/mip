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

/** The Brain: a single chat completion call. */
export type Brain = (messages: ApiMsg[], system?: string, jsonMode?: boolean) => Promise<ChatResult>;

export interface RunAgentOptions {
    initial: ApiMsg[];
    surface: Surface;
    system: string;
    jsonMode: boolean;
    brain: Brain;
    ctx: ToolContext;
    /** Render an assistant line in the chat. */
    say: (text: string) => void;
    /** Report each tool call + its result (for the transcript's tool entries). */
    onTool?: (entry: { op: AgentOp; result: OpResult; mutating: boolean }) => void;
    /** Max tool rounds before giving up. */
    maxRounds?: number;
}

export async function runAgent(opts: RunAgentOptions): Promise<void> {
    const { initial, surface, system, jsonMode, brain, ctx, say } = opts;
    const maxRounds = opts.maxRounds ?? 8;

    let msgs = initial.slice();
    let nudged = false; // recovered a non-JSON / refusal reply
    let actNudged = false; // recovered a false "I did it" claim
    let mutated = false; // did any mutating op run this turn?

    for (let round = 0; round < maxRounds; round++) {
        const result = await brain(msgs, system, jsonMode);
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
            say(text);
            return;
        }

        if (!parsed.ops.length) {
            // Model ended the turn. If it CLAIMS a change but nothing mutating ran,
            // it only read data — make it actually act.
            if (claimsAction(parsed.say) && !mutated && !actNudged) {
                actNudged = true;
                msgs = [
                    ...msgs,
                    { role: "assistant", content: text },
                    { role: "user", content: `You have not changed the ${surface} yet — reading data (fetch/search/callApi/listConnections) does not count. Emit the op that actually performs the change NOW, then summarize. Do not claim success without the op.` },
                ];
                continue;
            }
            if (parsed.say) say(parsed.say);
            return;
        }

        if (parsed.say) say(parsed.say);
        const results: unknown[] = [];
        for (const op of parsed.ops as AgentOp[]) {
            const mut = isMutating(String(op.kind), surface);
            if (mut) mutated = true;
            const res = await dispatch(op, surface, ctx);
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
                    JSON.stringify(results).slice(0, 4000) +
                    `\n\`\`\`\nIf the ${surface} already matches the request, you are DONE: reply with EXACTLY {"say":"<one-line summary>","ops":[]} and nothing else — do NOT repeat the data or emit other keys. Otherwise continue with more ops — do not re-add anything already present.`,
            },
        ];
    }
    say(`Reached the ${surface} step limit.`);
}
