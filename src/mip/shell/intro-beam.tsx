/**
 * One-time page-load flourish. A glow appears at the screen center, grows and
 * holds (an "intro"), then flies along a smooth CURVED path into the AI
 * assistant icon (`[data-ai-icon]`) with a comet tail trailing behind, ending
 * over the icon.
 *
 * The curve is a CSS motion path (quadratic Bézier); we animate `offsetDistance`
 * 0→100% (not x/y keyframes, which interpolate in straight segments), so the
 * movement is genuinely curved and eased. No-ops if the icon is absent or the
 * user prefers reduced motion; pointer-events-none so it never blocks input.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

interface Beam {
    id: number; // bumped per launch so particles remount and replay
    path: string; // SVG path() in viewport px: M start Q control end
    end: { x: number; y: number };
}

/** Where the comet starts: over a visible "Get started" button (or an explicit
 *  [data-intro-start]) when present, else the screen center. Robust across
 *  screens that may not have such a button. */
function findStart(): { x: number; y: number } {
    if (typeof document !== "undefined") {
        const inView = (el: Element) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;
        };
        const explicit = document.querySelector<HTMLElement>("[data-intro-start]");
        const cta = explicit ?? Array.from(document.querySelectorAll<HTMLElement>("button, a")).find((el) => /get\s*started/i.test(el.textContent ?? "") && inView(el));
        if (cta && inView(cta)) {
            const r = cta.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }
    }
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

// appear · grown · end-of-hold · ARRIVED at icon · faded out (in place over icon)
const TIMES = [0, 0.16, 0.42, 0.9, 1];
const DURATION = 2.0;

export function IntroBeam({ onOpenChat }: { onOpenChat?: () => void } = {}) {
    const [beam, setBeam] = useState<Beam | null>(null);
    // Keep the callback in a ref so `launch` stays STABLE — otherwise a new
    // inline onOpenChat each render would re-create launch and re-fire the
    // on-load effect (replaying the animation on every re-render, e.g. sidebar
    // toggles).
    const onOpenChatRef = useRef(onOpenChat);
    onOpenChatRef.current = onOpenChat;

    // Launch the comet from `start` to the current AI icon position. When
    // `openOnEnd` is set, open the AI chat once the comet lands on the icon.
    const launch = useCallback(
        (start: { x: number; y: number }, openOnEnd = false) => {
            if (typeof window === "undefined") return;
            if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
                if (openOnEnd) onOpenChatRef.current?.(); // honor the intent without animating
                return;
            }
            const el = document.querySelector<HTMLElement>("[data-ai-icon]");
            if (!el) return;
        const r = el.getBoundingClientRect();
        const end = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const dist = Math.hypot(dx, dy) || 1;
        // Control point: midpoint pushed along the upward perpendicular → a bow.
        let px = -dy / dist;
        let py = dx / dist;
        if (py > 0) {
            px = -px;
            py = -py;
        }
        const bow = Math.min(Math.max(dist * 0.35, 80), 220);
        const cx = start.x + dx * 0.5 + px * bow;
        const cy = start.y + dy * 0.5 + py * bow;
            const path = `path("M ${start.x} ${start.y} Q ${cx} ${cy} ${end.x} ${end.y}")`;
            setBeam({ id: Date.now(), path, end });
            // Open the AI chat as the comet lands on the icon.
            if (openOnEnd) setTimeout(() => onOpenChatRef.current?.(), DURATION * 1000);
        },
        [],
    );

    // On page load: play once from the "Get started" button (or center).
    useEffect(() => {
        const t = setTimeout(() => requestAnimationFrame(() => launch(findStart())), 180);
        return () => clearTimeout(t);
    }, [launch]);

    // Replay whenever a "Get started" button is clicked — starting from it — then
    // open the AI chat when it arrives.
    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            const t = (e.target as HTMLElement | null)?.closest?.("button, a, [data-intro-start]");
            if (!t) return;
            if (!(t.matches("[data-intro-start]") || /get\s*started/i.test(t.textContent ?? ""))) return;
            const r = t.getBoundingClientRect();
            launch({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, true);
        };
        // Capture phase: React Aria buttons/links stop click propagation, so a
        // bubble-phase listener never fires — capture sees it first regardless.
        document.addEventListener("click", onClick, true);
        return () => document.removeEventListener("click", onClick, true);
    }, [launch]);

    // Clear the overlay after the run finishes (re-armed on each launch via id).
    useEffect(() => {
        if (!beam) return;
        const t = setTimeout(() => setBeam(null), 2800);
        return () => clearTimeout(t);
    }, [beam]);

    if (!beam) return null;
    const { path, end } = beam;
    const particles = [0, 1, 2, 3, 4, 5];

    return (
        <div className="pointer-events-none fixed inset-0 z-[200] overflow-hidden">
            {particles.map((i) => {
                const head = i === 0;
                const size = head ? 18 : Math.max(6, 15 - i * 2);
                const delay = i * 0.05;
                return (
                    <motion.div
                        key={`${beam.id}-${i}`}
                        style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            width: size,
                            height: size,
                            borderRadius: 9999,
                            offsetPath: path,
                            offsetRotate: "0deg",
                            offsetAnchor: "50% 50%",
                            background: head ? "var(--color-brand-300)" : "var(--color-brand-400)",
                            boxShadow: head
                                ? "0 0 18px 6px var(--color-brand-500), 0 0 44px 14px color-mix(in oklab, var(--color-brand-500) 45%, transparent)"
                                : "0 0 12px 3px color-mix(in oklab, var(--color-brand-500) 50%, transparent)",
                        }}
                        initial={{ offsetDistance: "0%", scale: 0.3, opacity: 0 }}
                        animate={{
                            // Reach the icon (100%) at 0.9, then hold there and fade —
                            // so it disappears exactly OVER the AI icon, not just before it.
                            offsetDistance: ["0%", "0%", "0%", "100%", "100%"],
                            scale: head ? [0.3, 1.25, 1.15, 1, 0.5] : [0.2, 0.9, 0.85, 0.6, 0.25],
                            opacity: head ? [0, 1, 1, 1, 0] : [0, 0.55, 0.55, 0.5, 0],
                        }}
                        transition={{ duration: DURATION, delay, ease: "easeInOut", times: TIMES }}
                    />
                );
            })}

            {/* Arrival pop, timed to when the head reaches the icon. */}
            <motion.div
                key={`pop-${beam.id}`}
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
