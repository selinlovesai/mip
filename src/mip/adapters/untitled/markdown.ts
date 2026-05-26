/**
 * Minimal, dependency-free Markdown → HTML for the markdown widget. Supports
 * the common subset (headings, bold/italic, inline code, links, fenced code,
 * unordered/ordered lists, blockquotes, hr, paragraphs). Output is rendered
 * inside a Tailwind `prose` container. Inline HTML in the source is escaped, and
 * link URLs are attribute-escaped + scheme-allowlisted, so this is safe to
 * dangerouslySetInnerHTML even for model- or web-derived text.
 */

function escapeHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Escape a string for use inside a double-quoted HTML attribute. Unlike
 *  escapeHtml, this also neutralizes `"` and `'` so a URL can't break out of the
 *  attribute and inject event handlers (e.g. `[x](" onmouseover="…)`). */
function escapeAttr(text: string): string {
    return escapeHtml(text).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Allow only safe link schemes. Blocks `javascript:`, `data:`, `vbscript:`, etc.
 *  Returns a usable href, or "#" for anything unrecognized. Relative/anchor and
 *  protocol-relative links are permitted; absolute URLs must be http(s)/mailto/tel. */
function safeUrl(url: string): string {
    // Strip control chars + whitespace that browsers ignore before scheme matching
    // (e.g. "java\tscript:") so they can't be used to slip past the scheme guard.
    const normalized = url.trim().replace(/[\x00-\x20\x7f]/g, "");
    if (/^[a-z][a-z0-9+.-]*:/i.test(normalized)) {
        return /^(https?|mailto|tel):/i.test(normalized) ? normalized : "#";
    }
    // No scheme → relative, anchor, query, or protocol-relative; all safe.
    return normalized;
}

function inline(text: string): string {
    return escapeHtml(text)
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, url: string) => `<a href="${escapeAttr(safeUrl(url))}" target="_blank" rel="noreferrer">${label}</a>`);
}

export function markdownToHtml(source: string): string {
    const lines = source.replace(/\r\n/g, "\n").split("\n");
    const html: string[] = [];
    let listType: "ul" | "ol" | null = null;
    let inCode = false;
    const codeBuffer: string[] = [];

    const closeList = () => {
        if (listType) {
            html.push(`</${listType}>`);
            listType = null;
        }
    };

    for (const line of lines) {
        if (line.trim().startsWith("```")) {
            if (inCode) {
                html.push(`<pre><code>${escapeHtml(codeBuffer.join("\n"))}</code></pre>`);
                codeBuffer.length = 0;
                inCode = false;
            } else {
                closeList();
                inCode = true;
            }
            continue;
        }
        if (inCode) {
            codeBuffer.push(line);
            continue;
        }

        const heading = /^(#{1,6})\s+(.*)$/.exec(line);
        if (heading) {
            closeList();
            const level = heading[1].length;
            html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
            continue;
        }

        if (/^\s*[-*]\s+/.test(line)) {
            if (listType !== "ul") {
                closeList();
                html.push("<ul>");
                listType = "ul";
            }
            html.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ""))}</li>`);
            continue;
        }
        if (/^\s*\d+\.\s+/.test(line)) {
            if (listType !== "ol") {
                closeList();
                html.push("<ol>");
                listType = "ol";
            }
            html.push(`<li>${inline(line.replace(/^\s*\d+\.\s+/, ""))}</li>`);
            continue;
        }

        if (/^\s*>\s?/.test(line)) {
            closeList();
            html.push(`<blockquote>${inline(line.replace(/^\s*>\s?/, ""))}</blockquote>`);
            continue;
        }
        if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
            closeList();
            html.push("<hr />");
            continue;
        }
        if (line.trim() === "") {
            closeList();
            continue;
        }

        closeList();
        html.push(`<p>${inline(line)}</p>`);
    }
    closeList();
    if (inCode) html.push(`<pre><code>${escapeHtml(codeBuffer.join("\n"))}</code></pre>`);
    return html.join("\n");
}
