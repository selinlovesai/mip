/**
 * Appearance settings — a categorized DESIGN-TOKEN browser (Foundations).
 * Inner tabs: Theme · Colors · Typography · Shadows · Spacing & Radius. Each
 * token's value is read live from the CSS custom properties (so it reflects
 * light/dark mode + the chosen accent). This is the UI surface for the
 * DB-backed token registry (today values come from the Untitled @theme; the
 * `tokens` table will feed these same names later).
 */

import { useEffect, useState } from "react";
import { Check } from "@untitledui/icons";
import { useTheme } from "@/providers/theme-provider";
import { cx } from "@/utils/cx";
import { COLOR_TOKEN_GROUPS } from "@/mip/design-tokens";
import { dbAvailable, putToken } from "@/mip/api";
import { applyDbTokens } from "../../shell/db-tokens";
import { ACCENTS, getSavedAccent, saveAccent } from "../../shell/appearance";

type Section = "theme" | "colors" | "typography" | "shadows" | "spacing";

const SECTIONS: Array<{ id: Section; label: string }> = [
    { id: "theme", label: "Theme" },
    { id: "colors", label: "Colors" },
    { id: "typography", label: "Typography" },
    { id: "shadows", label: "Shadows" },
    { id: "spacing", label: "Spacing & Radius" },
];

// --- token catalogs (names map to emitted CSS custom properties) ---
const COLOR_GROUPS = COLOR_TOKEN_GROUPS;

const FONT_TOKENS = ["--font-body", "--font-display", "--font-mono"];
const DISPLAY_SCALE = ["--text-display-2xl", "--text-display-xl", "--text-display-lg", "--text-display-md", "--text-display-sm", "--text-display-xs"];
const SHADOW_TOKENS = ["--shadow-xs", "--shadow-sm", "--shadow-md", "--shadow-lg", "--shadow-xl", "--shadow-2xl", "--shadow-3xl"];
const RADIUS_TOKENS = ["--radius-none", "--radius-xs", "--radius-sm", "--radius-md", "--radius-lg", "--radius-xl", "--radius-2xl", "--radius-3xl", "--radius-full"];
const SPACING_STEPS = [1, 2, 3, 4, 6, 8, 12, 16];

const MODES = ["light", "dark", "system"] as const;

