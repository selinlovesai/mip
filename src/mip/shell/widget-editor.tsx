/**
 * Widget editor — an Untitled UI slide-out drawer for editing a widget's title,
 * settings (as JSON), and a small **Design** section (border + background color)
 * that writes to `widget.style`. Persists via the store's `updateWidget`. The
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
import { DEFAULT_BACKGROUND_COLOR, DEFAULT_BORDER_COLOR } from "./widget-chrome";

/**
 * A color control supporting any CSS color OR "transparent" / CSS vars. A native
 * color swatch sets hex values; the text field accepts `transparent`,
 * `var(--…)`, rgb(), etc.; a quick button resets to transparent.
 */
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    // A native <input type=color> only understands #rrggbb; fall back to black
    // for the swatch when the value is transparent / a var() / a keyword.
    const swatch = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";
    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-secondary">{label}</span>
            <div className="flex items-center gap-2">
                <input
                    type="color"
                    aria-label={`${label} swatch`}
                    value={swatch}
                    onChange={(e) => onChange(e.target.value)}
                    className="size-9 shrink-0 cursor-pointer rounded-md border border-secondary bg-primary p-0.5"
                />
                <Input aria-label={label} value={value} onChange={onChange} placeholder="transparent" />
                <Button color="secondary" size="sm" onClick={() => onChange("transparent")}>
                    Clear
                </Button>
            </div>
        </div>
    );
}

function EditorPanel({ widget, close }: { widget: MipWidget; close: () => void }) {
    const { updateWidget } = useDashboard();
    const [title, setTitle] = useState(widget.title ?? "");
    const [settingsText, setSettingsText] = useState(JSON.stringify(widget.settings ?? {}, null, 2));
    const [borderColor, setBorderColor] = useState(widget.style?.borderColor ?? DEFAULT_BORDER_COLOR);
    const [backgroundColor, setBackgroundColor] = useState(widget.style?.backgroundColor ?? DEFAULT_BACKGROUND_COLOR);
    const [error, setError] = useState<string | null>(null);

    const save = () => {
        let settings: Record<string, unknown>;
        try {
            settings = settingsText.trim() ? JSON.parse(settingsText) : {};
        } catch (err) {
            setError(err instanceof Error ? err.message : "Invalid JSON");
            return;
        }
        updateWidget(widget.id, {
            title: title.trim() || undefined,
            settings,
            style: { ...widget.style, borderColor, backgroundColor },
        });
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
                    rows={12}
                    textAreaClassName="font-mono text-xs"
                />
                {error ? <p className="text-sm text-utility-error-500">{error}</p> : null}

                {/* Design — border + background color (first slice of the Design tab) */}
                <div className="flex flex-col gap-3 border-t border-secondary pt-4">
                    <span className="text-xs font-semibold uppercase tracking-wide text-quaternary">Design</span>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <ColorField label="Border" value={borderColor} onChange={setBorderColor} />
                        <ColorField label="Background" value={backgroundColor} onChange={setBackgroundColor} />
                    </div>
                </div>
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
