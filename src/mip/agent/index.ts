/**
 * Agent module — public surface.
 *
 *   Brain (LLM)  ── brain.ts type / your callModel
 *        │
 *      Agent     ── runAgent (agent.ts)
 *      ├── Skills ── skills/*  (knowledge, composed by prompt.ts)
 *      └── Tools  ── tools/*   (registry: integrations · injection · core)
 */

export { runAgent, type Brain, type RunAgentOptions } from "./agent";
export { buildSystemPrompt, describeDashboard, type PromptContext, type DashboardFacts } from "./prompt";
export { parseAgentReply, coerceReply, claimsAction } from "./reply";
export { ALL_TOOLS, toolsFor, catalogFor, isMutating, dispatch } from "./tools";
export { resolveSkills, type PageAgentConfig } from "./config";
export { NATIVE_SKILLS, type Skill, type SkillSurface, type SkillMode } from "./skills";
export type { Surface, AgentOp, OpResult, AgentReply, ApiMsg, Tool, ToolContext } from "./types";
