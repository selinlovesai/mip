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

export interface Skill {
    id: string;
    name: string;
    description?: string;
    /** The knowledge text injected into the system prompt. */
    content: string;
    /** Built-in skills can't be deleted; they're on by default per dashboard. */
    builtin?: boolean;
    /** Surfaces this skill applies to. Omitted ⇒ all surfaces. */
    surfaces?: SkillSurface[];
}
