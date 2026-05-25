/**
 * Native skills — the built-in knowledge the agent ships with. Seeded into the
 * skills library so they appear (and can be toggled per dashboard) alongside
 * user-authored skills. Content lives in the sibling modules.
 */

import { RESEARCH_SKILL } from "./research";
import { MIP_WIDGETS_SKILL } from "./mip-widgets";
import { INJECTION_SKILL } from "./injection";
import { CANVAS_SKILL } from "./canvas";
import type { Skill } from "./types";

export const NATIVE_SKILLS: Skill[] = [
    { id: "native-research", name: "Research & tool use", description: "Use real tools to gather and verify info; never refuse or invent.", content: RESEARCH_SKILL, builtin: true, surfaces: ["dashboard", "canvas"] },
    { id: "native-mip-widgets", name: "MIP widgets", description: "Knowledge of widget types and their settings/data shapes.", content: MIP_WIDGETS_SKILL, builtin: true, surfaces: ["dashboard"] },
    { id: "native-injection", name: "Widget injection", description: "The two ways to put data into a widget (inline JSON vs live connection).", content: INJECTION_SKILL, builtin: true, surfaces: ["dashboard"] },
    { id: "native-canvas", name: "Canvas building", description: "How to build the sandboxed HTML canvas incrementally.", content: CANVAS_SKILL, builtin: true, surfaces: ["canvas"] },
];

export type { Skill, SkillSurface, SkillMode } from "./types";
export { RESEARCH_SKILL } from "./research";
export { MIP_WIDGETS_SKILL } from "./mip-widgets";
export { INJECTION_SKILL } from "./injection";
export { CANVAS_SKILL } from "./canvas";
