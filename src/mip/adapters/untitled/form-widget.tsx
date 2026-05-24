/**
 * Form widget — Untitled UI adapter. Renders `widget.fields` as controlled
 * Untitled UI form components (Input/Select/Checkbox/Toggle/TextArea) with
 * local state and an Untitled `Button` submit. This proof keeps submission
 * client-side (shows a success line); wiring `widget.submit` to the data layer
 * comes with the runtime data work.
 */

import { useState, type FormEvent } from "react";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { TextArea } from "@/components/base/textarea/textarea";
import { Toggle } from "@/components/base/toggle/toggle";
import type { WidgetRenderProps } from "@/mip/adapter/types";
import type { MipFormField } from "@/mip/schema";
import { WidgetCard } from "./widget-card";

type FieldValue = string | boolean;

function Field({ field, value, onChange }: { field: MipFormField; value: FieldValue; onChange: (next: FieldValue) => void }) {
    if (field.type === "checkbox") {
        return <Checkbox label={field.label} isRequired={field.required} isSelected={value === true} onChange={(next) => onChange(next)} />;
    }

    if (field.type === "toggle") {
        return <Toggle label={field.label} isSelected={value === true} onChange={(next) => onChange(next)} />;
    }

    if (field.type === "textarea") {
        return <TextArea label={field.label} isRequired={field.required} value={String(value)} onChange={(next) => onChange(next)} rows={3} />;
    }

    if (field.type === "select") {
        const items = (field.options ?? []).map((option) => ({ id: option.value, label: option.label }));
        return (
            <Select
                label={field.label}
                isRequired={field.required}
                placeholder="Select..."
                items={items}
                selectedKey={value === "" ? null : String(value)}
                onSelectionChange={(key) => onChange(key == null ? "" : String(key))}
            >
                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
            </Select>
        );
    }

    return <Input type={field.type} label={field.label} isRequired={field.required} value={String(value)} onChange={(next) => onChange(next)} />;
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
                            <Field
                                key={field.name}
                                field={field}
                                value={values[field.name] ?? (field.type === "checkbox" || field.type === "toggle" ? false : "")}
                                onChange={(next) => setValues((current) => ({ ...current, [field.name]: next }))}
                            />
                        ))}
                    </div>
                    <div className="mt-auto flex items-center gap-3">
                        <Button type="submit" color="primary" size="md">
                            Submit
                        </Button>
                        {submitted ? <span className="text-sm text-utility-green-500">Submitted ✓</span> : null}
                    </div>
                </form>
            )}
        </WidgetCard>
    );
}
