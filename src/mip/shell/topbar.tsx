/**
 * Top bar — page title/breadcrumb on the left, action controls on the right:
 * theme toggle, add widget, toggle edit (drag/resize) mode, and open the AI
 * assistant. Icon controls use the Untitled UI ButtonUtility component.
 */

import { ChevronRight, Grid01, Lock01, LockUnlocked01, Monitor04, Moon01, Phone01, PlusCircle, Settings01, Stars01, Sun } from "@untitledui/icons";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { useTheme } from "@/providers/theme-provider";
import { useDashboard } from "@/mip/store";
import { cx } from "@/utils/cx";

export function Topbar({ onAddWidget, onToggleChat, chatOpen, onOpenDashboardSettings, dashboardSettingsOpen, onOpenTemplates, sidebarCollapsed, onExpandSidebar }: { onAddWidget: () => void; onToggleChat: () => void; chatOpen: boolean; onOpenDashboardSettings: () => void; dashboardSettingsOpen: boolean; onOpenTemplates: () => void; sidebarCollapsed: boolean; onExpandSidebar: () => void }) {
    const { activePage, editMode, setEditMode, viewMode, setViewMode } = useDashboard();
    const { theme, setTheme } = useTheme();
    const isDark = theme === "dark" || (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    // Active toggle look: transparent fill + brand ring/text (reads in light AND dark).
    const activeClass = "bg-transparent text-brand-secondary ring-1 ring-brand hover:text-brand-secondary";

    return (
        <header className="flex items-center justify-between gap-4 border-b border-secondary bg-primary px-6 py-3.5">
            <div className="flex items-center gap-2.5">
                {sidebarCollapsed ? <ButtonUtility color="tertiary" size="sm" icon={ChevronRight} tooltip="Open sidebar" onClick={onExpandSidebar} /> : null}
                <div className="flex flex-col leading-tight">
                    <span className="text-xs text-tertiary">Page</span>
                    <h1 className="text-lg font-semibold text-primary">{activePage.title}</h1>
                </div>
            </div>
            <div className="flex items-center gap-1.5">
                <ButtonUtility
                    color="tertiary"
                    icon={isDark ? Sun : Moon01}
                    tooltip={isDark ? "Light mode" : "Dark mode"}
                    onClick={() => setTheme(isDark ? "light" : "dark")}
                />
                <ButtonUtility
                    color="tertiary"
                    icon={viewMode === "feed" ? Monitor04 : Phone01}
                    tooltip={viewMode === "feed" ? "Layout view" : "Responsive (feed) view"}
                    className={cx(viewMode === "feed" && activeClass)}
                    onClick={() => setViewMode(viewMode === "feed" ? "layout" : "feed")}
                />
                <ButtonUtility color="tertiary" icon={Settings01} tooltip="Dashboard settings" className={cx(dashboardSettingsOpen && activeClass)} onClick={onOpenDashboardSettings} />
                <ButtonUtility color="tertiary" icon={Grid01} tooltip="Templates" onClick={onOpenTemplates} />
                <ButtonUtility color="tertiary" icon={PlusCircle} tooltip="Add widget" onClick={onAddWidget} />
                <ButtonUtility
                    color="tertiary"
                    icon={editMode ? LockUnlocked01 : Lock01}
                    tooltip={editMode ? "Lock layout" : "Edit layout"}
                    className={cx(editMode && activeClass)}
                    onClick={() => setEditMode(!editMode)}
                />
                <ButtonUtility
                    color="tertiary"
                    icon={Stars01}
                    tooltip="AI assistant"
                    className={cx(chatOpen && activeClass)}
                    onClick={onToggleChat}
                />
            </div>
        </header>
    );
}
