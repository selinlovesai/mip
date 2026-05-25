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
    "Verify shape before mapping: when you'll bind a widget to an API, callApi once to see the real JSON shape, then use the matching JSONPath in `map`.",
    "Real-world numbers (market share, prices, population, company stats, rankings…): you MUST `search` (or fetch/callApi) for actual figures BEFORE building the widget. Do NOT fabricate values or generic placeholders like 'Market Share A/B/C'.",
    "If real data is genuinely unavailable (no Tavily/search connection, or the search returns nothing): do NOT silently invent it. Either ask the user for the data/source, OR build with clearly-labelled sample data — append '(sample)' to the widget title AND state plainly in `say` that the figures are placeholder and how to wire a real source.",
].join("\n");
