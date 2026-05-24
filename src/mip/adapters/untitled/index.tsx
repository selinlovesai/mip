/**
 * Untitled UI adapter — the first concrete `UiKitAdapter`.
 *
 * Register a renderer per widget type here as they are ported. Types not yet
 * mapped fall through to `fallback`, so the dashboard degrades gracefully
 * during the migration instead of crashing.
 */

import type { UiKitAdapter, WidgetRenderProps } from "@/mip/adapter/types";
import { KpiWidget } from "./kpi-widget";
import { WidgetCard } from "./widget-card";

function ComingSoon({ widget }: WidgetRenderProps) {
    return (
        <WidgetCard title={widget.title}>
            <div className="flex flex-1 items-center justify-center text-center text-sm text-tertiary">
                <span>
                    <span className="font-mono text-secondary">{widget.type}</span> renderer coming soon
                </span>
            </div>
        </WidgetCard>
    );
}

export const untitledAdapter: UiKitAdapter = {
    id: "untitled-ui",
    name: "Untitled UI",
    widgets: {
        kpi: KpiWidget,
    },
    fallback: ComingSoon,
};
