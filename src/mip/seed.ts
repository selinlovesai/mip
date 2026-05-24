/** Seed pages used on first load (before any localStorage state exists). */

import type { MipWidget } from "@/mip/schema";
import type { DashboardPage } from "./store";

const L = (x: number, y: number, w: number, h: number): MipWidget["layout"] => ({ x, y, w, h });

const overviewWidgets: MipWidget[] = [
    { id: "revenue", type: "kpi", title: "Revenue", layout: L(0, 0, 4, 1), settings: { value: 128400, valueFormat: "currency", delta: 12.5, deltaLabel: "vs. last month" } },
    { id: "active-users", type: "kpi", title: "Active users", layout: L(4, 0, 4, 1), settings: { value: 8420, delta: 4.1, deltaLabel: "vs. last week" } },
    { id: "churn", type: "kpi", title: "Churn rate", layout: L(8, 0, 4, 1), settings: { value: 2.3, valueFormat: "percent", delta: -0.8, deltaLabel: "vs. last month" } },
    {
        id: "trend",
        type: "areaChart",
        title: "Signups over time",
        layout: L(0, 1, 8, 3),
        settings: { points: [{ label: "Jan", value: 120 }, { label: "Feb", value: 210 }, { label: "Mar", value: 180 }, { label: "Apr", value: 320 }, { label: "May", value: 290 }, { label: "Jun", value: 410 }] },
    },
    { id: "goal", type: "progress", title: "Quarterly goal", layout: L(8, 1, 4, 1), settings: { value: 74, target: 100, label: "$740k of $1M" } },
    {
        id: "channels",
        type: "donutChart",
        title: "Traffic by channel",
        layout: L(8, 2, 4, 2),
        settings: { points: [{ label: "Organic", value: 45 }, { label: "Paid", value: 25 }, { label: "Referral", value: 18 }, { label: "Social", value: 12 }] },
    },
    {
        id: "revenue-by-region",
        type: "barChart",
        title: "Revenue by region",
        layout: L(0, 4, 8, 2),
        settings: { valueFormat: "currency", points: [{ label: "NA", value: 52000 }, { label: "EMEA", value: 38000 }, { label: "APAC", value: 24000 }, { label: "LATAM", value: 14400 }] },
    },
    {
        id: "recent-orders",
        type: "table",
        title: "Recent orders",
        layout: L(8, 4, 4, 2),
        settings: {
            columns: [{ key: "order", label: "Order" }, { key: "customer", label: "Customer" }, { key: "status", label: "Status" }],
            rows: [{ order: "#1042", customer: "Acme Inc.", status: "Paid" }, { order: "#1041", customer: "Globex", status: "Pending" }, { order: "#1040", customer: "Initech", status: "Failed" }, { order: "#1039", customer: "Umbrella", status: "Paid" }],
        },
    },
];

const marketingWidgets: MipWidget[] = [
    { id: "hero", type: "hero", title: "Hero", layout: L(0, 0, 12, 3), settings: { heading: "Build dashboards, faster", subheading: "A kit-agnostic widget system on Tailwind v4 + Untitled UI.", ctaLabel: "Get started", secondaryLabel: "Learn more" } },
    {
        id: "features",
        type: "featureGrid",
        title: "Features",
        layout: L(0, 3, 8, 2),
        settings: { heading: "Why teams choose us", features: [{ icon: "⚡", title: "Lightning fast", description: "Instant page loads." }, { icon: "🔒", title: "Secure", description: "End-to-end encryption." }, { icon: "🌐", title: "Global scale", description: "30+ regions." }] },
    },
    { id: "testimonial", type: "testimonial", title: "Testimonial", layout: L(8, 3, 4, 2), settings: { quote: "“This transformed how we ship dashboards.”", author: "Olivia Rhye", role: "VP Product, Acme", rating: 5 } },
    {
        id: "pricing",
        type: "pricing",
        title: "Pricing",
        layout: L(0, 5, 12, 3),
        settings: {
            heading: "Simple, transparent pricing",
            tiers: [
                { name: "Starter", price: "$29", period: "mo", description: "For small teams.", features: ["5 projects", "Basic analytics"], ctaLabel: "Start free" },
                { name: "Pro", price: "$79", period: "mo", description: "For growing teams.", features: ["Unlimited projects", "Priority support"], highlighted: true, ctaLabel: "Get started" },
                { name: "Enterprise", price: "Custom", description: "For large orgs.", features: ["SSO & SAML", "SLA guarantee"], ctaLabel: "Contact sales" },
            ],
        },
    },
];

export function seedPages(): DashboardPage[] {
    return [
        { id: "overview", title: "Overview", cols: 12, rowHeight: 140, widgets: overviewWidgets },
        { id: "marketing", title: "Marketing", cols: 12, rowHeight: 140, widgets: marketingWidgets },
    ];
}
