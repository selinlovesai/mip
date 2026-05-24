/**
 * Adapter wiring: a React context holding the active `UiKitAdapter`, plus the
 * `WidgetView` component that resolves a widget to its renderer. Screens render
 * widgets exclusively through `WidgetView` so swapping the kit is a one-line
 * change at `UiKitProvider`.
 */

import { createContext, useContext, type ReactNode } from "react";
import type { UiKitAdapter, WidgetDataState, WidgetRenderProps } from "@/mip/adapter/types";
import { IDLE_DATA_STATE } from "@/mip/adapter/types";
import type { MipWidget } from "@/mip/schema";

const UiKitContext = createContext<UiKitAdapter | null>(null);

export function UiKitProvider({ adapter, children }: { adapter: UiKitAdapter; children: ReactNode }) {
    return <UiKitContext.Provider value={adapter}>{children}</UiKitContext.Provider>;
}

export function useUiKit(): UiKitAdapter {
    const adapter = useContext(UiKitContext);
    if (!adapter) {
        throw new Error("useUiKit must be used within a <UiKitProvider>.");
    }
    return adapter;
}

/** Last-resort renderer when the active adapter maps neither the type nor a fallback. */
function MissingRenderer({ widget }: WidgetRenderProps) {
    return (
        <div className="flex h-full flex-col justify-center rounded-xl border border-dashed border-secondary bg-secondary p-4 text-sm text-tertiary">
            <span className="font-medium text-secondary">Unsupported widget</span>
            <span>
                No renderer for type <code className="font-mono">{widget.type}</code> in this UI kit.
            </span>
        </div>
    );
}

export function WidgetView({ widget, dataState = IDLE_DATA_STATE }: { widget: MipWidget; dataState?: WidgetDataState }) {
    const kit = useUiKit();
    const renderer = kit.widgets[widget.type] ?? kit.fallback ?? MissingRenderer;
    return renderer({ widget, dataState });
}
