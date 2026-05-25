/**
 * Design-block widgets — Untitled UI adapter. The marketing/landing-page set:
 * hero, cta, pricing, contentSection, testimonial, featureGrid, statsGrid, faq.
 *
 * These are presentational and read their content from `settings.content`
 * (or `settings` directly), matching the original app's content shapes. Each
 * sits on its own surface and spans whatever grid width it's given.
 *
 * Built on real Untitled UI components (Button, Badge, Avatar, RatingStars)
 * for full design-system compatibility.
 */

import { useState } from "react";
import { Check, ChevronDown } from "@untitledui/icons";
import { Avatar } from "@/components/base/avatar/avatar";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { RatingStars } from "@/components/foundations/rating-stars";
import type { WidgetRenderProps } from "@/mip/adapter/types";
import type { MipWidget } from "@/mip/schema";
import { cx } from "@/utils/cx";
import { markdownToHtml } from "./markdown";
import { WidgetIcon } from "./widget-icon";

/** Map a content alignment to flex + text-align classes. */
type Align = "left" | "center" | "right";
const alignCls = (a?: Align) => (a === "center" ? "items-center text-center" : a === "right" ? "items-end text-right" : "items-start text-left");

/** Read the content object for a design block: `settings.content` if present, else `settings`. */
function readContent<T extends Record<string, unknown>>(widget: MipWidget, defaults: T): T {
    const settings = widget.settings ?? {};
    const content = settings.content && typeof settings.content === "object" ? (settings.content as Record<string, unknown>) : settings;
    return { ...defaults, ...content } as T;
}

const surface = "flex h-full flex-col rounded-xl bg-primary p-6 ring-1 ring-secondary";

/** Coerce to an array — tolerates the agent omitting or null-ing a collection,
 *  so the block renders empty instead of crashing on `.map`. */
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

function Prose({ text }: { text: string }) {
    return <div className="prose prose-sm dark:prose-invert max-w-none text-tertiary" dangerouslySetInnerHTML={{ __html: markdownToHtml(text) }} />;
}

// ---------------------------------------------------------------------------

