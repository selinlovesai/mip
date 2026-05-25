/**
 * Assistant settings tab — pick the AI model connection, model name, and system
 * prompt for the in-app chat panel. The model list comes from connections
 * flagged `isAiModel` (toggled in Connections via "This connection provides an
 * AI model"). Persisted via useSettings().setAssistant.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { Select } from "@/components/base/select/select";
import { TextArea } from "@/components/base/textarea/textarea";
import { useSettings } from "../settings-store";
import { ModelField } from "../model-field";

const DEFAULT_PROMPT =
    "You are a helpful dashboard assistant. Help the user add widgets, arrange layouts, and interpret their data.";

export function AssistantTab() {
    const { aiConnections, assistant, getConnection, setAssistant } = useSettings();

    const [connectionId, setConnectionId] = useState<string | null>(assistant.connectionId ?? aiConnections[0]?.id ?? null);
    const selected = connectionId ? getConnection(connectionId) : undefined;

    const [model, setModel] = useState(assistant.model ?? selected?.aiModel ?? "");
    const [systemPrompt, setSystemPrompt] = useState(assistant.systemPrompt ?? DEFAULT_PROMPT);
    const [saved, setSaved] = useState(false);

    // When the chosen connection changes and no model is set yet, default the
    // model input from that connection's configured aiModel.
    useEffect(() => {
        if (!model && selected?.aiModel) setModel(selected.aiModel);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connectionId]);

    const hasConnections = aiConnections.length > 0;

    const save = () => {
        setAssistant({
            connectionId: connectionId ?? undefined,
            model: model.trim() || undefined,
            systemPrompt: systemPrompt.trim() || undefined,
        });
        setSaved(true);
        window.setTimeout(() => setSaved(false), 2000);
    };

    return (
        <div className="flex flex-col gap-8">
            <header>
                <h1 className="text-xl font-semibold text-primary">Assistant</h1>
                <p className="mt-1 text-sm text-tertiary">Configure the in-app AI assistant.</p>
            </header>

            {!hasConnections ? (
                <div className="max-w-lg rounded-xl bg-secondary p-4 ring-1 ring-secondary">
                    <p className="text-sm text-secondary">
                        No AI model connections yet — go to <span className="font-semibold text-primary">Connections</span>,
                        open or create a connection, and enable{" "}
                        <span className="font-semibold text-primary">“This connection provides an AI model.”</span>
                    </p>
                </div>
            ) : (
                <div className="flex max-w-md flex-col gap-4">
                    <Select
                        label="AI model connection"
                        placeholder="Choose a connection"
                        items={aiConnections.map((c) => ({ id: c.id, label: c.name }))}
                        selectedKey={connectionId}
                        onSelectionChange={(key) => setConnectionId(key == null ? null : String(key))}
                    >
                        {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                    </Select>

                    <ModelField
                        conn={selected}
                        value={model}
                        onChange={setModel}
                        hint="Models are listed from the selected provider; you can also type a specific id."
                    />

                    <TextArea
                        label="System prompt"
                        hint="Sent to the model on every conversation."
                        value={systemPrompt}
                        onChange={setSystemPrompt}
                        rows={6}
                    />

                    <div className="flex items-center gap-3">
                        <Button color="primary" size="md" onClick={save}>
                            Save
                        </Button>
                        {saved ? <span className="text-sm text-tertiary">Saved.</span> : null}
                    </div>
                </div>
            )}
        </div>
    );
}
