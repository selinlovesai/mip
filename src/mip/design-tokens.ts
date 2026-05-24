/**
 * Shared design-token catalogs. The names map to the CSS custom properties the
 * Untitled `@theme` emits, so a value like `var(--color-brand-600)` resolves
 * live (and follows light/dark + the chosen accent). Both the Appearance token
 * browser and the widget editor's Design tab read from these lists so there's a
 * single source of truth (the future DB `tokens` table will feed the same names).
 */

export interface ColorTokenGroup {
    group: string;
    tokens: string[]; // full CSS var names, e.g. "--color-brand-500"
}

const c = (names: string[]) => names.map((t) => `--color-${t}`);

export const COLOR_TOKEN_GROUPS: ColorTokenGroup[] = [
    { group: "Brand", tokens: c(["brand-50", "brand-100", "brand-200", "brand-300", "brand-400", "brand-500", "brand-600", "brand-700", "brand-800", "brand-900", "brand-950"]) },
    { group: "Text", tokens: c(["text-primary", "text-secondary", "text-tertiary", "text-quaternary", "text-placeholder", "text-brand-secondary", "text-error-primary", "text-success-primary", "text-warning-primary"]) },
    { group: "Background", tokens: c(["bg-primary", "bg-secondary", "bg-tertiary", "bg-quaternary", "bg-active", "bg-brand-solid", "bg-brand-primary", "bg-error-solid", "bg-success-solid", "bg-warning-solid"]) },
    { group: "Border", tokens: c(["border-primary", "border-secondary", "border-tertiary", "border-brand", "border-error"]) },
    { group: "Foreground", tokens: c(["fg-brand-primary", "fg-brand-secondary", "fg-error-primary", "fg-success-primary", "fg-warning-primary"]) },
    { group: "Utility", tokens: c(["utility-brand-500", "utility-blue-500", "utility-indigo-500", "utility-purple-500", "utility-pink-500", "utility-orange-500", "utility-green-500", "utility-red-500", "utility-yellow-500", "utility-neutral-500"]) },
];

/** Flat list of every color-token var name. */
export const ALL_COLOR_TOKENS: string[] = COLOR_TOKEN_GROUPS.flatMap((g) => g.tokens);
