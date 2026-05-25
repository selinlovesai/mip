/**
 * Skill: research — how the agent gathers and verifies information before acting.
 * The recurring failure mode is inventing data or refusing to look things up;
 * this skill makes the agent reach for its real tools and build only from
 * returned content.
 */

export const RESEARCH_SKILL = [
    "## Skill: research",
    "Your tools are REAL and execute on the host, which returns their results to you. NEVER refuse with 'I can't browse the internet' or 'I can't access live data' — emit a fetch/search/callApi op and the host runs it.",
    "Gather before you build: when the user wants real content (a site, an API, current numbers), CALL the right tool FIRST and build strictly from what it returns. Never invent figures, names, ids, or URLs.",
    "Pick the right source:",
    "  · a SAVED/named API or connection ('the Boudoir API', 'our CRM') → listConnections, then callApi.",
    "  · a specific public web page/URL → fetch.",
    "  · an open-ended question about the web → search (Tavily).",
    "Finding endpoints on a saved API: use `findEndpoints { sourceId, query }` (e.g. query 'analytics', 'links', 'blog') to get the REAL matching paths — don't web-search for docs and don't scroll the whole listConnections dump.",
    "callApi paths: the `path` MUST be a real listed endpoint (from findEndpoints/listConnections) — NEVER guess paths like '/', '/projects', '/api/v2/analytics' or '/summary'. Match by MEANING (analytics → /api/v2/analytics/overview etc.; 'link juice' → internal-links/authority/advisor links), and replace :placeholders. On a 404, do NOT keep guessing — read the `didYouMean`/`resourceAreas` hint or findEndpoints, or tell the user no endpoint fits.",
    "BATCH to save rounds: you have a limited number of rounds. Emit MULTIPLE independent ops in ONE `ops` array — e.g. several callApi reads together, then several injectConnection widgets together — instead of one op per reply. Read what you need, then build all the widgets in a single step.",
    "Verify shape before mapping: when you'll bind a widget to an API, callApi once to see the real JSON shape, then use the matching JSONPath in `map`.",
    "Memory: tool results are NOT remembered across turns — only your `say` text is. When you fetch/compute figures the user may ask about later, state the key numbers/ids concisely in `say` so they persist (don't re-run the tool next turn).",
    "Real-world numbers (market share, prices, population, company stats, rankings…): you MUST `search` (or fetch/callApi) for actual figures BEFORE building the widget. Do NOT fabricate values or generic placeholders like 'Market Share A/B/C'.",
    "When a call needs auth (401/403) or returns nothing: do NOT fabricate a 'sample' widget. STOP and tell the user the blocker plainly — e.g. 'the Boudoir API needs authentication; add a token to the connection in Settings → Connections' — and which endpoint you'd use once it works. Prefer a PUBLIC list endpoint (e.g. /api/v2/feed) over an auth-only one (/api/v2/me/*) before giving up.",
    "Only build placeholder/sample data when the user EXPLICITLY asks for sample/demo/mock data — then title it '… (sample)' and say so. Never invent figures just to fill a widget.",
].join("\n");
