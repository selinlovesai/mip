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

import { useEffect, useState } from "react";
import { motion } from "motion/react";

interface Beam {
    path: string; // SVG path() in viewport px: M start Q control end
    end: { x: number; y: number };
}

// appear · grown · end-of-hold · near icon · at icon
const TIMES = [0, 0.16, 0.42, 0.88, 1];
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
            setBeam({ path, end });
        }, 180);
        return () => clearTimeout(t);
    }, []);

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
                        key={i}
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
                            offsetDistance: ["0%", "0%", "0%", "92%", "100%"],
                            scale: head ? [0.3, 1.25, 1.15, 0.7, 0.45] : [0.2, 0.9, 0.85, 0.55, 0.2],
                            opacity: head ? [0, 1, 1, 1, 0] : [0, 0.55, 0.55, 0.45, 0],
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
