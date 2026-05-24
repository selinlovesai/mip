/**
 * Widget picker modal — grouped catalog of widget types. Selecting one adds it
 * to the active page (placed at the bottom) and closes the picker.
 */

import { useMemo, useState } from "react";
import { SearchMd, X } from "@untitledui/icons";
import { useDashboard } from "@/mip/store";
import { cx } from "@/utils/cx";
import { WIDGET_CATALOG, makeWidget, type CatalogEntry } from "./widget-catalog";

export function WidgetPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { addWidget } = useDashboard();
    const [query, setQuery] = useState("");

    const groups = useMemo(() => {
        const filtered = WIDGET_CATALOG.filter((entry) => entry.label.toLowerCase().includes(query.toLowerCase()) || entry.type.toLowerCase().includes(query.toLowerCase()));
        const map = new Map<string, CatalogEntry[]>();
        for (const entry of filtered) {
            const list = map.get(entry.group) ?? [];
            list.push(entry);
            map.set(entry.group, list);
        }
        return [...map.entries()];
    }, [query]);

    if (!open) return null;

    const pick = (entry: CatalogEntry) => {
        addWidget(makeWidget(entry));
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[10vh]" onClick={onClose}>
            <div className="flex max-h-[70vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-primary shadow-xl ring-1 ring-secondary" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-secondary px-5 py-4">
                    <h2 className="text-lg font-semibold text-primary">Add widget</h2>
                    <button onClick={onClose} className="text-tertiary hover:text-secondary" aria-label="Close">
                        <X className="size-5" />
                    </button>
                </div>
                <div className="border-b border-secondary px-5 py-3">
                    <div className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 ring-1 ring-secondary">
                        <SearchMd className="size-4 text-tertiary" />
                        <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search widgets…" className="w-full bg-transparent text-sm text-primary outline-none placeholder:text-placeholder" />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {groups.map(([group, entries]) => (
                        <div key={group} className="mb-5 last:mb-0">
                            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-quaternary">{group}</h3>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {entries.map((entry) => (
                                    <button
                                        key={entry.type}
                                        onClick={() => pick(entry)}
                                        className={cx("rounded-lg px-3 py-2.5 text-left text-sm font-medium text-secondary ring-1 ring-secondary transition-colors hover:bg-secondary hover:ring-brand")}
                                    >
                                        {entry.label}
                                        <span className="mt-0.5 block font-mono text-xs text-quaternary">{entry.type}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                    {groups.length === 0 ? <p className="text-sm text-tertiary">No widgets match “{query}”.</p> : null}
                </div>
            </div>
        </div>
    );
}
