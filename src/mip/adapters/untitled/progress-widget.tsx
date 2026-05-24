/**
 * Progress widget — Untitled UI adapter. A value/target bar with a percentage
 * readout. Reads `value`, `target`, and optional `label` from settings (or the
 * fetched payload), mirroring the original app's progress widget.
 */

import { ProgressBar } from "@/components/base/progress-indicators/progress-indicators";
import type { WidgetRenderProps } from "@/mip/adapter/types";
import { formatNumber } from "./format";
import { WidgetCard } from "./widget-card";

export function ProgressWidget({ widget, dataState }: WidgetRenderProps) {
    const settings = widget.settings ?? {};
    const fetched = dataState.status === "success" && dataState.data != null ? (dataState.data as Record<string, unknown>) : undefined;

    const value = Number(fetched?.value ?? settings.value ?? 0) || 0;
    const target = Number(fetched?.target ?? settings.target ?? 100) || 100;
    const pct = Math.max(0, Math.min(100, target === 0 ? 0 : (value / target) * 100));
    const label = typeof settings.label === "string" ? settings.label : `${formatNumber(value)} / ${formatNumber(target)}`;

    return (
        <WidgetCard title={widget.title}>
            <div className="flex flex-1 flex-col justify-center gap-3">
                <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium text-secondary">{label}</span>
                    <span className="font-semibold text-primary">{Math.round(pct)}%</span>
                </div>
                <ProgressBar value={value} min={0} max={target} />
            </div>
        </WidgetCard>
    );
}
