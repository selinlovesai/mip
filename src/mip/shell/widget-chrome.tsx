/**
 * Grid-cell chrome around a rendered widget: a drag handle (the only draggable
 * surface, matched by the grid's `dragConfig.handle`) and a delete button, both
 * revealed on hover while in edit mode. The widget itself renders via WidgetView.
 */

import { DotsGrid, Expand01, Trash01 } from "@untitledui/icons";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { CloseButton } from "@/components/base/buttons/close-button";
import { Dialog, DialogTrigger, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { WidgetView } from "@/mip/adapter/registry";
import type { MipWidget } from "@/mip/schema";
import { cx } from "@/utils/cx";
import { WidgetEditorButton } from "./widget-editor";

function ExpandWidgetButton({ widget }: { widget: MipWidget }) {
    return (
        <DialogTrigger>
            <ButtonUtility color="tertiary" size="xs" icon={Expand01} tooltip="Expand widget" />
            <ModalOverlay isDismissable>
                <Modal>
                    <Dialog>
                        <div className="flex max-h-[85vh] w-[min(90vw,900px)] flex-col overflow-hidden rounded-xl bg-primary shadow-xl ring-1 ring-secondary">
                            <div className="flex items-center justify-between gap-4 border-b border-secondary px-5 py-4">
                                <h2 className="text-md font-semibold text-primary">{widget.title ?? "Widget"}</h2>
                                <CloseButton slot="close" size="sm" label="Close" />
                            </div>
                            <div className="min-h-[60vh] flex-1 overflow-auto p-5">
                                <WidgetView widget={widget} />
                            </div>
                        </div>
                    </Dialog>
                </Modal>
            </ModalOverlay>
        </DialogTrigger>
    );
}

export function WidgetChrome({ widget, editMode, onDelete }: { widget: MipWidget; editMode: boolean; onDelete: (id: string) => void }) {
    return (
        <div className={cx("group relative h-full", editMode && "rounded-xl ring-1 ring-transparent transition-shadow hover:ring-brand")}>
            {editMode ? (
                <div className="absolute right-2 top-2 z-10 flex items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                    <span className="mip-drag-handle flex size-7 cursor-grab items-center justify-center rounded-md bg-primary text-tertiary ring-1 ring-secondary hover:text-secondary active:cursor-grabbing" aria-label="Drag widget" title="Drag">
                        <DotsGrid className="size-4" />
                    </span>
                    <WidgetEditorButton widget={widget} />
                    <ExpandWidgetButton widget={widget} />
                    <ButtonUtility color="tertiary" size="xs" icon={Trash01} tooltip="Delete widget" onClick={() => onDelete(widget.id)} />
                </div>
            ) : (
                <div className="absolute right-2 top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100">
                    <ExpandWidgetButton widget={widget} />
                </div>
            )}
            <div className="h-full overflow-hidden rounded-xl">
                <WidgetView widget={widget} />
            </div>
        </div>
    );
}
