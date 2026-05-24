/**
 * Tabs widget — Untitled UI adapter. Renders `settings.tabs`
 * ([{label, content}]) with the Untitled `Tabs` component (underline style)
 * and the selected panel's content below. Content is plain text in this proof;
 * nested widgets can be supported later.
 */

import type { WidgetRenderProps } from "@/mip/adapter/types";
import { Tabs } from "@/components/application/tabs/tabs";
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

    return (
        <WidgetCard title={widget.title}>
            {tabs.length === 0 ? (
                <div className="flex flex-1 items-center justify-center text-sm text-tertiary">No tabs configured.</div>
            ) : (
                <Tabs className="flex-1">
                    <Tabs.List type="underline" items={tabs.map((tab, index) => ({ id: String(index), label: tab.label }))}>
                        {(item) => <Tabs.Item id={item.id}>{item.label}</Tabs.Item>}
                    </Tabs.List>
                    {tabs.map((tab, index) => (
                        <Tabs.Panel key={index} id={String(index)} className="flex-1 pt-3 text-sm text-secondary">
                            {tab.content}
                        </Tabs.Panel>
                    ))}
                </Tabs>
            )}
        </WidgetCard>
    );
}
