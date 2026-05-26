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

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "@untitledui/icons";
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
const UI_SETTINGS: Array<{ section: string; target: string; label: string; hint: string }> = [
    // Icons & accents
    { section: "Icons & accents", target: "--color-fg-primary", label: "Icon color (primary)", hint: "High-contrast icons" },
    { section: "Icons & accents", target: "--color-fg-quaternary", label: "Icon color (muted)", hint: "Input, help & button icons" },
    { section: "Icons & accents", target: "--color-fg-brand-primary", label: "Accent color", hint: "Featured icons, progress, active states" },
    { section: "Icons & accents", target: "--color-focus-ring", label: "Focus ring", hint: "Keyboard-focus outline" },
    // Text & navigation (menu uses dedicated --color-nav-item-* tokens, so these
    // are isolated from page background and other surfaces)
    { section: "Text & navigation", target: "--color-text-primary", label: "Heading & widget title", hint: "Primary text (titles, headings)" },
    { section: "Text & navigation", target: "--color-nav-item-text", label: "Menu item text", hint: "Sidebar nav labels" },
    { section: "Text & navigation", target: "--color-nav-item-text-active", label: "Menu active text", hint: "Selected nav item text" },
    { section: "Text & navigation", target: "--color-nav-item-bg-active", label: "Menu active background", hint: "Selected nav item" },
    { section: "Text & navigation", target: "--color-nav-item-bg-hover", label: "Menu hover background", hint: "Nav item on hover" },
    { section: "Text & navigation", target: "--color-text-brand-secondary", label: "Link color", hint: "Links & brand text" },
    // Surfaces & actions
    { section: "Surfaces & actions", target: "--color-bg-brand-solid", label: "Primary button", hint: "Solid brand background" },
    { section: "Surfaces & actions", target: "--color-bg-primary", label: "Page background", hint: "App & card surface" },
    { section: "Surfaces & actions", target: "--color-border-secondary", label: "Border color", hint: "Cards, dividers, inputs" },
    // Mode toggle (segmented control) — dedicated, fully independent
    { section: "Mode toggle", target: "--color-segment-bg", label: "Background", hint: "Unselected button" },
    { section: "Mode toggle", target: "--color-segment-text", label: "Text", hint: "Unselected label" },
    { section: "Mode toggle", target: "--color-segment-border", label: "Border", hint: "Unselected ring" },
    { section: "Mode toggle", target: "--color-segment-bg-hover", label: "Hover background", hint: "On hover" },
    { section: "Mode toggle", target: "--color-segment-bg-active", label: "Selected background", hint: "Active button" },
    { section: "Mode toggle", target: "--color-segment-text-active", label: "Selected text", hint: "Active label" },
    { section: "Mode toggle", target: "--color-segment-border-active", label: "Selected border", hint: "Active ring" },
    // Charts
    { section: "Charts", target: "--color-chart-1", label: "Chart color 1", hint: "Primary series / first slice" },
    { section: "Charts", target: "--color-chart-2", label: "Chart color 2", hint: "Second series / slice" },
    { section: "Charts", target: "--color-chart-3", label: "Chart color 3", hint: "Third series / slice" },
    { section: "Charts", target: "--color-chart-4", label: "Chart color 4", hint: "Fourth series / slice" },
    { section: "Charts", target: "--color-chart-5", label: "Chart color 5", hint: "Fifth series / slice" },
    { section: "Charts", target: "--color-chart-6", label: "Chart color 6", hint: "Sixth series / slice" },
];

/** UI_SETTINGS grouped into their sub-sections, preserving order. */
const UI_SETTING_SECTIONS = UI_SETTINGS.reduce<Array<{ section: string; items: typeof UI_SETTINGS }>>((acc, s) => {
    const last = acc[acc.length - 1];
    if (last && last.section === s.section) last.items.push(s);
    else acc.push({ section: s.section, items: [s] });
    return acc;
}, []);

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

