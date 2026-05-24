/**
 * App shell — the full dashboard experience: sidebar + topbar + draggable
 * widget grid, with the AI assistant panel and widget picker. The main area
 * swaps to the dedicated Settings surface when the topbar gear is opened.
 * Wraps everything in the dashboard + settings stores and the Untitled UI kit
 * adapter, so the entire surface is themeable and kit-swappable.
 */

import { useEffect, useState } from "react";
import { untitledAdapter } from "@/mip/adapters/untitled";
import { UiKitProvider } from "@/mip/adapter/registry";
import { DashboardProvider } from "@/mip/store";
import { SettingsProvider } from "@/mip/settings/settings-store";
import { SettingsSurface, type SettingsTabId } from "@/mip/settings/settings-surface";
import { applyAccent, getSavedAccent } from "./appearance";
import { ChatPanel } from "./chat-panel";
import { DashboardGrid } from "./dashboard-grid";
import { DashboardSettingsModal } from "./dashboard-settings-modal";
import { Sidebar } from "./sidebar";
import { TemplatesModal } from "./templates-modal";
import { Topbar } from "./topbar";
import { WidgetPicker } from "./widget-picker";

export const AppShell = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [chatOpen, setChatOpen] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settingsTab, setSettingsTab] = useState<SettingsTabId>("profile");
    const [dashboardSettingsOpen, setDashboardSettingsOpen] = useState(false);
    const [templatesOpen, setTemplatesOpen] = useState(false);

    const openSettings = (tab: SettingsTabId = "profile") => {
        setSettingsTab(tab);
        setSettingsOpen(true);
    };

    useEffect(() => {
        applyAccent(getSavedAccent());
    }, []);

    return (
        <UiKitProvider adapter={untitledAdapter}>
            <SettingsProvider>
                <DashboardProvider>
                    <div className="flex h-dvh overflow-hidden bg-secondary">
                        <div className={`shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out ${sidebarCollapsed ? "w-0" : "w-64"}`}>
                            <Sidebar onToggle={() => setSidebarCollapsed(true)} onOpenSettings={openSettings} />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col">
                            <Topbar
                                onAddWidget={() => setPickerOpen(true)}
                                onToggleChat={() => setChatOpen((v) => !v)}
                                chatOpen={chatOpen}
                                onOpenDashboardSettings={() => setDashboardSettingsOpen(true)}
                                dashboardSettingsOpen={dashboardSettingsOpen}
                                onOpenTemplates={() => setTemplatesOpen(true)}
                                sidebarCollapsed={sidebarCollapsed}
                                onExpandSidebar={() => setSidebarCollapsed(false)}
                            />
                            <main className="min-h-0 flex-1 overflow-hidden">
                                {settingsOpen ? (
                                    <SettingsSurface onClose={() => setSettingsOpen(false)} initialTab={settingsTab} />
                                ) : (
                                    <div className="h-full overflow-y-auto p-6">
                                        <DashboardGrid />
                                    </div>
                                )}
                            </main>
                        </div>
                        <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
                        <WidgetPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
                        <DashboardSettingsModal open={dashboardSettingsOpen} onClose={() => setDashboardSettingsOpen(false)} />
                        <TemplatesModal open={templatesOpen} onClose={() => setTemplatesOpen(false)} onOpenConnections={() => openSettings("connections")} />
                    </div>
                </DashboardProvider>
            </SettingsProvider>
        </UiKitProvider>
    );
};
