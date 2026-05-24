/** Small value formatters shared by Untitled widget renderers. */

export function formatNumber(value: number): string {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

export function formatValue(raw: unknown, valueFormat?: string): string {
    if (raw == null || raw === "") return "--";
    const num = typeof raw === "number" ? raw : Number(raw);
    if (valueFormat === "currency" && Number.isFinite(num)) {
        return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(num);
    }
    if (valueFormat === "percent" && Number.isFinite(num)) {
        return `${formatNumber(num)}%`;
    }
    if (Number.isFinite(num)) return formatNumber(num);
    return String(raw);
}
