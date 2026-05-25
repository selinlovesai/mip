/**
 * Misc widgets — Untitled UI adapter: image, pageHeader, and the modal/drawer
 * overlays. The modal uses the Untitled `Modal`/`Dialog` (react-aria
 * `DialogTrigger`) and the drawer uses the Untitled `SlideoutMenu`; both render
 * a trigger button that opens an overlay containing the configured content.
 */

import { Button } from "@/components/base/buttons/button";
import { Dialog, DialogTrigger, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { SlideoutMenu } from "@/components/application/slideout-menus/slideout-menu";
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
                <Button color="primary" size="md" href={actionUrl ?? "#"}>
                    {actionLabel}
                </Button>
            ) : null}
        </div>
    );
}

export function ModalWidget({ widget }: WidgetRenderProps) {
    const settings = widget.settings ?? {};
    const triggerLabel = typeof settings.triggerLabel === "string" ? settings.triggerLabel : "Open modal";
    const heading = typeof settings.heading === "string" ? settings.heading : (widget.title ?? "Details");
    const body = typeof settings.body === "string" ? settings.body : "";

    return (
        <WidgetCard title={widget.title}>
            <div className="flex flex-1 items-center">
                <DialogTrigger>
                    <Button color="secondary" size="md">
                        {triggerLabel}
                    </Button>
                    <ModalOverlay>
                        <Modal>
                            <Dialog aria-label={heading}>
                                <div className="flex w-full max-w-md flex-col gap-3 rounded-xl bg-primary p-6 shadow-xl ring-1 ring-secondary">
                                    <h3 className="text-lg font-semibold text-primary">{heading}</h3>
                                    {body ? <p className="text-sm text-tertiary">{body}</p> : null}
                                </div>
                            </Dialog>
                        </Modal>
                    </ModalOverlay>
                </DialogTrigger>
            </div>
        </WidgetCard>
    );
}

export function DrawerWidget({ widget }: WidgetRenderProps) {
    const settings = widget.settings ?? {};
    const triggerLabel = typeof settings.triggerLabel === "string" ? settings.triggerLabel : "Open drawer";
    const heading = typeof settings.heading === "string" ? settings.heading : (widget.title ?? "Details");
    const body = typeof settings.body === "string" ? settings.body : "";

    return (
        <WidgetCard title={widget.title}>
            <div className="flex flex-1 items-center">
                <SlideoutMenu.Trigger>
                    <Button color="secondary" size="md">
                        {triggerLabel}
                    </Button>
                    <SlideoutMenu>
                        {({ close }) => (
                            <>
                                <SlideoutMenu.Header onClose={close}>
                                    <h3 className="text-lg font-semibold text-primary">{heading}</h3>
                                </SlideoutMenu.Header>
                                <SlideoutMenu.Content>{body ? <p className="text-sm text-tertiary">{body}</p> : null}</SlideoutMenu.Content>
                            </>
                        )}
                    </SlideoutMenu>
                </SlideoutMenu.Trigger>
            </div>
        </WidgetCard>
    );
}
