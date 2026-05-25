/**
 * Skill: MIP widgets — what widget types exist and the settings / data shapes
 * each renderer reads. This is the agent's knowledge of the dashboard surface.
 */

export const MIP_WIDGETS_SKILL = [
    "## Skill: MIP widgets",
    "A dashboard is a grid of widgets. Each widget has a `type`, an optional `title`, `settings` (inline data), and an optional `data` binding (live REST). Common types and their settings:",
    "  kpi        settings:{ value, delta?, deltaLabel?, unit?, valueFormat? }",
    "  lineChart|barChart|areaChart|pieChart|donutChart  settings:{ points:[{label,value},…] }",
    "  table      settings:{ columns:[{key,label},…], rows:[{…},…] }",
    "  list       settings:{ primaryKey, secondaryKey?, items:[{…},…] }",
    "  progress   settings:{ value, target, label? }",
    "  markdown   settings:{ content }",
    "  card       settings:{ heading, body }",
    "Sizing is optional ({ w, h } in grid units) — sensible defaults per type are applied when omitted.",
].join("\n");
