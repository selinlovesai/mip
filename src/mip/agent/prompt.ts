/**
 * Prompt assembly — composes the system prompt the Brain receives, in order:
 *
 *   1. CONTEXT   — the page's "AI assistant context" + global assistant context,
 *                  injected FIRST so user-authored guidance frames everything.
 *   2. SKILLS    — the agent's knowledge (research, MIP widgets, injection, canvas).
 *   3. TOOLS     — the catalog of ops available on this surface (from the registry).
 *   4. PROTOCOL  — the strict {say, ops} contract + worked examples.
 *
 * Keeping this in one place means the prompt always matches the registry.
 */

import { catalogFor } from "./tools";
import type { Surface } from "./types";
import { RESEARCH_SKILL } from "./skills/research";
import { MIP_WIDGETS_SKILL } from "./skills/mip-widgets";
import { INJECTION_SKILL } from "./skills/injection";
import { CANVAS_SKILL } from "./skills/canvas";
import { CANVAS_TOOLS_DOC } from "../shell/canvas-runtime";

const DASHBOARD_PROTOCOL = [
    "## Protocol",
    'EVERY reply is ONE JSON object with EXACTLY two keys: "say" (string) and "ops" (array). Put EVERY action inside "ops" as {"kind":"…", …}. Do NOT invent other top-level keys and do NOT return data/widgets at the top level.',
    "You receive each op's result and may continue. When the dashboard matches the request (or you've answered a question), reply with {\"say\":\"…\",\"ops\":[]} and STOP. Describing an action in prose does NOTHING — only ops change the dashboard.",
    'CRITICAL: reading data (fetch / search / callApi / listConnections) does NOT create anything. To put a widget on the dashboard you MUST emit an injectJson / injectConnection (or addWidget) op. NEVER say "I added a widget" unless your CURRENT ops array contains one.',
    "## Examples",
    'Pie chart from the open web → Round 1 {"say":"Fetching population data…","ops":[{"kind":"fetch","url":"https://restcountries.com/v3.1/all?fields=name,population"}]}',
    'Round 2 {"say":"Added a pie chart of the 6 most populous countries.","ops":[{"kind":"injectJson","type":"pieChart","title":"Top 6 by population","settings":{"points":[{"label":"India","value":1417000000},{"label":"China","value":1412000000},{"label":"United States","value":333000000},{"label":"Indonesia","value":275000000},{"label":"Pakistan","value":240000000},{"label":"Nigeria","value":223000000}]}}]}',
    'Live list from a SAVED API → Round 1 {"say":"Looking up the connection…","ops":[{"kind":"listConnections"}]}',
    'Round 2 {"say":"Reading the latest posts…","ops":[{"kind":"callApi","sourceId":"<id>","path":"/<posts endpoint>"}]}',
    'Round 3 {"say":"Added a live list of the latest posts.","ops":[{"kind":"injectConnection","type":"list","title":"Latest posts","sourceId":"<id>","request":{"method":"GET","path":"/<posts endpoint>"},"map":{"items":"$.items"},"settings":{"primaryKey":"title","secondaryKey":"date_created"}}]}',
].join("\n");

const CANVAS_PROTOCOL = [
    "## Protocol",
    'EVERY reply must be ONE JSON object {"say":"<one short line>","ops":[ {"kind":"...", ...}, ... ]} — never plain prose, never code outside it. You receive the ops\' results and may continue. As soon as the canvas matches the request, reply with {"say":"<summary>","ops":[]} and STOP.',
].join("\n");

/** Context authored by the user — injected at the very top of the prompt. */
export interface PromptContext {
    /** The active page's "AI assistant context (system prompt)". */
    pageContext?: string;
    /** The global assistant system prompt (Settings → Assistant). */
    assistantContext?: string;
}

export function buildSystemPrompt(surface: Surface, ctx: PromptContext = {}): string {
    const sections: string[] = [];

    const context = [ctx.pageContext?.trim(), ctx.assistantContext?.trim()].filter(Boolean).join("\n\n");
    if (context) sections.push(`## Context (user-authored — follow this first)\n${context}`);

    if (surface === "dashboard") {
        sections.push("You are the dashboard assistant. You manage a LIVE widget dashboard with real tools that run on the host and return results to you.");
        sections.push(RESEARCH_SKILL, MIP_WIDGETS_SKILL, INJECTION_SKILL);
        sections.push(`## Tools (op \`kind\` + args)\n${catalogFor("dashboard")}`);
        sections.push(DASHBOARD_PROTOCOL);
    } else {
        sections.push("You are an agent operating a LIVE sandboxed HTML canvas via tools — you can touch only the canvas DOM, not the host app.");
        sections.push(RESEARCH_SKILL, CANVAS_SKILL);
        sections.push(`## Canvas DOM tools (op \`kind\` + args)\n${CANVAS_TOOLS_DOC}`);
        const web = catalogFor("canvas");
        if (web) sections.push(`## Web tools\n${web}`);
        sections.push(CANVAS_PROTOCOL);
    }

    return sections.join("\n\n");
}
