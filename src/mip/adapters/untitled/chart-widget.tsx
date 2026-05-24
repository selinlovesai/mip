/**
 * Chart widgets — Untitled UI adapter, powered by recharts.
 *
 * Handles all five chart types behind one renderer (line / bar / area /
 * pie / donut), selected by `widget.type`. Series come from the shared data
 * resolver; colors use the theme's `--color-utility-*` tokens so charts track
 * light/dark mode automatically.
 */

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { WidgetRenderProps } from "@/mip/adapter/types";
import { resolveRows, toChartPoints } from "./data";
import { formatValue } from "./format";
import { WidgetCard } from "./widget-card";

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

    const tooltip = (
        <Tooltip
            cursor={{ fill: "var(--color-utility-neutral-100)", opacity: 0.4 }}
            formatter={(value) => formatValue(value, valueFormat)}
            contentStyle={{
                borderRadius: 8,
                border: "1px solid var(--color-border-secondary)",
                background: "var(--color-bg-primary)",
                color: "var(--color-text-primary)",
                fontSize: 12,
            }}
        />
    );
    const axisProps = { tick: { fill: "var(--color-text-tertiary)", fontSize: 12 }, stroke: "var(--color-border-secondary)" } as const;
    const grid = <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-secondary)" vertical={false} />;

    return (
        <WidgetCard title={widget.title}>
            {points.length === 0 ? (
                <EmptyState />
            ) : (
                <div className="min-h-[200px] flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                        {widget.type === "pieChart" || widget.type === "donutChart" ? (
                            <PieChart>
                                {tooltip}
                                <Pie data={points} dataKey="value" nameKey="name" innerRadius={widget.type === "donutChart" ? "55%" : 0} outerRadius="80%" paddingAngle={2} stroke="var(--color-bg-primary)" isAnimationActive={false}>
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
                                <Bar dataKey="value" fill={SERIES_COLOR} radius={[4, 4, 0, 0]} isAnimationActive={false} />
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
                                <Area type="monotone" dataKey="value" stroke={SERIES_COLOR} strokeWidth={2} fill={`url(#fill-${widget.id})`} isAnimationActive={false} />
                            </AreaChart>
                        ) : (
                            <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                {grid}
                                <XAxis dataKey="name" {...axisProps} />
                                <YAxis {...axisProps} />
                                {tooltip}
                                <Line type="monotone" dataKey="value" stroke={SERIES_COLOR} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                            </LineChart>
                        )}
                    </ResponsiveContainer>
                </div>
            )}
        </WidgetCard>
    );
}
