/**
 * Skill: injection — the two ways data gets INTO a dashboard widget. This is the
 * conceptual half of the injectJson / injectConnection tools.
 */

export const INJECTION_SKILL = [
    "## Skill: injection (2 modes)",
    "There are exactly two ways to put data into a widget:",
    "  ① injectJson  — DIRECT. You provide the data inline in `settings`. Use for one-off values you fetched, computed, or were given. Static: it won't update on its own.",
    "  ② injectConnection — BOUND. The widget reads LIVE from a saved REST connection and refreshes itself. Use whenever the user wants live/ongoing data from an API.",
    "injectConnection shape: { type, title?, sourceId, request:{ method, path, params? }, map?, refreshMs?, settings? }",
    "  · sourceId is a saved connection (by id, name, or baseUrl — listConnections to find it). The connection supplies baseUrl + auth.",
    "  · `map` is JSONPath ($.a.b[0].c) from the response to the field a widget needs:",
    "      charts → { series:\"$.path.to.array\" }  (+ settings.labelKey / settings.valueKey for the point fields)",
    "      list   → { items:\"$.path.to.array\" }    (+ settings.primaryKey / settings.secondaryKey)",
    "      kpi    → { value:\"$.x\", delta:\"$.y\" }",
    "  · refreshMs (e.g. 10000) polls; omit for fetch-once. A bound widget ignores static settings once data loads.",
    "Rule of thumb: if the user names an API or asks for live data, prefer injectConnection. Only use injectJson for values that don't have a live source.",
].join("\n");
