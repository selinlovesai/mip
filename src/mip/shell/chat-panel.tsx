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
import { Expand01, Loading02, Microphone01, LayoutRight, MessageChatCircle, Minimize01, Send01, Stars01, StopCircle, X } from "@untitledui/icons";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { TextArea } from "@/components/base/textarea/textarea";
import { chat, fetchPage, testEndpoint, transcribe } from "@/mip/api";
import { canvasBridge } from "./canvas-bridge";
import { markdownToHtml } from "@/mip/adapters/untitled/markdown";
import { useSettings, type Connection } from "@/mip/settings/settings-store";
import { useDashboard } from "@/mip/store";
import { buildSystemPrompt, resolveSkills, runAgent, type ApiMsg, type Brain, type ToolContext } from "@/mip/agent";
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
    const { activePage, addWidget, removeWidget, updatePageSettings } = useDashboard();
    const { assistant, aiConnections, connections, getConnection, skills } = useSettings();
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
    const [recording, setRecording] = useState(false);
    const [transcribing, setTranscribing] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    // Effective AI connection: the dashboard's own choice, else the global
    // default (Settings → Assistant), else the first AI connection.
    const conn = useMemo(() => {
        const id = activePage.agent?.connectionId ?? assistant.connectionId;
        if (id) return getConnection(id);
        return aiConnections[0];
    }, [activePage.agent?.connectionId, assistant.connectionId, aiConnections, getConnection]);

    const headerLabel = conn?.name ?? "No AI connection";

    useEffect(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }, [messages, open, mode, thinking]);

    const pushAssistant = (text: string) =>
        setMessages((prev) => [...prev, { id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, role: "assistant", text }]);

    const tavily = connections.find((c) => /tavily/i.test(c.baseUrl ?? ""));

    // Resolve a connection from whatever the model passed — its id, name (exact or
    // partial), or a baseUrl substring — since models often pass the human name.
    const resolveConnection = (ref: unknown): Connection | undefined => {
        const r = String(ref ?? "").trim().toLowerCase();
        if (!r) return undefined;
        return (
            connections.find((c) => c.id.toLowerCase() === r) ??
            connections.find((c) => c.name.toLowerCase() === r) ??
            connections.find((c) => c.name.toLowerCase().includes(r) || r.includes(c.name.toLowerCase())) ??
            connections.find((c) => (c.baseUrl ?? "").toLowerCase().includes(r))
        );
    };

    // The Brain — one chat completion. JSON mode (OpenAI-compatible only) forces an
    // object reply so the model can't refuse with prose.
    const brain: Brain = (msgs, system, jsonMode) =>
        chat({
            provider: conn!.aiProvider ?? "openai",
            baseUrl: conn!.baseUrl ?? "",
            apiKey: conn!.auth?.token ?? conn!.auth?.keyValue,
            model: activePage.agent?.model ?? assistant.model ?? conn!.aiModel ?? "gpt-4o-mini",
            messages: msgs,
            system,
            jsonMode,
        });

    // The connections this dashboard's agent may use as tools. Undefined list ⇒
    // all connections; otherwise only the dashboard-allowed subset.
    const allowedIds = activePage.agent?.callableConnectionIds;
    const allowedConnections = allowedIds ? connections.filter((c) => allowedIds.includes(c.id)) : connections;

    // Everything the tools need from the live app, rebuilt per send. Tools only
    // ever see the dashboard-allowed connections.
    const toolContext = (): ToolContext => ({
        fetchPage,
        testEndpoint,
        connections: allowedConnections,
        resolveConnection: (ref) => {
            const c = resolveConnection(ref);
            return c && allowedConnections.some((a) => a.id === c.id) ? c : undefined;
        },
        tavily: allowedConnections.some((c) => c.id === tavily?.id) ? tavily : undefined,
        canvasSend: (op) => canvasBridge.send(op),
        listWidgets: () => activePage.widgets.map((w) => ({ id: w.id, type: w.type, title: w.title })),
        addWidget,
        removeWidget,
        getContext: () => activePage.systemPrompt ?? "",
        setContext: (val) => updatePageSettings(activePage.id, { systemPrompt: val }),
    });

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

        const surface = isCanvas ? "canvas" : "dashboard";
        // Skills active for THIS dashboard (native on-by-default minus disabled,
        // plus opted-in custom), filtered to the surface. Context is injected at
        // the TOP of the prompt (see buildSystemPrompt).
        const activeSkills = resolveSkills(skills, activePage.agent, surface).map((s) => s.content);
        const system = buildSystemPrompt(surface, { pageContext: activePage.systemPrompt, assistantContext: assistant.systemPrompt, skills: activeSkills });
        const jsonMode = (conn.aiProvider ?? "openai") !== "anthropic";
        await runAgent({ initial: apiMessages, surface, system, jsonMode, brain, ctx: toolContext(), say: pushAssistant });
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
        </div>
    );

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
            </div>
        );
    }

    // ---- SIDEBAR mode (default) ----
    return (
        <aside data-chat-panel className="flex w-80 shrink-0 flex-col border-l border-secondary bg-primary">
            {header}
            {messageList}
            {footer}
        </aside>
    );
}
