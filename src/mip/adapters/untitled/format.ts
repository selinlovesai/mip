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

/** Field/column format ids — mirrors the legacy table-field-formats list. */
export const CELL_FORMATS = [
    { id: "auto", label: "Auto" },
    { id: "text", label: "Text" },
    { id: "number", label: "Number" },
    { id: "currency", label: "Currency" },
    { id: "percent", label: "Percent" },
    { id: "date", label: "Date" },
    { id: "dateTime", label: "Date & time" },
    { id: "month", label: "Month" },
    { id: "year", label: "Year" },
    { id: "duration", label: "Duration (MM:SS)" },
] as const;

const toDate = (raw: unknown): Date | undefined => {
    if (raw == null || raw === "") return undefined;
    // Numeric epoch (seconds or ms) or an ISO/parseable string.
    if (typeof raw === "number" || /^\d+$/.test(String(raw))) {
        const n = Number(raw);
        const d = new Date(n < 1e12 ? n * 1000 : n);
        return Number.isNaN(d.getTime()) ? undefined : d;
    }
    const d = new Date(String(raw));
    return Number.isNaN(d.getTime()) ? undefined : d;
};

/** Format a single cell/field value by an explicit format id. `auto`/`text`/
 *  unset leave the value as-is (so non-numeric strings aren't mangled). */
export function formatCell(raw: unknown, format?: string): string {
    if (raw == null || raw === "") return "";
    if (!format || format === "auto" || format === "text") return String(raw);
    const num = typeof raw === "number" ? raw : Number(raw);
    switch (format) {
        case "number":
            return Number.isFinite(num) ? formatNumber(num) : String(raw);
        case "currency":
        case "percent":
            return formatValue(raw, format);
        case "duration": {
            if (!Number.isFinite(num)) return String(raw);
            const total = Math.round(num);
            const m = Math.floor(total / 60);
            const s = total % 60;
            return `${m}:${String(s).padStart(2, "0")}`;
        }
        case "date":
        case "dateTime":
        case "month":
        case "year": {
            const d = toDate(raw);
            if (!d) return String(raw);
            if (format === "year") return String(d.getFullYear());
            if (format === "month") return d.toLocaleString("en-US", { month: "short", year: "numeric" });
            if (format === "dateTime") return d.toLocaleString();
            return d.toLocaleDateString();
        }
        default:
            return String(raw);
    }
}
