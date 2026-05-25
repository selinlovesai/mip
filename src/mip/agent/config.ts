/**
 * Per-dashboard agent configuration + resolution.
 *
 * Agent power is a property of each dashboard: which model it uses, which skills
 * it has, which connections it may call, and its context. A global default
 * (Settings → Assistant) fills any gap the dashboard leaves unset.
 */

import type { Skill, SkillSurface } from "./skills/types";

/** Stored on each dashboard page (DashboardPage.agent). All fields optional —
 *  anything unset falls back to the global default. */
export interface PageAgentConfig {
    /** Override the global AI connection for this dashboard. */
    connectionId?: string;
    /** Override the global model name. */
    model?: string;
    /** Built-in skills turned OFF for this dashboard (default: all on). */
    disabledSkillIds?: string[];
    /** Custom skills turned ON for this dashboard (default: none). */
    enabledSkillIds?: string[];
    /** Connection ids this dashboard's agent may call as tools. Undefined ⇒ all. */
    callableConnectionIds?: string[];
}

/** The skills active for a surface given the library + this dashboard's config:
 *  built-in skills are on unless disabled; custom skills are on only if enabled;
 *  all are filtered to the current surface. */
export function resolveSkills(library: Skill[], agent: PageAgentConfig | undefined, surface: SkillSurface): Skill[] {
    return library.filter((s) => {
        if (s.surfaces && !s.surfaces.includes(surface)) return false;
        return s.builtin ? !(agent?.disabledSkillIds ?? []).includes(s.id) : (agent?.enabledSkillIds ?? []).includes(s.id);
    });
}
