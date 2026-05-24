/**
 * Widget gallery — renders one sample of the marketing/design-block and misc
 * widget types through the Untitled UI adapter. Used to eyeball every renderer
 * in one place during the migration.
 */

import { untitledAdapter } from "@/mip/adapters/untitled";
import { UiKitProvider, WidgetView } from "@/mip/adapter/registry";
import type { MipWidget } from "@/mip/schema";

const layout = { x: 0, y: 0, w: 3, h: 2 };

const widgets: MipWidget[] = [
    { id: "ph", type: "pageHeader", layout, settings: { heading: "Widget gallery", subheading: "Every design-block & misc widget, via the Untitled UI adapter.", actionLabel: "New widget" } },
    {
        id: "hero",
        type: "hero",
        layout,
        settings: { heading: "Build dashboards, faster", subheading: "A kit-agnostic widget system on Tailwind v4 + Untitled UI.", ctaLabel: "Get started", secondaryLabel: "Learn more" },
    },
    {
        id: "features",
        type: "featureGrid",
        layout,
        settings: {
            heading: "Why teams choose us",
            features: [
                { icon: "⚡", title: "Lightning fast", description: "Instant page loads and real-time updates." },
                { icon: "🔒", title: "Secure by default", description: "End-to-end encryption and SSO." },
                { icon: "🌐", title: "Global scale", description: "30+ regions with 99.99% uptime." },
            ],
        },
    },
    {
        id: "stats",
        type: "statsGrid",
        layout,
        settings: {
            heading: "By the numbers",
            stats: [
                { value: "10K+", label: "Active users", delta: "+12%" },
                { value: "99.9%", label: "Uptime SLA" },
                { value: "24/7", label: "Support coverage" },
            ],
        },
    },
    {
        id: "pricing",
        type: "pricing",
        layout,
        settings: {
            heading: "Simple, transparent pricing",
            tiers: [
                { name: "Starter", price: "$29", period: "mo", description: "For small teams.", features: ["5 projects", "Basic analytics", "Email support"], ctaLabel: "Start free" },
                { name: "Pro", price: "$79", period: "mo", description: "For growing teams.", features: ["Unlimited projects", "Advanced analytics", "Priority support"], highlighted: true, ctaLabel: "Get started" },
                { name: "Enterprise", price: "Custom", description: "For large orgs.", features: ["SSO & SAML", "Dedicated support", "SLA guarantee"], ctaLabel: "Contact sales" },
            ],
        },
    },
    {
        id: "testimonial",
        type: "testimonial",
        layout: { ...layout, w: 1 },
        settings: { quote: "“This transformed how we ship dashboards.”", author: "Olivia Rhye", role: "VP Product, Acme", rating: 5 },
    },
    {
        id: "faq",
        type: "faq",
        layout: { ...layout, w: 2 },
        settings: {
            heading: "FAQ",
            items: [
                { question: "What is this product?", answer: "A platform for building **data dashboards** with a kit-agnostic widget system." },
                { question: "How does pricing work?", answer: "Flexible plans starting at $29/month." },
                { question: "Can I cancel anytime?", answer: "Yes — all plans are month-to-month." },
            ],
        },
    },
    {
        id: "cta",
        type: "cta",
        layout,
        settings: { heading: "Ready to get started?", body: "Spin up your first dashboard in minutes.", buttonLabel: "Start building" },
    },
    { id: "modal", type: "modal", title: "Modal", layout: { ...layout, w: 1, h: 1 }, settings: { triggerLabel: "Open modal", heading: "Hello from a modal", body: "This overlay is rendered by the modal widget." } },
    { id: "drawer", type: "drawer", title: "Drawer", layout: { ...layout, w: 1, h: 1 }, settings: { triggerLabel: "Open drawer", heading: "Side drawer", body: "Slides in from the right." } },
    { id: "image", type: "image", title: "Image", layout: { ...layout, w: 1, h: 1 }, settings: { url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600", alt: "Dashboard" } },
];

export const GalleryScreen = () => {
    return (
        <UiKitProvider adapter={untitledAdapter}>
            <div className="min-h-dvh bg-secondary px-6 py-8">
                <div className="mx-auto flex max-w-5xl flex-col gap-6">
                    {widgets.map((widget) => (
                        <div key={widget.id} className={widget.layout.w === 1 ? "max-w-md" : ""} style={{ minHeight: widget.layout.h * 110 }}>
                            <WidgetView widget={widget} />
                        </div>
                    ))}
                </div>
            </div>
        </UiKitProvider>
    );
};