export function HeroWidget({ widget }: WidgetRenderProps) {
    const c = readContent(widget, {} as { heading?: string; subheading?: string; alignment?: Align; eyebrow?: string; backgroundImage?: string; ctaLabel?: string; ctaUrl?: string; secondaryLabel?: string; secondaryUrl?: string });
    const heading = c.heading ?? widget.title ?? "Hero heading";
    const align = c.alignment ?? "center";
    const hasBg = typeof c.backgroundImage === "string" && c.backgroundImage.trim() !== "";
    const bgStyle = hasBg ? { backgroundImage: `url(${c.backgroundImage})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined;
    return (
        <div
            style={bgStyle}
            className={cx(
                "relative flex h-full flex-col justify-center gap-4 overflow-hidden rounded-xl p-8 ring-1 ring-secondary",
                hasBg ? "bg-gray-900" : "bg-gradient-to-br from-utility-brand-100 to-bg-primary",
                alignCls(align),
            )}
        >
            {hasBg ? <div className="absolute inset-0 bg-black/45" aria-hidden /> : null}
            <div className={cx("relative flex flex-col gap-4", alignCls(align))}>
                {c.eyebrow ? (
                    <Badge type="pill-color" color="brand" size="md">
                        {c.eyebrow}
                    </Badge>
                ) : null}
                <h2 className={cx("max-w-2xl text-display-sm font-semibold", hasBg ? "text-white" : "text-primary")}>{heading}</h2>
                {c.subheading ? <p className={cx("max-w-xl text-lg", hasBg ? "text-white/80" : "text-tertiary")}>{c.subheading}</p> : null}
                {c.ctaLabel || c.secondaryLabel ? (
                    <div className="mt-2 flex flex-wrap gap-3">
                        {c.ctaLabel ? (
                            <Button href={c.ctaUrl ?? "#"} color="primary" size="lg">
                                {c.ctaLabel}
                            </Button>
                        ) : null}
                        {c.secondaryLabel ? (
                            <Button href={c.secondaryUrl ?? "#"} color="secondary" size="lg">
                                {c.secondaryLabel}
                            </Button>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

export function CtaWidget({ widget }: WidgetRenderProps) {
    const c = readContent(widget, {} as { heading?: string; body?: string; alignment?: Align; buttonLabel?: string; buttonUrl?: string });
    const heading = c.heading ?? widget.title ?? "Ready to get started?";
    return (
        <div className={cx("flex h-full flex-col justify-center gap-4 rounded-xl bg-brand-solid p-8", alignCls(c.alignment ?? "center"))}>
            <h3 className="text-2xl font-semibold text-white">{heading}</h3>
            {c.body ? <p className="max-w-xl text-white/80">{c.body}</p> : null}
            {c.buttonLabel ? (
                <Button href={c.buttonUrl ?? "#"} color="secondary" size="lg">
                    {c.buttonLabel}
                </Button>
            ) : null}
        </div>
    );
}

interface PricingTier {
    name: string;
    price: string;
    period?: string;
    description?: string;
    features: string[];
    highlighted?: boolean;
    ctaLabel?: string;
    ctaUrl?: string;
}

export function PricingWidget({ widget }: WidgetRenderProps) {
    const c = readContent(widget, { tiers: [] as PricingTier[] } as { heading?: string; subheading?: string; tiers: PricingTier[] });
    const heading = c.heading ?? widget.title ?? "Pricing";
    return (
        <div className={surface}>
            {heading ? <h3 className="text-xl font-semibold text-primary">{heading}</h3> : null}
            {c.subheading ? <p className="mt-1 text-sm text-tertiary">{c.subheading}</p> : null}
            <div className="mt-5 grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {arr<PricingTier>(c.tiers).map((tier, i) => (
                    <div key={i} className={cx("flex flex-col gap-4 rounded-xl p-5 ring-1", tier.highlighted ? "bg-secondary ring-brand" : "ring-secondary")}>
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="text-sm font-semibold text-secondary">{tier.name}</h4>
                                {tier.highlighted ? (
                                    <Badge type="pill-color" color="brand" size="sm">
                                        Popular
                                    </Badge>
                                ) : null}
                            </div>
                            <div className="mt-1 flex items-baseline gap-1">
                                <span className="text-display-xs font-semibold text-primary">{tier.price}</span>
                                {tier.period ? <span className="text-sm text-tertiary">/{tier.period}</span> : null}
                            </div>
                            {tier.description ? <p className="mt-1 text-sm text-tertiary">{tier.description}</p> : null}
                        </div>
                        <ul className="flex flex-col gap-2 text-sm text-secondary">
                            {arr<string>(tier.features).map((f, j) => (
                                <li key={j} className="flex items-center gap-2">
                                    <Check className="size-4 shrink-0 text-brand-secondary" />
                                    {f}
                                </li>
                            ))}
                        </ul>
                        {tier.ctaLabel ? (
                            <Button href={tier.ctaUrl ?? "#"} color={tier.highlighted ? "primary" : "secondary"} size="md" className="mt-auto w-full">
                                {tier.ctaLabel}
                            </Button>
                        ) : null}
                    </div>
                ))}
            </div>
        </div>
    );
}

export function ContentSectionWidget({ widget }: WidgetRenderProps) {
    const c = readContent(widget, {} as { heading?: string; body?: string; alignment?: Align; imageUrl?: string; imagePosition?: "left" | "right" | "top" });
    const heading = c.heading ?? widget.title ?? "Section heading";
    const pos = c.imagePosition ?? "top";
    const media = c.imageUrl ? <img src={c.imageUrl} alt="" loading="lazy" className="w-full rounded-lg object-cover" /> : null;
    return (
        <div className={cx(surface, "gap-4", pos === "left" && "sm:flex-row", pos === "right" && "sm:flex-row-reverse")}>
            {media && pos !== "top" ? <div className="sm:w-1/2">{media}</div> : null}
            <div className={cx("flex flex-1 flex-col gap-3", alignCls(c.alignment))}>
                {media && pos === "top" ? media : null}
                <h3 className="text-xl font-semibold text-primary">{heading}</h3>
                {c.body ? <Prose text={c.body} /> : null}
            </div>
        </div>
    );
}

export function TestimonialWidget({ widget }: WidgetRenderProps) {
    const c = readContent(widget, {} as { quote?: string; author?: string; role?: string; avatarUrl?: string; rating?: number });
    const quote = c.quote ?? "“An amazing product that transformed our workflow.”";
    const author = c.author ?? "Jane Doe";
    const rating = typeof c.rating === "number" ? c.rating : Number(c.rating) || 5;
    return (
        <div className={cx(surface, "gap-4")}>
            {rating > 0 ? <RatingStars rating={rating} aria-label={`${rating} out of 5 stars`} /> : null}
            <blockquote className="flex-1 text-lg font-medium text-secondary">{quote}</blockquote>
            <div className="flex items-center gap-3">
                <Avatar size="md" src={c.avatarUrl ?? undefined} alt={author} initials={author.charAt(0)} />
                <div className="flex flex-col">
                    <strong className="text-sm font-semibold text-primary">{author}</strong>
                    {c.role ? <span className="text-xs text-tertiary">{c.role}</span> : null}
                </div>
            </div>
        </div>
    );
}

interface FeatureItem {
    icon?: string;
    title: string;
    description: string;
}

export function FeatureGridWidget({ widget }: WidgetRenderProps) {
    const c = readContent(widget, { features: [] as FeatureItem[] } as { heading?: string; subheading?: string; features: FeatureItem[]; columns?: number });
    const heading = c.heading ?? widget.title ?? "Features";
    const cols = c.columns ?? 3;
    return (
        <div className={surface}>
            {heading ? <h3 className="text-xl font-semibold text-primary">{heading}</h3> : null}
            {c.subheading ? <p className="mt-1 text-sm text-tertiary">{c.subheading}</p> : null}
            <div className={cx("mt-5 grid flex-1 gap-5", cols === 2 ? "sm:grid-cols-2" : cols === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3")}>
                {arr<FeatureItem>(c.features).map((f, i) => (
                    <div key={i} className="flex flex-col gap-2">
                        {f.icon ? (
                            <span className="flex size-10 items-center justify-center rounded-lg bg-utility-brand-50 text-lg text-utility-brand-600">
                                <WidgetIcon icon={f.icon} className="size-5" />
                            </span>
                        ) : null}
                        <h4 className="text-sm font-semibold text-primary">{f.title}</h4>
                        <p className="text-sm text-tertiary">{f.description}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

interface StatItem {
    value: string;
    label: string;
    delta?: string;
}

export function StatsGridWidget({ widget }: WidgetRenderProps) {
    const c = readContent(widget, { stats: [] as StatItem[] } as { heading?: string; stats: StatItem[]; columns?: number });
    const heading = c.heading ?? widget.title ?? "By the numbers";
    const cols = c.columns ?? 3;
    return (
        <div className={surface}>
            {heading ? <h3 className="text-xl font-semibold text-primary">{heading}</h3> : null}
            <div className={cx("mt-5 grid flex-1 gap-5", cols === 2 ? "grid-cols-2" : cols === 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-3")}>
                {arr<StatItem>(c.stats).map((s, i) => (
                    <div key={i} className="flex flex-col gap-1">
                        <div className="flex items-baseline gap-2">
                            <span className="text-display-sm font-semibold text-primary">{s.value}</span>
                            {s.delta ? (
                                <Badge type="pill-color" color={String(s.delta).startsWith("-") ? "error" : "success"} size="sm">
                                    {s.delta}
                                </Badge>
                            ) : null}
                        </div>
                        <span className="text-sm text-tertiary">{s.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

interface FaqItem {
    question: string;
    answer: string;
}

export function FaqWidget({ widget }: WidgetRenderProps) {
    const c = readContent(widget, { items: [] as FaqItem[] } as { heading?: string; items: FaqItem[] });
    const heading = c.heading ?? widget.title ?? "Frequently asked questions";
    const [open, setOpen] = useState<number | null>(0);
    return (
        <div className={surface}>
            {heading ? <h3 className="text-xl font-semibold text-primary">{heading}</h3> : null}
            <div className="mt-4 flex flex-col divide-y divide-border-secondary">
                {arr<FaqItem>(c.items).map((item, i) => (
                    <div key={i}>
                        <button type="button" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} className="flex w-full items-center justify-between gap-3 py-3 text-left text-sm font-medium text-secondary">
                            <span>{item.question}</span>
                            <ChevronDown className={cx("size-4 shrink-0 text-tertiary transition-transform", open === i && "rotate-180")} />
                        </button>
                        {open === i ? <div className="pb-3"><Prose text={item.answer} /></div> : null}
                    </div>
                ))}
            </div>
        </div>
    );
}
