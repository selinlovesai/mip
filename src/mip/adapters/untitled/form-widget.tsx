/**
 * Form widget — Untitled UI adapter. Renders `widget.fields` as controlled
 * inputs (text/email/number/date/select/checkbox/toggle/textarea) with local
 * state and a submit button. This proof keeps submission client-side (shows a
 * success line); wiring `widget.submit` to the data layer comes with the
 * runtime data work.
 */

import { useState, type FormEvent } from "react";
import type { WidgetRenderProps } from "@/mip/adapter/types";
import type { MipFormField } from "@/mip/schema";
import { cx } from "@/utils/cx";
import { WidgetCard } from "./widget-card";

const inputClass = "w-full rounded-lg bg-primary px-3 py-2 text-sm text-primary ring-1 ring-secondary outline-none placeholder:text-placeholder focus:ring-2 focus:ring-brand";

type FieldValue = string | boolean;

function Field({ field, value, onChange }: { field: MipFormField; value: FieldValue; onChange: (next: FieldValue) => void }) {
    const labelText = `${field.label}${field.required ? " *" : ""}`;

    if (field.type === "checkbox" || field.type === "toggle") {
        return (
            <label className="flex items-center gap-2 text-sm text-secondary">
                <input type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} className="size-4 rounded accent-[var(--color-bg-brand-solid)]" />
                <span>{labelText}</span>
            </label>
        );
    }

    const control =
        field.type === "textarea" ? (
            <textarea value={String(value)} onChange={(event) => onChange(event.target.value)} rows={3} className={inputClass} />
        ) : field.type === "select" ? (
            <select value={String(value)} onChange={(event) => onChange(event.target.value)} className={inputClass}>
                <option value="">Select...</option>
                {(field.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        ) : (
            <input type={field.type} value={String(value)} onChange={(event) => onChange(event.target.value)} className={inputClass} />
        );

    return (
        <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-secondary">{labelText}</span>
            {control}
        </label>
    );
}

export function FormWidget({ widget }: WidgetRenderProps) {
    const fields = widget.fields ?? [];
    const [values, setValues] = useState<Record<string, FieldValue>>({});
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        setSubmitted(true);
    };

    return (
        <WidgetCard title={widget.title}>
            {fields.length === 0 ? (
                <div className="flex flex-1 items-center justify-center text-sm text-tertiary">No fields configured.</div>
            ) : (
                <form className="flex flex-1 flex-col gap-4" onSubmit={handleSubmit}>
                    <div className="flex flex-col gap-3.5">
                        {fields.map((field) => (
                            <Field key={field.name} field={field} value={values[field.name] ?? (field.type === "checkbox" || field.type === "toggle" ? false : "")} onChange={(next) => setValues((current) => ({ ...current, [field.name]: next }))} />
                        ))}
                    </div>
                    <div className="mt-auto flex items-center gap-3">
                        <button type="submit" className={cx("rounded-lg bg-brand-solid px-4 py-2 text-sm font-semibold text-white hover:opacity-90")}>
                            Submit
                        </button>
                        {submitted ? <span className="text-sm text-utility-green-500">Submitted ✓</span> : null}
                    </div>
                </form>
            )}
        </WidgetCard>
    );
}
