/**
 * Workspace sidebar — logo + collapse, page navigation grouped under a section
 * heading, a "New page" affordance, and a user footer. Mirrors the original
 * app's sidebar layout, restyled with Untitled UI tokens.
 */

import { useState } from "react";
import { ChevronLeft, Grid01, Plus } from "@untitledui/icons";
import { useDashboard } from "@/mip/store";
import { cx } from "@/utils/cx";

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
    const { state, activePage, setActivePage, addPage } = useDashboard();
    const [adding, setAdding] = useState(false);
    const [draft, setDraft] = useState("");

    const commitAdd = () => {
        const title = draft.trim();
        if (title) addPage(title);
        setDraft("");
        setAdding(false);
    };

    if (collapsed) {
        return (
            <aside className="flex w-16 shrink-0 flex-col items-center gap-4 border-r border-secondary bg-primary py-4">
                <button onClick={onToggle} className="flex size-9 items-center justify-center rounded-lg bg-brand-solid font-bold text-white" aria-label="Expand sidebar">
                    M
                </button>
                {state.pages.map((page) => (
                    <button key={page.id} onClick={() => setActivePage(page.id)} title={page.title} className={cx("flex size-9 items-center justify-center rounded-lg", page.id === activePage.id ? "bg-secondary text-brand-secondary" : "text-tertiary hover:bg-secondary")}>
                        <Grid01 className="size-5" />
                    </button>
                ))}
            </aside>
        );
    }

    return (
        <aside className="flex w-64 shrink-0 flex-col border-r border-secondary bg-primary">
            <div className="flex items-center justify-between gap-2 px-4 py-4">
                <div className="flex items-center gap-2.5">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-brand-solid font-bold text-white">M</span>
                    <span className="flex flex-col leading-tight">
                        <span className="text-sm font-semibold text-primary">Protocol Foundation</span>
                        <span className="text-xs text-tertiary">MIP runtime</span>
                    </span>
                </div>
                <button onClick={onToggle} className="flex size-7 items-center justify-center rounded-md text-tertiary hover:bg-secondary hover:text-secondary" aria-label="Collapse sidebar">
                    <ChevronLeft className="size-4" />
                </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-2">
                <div className="flex items-center justify-between px-2 py-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-quaternary">Workspace</span>
                    <button onClick={() => setAdding(true)} className="flex size-5 items-center justify-center rounded text-tertiary hover:bg-secondary hover:text-secondary" aria-label="Add page">
                        <Plus className="size-4" />
                    </button>
                </div>
                <ul className="flex flex-col gap-0.5">
                    {state.pages.map((page) => (
                        <li key={page.id}>
                            <button
                                onClick={() => setActivePage(page.id)}
                                className={cx("flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium", page.id === activePage.id ? "bg-secondary text-primary" : "text-tertiary hover:bg-secondary hover:text-secondary")}
                            >
                                <Grid01 className="size-4 shrink-0" />
                                <span className="truncate">{page.title}</span>
                            </button>
                        </li>
                    ))}
                    {adding ? (
                        <li className="px-2 py-1">
                            <input
                                autoFocus
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onBlur={commitAdd}
                                onKeyDown={(e) => e.key === "Enter" && commitAdd()}
                                placeholder="Page name…"
                                className="w-full rounded-md bg-secondary px-2 py-1.5 text-sm text-primary outline-none ring-1 ring-secondary focus:ring-brand"
                            />
                        </li>
                    ) : null}
                </ul>
            </nav>

            <div className="flex items-center gap-2.5 border-t border-secondary px-4 py-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-utility-brand-50 text-xs font-semibold text-utility-brand-700">SA</span>
                <span className="flex flex-col leading-tight">
                    <span className="text-sm font-semibold text-primary">Super Admin</span>
                    <span className="text-xs text-tertiary">superadmin</span>
                </span>
            </div>
        </aside>
    );
}
