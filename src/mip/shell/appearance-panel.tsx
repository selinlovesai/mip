/**
 * Appearance settings — an Untitled UI slide-out (triggered by the topbar gear)
 * for choosing the theme mode (light/dark/system) and the brand accent color.
 */

import { useState } from "react";
import { Check, Settings01 } from "@untitledui/icons";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { SlideoutMenu } from "@/components/application/slideout-menus/slideout-menu";
import { useTheme } from "@/providers/theme-provider";
import { cx } from "@/utils/cx";
import { ACCENTS, getSavedAccent, saveAccent } from "./appearance";

const MODES = ["light", "dark", "system"] as const;

function Panel({ close }: { close: () => void }) {
    const { theme, setTheme } = useTheme();
    const [accent, setAccent] = useState(getSavedAccent());

    return (
        <>
            <SlideoutMenu.Header onClose={close}>
                <h3 className="text-lg font-semibold text-primary">Appearance</h3>
                <p className="text-sm text-tertiary">Theme and accent for this workspace.</p>
            </SlideoutMenu.Header>
            <SlideoutMenu.Content className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-secondary">Theme</span>
                    <div className="flex gap-2">
                        {MODES.map((mode) => (
                            <button
                                key={mode}
                                onClick={() => setTheme(mode)}
                                className={cx(
                                    "flex-1 rounded-lg px-3 py-2 text-sm font-medium capitalize ring-1 transition-colors",
                                    theme === mode ? "bg-brand-50 text-brand-secondary ring-brand" : "bg-primary text-secondary ring-secondary hover:bg-secondary",
                                )}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-secondary">Accent color</span>
                    <div className="flex flex-wrap gap-3">
                        {Object.entries(ACCENTS).map(([key, a]) => (
                            <button
                                key={key}
                                onClick={() => {
                                    setAccent(key);
                                    saveAccent(key);
                                }}
                                aria-label={a.label}
                                title={a.label}
                                className={cx("flex size-9 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-primary transition", accent === key ? "ring-brand" : "ring-transparent")}
                                style={{ backgroundColor: a.swatch }}
                            >
                                {accent === key ? <Check className="size-4 text-white" /> : null}
                            </button>
                        ))}
                    </div>
                </div>
            </SlideoutMenu.Content>
        </>
    );
}

export function AppearanceButton() {
    return (
        <SlideoutMenu.Trigger>
            <ButtonUtility color="tertiary" icon={Settings01} tooltip="Appearance" />
            <SlideoutMenu>{({ close }) => <Panel close={close} />}</SlideoutMenu>
        </SlideoutMenu.Trigger>
    );
}
