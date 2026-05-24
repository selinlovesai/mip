/**
 * Settings surface — a dedicated page with its OWN inner sidebar (Profile,
 * Appearance, Connections, Apps, Assistant, Users) on the left and the active
 * section's content on the right. Rendered in the shell's main area (the outer
 * workspace sidebar + topbar stay in place).
 */

import { useState, type ComponentType } from "react";
import { ArrowLeft, Database01, LayoutAlt01, Palette, Stars01, User01, Users01 } from "@untitledui/icons";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { cx } from "@/utils/cx";
import { AppsTab } from "./tabs/apps-tab";
import { ConnectionsTab } from "./tabs/connections-tab";
import { AppearanceTab } from "./tabs/appearance-tab";
import { AssistantTab } from "./tabs/assistant-tab";
import { ProfileTab } from "./tabs/profile-tab";
import { UsersTab } from "./tabs/users-tab";

type TabId = "profile" | "appearance" | "connections" | "apps" | "assistant" | "users";

const TABS: Array<{ id: TabId; label: string; icon: ComponentType<{ className?: string }>; content: ComponentType }> = [
    { id: "profile", label: "Profile", icon: User01, content: ProfileTab },
    { id: "appearance", label: "Appearance", icon: Palette, content: AppearanceTab },
    { id: "connections", label: "Connections", icon: Database01, content: ConnectionsTab },
    { id: "apps", label: "Apps", icon: LayoutAlt01, content: AppsTab },
    { id: "assistant", label: "Assistant", icon: Stars01, content: AssistantTab },
    { id: "users", label: "Users", icon: Users01, content: UsersTab },
];

export function SettingsSurface({ onClose }: { onClose: () => void }) {
    const [active, setActive] = useState<TabId>("profile");
    const ActiveContent = TABS.find((t) => t.id === active)!.content;

    return (
        <div className="flex h-full min-h-0">
            {/* inner settings sidebar */}
            <nav className="flex w-60 shrink-0 flex-col gap-1 border-r border-secondary bg-primary p-4">
                <div className="mb-2 flex items-center gap-2">
                    <ButtonUtility color="tertiary" size="xs" icon={ArrowLeft} tooltip="Back to dashboard" onClick={onClose} />
                    <h2 className="text-lg font-semibold text-primary">Settings</h2>
                </div>
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActive(tab.id)}
                        className={cx(
                            "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium",
                            active === tab.id ? "bg-secondary text-primary" : "text-tertiary hover:bg-secondary hover:text-secondary",
                        )}
                    >
                        <tab.icon className="size-4 shrink-0" />
                        {tab.label}
                    </button>
                ))}
            </nav>

            {/* content */}
            <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto max-w-3xl p-8">
                    <ActiveContent />
                </div>
            </div>
        </div>
    );
}
