/**
 * Button widget — Untitled UI adapter. Renders the starter's first-class
 * Untitled `Button`, mapping the MIP `style.variant`/`size` to Button props.
 * Settings: `label`, `url` (link), `target` (_self/_blank), `className` (extra
 * classes), `title` (tooltip).
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

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);

export function ButtonWidget({ widget }: WidgetRenderProps) {
    const settings = widget.settings ?? {};
    const label = str(settings.label) ?? widget.title ?? "Button";
    const href = str(settings.url) ?? str(settings.href);
    const target = str(settings.target);
    const className = str(settings.className);
    const title = str(settings.title);
    const color = VARIANT_TO_COLOR[widget.style?.variant ?? "primary"];
    const size = widget.style?.size ?? "md";

    return (
        <WidgetCard>
            <div className="flex flex-1 items-center">
                <Button
                    color={color}
                    size={size}
                    className={className}
                    title={title}
                    {...(href ? { href, target, rel: target === "_blank" ? "noopener noreferrer" : undefined } : {})}
                >
                    {label}
                </Button>
            </div>
        </WidgetCard>
    );
}
