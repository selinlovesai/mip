/**
 * AI assistant panel — slides in from the right alongside the main content
 * (sibling, not an overlay). Conversation UI with markdown-rendered assistant
 * replies, suggested-prompt chips, an assistant avatar, and provider awareness
 * (reads connected AI apps from settings). The send handler is a local stub
 * (`respond()`); wiring a real provider is a drop-in replacement once an AI app
 * is connected and a key/endpoint is supplied.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Send01, Stars01, X } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { TextArea } from "@/components/base/textarea/textarea";
import { markdownToHtml } from "@/mip/adapters/untitled/markdown";
import { APP_CATALOG } from "@/mip/settings/apps-catalog";
import { useSettings } from "@/mip/settings/settings-store";
import { useDashboard } from "@/mip/store";

interface Message {
    id: string;
    role: "user" | "assistant";
    text: string;
}

const SUGGESTIONS = ["Summarize this dashboard", "Add a bar chart of revenue", "What does the churn metric mean?", "Suggest widgets to add"];

function respond(prompt: string, page: string, provider: string | null): string {
    const head = provider
        ? `Using **${provider}**. Here's how I'd help on the **${page}** dashboard:`
        : `I'm in demo mode (no AI provider connected). On the **${page}** dashboard I can still guide you:`;
    return `${head}\n\n- Add or edit widgets from the **+** toolbar\n- Drag to rearrange in edit mode\n- Open **Settings → Apps** to connect a provider for live answers\n\n**You said:** "${prompt}"`;
}

export function ChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { activePage } = useDashboard();
    const { apps } = useSettings();
    const [messages, setMessages] = useState<Message[]>([{ id: "intro", role: "assistant", text: "Hi! I'm your dashboard assistant. Ask me to **add a chart**, summarize your data, or restyle the page." }]);
    const [draft, setDraft] = useState("");
    const listRef = useRef<HTMLDivElement>(null);

    const provider = useMemo(() => {
        const connectedAi = apps.find((a) => APP_CATALOG.some((c) => c.id === a.appId && c.category === "AI"));
        return connectedAi ? (APP_CATALOG.find((c) => c.id === connectedAi.appId)?.name ?? null) : null;
    }, [apps]);

    useEffect(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }, [messages, open]);

    const sendText = (text: string) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        const userMsg: Message = { id: `u-${Date.now()}`, role: "user", text: trimmed };
        const reply: Message = { id: `a-${Date.now()}`, role: "assistant", text: respond(trimmed, activePage.title, provider) };
        setMessages((prev) => [...prev, userMsg, reply]);
        setDraft("");
    };

    if (!open) return null;

    const showSuggestions = messages.length <= 1;

    return (
        <aside className="flex w-96 shrink-0 flex-col border-l border-secondary bg-primary">
            <div className="flex items-center justify-between border-b border-secondary px-4 py-3.5">
                <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-full bg-brand-solid">
                        <Stars01 className="size-4 text-white" />
                    </span>
                    <div className="flex flex-col leading-tight">
                        <h2 className="text-sm font-semibold text-primary">AI assistant</h2>
                        <span className="text-xs text-tertiary">{provider ? `Connected: ${provider}` : "Demo mode · no provider"}</span>
                    </div>
                </div>
                <ButtonUtility color="tertiary" size="xs" icon={X} tooltip="Close assistant" onClick={onClose} />
            </div>

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

                {showSuggestions ? (
                    <div className="flex flex-col gap-2 pt-1">
                        {SUGGESTIONS.map((s) => (
                            <button key={s} onClick={() => sendText(s)} className="rounded-lg bg-secondary px-3 py-2 text-left text-sm text-secondary ring-1 ring-secondary transition-colors hover:ring-brand">
                                {s}
                            </button>
                        ))}
                    </div>
                ) : null}
            </div>

            <div className="border-t border-secondary p-3">
                <div className="flex items-end gap-2">
                    <TextArea
                        aria-label="Message"
                        size="sm"
                        rows={1}
                        value={draft}
                        onChange={setDraft}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                sendText(draft);
                            }
                        }}
                        placeholder="Ask anything…"
                        className="flex-1"
                        textAreaClassName="max-h-32 resize-none"
                    />
                    <Button size="md" color="primary" iconLeading={Send01} isDisabled={!draft.trim()} onClick={() => sendText(draft)} aria-label="Send" />
                </div>
            </div>
        </aside>
    );
}
