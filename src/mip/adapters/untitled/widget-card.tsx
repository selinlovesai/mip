/**
 * Shared chrome for Untitled UI widget renderers — the bordered, rounded
 * surface with an optional title that every dashboard widget sits inside.
 * Mirrors the original `WidgetChrome` shell, restyled with Untitled tokens.
 */

import type { ReactNode } from "react";
import { cx } from "@/utils/cx";

export function WidgetCard({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
    return (
        <section className={cx("flex h-full flex-col gap-3 rounded-xl bg-primary p-5 ring-1 ring-secondary", className)}>
            {title ? <h3 className="text-sm font-semibold text-secondary">{title}</h3> : null}
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </section>
    );
}
