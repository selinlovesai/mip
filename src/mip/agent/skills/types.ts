/**
 * Skill model. A skill is a named block of knowledge injected into the agent's
 * system prompt. Built-in skills ship with the app (research / MIP widgets /
 * injection / canvas) and are on by default but can be toggled off per
 * dashboard; custom skills are user-authored in Settings → Skills and opted
 * into per dashboard.
 *
 * Kept import-free (no Connection/Surface from elsewhere) to avoid cycles —
 * the settings store and the prompt assembler both depend on this.
 */

export type SkillSurface = "dashboard" | "canvas";

/** How a skill's content reaches the model:
 *  · "always"   — injected into the system prompt every turn (default).
 *  · "onDemand" — only its name+description appear in a catalog; the agent pulls
 *                 the full content with the `loadSkill` tool when relevant.
 *                 Keeps the prompt lean and lets the agent self-select context. */
export type SkillMode = "always" | "onDemand";

export interface Skill {
    id: string;
    name: string;
    description?: string;
    /** The knowledge text injected into the system prompt (or loaded on demand). */
    content: string;
    /** Built-in skills can't be deleted; they're on by default per dashboard. */
    builtin?: boolean;
    /** Surfaces this skill applies to. Omitted ⇒ all surfaces. */
    surfaces?: SkillSurface[];
    /** Delivery mode. Omitted ⇒ "always". */
    mode?: SkillMode;
}
