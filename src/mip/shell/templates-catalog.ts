/**
 * Dashboard templates — starter dashboards that seed a new page with a set of
 * widgets. Mirrors mip's `data/templates/*`. Each template declares whether it
 * needs API keys (`needsKeys`) and which connectors it auto-configures; the
 * import-confirm modal uses these to show the auto-config note + key warning.
 *
 * Widgets here carry authored settings (mock data). "Connect & Import" is where
 * live connections would be bound later; "Continue with Mock Data" imports as-is.
 */

import type { MipWidget } from "@/mip/schema";
import type { Connection } from "@/mip/settings/settings-store";

export type TemplateCategory = "Analytics" | "Finance" | "Management" | "General" | "Business" | "Marketing";

export interface DashboardTemplate {
    id: string;
    name: string;
    description: string;
    category: TemplateCategory;
    icon: string; // emoji glyph for the card tile
    /** Connectors this template uses; [] means no keys needed. */
    connectors: string[];
    needsKeys: boolean;
    /** Connections the template needs; ensured (added if missing) on import. */
    connectionsSeed?: Connection[];
    widgets: MipWidget[];
}

const L = (x: number, y: number, w: number, h: number): MipWidget["layout"] => ({ x, y, w, h });

export const TEMPLATES: DashboardTemplate[] = [
    {
        id: "analytics",
        name: "Analytics Dashboard",
        description: "Traffic, conversion, and engagement KPIs with trend charts.",
        category: "Analytics",
        icon: "📊",
        connectors: [],
        needsKeys: false,
        widgets: [
            { id: "a-sessions", type: "kpi", title: "Sessions", layout: L(0, 0, 3, 1), settings: { value: 48200, delta: 8.4, deltaLabel: "vs. last week" } },
            { id: "a-conv", type: "kpi", title: "Conversion", layout: L(3, 0, 3, 1), settings: { value: 3.2, valueFormat: "percent", delta: 0.4, deltaLabel: "vs. last week" } },
            { id: "a-bounce", type: "kpi", title: "Bounce rate", layout: L(6, 0, 3, 1), settings: { value: 41.5, valueFormat: "percent", delta: -1.2, deltaLabel: "vs. last week" } },
            { id: "a-avg", type: "kpi", title: "Avg. session", layout: L(9, 0, 3, 1), settings: { value: 184, deltaLabel: "seconds" } },
            { id: "a-trend", type: "areaChart", title: "Traffic over time", layout: L(0, 1, 8, 3), settings: { points: [{ label: "Mon", value: 5200 }, { label: "Tue", value: 6100 }, { label: "Wed", value: 5800 }, { label: "Thu", value: 7200 }, { label: "Fri", value: 6900 }, { label: "Sat", value: 4100 }, { label: "Sun", value: 3800 }] } },
            { id: "a-src", type: "donutChart", title: "Traffic sources", layout: L(8, 1, 4, 3), settings: { points: [{ label: "Organic", value: 52 }, { label: "Direct", value: 23 }, { label: "Referral", value: 15 }, { label: "Social", value: 10 }] } },
        ],
    },
    {
        id: "crypto",
        name: "Crypto Monitor",
        description: "Live prices and market data from Binance & CoinGecko.",
        category: "Finance",
        icon: "🪙",
        connectors: ["Binance", "CoinGecko"],
        needsKeys: false,
        connectionsSeed: [
            { id: "binance", name: "Binance", type: "rest", baseUrl: "https://api.binance.com" },
            { id: "coingecko", name: "CoinGecko", type: "rest", baseUrl: "https://api.coingecko.com" },
        ],
        widgets: [
            // Live: Binance 24h ticker — lastPrice + priceChangePercent.
            {
                id: "c-btc",
                type: "kpi",
                title: "BTC / USD",
                layout: L(0, 0, 4, 1),
                settings: { valueFormat: "currency", deltaLabel: "24h" },
                data: { sourceId: "binance", request: { method: "GET", path: "/api/v3/ticker/24hr", params: { symbol: "BTCUSDT" } }, map: { value: "$.lastPrice", delta: "$.priceChangePercent" } },
            },
            {
                id: "c-eth",
                type: "kpi",
                title: "ETH / USD",
                layout: L(4, 0, 4, 1),
                settings: { valueFormat: "currency", deltaLabel: "24h" },
                data: { sourceId: "binance", request: { method: "GET", path: "/api/v3/ticker/24hr", params: { symbol: "ETHUSDT" } }, map: { value: "$.lastPrice", delta: "$.priceChangePercent" } },
            },
            // Live: CoinGecko global market cap.
            {
                id: "c-cap",
                type: "kpi",
                title: "Market cap",
                layout: L(8, 0, 4, 1),
                settings: { valueFormat: "currency", deltaLabel: "24h" },
                data: { sourceId: "coingecko", request: { method: "GET", path: "/api/v3/global" }, map: { value: "$.data.total_market_cap.usd", delta: "$.data.market_cap_change_percentage_24h_usd" } },
            },
            { id: "c-chart", type: "lineChart", title: "BTC price (7d)", layout: L(0, 1, 12, 3), settings: { valueFormat: "currency", points: [{ label: "D1", value: 64200 }, { label: "D2", value: 65100 }, { label: "D3", value: 63800 }, { label: "D4", value: 66200 }, { label: "D5", value: 66900 }, { label: "D6", value: 67100 }, { label: "D7", value: 67400 }] } },
        ],
    },
    {
        id: "project-tracker",
        name: "Project Tracker",
        description: "Task status, team workload, and milestone progress.",
        category: "Management",
        icon: "✅",
        connectors: [],
        needsKeys: false,
        widgets: [
            { id: "p-open", type: "kpi", title: "Open tasks", layout: L(0, 0, 3, 1), settings: { value: 34 } },
            { id: "p-prog", type: "progress", title: "Sprint progress", layout: L(3, 0, 6, 1), settings: { value: 62, target: 100, label: "62% complete" } },
            { id: "p-done", type: "kpi", title: "Done this week", layout: L(9, 0, 3, 1), settings: { value: 18, delta: 12, deltaLabel: "vs. last week" } },
            { id: "p-tasks", type: "table", title: "Active tasks", layout: L(0, 1, 8, 3), settings: { columns: [{ key: "task", label: "Task" }, { key: "owner", label: "Owner" }, { key: "status", label: "Status" }], rows: [{ task: "Auth refactor", owner: "Olivia", status: "In progress" }, { task: "Billing page", owner: "Phoenix", status: "Review" }, { task: "Onboarding flow", owner: "Lana", status: "Todo" }] } },
            { id: "p-load", type: "barChart", title: "Workload by person", layout: L(8, 1, 4, 3), settings: { points: [{ label: "Olivia", value: 12 }, { label: "Phoenix", value: 9 }, { label: "Lana", value: 7 }] } },
        ],
    },
    {
        id: "sales-report",
        name: "Sales Report",
        description: "Revenue, pipeline, and orders — Shopify / WooCommerce.",
        category: "Business",
        icon: "🛒",
        connectors: ["Shopify"],
        needsKeys: true,
        widgets: [
            { id: "s-rev", type: "kpi", title: "Revenue (MTD)", layout: L(0, 0, 4, 1), settings: { value: 284500, valueFormat: "currency", delta: 9.1, deltaLabel: "vs. last month" } },
            { id: "s-orders", type: "kpi", title: "Orders", layout: L(4, 0, 4, 1), settings: { value: 1320, delta: 4.5, deltaLabel: "vs. last month" } },
            { id: "s-aov", type: "kpi", title: "Avg. order value", layout: L(8, 0, 4, 1), settings: { value: 215, valueFormat: "currency" } },
            { id: "s-chart", type: "barChart", title: "Revenue by month", layout: L(0, 1, 8, 3), settings: { valueFormat: "currency", points: [{ label: "Jan", value: 180000 }, { label: "Feb", value: 210000 }, { label: "Mar", value: 240000 }, { label: "Apr", value: 284500 }] } },
            { id: "s-top", type: "list", title: "Top products", layout: L(8, 1, 4, 3), settings: { primaryKey: "name", secondaryKey: "sales", items: [{ name: "Pro Plan", sales: "$92k" }, { name: "Starter Kit", sales: "$54k" }, { name: "Add-ons", sales: "$31k" }] } },
        ],
    },
    {
        id: "quick-start",
        name: "Quick Start",
        description: "A blank-ish starter with a hero and a couple of KPIs.",
        category: "General",
        icon: "⚡",
        connectors: [],
        needsKeys: false,
        widgets: [
            { id: "q-hero", type: "hero", title: "Welcome", layout: L(0, 0, 12, 2), settings: { heading: "Your new dashboard", subheading: "Add widgets from the toolbar or ask the assistant.", ctaLabel: "Add widget" } },
            { id: "q-k1", type: "kpi", title: "Metric one", layout: L(0, 2, 6, 1), settings: { value: 1000, delta: 5, deltaLabel: "vs. last period" } },
            { id: "q-k2", type: "kpi", title: "Metric two", layout: L(6, 2, 6, 1), settings: { value: 2500, delta: -2, deltaLabel: "vs. last period" } },
        ],
    },
];

export const TEMPLATE_CATEGORIES: Array<"All" | TemplateCategory> = ["All", "Analytics", "Finance", "Management", "General", "Business", "Marketing"];

/** Clone a template's widgets with fresh ids so re-imports don't collide. */
export function cloneTemplateWidgets(template: DashboardTemplate): MipWidget[] {
    const stamp = Date.now().toString(36);
    return template.widgets.map((w, i) => ({ ...w, id: `${template.id}-${stamp}-${i}` }));
}
