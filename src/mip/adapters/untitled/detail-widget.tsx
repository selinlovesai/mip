/**
 * Detail widget — Untitled UI adapter. Renders a record as a definition list of
 * label/value pairs. Fields come from `settings.fields` ([{key,label}] or
 * ["key"]); the record from the fetched payload (`data.map.record`) or
 * `settings.record`. Falls back to every key on the record.
 */

import type { WidgetRenderProps } from "@/mip/adapter/types";
import { resolveColumns, type Row } from "./data";
import { WidgetCard } from "./widget-card";

function resolveRecord(props: WidgetRenderProps): Row {
    const { widget, dataState } = props;
    if (dataState.status === "success" && dataState.data != null) {
        const data = dataState.data as Row;
        const mapped = widget.data?.map?.record ? (data[widget.data.map.record] as Row) : data;
        if (mapped && typeof mapped === "object") return mapped;
    }
    const record = widget.settings?.record;
    return record && typeof record === "object" ? (record as Row) : {};
}

export function DetailWidget(props: WidgetRenderProps) {
    const { widget } = props;
    const record = resolveRecord(props);
    // `resolveColumns` doubles as a field resolver (settings.fields aliases columns).
    const fields = resolveColumns({ ...widget, settings: { ...widget.settings, columns: widget.settings?.fields ?? widget.settings?.columns } }, [record]);

    return (
        <WidgetCard title={widget.title}>
            {fields.length === 0 ? (
                <div className="flex flex-1 items-center justify-center text-sm text-tertiary">No record data.</div>
            ) : (
                <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
                    {fields.map((field) => (
                        <div key={field.key} className="contents">
                            <dt className="text-tertiary">{field.label}</dt>
                            <dd className="text-right font-medium text-secondary">{record[field.key] == null ? "--" : String(record[field.key])}</dd>
                        </div>
                    ))}
                </dl>
            )}
        </WidgetCard>
    );
}
