/**
 * Widget editor — an Untitled UI slide-out drawer for editing a widget's title
 * and settings (as JSON) live, persisting via the store's `updateWidget`. The
 * edit button (shown in edit mode by WidgetChrome) is the drawer trigger.
 */

import { useState } from "react";
import { Edit03 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/textarea/textarea";
import { SlideoutMenu } from "@/components/application/slideout-menus/slideout-menu";
import { useDashboard } from "@/mip/store";
import type { MipWidget } from "@/mip/schema";

function EditorPanel({ widget, close }: { widget: MipWidget; close: () => void }) {
    const { updateWidget } = useDashboard();
    const [title, setTitle] = useState(widget.title ?? "");
    const [settingsText, setSettingsText] = useState(JSON.stringify(widget.settings ?? {}, null, 2));
    const [error, setError] = useState<string | null>(null);

    const save = () => {
        let settings: Record<string, unknown>;
        try {
            settings = settingsText.trim() ? JSON.parse(settingsText) : {};
        } catch (err) {
            setError(err instanceof Error ? err.message : "Invalid JSON");
            return;
        }
        updateWidget(widget.id, { title: title.trim() || undefined, settings });
        close();
    };

    return (
        <>
            <SlideoutMenu.Header onClose={close}>
                <h3 className="text-lg font-semibold text-primary">Edit widget</h3>
                <p className="text-sm text-tertiary">
                    <span className="font-mono">{widget.type}</span>
                </p>
            </SlideoutMenu.Header>
            <SlideoutMenu.Content className="flex flex-col gap-4">
                <Input label="Title" value={title} onChange={setTitle} placeholder="Widget title" />
                <TextArea
                    label="Settings (JSON)"
                    hint="The widget's data/configuration. Must be valid JSON."
                    value={settingsText}
                    onChange={(next) => {
                        setSettingsText(next);
                        setError(null);
                    }}
                    rows={14}
                    textAreaClassName="font-mono text-xs"
                />
                {error ? <p className="text-sm text-utility-red-500">{error}</p> : null}
            </SlideoutMenu.Content>
            <SlideoutMenu.Footer>
                <div className="flex justify-end gap-2">
                    <Button color="secondary" size="md" onClick={close}>
                        Cancel
                    </Button>
                    <Button color="primary" size="md" onClick={save}>
                        Save changes
                    </Button>
                </div>
            </SlideoutMenu.Footer>
        </>
    );
}

export function WidgetEditorButton({ widget }: { widget: MipWidget }) {
    return (
        <SlideoutMenu.Trigger>
            <ButtonUtility color="tertiary" size="xs" icon={Edit03} tooltip="Edit widget" />
            <SlideoutMenu>{({ close }) => <EditorPanel widget={widget} close={close} />}</SlideoutMenu>
        </SlideoutMenu.Trigger>
    );
}
