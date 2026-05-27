/**
 * Widget picker modal — grouped catalog of widget types. Selecting one adds it
 * to the active page (placed at the bottom) and closes the picker. Built on the
 * Untitled UI Modal/ModalOverlay/Dialog shell with an Untitled Input for search.
 */

import { useEffect, useMemo, useState } from "react";
import { SearchMd } from "@untitledui/icons";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { CloseButton } from "@/components/base/buttons/close-button";
import { Input } from "@/components/base/input/input";
import { useDashboard } from "@/mip/store";
import { useSettings } from "@/mip/settings/settings-store";
import { WIDGET_TYPE_CATALOG, loadWidgetTypes, type WidgetTypeMeta } from "@/mip/widget-types";
import { COMPONENT_LIST, loadComponents, type ComponentDef } from "@/mip/components-catalog";
import type { WidgetType } from "@/mip/schema";
import { cx } from "@/utils/cx";
import { WIDGET_CATALOG, makeWidget, type CatalogEntry } from "./widget-catalog";

/** Accent token → a small dot color class for the picker card. */
const ACCENT_DOT: Record<string, string> = {
    success: "bg-fg-success-secondary",
    info: "bg-fg-brand-secondary",
    warning: "bg-fg-warning-secondary",
    error: "bg-fg-error-secondary",
};

/** A flattened, renderable picker card — covers both widget-type entries and
 *  design-system atoms (which all create the generic `element` widget). */
interface PickerEntry {
    key: string;
    label: string;
    group: string;
    description?: string;
    accent?: string;
    /** The catalog entry handed to makeWidget on pick. */
    base: CatalogEntry;
}

export function WidgetPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { addWidget } = useDashboard();
    const { widgetDefaults } = useSettings();
    const [query, setQuery] = useState("");
    // Per-type metadata (label/description/accent) — DB-backed catalog overlaid
    // on the static one; degrade-safe to the static catalog.
    const [meta, setMeta] = useState<Record<WidgetType, WidgetTypeMeta>>(WIDGET_TYPE_CATALOG);
    const [components, setComponents] = useState<ComponentDef[]>(COMPONENT_LIST);
    useEffect(() => {
        if (!open) return;
        let alive = true;
        void loadWidgetTypes().then((m) => alive && setMeta(m));
        void loadComponents().then((c) => alive && setComponents(c));
        return () => {
            alive = false;
        };
    }, [open]);

    // All cards: the widget-type catalog + the design-system atoms (each atom
    // becomes a generic `element` widget carrying its componentId).
    const allEntries = useMemo<PickerEntry[]>(() => {
        const fromTypes: PickerEntry[] = WIDGET_CATALOG.map((entry) => {
            const m = meta[entry.type];
            return { key: entry.type, label: m?.label ?? entry.label, group: m?.group ?? entry.group, description: m?.description, accent: m?.accent, base: entry };
        });
        const elMeta = meta["element"];
        const fromAtoms: PickerEntry[] = components
            .filter((c) => c.kind === "atom")
            .map((c) => ({
                key: `element:${c.id}`,
                label: c.label,
                group: c.group,
                description: c.description,
                base: { type: "element" as WidgetType, label: c.label, group: c.group, w: elMeta?.layout.w ?? 3, h: elMeta?.layout.h ?? 2, settings: { componentId: c.id, label: c.label } },
            }));
        return [...fromTypes, ...fromAtoms];
    }, [meta, components]);

    const groups = useMemo(() => {
        const q = query.toLowerCase();
        const filtered = allEntries.filter((e) => e.label.toLowerCase().includes(q) || e.base.type.toLowerCase().includes(q) || (e.description ?? "").toLowerCase().includes(q));
        const map = new Map<string, PickerEntry[]>();
        for (const entry of filtered) {
            const list = map.get(entry.group) ?? [];
            list.push(entry);
            map.set(entry.group, list);
        }
        return [...map.entries()];
    }, [query, allEntries]);

    const pick = (entry: PickerEntry) => {
        // Use the user's customized default config for this type (Settings → Widgets):
        // name + JSON config holding w/h and optional seed settings/fields.
        const base = entry.base;
        const def = widgetDefaults[base.type];
        const c = (def?.config ?? {}) as { w?: number; h?: number; settings?: Record<string, unknown>; fields?: CatalogEntry["fields"] };
        // For element atoms, keep the atom's own settings (componentId); only fall
        // back to the type default config for plain widget types.
        const isElement = base.type === "element";
        addWidget(
            makeWidget({
                ...base,
                label: isElement ? base.label : def?.name ?? base.label,
                w: !isElement && typeof c.w === "number" ? c.w : base.w,
                h: !isElement && typeof c.h === "number" ? c.h : base.h,
                ...(!isElement && c.settings ? { settings: c.settings } : base.settings ? { settings: base.settings } : {}),
                ...(!isElement && c.fields ? { fields: c.fields } : {}),
            }),
        );
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
                                                key={entry.key}
                                                onClick={() => pick(entry)}
                                                title={entry.description || undefined}
                                                className={cx("rounded-lg px-3 py-2.5 text-left text-sm font-medium text-secondary ring-1 ring-secondary transition-colors hover:bg-secondary hover:ring-brand")}
                                            >
                                                <span className="flex items-center gap-1.5">
                                                    {entry.accent ? <span className={cx("size-1.5 shrink-0 rounded-full", ACCENT_DOT[entry.accent] ?? "bg-fg-quaternary")} aria-hidden /> : null}
                                                    <span className="truncate">{entry.label}</span>
                                                </span>
                                                <span className="mt-0.5 block truncate text-xs text-tertiary">{entry.description || entry.base.type}</span>
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
