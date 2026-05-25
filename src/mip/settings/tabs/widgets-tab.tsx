/**
 * Widgets tab — per-type widget defaults as collapsible boxes. Each widget has:
 *   · Name   (text)
 *   · Config (JSON) — holds the default grid size { w, h } plus any seed
 *     settings/fields used when the widget is added (picker or AI agent).
 */

import { useState } from "react";
import { ChevronRight } from "@untitledui/icons";
import { WIDGET_TYPES, type WidgetType } from "@/mip/schema";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { useSettings, type WidgetTypeConfig } from "../settings-store";

function WidgetRow({ type, cfg, onChange }: { type: WidgetType; cfg: WidgetTypeConfig; onChange: (next: WidgetTypeConfig) => void }) {
    const [json, setJson] = useState(() => JSON.stringify(cfg.config, null, 2));
    const [error, setError] = useState<string | null>(null);

    const onJsonChange = (text: string) => {
        setJson(text);
        try {
            const parsed = JSON.parse(text) as Record<string, unknown>;
            setError(null);
            onChange({ ...cfg, config: parsed });
        } catch (e) {
            setError(e instanceof Error ? e.message : "Invalid JSON");
        }
    };

    const size = cfg.config as { w?: unknown; h?: unknown };
    return (
        <details className="group overflow-hidden rounded-lg ring-1 ring-secondary">
            <summary className="flex cursor-pointer list-none items-center gap-2 bg-secondary px-3 py-2.5 [&::-webkit-details-marker]:hidden">
                <ChevronRight className="size-4 shrink-0 text-quaternary transition-transform group-open:rotate-90" />
                <span className="flex-1 truncate text-sm font-medium text-secondary">{cfg.name}</span>
                <span className="font-mono text-xs text-tertiary">
                    {String(size.w ?? "?")}×{String(size.h ?? "?")}
                </span>
                <span className="font-mono text-xs text-quaternary">{type}</span>
            </summary>
            <div className="flex flex-col gap-3 border-t border-secondary bg-primary p-3">
                <Input label="Name" value={cfg.name} onChange={(v) => onChange({ ...cfg, name: v })} />
                <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-secondary">Config (JSON)</span>
                    <textarea
                        spellCheck={false}
                        value={json}
                        onChange={(e) => onJsonChange(e.target.value)}
                        rows={Math.min(16, json.split("\n").length + 1)}
                        className="w-full resize-y rounded-lg bg-primary px-3 py-2 font-mono text-xs leading-5 text-primary shadow-xs outline-none ring-1 ring-primary ring-inset focus:ring-2 focus:ring-brand"
                    />
                    <p className="text-xs text-tertiary">
                        {error ? <span className="text-error-primary">⚠ {error}</span> : 'Defaults applied on add. Keep "w" (1–12) and "h" (rows) here; add "settings"/"fields" to seed content.'}
                    </p>
                </div>
            </div>
        </details>
    );
}

export function WidgetsTab() {
    const { widgetDefaults, setWidgetDefault, resetWidgetDefaults } = useSettings();
    // Remount rows after a reset so their local JSON text re-syncs.
    const [rev, setRev] = useState(0);

    return (
        <div className="flex flex-col gap-6">
            <header className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold text-primary">Widgets</h1>
                    <p className="mt-1 max-w-xl text-sm text-tertiary">
                        Default config per widget type, applied when added from the picker or by the assistant. The 12-column grid uses ~70px rows —
                        keep <span className="font-medium text-secondary">w</span> (1–12) and <span className="font-medium text-secondary">h</span> (rows) in the JSON.
                    </p>
                </div>
                <Button
                    color="secondary"
                    size="md"
                    onClick={() => {
                        resetWidgetDefaults();
                        setRev((r) => r + 1);
                    }}
                >
                    Reset to defaults
                </Button>
            </header>

            <div className="flex max-w-2xl flex-col gap-2">
                {WIDGET_TYPES.map((type) => (
                    <WidgetRow key={`${type}-${rev}`} type={type} cfg={widgetDefaults[type]} onChange={(next) => setWidgetDefault(type, next)} />
                ))}
            </div>
        </div>
    );
}
