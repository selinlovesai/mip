/**
 * AI assistant panel with three display modes:
 *   - "sidebar": full-height right panel (w-96, border-l), a layout sibling.
 *   - "chat":    floating rounded panel pinned top-right, detached + shadowed.
 *   - "compact": small floating bar showing only the last assistant line + composer.
 *
 * When an AI model connection is configured (Settings → Assistant), sends call
 * the real backend via chat() from "@/mip/api". Otherwise it falls back to a
 * local demo responder with suggestion chips. Assistant replies render as
 * markdown. Enter sends; Shift+Enter newlines.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Expand01, Loading02, Microphone01, LayoutRight, MessageChatCircle, Minimize01, Send01, Settings01, Stars01, StopCircle, X } from "@untitledui/icons";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { TextArea } from "@/components/base/textarea/textarea";
import { chat, fetchPage, testEndpoint, transcribe } from "@/mip/api";
import { canvasBridge } from "./canvas-bridge";
import { CANVAS_TOOLS_DOC, type CanvasOp } from "./canvas-runtime";
import { markdownToHtml } from "@/mip/adapters/untitled/markdown";
import { useSettings } from "@/mip/settings/settings-store";
import { useDashboard } from "@/mip/store";
import { WIDGET_CATALOG, makeWidget } from "./widget-catalog";
import type { MipWidget, WidgetType } from "@/mip/schema";
import { cx } from "@/utils/cx";

type ChatMode = "sidebar" | "chat" | "compact";

interface Message {
    id: string;
    role: "user" | "assistant";
    text: string;
}

const SUGGESTIONS = ["Summarize this dashboard", "Add a bar chart of revenue", "What does the churn metric mean?", "Suggest widgets to add"];

const INTRO = "Hi! I'm your dashboard assistant. Ask me to **add a chart**, summarize your data, or restyle the page.";

function demoRespond(prompt: string, page: string): string {
    return `I'm in demo mode (no AI model connection). On the **${page}** dashboard I can still guide you:\n\n- Add or edit widgets from the **+** toolbar\n- Drag to rearrange in edit mode\n- Open **Settings → Assistant** to pick an AI model connection for live answers\n\n**You said:** "${prompt}"`;
}

const CANVAS_SYSTEM = [
    "You are an agent operating a LIVE sandboxed HTML canvas via tools — you cannot access the host app, only the canvas DOM.",
    "Your tools are REAL and execute on the host, which returns their results to you. You CAN read live web pages and search the web through them — never refuse with 'I can't browse the internet'; instead emit a fetch/search op and the host does it for you.",
    "Build and modify the canvas INCREMENTALLY with tool ops; do NOT dump a whole document. To start a fresh canvas, use a single `replace`. To change parts, use append/insert/setStyle/setText/setAttr/remove/addStyle/runJs, and `query` to inspect first.",
    "DOM tools (op `kind` + args):",
    CANVAS_TOOLS_DOC,
    "Web tools (run outside the canvas, results returned to you):",
    "fetch { url }                          — fetch a web page's readable text (returns {title, text})",
    "search { query }                       — web search via the connected Tavily app (returns results: title/url/content)",
    "Freedom: injected HTML may use any CSS/JS and load external libraries via CDN (fonts, Tailwind Play CDN, chart libraries…).",
    "Design system: tokens are available as CSS vars on :root — --color-brand-600, --color-bg-primary, --color-text-primary, --color-text-secondary, --color-border-secondary, --radius-lg, --shadow-md, --font-body. Use them when asked to match the app.",
    "Workflow: when the user asks to base the canvas on real content (a site, page, or search), CALL search/fetch FIRST and build from the returned content — never invent it.",
    "Build the page with ONE `replace` op holding the full HTML; use append/insert/setStyle/etc. ONLY for later tweaks. NEVER re-add or re-build content you already added.",
    "To fill a form use `setValue` per field; to submit or press something use `click`; to recolor use `setStyle` on body or the relevant selector. These ARE your only way to act — describing an action in prose does nothing.",
    'Protocol: EVERY reply must be ONE ```json block: {"say":"<one short line>","ops":[ {"kind":"...", ...}, ... ]} — never plain prose, never code outside the block. You receive the ops\' results and may continue. As soon as the canvas matches the request, reply with {"say":"<summary>","ops":[]} and STOP.',
].join("\n");

const DASHBOARD_SYSTEM = [
    "You are the dashboard assistant. You manage a LIVE widget dashboard and have REAL tools that execute on the host and return their results to you.",
    "Your fetch/search tools really work — NEVER refuse with 'I can't browse the internet'; emit a fetch or search op and the host runs it, then hands you the data.",
    "Tools (op `kind` + args):",
    "fetch { url }                          — read a web page's readable text (returns {title, text})",
    "search { query }                       — web search via the connected Tavily app (returns results: title/url/content)",
    "listConnections {}                     — list saved data sources/APIs as [{id, name, type, baseUrl, endpoints:[{method,path}]}]. Use this to FIND an API before binding a widget to it.",
    "listWidgets {}                         — list the current widgets on this page as [{id, type, title}]",
    "addWidget { type, title?, settings?, data?, w?, h? } — add a widget. Common types & their settings:",
    "    kpi        settings:{ value, delta?, deltaLabel?, unit?, valueFormat? }",
    "    lineChart|barChart|areaChart|pieChart|donutChart  settings:{ points:[{label,value},…] }",
    "    table      settings:{ columns:[{key,label},…], rows:[{…},…] }",
    "    list       settings:{ primaryKey, secondaryKey?, items:[{…},…] }",
    "    markdown   settings:{ content }   ·   card  settings:{ heading, body }",
    "    progress   settings:{ value, target, label? }",
    "LIVE REST data: bind a widget to a saved connection with data:{ sourceId:<connection id>, request:{ method, path, params?, headers?, body? }, map?:{…}, refreshMs? }.",
    "    · the connection supplies baseUrl + auth; `path` is appended to baseUrl (or an absolute URL).",
    "    · `map` is JSONPath ($.a.b[0].c) from the response: charts → { series:\"$.path.to.array\" } (+ settings.labelKey / settings.valueKey for the fields); kpi → { value:\"$.x\", delta:\"$.y\" }.",
    "    · set refreshMs (e.g. 10000) to poll. A bound widget fetches live and ignores static settings once data loads.",
    "removeWidget { id }                    — remove a widget by id (use listWidgets first)",
    "Workflow: to build a widget from an API, call listConnections FIRST to find the right sourceId + endpoint, then addWidget with a `data` binding. For one-off numbers from the open web, fetch/search and put the RETURNED values into settings. Never invent figures or connection ids.",
    "When the request is just a question (no dashboard change), answer it in `say` with ops:[]. Markdown is supported in `say`.",
    'Protocol: EVERY reply is ONE JSON object {"say":"<short message>","ops":[ {"kind":"…", …}, … ]} — no prose outside it. You receive each op\'s result and may continue. When the dashboard matches the request (or you\'ve answered), reply with {"say":"…","ops":[]} and STOP. Describing an action in prose does NOTHING — only ops change the dashboard.',
].join("\n");

/** Parse an agent reply into {say, ops} — tolerant of fences, surrounding prose,
 *  or a bare ops array. Returns null only if no JSON tool payload is found. */
