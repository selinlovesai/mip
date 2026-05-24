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

import { useEffect, useMemo, useRef, useState } from "react";
import { Expand01, LayoutRight, MessageChatCircle, Minimize01, Send01, Settings01, Stars01, X } from "@untitledui/icons";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { TextArea } from "@/components/base/textarea/textarea";
import { chat } from "@/mip/api";
import { markdownToHtml } from "@/mip/adapters/untitled/markdown";
import { useSettings } from "@/mip/settings/settings-store";
import { useDashboard } from "@/mip/store";
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

export function ChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { activePage } = useDashboard();
    const { assistant, aiConnections, connections, getConnection, setAssistant } = useSettings();
    const [mode, setMode] = useState<ChatMode>("sidebar");
    const [messages, setMessages] = useState<Message[]>([{ id: "intro", role: "assistant", text: INTRO }]);
    const [draft, setDraft] = useState("");
    const [thinking, setThinking] = useState(false);
    const [acfgOpen, setAcfgOpen] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);

    // The configured AI connection (from Settings → Assistant), if any.
    const conn = useMemo(() => {
        if (assistant.connectionId) return getConnection(assistant.connectionId);
        return aiConnections[0];
    }, [assistant.connectionId, aiConnections, getConnection]);

    const headerLabel = conn?.name ?? "No AI connection";

    useEffect(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }, [messages, open, mode, thinking]);

    const sendText = async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || thinking) return;
        setDraft("");

        const userMsg: Message = { id: `u-${Date.now()}`, role: "user", text: trimmed };
        const history = [...messages, userMsg];
        setMessages(history);

        // No connection → local demo responder.
        if (!conn) {
            const reply: Message = { id: `a-${Date.now()}`, role: "assistant", text: demoRespond(trimmed, activePage.title) };
            setMessages((prev) => [...prev, reply]);
            return;
        }

        setThinking(true);
        const apiMessages = history
            .filter((m) => m.id !== "intro")
            .map((m) => ({ role: m.role, content: m.text }));

        const result = await chat({
            provider: conn.aiProvider ?? "openai",
            baseUrl: conn.baseUrl ?? "",
            apiKey: conn.auth?.token ?? conn.auth?.keyValue,
            model: assistant.model ?? conn.aiModel ?? "gpt-4o-mini",
            messages: apiMessages,
            system: assistant.systemPrompt,
        });

        setThinking(false);
        const text2 =
            result.ok && result.content
                ? result.content
                : `**Couldn't reach the model.**\n\n${typeof result.error === "string" ? result.error : "The request failed. Check the connection's base URL and API key in Settings."}`;
        setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", text: text2 }]);
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
                        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-brand-solid px-3.5 py-2.5 text-sm text-white">{msg.text}</div>
                    </div>
                ) : (
                    <div key={msg.id} className="flex gap-2.5">
                        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-utility-brand-50">
                            <Stars01 className="size-3.5 text-utility-brand-700" />
                        </span>
                        <div
                            className="prose prose-sm dark:prose-invert max-w-[85%] rounded-2xl rounded-tl-sm bg-secondary px-3.5 py-2.5 text-secondary prose-headings:text-primary prose-strong:text-primary prose-a:text-brand-secondary"
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
                    <div className="rounded-2xl rounded-tl-sm bg-secondary px-3.5 py-2.5 text-sm text-tertiary">thinking…</div>
                </div>
            ) : null}

            {showSuggestions ? (
                <div className="flex flex-col gap-2 pt-1">
                    {SUGGESTIONS.map((s) => (
                        <button
                            key={s}
                            onClick={() => void sendText(s)}
                            className="rounded-lg bg-secondary px-3 py-2 text-left text-sm text-secondary ring-1 ring-secondary transition-colors hover:ring-brand"
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

    // ---- Composer footer (shared by sidebar + chat) ----
    const footer = (
        <div className="flex flex-col border-t border-secondary">
            <div className="px-3 py-2">{modeToolbar}</div>
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
                    textAreaClassName="max-h-32 resize-none rounded-none border-0 shadow-none ring-0 text-xs leading-4 focus:ring-0"
                />
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
                        className="prose prose-sm dark:prose-invert line-clamp-3 max-h-24 overflow-hidden px-3 py-2 text-xs text-secondary prose-headings:text-primary prose-strong:text-primary prose-a:text-brand-secondary prose-p:text-xs prose-p:leading-4 prose-p:my-1"
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
            <div className="fixed right-0 top-0 z-50 flex h-[560px] max-h-[calc(100vh-1rem)] w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-l-2xl rounded-br-2xl border-b border-l border-secondary bg-primary shadow-xl">
                {header}
                {messageList}
                {footer}
                {assistantSettingsPopover}
            </div>
        );
    }

    // ---- SIDEBAR mode (default) ----
    return (
        <aside className="flex w-80 shrink-0 flex-col border-l border-secondary bg-primary">
            {header}
            {messageList}
            {footer}
            {assistantSettingsPopover}
        </aside>
    );
}
