/**
 * One-time page-load flourish. A glow appears at the screen center, grows and
 * holds (an "intro"), then flies along a curved path into the AI assistant icon
 * (`[data-ai-icon]`) with a comet tail trailing behind, ending over the icon.
 * No-ops if the icon isn't present or the user prefers reduced motion;
 * pointer-events-none so it never blocks interaction.
 */

import { useEffect, useState } from "react";
import { motion } from "motion/react";

interface Beam {
    start: { x: number; y: number };
    end: { x: number; y: number };
    mid: { x: number; y: number }; // curve control-ish midpoint
}

// Shared timeline: 0 appear · 0.16 grown · 0.42 end-of-hold · 0.72 curve apex · 1 at icon.
const TIMES = [0, 0.16, 0.42, 0.72, 1];
const DURATION = 2.0;

export function IntroBeam() {
    const [beam, setBeam] = useState<Beam | null>(null);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
        const t = setTimeout(() => {
            const el = document.querySelector<HTMLElement>("[data-ai-icon]");
            if (!el) return;
            const r = el.getBoundingClientRect();
            const end = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            const start = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const dist = Math.hypot(dx, dy) || 1;
            // Perpendicular unit vector, biased upward, gives the curve its bow.
            let px = -dy / dist;
            let py = dx / dist;
            if (py > 0) {
                px = -px;
                py = -py;
            }
            const bow = Math.min(Math.max(dist * 0.3, 70), 180);
            const mid = { x: start.x + dx * 0.5 + px * bow, y: start.y + dy * 0.5 + py * bow };
            setBeam({ start, end, mid });
        }, 180);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => {
        if (!beam) return;
        const t = setTimeout(() => setBeam(null), 2800);
        return () => clearTimeout(t);
    }, [beam]);

    if (!beam) return null;
    const { start, end, mid } = beam;
    // Position keyframes (absolute px): hold at center, then curve through mid to icon.
    const xs = [start.x, start.x, start.x, mid.x, end.x];
    const ys = [start.y, start.y, start.y, mid.y, end.y];

    // Comet head + a few trailing particles that lag along the SAME path (delay),
    // so the tail follows the curve. Larger index = smaller, dimmer, later.
    const particles = [0, 1, 2, 3, 4, 5];

    return (
        <div className="pointer-events-none fixed inset-0 z-[200] overflow-hidden">
            {particles.map((i) => {
                const head = i === 0;
                const size = head ? 18 : Math.max(6, 15 - i * 2);
                const delay = i * 0.05;
                return (
                    <motion.div
                        key={i}
                        style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            width: size,
                            height: size,
                            marginLeft: -size / 2,
                            marginTop: -size / 2,
                            borderRadius: 9999,
                            background: head ? "var(--color-brand-300)" : "var(--color-brand-400)",
                            boxShadow: head
                                ? "0 0 18px 6px var(--color-brand-500), 0 0 44px 14px color-mix(in oklab, var(--color-brand-500) 45%, transparent)"
                                : "0 0 12px 3px color-mix(in oklab, var(--color-brand-500) 50%, transparent)",
                        }}
                        initial={{ x: start.x, y: start.y, scale: 0.3, opacity: 0 }}
                        animate={{
                            x: xs,
                            y: ys,
                            scale: head ? [0.3, 1.25, 1.15, 1, 0.45] : [0.2, 0.9, 0.85, 0.7, 0.2],
                            opacity: head ? [0, 1, 1, 1, 0] : [0, 0.55, 0.55, 0.5, 0],
                        }}
                        transition={{ duration: DURATION, delay, ease: "easeInOut", times: TIMES }}
                    />
                );
            })}

            {/* Arrival pop, timed to when the head reaches the icon. */}
            <motion.div
                style={{
                    position: "absolute",
                    left: end.x,
                    top: end.y,
                    width: 30,
                    height: 30,
                    marginLeft: -15,
                    marginTop: -15,
                    borderRadius: 9999,
                    background: "color-mix(in oklab, var(--color-brand-400) 55%, transparent)",
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 1.7], opacity: [0, 0.6, 0] }}
                transition={{ duration: 0.55, delay: DURATION * 0.92, ease: "easeOut" }}
            />
        </div>
    );
}
