/**
 * One-time page-load flourish: a glowing comet shines at the screen center and
 * trails into the AI assistant icon (the topbar `[data-ai-icon]` button), then
 * fades — a subtle nudge toward the assistant. No-ops if the icon isn't found
 * or the user prefers reduced motion.
 */

import { useEffect, useState } from "react";
import { motion } from "motion/react";

interface Beam {
    start: { x: number; y: number };
    end: { x: number; y: number };
    angle: number; // degrees, center → icon
    dist: number; // px
}

export function IntroBeam() {
    const [beam, setBeam] = useState<Beam | null>(null);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
        // Let the shell paint so the icon has a real position.
        const t = setTimeout(() => {
            const el = document.querySelector<HTMLElement>("[data-ai-icon]");
            if (!el) return;
            const r = el.getBoundingClientRect();
            const end = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            const start = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            setBeam({ start, end, angle: (Math.atan2(dy, dx) * 180) / Math.PI, dist: Math.hypot(dx, dy) });
        }, 180);
        return () => clearTimeout(t);
    }, []);

    // Remove the overlay once the animation has finished.
    useEffect(() => {
        if (!beam) return;
        const t = setTimeout(() => setBeam(null), 1700);
        return () => clearTimeout(t);
    }, [beam]);

    if (!beam) return null;
    const { start, end, angle, dist } = beam;
    const dx = end.x - start.x;
    const dy = end.y - start.y;

    return (
        <div className="pointer-events-none fixed inset-0 z-[200] overflow-hidden">
            {/* Trailing streak: grows from center toward the icon, then fades. */}
            <motion.div
                style={{
                    position: "absolute",
                    left: start.x,
                    top: start.y,
                    width: dist,
                    height: 3,
                    marginTop: -1.5,
                    transformOrigin: "0% 50%",
                    rotate: `${angle}deg`,
                    borderRadius: 9999,
                    background: "linear-gradient(90deg, transparent 0%, color-mix(in oklab, var(--color-brand-500) 60%, transparent) 70%, var(--color-brand-400) 100%)",
                    filter: "blur(1px)",
                }}
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: [0, 1, 1], opacity: [0, 0.85, 0] }}
                transition={{ duration: 1.1, ease: "easeOut", times: [0, 0.65, 1] }}
            />
            {/* Comet head: travels center → icon, brightening then snuffing out. */}
            <motion.div
                style={{
                    position: "absolute",
                    left: start.x,
                    top: start.y,
                    width: 16,
                    height: 16,
                    marginLeft: -8,
                    marginTop: -8,
                    borderRadius: 9999,
                    background: "var(--color-brand-300)",
                    boxShadow: "0 0 16px 5px var(--color-brand-500), 0 0 36px 12px color-mix(in oklab, var(--color-brand-500) 45%, transparent)",
                }}
                initial={{ x: 0, y: 0, scale: 0.5, opacity: 0 }}
                animate={{ x: [0, dx], y: [0, dy], scale: [0.5, 1.2, 1, 0.4], opacity: [0, 1, 1, 0] }}
                transition={{ duration: 1.1, ease: "easeInOut" }}
            />
            {/* Arrival pop at the icon. */}
            <motion.div
                style={{
                    position: "absolute",
                    left: end.x,
                    top: end.y,
                    width: 28,
                    height: 28,
                    marginLeft: -14,
                    marginTop: -14,
                    borderRadius: 9999,
                    background: "color-mix(in oklab, var(--color-brand-400) 55%, transparent)",
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 1.6], opacity: [0, 0.6, 0] }}
                transition={{ duration: 0.5, delay: 1, ease: "easeOut" }}
            />
        </div>
    );
}
