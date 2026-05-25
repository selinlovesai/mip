/**
 * Chart widgets — Untitled UI adapter, powered by recharts.
 *
 * Handles all five chart types behind one renderer (line / bar / area /
 * pie / donut), selected by `widget.type`. Series come from the shared data
 * resolver; colors use the theme's `--color-utility-*` tokens so charts track
 * light/dark mode automatically.
 *
 * Tooltips, legends, and active dots are rendered with the official Untitled UI
 * chart helpers (`ChartTooltipContent`, `ChartLegendContent`, `ChartActiveDot`)
 * for an on-brand look instead of recharts' defaults.
 */

import { useLayoutEffect, useRef, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { WidgetRenderProps } from "@/mip/adapter/types";
import { ChartActiveDot, ChartLegendContent, ChartTooltipContent } from "@/components/application/charts/charts-base";
import { resolveRows, toChartPoints } from "./data";
import { formatValue } from "./format";
import { WidgetCard } from "./widget-card";

/** Measure the chart container so we can pass EXPLICIT numeric width/height to
 *  recharts' ResponsiveContainer — avoiding its -1×-1 first-frame warning. */
function useSize<T extends HTMLElement>() {
    const ref = useRef<T>(null);
    const [size, setSize] = useState({ w: 0, h: 0 });
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const ro = new ResizeObserver((entries) => {
            const r = entries[0]?.contentRect;
            if (r) setSize({ w: Math.floor(r.width), h: Math.floor(r.height) });
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    return { ref, size };
}

const SERIES_COLOR = "var(--color-utility-brand-600)";
const SLICE_COLORS = [
    "var(--color-utility-brand-600)",
    "var(--color-utility-blue-500)",
    "var(--color-utility-pink-500)",
    "var(--color-utility-indigo-500)",
    "var(--color-utility-orange-500)",
    "var(--color-utility-green-500)",
];

function EmptyState() {
    return <div className="flex flex-1 items-center justify-center text-sm text-tertiary">No chart data.</div>;
}

export function ChartWidget({ widget, dataState }: WidgetRenderProps) {
    const settings = widget.settings ?? {};
    const labelKey = typeof settings.labelKey === "string" ? settings.labelKey : "label";
    const valueKey = typeof settings.valueKey === "string" ? settings.valueKey : "value";
    const valueFormat = typeof settings.valueFormat === "string" ? settings.valueFormat : undefined;

    const points = toChartPoints(resolveRows(widget, dataState, "series"), labelKey, valueKey);

    const isPie = widget.type === "pieChart" || widget.type === "donutChart";
    const { ref, size } = useSize<HTMLDivElement>();

    // Shared Untitled-styled tooltip. The `formatter` runs every numeric value
    // through the widget's value format; `ChartTooltipContent` reads `active`,
    // `payload`, and `label` straight from recharts' render-prop signature.
    const tooltip = (
        <Tooltip
            cursor={isPie ? false : { fill: "var(--color-utility-neutral-100)", opacity: 0.4 }}
            content={<ChartTooltipContent isPieChart={isPie} formatter={(value) => formatValue(value, valueFormat)} />}
        />
    );

    // Legend position is configurable: "bottom" (default) | "top" | "left" |
    // "right" | "none". Vertical positions stack the entries beside the chart.
    const legendPos = typeof settings.legendPosition === "string" ? settings.legendPosition : "bottom";
    const legend =
        legendPos === "none" ? null : legendPos === "left" || legendPos === "right" ? (
            <Legend layout="vertical" align={legendPos} verticalAlign="middle" content={<ChartLegendContent className="px-3" />} />
        ) : (
            <Legend verticalAlign={legendPos === "top" ? "top" : "bottom"} content={<ChartLegendContent className={legendPos === "top" ? "pb-3" : "pt-3"} />} />
        );

    const axisProps = { tick: { fill: "var(--color-text-tertiary)", fontSize: 12 }, stroke: "var(--color-border-secondary)" } as const;
    const grid = <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-secondary)" vertical={false} />;

    return (
        <WidgetCard title={widget.title}>
            {points.length === 0 ? (
                <EmptyState />
            ) : (
                <div ref={ref} className="min-h-[200px] flex-1">
                    {size.w > 0 && size.h > 0 ? (
                    <ResponsiveContainer width={size.w} height={size.h}>
                        {isPie ? (
                            <PieChart>
                                {tooltip}
                                {legend}
                                <Pie
                                    data={points}
                                    dataKey="value"
                                    nameKey="name"
                                    innerRadius={widget.type === "donutChart" ? "55%" : 0}
                                    outerRadius="80%"
                                    paddingAngle={2}
                                    stroke="var(--color-bg-primary)"
                                    isAnimationActive={false}
                                >
                                    {points.map((point, index) => (
                                        <Cell key={point.name} fill={SLICE_COLORS[index % SLICE_COLORS.length]} />
                                    ))}
                                </Pie>
                            </PieChart>
                        ) : widget.type === "barChart" ? (
                            <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                {grid}
                                <XAxis dataKey="name" {...axisProps} />
                                <YAxis {...axisProps} />
                                {tooltip}
                                {legend}
                                <Bar name="Value" dataKey="value" fill={SERIES_COLOR} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                            </BarChart>
                        ) : widget.type === "areaChart" ? (
                            <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id={`fill-${widget.id}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={SERIES_COLOR} stopOpacity={0.3} />
                                        <stop offset="100%" stopColor={SERIES_COLOR} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                {grid}
                                <XAxis dataKey="name" {...axisProps} />
                                <YAxis {...axisProps} />
                                {tooltip}
                                {legend}
                                <Area
                                    name="Value"
                                    type="monotone"
                                    dataKey="value"
                                    stroke={SERIES_COLOR}
                                    strokeWidth={2}
                                    fill={`url(#fill-${widget.id})`}
                                    activeDot={<ChartActiveDot />}
                                    isAnimationActive={false}
                                />
                            </AreaChart>
                        ) : (
                            <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                {grid}
                                <XAxis dataKey="name" {...axisProps} />
                                <YAxis {...axisProps} />
                                {tooltip}
                                {legend}
                                <Line
                                    name="Value"
                                    type="monotone"
                                    dataKey="value"
                                    stroke={SERIES_COLOR}
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={<ChartActiveDot />}
                                    isAnimationActive={false}
                                />
                            </LineChart>
                        )}
                    </ResponsiveContainer>
                    ) : null}
                </div>
            )}
        </WidgetCard>
    );
}
