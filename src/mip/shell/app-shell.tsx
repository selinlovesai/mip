/**
 * App shell — the full dashboard experience: sidebar + topbar + draggable
 * widget grid, with the AI assistant panel and widget picker. Wraps everything
 * in the dashboard store and the Untitled UI kit adapter, so the entire surface
 * is themeable and kit-swappable.
 */

import { useEffect, useState } from "react";
import { untitledAdapter } from "@/mip/adapters/untitled";
import { UiKitProvider } from "@/mip/adapter/registry";
import { DashboardProvider } from "@/mip/store";
import { applyAccent, getSavedAccent } from "./appearance";
import { ChatPanel } from "./chat-panel";
import { DashboardGrid } from "./dashboard-grid";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { WidgetPicker } from "./widget-picker";

export const AppShell = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [chatOpen, setChatOpen] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);

    useEffect(() => {
        applyAccent(getSavedAccent());
    }, []);

    return (
        <UiKitProvider adapter={untitledAdapter}>
            <DashboardProvider>
                <div className="flex h-dvh overflow-hidden bg-secondary">
                    <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((v) => !v)} />
                    <div className="flex min-w-0 flex-1 flex-col">
                        <Topbar onAddWidget={() => setPickerOpen(true)} onToggleChat={() => setChatOpen((v) => !v)} chatOpen={chatOpen} />
                        <main className="min-h-0 flex-1 overflow-y-auto p-6">
                            <DashboardGrid />
                        </main>
                    </div>
                    <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
                    <WidgetPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
                </div>
            </DashboardProvider>
        </UiKitProvider>
    );
};
