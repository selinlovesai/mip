/**
 * Widgets tab — customize the default grid size used when a widget of each type
 * is added (from the picker or by the AI agent). Sizes are in a 12-column grid
 * with ~70px rows: w is 1–12, h is row count.
 */

import { WIDGET_TYPES, type WidgetType } from "@/mip/schema";
import { WIDGET_CATALOG } from "@/mip/shell/widget-catalog";
import { Button } from "@/components/base/buttons/button";
import { useSettings } from "../settings-store";

const LABELS: Partial<Record<WidgetType, string>> = Object.fromEntries(WIDGET_CATALOG.map((c) => [c.type, c.label])) as Partial<Record<WidgetType, string>>;

function NumberBox({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (n: number) => void; label: string }) {
    return (
        <label className="flex items-center gap-1.5">
            <span className="text-xs text-tertiary">{label}</span>
            <input
                type="number"
                min={min}
                max={max}
                value={value}
                onChange={(e) => {
                    const n = Math.max(min, Math.min(max, Math.round(Number(e.target.value) || min)));
                    onChange(n);
                }}
                className="w-14 rounded-md bg-primary px-2 py-1 text-sm text-primary shadow-xs outline-none ring-1 ring-primary ring-inset focus:ring-2 focus:ring-brand"
            />
        </label>
    );
}

export function WidgetsTab() {
    const { widgetDefaults, setWidgetDefault, resetWidgetDefaults } = useSettings();

    return (
        <div className="flex flex-col gap-6">
            <header className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold text-primary">Widgets</h1>
                    <p className="mt-1 max-w-xl text-sm text-tertiary">
                        Default size for each widget type when added from the picker or by the assistant. Grid is 12 columns wide with ~70px rows —
                        <span className="font-medium text-secondary"> w</span> is 1–12, <span className="font-medium text-secondary">h</span> is the number of rows.
                    </p>
                </div>
                <Button color="secondary" size="md" onClick={resetWidgetDefaults}>
                    Reset to defaults
                </Button>
            </header>

            <div className="grid max-w-3xl grid-cols-1 gap-2 sm:grid-cols-2">
                {WIDGET_TYPES.map((type) => {
                    const size = widgetDefaults[type] ?? { w: 6, h: 6 };
                    return (
                        <div key={type} className="flex items-center justify-between gap-3 rounded-lg p-3 ring-1 ring-secondary">
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-secondary">{LABELS[type] ?? type}</span>
                            <div className="flex items-center gap-3">
                                <NumberBox label="w" value={size.w} min={1} max={12} onChange={(w) => setWidgetDefault(type, { ...size, w })} />
                                <NumberBox label="h" value={size.h} min={1} max={24} onChange={(h) => setWidgetDefault(type, { ...size, h })} />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
