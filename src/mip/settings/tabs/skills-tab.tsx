/**
 * Skills tab — the library of agent skills (knowledge blocks injected into the
 * assistant's system prompt). Built-in (native) skills ship with the app and
 * can't be deleted; custom skills are authored here. Which skills a given
 * dashboard actually uses is chosen per-dashboard (Dashboard Settings → Agent).
 */

import { useState } from "react";
import { Plus, Trash01 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/textarea/textarea";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { useSettings, type Skill } from "../settings-store";

type Mode = "always" | "onDemand";
type Draft = { id?: string; name: string; description: string; content: string; surfaces: ("dashboard" | "canvas")[]; mode: Mode };

const EMPTY: Draft = { name: "", description: "", content: "", surfaces: ["dashboard", "canvas"], mode: "always" };

export function SkillsTab() {
    const { skills, addSkill, updateSkill, removeSkill } = useSettings();
    const [draft, setDraft] = useState<Draft | null>(null);

    const startNew = () => setDraft({ ...EMPTY });
    const startEdit = (s: Skill) =>
        setDraft({ id: s.id, name: s.name, description: s.description ?? "", content: s.content, surfaces: s.surfaces ?? ["dashboard", "canvas"], mode: s.mode ?? "always" });

    const save = () => {
        if (!draft || !draft.name.trim() || !draft.content.trim()) return;
        const payload = { name: draft.name.trim(), description: draft.description.trim() || undefined, content: draft.content, surfaces: draft.surfaces, mode: draft.mode };
        if (draft.id) updateSkill(draft.id, payload);
        else addSkill(payload);
        setDraft(null);
    };

    const toggleSurface = (s: "dashboard" | "canvas", on: boolean) =>
        setDraft((d) => (d ? { ...d, surfaces: on ? [...new Set([...d.surfaces, s])] : d.surfaces.filter((x) => x !== s) } : d));

    return (
        <div className="flex flex-col gap-8">
            <header className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold text-primary">Skills</h1>
                    <p className="mt-1 max-w-xl text-sm text-tertiary">
                        Reusable knowledge blocks added to the assistant's system prompt. Built-in skills are always available; add your own for
                        domain knowledge or house style. Enable them per dashboard under <span className="font-medium text-secondary">Dashboard Settings → Agent</span>.
                    </p>
                </div>
                {!draft && (
                    <Button color="primary" size="md" iconLeading={Plus} onClick={startNew}>
                        New skill
                    </Button>
                )}
            </header>

            {draft && (
                <div className="flex max-w-2xl flex-col gap-4 rounded-xl bg-secondary p-4 ring-1 ring-secondary">
                    <h2 className="text-sm font-semibold text-primary">{draft.id ? "Edit skill" : "New skill"}</h2>
                    <Input label="Name" placeholder="e.g. Pricing playbook" value={draft.name} onChange={(v) => setDraft((d) => (d ? { ...d, name: v } : d))} />
                    <Input label="Description" hint="Short summary shown in lists." value={draft.description} onChange={(v) => setDraft((d) => (d ? { ...d, description: v } : d))} />
                    <TextArea
                        label="Knowledge / instructions"
                        hint="Injected verbatim into the system prompt for dashboards that enable this skill."
                        rows={8}
                        value={draft.content}
                        onChange={(v) => setDraft((d) => (d ? { ...d, content: v } : d))}
                    />
                    <div className="flex flex-col gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-quaternary">Applies to</span>
                        <div className="flex gap-4">
                            <Checkbox label="Dashboards" isSelected={draft.surfaces.includes("dashboard")} onChange={(on) => toggleSurface("dashboard", on)} />
                            <Checkbox label="Canvas" isSelected={draft.surfaces.includes("canvas")} onChange={(on) => toggleSurface("canvas", on)} />
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-quaternary">Delivery</span>
                        <div className="flex gap-4">
                            <Checkbox label="Always (in every prompt)" isSelected={draft.mode === "always"} onChange={(on) => on && setDraft((d) => (d ? { ...d, mode: "always" } : d))} />
                            <Checkbox label="On-demand (catalog; loaded when needed)" isSelected={draft.mode === "onDemand"} onChange={(on) => on && setDraft((d) => (d ? { ...d, mode: "onDemand" } : d))} />
                        </div>
                        <p className="text-xs text-tertiary">On-demand keeps the prompt lean — only the name + description are shown, and the agent pulls the full content with loadSkill when relevant.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button color="primary" size="md" isDisabled={!draft.name.trim() || !draft.content.trim()} onClick={save}>
                            {draft.id ? "Save changes" : "Add skill"}
                        </Button>
                        <Button color="secondary" size="md" onClick={() => setDraft(null)}>
                            Cancel
                        </Button>
                    </div>
                </div>
            )}

            <div className="flex max-w-2xl flex-col gap-2">
                {skills.map((s) => (
                    <div key={s.id} className="flex items-start justify-between gap-4 rounded-lg p-3 ring-1 ring-secondary">
                        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => startEdit(s)}>
                            <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-medium text-secondary">{s.name}</span>
                                {s.builtin && <span className="rounded bg-utility-brand-50 px-1.5 py-0.5 text-xs font-medium text-utility-brand-700">Built-in</span>}
                                {s.mode === "onDemand" && <span className="rounded bg-utility-blue-50 px-1.5 py-0.5 text-xs font-medium text-utility-blue-700">On-demand</span>}
                                {(s.surfaces ?? ["dashboard", "canvas"]).map((sf) => (
                                    <span key={sf} className="rounded bg-tertiary px-1.5 py-0.5 text-xs text-tertiary">{sf}</span>
                                ))}
                            </div>
                            {s.description && <p className="mt-0.5 truncate text-xs text-tertiary">{s.description}</p>}
                        </button>
                        {!s.builtin && (
                            <Button color="tertiary" size="sm" iconLeading={Trash01} onClick={() => removeSkill(s.id)} aria-label={`Delete ${s.name}`} />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
