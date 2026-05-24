/**
 * Widget editor — an Untitled UI slide-out drawer with two tabs:
 *   · Settings — title + settings JSON
 *   · Design   — border + background color, each pickable from a native swatch,
 *                a free-text field (transparent / var() / rgb()), OR the shared
 *                design-token palette (same colors as Settings → Appearance).
 * Persists via the store's `updateWidget` (settings + widget.style). The edit
 * button (shown in edit mode by WidgetChrome) is the drawer trigger.
 */

import { useState } from "react";
import { ChevronRight, Edit03 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { TextArea } from "@/components/base/textarea/textarea";
import { SlideoutMenu } from "@/components/application/slideout-menus/slideout-menu";
import { COLOR_TOKEN_GROUPS } from "@/mip/design-tokens";
import { useDashboard } from "@/mip/store";
import type { MipWidget } from "@/mip/schema";
import { cx } from "@/utils/cx";
import { DEFAULT_BACKGROUND_COLOR } from "./widget-chrome";

const COLOR_SCHEMES = [
    { id: "default", label: "Default (follow theme)" },
    { id: "light", label: "Light" },
    { id: "dark", label: "Dark" },
];

type EditorTab = "settings" | "design";

/**
 * A full-width color control. Supports any CSS color or `transparent` / `var()`
 * via the swatch + text field, plus one-click selection from the design-token
 * palette (writes `var(--color-…)`).
 */
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    const [showPresets, setShowPresets] = useState(false);
    const isHex = /^#[0-9a-fA-F]{6}$/.test(value);
    return (
        <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-secondary">{label}</span>
            <div className="flex items-center gap-2">
                {/* single rounded, borderless swatch — previews the value AND
                    opens the native picker (invisible overlay input). */}
                <span className="relative size-9 shrink-0 overflow-hidden rounded-md" style={{ background: value || "transparent" }}>
                    <input
                        type="color"
                        aria-label={`${label} color picker`}
                        value={isHex ? value : "#000000"}
                        onChange={(e) => onChange(e.target.value)}
                        className="absolute inset-0 size-full cursor-pointer opacity-0"
                    />
                </span>
                <Input aria-label={label} value={value} onChange={onChange} placeholder="transparent" />
                <Button color="secondary" size="sm" onClick={() => onChange("transparent")}>
                    Clear
                </Button>
            </div>

            {/* collapsible token palette — same colors as Settings → Appearance */}
            <button
                type="button"
                onClick={() => setShowPresets((v) => !v)}
                className="flex w-fit items-center gap-1 text-xs font-medium text-tertiary hover:text-secondary"
            >
                <ChevronRight className={cx("size-3.5 transition-transform", showPresets && "rotate-90")} />
                Preset colors
            </button>
            {showPresets ? (
                <div className="flex flex-col gap-2 rounded-lg bg-secondary p-2 ring-1 ring-secondary">
                    {COLOR_TOKEN_GROUPS.map((g) => (
                        <div key={g.group} className="flex flex-col gap-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-quaternary">{g.group}</span>
                            <div className="flex flex-wrap gap-1.5">
                                {g.tokens.map((token) => {
                                    const cssVar = `var(${token})`;
                                    const selected = value === cssVar;
                                    return (
                                        <button
                                            key={token}
                                            type="button"
                                            title={token.replace(/^--color-/, "")}
                                            aria-label={token}
                                            onClick={() => onChange(cssVar)}
                                            className={cx("size-6 rounded-md ring-1 ring-inset ring-black/10 transition", selected ? "outline outline-2 outline-offset-1 outline-brand" : "hover:scale-110")}
                                            style={{ backgroundColor: cssVar }}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

function EditorPanel({ widget, close }: { widget: MipWidget; close: () => void }) {
    const { updateWidget } = useDashboard();
    const [tab, setTab] = useState<EditorTab>("settings");
    const [title, setTitle] = useState(widget.title ?? "");
    const [settingsText, setSettingsText] = useState(JSON.stringify(widget.settings ?? {}, null, 2));
    const [scheme, setScheme] = useState<string>(widget.style?.colorScheme ?? "default");
    const [backgroundColor, setBackgroundColor] = useState(widget.style?.backgroundColor ?? DEFAULT_BACKGROUND_COLOR);
    const [error, setError] = useState<string | null>(null);

    const save = () => {
        let settings: Record<string, unknown>;
        try {
            settings = settingsText.trim() ? JSON.parse(settingsText) : {};
        } catch (err) {
            setError(err instanceof Error ? err.message : "Invalid JSON");
            setTab("settings");
            return;
        }
        updateWidget(widget.id, {
            title: title.trim() || undefined,
            settings,
            style: { ...widget.style, backgroundColor, colorScheme: scheme === "default" ? undefined : (scheme as "light" | "dark") },
        });
        close();
    };

    const TABS: Array<{ id: EditorTab; label: string }> = [
        { id: "settings", label: "Settings" },
        { id: "design", label: "Design" },
    ];

    return (
        <>
            <SlideoutMenu.Header onClose={close}>
                <h3 className="text-lg font-semibold text-primary">Edit widget</h3>
                <p className="text-sm text-tertiary">
                    <span className="font-mono">{widget.type}</span>
                </p>
            </SlideoutMenu.Header>
            <SlideoutMenu.Content className="flex flex-col gap-4">
                {/* tabs */}
                <div className="flex gap-1 border-b border-secondary">
                    {TABS.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={cx("-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors", tab === t.id ? "border-brand text-brand-secondary" : "border-transparent text-tertiary hover:text-secondary")}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {tab === "settings" ? (
                    <div className="flex flex-col gap-4">
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
                        {error ? <p className="text-sm text-error-primary">{error}</p> : null}
                    </div>
                ) : (
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-col gap-1.5">
                            <span className="text-sm font-medium text-secondary">Text &amp; Border</span>
                            <Select aria-label="Text and border color scheme" selectedKey={scheme} items={COLOR_SCHEMES} onSelectionChange={(k) => setScheme(String(k))}>
                                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                            </Select>
                            <span className="text-xs text-tertiary">Light or Dark adjusts text, sub-text and border to their own shades.</span>
                        </div>
                        <ColorField label="Background" value={backgroundColor} onChange={setBackgroundColor} />
                    </div>
                )}
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
