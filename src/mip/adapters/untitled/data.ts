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

/**
 * Read a value from a payload by JSONPath-lite: supports `$`, leading `$.`,
 * dotted keys, and array indices (`a.b[0].c` or `a.0.c`). Returns the source
 * itself for `$` / empty path. Used to resolve widget data `map` expressions.
 */
export function readJsonPath(source: unknown, path?: string): unknown {
    if (!path) return source;
    let p = path.trim();
    if (p === "$") return source;
    if (p.startsWith("$")) p = p.slice(1);
    if (p.startsWith(".")) p = p.slice(1);
    if (!p) return source;
    const segments = p.replace(/\[(\w+)\]/g, ".$1").split(".").filter(Boolean);
    return segments.reduce<unknown>((acc, key) => {
        if (acc == null) return undefined;
        if (Array.isArray(acc)) {
            const i = Number(key);
            return Number.isInteger(i) ? acc[i] : undefined;
        }
        if (typeof acc === "object") return (acc as Row)[key];
        return undefined;
    }, source);
}

function asRows(value: unknown): Row[] {
    return Array.isArray(value) ? value.filter((item): item is Row => typeof item === "object" && item !== null) : [];
}

/** Resolve a widget's collection of records from fetched data or authored settings. */
export function resolveRows(widget: MipWidget, dataState: WidgetDataState, mapKey?: string): Row[] {
    if (dataState.status === "success" && dataState.data != null) {
        const mapped = readJsonPath(dataState.data, mapKey ? widget.data?.map?.[mapKey] : undefined);
        const rows = asRows(mapped ?? dataState.data);
        if (rows.length) return rows;
    }
    const settings = widget.settings ?? {};
    return asRows(settings.points ?? settings.rows ?? settings.items ?? settings.data);
}

/** Map records to {name, value} chart points using configured/falling-back keys.
 *  Rows may be objects OR arrays (e.g. Binance klines [openTime,…,close,…]);
 *  bracket access works for both. A label that looks like an epoch-ms timestamp
 *  is rendered as a short date. */
export function toChartPoints(rows: Row[], labelKey = "label", valueKey = "value"): ChartPoint[] {
    return rows.map((row, index) => {
        const rawName = row[labelKey] ?? row.name ?? index + 1;
        const ts = typeof rawName === "number" ? rawName : Number(rawName);
        const name = Number.isFinite(ts) && ts > 1e11 ? new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : String(rawName);
        const rawValue = row[valueKey] ?? row.value;
        const num = typeof rawValue === "number" ? rawValue : Number(rawValue);
        return { name, value: Number.isFinite(num) ? num : 0 };
    });
}

export interface Column {
    key: string;
    label: string;
    /** Optional value format id (see format.ts CELL_FORMATS) applied per cell. */
    format?: string;
    /** Optional cell animation id (e.g. "flash" on change). */
    animation?: string;
}

/** Cell animation ids surfaced in the editor. */
export const CELL_ANIMATIONS = [
    { id: "none", label: "None" },
    { id: "flash", label: "Flash on change" },
    { id: "pulse", label: "Pulse" },
] as const;

/** Tailwind class for a cell animation id. `flash` is keyed on value change by
 *  the renderer (remount replays the entrance), `pulse` is continuous. */
export function animationClass(id?: string): string {
    return id === "pulse" ? "animate-pulse" : id === "flash" ? "animate-in fade-in zoom-in-95 duration-500" : "";
}

/** Columns from `settings.columns` ([{key,label,format?,animation?}] or ["key"]),
 *  else inferred from the first row. */
export function resolveColumns(widget: MipWidget, rows: Row[]): Column[] {
    const configured = widget.settings?.columns;
    if (Array.isArray(configured) && configured.length) {
        return configured.map((col) => {
            if (typeof col === "string") return { key: col, label: col };
            const record = col as Row;
            const key = String(record.key ?? "");
            return {
                key,
                label: String(record.label ?? key),
                ...(typeof record.format === "string" ? { format: record.format } : {}),
                ...(typeof record.animation === "string" ? { animation: record.animation } : {}),
            };
        });
    }
    const first = rows[0];
    if (!first) return [];
    return Object.keys(first).map((key) => ({ key, label: key }));
}
