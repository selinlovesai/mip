/**
 * Canvas surface — a freeform AI playground in a **sandboxed iframe** that the
 * assistant drives with tools.
 *
 * The iframe runs CANVAS_RUNTIME (injected into its <head>), which performs DOM
 * ops received via postMessage and snapshots the document back. The parent here
 * does the round-trip (id-keyed) and registers `canvasBridge.send` so the chat
 * agent can inject/modify the DOM incrementally. Isolation holds: scripts run in
 * a unique opaque origin (no `allow-same-origin`), with zero access to the app.
 */

import { useEffect, useMemo, useRef } from "react";
import { ALL_COLOR_TOKENS } from "@/mip/design-tokens";
import { useDashboard } from "@/mip/store";
import { canvasBridge } from "./canvas-bridge";
import { CANVAS_RUNTIME, type CanvasOp, type CanvasOpResult } from "./canvas-runtime";

const EXTRA_TOKENS = ["--radius-sm", "--radius-md", "--radius-lg", "--radius-xl", "--shadow-xs", "--shadow-sm", "--shadow-md", "--shadow-lg", "--font-body"];

/** Snapshot the app's design tokens as a :root <style> for use inside the canvas. */
function hostTokenCss(): string {
    if (typeof window === "undefined") return "";
    const cs = getComputedStyle(document.documentElement);
    const decls = [...new Set([...ALL_COLOR_TOKENS, ...EXTRA_TOKENS])]
        .map((n) => {
            const v = cs.getPropertyValue(n).trim();
            return v ? `${n}:${v};` : "";
        })
        .filter(Boolean)
        .join("");
    return decls ? `<style id="mip-tokens">:root{${decls}}</style>` : "";
}

const BASE_STYLE = `<style>:root{color-scheme:light dark}*{box-sizing:border-box}body{margin:0;padding:16px;font-family:var(--font-body,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);line-height:1.5}</style>`;

const HINT = `<div style="height:100vh;display:grid;place-items:center;text-align:center;font-family:system-ui;color:var(--color-text-tertiary,#9aa)"><div style="max-width:24rem"><div style="font-size:15px;font-weight:600;color:var(--color-text-secondary,#bbb)">Freeform AI canvas</div><div style="font-size:13px;margin-top:6px">Ask the assistant to build something — it uses tools to inject components, styles and scripts here, sandboxed from the app.</div></div></div>`;

/** Build the initial iframe document, injecting tokens + the agent runtime. */
function toDocument(html: string): string {
    const inj = `${hostTokenCss()}<script>${CANVAS_RUNTIME}</script>`;
    const trimmed = (html ?? "").trim();
    if (/<\/head>/i.test(trimmed)) return trimmed.replace(/<\/head>/i, `${inj}</head>`);
    if (/<html[\s>]/i.test(trimmed)) return trimmed.replace(/(<html[^>]*>)/i, `$1<head>${inj}</head>`);
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${inj}${BASE_STYLE}</head><body>${trimmed || HINT}</body></html>`;
}

export function CanvasSurface({ html, pageId }: { html: string; pageId: string }) {
    const { setCanvasHtml } = useDashboard();
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const pending = useRef(new Map<string, (r: CanvasOpResult) => void>());
    const ready = useRef<{ promise: Promise<void>; resolve: () => void }>(undefined);
    if (!ready.current) {
        let resolve!: () => void;
        const promise = new Promise<void>((r) => (resolve = r));
        ready.current = { promise, resolve };
    }

    // The initial document is computed once per page (PageBody keys us by id),
    // so agent ops mutate the live iframe without srcDoc resets / reload loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const initialDoc = useMemo(() => toDocument(html ?? ""), [pageId]);

    useEffect(() => {
        const onMessage = (ev: MessageEvent) => {
            const m = ev.data as { __mipCanvas?: boolean; type?: string; id?: string; ok?: boolean; result?: unknown; error?: string; html?: string };
            if (!m || !m.__mipCanvas) return;
            if (m.type === "snapshot") {
                ready.current!.resolve();
                if (typeof m.html === "string") setCanvasHtml(pageId, m.html);
            } else if (m.type === "result" && m.id) {
                const cb = pending.current.get(m.id);
                if (cb) {
                    pending.current.delete(m.id);
                    cb({ ok: !!m.ok, result: m.result, error: m.error });
                }
            }
        };
        window.addEventListener("message", onMessage);

        const send = async (op: CanvasOp): Promise<CanvasOpResult> => {
            await ready.current!.promise;
            const win = iframeRef.current?.contentWindow;
            if (!win) return { ok: false, error: "Canvas not ready." };
            const id = Math.random().toString(36).slice(2);
            return new Promise<CanvasOpResult>((resolve) => {
                pending.current.set(id, resolve);
                win.postMessage({ __mipCanvas: true, type: "op", id, op }, "*");
                setTimeout(() => {
                    if (pending.current.has(id)) {
                        pending.current.delete(id);
                        resolve({ ok: false, error: "Canvas op timed out." });
                    }
                }, 8000);
            });
        };
        canvasBridge.set(send);

        return () => {
            window.removeEventListener("message", onMessage);
            canvasBridge.unset(send);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageId]);

    return (
        <iframe
            ref={iframeRef}
            title="AI canvas"
            // allow-scripts WITHOUT allow-same-origin → scripts run, fully isolated.
            sandbox="allow-scripts allow-forms allow-popups allow-modals"
            srcDoc={initialDoc}
            className="h-full w-full border-0 bg-white"
        />
    );
}