/** Inline editable text value for non-color tokens (radius/shadow/typography).
 *  Commits on blur or Enter; reverts to the latest value otherwise. Read-only
 *  (shows the value as text) when disabled. */
function ValueInput({ value, onCommit, disabled, className }: { value: string; onCommit: (v: string) => void; disabled?: boolean; className?: string }) {
    const [v, setV] = useState(value);
    useEffect(() => setV(value), [value]);
    if (disabled) return <span className={cx("truncate text-xs text-tertiary", className)}>{value || "—"}</span>;
    const commit = () => {
        const next = v.trim();
        if (next && next !== value) onCommit(next);
        else setV(value);
    };
    return (
        <input
            value={v}
            spellCheck={false}
            onChange={(e) => setV(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                    setV(value);
                    e.currentTarget.blur();
                }
            }}
            className={cx("rounded-lg bg-primary px-2.5 py-1.5 font-mono text-xs text-secondary ring-1 ring-secondary outline-none focus:ring-brand", className)}
        />
    );
}

/** A color-token dropdown that renders a swatch next to each token, grouped and
 *  searchable. `value` is the selected token name ("" = default). */
function TokenSelect({
    value,
    groups,
    disabled,
    onChange,
}: {
    value: string;
    groups: Array<{ group: string; tokens: string[] }>;
    disabled?: boolean;
    onChange: (name: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
    const btnRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const WIDTH = 256;
    const place = () => {
        const r = btnRef.current?.getBoundingClientRect();
        if (r) setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.right - WIDTH, window.innerWidth - WIDTH - 8)), width: WIDTH });
    };
    const toggle = () => {
        if (disabled) return;
        if (!open) place();
        setOpen((o) => !o);
    };

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            const t = e.target as Node;
            if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
            setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
        const onResize = () => setOpen(false);
        // Close when an ANCESTOR scrolls (the panel would detach), but NOT when
        // the user scrolls inside the panel's own option list.
        const onScroll = (e: Event) => {
            if (panelRef.current?.contains(e.target as Node)) return;
            setOpen(false);
        };
        document.addEventListener("mousedown", onDoc);
        document.addEventListener("keydown", onKey);
        window.addEventListener("resize", onResize);
        window.addEventListener("scroll", onScroll, true);
        return () => {
            document.removeEventListener("mousedown", onDoc);
            document.removeEventListener("keydown", onKey);
            window.removeEventListener("resize", onResize);
            window.removeEventListener("scroll", onScroll, true);
        };
    }, [open]);

    const filtered = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return groups
            .map((g) => ({ group: g.group, tokens: needle ? g.tokens.filter((n) => n.toLowerCase().includes(needle)) : g.tokens }))
            .filter((g) => g.tokens.length);
    }, [groups, q]);

    const choose = (name: string) => {
        onChange(name);
        setOpen(false);
        setQ("");
    };

    return (
        <div className="w-44 shrink-0">
            <button
                ref={btnRef}
                type="button"
                disabled={disabled}
                onClick={toggle}
                className="flex w-full items-center gap-2 rounded-lg bg-primary px-2.5 py-2 text-xs text-secondary ring-1 ring-secondary transition-colors hover:ring-brand disabled:cursor-not-allowed disabled:opacity-50"
            >
                {value ? <span className="size-3.5 shrink-0 rounded-sm ring-1 ring-inset ring-black/10" style={{ backgroundColor: `var(${value})` }} /> : null}
                <span className="flex-1 truncate text-left">{value ? value.replace(/^--color-/, "") : "Default"}</span>
                <ChevronDown className="size-3.5 shrink-0 text-tertiary" aria-hidden="true" />
            </button>

            {open && pos
                ? createPortal(
                      <div
                          ref={panelRef}
                          style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
                          className="flex max-h-72 flex-col overflow-hidden rounded-lg bg-primary shadow-lg ring-1 ring-secondary"
                      >
                          <input
                              autoFocus
                              value={q}
                              onChange={(e) => setQ(e.target.value)}
                              placeholder="Search tokens…"
                              className="border-b border-secondary bg-primary px-3 py-2 text-xs text-primary outline-none placeholder:text-placeholder"
                          />
                          <div className="min-h-0 flex-1 overflow-y-auto p-1">
                              <button type="button" onClick={() => choose("")} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-tertiary transition-colors hover:bg-secondary">
                                  Default
                              </button>
                              {filtered.map((g) => (
                                  <div key={g.group}>
                                      <div className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-quaternary">{groupLabel(g.group)}</div>
                                      {g.tokens.map((name) => (
                                          <button
                                              key={name}
                                              type="button"
                                              onClick={() => choose(name)}
                                              className={cx("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-secondary", name === value ? "text-brand-secondary" : "text-secondary")}
                                          >
                                              <span className="size-3.5 shrink-0 rounded-sm ring-1 ring-inset ring-black/10" style={{ backgroundColor: `var(${name})` }} />
                                              <span className="flex-1 truncate">{name.replace(/^--color-/, "")}</span>
                                              {name === value ? <Check className="size-3.5 shrink-0" aria-hidden="true" /> : null}
                                          </button>
                                      ))}
                                  </div>
                              ))}
                              {filtered.length === 0 ? <div className="px-2 py-3 text-center text-xs text-tertiary">No matches</div> : null}
                          </div>
                      </div>,
                      document.body,
                  )
                : null}
        </div>
    );
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

    // UI-element pickers offer only CONCRETE colors (Brand / Palette / Utility /
    // Chart) — never the semantic groups (Text/Background/Border/Foreground),
    // which are themselves aliases. This prevents pointing one semantic token at
    // another (e.g. menu-active → page-background), which would couple them.
    const pickerGroups = useMemo(() => colorGroups.filter((g) => ["Brand", "Base", "Utility", "Chart"].includes(g.group)), [colorGroups]);

    // Typography / shadow / radius: DB set when available, else static fallback.
    const fontTokens = useMemo(() => (tokens.length ? namesOfKind(tokens, "typography", (n) => n.startsWith("--font-")).sort() : FONT_TOKENS), [tokens]);
    const textTokens = useMemo(
        () => (tokens.length ? namesOfKind(tokens, "typography", (n) => n.startsWith("--text-") && !n.endsWith("--line-height") && !n.endsWith("--letter-spacing")).sort() : DISPLAY_SCALE),
        [tokens],
    );
    const shadowTokens = useMemo(() => (tokens.length ? namesOfKind(tokens, "shadow").sort() : SHADOW_TOKENS), [tokens]);
    const radiusTokens = useMemo(() => (tokens.length ? namesOfKind(tokens, "radius").sort() : RADIUS_TOKENS), [tokens]);

    /** Persist a token edit (any kind), keep local state in sync, refresh overlay. */
    const saveToken = async (name: string, value: string, group: string, kind = "color") => {
        const mode = resolvedMode();
        if (!(await putToken(name, mode, value, kind, group))) return false;
        setTokens((prev) => {
            const i = prev.findIndex((t) => t.name === name && t.mode === mode);
            const row: DesignToken = { name, mode, value, kind, group, updatedAt: new Date().toISOString() };
            if (i === -1) return [...prev, row];
            const next = prev.slice();
            next[i] = { ...next[i], value, group, kind };
            return next;
        });
        await applyDbTokens(); // refresh the :root overlay so the var updates live
        setTick((t) => t + 1); // re-render so printed values reflect the edit
        return true;
    };

    const editColor = (name: string, group: string, hex: string) => void saveToken(name, hex, group);
    /** Current stored value for a token (this mode), else the live computed value. */
    const storedValue = (name: string) => tokens.find((t) => t.name === name && t.mode === resolvedMode())?.value ?? readVar(name);

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
                    {dbReady ? " Tokens are editable and persist to the database." : " Connect the backend to edit and persist tokens."}
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
                                <button
                                    key={mode}
                                    onClick={() => setTheme(mode)}
                                    className={cx(
                                        "flex-1 rounded-lg px-3 py-2 text-sm font-medium capitalize ring-1 transition-colors",
                                        theme === mode
                                            ? "bg-[var(--color-segment-bg-active)] text-[var(--color-segment-text-active)] ring-[var(--color-segment-border-active)]"
                                            : "bg-[var(--color-segment-bg)] text-[var(--color-segment-text)] ring-[var(--color-segment-border)] hover:bg-[var(--color-segment-bg-hover)]",
                                    )}
                                >

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
                        <div className="flex flex-col gap-5">
                            {UI_SETTING_SECTIONS.map(({ section: sub, items }) => (
                                <div key={sub} className="flex flex-col gap-2">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-quaternary">{sub}</span>
                                    {items.map((s) => {
                                        const ref = currentRef(s.target);
                                        return (
                                            <div key={s.target} className="flex items-center gap-3 rounded-lg p-3 ring-1 ring-secondary">
                                                <span className="size-8 shrink-0 rounded-md ring-1 ring-inset ring-black/10" style={{ backgroundColor: `var(${s.target})` }} aria-hidden="true" />
                                                <span className="flex min-w-0 flex-1 flex-col">
                                                    <span className="truncate text-sm font-medium text-secondary">{s.label}</span>
                                                    <span className="truncate text-xs text-tertiary">{s.hint}</span>
                                                </span>
                                                <TokenSelect value={ref} groups={pickerGroups} disabled={!dbReady} onChange={(name) => pickToken(s.target, name)} />
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
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
                                    <span className="min-w-0 flex-1 truncate text-lg text-primary" style={{ fontFamily: `var(${name})` }}>The quick brown fox</span>
                                    <span className="flex shrink-0 flex-col items-end gap-1">
                                        <TokenName name={name} />
                                        <ValueInput value={storedValue(name)} disabled={!dbReady} onCommit={(v) => void saveToken(name, v, "Typography", "typography")} className="w-56" />
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>
                    <section className="flex flex-col gap-3">
                        <span className="text-xs font-semibold uppercase tracking-wide text-quaternary">Type scale ({textTokens.length})</span>
                        <div className="flex flex-col gap-2">
                            {textTokens.map((name) => (
                                <div key={name} className="flex items-center justify-between gap-4 rounded-lg p-3 ring-1 ring-secondary">
                                    <span className="w-12 shrink-0 truncate font-semibold text-primary" style={{ fontSize: `var(${name})` }}>Ag</span>
                                    <span className="flex shrink-0 flex-col items-end gap-1">
                                        <TokenName name={name} />
                                        <ValueInput value={storedValue(name)} disabled={!dbReady} onCommit={(v) => void saveToken(name, v, "Typography", "typography")} className="w-56" />
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            ) : null}

            {section === "shadows" ? (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    {shadowTokens.map((name) => (
                        <div key={name} className="flex items-center gap-4 rounded-xl bg-secondary p-4">
                            <span className="size-16 shrink-0 rounded-xl border border-secondary bg-white" style={{ boxShadow: `var(${name})` }} />
                            <span className="flex min-w-0 flex-1 flex-col gap-1">
                                <TokenName name={name} />
                                <ValueInput value={storedValue(name)} disabled={!dbReady} onCommit={(v) => void saveToken(name, v, "Shadow", "shadow")} className="w-full" />
                            </span>
                        </div>
                    ))}
                </div>
            ) : null}

            {section === "spacing" ? (
                <div className="flex flex-col gap-8">
                    <section className="flex flex-col gap-3">
                        <span className="text-xs font-semibold uppercase tracking-wide text-quaternary">Radius ({radiusTokens.length})</span>
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                            {radiusTokens.map((name) => (
                                <div key={name} className="flex flex-col items-center gap-2">
                                    <span className="size-14 bg-brand-solid" style={{ borderRadius: `var(${name})` }} />
                                    <TokenName name={name} />
                                    <ValueInput value={storedValue(name)} disabled={!dbReady} onCommit={(v) => void saveToken(name, v, "Radius", "radius")} className="w-24 text-center" />
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
