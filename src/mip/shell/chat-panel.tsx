/**
 * AI assistant panel — slides in from the right alongside the main content
 * (sibling, not an overlay, matching the original). Conversation UI with a
 * message list and composer. The send handler is a local stub that echoes an
 * assistant reply; wiring a real provider is a drop-in replacement for
 * `respond()` once the data/provider layer lands.
 */

import { useEffect, useRef, useState } from "react";
import { Send01, Stars01, X } from "@untitledui/icons";
import { useDashboard } from "@/mip/store";
import { cx } from "@/utils/cx";

interface Message {
    id: string;
    role: "user" | "assistant";
    text: string;
}

function respond(prompt: string, page: string): string {
    return `You're on the “${page}” dashboard. I can help you add widgets, rearrange the layout, or explain the data. (Demo reply — connect a provider to enable live answers.)\n\nYou said: “${prompt}”`;
}

export function ChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { activePage } = useDashboard();
    const [messages, setMessages] = useState<Message[]>([{ id: "intro", role: "assistant", text: "Hi! I'm your dashboard assistant. Ask me to add a chart, summarize your data, or restyle the page." }]);
    const [draft, setDraft] = useState("");
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }, [messages, open]);

    const send = () => {
        const text = draft.trim();
        if (!text) return;
        const userMsg: Message = { id: `u-${Date.now()}`, role: "user", text };
        const reply: Message = { id: `a-${Date.now()}`, role: "assistant", text: respond(text, activePage.title) };
        setMessages((prev) => [...prev, userMsg, reply]);
        setDraft("");
    };

    if (!open) return null;

    return (
        <aside className="flex w-96 shrink-0 flex-col border-l border-secondary bg-primary">
            <div className="flex items-center justify-between border-b border-secondary px-4 py-3.5">
                <div className="flex items-center gap-2">
                    <Stars01 className="size-5 text-brand-secondary" />
                    <h2 className="text-sm font-semibold text-primary">AI assistant</h2>
                </div>
                <button onClick={onClose} className="text-tertiary hover:text-secondary" aria-label="Close assistant">
                    <X className="size-5" />
                </button>
            </div>

            <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto p-4">
                {messages.map((msg) => (
                    <div key={msg.id} className={cx("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                        <div className={cx("max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm", msg.role === "user" ? "bg-brand-solid text-white" : "bg-secondary text-secondary")}>{msg.text}</div>
                    </div>
                ))}
            </div>

            <div className="border-t border-secondary p-3">
                <div className="flex items-end gap-2 rounded-xl bg-secondary p-2 ring-1 ring-secondary focus-within:ring-brand">
                    <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                send();
                            }
                        }}
                        rows={1}
                        placeholder="Ask anything…"
                        className="max-h-32 flex-1 resize-none bg-transparent px-1 py-1 text-sm text-primary outline-none placeholder:text-placeholder"
                    />
                    <button onClick={send} disabled={!draft.trim()} className="flex size-8 items-center justify-center rounded-lg bg-brand-solid text-white disabled:opacity-40" aria-label="Send">
                        <Send01 className="size-4" />
                    </button>
                </div>
            </div>
        </aside>
    );
}
