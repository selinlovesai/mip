/**
 * Canvas surface — a freeform AI playground rendered in a **sandboxed iframe**.
 *
 * The AI gets full DOM power (it can inject any HTML/CSS/JS, run scripts, build
 * whole interfaces) — but that power is confined to the iframe document. The
 * iframe uses `sandbox="allow-scripts …"` WITHOUT `allow-same-origin`, so its
 * scripts run in a unique opaque origin: they cannot reach the host app's DOM,
 * cookies, or localStorage, and cannot break the dashboard. That isolation is
 * the whole safety model — arbitrary code, zero blast radius on the app.
 */

import { useMemo } from "react";
import { Stars01 } from "@untitledui/icons";

/** Wrap a bare fragment in a minimal HTML document; pass full documents through. */
function toDocument(html: string): string {
    const trimmed = html.trim();
    if (/<html[\s>]/i.test(trimmed)) return trimmed;
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>:root{color-scheme:light dark}*{box-sizing:border-box}body{margin:0;padding:16px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5}</style>
</head><body>${trimmed}</body></html>`;
}

export function CanvasSurface({ html }: { html: string }) {
    const doc = useMemo(() => toDocument(html ?? ""), [html]);

    if (!html?.trim()) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-utility-brand-50">
                    <Stars01 className="size-6 text-utility-brand-700" />
                </span>
                <h2 className="text-lg font-semibold text-primary">Freeform AI canvas</h2>
                <p className="max-w-sm text-sm text-tertiary">
                    Ask the assistant to build anything — it can render any HTML, CSS and JavaScript here. Everything runs in a
                    <span className="font-medium text-secondary"> sandboxed frame</span>, isolated from the app.
                </p>
            </div>
        );
    }

    return (
        <iframe
            title="AI canvas"
            // allow-scripts WITHOUT allow-same-origin → scripts run, fully isolated
            // from the host origin (no access to app DOM / cookies / storage).
            sandbox="allow-scripts allow-forms allow-popups allow-modals"
            srcDoc={doc}
            className="h-full w-full border-0 bg-white"
        />
    );
}
