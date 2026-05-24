/**
 * Tabs widget — Untitled UI adapter. Renders `settings.tabs`
 * ([{label, content}]) with an active-tab underline and the selected panel's
 * content below. Content is plain text in this proof; nested widgets can be
 * supported later.
 */

import { useState } from "react";
import type { WidgetRenderProps } from "@/mip/adapter/types";
import { cx } from "@/utils/cx";
import { WidgetCard } from "./widget-card";

interface Tab {
    label: string;
    content: string;
}

function resolveTabs(value: unknown): Tab[] {
    if (!Array.isArray(value)) return [];
    return value.map((item, index) => {
        const record = (item ?? {}) as Record<string, unknown>;
        return { label: String(record.label ?? `Tab ${index + 1}`), content: String(record.content ?? "") };
    });
}

export function TabsWidget({ widget }: WidgetRenderProps) {
    const tabs = resolveTabs(widget.settings?.tabs);
    const [active, setActive] = useState(0);

    return (
        <WidgetCard title={widget.title}>
            {tabs.length === 0 ? (
                <div className="flex flex-1 items-center justify-center text-sm text-tertiary">No tabs configured.</div>
            ) : (
                <div className="flex flex-1 flex-col">
                    <div className="flex gap-1 border-b border-secondary" role="tablist">
                        {tabs.map((tab, index) => (
                            <button
                                key={tab.label}
                                role="tab"
                                aria-selected={index === active}
                                onClick={() => setActive(index)}
                                className={cx(
                                    "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                                    index === active ? "border-brand text-brand-secondary" : "border-transparent text-tertiary hover:text-secondary",
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex-1 pt-3 text-sm text-secondary" role="tabpanel">
                        {tabs[active]?.content}
                    </div>
                </div>
            )}
        </WidgetCard>
    );
}
