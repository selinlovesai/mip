/**
 * KPI widget — Untitled UI adapter implementation.
 *
 * Reads its display values from `widget.settings` (value, valueFormat, unit,
 * delta, deltaLabel), falling back to the bound data source's payload when
 * present. Logic mirrors the original app's KPI renderer; styling is pure
 * Untitled UI semantic utilities so it tracks the active theme/dark mode.
 */

import { TrendDown01, TrendUp01 } from "@untitledui/icons";
import type { WidgetRenderProps } from "@/mip/adapter/types";
import { cx } from "@/utils/cx";
import { formatNumber, formatValue } from "./format";
import { WidgetCard } from "./widget-card";

export function KpiWidget({ widget, dataState }: WidgetRenderProps) {
    const settings = widget.settings ?? {};

    // Prefer fetched data when the source resolved; otherwise use authored settings.
    const fetched = dataState.status === "success" && dataState.data != null ? (dataState.data as Record<string, unknown>) : undefined;
    const rawValue = fetched?.value ?? settings.value;
    const valueFormat = typeof settings.valueFormat === "string" ? settings.valueFormat : undefined;
    const unit = typeof settings.unit === "string" ? settings.unit : "";

    const displayValue = formatValue(rawValue, valueFormat);

    const rawDelta = fetched?.delta ?? settings.delta;
    const deltaNum = typeof rawDelta === "number" ? rawDelta : Number(rawDelta);
    const hasDelta = rawDelta != null && rawDelta !== "" && Number.isFinite(deltaNum);
    const deltaIsUp = hasDelta && deltaNum > 0;
    const deltaIsDown = hasDelta && deltaNum < 0;
    const deltaDisplay = typeof rawDelta === "string" ? rawDelta : hasDelta ? `${formatNumber(Math.abs(deltaNum))}%` : "";
    const deltaLabel = typeof settings.deltaLabel === "string" ? settings.deltaLabel : "vs. last period";

    return (
        <WidgetCard title={widget.title}>
            <div className="flex flex-1 flex-col justify-center gap-2">
                <span className="text-display-sm font-semibold text-primary">
                    {displayValue}
                    {unit ? <span className="ml-1 text-xl font-medium text-tertiary">{unit}</span> : null}
                </span>
                {hasDelta ? (
                    <div className="flex items-center gap-2 text-sm">
                        <span
                            className={cx(
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                                deltaIsUp && "bg-utility-green-50 text-utility-green-700 ring-utility-green-200",
                                deltaIsDown && "bg-utility-red-50 text-utility-red-700 ring-utility-red-200",
                                !deltaIsUp && !deltaIsDown && "bg-utility-neutral-50 text-utility-neutral-700 ring-utility-neutral-200",
                            )}
                        >
                            {deltaIsUp ? <TrendUp01 className="size-3" /> : deltaIsDown ? <TrendDown01 className="size-3" /> : null}
                            {deltaDisplay}
                        </span>
                        <span className="text-tertiary">{deltaLabel}</span>
                    </div>
                ) : null}
            </div>
        </WidgetCard>
    );
}
