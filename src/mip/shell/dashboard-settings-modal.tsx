/**
 * Dashboard Settings — the PER-PAGE settings modal opened from the topbar gear
 * (distinct from the system-wide Settings surface in the sidebar user menu).
 * Three tabs mirroring mip's `DashboardSettingsModal`:
 *   · General           — title / page id / description / layout mode / AI context
 *   · Access            — per-role page access + AI assistant page access
 *   · Dynamic Variables — typed input variables for parameterized pages
 * Edits are staged in a local draft and committed via `store.updatePageSettings`.
 */

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { Eye, LayoutAlt01, Plus, Stars01, Trash01, Variable } from "@untitledui/icons";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { CloseButton } from "@/components/base/buttons/close-button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { TextArea } from "@/components/base/textarea/textarea";
import { chat, dbAvailable, dbGet } from "@/mip/api";
import { useDashboard, type DashboardPage, type PageAccessLevel, type PageVariable } from "@/mip/store";
import { useSettings } from "@/mip/settings/settings-store";
import { ModelField } from "@/mip/settings/model-field";
import { DEFAULT_PAGE_CONTEXT, type PageAgentConfig } from "@/mip/agent";
import { cx } from "@/utils/cx";

type TabId = "general" | "agent" | "access" | "variables";

const TABS: Array<{ id: TabId; label: string; icon: ComponentType<{ className?: string }> }> = [
    { id: "general", label: "General", icon: LayoutAlt01 },
    { id: "agent", label: "Agent", icon: Stars01 },
    { id: "access", label: "Access", icon: Eye },
    { id: "variables", label: "Dynamic Variables", icon: Variable },
];

const LAYOUT_MODES = [
    { id: "dashboard", label: "Dashboard (sidebar + topbar)" },
    { id: "fullpage", label: "Fullpage (standalone)" },
];

const ACCESS_OPTIONS: Array<{ id: PageAccessLevel; label: string }> = [
    { id: "edit", label: "Can edit" },
    { id: "view", label: "View only" },
    { id: "none", label: "No access" },
];

const VAR_SOURCES = [
    { id: "query", label: "$_GET / Query" },
    { id: "path", label: "Path Variable" },
    { id: "body", label: "Body JSON" },
];

// Roles whose page access can be configured. Admin is locked to "edit".
const ROLES: Array<{ id: string; label: string; locked?: boolean; defaultAccess: PageAccessLevel }> = [
    { id: "admin", label: "Admin", locked: true, defaultAccess: "edit" },
    { id: "editor", label: "Editor", defaultAccess: "edit" },
    { id: "viewer", label: "Viewer", defaultAccess: "view" },
    { id: "public", label: "Public", defaultAccess: "none" },
];

const cardCls = "flex flex-col gap-4 rounded-xl bg-secondary p-4 ring-1 ring-secondary";

