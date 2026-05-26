/**
 * Appearance settings — a categorized DESIGN-TOKEN browser (Foundations).
 * Section tabs: Theme · Colors · Typography · Shadows · Spacing & Radius.
 *
 * When the backend DB is up, the full token set (584 rows: color / typography /
 * radius / shadow) is loaded from `/api/tokens` and rendered DATA-DRIVEN —
 * Colors fans out into sub-tabs per group (Brand · Text · Background · Border ·
 * Foreground · Utility · Palette), and color tokens are editable inline (the
 * swatch is a color picker → PUT → live overlay refresh). When the DB is off it
 * falls back to the curated static catalogs and is read-only. Token VALUES are
 * always read live from the CSS custom properties, so they reflect light/dark +
 * the chosen accent.
 */

import { useEffect, useMemo, useState } from "react";
import { Check } from "@untitledui/icons";
import { useTheme } from "@/providers/theme-provider";
import { cx } from "@/utils/cx";
import { COLOR_TOKEN_GROUPS } from "@/mip/design-tokens";
import { dbAvailable, listTokens, putToken, type DesignToken } from "@/mip/api";
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

// --- static fallback catalogs (used when the DB is unavailable) ---
const FONT_TOKENS = ["--font-body", "--font-display", "--font-mono"];
const DISPLAY_SCALE = ["--text-display-2xl", "--text-display-xl", "--text-display-lg", "--text-display-md", "--text-display-sm", "--text-display-xs", "--text-xl", "--text-lg", "--text-md", "--text-sm", "--text-xs"];
const SHADOW_TOKENS = ["--shadow-xs", "--shadow-sm", "--shadow-md", "--shadow-lg", "--shadow-xl", "--shadow-2xl", "--shadow-3xl"];
const RADIUS_TOKENS = ["--radius-none", "--radius-xs", "--radius-sm", "--radius-md", "--radius-lg", "--radius-xl", "--radius-2xl", "--radius-3xl", "--radius-full"];
const SPACING_STEPS = [1, 2, 3, 4, 6, 8, 12, 16];

// Display order for color sub-tabs; "Base" is shown as "Palette".
const COLOR_GROUP_ORDER = ["Brand", "Text", "Background", "Foreground", "Border", "Utility", "Base"];
const groupLabel = (g: string) => (g === "Base" ? "Palette" : g);

const MODES = ["light", "dark", "system"] as const;

/** Friendly UI-level settings: each maps a SEMANTIC token (the thing the app
 *  actually uses) to whichever token the user picks. Changing one re-points the
 *  semantic token at the chosen color (stored as `var(--…)`), so every element
 *  using it updates at once — e.g. "Icon color" drives icons across buttons,
 *  inputs, and nav. These are friendlier than editing the raw token grid. */
const UI_SETTINGS: Array<{ target: string; label: string; hint: string }> = [
    { target: "--color-fg-primary", label: "Icon color (primary)", hint: "High-contrast icons" },
    { target: "--color-fg-quaternary", label: "Icon color (muted)", hint: "Input, help & button icons" },
    { target: "--color-fg-brand-primary", label: "Accent color", hint: "Featured icons, progress, active states" },
    { target: "--color-bg-brand-solid", label: "Primary button", hint: "Solid brand background" },
    { target: "--color-text-brand-secondary", label: "Link color", hint: "Links & brand text" },
    { target: "--color-focus-ring", label: "Focus ring", hint: "Keyboard-focus outline" },
];

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

