/**
 * Dashboard Settings — the PER-PAGE settings modal opened from the topbar gear
 * (distinct from the system-wide Settings surface in the sidebar user menu).
 * Three tabs mirroring mip's `DashboardSettingsModal`:
 *   · General           — title / page id / description / layout mode / AI context
 *   · Access            — per-role page access + AI assistant page access
 *   · Dynamic Variables — typed input variables for parameterized pages
 * Edits are staged in a local draft and committed via `store.updatePageSettings`.
 */

import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Eye, LayoutAlt01, Plus, Trash01, Variable } from "@untitledui/icons";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { CloseButton } from "@/components/base/buttons/close-button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { TextArea } from "@/components/base/textarea/textarea";
import { dbAvailable, dbGet } from "@/mip/api";
import { useDashboard, type DashboardPage, type PageAccessLevel, type PageVariable } from "@/mip/store";
import { cx } from "@/utils/cx";

type TabId = "general" | "access" | "variables";

const TABS: Array<{ id: TabId; label: string; icon: ComponentType<{ className?: string }> }> = [
    { id: "general", label: "General", icon: LayoutAlt01 },
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
    const [tab, setTab] = useState<TabId>("general");
    const [draft, setDraft] = useState<DashboardPage>(activePage);
    const [idError, setIdError] = useState<string | null>(null);

    // Re-sync the draft whenever the modal (re)opens or the active page changes.
    useEffect(() => {
        if (open) {
            setDraft(activePage);
            setTab("general");
            setIdError(null);
        }
    }, [open, activePage]);

    const permissions = useMemo<Record<string, PageAccessLevel>>(() => {
        const base: Record<string, PageAccessLevel> = {};
        for (const role of ROLES) base[role.id] = role.locked ? "edit" : (draft.permissions?.[role.id] ?? role.defaultAccess);
        return base;
    }, [draft.permissions]);

    const setDraftField = <K extends keyof DashboardPage>(key: K, value: DashboardPage[K]) => setDraft((d) => ({ ...d, [key]: value }));

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
            permissions,
            aiAccess: draft.aiAccess ?? true,
            variables,
        });
        onClose();
    };

    return (
        <ModalOverlay isOpen={open} onOpenChange={(isOpen) => !isOpen && onClose()} isDismissable>
            <Modal className="max-w-3xl">
                <Dialog>
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
                            <div className="min-h-0 flex-1 overflow-y-auto p-5">
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
                                        <TextArea
                                            label="AI assistant context (system prompt)"
                                            hint="Added to the assistant's system prompt whenever this dashboard is open."
                                            value={draft.systemPrompt ?? ""}
                                            onChange={(v) => setDraftField("systemPrompt", v)}
                                            rows={4}
                                            placeholder="e.g. This page tracks SEO metrics; prefer concise, data-backed answers."
                                        />
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
