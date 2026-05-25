/**
 * Widget picker modal — grouped catalog of widget types. Selecting one adds it
 * to the active page (placed at the bottom) and closes the picker. Built on the
 * Untitled UI Modal/ModalOverlay/Dialog shell with an Untitled Input for search.
 */

import { useMemo, useState } from "react";
import { SearchMd } from "@untitledui/icons";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { CloseButton } from "@/components/base/buttons/close-button";
import { Input } from "@/components/base/input/input";
import { useDashboard } from "@/mip/store";
import { useSettings } from "@/mip/settings/settings-store";
import { cx } from "@/utils/cx";
import { WIDGET_CATALOG, makeWidget, type CatalogEntry } from "./widget-catalog";

export function WidgetPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { addWidget } = useDashboard();
    const { widgetDefaults } = useSettings();
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

    const pick = (entry: CatalogEntry) => {
        // Use the user's customized default size for this type (Settings → Widgets).
        const size = widgetDefaults[entry.type] ?? { w: entry.w, h: entry.h };
        addWidget(makeWidget({ ...entry, w: size.w, h: size.h }));
        onClose();
    };

    return (
        <ModalOverlay isOpen={open} onOpenChange={(isOpen) => !isOpen && onClose()} isDismissable>
            <Modal className="max-w-2xl">
                <Dialog aria-label="Add widget">
                    <div className="flex max-h-[70vh] w-full flex-col overflow-hidden rounded-xl bg-primary shadow-xl ring-1 ring-secondary">
                        <div className="flex items-center justify-between border-b border-secondary px-5 py-4">
                            <h2 className="text-lg font-semibold text-primary">Add widget</h2>
                            <CloseButton onPress={onClose} label="Close" />
                        </div>
                        <div className="border-b border-secondary px-5 py-3">
                            <Input size="sm" autoFocus aria-label="Search widgets" icon={SearchMd} value={query} onChange={setQuery} placeholder="Search widgets…" />
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
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
}
