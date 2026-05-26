/**
 * KPI widget — Untitled UI adapter implementation.
 *
 * Reads its display values from `widget.settings` (value, valueFormat, unit,
 * delta, deltaLabel), falling back to the bound data source's payload when
 * present. Logic mirrors the original app's KPI renderer; styling is pure
 * Untitled UI semantic utilities so it tracks the active theme/dark mode.
 */

import { TrendDown01, TrendUp01 } from "@untitledui/icons";
import { BadgeWithIcon } from "@/components/base/badges/badges";
import type { WidgetRenderProps } from "@/mip/adapter/types";
import { readJsonPath } from "./data";
import { formatNumber, formatValue } from "./format";
import { WidgetCard } from "./widget-card";

export function KpiWidget({ widget, dataState }: WidgetRenderProps) {
    const settings = widget.settings ?? {};

    // Prefer fetched data when the source resolved; otherwise use authored
    // settings. When a data `map` is present, resolve value/delta via JSONPath
    // (e.g. value: "$.lastPrice"); otherwise read top-level keys.
    const fetched = dataState.status === "success" && dataState.data != null ? dataState.data : undefined;
    const isBound = !!widget.data?.sourceId;
    const map = widget.data?.map;
    const mapped = (key: string): unknown =>
        fetched == null ? undefined : map?.[key] != null ? readJsonPath(fetched, map[key]) : (fetched as Record<string, unknown>)[key];
    const rawValue = mapped("value") ?? settings.value;
    const valueFormat = typeof settings.valueFormat === "string" ? settings.valueFormat : undefined;
    const unit = typeof settings.unit === "string" ? settings.unit : "";

    const displayValue = formatValue(rawValue, valueFormat);

    // Delta may arrive as a number (5.2) OR a string ("+5.2%", "-3%"). Show it in
    // either case — parse a leading number for the trend arrow, fall back to the
    // sign in the string.
    // For a bound widget, only show a delta that actually came from the data —
    // don't fall back to the inline placeholder (which looks like stale mock).
    const rawDelta = mapped("delta") ?? (isBound ? undefined : settings.delta);
    const deltaStr = rawDelta == null ? "" : String(rawDelta).trim();
    const deltaNum = typeof rawDelta === "number" ? rawDelta : parseFloat(deltaStr.replace(/[^0-9.+-]/g, ""));
    const hasDelta = deltaStr !== "";
    const deltaIsUp = Number.isFinite(deltaNum) ? deltaNum > 0 : /^\+/.test(deltaStr);
    const deltaIsDown = Number.isFinite(deltaNum) ? deltaNum < 0 : /^-/.test(deltaStr);
    const deltaDisplay = typeof rawDelta === "string" ? rawDelta : Number.isFinite(deltaNum) ? `${formatNumber(Math.abs(deltaNum))}%` : deltaStr;
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
                        <BadgeWithIcon
                            size="sm"
                            color={deltaIsUp ? "success" : deltaIsDown ? "error" : "gray"}
                            iconLeading={deltaIsUp ? TrendUp01 : deltaIsDown ? TrendDown01 : undefined}
                        >
                            {deltaDisplay}
                        </BadgeWithIcon>
                        <span className="text-tertiary">{deltaLabel}</span>
                    </div>
                ) : null}
            </div>
        </WidgetCard>
    );
}
