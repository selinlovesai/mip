/**
 * Draggable / resizable widget grid — react-grid-layout v2 (same lib as the
 * original app). Layout is derived from each widget's `layout`; drag/resize
 * persist back through the store's `applyLayout`. Drag/resize are gated on edit
 * mode; the drag handle is scoped to `.mip-drag-handle` so clicks inside
 * widgets don't start a drag.
 */

import { useMemo } from "react";
import GridLayout, { useContainerWidth } from "react-grid-layout";
import type { Layout, LayoutItem } from "react-grid-layout/core";
import { useDashboard } from "@/mip/store";
import { WidgetChrome } from "./widget-chrome";

const MARGIN: [number, number] = [16, 16];

export function DashboardGrid() {
    const { activePage, editMode, applyLayout, removeWidget } = useDashboard();
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

    return (
        <div ref={containerRef}>
            {mounted ? (
                <GridLayout
                    width={width}
                    layout={layout}
                    autoSize
                    gridConfig={{ cols: activePage.cols, rowHeight: activePage.rowHeight, margin: MARGIN, containerPadding: [0, 0], maxRows: Infinity }}
                    dragConfig={{ enabled: editMode, bounded: false, handle: ".mip-drag-handle", cancel: "button,input,select,textarea,a", threshold: 3 }}
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
