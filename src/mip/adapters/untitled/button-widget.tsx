/**
 * Button widget — Untitled UI adapter. Renders the starter's first-class
 * Untitled `Button`, mapping the MIP `style.variant`/`size` to Button props.
 * Label from `settings.label` (or the widget title); optional `settings.href`
 * renders it as a link.
 */

import { Button } from "@/components/base/buttons/button";
import type { WidgetRenderProps } from "@/mip/adapter/types";
import type { ButtonVariant } from "@/mip/schema";
import { WidgetCard } from "./widget-card";

const VARIANT_TO_COLOR: Record<ButtonVariant, "primary" | "secondary" | "tertiary" | "primary-destructive"> = {
    primary: "primary",
    secondary: "secondary",
    ghost: "tertiary",
    danger: "primary-destructive",
};

export function ButtonWidget({ widget }: WidgetRenderProps) {
    const settings = widget.settings ?? {};
    const label = typeof settings.label === "string" ? settings.label : (widget.title ?? "Button");
    const href = typeof settings.href === "string" ? settings.href : undefined;
    const color = VARIANT_TO_COLOR[widget.style?.variant ?? "primary"];
    const size = widget.style?.size ?? "md";

    return (
        <WidgetCard>
            <div className="flex flex-1 items-center">
                <Button color={color} size={size} {...(href ? { href } : {})}>
                    {label}
                </Button>
            </div>
        </WidgetCard>
    );
}
