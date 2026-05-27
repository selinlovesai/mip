/**
 * WidgetIcon — renders a widget icon from a flexible string, supporting several
 * icon sources (no raw emojis required):
 *   1. an Untitled UI icon name (e.g. "Zap", "Shield01") → the bundled component;
 *   2. an icon-font class string (e.g. "fa-solid fa-bolt", "bi bi-rocket",
 *      "material-icons") → <i className="…">, for any library you load via CSS;
 *   3. anything else (emoji / letter) → rendered as text, so old data still shows.
 */

import type { FC } from "react";
import {
    Award01, BarChartSquare01, BellRinging01, Calendar, CheckCircle, Clock, Cube01, Database01, Flag01, Globe01, Grid01, Heart, Image01,
    Lightbulb01, Lightning01, Lock01, Mail01, MessageChatCircle, Rocket01, Settings01, Shield01, Star01, Target01, TrendUp01, Users01, Zap,
} from "@untitledui/icons";
import { cx } from "@/utils/cx";

type IconComp = FC<{ className?: string }>;

/** Curated Untitled icons available by name (case-insensitive). Extend freely. */
const NAMED: Record<string, IconComp> = {
    award01: Award01, barchart: BarChartSquare01, barchartsquare01: BarChartSquare01, bell: BellRinging01, bellringing01: BellRinging01,
    calendar: Calendar, check: CheckCircle, checkcircle: CheckCircle, clock: Clock, cube: Cube01, cube01: Cube01, database: Database01,
    database01: Database01, flag: Flag01, flag01: Flag01, globe: Globe01, globe01: Globe01, grid: Grid01, grid01: Grid01, heart: Heart,
    image: Image01, image01: Image01, lightbulb: Lightbulb01, lightbulb01: Lightbulb01, lightning: Lightning01, lightning01: Lightning01,
    lock: Lock01, lock01: Lock01, mail: Mail01, mail01: Mail01, message: MessageChatCircle, rocket: Rocket01, rocket01: Rocket01,
    settings: Settings01, settings01: Settings01, shield: Shield01, shield01: Shield01, star: Star01, star01: Star01, target: Target01,
    target01: Target01, trendup: TrendUp01, trendup01: TrendUp01, users: Users01, users01: Users01, zap: Zap, bolt: Zap,
};

/** Map common emojis to a curated Untitled icon, so legacy/AI data that used
 *  raw emojis renders as a crisp icon-font glyph instead of a coloured emoji. */
const EMOJI: Record<string, IconComp> = {
    "⚡": Zap, "🔌": Zap, "🔒": Lock01, "🔐": Lock01, "🛡️": Shield01, "🛡": Shield01, "🌐": Globe01, "🌍": Globe01, "🌎": Globe01, "🌏": Globe01,
    "🚀": Rocket01, "⭐": Star01, "🌟": Star01, "❤️": Heart, "♥️": Heart, "📊": BarChartSquare01, "📈": TrendUp01, "📅": Calendar, "🕐": Clock, "⏰": Clock,
    "🔔": BellRinging01, "✉️": Mail01, "📧": Mail01, "💬": MessageChatCircle, "👥": Users01, "🎯": Target01, "🏆": Award01, "🚩": Flag01,
    "💡": Lightbulb01, "⚙️": Settings01, "🖼️": Image01, "🗄️": Database01, "📦": Cube01, "✅": CheckCircle, "✔️": CheckCircle, "🏁": Flag01,
};

/** Heuristic: does this look like an icon-font class rather than a name/emoji? */
const looksLikeClass = (s: string) => /\s/.test(s) || /^(fa[srlbd]?-|fa-|bi-|bi |ti-|ti |ph-|ph |material-icons|mdi-|lucide|icon-)/i.test(s.trim());

export function WidgetIcon({ icon, className }: { icon?: unknown; className?: string }) {
    if (typeof icon !== "string" || !icon.trim()) return null;
    const raw = icon.trim();
    const Comp = NAMED[raw.toLowerCase()] ?? EMOJI[raw] ?? EMOJI[raw.replace(/️/g, "")];
    if (Comp) return <Comp className={className} aria-hidden />;
    if (looksLikeClass(raw)) return <i className={cx(raw, className)} aria-hidden />;
    // Unknown emoji/text → a neutral icon so the grid stays consistent (no emoji).
    if (/\p{Extended_Pictographic}/u.test(raw)) return <Star01 className={className} aria-hidden />;
    return (
        <span className={className} aria-hidden>
            {raw}
        </span>
    );
}
