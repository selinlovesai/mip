/**
 * DB design-token runtime overlay.
 *
 * The app ships with the build-time `theme.css` (Tailwind `@theme`). When the
 * backend DB is available, we additionally fetch the tokens compiled to a
 * `:root { … } .dark-mode { … }` stylesheet and inject it AFTER the bundled CSS,
 * so edited token values override the defaults live — no rebuild needed. The
 * `@theme`-generated utilities (e.g. `bg-primary`) read these same custom
 * properties, so overriding the variables re-colors the whole app.
 *
 * Degrade-safe: if the DB is off (or the fetch fails), nothing is injected and
 * the bundled theme.css stands. Call `applyDbTokens()` once at boot and again
 * after editing a token to refresh the overlay.
 */

import { fetchTokensCss } from "@/mip/api";

const STYLE_ID = "mip-db-tokens";

export async function applyDbTokens(): Promise<boolean> {
    if (typeof document === "undefined") return false;
    const css = await fetchTokensCss("root");
    if (css == null) return false; // DB off → keep bundled theme.css

    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!el) {
        el = document.createElement("style");
        el.id = STYLE_ID;
        // Append last so it wins over the bundled stylesheet at equal specificity.
        document.head.appendChild(el);
    }
    el.textContent = css;
    return true;
}
