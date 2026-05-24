/**
 * Grid-cell chrome around a rendered widget: a drag handle (the only draggable
 * surface, matched by the grid's `dragConfig.handle`), an edit button and a
 * delete button, revealed on hover while in edit mode. The widget itself renders
 * via WidgetView. Per-widget Design overrides (border / background color) from
 * `widget.style` are applied to the card container.
 */

import type { CSSProperties } from "react";
import { DotsGrid, Trash01 } from "@untitledui/icons";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { WidgetView } from "@/mip/adapter/registry";
import type { MipWidget } from "@/mip/schema";
import { cx } from "@/utils/cx";
import { WidgetEditorButton } from "./widget-editor";

/** Design-tab defaults: no border, secondary surface behind the widget. */
export const DEFAULT_BORDER_COLOR = "transparent";
export const DEFAULT_BACKGROUND_COLOR = "var(--color-bg-secondary)";

export function widgetCardStyle(widget: MipWidget): CSSProperties {
    const borderColor = widget.style?.borderColor ?? DEFAULT_BORDER_COLOR;
    const backgroundColor = widget.style?.backgroundColor ?? DEFAULT_BACKGROUND_COLOR;
    return { backgroundColor, border: `1px solid ${borderColor}` };
}

export function WidgetChrome({ widget, editMode, onDelete }: { widget: MipWidget; editMode: boolean; onDelete: (id: string) => void }) {
    return (
        <div className={cx("group relative h-full", editMode && "rounded-xl ring-1 ring-transparent transition-shadow hover:ring-brand")}>
            {editMode ? (
                <div className="absolute right-2 top-2 z-10 flex items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                    <span className="mip-drag-handle flex size-7 cursor-grab items-center justify-center rounded-md bg-primary text-tertiary ring-1 ring-secondary hover:text-secondary active:cursor-grabbing" aria-label="Drag widget" title="Drag">
                        <DotsGrid className="size-4" />
                    </span>
                    <WidgetEditorButton widget={widget} />
                    <ButtonUtility color="tertiary" size="xs" icon={Trash01} tooltip="Delete widget" onClick={() => onDelete(widget.id)} />
                </div>
            ) : null}
            <div className="h-full overflow-hidden rounded-xl" style={widgetCardStyle(widget)}>
                <WidgetView widget={widget} />
            </div>
        </div>
    );
}
