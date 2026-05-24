/**
 * Dashboard Templates — a listing modal (search + category chips + template
 * cards) plus an import-confirm step. Mirrors mip's TemplatePickerModal +
 * import-confirm. Selecting a card opens the confirm view; importing seeds a
 * new page with the template's widgets via store.importTemplate.
 *
 *   Connect & Import        → import + (future) bind live connections
 *   Continue with Mock Data → import the authored mock widgets as-is
 *   Set Up in Connections   → close + jump to Settings → Connections
 */

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle, SearchMd } from "@untitledui/icons";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { CloseButton } from "@/components/base/buttons/close-button";
import { Input } from "@/components/base/input/input";
import { useDashboard } from "@/mip/store";
import { cx } from "@/utils/cx";
import { TEMPLATES, TEMPLATE_CATEGORIES, cloneTemplateWidgets, type DashboardTemplate } from "./templates-catalog";

export function TemplatesModal({ open, onClose, onOpenConnections }: { open: boolean; onClose: () => void; onOpenConnections?: () => void }) {
    const { importTemplate } = useDashboard();
    const [query, setQuery] = useState("");
    const [category, setCategory] = useState<(typeof TEMPLATE_CATEGORIES)[number]>("All");
    const [selected, setSelected] = useState<DashboardTemplate | null>(null);

    const results = useMemo(
        () =>
            TEMPLATES.filter((t) => {
                const matchesCat = category === "All" || t.category === category;
                const q = query.toLowerCase();
                const matchesQuery = !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
                return matchesCat && matchesQuery;
            }),
        [query, category],
    );

    const close = () => {
        setSelected(null);
        onClose();
    };

    const doImport = (template: DashboardTemplate) => {
        importTemplate(template.name, cloneTemplateWidgets(template));
        close();
    };

    return (
        <ModalOverlay isOpen={open} onOpenChange={(isOpen) => !isOpen && close()} isDismissable>
            <Modal className="max-w-3xl">
                <Dialog>
                    <div className="flex max-h-[80vh] w-full flex-col overflow-hidden rounded-xl bg-primary shadow-xl ring-1 ring-secondary">
                        {selected ? (
                            /* ---- Import-confirm view ---- */
                            <>
                                <div className="flex items-center justify-between border-b border-secondary px-5 py-4">
                                    <div className="flex items-center gap-2">
                                        <Button color="tertiary" size="sm" iconLeading={ArrowLeft} onClick={() => setSelected(null)}>
                                            Back
                                        </Button>
                                        <h2 className="text-lg font-semibold text-primary">Import “{selected.name}”</h2>
                                    </div>
                                    <CloseButton onPress={close} label="Close" />
                                </div>
                                <div className="flex flex-col gap-5 p-6">
                                    <div className={cx("flex items-start gap-2.5 rounded-lg p-3 ring-1", selected.needsKeys ? "bg-utility-warning-50 ring-utility-warning-200" : "bg-utility-success-50 ring-utility-success-200")}>
                                        {selected.needsKeys ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-utility-warning-500" /> : <CheckCircle className="mt-0.5 size-4 shrink-0 text-utility-success-500" />}
                                        <p className="text-sm text-secondary">
                                            {selected.needsKeys
                                                ? `Some widgets need API keys (${selected.connectors.join(", ")}). You can set them up in Connections, or continue with mock data.`
                                                : selected.connectors.length > 0
                                                  ? `✓ Auto-configured: ${selected.connectors.join(", ")} — no API keys needed.`
                                                  : "✓ No API keys needed — imports with sample data."}
                                        </p>
                                    </div>
                                    <p className="text-sm text-tertiary">
                                        This template will add <span className="font-semibold text-primary">{selected.widgets.length} widgets</span> as a new page.
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        <Button color="primary" size="md" onClick={() => doImport(selected)}>
                                            Connect &amp; Import
                                        </Button>
                                        <Button color="secondary" size="md" onClick={() => doImport(selected)}>
                                            Continue with Mock Data
                                        </Button>
                                        {onOpenConnections ? (
                                            <Button
                                                color="link-color"
                                                size="md"
                                                onClick={() => {
                                                    close();
                                                    onOpenConnections();
                                                }}
                                            >
                                                Set Up in Connections →
                                            </Button>
                                        ) : null}
                                    </div>
                                </div>
                            </>
                        ) : (
                            /* ---- Listing view ---- */
                            <>
                                <div className="flex items-center justify-between border-b border-secondary px-5 py-4">
                                    <h2 className="text-lg font-semibold text-primary">Dashboard Templates</h2>
                                    <CloseButton onPress={close} label="Close" />
                                </div>
                                <div className="flex flex-col gap-3 border-b border-secondary px-5 py-3">
                                    <Input size="sm" autoFocus aria-label="Search templates" icon={SearchMd} value={query} onChange={setQuery} placeholder="Search templates…" />
                                    <div className="flex flex-wrap gap-1.5">
                                        {TEMPLATE_CATEGORIES.map((c) => (
                                            <button
                                                key={c}
                                                onClick={() => setCategory(c)}
                                                className={cx(
                                                    "rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors",
                                                    category === c ? "bg-brand-50 text-brand-secondary ring-brand" : "bg-primary text-tertiary ring-secondary hover:bg-secondary",
                                                )}
                                            >
                                                {c}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid flex-1 grid-cols-1 gap-3 overflow-y-auto p-5 sm:grid-cols-2">
                                    {results.map((t) => (
                                        <button key={t.id} onClick={() => setSelected(t)} className="flex flex-col gap-2 rounded-xl p-4 text-left ring-1 ring-secondary transition-colors hover:ring-brand">
                                            <div className="flex items-start justify-between gap-2">
                                                <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-xl">{t.icon}</span>
                                                <div className="flex items-center gap-1.5">
                                                    <Badge size="sm" color="gray">{t.widgets.length} widgets</Badge>
                                                    {t.needsKeys ? <AlertTriangle className="size-4 text-utility-warning-500" /> : null}
                                                </div>
                                            </div>
                                            <span className="text-sm font-semibold text-primary">{t.name}</span>
                                            <span className="text-xs text-tertiary">{t.description}</span>
                                            <div className="mt-1 flex items-center gap-1.5">
                                                <Badge size="sm" color="brand">{t.category}</Badge>
                                                {!t.needsKeys ? <Badge size="sm" color="success">No keys needed</Badge> : null}
                                            </div>
                                        </button>
                                    ))}
                                    {results.length === 0 ? <p className="text-sm text-tertiary">No templates match “{query}”.</p> : null}
                                </div>
                            </>
                        )}
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
}
