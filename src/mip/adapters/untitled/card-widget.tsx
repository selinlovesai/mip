/**
 * Card widget — Untitled UI adapter. A simple titled content block: heading,
 * optional eyebrow/badge, body text, and optional footer. Content from
 * `settings` (heading, eyebrow, body, footer).
 */

import type { WidgetRenderProps } from "@/mip/adapter/types";
import { WidgetCard } from "./widget-card";

export function CardWidget({ widget }: WidgetRenderProps) {
    const settings = widget.settings ?? {};
    const eyebrow = typeof settings.eyebrow === "string" ? settings.eyebrow : undefined;
    const heading = typeof settings.heading === "string" ? settings.heading : widget.title;
    const body = typeof settings.body === "string" ? settings.body : undefined;
    const footer = typeof settings.footer === "string" ? settings.footer : undefined;

    return (
        <WidgetCard>
            <div className="flex flex-1 flex-col gap-2">
                {eyebrow ? <span className="text-xs font-semibold uppercase tracking-wide text-brand-secondary">{eyebrow}</span> : null}
                {heading ? <h3 className="text-lg font-semibold text-primary">{heading}</h3> : null}
                {body ? <p className="text-sm text-tertiary">{body}</p> : null}
                {footer ? <p className="mt-auto pt-3 text-xs text-tertiary">{footer}</p> : null}
            </div>
        </WidgetCard>
    );
}
