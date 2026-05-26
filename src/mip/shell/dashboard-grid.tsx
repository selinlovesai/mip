/**
 * Draggable / resizable widget grid — react-grid-layout v2 (same lib as the
 * original app). Layout is derived from each widget's `layout`; drag/resize
 * persist back through the store's `applyLayout`. Drag/resize are gated on edit
 * mode; the drag handle is scoped to `.mip-drag-handle` so clicks inside
 * widgets don't start a drag.
 */

import { useMemo } from "react";
import GridLayout, { useContainerWidth, verticalCompactor } from "react-grid-layout";
import { defaultConstraints } from "react-grid-layout/core";
import type { Layout, LayoutItem } from "react-grid-layout/core";
import { useDashboard } from "@/mip/store";
import { WidgetChrome } from "./widget-chrome";

const MARGIN: [number, number] = [16, 16];

export function DashboardGrid() {
    const { activePage, editMode, viewMode, applyLayout, removeWidget } = useDashboard();
    const { width, mounted, containerRef } = useContainerWidth();

    const layout = useMemo<Layout>(
        () =>
            activePage.widgets.map((widget) => ({
                i: widget.id,
                x: widget.layout.x,
                y: widget.layout.y,
                w: widget.layout.w,
                h: widget.layout.h,
                minW: widget.layout.minW ?? 2,
                minH: widget.layout.minH ?? 1,
            })) as unknown as LayoutItem[],
        [activePage.widgets],
    );

    if (activePage.widgets.length === 0) {
        return <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-secondary text-sm text-tertiary">This page has no widgets yet. Add one from the toolbar.</div>;
    }

    // Feed view — every widget full-width, stacked vertically in the saved
    // top-to-bottom order. A responsive/mobile preview that ignores columns.
    if (viewMode === "feed") {
        const ordered = [...activePage.widgets].sort((a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x);
        return (
            <div className="mx-auto flex max-w-2xl flex-col gap-4">
                {ordered.map((widget) => (
                    // Definite height (not minHeight) so the card's h-full chain
                    // resolves and FILLS the slot — a percentage height can't
                    // resolve against a flex-grown/min-height-only parent, which
                    // left dead space below short content (e.g. charts).
                    <div key={widget.id} data-mip-widget-id={widget.id} style={{ height: widget.layout.h * activePage.rowHeight }}>
                        <WidgetChrome widget={widget} editMode={false} onDelete={removeWidget} />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div ref={containerRef}>
            {mounted ? (
                <GridLayout
                    width={width}
                    layout={layout}
                    autoSize
                    // Vertical compaction keeps it a real grid: no overlaps, items
                    // pack to the top. Constraints (gridBounds + min/max size) keep
                    // items inside the columns/rows on drag, resize, and width change.
                    compactor={verticalCompactor}
                    constraints={defaultConstraints}
                    gridConfig={{ cols: activePage.cols, rowHeight: activePage.rowHeight, margin: MARGIN, containerPadding: [0, 0], maxRows: Infinity }}
                    dragConfig={{ enabled: editMode, bounded: true, handle: ".mip-drag-handle", cancel: "button,input,select,textarea,a", threshold: 3 }}
                    resizeConfig={{ enabled: editMode, handles: ["se"] }}
                    onLayoutChange={(next) => applyLayout(next)}
                >
                    {activePage.widgets.map((widget) => (
                        <div key={widget.id} data-mip-widget-id={widget.id}>
                            <WidgetChrome widget={widget} editMode={editMode} onDelete={removeWidget} />
                        </div>
                    ))}
                </GridLayout>
            ) : (
                <div className="flex h-64 items-center justify-center text-sm text-tertiary">Preparing canvas…</div>
            )}
        </div>
    );
}
