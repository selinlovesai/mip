/**
 * Workspace sidebar — brand header + collapse, page navigation grouped under a
 * "WORKSPACE" section heading, a "New page" affordance, and a user footer.
 *
 * Composed from Untitled UI subcomponents (NavItemBase, Avatar,
 * AvatarLabelGroup, ButtonUtility, Input) rather than the full
 * SidebarNavigationSimple/Slim, whose fixed positioning, mobile header, hover
 * secondary panels, and placeholder account cards are too opinionated for this
 * app's controlled flex layout with `collapsed`/`onToggle`.
 */

import { useState } from "react";
import { ChevronLeft, Copy01, DotsVertical, Grid01, Plus, Trash01 } from "@untitledui/icons";
import { Avatar } from "@/components/base/avatar/avatar";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { Input } from "@/components/base/input/input";
import { NavItemBase } from "@/components/application/app-navigation/base-components/nav-item";
import { useDashboard } from "@/mip/store";

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
    const { state, activePage, setActivePage, addPage, renamePage, deletePage, duplicatePage } = useDashboard();
    const [adding, setAdding] = useState(false);
    const [draft, setDraft] = useState("");
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameDraft, setRenameDraft] = useState("");

    const commitAdd = () => {
        const title = draft.trim();
        if (title) addPage(title);
        setDraft("");
        setAdding(false);
    };

    const startRename = (id: string, title: string) => {
        setRenamingId(id);
        setRenameDraft(title);
    };

    const commitRename = () => {
        if (renamingId) {
            const title = renameDraft.trim();
            if (title) renamePage(renamingId, title);
        }
        setRenamingId(null);
        setRenameDraft("");
    };

    const canDelete = state.pages.length > 1;

    if (collapsed) {
        return (
            <aside className="flex w-16 shrink-0 flex-col items-center gap-4 border-r border-secondary bg-primary py-4">
                <button onClick={onToggle} className="flex size-9 items-center justify-center rounded-lg bg-brand-solid font-bold text-white" aria-label="Expand sidebar">
                    M
                </button>
                {state.pages.map((page) => (
                    <ButtonUtility
                        key={page.id}
                        color={page.id === activePage.id ? "secondary" : "tertiary"}
                        icon={Grid01}
                        tooltip={page.title}
                        tooltipPlacement="right"
                        onClick={() => setActivePage(page.id)}
                    />
                ))}
            </aside>
        );
    }

    return (
        <aside className="flex w-64 shrink-0 flex-col border-r border-secondary bg-primary">
            <div className="flex items-center justify-between gap-2 px-4 py-4">
                <div className="flex items-center gap-2.5">
                    <Avatar size="md" rounded={false} initials="M" className="bg-brand-solid text-white" />
                    <span className="flex flex-col leading-tight">
                        <span className="text-sm font-semibold text-primary">Protocol Foundation</span>
                        <span className="text-xs text-tertiary">MIP runtime</span>
                    </span>
                </div>
                <ButtonUtility color="tertiary" size="xs" icon={ChevronLeft} tooltip="Collapse sidebar" onClick={onToggle} />
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-2">
                <div className="flex items-center justify-between px-2 py-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-quaternary">Workspace</span>
                    <ButtonUtility color="tertiary" size="xs" icon={Plus} tooltip="Add page" onClick={() => setAdding(true)} />
                </div>
                <ul className="flex flex-col gap-0.5">
                    {state.pages.map((page) =>
                        renamingId === page.id ? (
                            <li key={page.id} className="px-2 py-1">
                                <Input
                                    size="sm"
                                    autoFocus
                                    aria-label="Rename page"
                                    value={renameDraft}
                                    onChange={setRenameDraft}
                                    onBlur={commitRename}
                                    onKeyDown={(e) => e.key === "Enter" && commitRename()}
                                    placeholder="Page name…"
                                />
                            </li>
                        ) : (
                            <li key={page.id} className="group/page relative py-px">
                                <NavItemBase
                                    type="link"
                                    href="#"
                                    icon={Grid01}
                                    current={page.id === activePage.id}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setActivePage(page.id);
                                    }}
                                >
                                    {page.title}
                                </NavItemBase>
                                <div className="absolute inset-y-0 right-1.5 flex items-center opacity-0 transition-opacity group-hover/page:opacity-100">
                                    <Dropdown.Root>
                                        <ButtonUtility color="tertiary" size="xs" icon={DotsVertical} tooltip="Page actions" aria-label="Page actions" />
                                        <Dropdown.Popover>
                                            <Dropdown.Menu>
                                                <Dropdown.Item icon={Plus} label="Rename" onAction={() => startRename(page.id, page.title)} />
                                                <Dropdown.Item icon={Copy01} label="Duplicate" onAction={() => duplicatePage(page.id)} />
                                                {canDelete ? (
                                                    <Dropdown.Item icon={Trash01} label="Delete" onAction={() => deletePage(page.id)} />
                                                ) : null}
                                            </Dropdown.Menu>
                                        </Dropdown.Popover>
                                    </Dropdown.Root>
                                </div>
                            </li>
                        ),
                    )}
                    {adding ? (
                        <li className="px-2 py-1">
                            <Input
                                size="sm"
                                autoFocus
                                aria-label="Page name"
                                value={draft}
                                onChange={setDraft}
                                onBlur={commitAdd}
                                onKeyDown={(e) => e.key === "Enter" && commitAdd()}
                                placeholder="Page name…"
                            />
                        </li>
                    ) : null}
                </ul>
            </nav>

            <div className="flex items-center gap-2.5 border-t border-secondary px-4 py-3">
                <Avatar size="md" initials="SA" />
                <span className="flex flex-col leading-tight">
                    <span className="text-sm font-semibold text-primary">Super Admin</span>
                    <span className="text-xs text-tertiary">superadmin</span>
                </span>
            </div>
        </aside>
    );
}
