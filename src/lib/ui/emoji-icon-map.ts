/**
 * Emoji → Lucide icon lookup.
 *
 * Historically many wizard / choice-card options in this app carry an
 * `emoji` field (e.g. `{ emoji: "🎯", label: "Sales" }`). The raw glyphs
 * render inconsistently across OSes and tend to read as "AI-generated" in
 * screenshots and marketing.
 *
 * This map lets the UI swap them for a matching Lucide icon while the
 * underlying data model stays intact — no migration required on the callers.
 *
 * Keys are the exact emoji characters (with any variation selectors
 * stripped so `🖼️` and `🖼` both hit the same entry). If a key isn't
 * found, consumers fall back to `<Sparkles>`.
 */
import React from "react";
import type { LucideIcon, LucideProps } from "lucide-react";
import {
  Aperture,
  ArrowUpRight,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Box,
  Briefcase,
  Camera,
  Car,
  Check,
  Circle,
  Clapperboard,
  Clock,
  Coins,
  CreditCard,
  Crown,
  Dice5,
  DollarSign,
  Dumbbell,
  FileText,
  Flame,
  Gem,
  Globe,
  GraduationCap,
  Heart,
  Home,
  IdCard,
  Image as ImageIcon,
  LayoutGrid,
  Laugh,
  Leaf,
  Lightbulb,
  Megaphone,
  MessageSquare,
  Mic,
  Monitor,
  Moon,
  Mountain,
  MousePointer,
  Music,
  Newspaper,
  Palette,
  PartyPopper,
  Pencil,
  Plane,
  Play,
  Rocket,
  Ruler,
  Scissors,
  Search,
  ShieldCheck,
  Smartphone,
  Snowflake,
  Sparkles,
  Square,
  Star,
  Sun,
  Tag,
  Target,
  TreePine,
  TrendingUp,
  Trophy,
  Tv,
  Users,
  Utensils,
  Waves,
  X as XIcon,
  Zap,
} from "lucide-react";

/**
 * Strip Unicode variation selectors (U+FE0E, U+FE0F) and zero-width joiners
 * so `🎯\uFE0F` and `🎯` and `🖼️` and `🖼` all hit the same map entry.
 * We keep the core pictograph intact.
 */
function normalizeEmoji(input: string): string {
  return input.replace(/[\uFE0E\uFE0F\u200D]/g, "").trim();
}

/**
 * Raw emoji → Lucide mapping. Coverage is pragmatic: every emoji that
 * appears in a `choices` / `choice-cards` / `chip-select` option anywhere
 * in the app has an entry. Decorative emoji in headings or prose are not
 * remapped — only option data.
 */
const RAW_MAP: Record<string, LucideIcon> = {
  // — from the task brief —
  "🎯": Target,
  "💼": Briefcase,
  "🚀": Rocket,
  "📊": BarChart3,
  "💬": MessageSquare,
  "🎨": Palette,
  "🎬": Clapperboard,
  "📱": Smartphone,
  "🌐": Globe,
  "💰": DollarSign,

  // — platform / social —
  "📸": Camera,        // Instagram
  "📷": Camera,
  "📹": Camera,
  "👥": Users,         // Facebook / community
  "▶️": Play,           // YouTube / thumbnail
  "📺": Tv,
  "𝕏": XIcon,           // X / Twitter

  // — image-wizard creation types —
  "🪪": IdCard,        // profile picture / ID
  "📣": Megaphone,     // ad creative
  "🖼️": ImageIcon,     // hero image
  "🗂️": LayoutGrid,    // carousel
  "📰": Newspaper,     // blog hero
  "📦": Box,           // product mockup
  "🏆": Trophy,        // logo / mark
  "📐": Ruler,         // custom size / rule of thirds
  "📲": Smartphone,    // story / reel cover

  // — moods —
  "⚡": Zap,
  "🌿": Leaf,
  "🌙": Moon,
  "💪": Dumbbell,
  "🎈": PartyPopper,
  "👔": Briefcase,
  "🔥": Flame,
  "💥": Sparkles,
  "⚪": Circle,
  "👑": Crown,

  // — style / composition —
  "🪞": Aperture,      // portrait / face focus
  "🏞️": Mountain,      // wide landscape
  "🔍": Search,        // close-up / upscale
  "↗️": ArrowUpRight,   // diagonal / dynamic

  // — image style vibes / niche —
  "🧊": Box,           // 3d render
  "🖌️": Pencil,        // illustration
  "🌴": TreePine,      // vaporwave
  "⬛": Square,         // 1:1 square
  "🎮": MousePointer,  // gaming (best-available)

  // — extras (image wizard) —
  "🏷️": Tag,
  "✂️": Scissors,
  "🎲": Dice5,

  // — status / outreach pills —
  "🟢": Check,
  "🔵": MessageSquare,
  "🟡": Clock,
  "🔴": XIcon,
  "⚫": Circle,
  "✏️": Pencil,

  // — thumbnail niche generators —
  "💡": Lightbulb,
  "🎓": GraduationCap,
  "⭐": Star,
  "📚": BookOpen,
  "🎧": Mic,
  "🍳": Utensils,
  "✈️": Plane,
  "🚨": AlertTriangle,
  "🤣": Laugh,
  "🎵": Music,
  "🏠": Home,
  "💄": Heart,
  "🚗": Car,
  "🏈": Trophy,
  "📈": TrendingUp,
  "🪙": Coins,
  "🎭": Clapperboard,

  // — structural —
  "❄️": Snowflake,
  "⏰": Clock,
  "💎": Gem,
  "🎉": PartyPopper,
  "📞": MessageSquare,
  "📄": FileText,
  "✅": Check,
  "❌": XIcon,
  "⚠️": AlertTriangle,
  "🛡️": ShieldCheck,
  "💳": CreditCard,
  "🌞": Sun,
  "🌊": Waves,
  "🖥️": Monitor,
};

// Re-key the map so callers with or without variation selectors both hit.
const EMOJI_TO_ICON: Record<string, LucideIcon> = Object.fromEntries(
  Object.entries(RAW_MAP).map(([k, v]) => [normalizeEmoji(k), v])
);

/**
 * Look up the Lucide icon for a given emoji string. Returns undefined if
 * there's no mapping — callers should fall back to `<Sparkles>` for a
 * neutral-but-not-empty placeholder.
 */
export function iconForEmoji(
  emoji: string | undefined | null
): LucideIcon | undefined {
  if (!emoji) return undefined;
  return EMOJI_TO_ICON[normalizeEmoji(emoji)];
}

/**
 * Render helper — always returns a Lucide icon element. Falls back to
 * `<Sparkles>` when the emoji isn't mapped.
 *
 *     <EmojiIcon emoji={opt.emoji} size={18} className="text-gold" />
 */
export interface EmojiIconProps extends LucideProps {
  /** The source emoji — will be normalized and looked up. */
  emoji?: string | null;
  /** Override the fallback icon. Defaults to Sparkles. */
  fallback?: LucideIcon;
}

export function EmojiIcon({
  emoji,
  fallback = Sparkles,
  ...rest
}: EmojiIconProps) {
  const Icon = iconForEmoji(emoji) ?? fallback;
  return React.createElement(Icon, rest);
}

export { EMOJI_TO_ICON };
