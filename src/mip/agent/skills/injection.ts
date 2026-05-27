/**
 * Skill: injection — the two ways data gets INTO a dashboard widget. This is the
 * conceptual half of the injectJson / injectConnection tools.
 */

export const INJECTION_SKILL = [
    "## Skill: injection (2 modes)",
    "There are exactly two ways to put data into a widget:",
    "  ① injectJson  — DIRECT. You provide the data inline in `settings`. Use ONLY for values you actually FETCHED/searched this turn, computed from them, or the user gave you — NEVER invented. Do not make up percentages, counts, or trends to fill a widget. If you don't have a real figure, omit the widget or title it '… (estimate)' / '… (sample)' and say it's illustrative. The same metric must always show the same number — differing values for one metric means it was fabricated.",
    "  ② injectConnection — BOUND. The widget reads LIVE from a saved REST connection and refreshes itself. Use whenever the user wants live/ongoing data from an API.",
    "injectConnection shape: { type, title?, sourceId, request:{ method, path, params? }, map?, refreshMs?, settings? }",
    "  · sourceId is a saved connection (by id, name, or baseUrl — listConnections to find it). The connection supplies baseUrl + auth.",
    "  · `map` is JSONPath ($.a.b[0].c) from the response to the field a widget needs:",
    "      charts → { series:\"$.path.to.array\" }  (+ settings.labelKey / settings.valueKey for the point fields)",
    "      list   → { items:\"$.path.to.array\" }    (+ settings.primaryKey / settings.secondaryKey)",
    "      kpi    → { value:\"$.x\", delta:\"$.y\" } — ALWAYS map `delta` too when the response has a change / Δ / percent / trend field (e.g. priceChangePercent, change, pctChange), and set settings.deltaLabel (e.g. \"24h\", \"vs. last week\"). A bound KPI shows NO delta unless it's in the data — never leave a real change value unmapped.",
    "  · refreshMs (e.g. 10000) polls; omit for fetch-once. A bound widget ignores static settings once data loads.",
    "STRICT RULE: if the data comes from an API or saved connection (anything you reach with callApi, or any request to use an API), you MUST use injectConnection so the widget reads it LIVE. NEVER copy callApi/API results into injectJson — a snapshot is wrong and will be rejected. injectJson is ONLY for values with no live source (hand-given numbers, ad-hoc web facts).",
    "So the correct flow for an API is: listConnections → callApi (to learn the response shape) → injectConnection (bind sourceId + the SAME path + a map derived from the shape you saw). Do not addWidget/injectJson with the rows you fetched.",
].join("\n");