/** Unique token names of a kind (the DB has a row per mode; we want each name once). */
function namesOfKind(tokens: DesignToken[], kind: string, filter?: (name: string) => boolean): string[] {
    const seen = new Set<string>();
    for (const t of tokens) if (t.kind === kind && !seen.has(t.name) && (!filter || filter(t.name))) seen.add(t.name);
    return [...seen];
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
    const [tokens, setTokens] = useState<DesignToken[]>([]);
    const [colorSub, setColorSub] = useState<string>("Brand");
    const [, setTick] = useState(0); // force re-read of CSS vars after an edit

    useEffect(() => {
        let alive = true;
        void dbAvailable().then(async (ok) => {
            if (!alive) return;
            setDbReady(ok);
            if (ok) setTokens(await listTokens());
        });
        return () => {
            alive = false;
        };
    }, []);

    // Color groups: from the DB when available (full set), else the curated list.
    const colorGroups = useMemo<Array<{ group: string; tokens: string[] }>>(() => {
        if (!tokens.length) return COLOR_TOKEN_GROUPS.map((g) => ({ group: g.group, tokens: g.tokens }));
        const byGroup = new Map<string, string[]>();
        const seen = new Set<string>();
        for (const t of tokens) {
            if (t.kind !== "color" || seen.has(t.name)) continue;
            seen.add(t.name);
            (byGroup.get(t.group) ?? byGroup.set(t.group, []).get(t.group)!).push(t.name);
        }
        const ordered = [...byGroup.keys()].sort((a, b) => {
            const ia = COLOR_GROUP_ORDER.indexOf(a), ib = COLOR_GROUP_ORDER.indexOf(b);
            return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        });
        return ordered.map((group) => ({ group, tokens: byGroup.get(group)!.sort() }));
    }, [tokens]);

    // Keep the active color sub-tab valid as groups load.
    useEffect(() => {
        if (colorGroups.length && !colorGroups.some((g) => g.group === colorSub)) setColorSub(colorGroups[0].group);
    }, [colorGroups, colorSub]);

    // Typography / shadow / radius: DB set when available, else static fallback.
    const fontTokens = useMemo(() => (tokens.length ? namesOfKind(tokens, "typography", (n) => n.startsWith("--font-")).sort() : FONT_TOKENS), [tokens]);
    const textTokens = useMemo(
        () => (tokens.length ? namesOfKind(tokens, "typography", (n) => n.startsWith("--text-") && !n.endsWith("--line-height") && !n.endsWith("--letter-spacing")).sort() : DISPLAY_SCALE),
        [tokens],
    );
    const shadowTokens = useMemo(() => (tokens.length ? namesOfKind(tokens, "shadow").sort() : SHADOW_TOKENS), [tokens]);
    const radiusTokens = useMemo(() => (tokens.length ? namesOfKind(tokens, "radius").sort() : RADIUS_TOKENS), [tokens]);

    /** Persist a token edit, keep local state in sync, and refresh the overlay. */
    const saveToken = async (name: string, value: string, group: string) => {
        const mode = resolvedMode();
        if (!(await putToken(name, mode, value, "color", group))) return false;
        setTokens((prev) => {
            const i = prev.findIndex((t) => t.name === name && t.mode === mode);
            const row: DesignToken = { name, mode, value, kind: "color", group, updatedAt: new Date().toISOString() };
            if (i === -1) return [...prev, row];
            const next = prev.slice();
            next[i] = { ...next[i], value, group };
            return next;
        });
        await applyDbTokens(); // refresh the :root overlay so the var updates live
        setTick((t) => t + 1); // re-render so printed values reflect the edit
        return true;
    };

    const editColor = (name: string, group: string, hex: string) => void saveToken(name, hex, group);

    /** The token a semantic target currently points at (when stored as `var(--x)`). */
    const currentRef = (target: string): string => {
        const row = tokens.find((t) => t.name === target && t.mode === resolvedMode());
        const m = (row?.value ?? "").match(/^var\((--[a-z0-9-]+)\)$/i);
        return m ? m[1] : "";
    };

    const pickToken = (target: string, ref: string) => {
        const group = tokens.find((t) => t.name === target)?.group ?? "";
        void saveToken(target, ref ? `var(${ref})` : readVar(target) || "#000000", group);
    };

    const activeGroup = colorGroups.find((g) => g.group === colorSub) ?? colorGroups[0];

    return (
        <div className="flex flex-col gap-6">
            <header>
                <h1 className="text-xl font-semibold text-primary">Appearance</h1>
                <p className="mt-1 text-sm text-tertiary">
                    Design foundations — tokens the whole interface and every widget pull from.
                    {dbReady ? " Color tokens are editable and persist to the database." : " Connect the backend to edit and persist tokens."}
                </p>
            </header>

            {/* section tabs */}
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

                    {/* UI elements — map semantic tokens to a chosen token from the list */}
                    <section className="flex flex-col gap-3">
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-secondary">UI elements</span>
                            <span className="text-xs text-tertiary">
                                {dbReady ? `Point a UI element at any token. Applies to ${resolvedMode()} mode.` : "Connect the backend to customize and persist these."}
                            </span>
                        </div>
                        <div className="flex flex-col gap-2">
                            {UI_SETTINGS.map((s) => {
                                const ref = currentRef(s.target);
                                return (
                                    <div key={s.target} className="flex items-center gap-3 rounded-lg p-3 ring-1 ring-secondary">
                                        <span className="size-8 shrink-0 rounded-md ring-1 ring-inset ring-black/10" style={{ backgroundColor: `var(${s.target})` }} aria-hidden="true" />
                                        <span className="flex min-w-0 flex-1 flex-col">
                                            <span className="truncate text-sm font-medium text-secondary">{s.label}</span>
                                            <span className="truncate text-xs text-tertiary">{s.hint}</span>
                                        </span>
                                        <select
                                            aria-label={s.label}
                                            disabled={!dbReady}
                                            value={ref}
                                            onChange={(e) => pickToken(s.target, e.target.value)}
                                            className="w-44 shrink-0 rounded-lg bg-primary px-2.5 py-2 text-xs text-secondary ring-1 ring-secondary transition-colors hover:ring-brand disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <option value="">{ref ? "Custom / default" : "Default"}</option>
                                            {colorGroups.map((g) => (
                                                <optgroup key={g.group} label={groupLabel(g.group)}>
                                                    {g.tokens.map((name) => (
                                                        <option key={name} value={name}>
                                                            {name.replace(/^--color-/, "")}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                        </select>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                </div>
            ) : null}

            {section === "colors" && activeGroup ? (
                <div className="flex flex-col gap-5">
                    {/* color group sub-tabs */}
                    <div className="flex flex-wrap gap-1.5">
                        {colorGroups.map((g) => (
                            <button
                                key={g.group}
                                onClick={() => setColorSub(g.group)}
                                className={cx(
                                    "rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors",
                                    g.group === colorSub ? "bg-brand-50 text-brand-secondary ring-brand" : "bg-primary text-tertiary ring-secondary hover:text-secondary",
                                )}
                            >
                                {groupLabel(g.group)} <span className="opacity-60">{g.tokens.length}</span>
                            </button>
                        ))}
                    </div>

                    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {activeGroup.tokens.map((name) => (
                            <div key={name} className="flex items-center gap-3 rounded-lg p-2 ring-1 ring-secondary">
                                {dbReady ? (
                                    <label className="relative size-9 shrink-0 cursor-pointer rounded-md ring-1 ring-inset ring-black/10" style={{ backgroundColor: `var(${name})` }} title={`Edit ${name.replace(/^--/, "")} (${resolvedMode()} mode)`}>
                                        <input
                                            type="color"
                                            aria-label={`Edit ${name}`}
                                            defaultValue={toHex(readVar(name))}
                                            onChange={(e) => void editColor(name, activeGroup.group, e.target.value)}
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
                    </section>
                </div>
            ) : null}

            {section === "typography" ? (
                <div className="flex flex-col gap-8">
                    <section className="flex flex-col gap-3">
                        <span className="text-xs font-semibold uppercase tracking-wide text-quaternary">Font families</span>
                        <div className="flex flex-col gap-2">
                            {fontTokens.map((name) => (
                                <div key={name} className="flex items-center justify-between gap-4 rounded-lg p-3 ring-1 ring-secondary">
                                    <span className="text-lg text-primary" style={{ fontFamily: `var(${name})` }}>The quick brown fox</span>
                                    <TokenName name={name} />
                                </div>
                            ))}
                        </div>
                    </section>
                    <section className="flex flex-col gap-3">
                        <span className="text-xs font-semibold uppercase tracking-wide text-quaternary">Type scale ({textTokens.length})</span>
                        <div className="flex flex-col gap-2">
                            {textTokens.map((name) => (
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
                    {shadowTokens.map((name) => (
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
                        <span className="text-xs font-semibold uppercase tracking-wide text-quaternary">Radius ({radiusTokens.length})</span>
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                            {radiusTokens.map((name) => (
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
