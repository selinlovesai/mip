/**
 * Markdown widget — Untitled UI adapter. Renders Markdown from
 * `settings.content` / `settings.markdown` (or a fetched string payload) inside
 * a Tailwind `prose` container themed for dark mode.
 */

import type { WidgetRenderProps } from "@/mip/adapter/types";
import { markdownToHtml } from "./markdown";
import { WidgetCard } from "./widget-card";

export function MarkdownWidget({ widget, dataState }: WidgetRenderProps) {
    const settings = widget.settings ?? {};
    const fetched = dataState.status === "success" && typeof dataState.data === "string" ? dataState.data : undefined;
    const source = fetched ?? (typeof settings.content === "string" ? settings.content : typeof settings.markdown === "string" ? settings.markdown : "");

    return (
        <WidgetCard title={widget.title}>
            {source.trim() === "" ? (
                <div className="flex flex-1 items-center justify-center text-sm text-tertiary">No content.</div>
            ) : (
                <div
                    className="prose prose-sm dark:prose-invert min-h-0 max-w-none flex-1 overflow-y-auto text-secondary prose-headings:text-primary prose-a:text-brand-secondary"
                    dangerouslySetInnerHTML={{ __html: markdownToHtml(source) }}
                />
            )}
        </WidgetCard>
    );
}