export function DashboardSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { activePage, updatePageSettings, renamePageId, isPageIdAvailable } = useDashboard();
    const { aiConnections, connections, skills, assistant, getConnection } = useSettings();
    const [tab, setTab] = useState<TabId>("general");
    const [draft, setDraft] = useState<DashboardPage>(activePage);
    const [idError, setIdError] = useState<string | null>(null);
    // Keep the scroll position when a control (e.g. a checkbox) takes focus —
    // react-aria focuses a hidden input which would scroll it into view. The
    // SCROLLER here is the ModalOverlay (overflow-y-auto), not just our body, so
    // we lock every scrollable ancestor.
    const bodyRef = useRef<HTMLDivElement>(null);
    const lockedScroll = useRef<{ el: HTMLElement; top: number }[]>([]);
    const captureScroll = () => {
        const out: { el: HTMLElement; top: number }[] = [];
        for (let el: HTMLElement | null = bodyRef.current; el; el = el.parentElement) {
            if (el.scrollHeight > el.clientHeight) out.push({ el, top: el.scrollTop });
        }
        lockedScroll.current = out;
    };
    const restoreScroll = () => lockedScroll.current.forEach(({ el, top }) => (el.scrollTop = top));

    // Re-sync the draft ONLY on the open transition — never mid-edit, so a
    // background activePage change can't wipe in-progress edits (which looked
    // like "settings don't save").
    const wasOpen = useRef(false);
    useEffect(() => {
        if (open && !wasOpen.current) {
            setDraft(activePage);
            setTab("general");
            setIdError(null);
        }
        wasOpen.current = open;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, activePage]);

    const permissions = useMemo<Record<string, PageAccessLevel>>(() => {
        const base: Record<string, PageAccessLevel> = {};
        for (const role of ROLES) base[role.id] = role.locked ? "edit" : (draft.permissions?.[role.id] ?? role.defaultAccess);
        return base;
    }, [draft.permissions]);

    const setDraftField = <K extends keyof DashboardPage>(key: K, value: DashboardPage[K]) => setDraft((d) => ({ ...d, [key]: value }));

    // --- Agent (per-dashboard) ---
    const agent = draft.agent ?? {};
    const setAgentField = <K extends keyof PageAgentConfig>(key: K, value: PageAgentConfig[K]) =>
        setDraft((d) => ({ ...d, agent: { ...d.agent, [key]: value } }));
    // The connection whose models to list: this dashboard's override, else the
    // global default, else the first AI connection.
    const effectiveConn = getConnection(agent.connectionId ?? assistant.connectionId ?? aiConnections[0]?.id ?? "");

    // --- Generate a system prompt with the AI (the sparkle button on the
    // context textarea). Sends the dashboard title + whatever is already in the
    // box as guidance, and the model writes a polished assistant context. ---
    const [generatingPrompt, setGeneratingPrompt] = useState(false);
    const [promptError, setPromptError] = useState<string | null>(null);
    const generateSystemPrompt = async () => {
        if (generatingPrompt) return;
        const conn = effectiveConn;
        if (!conn) {
            setPromptError("Connect an AI model first (Settings → Assistant).");
            return;
        }
        setGeneratingPrompt(true);
        setPromptError(null);
        const widgetList = draft.widgets.map((w) => `${w.type}${w.title ? ` (${w.title})` : ""}`).join(", ") || "none yet";
        const userMsg = [
            `Dashboard title: "${draft.title || "(untitled)"}".`,
            draft.description ? `Description: ${draft.description}.` : "",
            isCanvas ? "" : `Widgets present: ${widgetList}.`,
            (draft.systemPrompt ?? "").trim() ? `Existing notes / draft to build on:\n${(draft.systemPrompt ?? "").trim()}` : "No draft yet — infer the dashboard's purpose from the title.",
        ]
            .filter(Boolean)
            .join("\n");
        const sys =
            "You write the SYSTEM PROMPT (assistant context) for an AI assistant that helps build and edit a specific live widget dashboard. " +
            "Using the dashboard's title, description, widgets, and any draft notes, produce a concise, high-signal context that tells the assistant the dashboard's purpose, audience, the kind of data/widgets to favour, tone, and any constraints. " +
            "Write in the second person addressed to the assistant (e.g. \"You help…\"). 3–6 sentences, plain text only — no markdown headings, no preamble, no quotes around the result. Output ONLY the prompt text.";
        const res = await chat({
            provider: conn.aiProvider ?? "openai",
            baseUrl: conn.baseUrl ?? "",
            apiKey: conn.auth?.token ?? conn.auth?.keyValue,
            model: agent.model ?? assistant.model ?? conn.aiModel ?? "gpt-4o-mini",
            messages: [{ role: "user", content: userMsg }],
            system: sys,
        });
        setGeneratingPrompt(false);
        if (res.ok && res.content?.trim()) setDraftField("systemPrompt", res.content.trim());
        else setPromptError(typeof res.error === "string" ? res.error : "Couldn't generate a prompt. Check the model connection.");
    };

    const isCanvas = draft.kind === "canvas";
    const surfaceSkills = skills.filter((s) => !s.surfaces || s.surfaces.includes(isCanvas ? "canvas" : "dashboard"));
    // A skill is active when: built-in & not disabled, or custom & enabled.
    const skillActive = (id: string, builtin?: boolean) =>
        builtin ? !(agent.disabledSkillIds ?? []).includes(id) : (agent.enabledSkillIds ?? []).includes(id);
    const toggleSkill = (id: string, builtin: boolean | undefined, on: boolean) => {
        if (builtin) {
            const disabled = new Set(agent.disabledSkillIds ?? []);
            if (on) disabled.delete(id);
            else disabled.add(id);
            setAgentField("disabledSkillIds", [...disabled]);
        } else {
            const enabled = new Set(agent.enabledSkillIds ?? []);
            if (on) enabled.add(id);
            else enabled.delete(id);
            setAgentField("enabledSkillIds", [...enabled]);
        }
    };
    const callable = agent.callableConnectionIds;
    const toggleCallable = (id: string, on: boolean) => {
        // Undefined = "all allowed"; first explicit toggle materializes the list.
        const base = callable ?? connections.map((c) => c.id);
        const next = on ? [...new Set([...base, id])] : base.filter((c) => c !== id);
        setAgentField("callableConnectionIds", next);
    };

    const setRoleAccess = (role: string, level: PageAccessLevel) =>
        setDraft((d) => ({ ...d, permissions: { ...permissions, ...d.permissions, [role]: level } }));

    const variables = draft.variables ?? [];
    const addVariable = () =>
        setDraft((d) => ({ ...d, variables: [...(d.variables ?? []), { id: `var-${Date.now()}`, name: "", source: "query", required: false }] }));
    const updateVariable = (id: string, patch: Partial<PageVariable>) =>
        setDraft((d) => ({ ...d, variables: (d.variables ?? []).map((v) => (v.id === id ? { ...v, ...patch } : v)) }));
    const removeVariable = (id: string) => setDraft((d) => ({ ...d, variables: (d.variables ?? []).filter((v) => v.id !== id) }));

    const save = async () => {
        const nextId = draft.id.trim();
        // Page ID validation: non-empty, unique vs. other pages, and (when the
        // DB is reachable) not already taken by a different dashboard row.
        if (nextId !== activePage.id) {
            if (!isPageIdAvailable(nextId, activePage.id)) {
                setIdError("That Page ID is already used by another page.");
                setTab("general");
                return;
            }
            if (await dbAvailable()) {
                const existing = await dbGet("dashboards", nextId);
                if (existing) {
                    setIdError("That Page ID already exists in the database.");
                    setTab("general");
                    return;
                }
            }
            if (!renamePageId(activePage.id, nextId)) {
                setIdError("Couldn't change the Page ID — it may already be in use.");
                setTab("general");
                return;
            }
        }
        updatePageSettings(nextId, {
            title: draft.title.trim() || activePage.title,
            description: draft.description,
            layoutMode: draft.layoutMode ?? "dashboard",
            systemPrompt: draft.systemPrompt,
            agent: draft.agent,
            permissions,
            aiAccess: draft.aiAccess ?? true,
            variables,
        });
        onClose();
    };

    return (
        <ModalOverlay isOpen={open} onOpenChange={(isOpen) => !isOpen && onClose()} isDismissable>
            <Modal className="max-w-3xl">
                <Dialog aria-label="Dashboard Settings">
                    <div className="flex max-h-[80vh] w-full flex-col overflow-hidden rounded-xl bg-primary shadow-xl ring-1 ring-secondary">
                        <div className="flex items-center justify-between border-b border-secondary px-5 py-4">
                            <h2 className="text-lg font-semibold text-primary">Dashboard Settings</h2>
                            <CloseButton onPress={onClose} label="Close" />
                        </div>

                        <div className="flex min-h-0 flex-1">
                            {/* left tabs */}
                            <nav className="flex w-52 shrink-0 flex-col gap-1 border-r border-secondary bg-primary p-3">
                                {TABS.map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => setTab(t.id)}
                                        className={cx(
                                            "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium",
                                            tab === t.id ? "bg-secondary text-primary" : "text-tertiary hover:bg-secondary hover:text-secondary",
                                        )}
                                    >
                                        <t.icon className="size-4 shrink-0" />
                                        {t.label}
                                    </button>
                                ))}
                            </nav>

                            {/* content */}
                            <div
                                ref={bodyRef}
                                onPointerDownCapture={captureScroll}
                                onFocusCapture={() => {
                                    restoreScroll();
                                    requestAnimationFrame(restoreScroll);
                                }}
                                className="min-h-0 flex-1 overflow-y-auto p-5"
                            >
                                {tab === "general" ? (
                                    <div className="flex flex-col gap-4">
                                        <h3 className="text-sm font-semibold text-primary">Page Settings</h3>
                                        <Input label="Title" value={draft.title} onChange={(v) => setDraftField("title", v)} placeholder="Page title" />
                                        <Input
                                            label="Page ID"
                                            value={draft.id}
                                            onChange={(v) => {
                                                setDraftField("id", v);
                                                setIdError(null);
                                            }}
                                            isInvalid={!!idError}
                                            hint={idError ?? "Unique identifier for this page (used in URLs and the DB)."}
                                        />
                                        <TextArea
                                            label="Description"
                                            value={draft.description ?? ""}
                                            onChange={(v) => setDraftField("description", v)}
                                            rows={2}
                                            placeholder="What this page is for…"
                                        />
                                        <Select
                                            label="Layout Mode"
                                            selectedKey={draft.layoutMode ?? "dashboard"}
                                            items={LAYOUT_MODES}
                                            onSelectionChange={(key) => setDraftField("layoutMode", key as DashboardPage["layoutMode"])}
                                            hint="Fullpage renders this page standalone, without the workspace sidebar + topbar."
                                        >
                                            {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                                        </Select>
                                    </div>
                                ) : null}

                                {tab === "agent" ? (
                                    <div className="flex flex-col gap-5">
                                        <div>
                                            <h3 className="text-sm font-semibold text-primary">Agent</h3>
                                            <p className="mt-1 text-sm text-tertiary">
                                                This dashboard's assistant. Anything left unset falls back to the global default (Settings → Assistant).
                                            </p>
                                        </div>

                                        <div className="flex flex-col gap-3">
                                            <Select
                                                label="AI model connection"
                                                placeholder="Use global default"
                                                selectedKey={agent.connectionId ?? null}
                                                items={[{ id: "", label: "Use global default" }, ...aiConnections.map((c) => ({ id: c.id, label: c.name }))]}
                                                onSelectionChange={(key) => setAgentField("connectionId", String(key) || undefined)}
                                            >
                                                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                                            </Select>
                                            <ModelField
                                                conn={effectiveConn}
                                                value={agent.model ?? ""}
                                                onChange={(v) => setAgentField("model", v.trim() || undefined)}
                                                placeholder="Use global / connection default"
                                                hint="Models from the selected provider; you can also type a specific id."
                                            />
                                        </div>

                                        <div className="relative">
                                            <TextArea
                                                label="AI assistant context (system prompt)"
                                                hint={promptError ?? "Injected at the top of this dashboard's agent prompt. Leave blank to use the default shown below."}
                                                isInvalid={!!promptError}
                                                value={draft.systemPrompt ?? ""}
                                                onChange={(v) => { setDraftField("systemPrompt", v); setPromptError(null); }}
                                                rows={5}
                                                placeholder={DEFAULT_PAGE_CONTEXT}
                                                textAreaClassName="pr-10"
                                            />
                                            {/* Generate a polished system prompt from the title + current draft. */}
                                            <ButtonUtility
                                                type="button"
                                                color="tertiary"
                                                size="xs"
                                                icon={Stars01}
                                                isDisabled={generatingPrompt}
                                                onClick={generateSystemPrompt}
                                                tooltip={generatingPrompt ? "Writing…" : "Write this for me with AI"}
                                                className={cx("absolute right-2 top-8", generatingPrompt && "animate-pulse")}
                                            />
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <span className="text-xs font-semibold uppercase tracking-wide text-quaternary">Skills</span>
                                            <p className="text-xs text-tertiary">Built-in skills are on by default; turn any off, or enable your own from the library (Settings → Skills).</p>
                                            <div className={cardCls}>
                                                {surfaceSkills.length === 0 ? (
                                                    <p className="text-sm text-tertiary">No skills for this surface.</p>
                                                ) : (
                                                    surfaceSkills.map((s) => (
                                                        <label key={s.id} className="flex items-start gap-2.5">
                                                            <Checkbox isSelected={skillActive(s.id, s.builtin)} onChange={(on) => toggleSkill(s.id, s.builtin, on)} />
                                                            <span className="flex min-w-0 flex-col">
                                                                <span className="flex items-center gap-2 text-sm font-medium text-secondary">
                                                                    {s.name}
                                                                    {s.builtin && <span className="rounded bg-utility-brand-50 px-1.5 py-0.5 text-xs font-medium text-utility-brand-700">Built-in</span>}
                                                                </span>
                                                                {s.description && <span className="text-xs text-tertiary">{s.description}</span>}
                                                            </span>
                                                        </label>
                                                    ))
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <span className="text-xs font-semibold uppercase tracking-wide text-quaternary">Connections this agent can use</span>
                                            <p className="text-xs text-tertiary">Which saved APIs the agent may call or bind widgets to. All allowed by default.</p>
                                            <div className={cardCls}>
                                                {connections.length === 0 ? (
                                                    <p className="text-sm text-tertiary">No connections yet.</p>
                                                ) : (
                                                    connections.map((c) => (
                                                        <label key={c.id} className="flex items-start gap-2.5">
                                                            <Checkbox isSelected={(callable ?? connections.map((x) => x.id)).includes(c.id)} onChange={(on) => toggleCallable(c.id, on)} />
                                                            <span className="flex min-w-0 flex-col">
                                                                <span className="truncate text-sm font-medium text-secondary">{c.name}</span>
                                                                {c.baseUrl ? <span className="truncate font-mono text-xs text-tertiary">{c.baseUrl}</span> : <span className="text-xs text-tertiary">{c.type}</span>}
                                                            </span>
                                                        </label>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : null}

                                {tab === "access" ? (
                                    <div className="flex flex-col gap-4">
                                        <div>
                                            <h3 className="text-sm font-semibold text-primary">Access Control</h3>
                                            <p className="mt-1 text-sm text-tertiary">Set each role's access to this page. Admins always have edit access and can't be restricted.</p>
                                        </div>
                                        <div className={cardCls}>
                                            {ROLES.map((role) => (
                                                <div key={role.id} className="grid grid-cols-1 items-center gap-3 sm:grid-cols-2">
                                                    <span className="text-sm font-medium text-secondary">{role.label}</span>
                                                    <Select
                                                        aria-label={`${role.label} access`}
                                                        selectedKey={permissions[role.id]}
                                                        items={ACCESS_OPTIONS}
                                                        isDisabled={role.locked}
                                                        onSelectionChange={(key) => setRoleAccess(role.id, key as PageAccessLevel)}
                                                    >
                                                        {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                                                    </Select>
                                                </div>
                                            ))}
                                        </div>
                                        <div className={cardCls}>
                                            <Checkbox
                                                isSelected={draft.aiAccess ?? true}
                                                onChange={(selected) => setDraftField("aiAccess", selected)}
                                                label="Allow the assistant to access this page"
                                                hint="When off, this page is hidden from the assistant's tools (it can't read or edit it)."
                                            />
                                        </div>
                                    </div>
                                ) : null}

                                {tab === "variables" ? (
                                    <div className="flex flex-col gap-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="text-sm font-semibold text-primary">Dynamic Variables</h3>
                                                <p className="mt-1 text-sm text-tertiary">Define input variables for this dynamic page.</p>
                                            </div>
                                            <Button color="secondary" size="sm" iconLeading={Plus} onClick={addVariable}>
                                                Add Variable
                                            </Button>
                                        </div>
                                        {variables.length === 0 ? (
                                            <p className="rounded-lg bg-secondary px-4 py-6 text-center text-sm text-tertiary ring-1 ring-secondary">No variables defined.</p>
                                        ) : (
                                            <div className="flex flex-col gap-3">
                                                {variables.map((v) => (
                                                    <div key={v.id} className="flex items-end gap-3 rounded-lg bg-secondary p-3 ring-1 ring-secondary">
                                                        <div className="flex-1">
                                                            <Input aria-label="Variable name" label="Variable name" value={v.name} onChange={(val) => updateVariable(v.id, { name: val })} placeholder="userId" />
                                                        </div>
                                                        <div className="w-44">
                                                            <Select
                                                                aria-label="Source"
                                                                label="Source"
                                                                selectedKey={v.source}
                                                                items={VAR_SOURCES}
                                                                onSelectionChange={(key) => updateVariable(v.id, { source: key as PageVariable["source"] })}
                                                            >
                                                                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                                                            </Select>
                                                        </div>
                                                        <div className="pb-2.5">
                                                            <Checkbox isSelected={v.required} onChange={(sel) => updateVariable(v.id, { required: sel })} label="Required" />
                                                        </div>
                                                        <ButtonUtility color="tertiary" size="sm" icon={Trash01} tooltip="Delete variable" onClick={() => removeVariable(v.id)} />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 border-t border-secondary px-5 py-4">
                            <Button color="secondary" size="md" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button color="primary" size="md" onClick={() => void save()}>
                                Save Settings
                            </Button>
                        </div>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
}
