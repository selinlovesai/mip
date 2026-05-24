/** Assistant settings tab — provider + system prompt for the AI panel. */

import { useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { Select } from "@/components/base/select/select";
import { TextArea } from "@/components/base/textarea/textarea";
import { useSettings } from "../settings-store";
import { APP_CATALOG } from "../apps-catalog";

const AI_PROVIDERS = APP_CATALOG.filter((a) => a.category === "AI");

export function AssistantTab() {
    const { isAppConnected } = useSettings();
    const connected = AI_PROVIDERS.filter((p) => isAppConnected(p.id));
    const [provider, setProvider] = useState<string | null>(connected[0]?.id ?? null);
    const [prompt, setPrompt] = useState("You are a helpful dashboard assistant. Help the user add widgets, arrange layouts, and interpret their data.");

    return (
        <div className="flex flex-col gap-8">
            <header>
                <h1 className="text-xl font-semibold text-primary">Assistant</h1>
                <p className="mt-1 text-sm text-tertiary">Configure the in-app AI assistant.</p>
            </header>

            <div className="flex max-w-md flex-col gap-4">
                <Select
                    label="Provider"
                    placeholder={connected.length ? "Choose a provider" : "Connect an AI app first"}
                    items={connected.map((p) => ({ id: p.id, label: p.name }))}
                    selectedKey={provider}
                    onSelectionChange={(key) => setProvider(key == null ? null : String(key))}
                >
                    {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                </Select>
                {connected.length === 0 ? (
                    <p className="text-sm text-tertiary">No AI providers connected yet — connect one in the <span className="font-medium text-secondary">Apps</span> tab to enable live answers.</p>
                ) : null}

                <TextArea label="System prompt" hint="Sent to the model on every conversation." value={prompt} onChange={setPrompt} rows={6} />
            </div>

            <div>
                <Button color="primary" size="md">
                    Save
                </Button>
            </div>
        </div>
    );
}