function parseCanvasReply(text: string): { say?: string; ops: CanvasOp[] } | null {
    const candidates: string[] = [];
    const fence = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/i);
    if (fence) candidates.push(fence[1]!);
    const obj = text.match(/\{[\s\S]*"ops"[\s\S]*\}/); // object containing "ops", even unfenced
    if (obj) candidates.push(obj[0]);
    const arr = text.match(/\[[\s\S]*\]/); // a bare ops array
    if (arr) candidates.push(arr[0]);
    candidates.push(text.trim());
    for (const c of candidates) {
        try {
            const o = JSON.parse(c.trim()) as { say?: unknown; ops?: unknown } | unknown[];
            if (Array.isArray(o)) return { ops: o as CanvasOp[] };
            if (o && typeof o === "object" && "ops" in o) return { say: typeof o.say === "string" ? o.say : undefined, ops: Array.isArray(o.ops) ? (o.ops as CanvasOp[]) : [] };
        } catch {
            /* try next candidate */
        }
    }
    return null;
}

const DEMO_CANVAS_HTML = `<div style="font:600 20px system-ui;display:grid;place-items:center;height:100vh;background:linear-gradient(135deg,#7f56d9,#2e90fa);color:#fff">Hello from your AI canvas 👋<br><small style="font-weight:400;opacity:.85">Connect an AI model in Settings → Assistant to build from your prompts.</small></div>`;

