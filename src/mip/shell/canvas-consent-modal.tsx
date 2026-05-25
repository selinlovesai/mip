/**
 * Risk-consent gate for the freeform AI canvas. Shown before the first canvas is
 * created. Spells out exactly what activating it means — the assistant can run
 * arbitrary HTML/CSS/JavaScript — and the safeguards (sandboxed, isolated from
 * the app and your data). Requires an explicit checkbox + Enable.
 */

import { useState } from "react";
import { AlertTriangle } from "@untitledui/icons";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Button } from "@/components/base/buttons/button";
import { CloseButton } from "@/components/base/buttons/close-button";
import { Checkbox } from "@/components/base/checkbox/checkbox";

export function CanvasConsentModal({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: () => void }) {
    const [ack, setAck] = useState(false);

    return (
        <ModalOverlay isOpen={open} onOpenChange={(v) => !v && onClose()} isDismissable>
            <Modal className="max-w-lg">
                <Dialog>
                    <div className="flex w-full flex-col gap-5 rounded-xl bg-primary p-6 shadow-xl ring-1 ring-secondary">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <span className="flex size-10 items-center justify-center rounded-full bg-utility-orange-50">
                                    <AlertTriangle className="size-5 text-utility-orange-500" />
                                </span>
                                <h2 className="text-lg font-semibold text-primary">Enable AI Canvas</h2>
                            </div>
                            <CloseButton onPress={onClose} label="Close" />
                        </div>

                        <p className="text-sm text-secondary">
                            An AI Canvas lets the assistant generate and run <span className="font-medium text-primary">arbitrary HTML, CSS and JavaScript</span> to build whatever you ask for.
                        </p>

                        <div className="flex flex-col gap-2 rounded-lg bg-secondary p-3 text-sm text-tertiary ring-1 ring-secondary">
                            <p className="font-medium text-secondary">How it's kept safe</p>
                            <ul className="ml-4 list-disc space-y-1">
                                <li>Canvas code runs in a <span className="font-medium text-secondary">sandboxed frame</span>, isolated from the app.</li>
                                <li>It <span className="font-medium text-secondary">cannot access</span> your dashboards, connections, API keys, or browser storage.</li>
                                <li>It cannot break or modify the rest of the application.</li>
                            </ul>
                            <p className="mt-1 font-medium text-secondary">What to keep in mind</p>
                            <ul className="ml-4 list-disc space-y-1">
                                <li>Generated code can make <span className="font-medium text-secondary">network requests</span> and render arbitrary content.</li>
                                <li>Only run canvases from prompts you trust; treat it like running code.</li>
                            </ul>
                        </div>

                        <Checkbox
                            isSelected={ack}
                            onChange={setAck}
                            label="I understand the canvas runs AI-generated code in a sandbox, and I want to enable it."
                        />

                        <div className="flex justify-end gap-2">
                            <Button color="secondary" size="md" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button color="primary" size="md" isDisabled={!ack} onClick={onConfirm}>
                                Enable & create canvas
                            </Button>
                        </div>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
}
