/** Appearance settings tab — theme mode + brand accent color. */

import { useState } from "react";
import { Check } from "@untitledui/icons";
import { useTheme } from "@/providers/theme-provider";
import { cx } from "@/utils/cx";
import { ACCENTS, getSavedAccent, saveAccent } from "../../shell/appearance";

const MODES = ["light", "dark", "system"] as const;

export function AppearanceTab() {
    const { theme, setTheme } = useTheme();
    const [accent, setAccent] = useState(getSavedAccent());

    return (
        <div className="flex flex-col gap-8">
            <header>
                <h1 className="text-xl font-semibold text-primary">Appearance</h1>
                <p className="mt-1 text-sm text-tertiary">Theme and accent color for this workspace.</p>
            </header>

            <section className="flex flex-col gap-3">
                <span className="text-sm font-medium text-secondary">Theme</span>
                <div className="flex max-w-md gap-2">
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
            </section>

            <section className="flex flex-col gap-3">
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
                            className={cx("flex size-10 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-primary transition", accent === key ? "ring-brand" : "ring-transparent")}
                            style={{ backgroundColor: a.swatch }}
                        >
                            {accent === key ? <Check className="size-4 text-white" /> : null}
                        </button>
                    ))}
                </div>
            </section>
        </div>
    );
}
