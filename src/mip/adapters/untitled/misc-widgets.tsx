/**
 * Misc widgets — Untitled UI adapter: image, pageHeader, and the modal/drawer
 * overlays. Modal and drawer render a trigger button that opens an overlay
 * containing the configured content.
 */

import { useState } from "react";
import { X } from "@untitledui/icons";
import type { WidgetRenderProps } from "@/mip/adapter/types";
import { cx } from "@/utils/cx";
import { WidgetCard } from "./widget-card";

export function ImageWidget({ widget, dataState }: WidgetRenderProps) {
    const settings = widget.settings ?? {};
    const fetched = dataState.status === "success" && typeof dataState.data === "string" ? dataState.data : undefined;
    const url = fetched ?? (typeof settings.url === "string" ? settings.url : typeof settings.src === "string" ? settings.src : "");
    const alt = typeof settings.alt === "string" ? settings.alt : (widget.title ?? "");
    const fit = settings.fit === "contain" ? "object-contain" : "object-cover";

    return (
        <WidgetCard title={widget.title}>
            {url ? (
                <img src={url} alt={alt} loading="lazy" className={cx("size-full rounded-lg", fit)} />
            ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-tertiary">No image URL.</div>
            )}
        </WidgetCard>
    );
}

export function PageHeaderWidget({ widget }: WidgetRenderProps) {
    const settings = widget.settings ?? {};
    const heading = typeof settings.heading === "string" ? settings.heading : (widget.title ?? "Page title");
    const subheading = typeof settings.subheading === "string" ? settings.subheading : undefined;
    const actionLabel = typeof settings.actionLabel === "string" ? settings.actionLabel : undefined;
    const actionUrl = typeof settings.actionUrl === "string" ? settings.actionUrl : undefined;

    return (
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-secondary pb-5">
            <div className="flex flex-col gap-1">
                <h1 className="text-display-xs font-semibold text-primary">{heading}</h1>
                {subheading ? <p className="text-sm text-tertiary">{subheading}</p> : null}
            </div>
            {actionLabel ? (
                <a href={actionUrl ?? "#"} className="rounded-lg bg-brand-solid px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
                    {actionLabel}
                </a>
            ) : null}
        </div>
    );
}

function Overlay({ widget, variant }: { widget: WidgetRenderProps["widget"]; variant: "modal" | "drawer" }) {
    const settings = widget.settings ?? {};
    const triggerLabel = typeof settings.triggerLabel === "string" ? settings.triggerLabel : `Open ${variant}`;
    const heading = typeof settings.heading === "string" ? settings.heading : (widget.title ?? "Details");
    const body = typeof settings.body === "string" ? settings.body : "";
    const [open, setOpen] = useState(false);

    return (
        <WidgetCard title={widget.title}>
            <div className="flex flex-1 items-center">
                <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-secondary ring-1 ring-secondary hover:bg-secondary">
                    {triggerLabel}
                </button>
            </div>

            {open ? (
                <div className={cx("fixed inset-0 z-50 flex bg-black/50", variant === "modal" ? "items-center justify-center p-4" : "justify-end")} onClick={() => setOpen(false)}>
                    <div
                        role="dialog"
                        aria-modal="true"
                        onClick={(event) => event.stopPropagation()}
                        className={cx(
                            "flex flex-col gap-3 bg-primary p-6 shadow-xl ring-1 ring-secondary",
                            variant === "modal" ? "w-full max-w-md rounded-xl" : "h-full w-full max-w-sm",
                        )}
                    >
                        <div className="flex items-start justify-between gap-4">
                            <h3 className="text-lg font-semibold text-primary">{heading}</h3>
                            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-tertiary hover:text-secondary">
                                <X className="size-5" />
                            </button>
                        </div>
                        {body ? <p className="text-sm text-tertiary">{body}</p> : null}
                    </div>
                </div>
            ) : null}
        </WidgetCard>
    );
}

export function ModalWidget({ widget }: WidgetRenderProps) {
    return <Overlay widget={widget} variant="modal" />;
}

export function DrawerWidget({ widget }: WidgetRenderProps) {
    return <Overlay widget={widget} variant="drawer" />;
}
