/**
 * List widget — Untitled UI adapter. Renders a vertical list of records with a
 * primary line, optional secondary line, an optional leading avatar (initials),
 * and an optional trailing value. Keys configured via settings
 * (primaryKey / secondaryKey / valueKey / avatarKey).
 */

import { Avatar } from "@/components/base/avatar/avatar";
import type { WidgetRenderProps } from "@/mip/adapter/types";
import { resolveRows, type Row } from "./data";
import { WidgetCard } from "./widget-card";

function initials(text: string): string {
    return text
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("");
}

export function ListWidget({ widget, dataState }: WidgetRenderProps) {
    const settings = widget.settings ?? {};
    const primaryKey = typeof settings.primaryKey === "string" ? settings.primaryKey : "name";
    const secondaryKey = typeof settings.secondaryKey === "string" ? settings.secondaryKey : undefined;
    const valueKey = typeof settings.valueKey === "string" ? settings.valueKey : undefined;
    const showAvatar = settings.avatar !== false;

    const rows = resolveRows(widget, dataState, "items");
    const read = (row: Row, key?: string) => (key && row[key] != null ? String(row[key]) : "");

    if (rows.length === 0) {
        return (
            <WidgetCard title={widget.title}>
                <div className="flex flex-1 items-center justify-center text-sm text-tertiary">No items.</div>
            </WidgetCard>
        );
    }

    return (
        <WidgetCard title={widget.title}>
            <ul className="min-h-0 flex-1 divide-y divide-border-secondary overflow-auto">
                {rows.map((row, index) => {
                    const primary = read(row, primaryKey) || `Item ${index + 1}`;
                    const secondary = read(row, secondaryKey);
                    const value = read(row, valueKey);
                    return (
                        <li key={index} className="flex items-center gap-3 py-2.5">
                            {showAvatar ? <Avatar size="sm" initials={initials(primary)} alt={primary} /> : null}
                            <span className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate text-sm font-medium text-secondary">{primary}</span>
                                {secondary ? <span className="truncate text-xs text-tertiary">{secondary}</span> : null}
                            </span>
                            {value ? <span className="shrink-0 text-sm font-semibold text-primary">{value}</span> : null}
                        </li>
                    );
                })}
            </ul>
        </WidgetCard>
    );
}
