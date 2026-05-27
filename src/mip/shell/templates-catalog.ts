/**
 * Dashboard templates — starter dashboards that seed a new page with a set of
 * widgets. Each template declares whether it needs API keys (`needsKeys`) and
 * which connectors it auto-configures; the import-confirm modal uses these to
 * show the auto-config note + key warning.
 *
 * SOURCE OF TRUTH: `src/mip/data/templates.json` — the canonical catalog,
 * imported here as the static/offline list and seeded into the `templates` DB
 * collection (server seed_templates). `loadTemplates()` overlays DB rows on top,
 * degrade-safe.
 */

import type { MipWidget } from "@/mip/schema";
import type { Connection } from "@/mip/settings/settings-store";
import { dbAvailable, dbList } from "@/mip/api";
import catalog from "@/mip/data/templates.json";

export type TemplateCategory = "Analytics" | "Finance" | "Management" | "General" | "Business" | "Marketing";

export interface DashboardTemplate {
    id: string;
    name: string;
    description: string;
    category: TemplateCategory;
    icon: string; // emoji glyph for the card tile
    /** Connectors this template uses; [] means no keys needed. */
    connectors: string[];
    needsKeys: boolean;
    /** Connections the template needs; ensured (added if missing) on import. */
    connectionsSeed?: Connection[];
    widgets: MipWidget[];
}

/** Static catalog from the canonical JSON (offline + fallback). */
export const TEMPLATES: DashboardTemplate[] = (catalog as { templates: DashboardTemplate[] }).templates;

export const TEMPLATE_CATEGORIES: Array<"All" | TemplateCategory> = ["All", "Analytics", "Finance", "Management", "General", "Business", "Marketing"];

/** Load templates, overlaying DB `templates` rows when the backend is up.
 *  Degrade-safe: returns the static catalog on any failure / DB off / empty. */
export async function loadTemplates(): Promise<DashboardTemplate[]> {
    try {
        if (!(await dbAvailable())) return TEMPLATES;
        const rows = await dbList<DashboardTemplate>("templates");
        if (!rows.length) return TEMPLATES;
        const byId = new Map(TEMPLATES.map((t) => [t.id, t]));
        for (const r of rows) byId.set(r.id, { ...byId.get(r.id), ...r.data, id: r.id } as DashboardTemplate);
        return [...byId.values()];
    } catch {
        return TEMPLATES;
    }
}

/** Clone a template's widgets with fresh ids so re-imports don't collide. */
export function cloneTemplateWidgets(template: DashboardTemplate): MipWidget[] {
    const stamp = Date.now().toString(36);
    return template.widgets.map((w, i) => ({ ...w, id: `${template.id}-${stamp}-${i}` }));
}
