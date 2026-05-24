/**
 * Table widget — Untitled UI adapter. Columns come from `settings.columns`
 * (or are inferred from the first row); rows from the shared data resolver.
 * String cells whose column key looks like a status render as colored pills.
 */

import type { WidgetRenderProps } from "@/mip/adapter/types";
import { cx } from "@/utils/cx";
import { resolveColumns, resolveRows, type Row } from "./data";
import { WidgetCard } from "./widget-card";

const STATUS_TONE: Record<string, string> = {
    active: "bg-utility-green-50 text-utility-green-700 ring-utility-green-200",
    success: "bg-utility-green-50 text-utility-green-700 ring-utility-green-200",
    paid: "bg-utility-green-50 text-utility-green-700 ring-utility-green-200",
    pending: "bg-utility-yellow-50 text-utility-yellow-700 ring-utility-yellow-200",
    inactive: "bg-utility-neutral-50 text-utility-neutral-700 ring-utility-neutral-200",
    failed: "bg-utility-red-50 text-utility-red-700 ring-utility-red-200",
    overdue: "bg-utility-red-50 text-utility-red-700 ring-utility-red-200",
};

function Cell({ columnKey, row }: { columnKey: string; row: Row }) {
    const raw = row[columnKey];
    const text = raw == null ? "" : String(raw);
    const isStatus = columnKey.toLowerCase().includes("status") && text.toLowerCase() in STATUS_TONE;
    if (isStatus) {
        return (
            <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", STATUS_TONE[text.toLowerCase()])}>{text}</span>
        );
    }
    return <span className="text-secondary">{text}</span>;
}

export function TableWidget({ widget, dataState }: WidgetRenderProps) {
    const rows = resolveRows(widget, dataState, "rows");
    const columns = resolveColumns(widget, rows);

    if (columns.length === 0) {
        return (
            <WidgetCard title={widget.title}>
                <div className="flex flex-1 items-center justify-center text-sm text-tertiary">No table data.</div>
            </WidgetCard>
        );
    }

    return (
        <WidgetCard title={widget.title}>
            <div className="-mx-1 min-h-0 flex-1 overflow-auto">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="border-b border-secondary">
                            {columns.map((col) => (
                                <th key={col.key} className="px-3 py-2 text-left text-xs font-medium text-tertiary">
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, index) => (
                            <tr key={index} className="border-b border-secondary last:border-0">
                                {columns.map((col) => (
                                    <td key={col.key} className="px-3 py-2.5">
                                        <Cell columnKey={col.key} row={row} />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </WidgetCard>
    );
}
