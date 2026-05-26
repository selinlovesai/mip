/**
 * Table widget — Untitled UI adapter. Columns come from `settings.columns`
 * (or are inferred from the first row); rows from the shared data resolver.
 * String cells whose column key looks like a status render as colored pills.
 *
 * Built on the Untitled `Table` (react-aria-components) so headers, rows, and
 * cells track the active theme. Status cells render as an Untitled `Badge`.
 */

import type { Key } from "react-aria-components";
import { Badge } from "@/components/base/badges/badges";
import type { BadgeColor } from "@/components/base/badges/badges";
import { Table } from "@/components/application/table/table";
import type { WidgetRenderProps } from "@/mip/adapter/types";
import { animationClass, resolveColumns, resolveRows, type Column, type Row } from "./data";
import { formatCell } from "./format";
import { cx } from "@/utils/cx";
import { WidgetCard } from "./widget-card";

const STATUS_TONE: Record<string, BadgeColor<"pill-color">> = {
    active: "success",
    success: "success",
    paid: "success",
    pending: "warning",
    inactive: "gray",
    failed: "error",
    overdue: "error",
};

function Cell({ column, row }: { column: Column; row: Row }) {
    const raw = row[column.key];
    const text = formatCell(raw, column.format);
    const tone = column.key.toLowerCase().includes("status") ? STATUS_TONE[text.toLowerCase()] : undefined;
    const anim = animationClass(column.animation);
    if (tone) {
        return (
            <Badge size="sm" color={tone}>
                {text}
            </Badge>
        );
    }
    // `flash` remounts on value change (key) so its entrance animation replays.
    return (
        <span key={column.animation === "flash" ? text : undefined} className={cx("text-secondary", anim)}>
            {text}
        </span>
    );
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

    const columnItems = columns.map((col) => ({ ...col, id: col.key as Key }));
    const rowItems = rows.map((row, index) => ({ row, id: index as Key }));

    return (
        <WidgetCard title={widget.title}>
            <div className="-mx-1 min-h-0 flex-1 overflow-auto">
                <Table aria-label={widget.title ?? "Table"} size="sm" className="border-none">
                    <Table.Header columns={columnItems}>
                        {(column) => <Table.Head id={column.id} label={column.label} isRowHeader={column.id === columnItems[0]?.id} />}
                    </Table.Header>
                    <Table.Body items={rowItems}>
                        {(item) => (
                            <Table.Row columns={columnItems}>
                                {(column) => (
                                    <Table.Cell>
                                        <Cell column={column} row={item.row} />
                                    </Table.Cell>
                                )}
                            </Table.Row>
                        )}
                    </Table.Body>
                </Table>
            </div>
        </WidgetCard>
    );
}
