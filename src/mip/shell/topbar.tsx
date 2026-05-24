/**
 * Top bar — page title/breadcrumb on the left, action controls on the right:
 * add widget, toggle edit (drag/resize) mode, and open the AI assistant.
 */

import { Lock01, LockUnlocked01, PlusCircle, Stars01 } from "@untitledui/icons";
import { useDashboard } from "@/mip/store";
import { cx } from "@/utils/cx";

export function Topbar({ onAddWidget, onToggleChat, chatOpen }: { onAddWidget: () => void; onToggleChat: () => void; chatOpen: boolean }) {
    const { activePage, editMode, setEditMode } = useDashboard();

    return (
        <header className="flex items-center justify-between gap-4 border-b border-secondary bg-primary px-6 py-3.5">
            <div className="flex flex-col leading-tight">
                <span className="text-xs text-tertiary">Page</span>
                <h1 className="text-lg font-semibold text-primary">{activePage.title}</h1>
            </div>
            <div className="flex items-center gap-1.5">
                <button onClick={onAddWidget} className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-tertiary hover:bg-secondary hover:text-secondary" title="Add widget">
                    <PlusCircle className="size-5" />
                </button>
                <button
                    onClick={() => setEditMode(!editMode)}
                    className={cx("flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium", editMode ? "bg-brand-50 text-brand-secondary ring-1 ring-brand" : "text-tertiary hover:bg-secondary hover:text-secondary")}
                    title={editMode ? "Lock layout" : "Edit layout"}
                >
                    {editMode ? <LockUnlocked01 className="size-5" /> : <Lock01 className="size-5" />}
                </button>
                <button
                    onClick={onToggleChat}
                    className={cx("flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium", chatOpen ? "bg-brand-50 text-brand-secondary ring-1 ring-brand" : "text-tertiary hover:bg-secondary hover:text-secondary")}
                    title="AI assistant"
                >
                    <Stars01 className="size-5" />
                </button>
            </div>
        </header>
    );
}
