/**
 * Data extraction shared by the collection-oriented Untitled renderers
 * (charts, table, list). A widget's rows come from one of two places, checked
 * in order:
 *   1. the bound data source payload (`dataState.data`), read via the key the
 *      widget maps (`widget.data.map[...]`) — this is the runtime path;
 *   2. authored values on `widget.settings` (`points` / `rows` / `items` /
 *      `data`) — the design-time path used by demos and static dashboards.
 *
 * This is a faithful but trimmed port of the original app's mapping helpers —
 * enough for the common label/value + columns cases, without the full
 * sort/group/limit machinery (added back per-widget as needed).
 */

import type { WidgetDataState } from "@/mip/adapter/types";
import type { MipWidget } from "@/mip/schema";

export type Row = Record<string, unknown>;

export interface ChartPoint {
    name: string;
    value: number;
}

function readByPath(source: unknown, path: string | undefined): unknown {
    if (!path) return source;
    return path.split(".").reduce<unknown>((acc, key) => {
        if (acc && typeof acc === "object" && key in (acc as Row)) return (acc as Row)[key];
        return undefined;
    }, source);
}

function asRows(value: unknown): Row[] {
    return Array.isArray(value) ? value.filter((item): item is Row => typeof item === "object" && item !== null) : [];
}

/** Resolve a widget's collection of records from fetched data or authored settings. */
export function resolveRows(widget: MipWidget, dataState: WidgetDataState, mapKey?: string): Row[] {
    if (dataState.status === "success" && dataState.data != null) {
        const mapped = readByPath(dataState.data, mapKey ? widget.data?.map?.[mapKey] : undefined);
        const rows = asRows(mapped ?? dataState.data);
        if (rows.length) return rows;
    }
    const settings = widget.settings ?? {};
    return asRows(settings.points ?? settings.rows ?? settings.items ?? settings.data);
}

/** Map records to {name, value} chart points using configured/falling-back keys. */
export function toChartPoints(rows: Row[], labelKey = "label", valueKey = "value"): ChartPoint[] {
    return rows.map((row, index) => {
        const rawName = row[labelKey] ?? row.name ?? index + 1;
        const rawValue = row[valueKey] ?? row.value;
        const num = typeof rawValue === "number" ? rawValue : Number(rawValue);
        return { name: String(rawName), value: Number.isFinite(num) ? num : 0 };
    });
}

export interface Column {
    key: string;
    label: string;
}

/** Columns from `settings.columns` ([{key,label}] or ["key"]), else inferred from the first row. */
export function resolveColumns(widget: MipWidget, rows: Row[]): Column[] {
    const configured = widget.settings?.columns;
    if (Array.isArray(configured) && configured.length) {
        return configured.map((col) => {
            if (typeof col === "string") return { key: col, label: col };
            const record = col as Row;
            const key = String(record.key ?? "");
            return { key, label: String(record.label ?? key) };
        });
    }
    const first = rows[0];
    if (!first) return [];
    return Object.keys(first).map((key) => ({ key, label: key }));
}
