/**
 * Runtime accent theming. Overrides the Untitled UI brand color ramp
 * (--color-brand-500/600/700) on :root, which cascades to every derived
 * semantic token (bg-brand-solid, text-brand-secondary, ring-brand,
 * --color-utility-brand-*, chart series colors, etc.). Choice persists in
 * localStorage and is re-applied on load.
 */

export interface Accent {
    label: string;
    swatch: string; // representative color for the picker dot
    ramp: { 500: string; 600: string; 700: string };
}

export const ACCENTS: Record<string, Accent> = {
    violet: { label: "Violet", swatch: "rgb(127 86 217)", ramp: { 500: "rgb(158 119 237)", 600: "rgb(127 86 217)", 700: "rgb(105 65 198)" } },
    blue: { label: "Blue", swatch: "rgb(21 112 239)", ramp: { 500: "rgb(46 144 250)", 600: "rgb(21 112 239)", 700: "rgb(23 92 211)" } },
    green: { label: "Green", swatch: "rgb(9 146 80)", ramp: { 500: "rgb(22 179 100)", 600: "rgb(9 146 80)", 700: "rgb(8 116 67)" } },
    rose: { label: "Rose", swatch: "rgb(227 27 84)", ramp: { 500: "rgb(246 61 104)", 600: "rgb(227 27 84)", 700: "rgb(192 16 72)" } },
    orange: { label: "Orange", swatch: "rgb(236 74 10)", ramp: { 500: "rgb(251 101 20)", 600: "rgb(236 74 10)", 700: "rgb(196 50 10)" } },
};

const STORAGE_KEY = "mip-accent";
export const DEFAULT_ACCENT = "violet";

export function applyAccent(key: string) {
    const accent = ACCENTS[key] ?? ACCENTS[DEFAULT_ACCENT]!;
    const root = document.documentElement;
    root.style.setProperty("--color-brand-500", accent.ramp[500]);
    root.style.setProperty("--color-brand-600", accent.ramp[600]);
    root.style.setProperty("--color-brand-700", accent.ramp[700]);
    // The utility-brand ramp is a SEPARATE token family in the Untitled theme
    // (it doesn't derive from --color-brand-*), and it's what widgets actually
    // use — chart series, progress bars, accents. Override it too so the chosen
    // accent reaches every widget.
    root.style.setProperty("--color-utility-brand-500", accent.ramp[500]);
    root.style.setProperty("--color-utility-brand-600", accent.ramp[600]);
    root.style.setProperty("--color-utility-brand-700", accent.ramp[700]);
}

export function getSavedAccent(): string {
    try {
        return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_ACCENT;
    } catch {
        return DEFAULT_ACCENT;
    }
}

export function saveAccent(key: string) {
    try {
        localStorage.setItem(STORAGE_KEY, key);
    } catch {
        /* ignore */
    }
    applyAccent(key);
}
