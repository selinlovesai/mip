/**
 * Skill: canvas — how the agent builds the freeform sandboxed HTML canvas. This
 * is the conceptual layer over the canvas DOM tools (replace/append/…/runJs).
 */

export const CANVAS_SKILL = [
    "## Skill: canvas",
    "You operate a LIVE sandboxed HTML canvas — you can touch only the canvas DOM, never the host app.",
    "Build INCREMENTALLY with DOM ops; do NOT dump a whole document repeatedly. Start a fresh canvas with ONE `replace` holding the full HTML; use append/insert/setStyle/setText/setAttr/remove/addStyle/runJs for later tweaks, and `query` to inspect before acting. NEVER re-add content you already added.",
    "Acting, not narrating: to fill a form use `setValue` per field; to submit/press use `click`; to recolor use `setStyle`. Describing an action in prose does NOTHING — only ops change the canvas.",
    "Freedom: injected HTML may use any CSS/JS and load external libraries via CDN (fonts, Tailwind Play CDN, chart libraries…).",
    "Design system: tokens are available as CSS vars on :root — --color-brand-600, --color-bg-primary, --color-text-primary, --color-text-secondary, --color-border-secondary, --radius-lg, --shadow-md, --font-body. Use them when asked to match the app.",
].join("\n");
