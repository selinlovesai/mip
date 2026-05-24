/**
 * Diagram widgets — Untitled UI adapter, powered by mermaid (lazy-loaded so it
 * stays out of the main bundle). Covers flowchart, sequenceDiagram, mindmap,
 * timeline, and ganttChart.
 *
 * The mermaid source comes from `settings.source` (or a fetched string). If
 * absent, a per-type starter sample is rendered so the widget is never blank.
 * Mermaid's theme is selected from the document's `data-theme` so it matches
 * light/dark mode.
 */

import { useEffect, useId, useRef, useState } from "react";
import type { WidgetRenderProps } from "@/mip/adapter/types";
import type { WidgetType } from "@/mip/schema";
import { WidgetCard } from "./widget-card";

const SAMPLES: Partial<Record<WidgetType, string>> = {
    flowchart: "graph TD\n  A[Start] --> B{Approved?}\n  B -->|Yes| C[Ship]\n  B -->|No| D[Revise]\n  D --> B",
    sequenceDiagram: "sequenceDiagram\n  Client->>API: Request\n  API->>DB: Query\n  DB-->>API: Rows\n  API-->>Client: Response",
    mindmap: "mindmap\n  root((Dashboard))\n    Widgets\n      Charts\n      Tables\n    Data\n      Sources\n      Mapping",
    timeline: "timeline\n  title Roadmap\n  2026 Q1 : Scaffold\n  2026 Q2 : Renderers\n  2026 Q3 : Cutover",
    ganttChart: "gantt\n  title Plan\n  dateFormat YYYY-MM-DD\n  section Build\n  Adapter :a1, 2026-01-01, 14d\n  Widgets :after a1, 21d",
};

function resolveSource(props: WidgetRenderProps): string {
    const { widget, dataState } = props;
    if (dataState.status === "success" && typeof dataState.data === "string" && dataState.data.trim()) {
        return dataState.data;
    }
    const source = widget.settings?.source;
    if (typeof source === "string" && source.trim()) return source;
    return SAMPLES[widget.type] ?? "graph TD\n  A --> B";
}

export function DiagramWidget(props: WidgetRenderProps) {
    const { widget } = props;
    const source = resolveSource(props);
    const id = useId().replace(/:/g, "");
    const containerRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const mermaid = (await import("mermaid")).default;
                const isLight = !document.documentElement.classList.contains("dark-mode");
                mermaid.initialize({ startOnLoad: false, theme: isLight ? "default" : "dark", securityLevel: "strict" });
                const { svg } = await mermaid.render(`mmd-${id}`, source);
                if (!cancelled && containerRef.current) {
                    containerRef.current.innerHTML = svg;
                    setError(null);
                }
            } catch (err) {
                if (!cancelled) setError(err instanceof Error ? err.message : "Failed to render diagram.");
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [source, id]);

    return (
        <WidgetCard title={widget.title}>
            {error ? (
                <div className="flex flex-1 items-center justify-center text-center text-sm text-utility-red-500">{error}</div>
            ) : (
                <div ref={containerRef} className="flex min-h-0 flex-1 items-center justify-center overflow-auto [&_svg]:max-h-full [&_svg]:max-w-full" />
            )}
        </WidgetCard>
    );
}
