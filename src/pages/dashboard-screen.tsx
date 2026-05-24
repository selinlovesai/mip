/**
 * Demo dashboard — the first vertical proof of the kit-agnostic widget
 * pipeline. Sample `MipWidget`s are rendered through `WidgetView`, resolved by
 * the active `UiKitAdapter` (Untitled UI). Swapping `untitledAdapter` for any
 * other adapter at the provider re-skins this entire screen with no other
 * change. Replace the static `widgets` array with real dashboard state next.
 */

import { untitledAdapter } from "@/mip/adapters/untitled";
import { UiKitProvider, WidgetView } from "@/mip/adapter/registry";
import type { MipWidget } from "@/mip/schema";

const widgets: MipWidget[] = [
    {
        id: "revenue",
        type: "kpi",
        title: "Revenue",
        layout: { x: 0, y: 0, w: 1, h: 1 },
        settings: { value: 128400, valueFormat: "currency", delta: 12.5, deltaLabel: "vs. last month" },
    },
    {
        id: "active-users",
        type: "kpi",
        title: "Active users",
        layout: { x: 1, y: 0, w: 1, h: 1 },
        settings: { value: 8420, delta: 4.1, deltaLabel: "vs. last week" },
    },
    {
        id: "churn",
        type: "kpi",
        title: "Churn rate",
        layout: { x: 2, y: 0, w: 1, h: 1 },
        settings: { value: 2.3, valueFormat: "percent", delta: -0.8, deltaLabel: "vs. last month" },
    },
    {
        id: "goal",
        type: "progress",
        title: "Quarterly goal",
        layout: { x: 0, y: 1, w: 1, h: 1 },
        settings: { value: 74, target: 100, label: "$740k of $1M" },
    },
    {
        id: "trend",
        type: "areaChart",
        title: "Signups over time",
        layout: { x: 1, y: 1, w: 2, h: 2 },
        settings: {
            points: [
                { label: "Jan", value: 120 },
                { label: "Feb", value: 210 },
                { label: "Mar", value: 180 },
                { label: "Apr", value: 320 },
                { label: "May", value: 290 },
                { label: "Jun", value: 410 },
            ],
        },
    },
    {
        id: "channels",
        type: "donutChart",
        title: "Traffic by channel",
        layout: { x: 0, y: 2, w: 1, h: 2 },
        settings: {
            points: [
                { label: "Organic", value: 45 },
                { label: "Paid", value: 25 },
                { label: "Referral", value: 18 },
                { label: "Social", value: 12 },
            ],
        },
    },
    {
        id: "revenue-by-region",
        type: "barChart",
        title: "Revenue by region",
        layout: { x: 0, y: 4, w: 2, h: 2 },
        settings: {
            valueFormat: "currency",
            points: [
                { label: "NA", value: 52000 },
                { label: "EMEA", value: 38000 },
                { label: "APAC", value: 24000 },
                { label: "LATAM", value: 14400 },
            ],
        },
    },
    {
        id: "recent-orders",
        type: "table",
        title: "Recent orders",
        layout: { x: 2, y: 4, w: 1, h: 2 },
        settings: {
            columns: [
                { key: "order", label: "Order" },
                { key: "customer", label: "Customer" },
                { key: "status", label: "Status" },
            ],
            rows: [
                { order: "#1042", customer: "Acme Inc.", status: "Paid" },
                { order: "#1041", customer: "Globex", status: "Pending" },
                { order: "#1040", customer: "Initech", status: "Failed" },
                { order: "#1039", customer: "Umbrella", status: "Paid" },
            ],
        },
    },
    {
        id: "top-customers",
        type: "list",
        title: "Top customers",
        layout: { x: 0, y: 6, w: 1, h: 2 },
        settings: {
            primaryKey: "name",
            secondaryKey: "email",
            valueKey: "spend",
            items: [
                { name: "Olivia Rhye", email: "olivia@acme.com", spend: "$24,500" },
                { name: "Phoenix Baker", email: "phoenix@globex.com", spend: "$18,200" },
                { name: "Lana Steiner", email: "lana@initech.com", spend: "$12,800" },
            ],
        },
    },
    {
        id: "account",
        type: "detail",
        title: "Account",
        layout: { x: 1, y: 6, w: 1, h: 2 },
        settings: {
            fields: [
                { key: "plan", label: "Plan" },
                { key: "seats", label: "Seats" },
                { key: "renews", label: "Renews" },
                { key: "owner", label: "Owner" },
            ],
            record: { plan: "Enterprise", seats: 120, renews: "Jan 1, 2027", owner: "Olivia Rhye" },
        },
    },
    {
        id: "notes",
        type: "markdown",
        title: "Release notes",
        layout: { x: 2, y: 6, w: 1, h: 2 },
        settings: {
            content: "## v2.4\n\nShipped the **Tailwind** rebuild.\n\n- New adapter layer\n- `recharts` charts\n- [Docs](https://example.com)",
        },
    },
    {
        id: "contact",
        type: "form",
        title: "Contact us",
        layout: { x: 0, y: 8, w: 1, h: 2 },
        fields: [
            { name: "name", type: "text", label: "Name", required: true },
            { name: "email", type: "email", label: "Email", required: true },
            { name: "topic", type: "select", label: "Topic", options: [{ label: "Sales", value: "sales" }, { label: "Support", value: "support" }] },
            { name: "subscribe", type: "toggle", label: "Subscribe to updates" },
        ],
    },
    {
        id: "promo",
        type: "card",
        title: "Card",
        layout: { x: 1, y: 8, w: 1, h: 2 },
        settings: {
            eyebrow: "New",
            heading: "Kit-agnostic widgets",
            body: "Every widget renders through a UI-kit adapter, so swapping component libraries is a one-line change.",
            footer: "Powered by Untitled UI",
        },
    },
    {
        id: "overview-tabs",
        type: "tabs",
        title: "Overview",
        layout: { x: 2, y: 8, w: 1, h: 2 },
        settings: {
            tabs: [
                { label: "Summary", content: "Revenue is up 12.5% month over month with churn holding under 2.5%." },
                { label: "Details", content: "NA leads revenue; APAC is the fastest-growing region this quarter." },
                { label: "Notes", content: "Q3 goal at 74% — on track to close by end of period." },
            ],
        },
    },
    {
        id: "cta-button",
        type: "button",
        title: "Get started",
        layout: { x: 0, y: 10, w: 1, h: 1 },
        settings: { label: "Get started" },
        style: { variant: "primary", size: "lg" },
    },
];

export const DashboardScreen = () => {
    return (
        <UiKitProvider adapter={untitledAdapter}>
            <div className="min-h-dvh bg-secondary px-6 py-8">
                <header className="mx-auto mb-6 max-w-7xl">
                    <h1 className="text-display-xs font-semibold text-primary">Dashboard</h1>
                    <p className="mt-1 text-sm text-tertiary">
                        Rendered via the <span className="font-medium text-secondary">{untitledAdapter.name}</span> adapter.
                    </p>
                </header>

                <div className="mx-auto grid max-w-7xl auto-rows-[minmax(140px,auto)] grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {widgets.map((widget) => (
                        <div key={widget.id} className={widget.layout.w >= 3 ? "lg:col-span-3" : widget.layout.w === 2 ? "sm:col-span-2" : ""} style={{ gridRow: `span ${widget.layout.h}` }}>
                            <WidgetView widget={widget} />
                        </div>
                    ))}
                </div>
            </div>
        </UiKitProvider>
    );
};