/**
 * Borderless composer textarea that auto-grows with its content, pushing the
 * row taller (icons ride to the top) up to ~2/5 of the enclosing chat panel
 * ([data-chat-panel]); past that it scrolls.
 */
function ComposerTextarea({ value, onChange, onKeyDown }: { value: string; onChange: (v: string) => void; onKeyDown: (e: React.KeyboardEvent) => void }) {
    const ref = useRef<HTMLTextAreaElement>(null);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const panel = el.closest("[data-chat-panel]") as HTMLElement | null;
        const max = Math.round((panel?.clientHeight ?? window.innerHeight) * 0.4);
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, max)}px`;
        el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
    }, [value]);
    return (
        <textarea
            ref={ref}
            aria-label="Message"
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask anything…"
            className="min-w-0 flex-1 resize-none bg-transparent px-3 py-2.5 text-xs leading-4 text-primary outline-none placeholder:text-placeholder"
        />
    );
}

const introMessage: Message = { id: "intro", role: "assistant", text: INTRO };

export function ChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { activePage, addWidget, removeWidget } = useDashboard();
    const { assistant, aiConnections, connections, getConnection, setAssistant } = useSettings();
    const [mode, setMode] = useState<ChatMode>("sidebar");
    // Conversations are scoped per page (dashboard/canvas) — switching the active
    // page swaps to that page's own session.
    const [sessions, setSessions] = useState<Record<string, Message[]>>({});
    const pageId = activePage.id;
    const messages = sessions[pageId] ?? [introMessage];
    const setMessages = (updater: Message[] | ((prev: Message[]) => Message[])) =>
        setSessions((s) => {
            const cur = s[pageId] ?? [introMessage];
            return { ...s, [pageId]: typeof updater === "function" ? updater(cur) : updater };
        });
    const [draft, setDraft] = useState("");
    const [thinking, setThinking] = useState(false);
    const [acfgOpen, setAcfgOpen] = useState(false);
    const [recording, setRecording] = useState(false);
    const [transcribing, setTranscribing] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    // The configured AI connection (from Settings → Assistant), if any.
    const conn = useMemo(() => {
        if (assistant.connectionId) return getConnection(assistant.connectionId);
        return aiConnections[0];
    }, [assistant.connectionId, aiConnections, getConnection]);

    const headerLabel = conn?.name ?? "No AI connection";

    useEffect(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }, [messages, open, mode, thinking]);

    const pushAssistant = (text: string) =>
        setMessages((prev) => [...prev, { id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, role: "assistant", text }]);

    type ApiMsg = { role: "user" | "assistant" | "system"; content: string };

    const callModel = (messages: ApiMsg[], system?: string, jsonMode?: boolean) =>
        chat({
            provider: conn!.aiProvider ?? "openai",
            baseUrl: conn!.baseUrl ?? "",
            apiKey: conn!.auth?.token ?? conn!.auth?.keyValue,
            model: assistant.model ?? conn!.aiModel ?? "gpt-4o-mini",
            messages,
            system,
            jsonMode,
        });

    // Canvas agent loop: the model emits {say, ops[]}; we run the ops through the
    // canvas runtime, feed results back, and iterate (capped) — real tool use,
    // not whole-document dumps.
    const tavily = connections.find((c) => /tavily/i.test(c.baseUrl ?? ""));

    // Web tools shared by both the canvas and dashboard agents — they run on the
    // host (server-side fetch / Tavily search) and return data to the model.
    // Returns null when `op` is not a web tool, so callers can fall through.
    const runWebOp = async (op: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
        const kind = op.kind as string;
        if (kind === "fetch" && typeof op.url === "string") {
            const r = await fetchPage(op.url);
            return { kind, url: op.url, ok: r.ok, title: r.title, text: (r.text ?? "").slice(0, 4000), ...(r.error ? { error: String(r.error) } : {}) };
        }
        if (kind === "search") {
            if (!tavily?.auth?.token) return { kind, ok: false, error: "No Tavily connection — add one in Settings → Apps." };
            const r = await testEndpoint({
                method: "POST",
                url: `${(tavily.baseUrl ?? "https://api.tavily.com").replace(/\/$/, "")}/search`,
                headers: { Authorization: `Bearer ${tavily.auth.token}` },
                body: { query: op.query, max_results: 5, search_depth: "basic" },
            });
            const body = r.body as { results?: Array<{ title?: string; url?: string; content?: string }> } | undefined;
            return {
                kind,
                ok: r.ok,
                ...(r.ok && body?.results ? { results: body.results.map((x) => ({ title: x.title, url: x.url, content: (x.content ?? "").slice(0, 400) })) } : {}),
                ...(r.ok ? {} : { error: typeof r.error === "string" ? r.error : `status ${r.status ?? "?"}` }),
            };
        }
        return null;
    };

    const runOp = async (op: Record<string, unknown>): Promise<Record<string, unknown>> => {
        const web = await runWebOp(op);
        if (web) return web;
        const r = await canvasBridge.send(op as CanvasOp);
        return { kind: op.kind as string, ok: r.ok, ...(r.error ? { error: r.error } : {}), ...(r.result !== undefined ? { result: r.result } : {}) };
    };

    // Dashboard agent ops: web tools + live widget add/remove/list against the store.
    const runDashboardOp = async (op: Record<string, unknown>): Promise<Record<string, unknown>> => {
        const web = await runWebOp(op);
        if (web) return web;
        const kind = op.kind as string;
        if (kind === "listConnections") {
            return {
                kind,
                ok: true,
                connections: connections.map((c) => ({
                    id: c.id,
                    name: c.name,
                    type: c.type,
                    baseUrl: c.baseUrl,
                    endpoints: (c.endpoints ?? []).map((e) => ({ method: e.method, path: e.path })),
                })),
            };
        }
        if (kind === "listWidgets") {
            return { kind, ok: true, widgets: activePage.widgets.map((w) => ({ id: w.id, type: w.type, title: w.title })) };
        }
        if (kind === "addWidget") {
            const type = op.type as WidgetType;
            const base = WIDGET_CATALOG.find((c) => c.type === type);
            if (!base) return { kind, ok: false, error: `Unknown widget type "${String(type)}". Pick one from the documented list.` };
            const widget = makeWidget({
                ...base,
                ...(typeof op.title === "string" ? { label: op.title } : {}),
                ...(typeof op.w === "number" ? { w: op.w } : {}),
                ...(typeof op.h === "number" ? { h: op.h } : {}),
                ...(op.settings && typeof op.settings === "object" ? { settings: { ...base.settings, ...(op.settings as Record<string, unknown>) } } : {}),
            });
            // Optional live REST binding → resolved by useWidgetData against the connection.
            if (op.data && typeof op.data === "object") {
                const d = op.data as { sourceId?: unknown };
                if (typeof d.sourceId === "string" && !connections.some((c) => c.id === d.sourceId)) {
                    return { kind, ok: false, error: `No connection with id "${d.sourceId}". Call listConnections and use a real id.` };
                }
                widget.data = op.data as MipWidget["data"];
            }
            addWidget(widget);
            return { kind, ok: true, id: widget.id, type: widget.type, bound: !!widget.data };
        }
        if (kind === "removeWidget" && typeof op.id === "string") {
            removeWidget(op.id);
            return { kind, ok: true, removed: op.id };
        }
        return { kind, ok: false, error: `Unknown op "${kind}".` };
    };

    // Shared agent loop: the model emits {say, ops[]}, we run each op through the
    // surface-specific runner, feed results back, and iterate (capped). Used by
    // both the canvas (DOM ops) and the dashboard (widget + web ops).
    const runAgent = async (
        initial: ApiMsg[],
        opts: { system: string; runner: (op: Record<string, unknown>) => Promise<Record<string, unknown>>; surface: string },
    ) => {
        const sys = [opts.system, activePage.systemPrompt ?? "", assistant.systemPrompt ?? ""].filter(Boolean).join("\n\n");
        let msgs = initial.slice();
        let nudged = false;
        // JSON mode forces an object response on OpenAI-compatible providers, so
        // the model can't reply with a prose refusal instead of emitting ops.
        const jsonMode = (conn?.aiProvider ?? "openai") !== "anthropic";
        for (let round = 0; round < 8; round++) {
            const result = await callModel(msgs, sys, jsonMode);
            if (!result.ok) {
                pushAssistant(`**Couldn't reach the model.**\n\n${typeof result.error === "string" ? result.error : "Request failed."}`);
                return;
            }
            const text = result.content ?? "";
            const parsed = parseCanvasReply(text);
            if (!parsed) {
                // Model narrated instead of emitting tools — nudge it once.
                if (!nudged) {
                    nudged = true;
                    msgs = [
                        ...msgs,
                        { role: "assistant", content: text },
                        { role: "user", content: 'Do NOT refuse and do NOT explain limitations — your fetch/search and surface tools are real and run on the host. Reply with ONLY a JSON object {"say":"…","ops":[…]}. Use ops to ACTUALLY act (fetch/search for live data, then build/modify). Describing an action does nothing.' },
                    ];
                    continue;
                }
                pushAssistant(text);
                return;
            }
            if (parsed.say) pushAssistant(parsed.say);
            if (!parsed.ops.length) return;
            const results: unknown[] = [];
            for (const op of parsed.ops as Array<Record<string, unknown>>) results.push(await opts.runner(op));
            msgs = [
                ...msgs,
                { role: "assistant", content: text },
                { role: "user", content: "Tool results:\n```json\n" + JSON.stringify(results).slice(0, 4000) + `\n\`\`\`\nIf the ${opts.surface} already matches the request, reply with {"say":"<summary>","ops":[]}. Otherwise continue — do not re-add anything already present.` },
            ];
        }
        pushAssistant(`Reached the ${opts.surface} step limit.`);
    };

    const sendText = async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || thinking) return;
        setDraft("");

        const isCanvas = activePage.kind === "canvas";
        const userMsg: Message = { id: `u-${Date.now()}`, role: "user", text: trimmed };
        const history = [...messages, userMsg];
        setMessages(history);

        // No connection → demo (canvas renders a sample via the runtime).
        if (!conn) {
            if (isCanvas) {
                await canvasBridge.send({ kind: "replace", html: DEMO_CANVAS_HTML });
                pushAssistant("Rendered a demo canvas. Connect an AI model in **Settings → Assistant** to build from your prompts.");
            } else {
                pushAssistant(demoRespond(trimmed, activePage.title));
            }
            return;
        }

        setThinking(true);
        const apiMessages: ApiMsg[] = history.filter((m) => m.id !== "intro").map((m) => ({ role: m.role, content: m.text }));

        // Fetch any URLs in the prompt and feed their content to the model.
        const urls = trimmed.match(/https?:\/\/[^\s)]+/g)?.slice(0, 2) ?? [];
        if (urls.length) {
            const pages = await Promise.all(urls.map((u) => fetchPage(u)));
            const ctx = pages
                .filter((p) => p.ok && p.text)
                .map((p) => `\n\n[Fetched content from ${p.url}${p.title ? ` — ${p.title}` : ""}]\n${p.text}`)
                .join("");
            if (ctx) {
                const last = apiMessages[apiMessages.length - 1];
                if (last) last.content = `${last.content}${ctx}`;
            }
        }

        if (isCanvas) {
            await runAgent(apiMessages, { system: CANVAS_SYSTEM, runner: runOp, surface: "canvas" });
        } else {
            await runAgent(apiMessages, { system: DASHBOARD_SYSTEM, runner: runDashboardOp, surface: "dashboard" });
        }
        setThinking(false);
    };

    // --- Voice input: record via MediaRecorder, transcribe with local Whisper ---
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            chunksRef.current = [];
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };
            recorder.onstop = async () => {
                stream.getTracks().forEach((t) => t.stop());
                const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
                setTranscribing(true);
                const res = await transcribe(blob);
                setTranscribing(false);
                if (res.ok && res.text) {
                    setDraft((d) => (d ? `${d} ${res.text}` : res.text!));
                } else {
                    const msg = typeof res.error === "string" ? res.error : "Transcription failed.";
                    setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", text: `🎤 ${msg}` }]);
                }
            };
            recorderRef.current = recorder;
            recorder.start();
            setRecording(true);
        } catch {
            setRecording(false);
            setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", text: "🎤 Microphone access was denied or is unavailable." }]);
        }
    };

    const toggleRecording = () => {
        if (recording) {
            recorderRef.current?.stop();
            setRecording(false);
        } else {
            void startRecording();
        }
    };

    if (!open) return null;

    const showSuggestions = !conn && messages.length <= 1;
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

    // ---- Header (shared by sidebar + chat) ----
    const header = (
        <div className="flex items-center justify-between border-b border-secondary px-4 py-3.5">
            <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-brand-solid">
                    <Stars01 className="size-4 text-white" />
                </span>
                <div className="flex flex-col leading-tight">
                    <h2 className="text-sm font-semibold text-primary">AI assistant</h2>
                    <span className="text-xs text-tertiary">{conn ? headerLabel : "No AI connection"}</span>
                </div>
            </div>
            <ButtonUtility color="tertiary" size="xs" icon={X} tooltip="Close assistant" onClick={onClose} />
        </div>
    );

    // ---- Message list (shared by sidebar + chat) ----
    const messageList = (
        <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.map((msg) =>
                msg.role === "user" ? (
                    <div key={msg.id} className="flex justify-end">
                        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-brand-solid px-3.5 py-2.5 text-xs leading-4 text-white">{msg.text}</div>
                    </div>
                ) : (
                    <div key={msg.id} className="flex gap-2.5">
                        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-utility-brand-50">
                            <Stars01 className="size-3.5 text-utility-brand-700" />
                        </span>
                        <div
                            className="prose prose-sm dark:prose-invert max-w-[85%] rounded-2xl rounded-tl-sm bg-secondary px-3.5 py-2.5 text-xs text-secondary prose-headings:text-primary prose-strong:text-primary prose-a:text-brand-secondary prose-p:text-xs prose-p:leading-4 prose-p:my-1.5 prose-li:text-xs prose-li:leading-4 prose-li:my-0.5 prose-ul:my-1.5 prose-ol:my-1.5"
                            dangerouslySetInnerHTML={{ __html: markdownToHtml(msg.text) }}
                        />
                    </div>
                ),
            )}

            {thinking ? (
                <div className="flex gap-2.5">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-utility-brand-50">
                        <Stars01 className="size-3.5 text-utility-brand-700" />
                    </span>
                    <div className="rounded-2xl rounded-tl-sm bg-secondary px-3.5 py-2.5 text-xs text-tertiary">thinking…</div>
                </div>
            ) : null}

            {showSuggestions ? (
                <div className="flex flex-col gap-2 pt-1">
                    {SUGGESTIONS.map((s) => (
                        <button
                            key={s}
                            onClick={() => void sendText(s)}
                            className="rounded-lg bg-secondary px-3 py-2 text-left text-xs text-secondary ring-1 ring-secondary transition-colors hover:ring-brand"
                        >
                            {s}
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );

    // ---- Mode toolbar (shared by every footer) ----
    const modeToolbar = (
        <div className="flex items-center gap-1">
            <ButtonUtility
                size="xs"
                color="tertiary"
                icon={LayoutRight}
                tooltip="Sidebar"
                onClick={() => setMode("sidebar")}
                className={cx(mode === "sidebar" && "bg-active text-fg-brand-primary")}
            />
            <ButtonUtility
                size="xs"
                color="tertiary"
                icon={MessageChatCircle}
                tooltip="Floating chat"
                onClick={() => setMode("chat")}
                className={cx(mode === "chat" && "bg-active text-fg-brand-primary")}
            />
            <ButtonUtility
                size="xs"
                color="tertiary"
                icon={mode === "compact" ? Expand01 : Minimize01}
                tooltip={mode === "compact" ? "Expand" : "Compact"}
                onClick={() => setMode(mode === "compact" ? "sidebar" : "compact")}
                className={cx(mode === "compact" && "bg-active text-fg-brand-primary")}
            />
            <span className="mx-0.5 h-4 w-px bg-border-secondary" />
            <ButtonUtility
                size="xs"
                color="tertiary"
                icon={Settings01}
                tooltip="Assistant settings"
                className={cx(acfgOpen && "bg-active text-fg-brand-primary")}
                onClick={() => setAcfgOpen((v) => !v)}
            />
        </div>
    );

    // ---- Assistant Settings popover (provider/model + callable connections) ----
    const callableIds = assistant.callableConnectionIds ?? [];
    const toggleCallable = (id: string, on: boolean) =>
        setAssistant({ callableConnectionIds: on ? [...new Set([...callableIds, id])] : callableIds.filter((c) => c !== id) });

    const assistantSettingsPopover = acfgOpen ? (
        <>
            <button type="button" aria-label="Close assistant settings" className="fixed inset-0 z-[60] cursor-default" onClick={() => setAcfgOpen(false)} />
            <div className="fixed top-16 right-4 z-[61] flex max-h-[70vh] w-80 max-w-[calc(100vw-2rem)] flex-col gap-4 overflow-y-auto rounded-xl bg-primary p-4 shadow-xl ring-1 ring-secondary">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-primary">Assistant Settings</h3>
                    <ButtonUtility size="xs" color="tertiary" icon={X} tooltip="Close" onClick={() => setAcfgOpen(false)} />
                </div>

                <section className="flex flex-col gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-quaternary">AI provider</span>
                    {aiConnections.length === 0 ? (
                        <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-tertiary ring-1 ring-secondary">No AI-model connections. Add one in Settings → Connections (toggle “provides an AI model”).</p>
                    ) : (
                        <>
                            <Select
                                label="Connection"
                                selectedKey={conn?.id}
                                items={aiConnections.map((c) => ({ id: c.id, label: c.name }))}
                                onSelectionChange={(key) => setAssistant({ connectionId: String(key) })}
                            >
                                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                            </Select>
                            <Input
                                label="Model"
                                value={assistant.model ?? conn?.aiModel ?? ""}
                                onChange={(v) => setAssistant({ model: v })}
                                placeholder="gpt-4o-mini / deepseek-chat"
                            />
                            <p className="text-xs text-tertiary">Used automatically on send — no apply button.</p>
                        </>
                    )}
                </section>

                <section className="flex flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-quaternary">Connections the assistant can call</span>
                    {connections.length === 0 ? (
                        <p className="text-xs text-tertiary">No connections yet.</p>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {connections.map((c) => (
                                <label key={c.id} className="flex items-start gap-2.5 rounded-lg p-2 ring-1 ring-secondary">
                                    <Checkbox isSelected={callableIds.includes(c.id)} onChange={(on) => toggleCallable(c.id, on)} />
                                    <span className="flex min-w-0 flex-col">
                                        <span className="truncate text-sm font-medium text-secondary">{c.name}</span>
                                        {c.baseUrl ? <span className="truncate font-mono text-xs text-tertiary">{c.baseUrl}</span> : <span className="text-xs text-tertiary">{c.type}</span>}
                                    </span>
                                </label>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </>
    ) : null;

    const onComposerKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void sendText(draft);
        }
    };

    // ---- Mic (voice input) button, shared by every composer ----
    const micButton = (
        <button
            type="button"
            aria-label={recording ? "Stop recording" : "Record voice"}
            disabled={transcribing}
            onClick={toggleRecording}
            className={cx(
                "flex items-center justify-center px-2 py-2.5 transition-colors disabled:opacity-40",
                recording ? "text-utility-red-500" : "text-tertiary hover:text-secondary",
            )}
        >
            {transcribing ? (
                <Loading02 className="size-4 animate-spin" />
            ) : recording ? (
                <StopCircle className="size-4 animate-pulse" />
            ) : (
                <Microphone01 className="size-4" />
            )}
        </button>
    );

    // ---- Composer footer (shared by sidebar + chat) ----
    const footer = (
        <div className="flex flex-col border-t border-secondary">
            <div className="px-3 py-2">{modeToolbar}</div>
            <div className="flex items-start border-t border-secondary">
                <ComposerTextarea value={draft} onChange={setDraft} onKeyDown={onComposerKeyDown} />
                {micButton}
                <button
                    type="button"
                    aria-label="Send"
                    disabled={!draft.trim() || thinking}
                    onClick={() => void sendText(draft)}
                    className="flex items-center px-3 py-2.5 text-tertiary transition-colors hover:text-secondary disabled:opacity-40"
                >
                    <Send01 className="size-4" />
                </button>
            </div>
        </div>
    );

    // ---- COMPACT mode ----
    if (mode === "compact") {
        return (
            <div className="fixed right-0 top-0 z-50 flex w-90 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-l-xl rounded-br-xl border-b border-l border-secondary bg-primary shadow-xl">
                <div className="flex items-center justify-between gap-2 border-b border-secondary px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-solid">
                            <Stars01 className="size-3 text-white" />
                        </span>
                        <span className="truncate text-xs font-medium text-secondary">{conn ? headerLabel : "No AI connection"}</span>
                    </div>
                    <div className="flex items-center gap-1">{modeToolbar}</div>
                </div>
                {lastAssistant ? (
                    <div
                        className="prose prose-sm dark:prose-invert line-clamp-3 max-h-24 overflow-hidden px-3 py-2 text-xs text-secondary prose-headings:text-primary prose-strong:text-primary prose-a:text-brand-secondary prose-p:text-xs prose-p:leading-4 prose-p:my-1 prose-li:text-xs prose-li:leading-4"
                        dangerouslySetInnerHTML={{ __html: markdownToHtml(thinking ? "thinking…" : lastAssistant.text) }}
                    />
                ) : null}
                <div className="flex items-stretch border-t border-secondary">
                    <TextArea
                        aria-label="Message"
                        size="sm"
                        rows={1}
                        value={draft}
                        onChange={setDraft}
                        onKeyDown={onComposerKeyDown}
                        placeholder="Ask anything…"
                        className="flex-1"
                        textAreaClassName="max-h-20 resize-none rounded-none border-0 shadow-none ring-0 text-xs leading-4 focus:ring-0"
                    />
                    {micButton}
                    <button
                        type="button"
                        aria-label="Send"
                        disabled={!draft.trim() || thinking}
                        onClick={() => void sendText(draft)}
                        className="flex items-center px-3 text-tertiary transition-colors hover:text-secondary disabled:opacity-40"
                    >
                        <Send01 className="size-4" />
                    </button>
                </div>
                {assistantSettingsPopover}
            </div>
        );
    }

    // ---- FLOATING CHAT mode ----
    if (mode === "chat") {
        return (
            <div data-chat-panel className="fixed right-0 top-0 z-50 flex h-[560px] max-h-[calc(100vh-1rem)] w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-l-2xl rounded-br-2xl border-b border-l border-secondary bg-primary shadow-xl">
                {header}
                {messageList}
                {footer}
                {assistantSettingsPopover}
            </div>
        );
    }

    // ---- SIDEBAR mode (default) ----
    return (
        <aside data-chat-panel className="flex w-80 shrink-0 flex-col border-l border-secondary bg-primary">
            {header}
            {messageList}
            {footer}
            {assistantSettingsPopover}
        </aside>
    );
}
