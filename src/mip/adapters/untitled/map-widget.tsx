/**
 * Google Map widget — Untitled UI adapter. Uses Google Maps' keyless embed
 * (`maps.google.com/maps?q=...&output=embed`) so it renders a real map without
 * an API key. Location from `settings.query` (place/address) or `lat`/`lng`;
 * zoom from `settings.zoom`.
 */

import type { WidgetRenderProps } from "@/mip/adapter/types";
import { WidgetCard } from "./widget-card";

export function GoogleMapWidget({ widget }: WidgetRenderProps) {
    const settings = widget.settings ?? {};
    const query = typeof settings.query === "string" ? settings.query : typeof settings.lat === "number" && typeof settings.lng === "number" ? `${settings.lat},${settings.lng}` : "";
    const zoom = typeof settings.zoom === "number" ? settings.zoom : 12;

    if (!query) {
        return (
            <WidgetCard title={widget.title}>
                <div className="flex flex-1 items-center justify-center text-sm text-tertiary">Set a location (query or lat/lng).</div>
            </WidgetCard>
        );
    }

    const src = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=${zoom}&output=embed`;

    return (
        <WidgetCard title={widget.title}>
            <iframe title={widget.title ?? "Map"} src={src} className="size-full min-h-[200px] flex-1 rounded-lg border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        </WidgetCard>
    );
}
