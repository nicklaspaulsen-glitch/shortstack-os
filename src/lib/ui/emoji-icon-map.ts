import type { IconProps, Icon } from "@phosphor-icons/react";
import { Airplane, Aperture, ArrowUpRight, Barbell, BookOpen, Briefcase, Camera, Car, ChartBar, Chat, Check, Circle, Clock, Coins, Confetti, CreditCard, Crown, Cube, CurrencyDollar, CursorClick, DeviceMobile, Diamond, DiceFive, FileText, FilmSlate, Fire, ForkKnife, Globe, GraduationCap, Heart, House, IdentificationCard, Image, Leaf, Lightbulb, Lightning, MagnifyingGlass, Megaphone, Microphone, Monitor, Moon, Mountains, MusicNote, Newspaper, Palette, Pencil, Play, Rocket, Ruler, Scissors, ShieldCheck, Smiley, Snowflake, Sparkle, Square, SquaresFour, Star, Sun, Tag, Target, Television, Tree, TrendUp, Trophy, Users, Warning, Waves, X } from "@phosphor-icons/react";
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
 * found, consumers fall back to `<Sparkle>`.
 */
import React from "react";



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
const RAW_MAP: Record<string, Icon> = {
  // — from the task brief —
  "🎯": Target,
  "💼": Briefcase,
  "🚀": Rocket,
  "📊": ChartBar,
  "💬": Chat,
  "🎨": Palette,
  "🎬": FilmSlate,
  "📱": DeviceMobile,
  "🌐": Globe,
  "💰": CurrencyDollar,

  // — platform / social —
  "📸": Camera,        // Instagram
  "📷": Camera,
  "📹": Camera,
  "👥": Users,         // Facebook / community
  "▶️": Play,           // YouTube / thumbnail
  "📺": Television,
  "𝕏": X,           // X / Twitter

  // — image-wizard creation types —
  "🪪": IdentificationCard,        // profile picture / ID
  "📣": Megaphone,     // ad creative
  "🖼️": Image,     // hero image
  "🗂️": SquaresFour,    // carousel
  "📰": Newspaper,     // blog hero
  "📦": Cube,           // product mockup
  "🏆": Trophy,        // logo / mark
  "📐": Ruler,         // custom size / rule of thirds
  "📲": DeviceMobile,    // story / reel cover

  // — moods —
  "⚡": Lightning,
  "🌿": Leaf,
  "🌙": Moon,
  "💪": Barbell,
  "🎈": Confetti,
  "👔": Briefcase,
  "🔥": Fire,
  "💥": Sparkle,
  "⚪": Circle,
  "👑": Crown,

  // — style / composition —
  "🪞": Aperture,      // portrait / face focus
  "🏞️": Mountains,      // wide landscape
  "🔍": MagnifyingGlass,        // close-up / upscale
  "↗️": ArrowUpRight,   // diagonal / dynamic

  // — image style vibes / niche —
  "🧊": Cube,           // 3d render
  "🖌️": Pencil,        // illustration
  "🌴": Tree,      // vaporwave
  "⬛": Square,         // 1:1 square
  "🎮": CursorClick,  // gaming (best-available)

  // — extras (image wizard) —
  "🏷️": Tag,
  "✂️": Scissors,
  "🎲": DiceFive,

  // — status / outreach pills —
  "🟢": Check,
  "🔵": Chat,
  "🟡": Clock,
  "🔴": X,
  "⚫": Circle,
  "✏️": Pencil,

  // — thumbnail niche generators —
  "💡": Lightbulb,
  "🎓": GraduationCap,
  "⭐": Star,
  "📚": BookOpen,
  "🎧": Microphone,
  "🍳": ForkKnife,
  "✈️": Airplane,
  "🚨": Warning,
  "🤣": Smiley,
  "🎵": MusicNote,
  "🏠": House,
  "💄": Heart,
  "🚗": Car,
  "🏈": Trophy,
  "📈": TrendUp,
  "🪙": Coins,
  "🎭": FilmSlate,

  // — structural —
  "❄️": Snowflake,
  "⏰": Clock,
  "💎": Diamond,
  "🎉": Confetti,
  "📞": Chat,
  "📄": FileText,
  "✅": Check,
  "❌": X,
  "⚠️": Warning,
  "🛡️": ShieldCheck,
  "💳": CreditCard,
  "🌞": Sun,
  "🌊": Waves,
  "🖥️": Monitor,
};

// Re-key the map so callers with or without variation selectors both hit.
const EMOJI_TO_ICON: Record<string, Icon> = Object.fromEntries(
  Object.entries(RAW_MAP).map(([k, v]) => [normalizeEmoji(k), v])
);

/**
 * Look up the Lucide icon for a given emoji string. Returns undefined if
 * there's no mapping — callers should fall back to `<Sparkle>` for a
 * neutral-but-not-empty placeholder.
 */
export function iconForEmoji(
  emoji: string | undefined | null
): Icon | undefined {
  if (!emoji) return undefined;
  return EMOJI_TO_ICON[normalizeEmoji(emoji)];
}

/**
 * Render helper — always returns a Lucide icon element. Falls back to
 * `<Sparkle>` when the emoji isn't mapped.
 *
 *     <EmojiIcon emoji={opt.emoji} size={18} className="text-[#D4FF00]" />
 */
export interface EmojiIconProps extends IconProps {
  /** The source emoji — will be normalized and looked up. */
  emoji?: string | null;
  /** Override the fallback icon. Defaults to Sparkle. */
  fallback?: Icon;
}

export function EmojiIcon({
  emoji,
  fallback = Sparkle,
  ...rest
}: EmojiIconProps) {
  const Icon = iconForEmoji(emoji) ?? fallback;
  return React.createElement(Icon, rest);
}

export { EMOJI_TO_ICON };
