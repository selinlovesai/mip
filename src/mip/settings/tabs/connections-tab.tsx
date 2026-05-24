/** Connections settings tab — data sources list + add flow. */

import { useState } from "react";
import { Trash01 } from "@untitledui/icons";
import { Badge, type BadgeColor } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { CloseButton } from "@/components/base/buttons/close-button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { TextArea } from "@/components/base/textarea/textarea";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { useSettings, type Connection, type DataSourceType } from "../settings-store";

const TYPES: { id: DataSourceType; label: string; supportingText: string }[] = [
    { id: "mock", label: "Mock", supportingText: "Built-in sample data" },
    { id: "rest", label: "REST", supportingText: "Fetch from an HTTP endpoint" },
    { id: "json", label: "JSON", supportingText: "Inline JSON payload" },
    { id: "csv", label: "CSV", supportingText: "Inline CSV data" },
];

const TYPE_BADGE: Record<DataSourceType, { color: BadgeColor<"pill-color">; label: string }> = {
    mock: { color: "gray", label: "Mock" },
    rest: { color: "blue", label: "REST" },
    json: { color: "brand", label: "JSON" },
    csv: { color: "success", label: "CSV" },
};

function detailLine(conn: Connection): string {
    switch (conn.type) {
        case "rest":
            return conn.detail || "REST endpoint";
        case "json":
        case "csv":
            return "inline payload";
        case "mock":
        default:
            return "sample data";
    }
}

function AddConnectionModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { addConnection } = useSettings();
    const [type, setType] = useState<DataSourceType>("mock");
    const [name, setName] = useState("");
    const [detail, setDetail] = useState("");

    const reset = () => {
        setType("mock");
        setName("");
        setDetail("");
    };

    const close = () => {
        reset();
        onClose();
    };

    const canSubmit = name.trim().length > 0;

    const submit = () => {
        if (!canSubmit) return;
        const trimmedDetail = detail.trim();
        addConnection({
            name: name.trim(),
            type,
            ...(type !== "mock" && trimmedDetail ? { detail: trimmedDetail } : {}),
        });
        close();
    };

    return (
        <ModalOverlay isOpen={isOpen} onOpenChange={(open) => !open && close()} isDismissable>
            <Modal>
                <Dialog>
                    <div className="flex w-[min(90vw,440px)] flex-col gap-5 rounded-xl bg-primary p-6 shadow-xl ring-1 ring-secondary">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-md font-semibold text-primary">Add connection</h2>
                                <p className="mt-1 text-sm text-tertiary">Pick a data source type and give it a name.</p>
                            </div>
                            <CloseButton size="sm" label="Close" onPress={close} />
                        </div>

                        <Select
                            label="Type"
                            selectedKey={type}
                            onSelectionChange={(key) => setType(key as DataSourceType)}
                            items={TYPES}
                        >
                            {(item) => (
                                <Select.Item id={item.id} label={item.label} supportingText={item.supportingText}>
                                    {item.label}
                                </Select.Item>
                            )}
                        </Select>

                        <Input label="Name" value={name} onChange={setName} placeholder="My data source" isRequired />

                        {type === "rest" && (
                            <Input
                                label="Base URL"
                                value={detail}
                                onChange={setDetail}
                                type="text"
                                placeholder="https://api.example.com"
                            />
                        )}

                        {type === "json" && (
                            <TextArea
                                label="JSON payload"
                                value={detail}
                                onChange={setDetail}
                                rows={6}
                                placeholder={'{\n  "key": "value"\n}'}
                            />
                        )}

                        {type === "csv" && (
                            <TextArea
                                label="CSV data"
                                value={detail}
                                onChange={setDetail}
                                rows={6}
                                placeholder={"name,value\nAlpha,10\nBeta,20"}
                            />
                        )}

                        <div className="mt-1 flex justify-end gap-3">
                            <Button color="secondary" size="md" onClick={close}>
                                Cancel
                            </Button>
                            <Button color="primary" size="md" isDisabled={!canSubmit} onClick={submit}>
                                Add
                            </Button>
                        </div>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
}

export function ConnectionsTab() {
    const { connections, removeConnection } = useSettings();
    const [isAdding, setIsAdding] = useState(false);

    return (
        <div className="flex flex-col gap-8">
            <header className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold text-primary">Connections</h1>
                    <p className="mt-1 text-sm text-tertiary">Data sources your widgets can read from.</p>
                </div>
                <Button color="primary" size="md" onClick={() => setIsAdding(true)}>
                    Add connection
                </Button>
            </header>

            <div className="divide-y divide-secondary overflow-hidden rounded-xl ring-1 ring-secondary">
                {connections.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-tertiary">No connections yet.</p>
                ) : (
                    connections.map((conn) => {
                        const badge = TYPE_BADGE[conn.type];
                        return (
                            <div key={conn.id} className="flex items-center gap-3 px-4 py-3">
                                <Badge type="pill-color" color={badge.color} size="sm">
                                    {badge.label}
                                </Badge>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-primary">{conn.name}</p>
                                    <p className="truncate text-xs text-tertiary">{detailLine(conn)}</p>
                                </div>
                                <ButtonUtility
                                    size="sm"
                                    color="tertiary"
                                    icon={Trash01}
                                    tooltip="Remove connection"
                                    onClick={() => removeConnection(conn.id)}
                                />
                            </div>
                        );
                    })
                )}
            </div>

            <AddConnectionModal isOpen={isAdding} onClose={() => setIsAdding(false)} />
        </div>
    );
}
