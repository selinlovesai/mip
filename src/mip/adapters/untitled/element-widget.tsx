/**
 * Element widget — renders a single design-system ATOM resolved from the
 * components catalog (directive #3: atoms are placeable, DB-driven widgets).
 *
 * `settings.componentId` picks the atom (button / badge / avatar / checkbox /
 * toggle / input / progressBar); `variant` / `size` / `label` tune it, defaulting
 * to the catalog's first variant/size. Unknown ids fall back to a labeled chip,
 * so the widget degrades gracefully instead of crashing.
 */

import { Button } from "@/components/base/buttons/button";
import { Badge, type BadgeColor } from "@/components/base/badges/badges";
import { Avatar } from "@/components/base/avatar/avatar";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Toggle } from "@/components/base/toggle/toggle";
import { Input } from "@/components/base/input/input";
import type { WidgetRenderProps } from "@/mip/adapter/types";
import { componentDef } from "@/mip/components-catalog";
import { WidgetCard } from "./widget-card";

const str = (v: unknown, fallback = ""): string => (typeof v === "string" && v.trim() ? v : fallback);
/** Pick `v` if it's an allowed value, else the first allowed (or `fallback`). */
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);

const BUTTON_COLORS = ["primary", "secondary", "tertiary", "link-gray", "link-color", "primary-destructive", "secondary-destructive", "tertiary-destructive", "link-destructive"] as const;
const BUTTON_SIZES = ["xs", "sm", "md", "lg", "xl"] as const;
const BADGE_COLORS = ["gray", "brand", "error", "warning", "success", "blue", "indigo", "purple", "pink", "orange"] as const;
const BADGE_SIZES = ["sm", "md", "lg"] as const;
const AVATAR_SIZES = ["xs", "sm", "md", "lg", "xl", "2xl"] as const;
const SM_MD = ["sm", "md"] as const;
const INPUT_SIZES = ["sm", "md", "lg"] as const;

export function ElementWidget({ widget }: WidgetRenderProps) {
    const s = (widget.settings ?? {}) as Record<string, unknown>;
    const id = str(s.componentId);
    const def = componentDef(id);
    const label = str(s.label, def?.label ?? "Element");
    const variant = str(s.variant, def?.variants?.[0] ?? "");
    const size = str(s.size, def?.sizes?.[0] ?? "");

    const render = () => {
        switch (id) {
            case "button":
                return (
                    <Button color={oneOf(variant, BUTTON_COLORS, "primary")} size={oneOf(size, BUTTON_SIZES, "md")}>
                        {label}
                    </Button>
                );
            case "badge":
                return (
                    <Badge color={oneOf<BadgeColor<"pill-color">>(variant as BadgeColor<"pill-color">, BADGE_COLORS as readonly BadgeColor<"pill-color">[], "gray")} size={oneOf(size, BADGE_SIZES, "md")}>
                        {label}
                    </Badge>
                );
            case "avatar":
                return <Avatar size={oneOf(size, AVATAR_SIZES, "md")} initials={(label.slice(0, 2) || "AB").toUpperCase()} alt={label} />;
            case "checkbox":
                return <Checkbox label={label} size={oneOf(size, SM_MD, "md")} />;
            case "toggle":
                return <Toggle label={label} size={oneOf(size, SM_MD, "md")} />;
            case "input":
                return <Input size={oneOf(size, INPUT_SIZES, "md")} placeholder={str(s.placeholder, label)} aria-label={label} />;
            case "progressBar": {
                const pct = Math.max(0, Math.min(100, Number(s.value ?? 60)));
                return (
                    <div className="w-full">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-quaternary">
                            <div className="h-full rounded-full bg-brand-solid" style={{ width: `${pct}%` }} />
                        </div>
                    </div>
                );
            }
            default:
                return (
                    <span className="rounded-md px-2.5 py-1 text-sm font-medium text-secondary ring-1 ring-secondary">{label}</span>
                );
        }
    };

    return (
        <WidgetCard title={widget.title}>
            <div className="flex flex-1 items-center justify-center">{render()}</div>
        </WidgetCard>
    );
}
