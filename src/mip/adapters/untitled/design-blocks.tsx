/**
 * Design-block widgets — Untitled UI adapter. The marketing/landing-page set:
 * hero, cta, pricing, contentSection, testimonial, featureGrid, statsGrid, faq.
 *
 * These are presentational and read their content from `settings.content`
 * (or `settings` directly), matching the original app's content shapes. Each
 * sits on its own surface and spans whatever grid width it's given.
 */

import { useState } from "react";
import { Check, ChevronDown, Star01 } from "@untitledui/icons";
import type { WidgetRenderProps } from "@/mip/adapter/types";
import type { MipWidget } from "@/mip/schema";
import { cx } from "@/utils/cx";
import { markdownToHtml } from "./markdown";

/** Read the content object for a design block: `settings.content` if present, else `settings`. */
function readContent<T extends Record<string, unknown>>(widget: MipWidget, defaults: T): T {
    const settings = widget.settings ?? {};
    const content = settings.content && typeof settings.content === "object" ? (settings.content as Record<string, unknown>) : settings;
    return { ...defaults, ...content } as T;
}

const surface = "flex h-full flex-col rounded-xl bg-primary p-6 ring-1 ring-secondary";

function Prose({ text }: { text: string }) {
    return <div className="prose prose-sm dark:prose-invert max-w-none text-tertiary" dangerouslySetInnerHTML={{ __html: markdownToHtml(text) }} />;
}

// ---------------------------------------------------------------------------

export function HeroWidget({ widget }: WidgetRenderProps) {
    const c = readContent(widget, {} as { heading?: string; subheading?: string; alignment?: "left" | "center"; ctaLabel?: string; ctaUrl?: string; secondaryLabel?: string; secondaryUrl?: string });
    const heading = c.heading ?? widget.title ?? "Hero heading";
    const align = c.alignment ?? "center";
    return (
        <div className={cx("flex h-full flex-col justify-center gap-4 overflow-hidden rounded-xl bg-gradient-to-br from-utility-brand-100 to-bg-primary p-8 ring-1 ring-secondary", align === "center" ? "items-center text-center" : "items-start text-left")}>
            <h2 className="max-w-2xl text-display-sm font-semibold text-primary">{heading}</h2>
            {c.subheading ? <p className="max-w-xl text-lg text-tertiary">{c.subheading}</p> : null}
            {c.ctaLabel || c.secondaryLabel ? (
                <div className="mt-2 flex flex-wrap gap-3">
                    {c.ctaLabel ? (
                        <a href={c.ctaUrl ?? "#"} className="rounded-lg bg-brand-solid px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90">
                            {c.ctaLabel}
                        </a>
                    ) : null}
                    {c.secondaryLabel ? (
                        <a href={c.secondaryUrl ?? "#"} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-secondary ring-1 ring-secondary hover:bg-secondary">
                            {c.secondaryLabel}
                        </a>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

export function CtaWidget({ widget }: WidgetRenderProps) {
    const c = readContent(widget, {} as { heading?: string; body?: string; buttonLabel?: string; buttonUrl?: string });
    const heading = c.heading ?? widget.title ?? "Ready to get started?";
    return (
        <div className="flex h-full flex-col items-center justify-center gap-4 rounded-xl bg-brand-solid p-8 text-center">
            <h3 className="text-2xl font-semibold text-white">{heading}</h3>
            {c.body ? <p className="max-w-xl text-white/80">{c.body}</p> : null}
            {c.buttonLabel ? (
                <a href={c.buttonUrl ?? "#"} className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-brand-secondary hover:opacity-90">
                    {c.buttonLabel}
                </a>
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
                {c.tiers.map((tier, i) => (
                    <div key={i} className={cx("flex flex-col gap-4 rounded-xl p-5 ring-1", tier.highlighted ? "bg-secondary ring-brand" : "ring-secondary")}>
                        <div>
                            <h4 className="text-sm font-semibold text-secondary">{tier.name}</h4>
                            <div className="mt-1 flex items-baseline gap-1">
                                <span className="text-display-xs font-semibold text-primary">{tier.price}</span>
                                {tier.period ? <span className="text-sm text-tertiary">/{tier.period}</span> : null}
                            </div>
                            {tier.description ? <p className="mt-1 text-sm text-tertiary">{tier.description}</p> : null}
                        </div>
                        <ul className="flex flex-col gap-2 text-sm text-secondary">
                            {tier.features.map((f, j) => (
                                <li key={j} className="flex items-center gap-2">
                                    <Check className="size-4 shrink-0 text-brand-secondary" />
                                    {f}
                                </li>
                            ))}
                        </ul>
                        {tier.ctaLabel ? (
                            <a href={tier.ctaUrl ?? "#"} className={cx("mt-auto rounded-lg px-4 py-2 text-center text-sm font-semibold", tier.highlighted ? "bg-brand-solid text-white hover:opacity-90" : "bg-primary text-secondary ring-1 ring-secondary hover:bg-secondary")}>
                                {tier.ctaLabel}
                            </a>
                        ) : null}
                    </div>
                ))}
            </div>
        </div>
    );
}

export function ContentSectionWidget({ widget }: WidgetRenderProps) {
    const c = readContent(widget, {} as { heading?: string; body?: string; imageUrl?: string; imagePosition?: "left" | "right" | "top" });
    const heading = c.heading ?? widget.title ?? "Section heading";
    const pos = c.imagePosition ?? "top";
    const media = c.imageUrl ? <img src={c.imageUrl} alt="" loading="lazy" className="w-full rounded-lg object-cover" /> : null;
    return (
        <div className={cx(surface, "gap-4", pos === "left" && "sm:flex-row", pos === "right" && "sm:flex-row-reverse")}>
            {media && pos !== "top" ? <div className="sm:w-1/2">{media}</div> : null}
            <div className="flex flex-1 flex-col gap-3">
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
    const rating = c.rating ?? 5;
    return (
        <div className={cx(surface, "gap-4")}>
            {rating > 0 ? (
                <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
                    {Array.from({ length: 5 }, (_, i) => (
                        <Star01 key={i} className={cx("size-4", i < rating ? "fill-current text-utility-yellow-400" : "text-tertiary")} />
                    ))}
                </div>
            ) : null}
            <blockquote className="flex-1 text-lg font-medium text-secondary">{quote}</blockquote>
            <div className="flex items-center gap-3">
                {c.avatarUrl ? (
                    <img src={c.avatarUrl} alt={author} className="size-10 rounded-full object-cover" />
                ) : (
                    <span className="flex size-10 items-center justify-center rounded-full bg-utility-brand-50 font-semibold text-utility-brand-700">{author.charAt(0)}</span>
                )}
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
                {c.features.map((f, i) => (
                    <div key={i} className="flex flex-col gap-2">
                        {f.icon ? <span className="flex size-10 items-center justify-center rounded-lg bg-utility-brand-50 text-lg">{f.icon}</span> : null}
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
                {c.stats.map((s, i) => (
                    <div key={i} className="flex flex-col gap-1">
                        <div className="flex items-baseline gap-2">
                            <span className="text-display-sm font-semibold text-primary">{s.value}</span>
                            {s.delta ? <span className={cx("text-sm font-medium", s.delta.startsWith("-") ? "text-utility-red-500" : "text-utility-green-500")}>{s.delta}</span> : null}
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
                {c.items.map((item, i) => (
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