function readVar(name: string): string {
    if (typeof window === "undefined") return "";
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** The currently rendered mode — read from the dark-mode class the theme
 *  provider toggles, so "system" resolves correctly. Token edits target it. */
function resolvedMode(): "light" | "dark" {
    return typeof document !== "undefined" && document.documentElement.classList.contains("dark-mode") ? "dark" : "light";
}

/** Best-effort CSS color → #rrggbb for an <input type="color"> value. Handles
 *  `rgb(r g b)` / `rgb(r, g, b)` (what getComputedStyle returns) and hex. */
function toHex(color: string): string {
    const m = color.match(/rgba?\(([^)]+)\)/i);
    if (m) {
        const [r, g, b] = m[1].split(/[\s,/]+/).map(Number);
        if ([r, g, b].every((n) => Number.isFinite(n))) return "#" + [r, g, b].map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0")).join("");
    }
    if (/^#[0-9a-f]{6}$/i.test(color)) return color;
    if (/^#[0-9a-f]{3}$/i.test(color)) return "#" + [...color.slice(1)].map((c) => c + c).join("");
    return "#000000";
}

function TokenName({ name }: { name: string }) {
    return <code className="font-mono text-xs text-tertiary">{name.replace(/^--/, "")}</code>;
}

export function AppearanceTab() {
    const { theme, setTheme } = useTheme();
    const [section, setSection] = useState<Section>("theme");
    const [accent, setAccent] = useState(getSavedAccent());
    // When the backend DB is up, color tokens become editable (persisted +
    // applied live via the DB-token overlay). Otherwise the browser is read-only.
    const [dbReady, setDbReady] = useState(false);
    const [, setTick] = useState(0); // force re-read of CSS vars after an edit

    useEffect(() => {
        let alive = true;
        void dbAvailable().then((ok) => alive && setDbReady(ok));
        return () => {
            alive = false;
        };
    }, []);

    const editColor = async (name: string, group: string, hex: string) => {
        const mode = resolvedMode();
        if (await putToken(name, mode, hex, "color", group)) {
            await applyDbTokens(); // refresh the :root overlay so the var updates live
            setTick((t) => t + 1); // re-render so the printed value reflects the edit
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <header>
                <h1 className="text-xl font-semibold text-primary">Appearance</h1>
                <p className="mt-1 text-sm text-tertiary">Design foundations — tokens the whole interface and every widget pull from.</p>
            </header>

            {/* inner foundation tabs */}
            <div className="flex gap-1 border-b border-secondary">
                {SECTIONS.map((s) => (
                    <button
                        key={s.id}
                        onClick={() => setSection(s.id)}
                        className={cx("-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors", section === s.id ? "border-brand text-brand-secondary" : "border-transparent text-tertiary hover:text-secondary")}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            {section === "theme" ? (
                <div className="flex flex-col gap-8">
                    <section className="flex flex-col gap-3">
                        <span className="text-sm font-medium text-secondary">Mode</span>
                        <div className="flex max-w-md gap-2">
                            {MODES.map((mode) => (
                                <button key={mode} onClick={() => setTheme(mode)} className={cx("flex-1 rounded-lg px-3 py-2 text-sm font-medium capitalize ring-1 transition-colors", theme === mode ? "bg-brand-50 text-brand-secondary ring-brand" : "bg-primary text-secondary ring-secondary hover:bg-secondary")}>
                                    {mode}
                                </button>
                            ))}
                        </div>
                    </section>
                    <section className="flex flex-col gap-3">
                        <span className="text-sm font-medium text-secondary">Accent (brand ramp)</span>
                        <div className="flex flex-wrap gap-3">
                            {Object.entries(ACCENTS).map(([key, a]) => (
                                <button key={key} onClick={() => { setAccent(key); saveAccent(key); }} aria-label={a.label} title={a.label} className={cx("flex size-10 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-primary transition", accent === key ? "ring-brand" : "ring-transparent")} style={{ backgroundColor: a.swatch }}>
                                    {accent === key ? <Check className="size-4 text-white" /> : null}
                                </button>
                            ))}
                        </div>
                    </section>
                </div>
            ) : null}

            {section === "colors" ? (
                <div className="flex flex-col gap-8">
                    {COLOR_GROUPS.map((g) => (
                        <section key={g.group} className="flex flex-col gap-3">
                            <span className="text-xs font-semibold uppercase tracking-wide text-quaternary">{g.group}</span>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                                {g.tokens.map((name) => (
                                    <div key={name} className="flex items-center gap-3 rounded-lg p-2 ring-1 ring-secondary">
                                        {dbReady ? (
                                            <label className="relative size-9 shrink-0 cursor-pointer rounded-md ring-1 ring-inset ring-black/10" style={{ backgroundColor: `var(${name})` }} title={`Edit ${name.replace(/^--/, "")} (${resolvedMode()} mode)`}>
                                                <input
                                                    type="color"
                                                    aria-label={`Edit ${name}`}
                                                    defaultValue={toHex(readVar(name))}
                                                    onChange={(e) => void editColor(name, g.group, e.target.value)}
                                                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                                                />
                                            </label>
                                        ) : (
                                            <span className="size-9 shrink-0 rounded-md ring-1 ring-inset ring-black/10" style={{ backgroundColor: `var(${name})` }} />
                                        )}
                                        <span className="flex min-w-0 flex-col">
                                            <TokenName name={name} />
                                            <span className="truncate text-xs text-tertiary">{readVar(name) || "—"}</span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            ) : null}

            {section === "typography" ? (
                <div className="flex flex-col gap-8">
                    <section className="flex flex-col gap-3">
                        <span className="text-xs font-semibold uppercase tracking-wide text-quaternary">Font families</span>
                        <div className="flex flex-col gap-2">
                            {FONT_TOKENS.map((name) => (
                                <div key={name} className="flex items-center justify-between gap-4 rounded-lg p-3 ring-1 ring-secondary">
                                    <span className="text-lg text-primary" style={{ fontFamily: `var(${name})` }}>The quick brown fox</span>
                                    <TokenName name={name} />
                                </div>
                            ))}
                        </div>
                    </section>
                    <section className="flex flex-col gap-3">
                        <span className="text-xs font-semibold uppercase tracking-wide text-quaternary">Display scale</span>
                        <div className="flex flex-col gap-2">
                            {DISPLAY_SCALE.map((name) => (
                                <div key={name} className="flex items-baseline justify-between gap-4 rounded-lg p-3 ring-1 ring-secondary">
                                    <span className="truncate font-semibold text-primary" style={{ fontSize: `var(${name})` }}>Ag</span>
                                    <span className="flex shrink-0 flex-col items-end">
                                        <TokenName name={name} />
                                        <span className="text-xs text-tertiary">{readVar(name) || "—"}</span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            ) : null}

            {section === "shadows" ? (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {SHADOW_TOKENS.map((name) => (
                        <div key={name} className="flex flex-col items-center gap-3 rounded-xl bg-secondary p-6">
                            <span className="size-16 rounded-xl border border-secondary bg-white" style={{ boxShadow: `var(${name})` }} />
                            <TokenName name={name} />
                        </div>
                    ))}
                </div>
            ) : null}

            {section === "spacing" ? (
                <div className="flex flex-col gap-8">
                    <section className="flex flex-col gap-3">
                        <span className="text-xs font-semibold uppercase tracking-wide text-quaternary">Radius</span>
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                            {RADIUS_TOKENS.map((name) => (
                                <div key={name} className="flex flex-col items-center gap-2">
                                    <span className="size-14 bg-brand-solid" style={{ borderRadius: `var(${name})` }} />
                                    <TokenName name={name} />
                                </div>
                            ))}
                        </div>
                    </section>
                    <section className="flex flex-col gap-3">
                        <span className="text-xs font-semibold uppercase tracking-wide text-quaternary">Spacing</span>
                        <div className="flex flex-col gap-2">
                            {SPACING_STEPS.map((step) => (
                                <div key={step} className="flex items-center gap-3">
                                    <span className="h-3 rounded bg-brand-solid" style={{ width: `calc(var(--spacing, 0.25rem) * ${step})` }} />
                                    <code className="font-mono text-xs text-tertiary">spacing-{step}</code>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            ) : null}
        </div>
    );
}
