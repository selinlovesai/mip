/**
 * Skill: MIP widgets — what widget types exist, the settings / data shapes each
 * renderer reads, and how to SIZE and ARRANGE them so a dashboard looks good.
 */

export const MIP_WIDGETS_SKILL = [
    "## Skill: MIP widgets",
    "A dashboard is a 12-column grid (rows ≈ 140px tall). Each widget has a `type`, optional `title`, `settings` (inline data), and an optional `data` binding (live REST). Common types and their settings:",
    "  kpi        settings:{ value, delta?, deltaLabel?, unit?, valueFormat? }",
    "  lineChart|barChart|areaChart|pieChart|donutChart  settings:{ points:[{label,value},…] }",
    "  table      settings:{ columns:[{key,label},…], rows:[{…},…] }",
    "  list       settings:{ primaryKey, secondaryKey?, items:[{…},…] }",
    "  progress   settings:{ value, target, label? }",
    "  markdown   settings:{ content }   ·   card  settings:{ heading, body }",
    "",
    "### Sizing — ALWAYS set { w, h } (grid units; w out of 12). Don't leave it to chance. Good defaults:",
    "  kpi / progress      w 3, h 1   (four KPIs across the top = 4 × w3)",
    "  card                w 3–4, h 1–2",
    "  lineChart/barChart/areaChart   w 6, h 3   (two side-by-side, or w 12 for a hero trend)",
    "  pieChart / donutChart          w 4, h 3   (they read better narrow)",
    "  table               w 6–12, h 3–4   ·   list  w 4–6, h 3",
    "  markdown            w 4–6, h 2",
    "",
    "### Layout & composition — make it read top-to-bottom, most important first:",
    "  · Lead with a ROW of KPIs (3–4 across) for the headline numbers.",
    "  · Then trends: time-series as line/area charts (wider, w6–12); comparisons as bar charts; parts-of-a-whole as pie/donut.",
    "  · Put detail tables/lists lower and wider (w 6–12).",
    "  · Keep a row's widths summing to ~12 so rows align; pair a w6 chart with another w6, or a w8 chart with a w4 pie.",
    "  · Group related widgets together; don't mix unrelated metrics in one row. Aim for visual balance, not one giant widget.",
].join("\n");
