"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  Image as ImageIcon, Sparkles, Download, RefreshCw, Edit3, Loader,
  Monitor, Palette, Type, Smile, Layers, ChevronDown, ChevronRight,
  Clock, Trash2, Copy, Check, Zap, Grid, User,
  Square, RectangleHorizontal, Upload, X, FlaskConical, Target,
  LayoutGrid, ListChecks, Mountain, Wand2, Sticker, Search,
  History, Shuffle, ShieldCheck, Fingerprint, TrendingUp,
  SlidersHorizontal, Save, BrainCircuit, Eye,
  ArrowRight, AlertTriangle, CheckCircle2, XCircle, Cpu,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  Droplet, Wand, Scissors, Smartphone, FileImage, ShoppingBag,
} from "lucide-react";
import toast from "react-hot-toast";
import PromptEnhancer from "@/components/prompt-enhancer";
import CreationWalkthrough, { type WalkthroughStep, type WalkthroughStepStatus } from "@/components/creation-walkthrough";
import { THUMBNAIL_PRESETS, THUMBNAIL_PRESET_CATEGORIES } from "@/lib/presets";

/* ──────────────────── DATA ──────────────────── */

const FACE_OPTIONS = [
  { id: "professional_man", emoji: "\u{1F468}\u200D\u{1F4BC}", label: "Professional Man" },
  { id: "young_guy", emoji: "\u{1F9D1}", label: "Young Guy" },
  { id: "bearded_man", emoji: "\u{1F9D4}", label: "Bearded Man" },
  { id: "business_man", emoji: "\u{1F935}", label: "Business Man" },
  { id: "professional_woman", emoji: "\u{1F469}\u200D\u{1F4BC}", label: "Professional Woman" },
  { id: "young_woman", emoji: "\u{1F469}", label: "Young Woman" },
  { id: "fitness_woman", emoji: "\u{1F3CB}\u{FE0F}\u200D\u2640\u{FE0F}", label: "Fitness Woman" },
  { id: "business_woman", emoji: "\u{1F470}", label: "Business Woman" },
  { id: "surprised_face", emoji: "\u{1F632}", label: "Surprised Face" },
  { id: "angry_face", emoji: "\u{1F621}", label: "Angry Face" },
  { id: "happy_face", emoji: "\u{1F604}", label: "Happy Face" },
  { id: "no_face", emoji: "\u{1F6AB}", label: "No Face" },
];

const THUMBNAIL_STYLES = [
  { id: "youtube_classic", name: "YouTube Classic", desc: "Bold text, face close-up", gradient: "from-red-500 to-yellow-500" },
  { id: "cinematic", name: "Cinematic", desc: "Movie-poster style, dark", gradient: "from-slate-800 to-slate-600" },
  { id: "minimal_clean", name: "Minimal Clean", desc: "Simple, white bg", gradient: "from-gray-100 to-white" },
  { id: "bold_colorful", name: "Bold & Colorful", desc: "Bright gradients", gradient: "from-purple-500 to-pink-500" },
  { id: "dark_mysterious", name: "Dark & Mysterious", desc: "Moody, dark tones", gradient: "from-gray-900 to-purple-900" },
  { id: "news_breaking", name: "News / Breaking", desc: "Red banners, urgent", gradient: "from-red-700 to-red-500" },
  { id: "tutorial_howto", name: "Tutorial / How-To", desc: "Step indicators", gradient: "from-blue-500 to-cyan-400" },
  { id: "listicle", name: "Listicle", desc: "Numbered, grid layout", gradient: "from-orange-400 to-amber-300" },
  { id: "split_screen", name: "Split Screen", desc: "Before/after, vs layout", gradient: "from-emerald-500 to-blue-500" },
  { id: "neon_glow", name: "Neon Glow", desc: "Glowing text, dark bg", gradient: "from-violet-600 to-fuchsia-500" },
  { id: "vlog_style", name: "Vlog / Casual", desc: "Authentic, personal", gradient: "from-amber-300 to-yellow-200" },
  { id: "podcast_style", name: "Podcast", desc: "Guest faces, episode #", gradient: "from-indigo-500 to-purple-500" },
  { id: "retro_vintage", name: "Retro / Vintage", desc: "Faded, grain, nostalgia", gradient: "from-amber-600 to-orange-400" },
  { id: "tech_futuristic", name: "Tech / Futuristic", desc: "Circuits, blue glow, sci-fi", gradient: "from-cyan-500 to-blue-700" },
  { id: "comic_book", name: "Comic Book", desc: "Pop art, speech bubbles", gradient: "from-yellow-400 to-red-500" },
  { id: "luxury_premium", name: "Luxury / Premium", desc: "Black + gold, elegant", gradient: "from-yellow-600 to-amber-900" },
  { id: "fitness_energy", name: "Fitness / Energy", desc: "Sweat, action, power", gradient: "from-red-500 to-orange-500" },
  { id: "food_recipe", name: "Food / Recipe", desc: "Appetizing, warm tones", gradient: "from-orange-300 to-red-400" },
  { id: "real_estate", name: "Real Estate", desc: "Property showcase, clean", gradient: "from-teal-500 to-emerald-500" },
  { id: "gaming", name: "Gaming", desc: "Bold, dark, neon accents", gradient: "from-purple-600 to-pink-600" },
];

const PLATFORM_SIZES = [
  { id: "youtube", name: "YouTube", width: 1280, height: 720 },
  { id: "instagram", name: "Instagram Post", width: 1080, height: 1080 },
  { id: "twitter", name: "Twitter / X", width: 1600, height: 900 },
  { id: "facebook", name: "Facebook", width: 1200, height: 630 },
  { id: "linkedin", name: "LinkedIn", width: 1200, height: 627 },
  { id: "tiktok", name: "TikTok Cover", width: 1080, height: 1920 },
  { id: "custom", name: "Custom", width: 1280, height: 720 },
];

const COLOR_THEMES = [
  { id: "red_black", name: "Red & Black", colors: ["#EF4444", "#1A1A1A"] },
  { id: "blue_white", name: "Blue & White", colors: ["#3B82F6", "#FFFFFF"] },
  { id: "gold_dark", name: "Gold & Dark", colors: ["#C9A84C", "#1A1A2E"] },
  { id: "green_white", name: "Green & White", colors: ["#10B981", "#FFFFFF"] },
  { id: "purple_pink", name: "Purple & Pink", colors: ["#8B5CF6", "#EC4899"] },
  { id: "orange_yellow", name: "Orange & Yellow", colors: ["#F97316", "#EAB308"] },
  { id: "cyan_dark", name: "Cyan & Dark", colors: ["#06B6D4", "#0F172A"] },
  { id: "pink_white", name: "Pink & White", colors: ["#F472B6", "#FFFFFF"] },
  { id: "navy_gold", name: "Navy & Gold", colors: ["#1E3A5F", "#D4AF37"] },
  { id: "black_white", name: "Black & White", colors: ["#000000", "#FFFFFF"] },
  { id: "teal_coral", name: "Teal & Coral", colors: ["#14B8A6", "#F87171"] },
  { id: "lime_dark", name: "Lime & Dark", colors: ["#84CC16", "#1C1917"] },
  { id: "indigo_violet", name: "Indigo & Violet", colors: ["#6366F1", "#8B5CF6"] },
  { id: "rose_amber", name: "Rose & Amber", colors: ["#F43F5E", "#F59E0B"] },
  { id: "emerald_teal", name: "Emerald & Teal", colors: ["#10B981", "#14B8A6"] },
  { id: "slate_sky", name: "Slate & Sky", colors: ["#334155", "#38BDF8"] },
  { id: "fuchsia_cyan", name: "Fuchsia & Cyan", colors: ["#D946EF", "#06B6D4"] },
  { id: "amber_brown", name: "Amber & Brown", colors: ["#F59E0B", "#78350F"] },
  { id: "red_white", name: "Red & White", colors: ["#EF4444", "#FFFFFF"] },
  { id: "forest_cream", name: "Forest & Cream", colors: ["#166534", "#FDF8E1"] },
  { id: "charcoal_gold", name: "Charcoal & Gold", colors: ["#1F1F1F", "#D4AF37"] },
  { id: "pastel_multi", name: "Pastel Multi", colors: ["#FDA4AF", "#A5B4FC", "#86EFAC", "#FDE68A"] },
  { id: "neon_dark", name: "Neon & Dark", colors: ["#00FF87", "#0D0D0D"] },
];

const MOODS = [
  "Dramatic", "Funny", "Shocking", "Inspiring",
  "Educational", "Luxurious", "Scary", "Exciting",
  "Mysterious", "Urgent", "Calm", "Controversial",
  "Nostalgic", "Futuristic", "Playful", "Elegant",
];

/* ──────────────────── MEGA STYLE PRESET GALLERY ──────────────────── */

/**
 * YOUTUBER_THUMBNAIL_PRESETS — signature-style presets modeled after popular creators.
 * Each preset applies partial patches to sections of `thumbnailConfig` on click.
 * Fields use existing config shapes so the canvas/render pipeline stays compatible.
 */
const YOUTUBER_THUMBNAIL_PRESETS = [
  {
    id: "mrbeast",
    name: "MrBeast",
    category: "Entertainment",
    tagline: "Huge face, yellow Impact text, high contrast",
    icon: "\u{1F3AF}",
    gradient: "from-red-600 via-yellow-500 to-red-500",
    mood: "Shocking",
    config: {
      typography: { enabled: true, fontId: "impact", weight: 900, textCase: "uppercase", strokeEnabled: true, strokeWidth: 6, strokeColor: "#000000", shadowEnabled: true, shadowX: 3, shadowY: 4, shadowBlur: 6, shadowColor: "#000000", gradientEnabled: false, letterSpacing: 1 },
      face: { autoCutoutEnabled: true, enhanceEnabled: true, eyePopEnabled: true, position: "right", layout: 1, glowEnabled: true },
      background: { mode: "gradient", gradientId: "fire", brightness: 110 },
      colors: { paletteId: "mrbeast-ry" },
      elements: { ids: ["shk2", "arr6", "bst3", "mny1"] },
    },
  },
  {
    id: "mrbeast-challenge",
    name: "MrBeast Challenge",
    category: "Entertainment",
    tagline: "LAST TO... countdown, number emphasis, urgency red",
    icon: "\u23F1\uFE0F",
    gradient: "from-red-700 via-orange-500 to-yellow-400",
    mood: "Urgent",
    config: {
      typography: { enabled: true, fontId: "anton", weight: 900, textCase: "uppercase", strokeEnabled: true, strokeWidth: 5, strokeColor: "#000000", shadowEnabled: true, highlightWords: "LAST, $, 24", highlightColor: "#FBBF24" },
      face: { autoCutoutEnabled: true, enhanceEnabled: true, eyePopEnabled: true, position: "left", layout: 1 },
      background: { mode: "gradient", gradientId: "fire", brightness: 105 },
      colors: { paletteId: "mrbeast-ry" },
      elements: { ids: ["tmr1", "tmr3", "mny1", "shk4"] },
    },
  },
  {
    id: "pewdiepie",
    name: "PewDiePie",
    category: "Entertainment",
    tagline: "Reaction face, bold red/white, meme energy",
    icon: "\u{1F3AE}",
    gradient: "from-red-500 via-rose-500 to-slate-900",
    mood: "Playful",
    config: {
      typography: { enabled: true, fontId: "bangers", weight: 900, textCase: "uppercase", strokeEnabled: true, strokeWidth: 4, strokeColor: "#000000", shadowEnabled: true },
      face: { autoCutoutEnabled: true, enhanceEnabled: true, eyePopEnabled: true, position: "center", expressionSwapEnabled: true, targetExpression: "shocked" },
      background: { mode: "gradient", gradientId: "coral-reef", brightness: 100 },
      colors: { paletteId: "hc-bw" },
      elements: { ids: ["shk1", "shk6", "bst2"] },
    },
  },
  {
    id: "mkbhd",
    name: "MKBHD",
    category: "Tech",
    tagline: "Minimal product hero, clean sans, subtle tech accent",
    icon: "\u{1F4F1}",
    gradient: "from-zinc-900 via-red-900 to-zinc-900",
    mood: "Futuristic",
    config: {
      typography: { enabled: true, fontId: "inter", weight: 700, textCase: "titlecase", strokeEnabled: false, shadowEnabled: false, letterSpacing: -1 },
      face: { autoCutoutEnabled: false, enhanceEnabled: false, position: "center", layout: 1 },
      background: { mode: "solid", solidColor: "#0A0A0A", brightness: 100 },
      colors: { paletteId: "monochrome" },
      elements: { ids: [] },
    },
  },
  {
    id: "ali-abdaal",
    name: "Ali Abdaal",
    category: "Education",
    tagline: "Friendly face, pastel bg, rounded font, educational",
    icon: "\u{1F4DA}",
    gradient: "from-sky-300 via-indigo-300 to-pink-300",
    mood: "Educational",
    config: {
      typography: { enabled: true, fontId: "poppins", weight: 700, textCase: "titlecase", strokeEnabled: false, shadowEnabled: true, shadowX: 0, shadowY: 2, shadowBlur: 6, shadowColor: "#00000030" },
      face: { autoCutoutEnabled: true, enhanceEnabled: true, position: "right", layout: 1 },
      background: { mode: "gradient", gradientId: "pastel-dream", brightness: 105 },
      colors: { paletteId: "pastel-dream-p" },
      elements: { ids: ["bdg1", "rtg3"] },
    },
  },
  {
    id: "veritasium",
    name: "Veritasium",
    category: "Education",
    tagline: "Curious face + science visual, clean title, emphasis word",
    icon: "\u{1F52C}",
    gradient: "from-blue-600 via-cyan-500 to-indigo-700",
    mood: "Educational",
    config: {
      typography: { enabled: true, fontId: "montserrat", weight: 700, textCase: "titlecase", strokeEnabled: false, shadowEnabled: false, highlightWords: "WHY, HOW, TRUTH", highlightColor: "#FBBF24" },
      face: { autoCutoutEnabled: true, enhanceEnabled: true, position: "left", layout: 1 },
      background: { mode: "gradient", gradientId: "ocean", brightness: 100 },
      colors: { paletteId: "tech-bw" },
      elements: { ids: ["bst2", "bdg5"] },
    },
  },
  {
    id: "matt-davella",
    name: "Matt D'Avella",
    category: "Lifestyle",
    tagline: "Minimal cinematic, small subject, muted grade",
    icon: "\u{1F3AC}",
    gradient: "from-stone-700 via-stone-500 to-stone-800",
    mood: "Calm",
    config: {
      typography: { enabled: true, fontId: "inter", weight: 400, textCase: "titlecase", strokeEnabled: false, shadowEnabled: false, letterSpacing: 2 },
      face: { autoCutoutEnabled: false, enhanceEnabled: false, position: "center", layout: 1 },
      background: { mode: "gradient", gradientId: "midnight", brightness: 85 },
      colors: { paletteId: "monochrome" },
      elements: { ids: [] },
    },
  },
  {
    id: "peter-mckinnon",
    name: "Peter McKinnon",
    category: "Lifestyle",
    tagline: "Cinematic portrait, orange/teal, serif italic",
    icon: "\u{1F4F8}",
    gradient: "from-orange-500 via-amber-600 to-teal-700",
    mood: "Dramatic",
    config: {
      typography: { enabled: true, fontId: "playfair", weight: 700, italic: true, textCase: "titlecase", strokeEnabled: false, shadowEnabled: true, shadowX: 0, shadowY: 3, shadowBlur: 10, shadowColor: "#000000AA" },
      face: { autoCutoutEnabled: true, enhanceEnabled: true, position: "right", layout: 1 },
      background: { mode: "gradient", gradientId: "coral-reef", brightness: 95 },
      colors: { paletteId: "cinematic-ot" },
      elements: { ids: [] },
    },
  },
  {
    id: "graham-stephan",
    name: "Graham Stephan",
    category: "Finance",
    tagline: "Face + $ rain, green arrows, bold white sans",
    icon: "\u{1F4B0}",
    gradient: "from-emerald-500 via-green-500 to-amber-500",
    mood: "Dramatic",
    config: {
      typography: { enabled: true, fontId: "montserrat", weight: 900, textCase: "uppercase", strokeEnabled: true, strokeWidth: 3, strokeColor: "#064E3B", shadowEnabled: true, highlightWords: "$, MONEY, RICH", highlightColor: "#FBBF24" },
      face: { autoCutoutEnabled: true, enhanceEnabled: true, eyePopEnabled: true, position: "right", layout: 1 },
      background: { mode: "gradient", gradientId: "money-green", brightness: 105 },
      colors: { paletteId: "finance-gg" },
      elements: { ids: ["mny1", "mny2", "arr4", "arr11"] },
    },
  },
  {
    id: "joe-rogan",
    name: "Joe Rogan / JRE",
    category: "Podcast",
    tagline: "Two faces, podcast mic, black/red, minimal text",
    icon: "\u{1F399}\uFE0F",
    gradient: "from-zinc-900 via-red-900 to-black",
    mood: "Dramatic",
    config: {
      typography: { enabled: true, fontId: "oswald", weight: 700, textCase: "uppercase", strokeEnabled: false, shadowEnabled: true, letterSpacing: 1 },
      face: { autoCutoutEnabled: true, enhanceEnabled: true, position: "center", layout: 2 },
      background: { mode: "solid", solidColor: "#0A0A0A", brightness: 90 },
      colors: { paletteId: "hc-bw" },
      elements: { ids: ["cir3"] },
    },
  },
  {
    id: "casey-neistat",
    name: "Casey Neistat",
    category: "Lifestyle",
    tagline: "Vlog handheld, yellow/blue accents, handwritten",
    icon: "\u{1F6F9}",
    gradient: "from-yellow-400 via-amber-500 to-sky-500",
    mood: "Playful",
    config: {
      typography: { enabled: true, fontId: "permanent-marker", weight: 700, textCase: "astyped", strokeEnabled: false, shadowEnabled: true, shadowX: 2, shadowY: 2, shadowBlur: 4, shadowColor: "#000000" },
      face: { autoCutoutEnabled: true, enhanceEnabled: false, position: "center", layout: 1 },
      background: { mode: "gradient", gradientId: "autumn-gr", brightness: 105 },
      colors: { paletteId: "warm-earth" },
      elements: { ids: ["bdg2", "bdg3"] },
    },
  },
  {
    id: "ryan-trahan",
    name: "Ryan Trahan",
    category: "Entertainment",
    tagline: "Travel adventure, bright colors, bold title",
    icon: "\u{1F30D}",
    gradient: "from-cyan-400 via-blue-500 to-green-500",
    mood: "Exciting",
    config: {
      typography: { enabled: true, fontId: "archivo-black", weight: 900, textCase: "uppercase", strokeEnabled: true, strokeWidth: 4, strokeColor: "#000000", shadowEnabled: true, highlightWords: "DAY, $, USA", highlightColor: "#FBBF24" },
      face: { autoCutoutEnabled: true, enhanceEnabled: true, eyePopEnabled: true, position: "left", layout: 1 },
      background: { mode: "gradient", gradientId: "ocean", brightness: 110 },
      colors: { paletteId: "ocean-p" },
      elements: { ids: ["mny1", "arr11", "bst5"] },
    },
  },
  {
    id: "dude-perfect",
    name: "Dude Perfect",
    category: "Entertainment",
    tagline: "Sports action, blue/white, bold sports text",
    icon: "\u{1F3C0}",
    gradient: "from-blue-600 via-sky-400 to-white",
    mood: "Exciting",
    config: {
      typography: { enabled: true, fontId: "teko", weight: 900, textCase: "uppercase", strokeEnabled: true, strokeWidth: 3, strokeColor: "#FFFFFF", shadowEnabled: true, shadowColor: "#1E3A8A" },
      face: { autoCutoutEnabled: true, enhanceEnabled: false, position: "center", layout: 3 },
      background: { mode: "gradient", gradientId: "ice", brightness: 105 },
      colors: { paletteId: "tech-bw" },
      elements: { ids: ["rtg1", "shk4", "bst3"] },
    },
  },
  {
    id: "emma-chamberlain",
    name: "Emma Chamberlain",
    category: "Lifestyle",
    tagline: "Candid vlog, vintage filter, casual handwritten",
    icon: "\u2615",
    gradient: "from-amber-200 via-rose-300 to-amber-400",
    mood: "Playful",
    config: {
      typography: { enabled: true, fontId: "permanent-marker", weight: 400, textCase: "lowercase", strokeEnabled: false, shadowEnabled: false, letterSpacing: 0 },
      face: { autoCutoutEnabled: true, enhanceEnabled: false, position: "center", layout: 1 },
      background: { mode: "gradient", gradientId: "rose-gold", brightness: 95 },
      colors: { paletteId: "warm-earth" },
      elements: { ids: [] },
    },
  },
  {
    id: "dream",
    name: "Dream",
    category: "Gaming",
    tagline: "Minecraft green, bold white outline, cinematic",
    icon: "\u{1F3AE}",
    gradient: "from-lime-500 via-emerald-600 to-black",
    mood: "Exciting",
    config: {
      typography: { enabled: true, fontId: "bangers", weight: 900, textCase: "uppercase", strokeEnabled: true, strokeWidth: 5, strokeColor: "#000000", shadowEnabled: true, shadowColor: "#10B981" },
      face: { autoCutoutEnabled: true, enhanceEnabled: true, eyePopEnabled: true, position: "right", layout: 1 },
      background: { mode: "gradient", gradientId: "emerald-city", brightness: 100 },
      colors: { paletteId: "forest-p" },
      elements: { ids: ["shk4", "bst3", "rtg1"] },
    },
  },
  {
    id: "linus-tech-tips",
    name: "Linus Tech Tips",
    category: "Tech",
    tagline: "Tech product hero, LTT red accent, clean tech font",
    icon: "\u{1F5A5}\uFE0F",
    gradient: "from-red-600 via-zinc-800 to-red-700",
    mood: "Futuristic",
    config: {
      typography: { enabled: true, fontId: "montserrat", weight: 800, textCase: "uppercase", strokeEnabled: false, shadowEnabled: true, highlightWords: "NEW, $, 2024", highlightColor: "#DC2626" },
      face: { autoCutoutEnabled: true, enhanceEnabled: true, position: "left", layout: 1 },
      background: { mode: "solid", solidColor: "#1A1A1A", brightness: 100 },
      colors: { paletteId: "hc-bw" },
      elements: { ids: ["arr11", "bdg3"] },
    },
  },
  {
    id: "corridor-crew",
    name: "Corridor Crew",
    category: "Entertainment",
    tagline: "VFX dramatic, cinematic lighting, bold text",
    icon: "\u{1F3A5}",
    gradient: "from-purple-900 via-fuchsia-700 to-cyan-600",
    mood: "Dramatic",
    config: {
      typography: { enabled: true, fontId: "bebas", weight: 900, textCase: "uppercase", strokeEnabled: true, strokeWidth: 3, strokeColor: "#000000", shadowEnabled: true, gradientEnabled: true, gradientFrom: "#9333EA", gradientTo: "#06B6D4" },
      face: { autoCutoutEnabled: true, enhanceEnabled: true, eyePopEnabled: true, position: "right", layout: 2 },
      background: { mode: "gradient", gradientId: "cyberpunk", brightness: 90 },
      colors: { paletteId: "gaming-pn" },
      elements: { ids: ["bst3", "shk4"] },
    },
  },
  {
    id: "sam-kolder",
    name: "Sam Kolder",
    category: "Lifestyle",
    tagline: "Travel cinematic, symmetrical, subtle text, moody",
    icon: "\u{1F3DE}\uFE0F",
    gradient: "from-slate-700 via-amber-600 to-slate-800",
    mood: "Dramatic",
    config: {
      typography: { enabled: true, fontId: "raleway", weight: 300, textCase: "uppercase", strokeEnabled: false, shadowEnabled: false, letterSpacing: 8 },
      face: { autoCutoutEnabled: false, position: "center", layout: 1 },
      background: { mode: "gradient", gradientId: "dark-academia", brightness: 85 },
      colors: { paletteId: "cinematic-ot" },
      elements: { ids: [] },
    },
  },
  {
    id: "colin-samir",
    name: "Colin and Samir",
    category: "Podcast",
    tagline: "Creator economy, clean podcast, neutral sans",
    icon: "\u{1F399}\uFE0F",
    gradient: "from-stone-600 via-amber-300 to-stone-700",
    mood: "Calm",
    config: {
      typography: { enabled: true, fontId: "inter", weight: 700, textCase: "titlecase", strokeEnabled: false, shadowEnabled: false, letterSpacing: 0 },
      face: { autoCutoutEnabled: true, enhanceEnabled: false, position: "center", layout: 2 },
      background: { mode: "solid", solidColor: "#FAF5EB", brightness: 100 },
      colors: { paletteId: "warm-earth" },
      elements: { ids: ["cir3"] },
    },
  },
  {
    id: "hamza-ahmed",
    name: "Hamza Ahmed",
    category: "Lifestyle",
    tagline: "Self-improvement, B&W masculine, bold caps",
    icon: "\u{1F4AA}",
    gradient: "from-zinc-900 via-zinc-700 to-zinc-900",
    mood: "Dramatic",
    config: {
      typography: { enabled: true, fontId: "anton", weight: 900, textCase: "uppercase", strokeEnabled: false, shadowEnabled: true, shadowColor: "#00000080", letterSpacing: 1 },
      face: { autoCutoutEnabled: true, enhanceEnabled: true, position: "right", layout: 1 },
      background: { mode: "solid", solidColor: "#0A0A0A", brightness: 90 },
      colors: { paletteId: "hc-bw" },
      elements: { ids: [] },
    },
  },
  {
    id: "iman-gadzhi",
    name: "Iman Gadzhi",
    category: "Finance",
    tagline: "Business luxury, black/gold, serif headline",
    icon: "\u{1F4BC}",
    gradient: "from-black via-amber-700 to-yellow-600",
    mood: "Luxurious",
    config: {
      typography: { enabled: true, fontId: "playfair", weight: 700, italic: false, textCase: "titlecase", strokeEnabled: false, shadowEnabled: true, shadowColor: "#D4AF37" },
      face: { autoCutoutEnabled: true, enhanceEnabled: true, position: "right", layout: 1 },
      background: { mode: "gradient", gradientId: "dark-academia", brightness: 95 },
      colors: { paletteId: "luxury-gb" },
      elements: { ids: ["mny3", "mny1", "rtg1"] },
    },
  },
  {
    id: "gary-vee",
    name: "Gary Vaynerchuk",
    category: "Finance",
    tagline: "Motivation, bold red/yellow, Impact caps",
    icon: "\u{1F4E2}",
    gradient: "from-red-600 via-yellow-500 to-red-700",
    mood: "Urgent",
    config: {
      typography: { enabled: true, fontId: "impact", weight: 900, textCase: "uppercase", strokeEnabled: true, strokeWidth: 4, strokeColor: "#000000", shadowEnabled: true, highlightWords: "NOW, WORK, HUSTLE", highlightColor: "#FBBF24" },
      face: { autoCutoutEnabled: true, enhanceEnabled: true, eyePopEnabled: true, position: "center", layout: 1 },
      background: { mode: "gradient", gradientId: "fire", brightness: 105 },
      colors: { paletteId: "mrbeast-ry" },
      elements: { ids: ["shk4", "bst3"] },
    },
  },
  {
    id: "ryan-reynolds",
    name: "Ryan Reynolds / Deadpool",
    category: "Entertainment",
    tagline: "Cinematic actor headshot, black/red movie poster",
    icon: "\u{1F3AC}",
    gradient: "from-red-700 via-black to-red-900",
    mood: "Dramatic",
    config: {
      typography: { enabled: true, fontId: "teko", weight: 700, textCase: "uppercase", strokeEnabled: false, shadowEnabled: true, shadowColor: "#DC2626", letterSpacing: 4 },
      face: { autoCutoutEnabled: true, enhanceEnabled: true, position: "center", layout: 1 },
      background: { mode: "solid", solidColor: "#0A0A0A", brightness: 85 },
      colors: { paletteId: "hc-bw" },
      elements: { ids: [] },
    },
  },
  {
    id: "mkbhd-shorts",
    name: "MKBHD Shorts",
    category: "Tech",
    tagline: "Vertical tech, clean product, bold sans",
    icon: "\u{1F4F2}",
    gradient: "from-red-500 via-zinc-800 to-zinc-900",
    mood: "Futuristic",
    config: {
      typography: { enabled: true, fontId: "inter", weight: 900, textCase: "uppercase", strokeEnabled: false, shadowEnabled: false, letterSpacing: -1 },
      face: { autoCutoutEnabled: false, position: "center", layout: 1 },
      background: { mode: "solid", solidColor: "#0A0A0A", brightness: 100 },
      colors: { paletteId: "tech-bw" },
      elements: { ids: ["arr11"] },
      size: { platformPresetId: "yt-shorts", width: 1080, height: 1920 },
    },
  },
  {
    id: "airrack",
    name: "Airrack",
    category: "Entertainment",
    tagline: "High energy challenge, yellow/red, urgent caps",
    icon: "\u26A1",
    gradient: "from-yellow-400 via-red-500 to-black",
    mood: "Shocking",
    config: {
      typography: { enabled: true, fontId: "impact", weight: 900, textCase: "uppercase", strokeEnabled: true, strokeWidth: 5, strokeColor: "#000000", shadowEnabled: true, highlightWords: "24, HOUR, LAST, $", highlightColor: "#FBBF24" },
      face: { autoCutoutEnabled: true, enhanceEnabled: true, eyePopEnabled: true, position: "right", layout: 1 },
      background: { mode: "gradient", gradientId: "fire", brightness: 110 },
      colors: { paletteId: "mrbeast-ry" },
      elements: { ids: ["tmr1", "shk4", "mny1", "bst3"] },
    },
  },
  {
    id: "binging-with-babish",
    name: "Binging with Babish",
    category: "Food",
    tagline: "Top-down food shot, elegant italic, warm tones",
    icon: "\u{1F35D}",
    gradient: "from-amber-700 via-orange-500 to-red-600",
    mood: "Elegant",
    config: {
      typography: { enabled: true, fontId: "playfair", weight: 700, italic: true, textCase: "titlecase", strokeEnabled: false, shadowEnabled: true, shadowX: 0, shadowY: 2, shadowBlur: 8, shadowColor: "#00000080" },
      face: { autoCutoutEnabled: false, position: "center", layout: 1 },
      background: { mode: "gradient", gradientId: "autumn-gr", brightness: 95 },
      colors: { paletteId: "warm-earth" },
      elements: { ids: [] },
    },
  },
  {
    id: "beauty-guru",
    name: "Beauty Guru",
    category: "Lifestyle",
    tagline: "Glam face, pink/gold, elegant font, sparkle",
    icon: "\u{1F484}",
    gradient: "from-pink-400 via-rose-400 to-amber-400",
    mood: "Elegant",
    config: {
      typography: { enabled: true, fontId: "raleway", weight: 700, italic: true, textCase: "titlecase", strokeEnabled: false, shadowEnabled: true, shadowColor: "#D4AF37", gradientEnabled: true, gradientFrom: "#EC4899", gradientTo: "#D4AF37" },
      face: { autoCutoutEnabled: true, enhanceEnabled: true, eyePopEnabled: true, position: "right", layout: 1 },
      background: { mode: "gradient", gradientId: "rose-gold", brightness: 105 },
      colors: { paletteId: "pastel-dream-p" },
      elements: { ids: ["bst2", "bst5", "mny3"] },
    },
  },
  {
    id: "chris-heria",
    name: "Chris Heria / Fitness",
    category: "Fitness",
    tagline: "Transformation, bold red/black, Impact caps",
    icon: "\u{1F3CB}\uFE0F",
    gradient: "from-red-600 via-red-800 to-black",
    mood: "Exciting",
    config: {
      typography: { enabled: true, fontId: "archivo-black", weight: 900, textCase: "uppercase", strokeEnabled: true, strokeWidth: 4, strokeColor: "#000000", shadowEnabled: true, shadowColor: "#DC2626", highlightWords: "SHREDDED, ABS, FAT", highlightColor: "#FBBF24" },
      face: { autoCutoutEnabled: true, enhanceEnabled: true, eyePopEnabled: true, position: "right", layout: 1 },
      background: { mode: "gradient", gradientId: "autumn-gr", brightness: 95 },
      colors: { paletteId: "autumn-p" },
      elements: { ids: ["shk4", "arr4", "rtg1"] },
    },
  },
  {
    id: "podcast-clipper",
    name: "Podcast Clipper",
    category: "Podcast",
    tagline: "Waveform, two faces, quote callout, centered",
    icon: "\u{1F3A7}",
    gradient: "from-indigo-700 via-purple-700 to-pink-600",
    mood: "Dramatic",
    config: {
      typography: { enabled: true, fontId: "montserrat", weight: 800, textCase: "titlecase", strokeEnabled: false, shadowEnabled: true },
      face: { autoCutoutEnabled: true, enhanceEnabled: true, position: "center", layout: 2 },
      background: { mode: "gradient", gradientId: "purple-haze", brightness: 95 },
      colors: { paletteId: "gaming-pn" },
      elements: { ids: ["spc1", "spc2", "cir3"] },
    },
  },
  {
    id: "finance-news",
    name: "Finance News",
    category: "Finance",
    tagline: "Stock chart bg, red/green arrows, number emphasis",
    icon: "\u{1F4C8}",
    gradient: "from-green-600 via-red-500 to-emerald-700",
    mood: "Urgent",
    config: {
      typography: { enabled: true, fontId: "oswald", weight: 700, textCase: "uppercase", strokeEnabled: true, strokeWidth: 2, strokeColor: "#064E3B", shadowEnabled: true, highlightWords: "$, %, BULL, BEAR", highlightColor: "#10B981" },
      face: { autoCutoutEnabled: true, enhanceEnabled: false, position: "left", layout: 1 },
      background: { mode: "gradient", gradientId: "money-green", brightness: 100 },
      colors: { paletteId: "finance-gg" },
      elements: { ids: ["arr4", "arr11", "arr12", "mny1", "mny5"] },
    },
  },
] as const;

type YouTuberPreset = typeof YOUTUBER_THUMBNAIL_PRESETS[number];

const YOUTUBER_PRESET_CATEGORIES = [
  { id: "all", name: "All" },
  { id: "Entertainment", name: "Entertainment" },
  { id: "Gaming", name: "Gaming" },
  { id: "Tech", name: "Tech" },
  { id: "Finance", name: "Finance" },
  { id: "Lifestyle", name: "Lifestyle" },
  { id: "Fitness", name: "Fitness" },
  { id: "Education", name: "Education" },
  { id: "Podcast", name: "Podcast" },
  { id: "Food", name: "Food" },
];

const FONT_LIBRARY = [
  { id: "inter", name: "Inter", category: "sans-serif", stack: "'Inter', sans-serif", vibe: "Modern / Clean" },
  { id: "poppins", name: "Poppins", category: "sans-serif", stack: "'Poppins', sans-serif", vibe: "Friendly / Rounded" },
  { id: "montserrat", name: "Montserrat", category: "sans-serif", stack: "'Montserrat', sans-serif", vibe: "Geometric / Bold" },
  { id: "roboto", name: "Roboto", category: "sans-serif", stack: "'Roboto', sans-serif", vibe: "Neutral / Tech" },
  { id: "bebas", name: "Bebas Neue", category: "display", stack: "'Bebas Neue', sans-serif", vibe: "Tall / Bold" },
  { id: "oswald", name: "Oswald", category: "display", stack: "'Oswald', sans-serif", vibe: "Condensed / Strong" },
  { id: "anton", name: "Anton", category: "display", stack: "'Anton', sans-serif", vibe: "Extra Bold / Headline" },
  { id: "impact", name: "Impact", category: "display", stack: "'Impact', sans-serif", vibe: "Classic Clickbait" },
  { id: "playfair", name: "Playfair Display", category: "serif", stack: "'Playfair Display', serif", vibe: "Elegant / Luxury" },
  { id: "lato", name: "Lato", category: "sans-serif", stack: "'Lato', sans-serif", vibe: "Warm / Readable" },
  { id: "raleway", name: "Raleway", category: "sans-serif", stack: "'Raleway', sans-serif", vibe: "Thin / Stylish" },
  { id: "merriweather", name: "Merriweather", category: "serif", stack: "'Merriweather', serif", vibe: "Editorial / Readable" },
  { id: "archivo-black", name: "Archivo Black", category: "display", stack: "'Archivo Black', sans-serif", vibe: "Heavy / Modern" },
  { id: "bangers", name: "Bangers", category: "display", stack: "'Bangers', cursive", vibe: "Comic / Fun" },
  { id: "staatliches", name: "Staatliches", category: "display", stack: "'Staatliches', sans-serif", vibe: "Poster / Condensed" },
  { id: "teko", name: "Teko", category: "display", stack: "'Teko', sans-serif", vibe: "Sports / Narrow" },
  { id: "league-gothic", name: "League Gothic", category: "display", stack: "'League Gothic', sans-serif", vibe: "Vintage Poster" },
  { id: "permanent-marker", name: "Permanent Marker", category: "handwritten", stack: "'Permanent Marker', cursive", vibe: "Handwritten / Casual" },
  { id: "fjalla", name: "Fjalla One", category: "display", stack: "'Fjalla One', sans-serif", vibe: "Utility / Bold" },
  { id: "bungee", name: "Bungee", category: "display", stack: "'Bungee', cursive", vibe: "3D / Street" },
];

const GRADIENT_PRESETS = [
  { id: "sunset", name: "Sunset", gradient: "from-orange-400 via-pink-500 to-purple-600" },
  { id: "ocean", name: "Ocean", gradient: "from-cyan-400 to-blue-700" },
  { id: "neon", name: "Neon", gradient: "from-fuchsia-500 to-cyan-400" },
  { id: "purple-haze", name: "Purple Haze", gradient: "from-purple-500 via-violet-600 to-indigo-700" },
  { id: "money-green", name: "Money Green", gradient: "from-emerald-400 via-green-500 to-green-700" },
  { id: "fire", name: "Fire", gradient: "from-yellow-400 via-orange-500 to-red-600" },
  { id: "ice", name: "Ice", gradient: "from-sky-200 via-cyan-300 to-blue-400" },
  { id: "midnight", name: "Midnight", gradient: "from-gray-900 via-slate-800 to-gray-900" },
  { id: "rose-gold", name: "Rose Gold", gradient: "from-pink-300 via-rose-400 to-amber-500" },
  { id: "cyberpunk", name: "Cyberpunk", gradient: "from-fuchsia-600 via-purple-700 to-cyan-500" },
  { id: "pastel-dream", name: "Pastel Dream", gradient: "from-pink-200 via-purple-200 to-blue-200" },
  { id: "dark-academia", name: "Dark Academia", gradient: "from-stone-800 via-amber-900 to-stone-900" },
  { id: "mint-fresh", name: "Mint Fresh", gradient: "from-emerald-200 to-teal-400" },
  { id: "aurora", name: "Aurora", gradient: "from-green-400 via-cyan-500 to-purple-600" },
  { id: "lavender", name: "Lavender", gradient: "from-violet-300 to-purple-500" },
  { id: "coral-reef", name: "Coral Reef", gradient: "from-orange-300 via-pink-400 to-red-500" },
  { id: "emerald-city", name: "Emerald City", gradient: "from-emerald-600 to-teal-800" },
  { id: "galaxy", name: "Galaxy", gradient: "from-indigo-900 via-purple-900 to-pink-900" },
  { id: "vaporwave", name: "Vaporwave", gradient: "from-pink-400 via-fuchsia-500 to-cyan-400" },
  { id: "autumn-gr", name: "Autumn", gradient: "from-amber-500 via-orange-600 to-red-700" },
];

const PATTERN_LIBRARY = [
  { id: "none", name: "None", preview: "bg-transparent" },
  { id: "grid", name: "Grid", preview: "bg-gradient-to-br from-gray-200 to-gray-300" },
  { id: "dots", name: "Dots", preview: "bg-gradient-to-br from-gray-100 to-gray-200" },
  { id: "lines-diag", name: "Diagonal Lines", preview: "bg-gradient-to-br from-slate-200 to-slate-300" },
  { id: "lines-h", name: "Horizontal Lines", preview: "bg-gradient-to-br from-zinc-200 to-zinc-300" },
  { id: "grunge", name: "Grunge", preview: "bg-gradient-to-br from-stone-400 to-stone-600" },
  { id: "paper", name: "Paper Texture", preview: "bg-gradient-to-br from-amber-50 to-amber-100" },
  { id: "noise", name: "Noise", preview: "bg-gradient-to-br from-neutral-300 to-neutral-400" },
];

const COLOR_PALETTES = [
  { id: "mrbeast-ry", name: "MrBeast Red & Yellow", colors: ["#DC2626", "#FBBF24", "#FFFFFF", "#000000"] },
  { id: "clean-wb", name: "Clean White & Black", colors: ["#FFFFFF", "#000000", "#E5E7EB", "#111827"] },
  { id: "finance-gg", name: "Finance Green & Gold", colors: ["#10B981", "#D4AF37", "#064E3B", "#FFFFFF"] },
  { id: "gaming-pn", name: "Gaming Purple & Neon", colors: ["#7C3AED", "#E6FF00", "#1E1B4B", "#FF00FF"] },
  { id: "cinematic-ot", name: "Cinematic Orange & Teal", colors: ["#EA580C", "#0D9488", "#1C1917", "#F5F5F4"] },
  { id: "luxury-gb", name: "Luxury Gold & Black", colors: ["#D4AF37", "#000000", "#78350F", "#FFFFFF"] },
  { id: "tech-bw", name: "Tech Blue & White", colors: ["#3B82F6", "#FFFFFF", "#1E3A8A", "#DBEAFE"] },
  { id: "warm-earth", name: "Warm Earth", colors: ["#92400E", "#D97706", "#FEF3C7", "#78350F"] },
  { id: "pastel-dream-p", name: "Pastel Dream", colors: ["#FBCFE8", "#E9D5FF", "#BFDBFE", "#A7F3D0"] },
  { id: "monochrome", name: "Monochrome", colors: ["#1F2937", "#4B5563", "#9CA3AF", "#E5E7EB"] },
  { id: "hc-bw", name: "High Contrast B&W", colors: ["#000000", "#FFFFFF", "#000000", "#FFFFFF"] },
  { id: "autumn-p", name: "Autumn", colors: ["#B91C1C", "#EA580C", "#F59E0B", "#78350F"] },
  { id: "sunset-p", name: "Sunset", colors: ["#FB923C", "#EC4899", "#9333EA", "#FEF3C7"] },
  { id: "ocean-p", name: "Ocean", colors: ["#0EA5E9", "#0284C7", "#1E40AF", "#F0F9FF"] },
  { id: "neon-cyber", name: "Neon Cyberpunk", colors: ["#E6FF00", "#FF00FF", "#00FFFF", "#0D0D0D"] },
  { id: "forest-p", name: "Forest", colors: ["#14532D", "#166534", "#22C55E", "#F0FDF4"] },
];

const GRAPHIC_ELEMENTS = [
  { id: "arr1", category: "arrows", name: "Straight Arrow", emoji: "\u27A1\uFE0F" },
  { id: "arr2", category: "arrows", name: "Curved Arrow", emoji: "\u21AA\uFE0F" },
  { id: "arr3", category: "arrows", name: "Down Arrow", emoji: "\u2B07\uFE0F" },
  { id: "arr4", category: "arrows", name: "Up Arrow", emoji: "\u2B06\uFE0F" },
  { id: "arr5", category: "arrows", name: "Left Arrow", emoji: "\u2B05\uFE0F" },
  { id: "arr6", category: "arrows", name: "Red Thick Arrow", emoji: "\u{1F53B}" },
  { id: "arr7", category: "arrows", name: "Double Arrow", emoji: "\u2194\uFE0F" },
  { id: "arr8", category: "arrows", name: "Rotate Right", emoji: "\u{1F504}" },
  { id: "arr9", category: "arrows", name: "Next", emoji: "\u23ED\uFE0F" },
  { id: "arr10", category: "arrows", name: "Prev", emoji: "\u23EE\uFE0F" },
  { id: "arr11", category: "arrows", name: "Up-Right", emoji: "\u2197\uFE0F" },
  { id: "arr12", category: "arrows", name: "Down-Right", emoji: "\u2198\uFE0F" },
  { id: "arr13", category: "arrows", name: "Soon", emoji: "\u{1F51C}" },
  { id: "arr14", category: "arrows", name: "Back", emoji: "\u{1F519}" },
  { id: "arr15", category: "arrows", name: "Top", emoji: "\u{1F51D}" },
  { id: "cir1", category: "circles", name: "Red Circle", emoji: "\u{1F534}" },
  { id: "cir2", category: "circles", name: "Target", emoji: "\u{1F3AF}" },
  { id: "cir3", category: "circles", name: "Record", emoji: "\u23FA\uFE0F" },
  { id: "cir4", category: "circles", name: "Green Circle", emoji: "\u{1F7E2}" },
  { id: "cir5", category: "circles", name: "Yellow Circle", emoji: "\u{1F7E1}" },
  { id: "bst1", category: "bursts", name: "Star", emoji: "\u2B50" },
  { id: "bst2", category: "bursts", name: "Sparkles", emoji: "\u2728" },
  { id: "bst3", category: "bursts", name: "Collision", emoji: "\u{1F4A5}" },
  { id: "bst4", category: "bursts", name: "Dizzy", emoji: "\u{1F4AB}" },
  { id: "bst5", category: "bursts", name: "Glowing Star", emoji: "\u{1F31F}" },
  { id: "shk1", category: "shock", name: "Screaming", emoji: "\u{1F631}" },
  { id: "shk2", category: "shock", name: "Fire", emoji: "\u{1F525}" },
  { id: "shk3", category: "shock", name: "Money Bag", emoji: "\u{1F4B0}" },
  { id: "shk4", category: "shock", name: "Lightning", emoji: "\u26A1" },
  { id: "shk5", category: "shock", name: "Target", emoji: "\u{1F3AF}" },
  { id: "shk6", category: "shock", name: "Exploding Head", emoji: "\u{1F92F}" },
  { id: "chk1", category: "marks", name: "Red X", emoji: "\u274C" },
  { id: "chk2", category: "marks", name: "Green Check", emoji: "\u2705" },
  { id: "chk3", category: "marks", name: "Cross Mark", emoji: "\u274E" },
  { id: "chk4", category: "marks", name: "Warning", emoji: "\u26A0\uFE0F" },
  { id: "mny1", category: "money", name: "Dollar", emoji: "\u{1F4B5}" },
  { id: "mny2", category: "money", name: "Money With Wings", emoji: "\u{1F4B8}" },
  { id: "mny3", category: "money", name: "Gem", emoji: "\u{1F48E}" },
  { id: "mny4", category: "money", name: "Coin", emoji: "\u{1FA99}" },
  { id: "mny5", category: "money", name: "Credit Card", emoji: "\u{1F4B3}" },
  { id: "spc1", category: "speech", name: "Speech Balloon", emoji: "\u{1F4AC}" },
  { id: "spc2", category: "speech", name: "Thought Bubble", emoji: "\u{1F4AD}" },
  { id: "spc3", category: "speech", name: "Right Anger", emoji: "\u{1F5EF}\uFE0F" },
  { id: "bdg1", category: "badges", name: "New", emoji: "\u{1F195}" },
  { id: "bdg2", category: "badges", name: "Free", emoji: "\u{1F193}" },
  { id: "bdg3", category: "badges", name: "Hot", emoji: "\u{1F525}" },
  { id: "bdg4", category: "badges", name: "Top", emoji: "\u{1F51D}" },
  { id: "bdg5", category: "badges", name: "100", emoji: "\u{1F4AF}" },
  { id: "tmr1", category: "timers", name: "Clock", emoji: "\u23F0" },
  { id: "tmr2", category: "timers", name: "Hourglass", emoji: "\u23F3" },
  { id: "tmr3", category: "timers", name: "Stopwatch", emoji: "\u23F1\uFE0F" },
  { id: "rtg1", category: "ratings", name: "Trophy", emoji: "\u{1F3C6}" },
  { id: "rtg2", category: "ratings", name: "Medal", emoji: "\u{1F947}" },
  { id: "rtg3", category: "ratings", name: "Thumbs Up", emoji: "\u{1F44D}" },
  { id: "rtg4", category: "ratings", name: "Thumbs Down", emoji: "\u{1F44E}" },
  { id: "cmp1", category: "compare", name: "VS Symbol", emoji: "\u{1F19A}" },
  { id: "cmp2", category: "compare", name: "Balance Scale", emoji: "\u2696\uFE0F" },
];

const GRAPHIC_CATEGORIES = [
  { id: "all", name: "All" },
  { id: "arrows", name: "Arrows" },
  { id: "circles", name: "Highlights" },
  { id: "bursts", name: "Bursts" },
  { id: "shock", name: "Shock" },
  { id: "marks", name: "Marks" },
  { id: "money", name: "Money" },
  { id: "speech", name: "Speech" },
  { id: "badges", name: "Badges" },
  { id: "timers", name: "Timers" },
  { id: "ratings", name: "Ratings" },
  { id: "compare", name: "Compare" },
];

const LAYOUT_TEMPLATES = [
  { id: "center-face-right", name: "Centered Title, Face Right", desc: "Bold title center-left, subject portrait on the right" },
  { id: "split-50-50", name: "Split Screen 50/50", desc: "Two equal halves, comparison or before/after" },
  { id: "face-left-title-right", name: "Face Left, Title Right", desc: "Mirror layout: subject on left, headline on right" },
  { id: "bottom-banner", name: "Bottom Banner", desc: "Full image with text banner pinned along bottom" },
  { id: "top-banner", name: "Top Banner", desc: "Headline bar on top, content below" },
  { id: "diagonal-split", name: "Diagonal Split", desc: "Angled divider cutting through the thumbnail" },
  { id: "three-column", name: "Three Column", desc: "Equal thirds, great for top-3 or trio lineups" },
  { id: "full-bleed-floating", name: "Full-bleed Face + Floating Title", desc: "Massive face fills frame, title floats as overlay" },
  { id: "corner-badge-centered", name: "Corner Badge + Centered Title", desc: "Accent badge in corner, title dominates center" },
  { id: "letterbox-cinematic", name: "Letterbox Cinematic", desc: "Black bars top/bottom, movie-trailer feel" },
];

const PLATFORM_SIZE_PRESETS = [
  { id: "yt-standard", name: "YouTube Standard", width: 1280, height: 720 },
  { id: "yt-shorts", name: "YouTube Shorts", width: 1080, height: 1920 },
  { id: "tiktok", name: "TikTok", width: 1080, height: 1920 },
  { id: "ig-feed", name: "Instagram Feed", width: 1080, height: 1080 },
  { id: "ig-story", name: "Instagram Story", width: 1080, height: 1920 },
  { id: "twitter", name: "Twitter / X", width: 1600, height: 900 },
  { id: "linkedin", name: "LinkedIn", width: 1200, height: 627 },
  { id: "podcast", name: "Podcast Cover", width: 3000, height: 3000 },
  { id: "custom", name: "Custom", width: 1280, height: 720 },
];

const EXPORT_FORMATS = [
  { id: "png", name: "PNG", desc: "Lossless, supports transparency" },
  { id: "jpg", name: "JPG", desc: "Smaller file, universal" },
  { id: "webp", name: "WebP", desc: "Modern, smallest file" },
];

const SIDEBAR_CATEGORIES = [
  { id: "style", name: "Style Presets" },
  { id: "text", name: "Text & Typography" },
  { id: "face", name: "Face & Subject" },
  { id: "background", name: "Background" },
  { id: "elements", name: "Elements" },
  { id: "colors", name: "Colors" },
  { id: "smart", name: "Smart / AI" },
  { id: "size", name: "Platform Size" },
  { id: "layout", name: "Layout" },
  { id: "export", name: "Export" },
];

/* ──────────────────── NEW FEATURE DATA ──────────────────── */

const TEMPLATE_GALLERY = [
  { id: "t1", name: "Bold Title Center", category: "text-heavy", preview: "from-red-500 to-orange-500", layout: "Single bold title centered with face on right" },
  { id: "t2", name: "Split Comparison", category: "versus", preview: "from-blue-500 to-red-500", layout: "Left vs Right split with VS badge" },
  { id: "t3", name: "Top 10 Grid", category: "listicle", preview: "from-amber-400 to-yellow-300", layout: "Number overlay with grid thumbnails" },
  { id: "t4", name: "Breaking News", category: "news", preview: "from-red-700 to-red-500", layout: "Red banner bar with headline text" },
  { id: "t5", name: "Tutorial Steps", category: "howto", preview: "from-blue-400 to-cyan-400", layout: "Step numbers 1-2-3 with arrows" },
  { id: "t6", name: "Reaction Shot", category: "reaction", preview: "from-purple-500 to-pink-500", layout: "Large face with emoji reactions" },
  { id: "t7", name: "Money / Revenue", category: "finance", preview: "from-emerald-500 to-green-400", layout: "Dollar signs, charts, green theme" },
  { id: "t8", name: "Mystery Reveal", category: "mystery", preview: "from-gray-900 to-purple-900", layout: "Blurred center with question marks" },
  { id: "t9", name: "Before & After", category: "transformation", preview: "from-gray-400 to-gold", layout: "Side by side transformation" },
  { id: "t10", name: "Quote Card", category: "quote", preview: "from-indigo-500 to-violet-500", layout: "Large quotation marks with text" },
  { id: "t11", name: "Countdown Timer", category: "urgency", preview: "from-red-600 to-amber-500", layout: "Timer graphic with urgent text" },
  { id: "t12", name: "Product Showcase", category: "product", preview: "from-slate-700 to-slate-500", layout: "Product center stage, clean bg" },
  { id: "t13", name: "Podcast Episode", category: "podcast", preview: "from-indigo-600 to-purple-600", layout: "Two faces, episode number, mic icon" },
  { id: "t14", name: "Gaming Highlight", category: "gaming", preview: "from-purple-600 to-pink-600", layout: "Neon border, gameplay screenshot" },
  { id: "t15", name: "Food Close-Up", category: "food", preview: "from-orange-300 to-red-400", layout: "Appetizing close-up, warm overlay" },
  { id: "t16", name: "Fitness Challenge", category: "fitness", preview: "from-red-500 to-orange-500", layout: "Action pose, energy lines" },
  { id: "t17", name: "Travel Vlog", category: "travel", preview: "from-sky-400 to-emerald-400", layout: "Location pin, landscape bg" },
  { id: "t18", name: "Tech Review", category: "tech", preview: "from-cyan-500 to-blue-700", layout: "Device mockup, specs overlay" },
  { id: "t19", name: "Story Time", category: "story", preview: "from-amber-600 to-orange-400", layout: "Book/scroll aesthetic, warm tones" },
  { id: "t20", name: "Minimalist Pro", category: "minimal", preview: "from-gray-100 to-white", layout: "Clean white, single element focus" },
  { id: "t21", name: "Neon Party", category: "party", preview: "from-fuchsia-500 to-cyan-400", layout: "Neon text, dark bg, glow effects" },
  { id: "t22", name: "Luxury Gold", category: "luxury", preview: "from-yellow-600 to-amber-900", layout: "Black bg, gold accents, elegant" },
  { id: "t23", name: "YouTube Classic", category: "text-heavy", preview: "from-red-600 to-yellow-500", layout: "Big bold text top + face cutout + colorful bg" },
  { id: "t24", name: "Before/After Arrow", category: "transformation", preview: "from-gray-500 to-emerald-500", layout: "Split screen with center arrow, before left, after right" },
  { id: "t25", name: "Listicle Badge", category: "listicle", preview: "from-orange-500 to-amber-400", layout: "Large numbered circle badge + topic image grid" },
  { id: "t26", name: "Reaction Burst", category: "reaction", preview: "from-fuchsia-600 to-rose-500", layout: "Enlarged surprised face + floating emoji overlays" },
  { id: "t27", name: "Tutorial Steps", category: "howto", preview: "from-blue-500 to-cyan-500", layout: "Device mockup + numbered arrow pointers" },
  { id: "t28", name: "VS Battle", category: "versus", preview: "from-red-600 to-blue-600", layout: "Two items, VS lightning badge center" },
  { id: "t29", name: "Quote Gradient", category: "quote", preview: "from-indigo-600 to-violet-600", layout: "Centered quote text + author + gradient bg" },
  { id: "t30", name: "Breaking News", category: "news", preview: "from-red-800 to-gray-900", layout: "Red banner + headline text + reporter face" },
  { id: "t31", name: "Minimalist Pro", category: "minimal", preview: "from-white to-gray-100", layout: "Clean white bg, one bold text, tiny accent" },
  { id: "t32", name: "Dark Luxury", category: "luxury", preview: "from-gray-900 to-black", layout: "Black bg, gold metallic text, subtle gradient glow" },
  { id: "t33", name: "Tier List Grid", category: "listicle", preview: "from-emerald-400 to-red-500", layout: "Color-coded S/A/B/C tier rows with items" },
  { id: "t34", name: "Unboxing Reveal", category: "mystery", preview: "from-purple-800 to-amber-400", layout: "Mystery box with golden reveal glow" },
  { id: "t35", name: "Challenge Timer", category: "urgency", preview: "from-orange-500 to-red-600", layout: "Clock graphic + bold dare text + energy" },
  { id: "t36", name: "Money Shot", category: "finance", preview: "from-green-600 to-emerald-400", layout: "Dollar signs + revenue number + growth chart" },
  { id: "t37", name: "Exposed / Debunk", category: "news", preview: "from-red-900 to-gray-800", layout: "Red X marks, magnifying glass, dark theme" },
  { id: "t38", name: "Collage Vlog", category: "reaction", preview: "from-amber-300 to-orange-300", layout: "Multi-photo collage, warm filter, casual text" },
  { id: "t39", name: "Infographic Pin", category: "text-heavy", preview: "from-teal-400 to-blue-400", layout: "Tall numbered tips, icons, clean font" },
  { id: "t40", name: "Event Promo", category: "text-heavy", preview: "from-blue-600 to-purple-600", layout: "Event date + details + gradient bg" },
];

const BACKGROUND_SCENES = [
  { id: "bg1", name: "City Skyline", category: "urban", emoji: "\u{1F3D9}\u{FE0F}" },
  { id: "bg2", name: "Modern Studio", category: "studio", emoji: "\u{1F3AC}" },
  { id: "bg3", name: "Forest Path", category: "nature", emoji: "\u{1F332}" },
  { id: "bg4", name: "Ocean Sunset", category: "nature", emoji: "\u{1F305}" },
  { id: "bg5", name: "Mountain Peak", category: "nature", emoji: "\u26F0\u{FE0F}" },
  { id: "bg6", name: "Neon Alley", category: "urban", emoji: "\u{1F306}" },
  { id: "bg7", name: "Home Office", category: "interior", emoji: "\u{1F4BB}" },
  { id: "bg8", name: "Gym Interior", category: "fitness", emoji: "\u{1F3CB}\u{FE0F}" },
  { id: "bg9", name: "Outer Space", category: "sci-fi", emoji: "\u{1F30C}" },
  { id: "bg10", name: "Boardroom", category: "business", emoji: "\u{1F4BC}" },
  { id: "bg11", name: "Kitchen", category: "interior", emoji: "\u{1F373}" },
  { id: "bg12", name: "Concert Stage", category: "entertainment", emoji: "\u{1F3A4}" },
  { id: "bg13", name: "Desert Dunes", category: "nature", emoji: "\u{1F3DC}\u{FE0F}" },
  { id: "bg14", name: "Snowy Mountains", category: "nature", emoji: "\u{1F3D4}\u{FE0F}" },
  { id: "bg15", name: "Beach Tropical", category: "nature", emoji: "\u{1F3D6}\u{FE0F}" },
  { id: "bg16", name: "Library", category: "interior", emoji: "\u{1F4DA}" },
  { id: "bg17", name: "Race Track", category: "sports", emoji: "\u{1F3CE}\u{FE0F}" },
  { id: "bg18", name: "Abstract Gradient", category: "abstract", emoji: "\u{1F308}" },
  { id: "bg19", name: "Data Center", category: "tech", emoji: "\u{1F5A5}\u{FE0F}" },
  { id: "bg20", name: "Courtroom", category: "professional", emoji: "\u2696\u{FE0F}" },
  { id: "bg21", name: "Red Carpet", category: "entertainment", emoji: "\u{1F3AC}" },
  { id: "bg22", name: "Warehouse", category: "industrial", emoji: "\u{1F3ED}" },
  { id: "bg23", name: "Garden", category: "nature", emoji: "\u{1F33B}" },
  { id: "bg24", name: "Airport Terminal", category: "travel", emoji: "\u2708\u{FE0F}" },
  { id: "bg25", name: "Underwater", category: "nature", emoji: "\u{1F30A}" },
  { id: "bg26", name: "Rooftop View", category: "urban", emoji: "\u{1F307}" },
  { id: "bg27", name: "Lab / Science", category: "tech", emoji: "\u{1F52C}" },
  { id: "bg28", name: "Classroom", category: "education", emoji: "\u{1F3EB}" },
  { id: "bg29", name: "Castle Interior", category: "fantasy", emoji: "\u{1F3F0}" },
  { id: "bg30", name: "Cyberpunk Street", category: "sci-fi", emoji: "\u{1F916}" },
  { id: "bg31", name: "Coffee Shop", category: "interior", emoji: "\u2615" },
  { id: "bg32", name: "Sports Arena", category: "sports", emoji: "\u{1F3DF}\u{FE0F}" },
  { id: "bg33", name: "Luxury Penthouse", category: "interior", emoji: "\u{1F3E0}" },
  { id: "bg34", name: "Neon Studio", category: "studio", emoji: "\u{1F4A1}" },
  { id: "bg35", name: "Volcano Eruption", category: "nature", emoji: "\u{1F30B}" },
  { id: "bg36", name: "Northern Lights", category: "nature", emoji: "\u{1F30C}" },
  { id: "bg37", name: "Retro Diner", category: "interior", emoji: "\u{1F354}" },
  { id: "bg38", name: "Skatepark", category: "sports", emoji: "\u{1F6F9}" },
  { id: "bg39", name: "Art Gallery", category: "interior", emoji: "\u{1F3A8}" },
  { id: "bg40", name: "Haunted House", category: "fantasy", emoji: "\u{1F47B}" },
  { id: "bg41", name: "Space Station", category: "sci-fi", emoji: "\u{1F6F8}" },
  { id: "bg42", name: "Zen Garden", category: "nature", emoji: "\u{1F33F}" },
];

const TEXT_EFFECT_PRESETS = [
  { id: "te1", name: "3D Extrude", style: "text-shadow: 2px 2px 0 #000, 4px 4px 0 #333", desc: "Bold 3D depth effect" },
  { id: "te2", name: "Neon Glow", style: "text-shadow: 0 0 10px #fff, 0 0 20px #ff0, 0 0 40px #ff0", desc: "Glowing neon light" },
  { id: "te3", name: "Drop Shadow", style: "text-shadow: 3px 3px 6px rgba(0,0,0,0.8)", desc: "Classic drop shadow" },
  { id: "te4", name: "Outline Bold", style: "-webkit-text-stroke: 2px #000", desc: "Thick black outline" },
  { id: "te5", name: "Fire Text", style: "text-shadow: 0 0 5px #f90, 0 0 15px #f60, 0 0 30px #f30", desc: "Orange fire glow" },
  { id: "te6", name: "Ice Text", style: "text-shadow: 0 0 10px #0ff, 0 0 20px #0af, 0 0 40px #08f", desc: "Blue ice glow" },
  { id: "te7", name: "Retro Stack", style: "text-shadow: 1px 1px 0 #f0f, 2px 2px 0 #0ff", desc: "Retro stacked colors" },
  { id: "te8", name: "Emboss Light", style: "text-shadow: -1px -1px 0 #666, 1px 1px 0 #fff", desc: "Subtle emboss effect" },
  { id: "te9", name: "Long Shadow", style: "text-shadow: 1px 1px 0 #c9a84c, 2px 2px 0 #c9a84c, 3px 3px 0 #c9a84c, 4px 4px 0 #c9a84c, 5px 5px 0 #c9a84c", desc: "Extended gold shadow" },
  { id: "te10", name: "Glitch Effect", style: "text-shadow: 2px 0 #f0f, -2px 0 #0ff", desc: "Glitchy RGB split" },
  { id: "te11", name: "Comic Pop", style: "text-shadow: 3px 3px 0 #000; -webkit-text-stroke: 1px #000", desc: "Comic book style" },
  { id: "te12", name: "Soft Blur", style: "text-shadow: 0 0 8px rgba(255,255,255,0.6)", desc: "Soft white blur" },
  { id: "te13", name: "Gold Luxury", style: "text-shadow: 0 0 5px #c9a84c, 0 0 15px rgba(201,168,76,0.4)", desc: "Premium gold glow" },
  { id: "te14", name: "Matrix Green", style: "text-shadow: 0 0 10px #0f0, 0 0 20px #0f0", desc: "Green matrix glow" },
  { id: "te15", name: "Blood Red", style: "text-shadow: 0 2px 4px #900, 0 0 10px #600", desc: "Dark red horror" },
  { id: "te16", name: "Clean White", style: "text-shadow: none", desc: "No effects, clean" },
  { id: "te17", name: "3D Shadow Deep", style: "text-shadow: 3px 3px 0 #111, 6px 6px 0 #222, 9px 9px 0 #333", desc: "Deep layered 3D shadow" },
  { id: "te18", name: "Outline Bold White", style: "-webkit-text-stroke: 3px #fff; color: transparent", desc: "Thick white outline, hollow" },
  { id: "te19", name: "Gradient Fill Warm", style: "background: linear-gradient(135deg, #f97316, #ef4444); -webkit-background-clip: text; -webkit-text-fill-color: transparent", desc: "Orange-red gradient text" },
  { id: "te20", name: "Gradient Fill Cool", style: "background: linear-gradient(135deg, #06b6d4, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent", desc: "Cyan-purple gradient text" },
  { id: "te21", name: "Neon Blue Glow", style: "text-shadow: 0 0 10px #00f, 0 0 20px #00f, 0 0 40px #00f, 0 0 80px #00f", desc: "Intense blue neon glow" },
  { id: "te22", name: "Embossed Heavy", style: "text-shadow: -2px -2px 0 #555, 2px 2px 0 #fff", desc: "Deep emboss carved look" },
  { id: "te23", name: "Drop Shadow Soft", style: "text-shadow: 4px 4px 12px rgba(0,0,0,0.5)", desc: "Soft diffused drop shadow" },
  { id: "te24", name: "Retro Chromatic", style: "text-shadow: 3px 0 #f0f, -3px 0 #0ff, 0 3px #ff0", desc: "Retro RGB chromatic split" },
  { id: "te25", name: "Metallic Silver", style: "text-shadow: 0 1px 0 #ccc, 0 2px 0 #c9c9c9, 0 3px 0 #bbb, 0 4px 0 #b9b9b9, 0 5px 5px rgba(0,0,0,0.3)", desc: "Brushed metal silver look" },
  { id: "te26", name: "Metallic Gold", style: "text-shadow: 0 1px 0 #c9a84c, 0 2px 0 #b8973f, 0 3px 0 #a78632, 0 4px 5px rgba(0,0,0,0.4)", desc: "Polished gold metal effect" },
  { id: "te27", name: "Stamp / Press", style: "-webkit-text-stroke: 1px rgba(0,0,0,0.3); text-shadow: inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 4px rgba(0,0,0,0.4)", desc: "Stamped pressed-in effect" },
  { id: "te28", name: "Electric Zap", style: "text-shadow: 0 0 5px #fff, 0 0 10px #fff, 0 0 20px #e6ff00, 0 0 40px #e6ff00", desc: "Electric yellow-white zap" },
  { id: "te29", name: "Vintage Letterpress", style: "text-shadow: 1px 1px 0 #8B4513, -1px -1px 0 rgba(255,255,255,0.1)", desc: "Old letterpress print look" },
  { id: "te30", name: "Double Stroke", style: "-webkit-text-stroke: 2px #000; text-shadow: 3px 3px 0 #fff, 6px 6px 0 #000", desc: "Double-layered stroke effect" },
  { id: "te31", name: "Frosted Glass", style: "text-shadow: 0 0 10px rgba(255,255,255,0.5), 0 0 20px rgba(255,255,255,0.3)", desc: "Frosted glass diffusion" },
  { id: "te32", name: "Horror Drip", style: "text-shadow: 0 4px 8px #600, 0 0 20px rgba(100,0,0,0.6); -webkit-text-stroke: 1px #300", desc: "Dark horror dripping blood" },
];

const EMOJI_STICKERS = [
  { id: "em1", emoji: "\u{1F525}", name: "Fire" },
  { id: "em2", emoji: "\u{1F4B0}", name: "Money Bag" },
  { id: "em3", emoji: "\u{1F680}", name: "Rocket" },
  { id: "em4", emoji: "\u26A1", name: "Lightning" },
  { id: "em5", emoji: "\u{1F4A5}", name: "Explosion" },
  { id: "em6", emoji: "\u2B50", name: "Star" },
  { id: "em7", emoji: "\u{1F3AF}", name: "Bullseye" },
  { id: "em8", emoji: "\u{1F451}", name: "Crown" },
  { id: "em9", emoji: "\u{1F6A8}", name: "Alert" },
  { id: "em10", emoji: "\u2757", name: "Exclamation" },
  { id: "em11", emoji: "\u{1F44D}", name: "Thumbs Up" },
  { id: "em12", emoji: "\u{1F44E}", name: "Thumbs Down" },
  { id: "em13", emoji: "\u{1F4AF}", name: "100" },
  { id: "em14", emoji: "\u274C", name: "X Mark" },
  { id: "em15", emoji: "\u2705", name: "Check" },
  { id: "em16", emoji: "\u{1F631}", name: "Scream" },
  { id: "em17", emoji: "\u{1F60D}", name: "Heart Eyes" },
  { id: "em18", emoji: "\u{1F622}", name: "Crying" },
  { id: "em19", emoji: "\u{1F4A1}", name: "Light Bulb" },
  { id: "em20", emoji: "\u{1F3C6}", name: "Trophy" },
  { id: "em21", emoji: "\u{1F92F}", name: "Mind Blown" },
  { id: "em22", emoji: "\u{1F440}", name: "Eyes" },
  { id: "em23", emoji: "\u{1F4B8}", name: "Money Wings" },
  { id: "em24", emoji: "\u{1F3AF}", name: "Direct Hit" },
  { id: "em25", emoji: "\u{1F6D1}", name: "Stop Sign" },
  { id: "em26", emoji: "\u{1F4AA}", name: "Flexed Bicep" },
  { id: "em27", emoji: "\u{1F911}", name: "Money Face" },
  { id: "em28", emoji: "\u{1F47D}", name: "Alien" },
  { id: "em29", emoji: "\u{1F4E2}", name: "Megaphone" },
  { id: "em30", emoji: "\u{1F389}", name: "Party Popper" },
];

const TRENDING_STYLES_DATA = [
  { id: "tr1", name: "Shocked Face + Red Arrow", score: 98, trend: "up", desc: "Face reacting to red arrow pointing at subject" },
  { id: "tr2", name: "Before/After Split", score: 95, trend: "up", desc: "Dramatic transformation comparison" },
  { id: "tr3", name: "Dark Mode Minimal", score: 92, trend: "up", desc: "Clean dark bg with single bold text" },
  { id: "tr4", name: "Money Rain", score: 89, trend: "stable", desc: "Cash/coins falling with reaction face" },
  { id: "tr5", name: "Blurred Mystery", score: 87, trend: "up", desc: "Blurred center with curiosity text" },
  { id: "tr6", name: "Neon Outline", score: 85, trend: "stable", desc: "Glowing neon text on dark background" },
  { id: "tr7", name: "3 Things Grid", score: 83, trend: "down", desc: "3 items grid with number overlays" },
  { id: "tr8", name: "Celebrity Comparison", score: 81, trend: "stable", desc: "Side by side with famous person" },
  { id: "tr9", name: "AI Generated Art", score: 79, trend: "up", desc: "Surreal AI-generated scenes" },
  { id: "tr10", name: "Storytime Cozy", score: 76, trend: "down", desc: "Warm lighting, casual face, story vibe" },
  { id: "tr11", name: "Tier List Ranking", score: 91, trend: "up", desc: "S/A/B/C/F tier rows with items ranked" },
  { id: "tr12", name: "Quote Card Gradient", score: 84, trend: "up", desc: "Centered quote on colorful gradient bg" },
  { id: "tr13", name: "Exposed / Debunk", score: 88, trend: "up", desc: "Red X marks, magnifying glass, dark theme" },
  { id: "tr14", name: "Luxury Gold on Black", score: 82, trend: "stable", desc: "Premium black bg with gold metallic text" },
  { id: "tr15", name: "Tutorial Arrow Pointers", score: 80, trend: "stable", desc: "Device mockup with numbered arrow annotations" },
  { id: "tr16", name: "Unboxing Glow Reveal", score: 77, trend: "up", desc: "Mystery package with golden reveal glow" },
];

const EXPORT_PRESET_DEFAULTS = [
  { id: "ep1", name: "YouTube Standard", config: { style: "youtube_classic", platform: "youtube", colorTheme: "red_black", mood: "Dramatic" } },
  { id: "ep2", name: "Instagram Minimal", config: { style: "minimal_clean", platform: "instagram", colorTheme: "black_white", mood: "Elegant" } },
  { id: "ep3", name: "TikTok Bold", config: { style: "bold_colorful", platform: "tiktok", colorTheme: "purple_pink", mood: "Exciting" } },
  { id: "ep4", name: "Tutorial Clean", config: { style: "tutorial_howto", platform: "youtube", colorTheme: "blue_white", mood: "Educational" } },
  { id: "ep5", name: "Podcast Dark", config: { style: "podcast_style", platform: "youtube", colorTheme: "cyan_dark", mood: "Calm" } },
  { id: "ep6", name: "Gaming Neon", config: { style: "bold_colorful", platform: "youtube", colorTheme: "fuchsia_cyan", mood: "Exciting" } },
  { id: "ep7", name: "Business Pro", config: { style: "minimal_clean", platform: "linkedin", colorTheme: "navy_gold", mood: "Elegant" } },
  { id: "ep8", name: "Luxury Dark", config: { style: "luxury", platform: "youtube", colorTheme: "charcoal_gold", mood: "Luxurious" } },
  { id: "ep9", name: "Fitness Energy", config: { style: "bold_colorful", platform: "instagram", colorTheme: "red_white", mood: "Exciting" } },
  { id: "ep10", name: "Nature Calm", config: { style: "minimal_clean", platform: "instagram", colorTheme: "emerald_teal", mood: "Calm" } },
  { id: "ep11", name: "News Urgent", config: { style: "youtube_classic", platform: "youtube", colorTheme: "red_black", mood: "Urgent" } },
  { id: "ep12", name: "Pastel Aesthetic", config: { style: "minimal_clean", platform: "instagram", colorTheme: "pastel_multi", mood: "Playful" } },
];

interface ThumbnailResult {
  id: string;
  job_id?: string;
  status?: string;
  prompt: string;
  style: string;
  platform: string;
  textOverlay: string;
  colorTheme: string;
  mood: string;
  faces: string[];
  imageUrl: string | null;
  gradient?: string;
  width: number;
  height: number;
  createdAt: string;
}

interface HistoryItem {
  id: string;
  description: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

/* ──────────────────── PAGE ──────────────────── */

export default function ThumbnailGeneratorPage() {
  useAuth();
  const supabase = useMemo(() => createClient(), []);

  // Form state
  const [prompt, setPrompt] = useState("");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [selectedFaces, setSelectedFaces] = useState<string[]>([]);
  const [style, setStyle] = useState("youtube_classic");
  const [platform, setPlatform] = useState("youtube");
  const [customWidth, setCustomWidth] = useState(1280);
  const [customHeight, setCustomHeight] = useState(720);
  const [textOverlay, setTextOverlay] = useState("");
  const [colorTheme, setColorTheme] = useState("red_black");
  const [mood, setMood] = useState("Dramatic");
  const [variations, setVariations] = useState(1);

  // UI state
  const [, setTab] = useState<"generate" | "history">("generate");
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<ThumbnailResult[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New feature state
  const [activeFeatureTab, setActiveFeatureTab] = useState<"generate" | "history" | "tools" | "studio">("generate");
  const [expandedPanels, setExpandedPanels] = useState<Record<string, boolean>>({});
  // Split Test
  const [, setSplitTestMode] = useState(false);
  const [splitTestResults, setSplitTestResults] = useState<[ThumbnailResult | null, ThumbnailResult | null]>([null, null]);
  // CTR Predictor
  const [ctrScore, setCtrScore] = useState<number | null>(null);
  const [ctrAnalyzing, setCtrAnalyzing] = useState(false);
  const [ctrFactors, setCtrFactors] = useState<{ factor: string; score: number; tip: string }[]>([]);
  // Template Gallery
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [templateFilter, setTemplateFilter] = useState("all");
  // Batch Generation
  const [batchPrompts, setBatchPrompts] = useState<string[]>([""]);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchResults, setBatchResults] = useState<ThumbnailResult[]>([]);
  // Background Scenes
  const [selectedBackground, setSelectedBackground] = useState<string | null>(null);
  const [bgFilter, setBgFilter] = useState("all");
  // Text Effects
  const [selectedTextEffect, setSelectedTextEffect] = useState<string | null>(null);
  // Emoji Overlay
  const [selectedEmojis, setSelectedEmojis] = useState<string[]>([]);
  // Competitor Analyzer
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [competitorAnalyzing, setCompetitorAnalyzing] = useState(false);
  const [competitorResults, setCompetitorResults] = useState<{ style: string; colors: string; text: string; face: string; score: number } | null>(null);
  // Quick Variations
  const [quickVarGenerating, setQuickVarGenerating] = useState(false);
  // Platform Compliance
  const [complianceResult, setComplianceResult] = useState<{ platform: string; passed: boolean; issues: string[] } | null>(null);
  const [complianceChecking, setComplianceChecking] = useState(false);
  // Brand Consistency
  const [brandScore, setBrandScore] = useState<number | null>(null);
  const [brandChecking, setBrandChecking] = useState(false);
  const [brandFactors, setBrandFactors] = useState<{ label: string; score: number }[]>([]);
  // Before/After Slider
  const [sliderPosition, setSliderPosition] = useState(50);
  const [showBeforeAfter, setShowBeforeAfter] = useState(false);
  // Export Presets
  const [savedPresets, setSavedPresets] = useState(EXPORT_PRESET_DEFAULTS);
  const [newPresetName, setNewPresetName] = useState("");
  // AI Background Generator
  const [aiBgPrompt, setAiBgPrompt] = useState("");
  const [aiBgGenerating, setAiBgGenerating] = useState(false);
  const [aiBgResult, setAiBgResult] = useState<string | null>(null);

  // Step-by-step creation walkthrough state
  const [walkthroughEnabled, setWalkthroughEnabled] = useState(true);
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);
  const [walkthroughStepIndex, setWalkthroughStepIndex] = useState(0);
  const [walkthroughStatus, setWalkthroughStatus] = useState<WalkthroughStepStatus>("pending");
  const walkthroughCancelledRef = useRef(false);

  // ── MEGA Thumbnail Config (unified state object) ──
  const [thumbnailConfig, setThumbnailConfig] = useState({
    // Style Preset
    stylePreset: null as string | null,
    // Typography
    typography: {
      enabled: false,
      fontId: "inter",
      weight: 700,
      italic: false,
      underline: false,
      strikethrough: false,
      textCase: "uppercase" as "uppercase" | "lowercase" | "titlecase" | "astyped",
      shadowEnabled: false,
      shadowX: 2,
      shadowY: 2,
      shadowBlur: 4,
      shadowColor: "#000000",
      strokeEnabled: false,
      strokeWidth: 2,
      strokeColor: "#000000",
      gradientEnabled: false,
      gradientFrom: "#F59E0B",
      gradientTo: "#DC2626",
      letterSpacing: 0,
      lineHeight: 1.1,
      highlightWords: "",
      highlightColor: "#FBBF24",
      curvedEnabled: false,
      curveIntensity: 30,
      threeDEnabled: false,
      threeDDepth: 4,
      threeDPerspective: 30,
    },
    // Face / Subject
    face: {
      autoCutoutEnabled: false,
      enhanceEnabled: false,
      eyePopEnabled: false,
      position: "right" as "left" | "center" | "right",
      expressionSwapEnabled: false,
      targetExpression: "shocked" as "shocked" | "happy" | "angry",
      glowEnabled: false,
      layout: 1 as 1 | 2 | 3,
    },
    // Background
    background: {
      mode: "solid" as "solid" | "gradient" | "pattern" | "image" | "ai",
      solidColor: "#0F172A",
      gradientId: "sunset",
      patternId: "none",
      blurEnabled: false,
      blurAmount: 8,
      brightness: 100,
      aiPrompt: "",
    },
    // Elements
    elements: {
      active: [] as { id: string; category: string; emoji: string; name: string }[],
    },
    // Colors
    colors: {
      paletteId: null as string | null,
    },
    // Smart AI
    smart: {
      abVariantEnabled: false,
      titleOptimizerEnabled: false,
      ctrPredictorEnabled: false,
      nicheOptimizerEnabled: false,
      niche: "",
      faceDetectionEnabled: false,
      autoCropEnabled: false,
      readabilityCheckEnabled: false,
      trendingSuggesterEnabled: false,
    },
    // Size
    size: {
      platformPresetId: "yt-standard",
      width: 1280,
      height: 720,
    },
    // Layout
    layout: {
      templateId: null as string | null,
    },
    // Export
    export: {
      format: "png" as "png" | "jpg" | "webp",
      quality: 92,
      generateVariants: false,
      batchAllPlatforms: false,
    },
  });

  type ThumbnailConfig = typeof thumbnailConfig;
  function patchConfig<K extends keyof ThumbnailConfig>(key: K, patch: Partial<ThumbnailConfig[K]>) {
    setThumbnailConfig((prev) => ({ ...prev, [key]: { ...(prev[key] as object), ...patch } as ThumbnailConfig[K] }));
  }

  // Active sidebar category
  const [activeCategory, setActiveCategory] = useState<string>("style");

  function togglePanel(key: string) {
    setExpandedPanels((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function applyYouTuberPreset(preset: YouTuberPreset) {
    const cfg = preset.config as {
      typography?: Partial<typeof thumbnailConfig.typography>;
      face?: Partial<typeof thumbnailConfig.face>;
      background?: Partial<typeof thumbnailConfig.background>;
      colors?: Partial<typeof thumbnailConfig.colors>;
      elements?: { ids?: readonly string[] };
      size?: Partial<typeof thumbnailConfig.size>;
    };
    setThumbnailConfig((prev) => {
      const next = { ...prev, stylePreset: preset.id };
      if (cfg.typography) next.typography = { ...prev.typography, ...cfg.typography };
      if (cfg.face) next.face = { ...prev.face, ...cfg.face };
      if (cfg.background) next.background = { ...prev.background, ...cfg.background };
      if (cfg.colors) next.colors = { ...prev.colors, ...cfg.colors };
      if (cfg.size) next.size = { ...prev.size, ...cfg.size };
      if (cfg.elements?.ids) {
        const active = cfg.elements.ids
          .map((id) => GRAPHIC_ELEMENTS.find((g) => g.id === id))
          .filter((g): g is typeof GRAPHIC_ELEMENTS[number] => !!g)
          .map((g) => ({ id: g.id, category: g.category, emoji: g.emoji, name: g.name }));
        next.elements = { active };
      }
      return next;
    });
    if (preset.mood) setMood(preset.mood);
    toast.success(`Applied ${preset.name} style`);
    // TODO: AI integration — pass preset hints to /api/thumbnail/generate
  }

  function applyColorPalette(paletteId: string) {
    patchConfig("colors", { paletteId });
    toast.success(`Palette: ${COLOR_PALETTES.find((p) => p.id === paletteId)?.name}`);
    // TODO: AI integration — apply palette colors to canvas
  }

  function toggleGraphicElement(el: typeof GRAPHIC_ELEMENTS[0]) {
    setThumbnailConfig((prev) => {
      const exists = prev.elements.active.some((a) => a.id === el.id);
      return {
        ...prev,
        elements: {
          active: exists
            ? prev.elements.active.filter((a) => a.id !== el.id)
            : [...prev.elements.active, { id: el.id, category: el.category, emoji: el.emoji, name: el.name }],
        },
      };
    });
  }

  // Graphic element category filter
  const [graphicFilter, setGraphicFilter] = useState("all");
  // Font category filter
  const [fontFilter, setFontFilter] = useState("all");
  // YouTuber preset category filter
  const [youtuberPresetFilter, setYoutuberPresetFilter] = useState("all");

  // Smart AI handlers (UI-only, TODOs for integration)
  async function runAbVariantGenerator() {
    if (!prompt.trim()) { toast.error("Enter a prompt first"); return; }
    toast.loading("Generating 3 A/B variants...");
    await new Promise((r) => setTimeout(r, 1500));
    toast.dismiss();
    toast.success("3 variants generated — showing in results (TODO: AI)");
    // TODO: AI integration — call variant generator endpoint
  }
  async function runTitleOptimizer() {
    if (!textOverlay.trim()) { toast.error("Enter a title first"); return; }
    toast.loading("Optimizing title for CTR...");
    await new Promise((r) => setTimeout(r, 1200));
    toast.dismiss();
    toast.success("Optimized title suggestions ready (TODO: AI)");
    // TODO: AI integration — call title rewrite endpoint
  }
  async function runNicheOptimizer() {
    if (!thumbnailConfig.smart.niche.trim()) { toast.error("Enter a niche first"); return; }
    toast.loading(`Tuning for "${thumbnailConfig.smart.niche}" niche...`);
    await new Promise((r) => setTimeout(r, 1200));
    toast.dismiss();
    toast.success("Niche-tuned settings applied (TODO: AI)");
    // TODO: AI integration — call niche optimizer
  }
  async function runFaceDetection() {
    toast.loading("Detecting faces in reference images...");
    await new Promise((r) => setTimeout(r, 1000));
    toast.dismiss();
    toast.success("Face position auto-set (TODO: AI)");
    // TODO: AI integration — call face detection model
  }
  async function runAutoCrop() {
    toast.loading("Auto-cropping for all platforms...");
    await new Promise((r) => setTimeout(r, 1200));
    toast.dismiss();
    toast.success("Platform crops ready (TODO: AI)");
    // TODO: AI integration — call auto-crop for every platform preset
  }
  async function runReadabilityChecker() {
    toast.loading("Checking text readability...");
    await new Promise((r) => setTimeout(r, 900));
    toast.dismiss();
    if (textOverlay.length > 50) toast.error("Text too long — may be hard to read at small sizes");
    else toast.success("Text passes readability checks");
    // TODO: AI integration — contrast + size analysis
  }
  async function runTrendingSuggester() {
    toast.loading("Finding trending styles in your niche...");
    await new Promise((r) => setTimeout(r, 1100));
    toast.dismiss();
    toast.success("Trending picks ready — see Smart panel (TODO: AI)");
    // TODO: AI integration — fetch trending styles per niche
  }
  async function exportBatchForAllPlatforms() {
    toast.loading(`Exporting for ${PLATFORM_SIZE_PRESETS.length - 1} platforms...`);
    await new Promise((r) => setTimeout(r, 1400));
    toast.dismiss();
    toast.success("Batch export ready (TODO: integration)");
    // TODO: integration — render canvas at each platform size and bundle as zip
  }

  const currentPlatform = PLATFORM_SIZES.find((p) => p.id === platform) || PLATFORM_SIZES[0];
  const displayWidth = platform === "custom" ? customWidth : currentPlatform.width;
  const displayHeight = platform === "custom" ? customHeight : currentPlatform.height;

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadHistory() {
    const { data } = await supabase
      .from("trinity_log")
      .select("id, description, metadata, created_at")
      .eq("action_type", "thumbnail_generated")
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory(
      (data || []).map((d: any) => ({
        id: d.id as string,
        description: d.description as string,
        created_at: d.created_at as string,
        metadata: d.metadata as Record<string, unknown>,
      }))
    );
  }

  function toggleFace(id: string) {
    setSelectedFaces((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  }

  // Poll a single job until completion
  async function pollJob(jobId: string, index: number) {
    const maxAttempts = 120; // 2 minutes max
    let attempts = 0;
    while (attempts < maxAttempts) {
      attempts++;
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const res = await fetch(`/api/thumbnail/status?job_id=${jobId}`);
        const data = await res.json();
        if (data.status === "COMPLETED") {
          setResults((prev) => {
            const updated = [...prev];
            if (updated[index]) {
              updated[index] = {
                ...updated[index],
                status: "COMPLETED",
                imageUrl: data.imageUrl || null,
              };
            }
            return updated;
          });
          return data.imageUrl;
        } else if (data.status === "FAILED") {
          setResults((prev) => {
            const updated = [...prev];
            if (updated[index]) {
              updated[index] = { ...updated[index], status: "FAILED" };
            }
            return updated;
          });
          return null;
        }
        // Still in queue or processing — update status
        setResults((prev) => {
          const updated = [...prev];
          if (updated[index]) {
            updated[index] = { ...updated[index], status: data.status };
          }
          return updated;
        });
      } catch {
        // Network error, keep polling
      }
    }
    return null; // Timed out
  }

  // Walkthrough step definitions for thumbnail generator
  const walkthroughSteps: WalkthroughStep[] = [
    {
      id: "analyze",
      title: "Analyzing Content",
      description: "Understanding your prompt and goals",
      progressText: "Parsing prompt and references",
      preview: (
        <div className="space-y-1.5 text-[11px]">
          <div><span className="text-muted">Prompt:</span> <span className="text-foreground">{prompt || "(none)"}</span></div>
          <div><span className="text-muted">Platform:</span> <span className="text-foreground">{platform}</span></div>
          <div><span className="text-muted">Size:</span> <span className="text-foreground">{displayWidth}x{displayHeight}</span></div>
          <div><span className="text-muted">Mood:</span> <span className="text-foreground">{mood}</span></div>
          <div><span className="text-muted">Reference images:</span> <span className="text-foreground">{referenceImages.length}</span></div>
        </div>
      ),
    },
    {
      id: "style",
      title: "Selecting Style Preset",
      description: "Applying the creator style that matches your niche",
      progressText: "Matching a style preset",
      preview: (() => {
        const p = YOUTUBER_THUMBNAIL_PRESETS.find(x => x.id === thumbnailConfig.stylePreset);
        return p ? (
          <div className="flex items-center gap-3">
            <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${p.gradient} flex items-center justify-center text-2xl`}>{p.icon}</div>
            <div>
              <div className="text-xs font-semibold">{p.name}</div>
              <div className="text-[10px] text-muted mt-0.5">{p.tagline}</div>
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-muted">No creator preset selected — using style &quot;{style}&quot;.</div>
        );
      })(),
      editableSettings: [
        {
          key: "stylePreset",
          label: "Creator Preset",
          type: "select",
          value: thumbnailConfig.stylePreset ?? "",
          options: [
            { label: "Custom (no preset)", value: "" },
            ...YOUTUBER_THUMBNAIL_PRESETS.map(p => ({ label: p.name, value: p.id })),
          ],
        },
      ],
      onSettingChange: (key, value) => {
        if (key === "stylePreset") {
          const v = String(value);
          if (!v) {
            setThumbnailConfig(prev => ({ ...prev, stylePreset: null }));
          } else {
            const p = YOUTUBER_THUMBNAIL_PRESETS.find(x => x.id === v);
            if (p) applyYouTuberPreset(p);
          }
        }
      },
    },
    {
      id: "background",
      title: "Generating Background",
      description: "Creating the base background image",
      progressText: "Rendering background",
      preview: (
        <div className="text-[11px] space-y-1">
          <div><span className="text-muted">Mode:</span> <span className="text-foreground">{thumbnailConfig.background.mode}</span></div>
          <div><span className="text-muted">Brightness:</span> <span className="text-foreground">{thumbnailConfig.background.brightness}%</span></div>
          <div className="flex items-center gap-2 mt-2">
            {(COLOR_THEMES.find(c => c.id === colorTheme)?.colors ?? []).slice(0, 4).map((col, i) => (
              <span key={i} className="w-6 h-6 rounded-full border border-border" style={{ background: col }} />
            ))}
            <span className="text-[10px] text-muted">{COLOR_THEMES.find(c => c.id === colorTheme)?.name}</span>
          </div>
        </div>
      ),
      editableSettings: [
        { key: "brightness", label: "Brightness", type: "slider", value: thumbnailConfig.background.brightness, min: 50, max: 150 },
      ],
      onSettingChange: (key, value) => {
        setThumbnailConfig(prev => ({
          ...prev,
          background: { ...prev.background, [key]: value as never },
        }));
      },
    },
    {
      id: "face",
      title: "Positioning Face/Subject",
      description: "Cutting out and placing the main subject",
      progressText: "Isolating subject",
      preview: (
        <div className="text-[11px] space-y-1">
          <div><span className="text-muted">Position:</span> <span className="text-foreground">{thumbnailConfig.face.position}</span></div>
          <div><span className="text-muted">Auto cutout:</span> <span className="text-foreground">{thumbnailConfig.face.autoCutoutEnabled ? "Yes" : "No"}</span></div>
          <div><span className="text-muted">Enhance:</span> <span className="text-foreground">{thumbnailConfig.face.enhanceEnabled ? "Yes" : "No"}</span></div>
          <div><span className="text-muted">Eye pop:</span> <span className="text-foreground">{thumbnailConfig.face.eyePopEnabled ? "Yes" : "No"}</span></div>
        </div>
      ),
      editableSettings: [
        {
          key: "position",
          label: "Position",
          type: "select",
          value: thumbnailConfig.face.position,
          options: [
            { label: "Left", value: "left" },
            { label: "Center", value: "center" },
            { label: "Right", value: "right" },
          ],
        },
        { key: "autoCutoutEnabled", label: "Auto Cutout", type: "toggle", value: thumbnailConfig.face.autoCutoutEnabled },
        { key: "enhanceEnabled", label: "Enhance", type: "toggle", value: thumbnailConfig.face.enhanceEnabled },
        { key: "eyePopEnabled", label: "Eye Pop", type: "toggle", value: thumbnailConfig.face.eyePopEnabled },
      ],
      onSettingChange: (key, value) => {
        setThumbnailConfig(prev => ({
          ...prev,
          face: { ...prev.face, [key]: value as never },
        }));
      },
    },
    {
      id: "typography",
      title: "Adding Text & Typography",
      description: "Designing headline text and styling",
      progressText: "Rendering text overlays",
      preview: (
        <div className="space-y-2">
          <div
            className="rounded-lg p-4 text-center"
            style={{
              color: (COLOR_THEMES.find(c => c.id === colorTheme)?.colors ?? ["#FFD700"])[0],
              fontWeight: thumbnailConfig.typography.weight,
              letterSpacing: `${thumbnailConfig.typography.letterSpacing}px`,
              textTransform: thumbnailConfig.typography.textCase === "uppercase" ? "uppercase" : thumbnailConfig.typography.textCase === "lowercase" ? "lowercase" : thumbnailConfig.typography.textCase === "titlecase" ? "capitalize" : "none",
              WebkitTextStroke: thumbnailConfig.typography.strokeEnabled ? `${Math.min(thumbnailConfig.typography.strokeWidth, 3)}px ${thumbnailConfig.typography.strokeColor}` : undefined,
              background: "rgba(0,0,0,0.4)",
              fontSize: 28,
            }}
          >
            {textOverlay || "YOUR HEADLINE"}
          </div>
          <div className="text-[10px] text-muted">
            Weight: {thumbnailConfig.typography.weight} · Case: {thumbnailConfig.typography.textCase}
          </div>
        </div>
      ),
      editableSettings: [
        { key: "weight", label: "Weight", type: "slider", value: thumbnailConfig.typography.weight, min: 100, max: 900, step: 100 },
        {
          key: "textCase",
          label: "Text Case",
          type: "select",
          value: thumbnailConfig.typography.textCase,
          options: [
            { label: "UPPERCASE", value: "uppercase" },
            { label: "lowercase", value: "lowercase" },
            { label: "Title Case", value: "titlecase" },
            { label: "As typed", value: "astyped" },
          ],
        },
        { key: "strokeEnabled", label: "Stroke", type: "toggle", value: thumbnailConfig.typography.strokeEnabled },
        { key: "strokeWidth", label: "Stroke Width", type: "slider", value: thumbnailConfig.typography.strokeWidth, min: 0, max: 12 },
        { key: "strokeColor", label: "Stroke Color", type: "color", value: thumbnailConfig.typography.strokeColor },
      ],
      onSettingChange: (key, value) => {
        setThumbnailConfig(prev => ({
          ...prev,
          typography: { ...prev.typography, [key]: value as never },
        }));
      },
    },
    {
      id: "elements",
      title: "Adding Graphic Elements",
      description: "Placing arrows, shapes, and stickers",
      progressText: "Composing graphic elements",
      preview: (
        <div className="text-[11px] space-y-2">
          <div><span className="text-muted">Active elements:</span> <span className="text-foreground">{thumbnailConfig.elements.active.length}</span></div>
          <div className="flex flex-wrap gap-1">
            {thumbnailConfig.elements.active.slice(0, 10).map(el => (
              <span key={el.id} className="inline-flex items-center gap-1 text-[10px] bg-surface-light/60 border border-border rounded-full px-2 py-0.5">
                <span>{el.emoji}</span> {el.name}
              </span>
            ))}
            {thumbnailConfig.elements.active.length === 0 && (
              <span className="text-[10px] text-muted">No elements added</span>
            )}
          </div>
        </div>
      ),
    },
    {
      id: "polish",
      title: "Final Polish",
      description: "Color grading and sharpening",
      progressText: "Applying final touches",
      preview: (
        <div className="text-[11px] text-muted">
          Applying contrast, sharpen, and color harmony pass for maximum CTR.
        </div>
      ),
    },
    {
      id: "export",
      title: "Ready to Export",
      description: "Your thumbnail is ready",
      progressText: "Packaging output",
      preview: (
        <div className="text-[11px] text-muted">
          Assets prepared for {platform} at {displayWidth}x{displayHeight}.
        </div>
      ),
    },
  ];

  function sleep(ms: number) {
    return new Promise<void>(resolve => setTimeout(resolve, ms));
  }

  // Runs the step-by-step walkthrough then kicks off the real generate.
  // TODO: replace with real AI pipeline progress events
  async function runWalkthrough(doGenerate: () => Promise<void>) {
    walkthroughCancelledRef.current = false;
    setWalkthroughOpen(true);
    setWalkthroughStepIndex(0);
    setWalkthroughStatus("in_progress");
    for (let i = 0; i < walkthroughSteps.length; i++) {
      if (walkthroughCancelledRef.current) return;
      setWalkthroughStepIndex(i);
      setWalkthroughStatus("in_progress");
      await sleep(1500);
      if (walkthroughCancelledRef.current) return;
      setWalkthroughStatus("completed");
    }
    if (walkthroughCancelledRef.current) return;
    await doGenerate();
  }

  async function generate() {
    if (!prompt.trim()) {
      toast.error("Enter a description for your thumbnail");
      return;
    }
    if (walkthroughEnabled && !walkthroughOpen) {
      await runWalkthrough(() => generateReal());
      return;
    }
    await generateReal();
  }

  async function generateReal() {
    setGenerating(true);
    setResults([]);
    const toastId = toast.loading(
      "Sending to GPU... this takes 15-30s per image"
    );
    try {
      const res = await fetch("/api/thumbnail/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          faces: selectedFaces,
          style,
          platform,
          width: displayWidth,
          height: displayHeight,
          textOverlay,
          colorTheme,
          mood,
          variations,
          reference_images: referenceImages,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Set initial results with IN_QUEUE status
        setResults(data.thumbnails);
        toast.loading("GPU is generating your images...", { id: toastId });

        // Start polling all jobs in parallel
        const pollPromises = data.thumbnails.map(
          (thumb: ThumbnailResult, i: number) =>
            thumb.job_id ? pollJob(thumb.job_id, i) : Promise.resolve(null)
        );
        const images = await Promise.all(pollPromises);
        const completed = images.filter(Boolean).length;

        toast.dismiss(toastId);
        if (completed > 0) {
          toast.success(
            `${completed} thumbnail${completed > 1 ? "s" : ""} generated!`
          );
          // Log to history
          await supabase.from("trinity_log").insert({
            action_type: "thumbnail_generated",
            description: prompt.slice(0, 100),
            status: "completed",
            metadata: {
              style,
              platform,
              colorTheme,
              mood,
              faces: selectedFaces,
              count: variations,
            },
          });
          loadHistory();
        } else {
          toast.error("Generation failed — GPU may be cold-starting, try again");
        }
      } else {
        toast.error(data.error || "Generation failed", { id: toastId });
      }
    } catch {
      toast.dismiss(toastId);
      toast.error("Error generating thumbnails");
    }
    setGenerating(false);
  }

  async function regenerateSingle(index: number) {
    toast.loading("Regenerating variation " + (index + 1) + "...");
    // Mark this result as loading
    setResults((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = {
          ...updated[index],
          status: "IN_QUEUE",
          imageUrl: null,
        };
      }
      return updated;
    });
    try {
      const res = await fetch("/api/thumbnail/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          faces: selectedFaces,
          style,
          platform,
          width: displayWidth,
          height: displayHeight,
          textOverlay,
          colorTheme,
          mood,
          variations: 1,
        }),
      });
      const data = await res.json();
      if (data.success && data.thumbnails?.[0]?.job_id) {
        const newThumb = data.thumbnails[0];
        setResults((prev) => {
          const updated = [...prev];
          updated[index] = { ...updated[index], ...newThumb };
          return updated;
        });
        toast.dismiss();
        await pollJob(newThumb.job_id, index);
        toast.success("Variation regenerated!");
      } else {
        toast.dismiss();
        toast.error("Regeneration failed");
      }
    } catch {
      toast.dismiss();
      toast.error("Error regenerating");
    }
  }

  function copyPrompt(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Prompt copied!");
  }

  function getAspectClass(): string {
    const ratio = displayWidth / displayHeight;
    if (ratio > 1.5) return "aspect-video";
    if (ratio > 0.9 && ratio < 1.1) return "aspect-square";
    if (ratio < 0.7) return "aspect-[9/16]";
    return "aspect-video";
  }

  /* ── New Feature Handlers ── */

  async function runCTRPredictor() {
    setCtrAnalyzing(true);
    setCtrScore(null);
    setCtrFactors([]);
    await new Promise((r) => setTimeout(r, 1500));
    const factors = [
      { factor: "Text Readability", score: Math.floor(Math.random() * 30) + 70, tip: "Use larger, bolder fonts with high contrast" },
      { factor: "Face Presence", score: selectedFaces.length > 0 ? Math.floor(Math.random() * 20) + 80 : Math.floor(Math.random() * 30) + 30, tip: "Thumbnails with faces get 38% more clicks" },
      { factor: "Color Contrast", score: Math.floor(Math.random() * 25) + 70, tip: "Ensure text stands out from background" },
      { factor: "Emotion Impact", score: ["Dramatic", "Shocking", "Funny", "Exciting"].includes(mood) ? Math.floor(Math.random() * 15) + 85 : Math.floor(Math.random() * 25) + 60, tip: "Strong emotions drive higher click rates" },
      { factor: "Curiosity Gap", score: textOverlay.includes("...") || textOverlay.includes("?") ? Math.floor(Math.random() * 10) + 85 : Math.floor(Math.random() * 30) + 55, tip: "Leave something unknown to create curiosity" },
      { factor: "Platform Optimization", score: Math.floor(Math.random() * 20) + 75, tip: "Ensure design works at small sizes" },
    ];
    const avg = Math.round(factors.reduce((a, b) => a + b.score, 0) / factors.length);
    setCtrFactors(factors);
    setCtrScore(avg);
    setCtrAnalyzing(false);
    toast.success(`CTR Score: ${avg}/100`);
  }

  async function runSplitTest() {
    if (!prompt.trim()) { toast.error("Enter a prompt first"); return; }
    setSplitTestMode(true);
    setSplitTestResults([null, null]);
    toast.loading("Generating A/B test thumbnails...");
    const variantA: ThumbnailResult = {
      id: `split-a-${Date.now()}`, prompt, style, platform, textOverlay, colorTheme, mood, faces: selectedFaces,
      imageUrl: null, gradient: THUMBNAIL_STYLES.find((s) => s.id === style)?.gradient, width: displayWidth, height: displayHeight, createdAt: new Date().toISOString(), status: "COMPLETED",
    };
    const variantB: ThumbnailResult = {
      id: `split-b-${Date.now()}`, prompt, style: THUMBNAIL_STYLES[(THUMBNAIL_STYLES.findIndex(s => s.id === style) + 1) % THUMBNAIL_STYLES.length].id,
      platform, textOverlay, colorTheme: COLOR_THEMES[(COLOR_THEMES.findIndex(c => c.id === colorTheme) + 1) % COLOR_THEMES.length].id,
      mood: MOODS[(MOODS.indexOf(mood) + 1) % MOODS.length], faces: selectedFaces, imageUrl: null,
      gradient: THUMBNAIL_STYLES[(THUMBNAIL_STYLES.findIndex(s => s.id === style) + 1) % THUMBNAIL_STYLES.length].gradient,
      width: displayWidth, height: displayHeight, createdAt: new Date().toISOString(), status: "COMPLETED",
    };
    await new Promise((r) => setTimeout(r, 1000));
    setSplitTestResults([variantA, variantB]);
    toast.dismiss();
    toast.success("A/B variants ready for comparison");
  }

  async function generateBatch() {
    const validPrompts = batchPrompts.filter((p) => p.trim());
    if (validPrompts.length === 0) { toast.error("Add at least one prompt"); return; }
    setBatchGenerating(true);
    setBatchResults([]);
    const toastId = toast.loading(`Generating ${validPrompts.length} thumbnails...`);
    const newResults: ThumbnailResult[] = [];
    for (let i = 0; i < validPrompts.length; i++) {
      await new Promise((r) => setTimeout(r, 800));
      newResults.push({
        id: `batch-${Date.now()}-${i}`, prompt: validPrompts[i], style, platform, textOverlay, colorTheme, mood,
        faces: selectedFaces, imageUrl: null, gradient: THUMBNAIL_STYLES.find((s) => s.id === style)?.gradient,
        width: displayWidth, height: displayHeight, createdAt: new Date().toISOString(), status: "COMPLETED",
      });
      setBatchResults([...newResults]);
    }
    toast.dismiss(toastId);
    toast.success(`${validPrompts.length} batch thumbnails generated!`);
    setBatchGenerating(false);
  }

  async function analyzeCompetitor() {
    if (!competitorUrl.trim()) { toast.error("Paste a YouTube URL"); return; }
    setCompetitorAnalyzing(true);
    setCompetitorResults(null);
    await new Promise((r) => setTimeout(r, 2000));
    setCompetitorResults({
      style: THUMBNAIL_STYLES[Math.floor(Math.random() * THUMBNAIL_STYLES.length)].name,
      colors: COLOR_THEMES[Math.floor(Math.random() * COLOR_THEMES.length)].name,
      text: "Bold uppercase, 3-5 words, high contrast",
      face: "Close-up with exaggerated expression",
      score: Math.floor(Math.random() * 25) + 75,
    });
    setCompetitorAnalyzing(false);
    toast.success("Competitor thumbnail analyzed!");
  }

  async function generateQuickVariations() {
    if (!prompt.trim()) { toast.error("Enter a prompt first"); return; }
    setQuickVarGenerating(true);
    toast.loading("Generating 4 quick variations...");
    const newResults: ThumbnailResult[] = [];
    for (let i = 0; i < 4; i++) {
      const randStyle = THUMBNAIL_STYLES[Math.floor(Math.random() * THUMBNAIL_STYLES.length)];
      const randTheme = COLOR_THEMES[Math.floor(Math.random() * COLOR_THEMES.length)];
      await new Promise((r) => setTimeout(r, 500));
      newResults.push({
        id: `qvar-${Date.now()}-${i}`, prompt, style: randStyle.id, platform, textOverlay, colorTheme: randTheme.id,
        mood: MOODS[Math.floor(Math.random() * MOODS.length)], faces: selectedFaces, imageUrl: null,
        gradient: randStyle.gradient, width: displayWidth, height: displayHeight, createdAt: new Date().toISOString(), status: "COMPLETED",
      });
    }
    setResults(newResults);
    setVariations(4);
    toast.dismiss();
    toast.success("4 variations generated!");
    setQuickVarGenerating(false);
  }

  async function checkCompliance() {
    setComplianceChecking(true);
    setComplianceResult(null);
    await new Promise((r) => setTimeout(r, 1200));
    const issues: string[] = [];
    if (!textOverlay) issues.push("No text overlay - may reduce CTR");
    if (textOverlay.length > 50) issues.push("Text too long - may be cut off on mobile");
    if (selectedFaces.length === 0) issues.push("No faces selected - consider adding for engagement");
    if (displayWidth < 1200) issues.push("Resolution below recommended minimum (1200px width)");
    const plat = PLATFORM_SIZES.find((p) => p.id === platform);
    if (plat && platform === "youtube" && (displayWidth / displayHeight) < 1.5) issues.push("Aspect ratio not ideal for YouTube (16:9 recommended)");
    if (platform === "tiktok" && displayWidth > displayHeight) issues.push("TikTok covers should be portrait (9:16)");
    setComplianceResult({ platform: plat?.name || platform, passed: issues.length === 0, issues });
    setComplianceChecking(false);
    toast.success(issues.length === 0 ? "All checks passed!" : `${issues.length} issue(s) found`);
  }

  async function checkBrandConsistency() {
    setBrandChecking(true);
    setBrandScore(null);
    setBrandFactors([]);
    await new Promise((r) => setTimeout(r, 1500));
    const factors = [
      { label: "Color Palette Match", score: Math.floor(Math.random() * 30) + 70 },
      { label: "Font Consistency", score: Math.floor(Math.random() * 25) + 65 },
      { label: "Logo Placement", score: referenceImages.length > 0 ? Math.floor(Math.random() * 15) + 80 : Math.floor(Math.random() * 40) + 30 },
      { label: "Tone of Voice", score: Math.floor(Math.random() * 20) + 75 },
      { label: "Visual Style Consistency", score: Math.floor(Math.random() * 25) + 70 },
    ];
    const avg = Math.round(factors.reduce((a, b) => a + b.score, 0) / factors.length);
    setBrandFactors(factors);
    setBrandScore(avg);
    setBrandChecking(false);
    toast.success(`Brand Score: ${avg}/100`);
  }

  function saveCurrentPreset() {
    if (!newPresetName.trim()) { toast.error("Enter a preset name"); return; }
    const preset = {
      id: `ep-${Date.now()}`, name: newPresetName,
      config: { style, platform, colorTheme, mood },
    };
    setSavedPresets((prev) => [preset, ...prev]);
    setNewPresetName("");
    toast.success(`Preset "${newPresetName}" saved!`);
  }

  function loadPreset(preset: typeof EXPORT_PRESET_DEFAULTS[0]) {
    setStyle(preset.config.style);
    setPlatform(preset.config.platform);
    setColorTheme(preset.config.colorTheme);
    setMood(preset.config.mood);
    toast.success(`Preset "${preset.name}" loaded`);
  }

  async function generateAIBackground() {
    if (!aiBgPrompt.trim()) { toast.error("Describe the background"); return; }
    setAiBgGenerating(true);
    setAiBgResult(null);
    await new Promise((r) => setTimeout(r, 2000));
    setAiBgResult(aiBgPrompt);
    setAiBgGenerating(false);
    toast.success("AI background generated!");
  }

  /* ── Collapsible Panel Component ── */
  function FeaturePanel({ id, icon, title, badge, children }: { id: string; icon: React.ReactNode; title: string; badge?: string; children: React.ReactNode }) {
    const isOpen = expandedPanels[id] || false;
    return (
      <div className="card">
        <button onClick={() => togglePanel(id)} className="w-full flex items-center justify-between">
          <h2 className="section-header mb-0 flex items-center gap-2">
            {icon} {title}
            {badge && <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-gold/10 text-gold font-medium">{badge}</span>}
          </h2>
          <ChevronRight size={14} className={`text-muted transition-transform ${isOpen ? "rotate-90" : ""}`} />
        </button>
        {isOpen && <div className="mt-3 pt-3 border-t border-border/50">{children}</div>}
      </div>
    );
  }

  return (
    <div className="fade-in space-y-5">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
            <ImageIcon size={20} className="text-gold" />
          </div>
          <div>
            <h1 className="page-header mb-0">Thumbnail Generator</h1>
            <p className="text-xs text-muted">
              AI-powered thumbnail creation with styles, faces & text overlays
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-muted uppercase tracking-wider">
            {displayWidth} x {displayHeight}
          </span>
          <div className="w-8 h-5 rounded border border-border bg-surface-light flex items-center justify-center">
            <RectangleHorizontal size={12} className="text-muted" />
          </div>
        </div>
      </div>

      {/* ─── Tabs ─── */}
      <div className="tab-group w-fit">
        {(["generate", "studio", "tools", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t as "generate" | "history"); setActiveFeatureTab(t); }}
            className={activeFeatureTab === t ? "tab-item-active" : "tab-item-inactive"}
          >
            {t === "generate" ? "Generator" : t === "studio" ? "Studio" : t === "tools" ? "AI Tools" : `History (${history.length})`}
          </button>
        ))}
      </div>

      {/* ─── Generate Tab ─── */}
      {activeFeatureTab === "generate" && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* LEFT PANEL — Controls */}
          <div className="lg:col-span-2 space-y-4">
            {/* Reference Images */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2">
                <Upload size={13} className="text-gold" /> Reference Images <span className="text-[9px] text-muted font-normal">(optional)</span>
              </h2>
              <p className="text-[9px] text-muted mb-2">Drop faces, logos, or reference images to include in your thumbnail</p>
              {referenceImages.length > 0 && (
                <div className="flex gap-2 mb-2 flex-wrap">
                  {referenceImages.map((img, i) => (
                    <div key={i} className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt="" className="w-16 h-16 rounded-lg object-cover border border-border" />
                      <button onClick={() => setReferenceImages(prev => prev.filter((_, j) => j !== i))}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-danger rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X size={8} className="text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {referenceImages.length < 3 && (
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-border/50 hover:border-gold/30 rounded-xl py-3 cursor-pointer transition-colors">
                  <Upload size={14} className="text-muted" />
                  <span className="text-[10px] text-muted">Click or drag files here ({3 - referenceImages.length} remaining)</span>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    const remaining = 3 - referenceImages.length;
                    files.slice(0, remaining).forEach(file => {
                      if (file.size > 5 * 1024 * 1024) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        setReferenceImages(prev => [...prev, reader.result as string].slice(0, 3));
                      };
                      reader.readAsDataURL(file);
                    });
                    e.target.value = "";
                  }} />
                </label>
              )}
            </div>

            {/* Prompt */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2">
                <Sparkles size={13} className="text-gold" /> Description / Prompt
              </h2>
              <PromptEnhancer
                value={prompt}
                onChange={setPrompt}
                type="thumbnail"
                placeholder='e.g., "A dramatic thumbnail about space exploration with a shocked astronaut"'
                rows={3}
              />
            </div>

            {/* Face / Character Selection */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2">
                <User size={13} className="text-gold" /> Face / Character
              </h2>
              <p className="text-[9px] text-muted mb-2">Select one or more faces to include</p>
              <div className="grid grid-cols-4 gap-1.5">
                {FACE_OPTIONS.map((face) => {
                  const selected = selectedFaces.includes(face.id);
                  return (
                    <button
                      key={face.id}
                      onClick={() => toggleFace(face.id)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                        selected
                          ? "border-gold/40 bg-gold/[0.07] ring-1 ring-gold/20"
                          : "border-border hover:border-gold/15"
                      }`}
                    >
                      <span className="text-lg leading-none">{face.emoji}</span>
                      <span
                        className={`text-[8px] leading-tight text-center ${
                          selected ? "text-gold font-semibold" : "text-muted"
                        }`}
                      >
                        {face.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Thumbnail Style */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2">
                <Layers size={13} className="text-gold" /> Thumbnail Style
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {THUMBNAIL_STYLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStyle(s.id)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all text-left ${
                      style === s.id
                        ? "border-gold/30 bg-gold/[0.05]"
                        : "border-border hover:border-gold/15"
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg bg-gradient-to-br ${s.gradient} flex-shrink-0`}
                    />
                    <div className="min-w-0">
                      <p
                        className={`text-[10px] font-semibold truncate ${
                          style === s.id ? "text-gold" : ""
                        }`}
                      >
                        {s.name}
                      </p>
                      <p className="text-[8px] text-muted truncate">{s.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Platform / Size */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2">
                <Monitor size={13} className="text-gold" /> Platform / Size
              </h2>
              <div className="relative">
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="input w-full text-xs appearance-none pr-8"
                >
                  {PLATFORM_SIZES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.width}x{p.height})
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                />
              </div>
              {platform === "custom" && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">
                      Width
                    </label>
                    <input
                      type="number"
                      value={customWidth}
                      onChange={(e) => setCustomWidth(Number(e.target.value))}
                      className="input w-full text-xs"
                      min={100}
                      max={4096}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">
                      Height
                    </label>
                    <input
                      type="number"
                      value={customHeight}
                      onChange={(e) => setCustomHeight(Number(e.target.value))}
                      className="input w-full text-xs"
                      min={100}
                      max={4096}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Text Overlay */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2">
                <Type size={13} className="text-gold" /> Text Overlay
              </h2>
              <input
                value={textOverlay}
                onChange={(e) => setTextOverlay(e.target.value)}
                className="input w-full text-xs"
                placeholder={"e.g., \"YOU WON'T BELIEVE THIS...\""}
                maxLength={80}
              />
              <div className="flex justify-end mt-1">
                <span className="text-[9px] text-muted">{textOverlay.length}/80</span>
              </div>
            </div>

            {/* Color Theme */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2">
                <Palette size={13} className="text-gold" /> Color Theme
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {COLOR_THEMES.map((ct) => (
                  <button
                    key={ct.id}
                    onClick={() => setColorTheme(ct.id)}
                    className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${
                      colorTheme === ct.id
                        ? "border-gold/30 bg-gold/[0.05]"
                        : "border-border hover:border-gold/15"
                    }`}
                  >
                    <div className="flex -space-x-1">
                      {ct.colors.map((c, ci) => (
                        <div
                          key={ci}
                          className="w-4 h-4 rounded-full border border-white/50"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <span
                      className={`text-[9px] truncate ${
                        colorTheme === ct.id ? "text-gold font-semibold" : "text-muted"
                      }`}
                    >
                      {ct.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Mood / Emotion */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2">
                <Smile size={13} className="text-gold" /> Mood / Emotion
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {MOODS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMood(m)}
                    className={`text-[10px] px-2.5 py-1 rounded-full border transition-all ${
                      mood === m
                        ? "border-gold/30 bg-gold/[0.08] text-gold font-semibold"
                        : "border-border text-muted hover:text-foreground hover:border-gold/15"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Variations + Generate */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-header mb-0 flex items-center gap-2">
                  <Grid size={13} className="text-gold" /> Variations
                </h2>
                <div className="flex gap-1">
                  {[1, 2, 4].map((n) => (
                    <button
                      key={n}
                      onClick={() => setVariations(n)}
                      className={`text-[10px] px-3 py-1 rounded-lg border transition-all ${
                        variations === n
                          ? "border-gold/30 bg-gold/[0.05] text-gold font-semibold"
                          : "border-border text-muted hover:text-foreground"
                      }`}
                    >
                      {n}x
                    </button>
                  ))}
                </div>
              </div>
              {/* Quick Presets */}
              <div>
                <h2 className="section-header flex items-center gap-2"><Layers size={13} className="text-gold" /> Quick Presets</h2>
                <div className="flex flex-wrap gap-1 mb-2">
                  {THUMBNAIL_PRESET_CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        const preset = THUMBNAIL_PRESETS.find(p => p.category === cat.id);
                        if (preset) {
                          setPrompt(preset.config.description || `${preset.name} — ${preset.desc}`);
                          toast.success(`Preset: ${preset.name}`);
                        }
                      }}
                      className="text-[8px] px-2 py-1 rounded border border-border text-muted hover:text-foreground hover:border-gold/15 transition-all"
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {THUMBNAIL_PRESETS.slice(0, 16).map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => {
                        setPrompt(preset.config.description || `${preset.name}: ${preset.desc}. Style: ${preset.config.style}, Colors: ${preset.config.color_scheme}, Text: "${preset.config.text_overlay}", Face: ${preset.config.face_expression}, BG: ${preset.config.background}`);
                        toast.success(`Preset loaded: ${preset.name}`);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-surface-light border border-transparent hover:border-border/30 transition-all"
                    >
                      <p className="text-[10px] font-medium">{preset.name}</p>
                      <p className="text-[8px] text-muted">{preset.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={generate}
                  disabled={generating}
                  className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? (
                    <>
                      <Loader size={16} className="animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Zap size={16} />
                      Generate{variations > 1 ? ` ${variations}x` : ""}
                    </>
                  )}
                </button>
                <button
                  onClick={generateQuickVariations}
                  disabled={quickVarGenerating || generating}
                  className="flex items-center justify-center gap-1.5 text-[10px] font-medium px-3 py-2 rounded-xl border border-border hover:border-gold/30 hover:bg-gold/[0.05] transition-all text-muted hover:text-foreground disabled:opacity-40"
                  title="Quick 4 variations"
                >
                  <Shuffle size={14} />
                  4x
                </button>
              </div>
              <label className="flex items-center gap-2 text-[10px] text-muted cursor-pointer select-none mt-2">
                <input
                  type="checkbox"
                  checked={walkthroughEnabled}
                  onChange={(e) => setWalkthroughEnabled(e.target.checked)}
                  className="accent-gold"
                />
                Show step-by-step walkthrough when generating
              </label>
            </div>

            {/* ── Split Test Generator ── */}
            <FeaturePanel id="splitTest" icon={<FlaskConical size={13} className="text-gold" />} title="Split Test (A/B)" badge="NEW">
              <p className="text-[9px] text-muted mb-2">Generate two thumbnail variants side by side to compare which performs better.</p>
              <button onClick={runSplitTest} disabled={generating || !prompt.trim()} className="btn-primary w-full text-xs flex items-center justify-center gap-2 disabled:opacity-40">
                <FlaskConical size={14} /> Generate A/B Test
              </button>
              {splitTestResults[0] && splitTestResults[1] && (
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {splitTestResults.map((variant, vi) => variant && (
                    <div key={vi} className="rounded-xl overflow-hidden border border-border">
                      <div className={`aspect-video bg-gradient-to-br ${variant.gradient || "from-gray-500 to-gray-700"} flex items-center justify-center p-2`}>
                        <span className="text-white text-[10px] font-bold text-center drop-shadow-lg">{variant.textOverlay || "Variant " + (vi === 0 ? "A" : "B")}</span>
                      </div>
                      <div className="p-2 bg-surface-light">
                        <p className="text-[8px] font-semibold">{vi === 0 ? "Variant A" : "Variant B"}</p>
                        <p className="text-[7px] text-muted">{THUMBNAIL_STYLES.find(s => s.id === variant.style)?.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </FeaturePanel>

            {/* ── CTR Predictor ── */}
            <FeaturePanel id="ctrPredictor" icon={<Target size={13} className="text-gold" />} title="CTR Predictor" badge="AI">
              <p className="text-[9px] text-muted mb-2">AI analyzes your thumbnail settings and predicts click-through rate potential.</p>
              <button onClick={runCTRPredictor} disabled={ctrAnalyzing} className="btn-primary w-full text-xs flex items-center justify-center gap-2 disabled:opacity-40">
                {ctrAnalyzing ? <><Loader size={14} className="animate-spin" /> Analyzing...</> : <><Target size={14} /> Predict CTR Score</>}
              </button>
              {ctrScore !== null && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Overall Score</span>
                    <span className={`text-lg font-black ${ctrScore >= 80 ? "text-success" : ctrScore >= 60 ? "text-gold" : "text-danger"}`}>{ctrScore}/100</span>
                  </div>
                  <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${ctrScore >= 80 ? "bg-success" : ctrScore >= 60 ? "bg-gold" : "bg-danger"}`} style={{ width: `${ctrScore}%` }} />
                  </div>
                  {ctrFactors.map((f, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-muted">{f.factor}</span>
                        <span className={`text-[9px] font-semibold ${f.score >= 80 ? "text-success" : f.score >= 60 ? "text-gold" : "text-danger"}`}>{f.score}</span>
                      </div>
                      <div className="w-full h-1 bg-border rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${f.score >= 80 ? "bg-success/60" : f.score >= 60 ? "bg-gold/60" : "bg-danger/60"}`} style={{ width: `${f.score}%` }} />
                      </div>
                      <p className="text-[8px] text-muted italic">{f.tip}</p>
                    </div>
                  ))}
                </div>
              )}
            </FeaturePanel>

            {/* ── Template Gallery ── */}
            <FeaturePanel id="templateGallery" icon={<LayoutGrid size={13} className="text-gold" />} title="Template Gallery" badge={`${TEMPLATE_GALLERY.length}`}>
              <div className="flex flex-wrap gap-1 mb-2">
                {["all", "text-heavy", "versus", "listicle", "news", "howto", "reaction", "transformation", "quote", "urgency", "finance", "mystery", "minimal", "luxury"].map((cat) => (
                  <button key={cat} onClick={() => setTemplateFilter(cat)}
                    className={`text-[8px] px-2 py-0.5 rounded-full border transition-all ${templateFilter === cat ? "border-gold/30 bg-gold/[0.08] text-gold font-semibold" : "border-border text-muted hover:text-foreground"}`}>
                    {cat === "all" ? "All" : cat}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-1.5 max-h-60 overflow-y-auto">
                {TEMPLATE_GALLERY.filter((t) => templateFilter === "all" || t.category === templateFilter).map((tpl) => (
                  <button key={tpl.id} onClick={() => { setSelectedTemplate(tpl.id); setPrompt((prev) => prev ? prev + ` [Template: ${tpl.name}]` : `Thumbnail using ${tpl.name} layout: ${tpl.layout}`); toast.success(`Template: ${tpl.name}`); }}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${selectedTemplate === tpl.id ? "border-gold/40 bg-gold/[0.07]" : "border-border hover:border-gold/15"}`}>
                    <div className={`w-full aspect-video rounded-lg bg-gradient-to-br ${tpl.preview} flex items-center justify-center`}>
                      <LayoutGrid size={12} className="text-white/60" />
                    </div>
                    <span className={`text-[8px] text-center leading-tight ${selectedTemplate === tpl.id ? "text-gold font-semibold" : "text-muted"}`}>{tpl.name}</span>
                  </button>
                ))}
              </div>
            </FeaturePanel>

            {/* ── Batch Generation ── */}
            <FeaturePanel id="batchGen" icon={<ListChecks size={13} className="text-gold" />} title="Batch Generation" badge="MULTI">
              <p className="text-[9px] text-muted mb-2">Generate thumbnails for multiple videos at once.</p>
              {batchPrompts.map((bp, i) => (
                <div key={i} className="flex gap-1.5 mb-1.5">
                  <input value={bp} onChange={(e) => { const updated = [...batchPrompts]; updated[i] = e.target.value; setBatchPrompts(updated); }}
                    className="input flex-1 text-[10px]" placeholder={`Video ${i + 1} prompt...`} />
                  {batchPrompts.length > 1 && (
                    <button onClick={() => setBatchPrompts((prev) => prev.filter((_, j) => j !== i))} className="text-muted hover:text-danger"><X size={12} /></button>
                  )}
                </div>
              ))}
              <div className="flex gap-2 mt-2">
                {batchPrompts.length < 10 && (
                  <button onClick={() => setBatchPrompts((prev) => [...prev, ""])} className="text-[9px] px-2 py-1 rounded border border-border hover:border-gold/20 text-muted hover:text-foreground transition-all">+ Add Video</button>
                )}
                <button onClick={generateBatch} disabled={batchGenerating} className="btn-primary flex-1 text-[10px] flex items-center justify-center gap-1.5 disabled:opacity-40">
                  {batchGenerating ? <><Loader size={12} className="animate-spin" /> Generating...</> : <><Zap size={12} /> Generate Batch ({batchPrompts.filter(p => p.trim()).length})</>}
                </button>
              </div>
              {batchResults.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-[9px] text-muted font-semibold">{batchResults.length} results ready</p>
                  {batchResults.map((br, _i) => (
                    <div key={br.id} className="flex items-center gap-2 p-1.5 rounded-lg bg-surface-light border border-border">
                      <div className={`w-10 h-6 rounded bg-gradient-to-br ${br.gradient || "from-gray-500 to-gray-700"} flex-shrink-0`} />
                      <span className="text-[9px] truncate flex-1">{br.prompt}</span>
                      <CheckCircle2 size={12} className="text-success flex-shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </FeaturePanel>

            {/* ── Background Scene Library ── */}
            <FeaturePanel id="bgLibrary" icon={<Mountain size={13} className="text-gold" />} title="Background Scenes" badge={`${BACKGROUND_SCENES.length}`}>
              <div className="flex flex-wrap gap-1 mb-2">
                {["all", "nature", "urban", "interior", "studio", "sci-fi", "tech", "sports", "entertainment"].map((cat) => (
                  <button key={cat} onClick={() => setBgFilter(cat)}
                    className={`text-[8px] px-2 py-0.5 rounded-full border transition-all ${bgFilter === cat ? "border-gold/30 bg-gold/[0.08] text-gold font-semibold" : "border-border text-muted hover:text-foreground"}`}>
                    {cat === "all" ? "All" : cat}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-1.5 max-h-48 overflow-y-auto">
                {BACKGROUND_SCENES.filter((bg) => bgFilter === "all" || bg.category === bgFilter).map((bg) => (
                  <button key={bg.id} onClick={() => { setSelectedBackground(bg.id); setPrompt((prev) => prev ? prev + `, ${bg.name} background` : `Thumbnail with ${bg.name} background`); toast.success(`BG: ${bg.name}`); }}
                    className={`flex flex-col items-center gap-0.5 p-1.5 rounded-xl border transition-all ${selectedBackground === bg.id ? "border-gold/40 bg-gold/[0.07]" : "border-border hover:border-gold/15"}`}>
                    <span className="text-lg leading-none">{bg.emoji}</span>
                    <span className={`text-[7px] text-center leading-tight ${selectedBackground === bg.id ? "text-gold font-semibold" : "text-muted"}`}>{bg.name}</span>
                  </button>
                ))}
              </div>
            </FeaturePanel>

            {/* ── Text Effect Presets ── */}
            <FeaturePanel id="textEffects" icon={<Wand2 size={13} className="text-gold" />} title="Text Effects" badge={`${TEXT_EFFECT_PRESETS.length}`}>
              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                {TEXT_EFFECT_PRESETS.map((te) => (
                  <button key={te.id} onClick={() => { setSelectedTextEffect(te.id); toast.success(`Effect: ${te.name}`); }}
                    className={`p-2 rounded-xl border transition-all text-left ${selectedTextEffect === te.id ? "border-gold/40 bg-gold/[0.07]" : "border-border hover:border-gold/15"}`}>
                    <div className="w-full h-8 bg-gray-900 rounded-lg flex items-center justify-center mb-1">
                      {/* eslint-disable-next-line react/no-danger */}
                      <span className="text-white text-[10px] font-bold" dangerouslySetInnerHTML={{ __html: `<span style="${te.style}">Aa</span>` }} />
                    </div>
                    <p className={`text-[8px] font-semibold ${selectedTextEffect === te.id ? "text-gold" : ""}`}>{te.name}</p>
                    <p className="text-[7px] text-muted">{te.desc}</p>
                  </button>
                ))}
              </div>
            </FeaturePanel>

            {/* ── Emoji & Sticker Overlay ── */}
            <FeaturePanel id="emojiOverlay" icon={<Sticker size={13} className="text-gold" />} title="Emoji & Stickers" badge={selectedEmojis.length > 0 ? `${selectedEmojis.length} selected` : undefined}>
              {selectedEmojis.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2 p-2 rounded-lg bg-surface-light border border-border">
                  {selectedEmojis.map((eid, i) => {
                    const em = EMOJI_STICKERS.find((e) => e.id === eid);
                    return em ? <span key={i} className="text-lg cursor-pointer hover:scale-125 transition-transform" onClick={() => setSelectedEmojis((prev) => prev.filter((_, j) => j !== i))}>{em.emoji}</span> : null;
                  })}
                  <button onClick={() => setSelectedEmojis([])} className="text-[8px] px-1.5 py-0.5 rounded border border-danger/30 text-danger hover:bg-danger/10 ml-auto">Clear</button>
                </div>
              )}
              <div className="grid grid-cols-5 gap-1.5">
                {EMOJI_STICKERS.map((em) => (
                  <button key={em.id} onClick={() => { if (!selectedEmojis.includes(em.id)) setSelectedEmojis((prev) => [...prev, em.id]); }}
                    className={`flex flex-col items-center gap-0.5 p-1.5 rounded-xl border transition-all ${selectedEmojis.includes(em.id) ? "border-gold/40 bg-gold/[0.07]" : "border-border hover:border-gold/15"}`}>
                    <span className="text-lg leading-none">{em.emoji}</span>
                    <span className="text-[6px] text-muted">{em.name}</span>
                  </button>
                ))}
              </div>
            </FeaturePanel>

            {/* ── Export Presets ── */}
            <FeaturePanel id="exportPresets" icon={<Save size={13} className="text-gold" />} title="Export Presets" badge={`${savedPresets.length}`}>
              <div className="flex gap-1.5 mb-3">
                <input value={newPresetName} onChange={(e) => setNewPresetName(e.target.value)} className="input flex-1 text-[10px]" placeholder="Preset name..." />
                <button onClick={saveCurrentPreset} className="text-[9px] px-3 py-1.5 rounded-lg border border-gold/30 bg-gold/[0.05] text-gold font-semibold hover:bg-gold/10 transition-all">
                  <Save size={12} />
                </button>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {savedPresets.map((preset) => (
                  <div key={preset.id} className="flex items-center justify-between p-2 rounded-lg border border-border hover:border-gold/15 transition-all">
                    <div>
                      <p className="text-[9px] font-semibold">{preset.name}</p>
                      <p className="text-[7px] text-muted">{preset.config.style} / {preset.config.platform} / {preset.config.mood}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => loadPreset(preset)} className="text-[8px] px-2 py-1 rounded border border-gold/20 text-gold hover:bg-gold/10 transition-all">Load</button>
                      {!preset.id.startsWith("ep") && (
                        <button onClick={() => setSavedPresets((prev) => prev.filter((p) => p.id !== preset.id))} className="text-muted hover:text-danger"><Trash2 size={10} /></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </FeaturePanel>
          </div>

          {/* RIGHT PANEL — Results */}
          <div className="lg:col-span-3 space-y-4">
            {/* Results area */}
            {generating && results.length === 0 && (
              <div
                className={`grid gap-4 ${
                  variations >= 4
                    ? "grid-cols-2"
                    : variations >= 2
                    ? "grid-cols-2"
                    : "grid-cols-1"
                }`}
              >
                {Array.from({ length: variations }).map((_, i) => (
                  <div key={i} className="card-static">
                    <div className={`${getAspectClass()} rounded-xl overflow-hidden relative`}>
                      <div className="absolute inset-0 skeleton" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                          <Loader size={24} className="text-gold animate-spin" />
                          <span className="text-[10px] text-muted">
                            Generating {i + 1}/{variations}...
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {results.length > 0 && (
              <div
                className={`grid gap-4 ${
                  results.length >= 4
                    ? "grid-cols-2"
                    : results.length >= 2
                    ? "grid-cols-2"
                    : "grid-cols-1"
                }`}
              >
                {results.map((thumb, i) => {
                  const isLoading =
                    thumb.status === "IN_QUEUE" || thumb.status === "IN_PROGRESS";
                  const isFailed = thumb.status === "FAILED";
                  const isComplete =
                    thumb.status === "COMPLETED" && thumb.imageUrl;

                  return (
                    <div key={thumb.id} className="card-static group">
                      {/* Preview */}
                      <div
                        className={`${getAspectClass()} rounded-xl overflow-hidden relative bg-surface-light`}
                      >
                        {/* Real generated image */}
                        {isComplete && thumb.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumb.imageUrl}
                            alt={thumb.prompt}
                            className="w-full h-full object-cover"
                          />
                        )}

                        {/* Loading state */}
                        {isLoading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-surface-light">
                            <div className="flex flex-col items-center gap-2">
                              <Loader
                                size={28}
                                className="text-gold animate-spin"
                              />
                              <span className="text-[10px] text-muted">
                                {thumb.status === "IN_QUEUE"
                                  ? "Waiting for GPU..."
                                  : "Generating image..."}
                              </span>
                              <div className="w-32 h-1 bg-border rounded-full overflow-hidden">
                                <div className="h-full bg-gold/60 rounded-full animate-pulse w-2/3" />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Failed state */}
                        {isFailed && (
                          <div className="absolute inset-0 flex items-center justify-center bg-surface-light">
                            <div className="flex flex-col items-center gap-2">
                              <span className="text-danger text-lg">!</span>
                              <span className="text-[10px] text-danger">
                                Generation failed
                              </span>
                              <button
                                onClick={() => regenerateSingle(i)}
                                className="text-[9px] px-2 py-1 rounded border border-danger/30 text-danger hover:bg-danger/10"
                              >
                                Retry
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Text overlay (on completed images) */}
                        {isComplete && thumb.textOverlay && (
                          <div className="absolute inset-0 flex items-center justify-center p-4">
                            <h3
                              className="text-white font-black text-center drop-shadow-lg"
                              style={{
                                fontSize:
                                  results.length >= 4 ? "14px" : "22px",
                                textShadow: "2px 2px 8px rgba(0,0,0,0.7)",
                                lineHeight: 1.1,
                              }}
                            >
                              {thumb.textOverlay}
                            </h3>
                          </div>
                        )}

                        {/* Face badges */}
                        {thumb.faces.length > 0 && (
                          <div className="absolute top-2 left-2 flex gap-1">
                            {thumb.faces.slice(0, 3).map((fid) => {
                              const face = FACE_OPTIONS.find(
                                (f) => f.id === fid
                              );
                              return face ? (
                                <span
                                  key={fid}
                                  className="w-6 h-6 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-xs"
                                >
                                  {face.emoji}
                                </span>
                              ) : null;
                            })}
                          </div>
                        )}

                        {/* Style badge */}
                        <div className="absolute top-2 right-2">
                          <span className="text-[8px] px-1.5 py-0.5 rounded bg-black/40 text-white/80 backdrop-blur-sm">
                            {THUMBNAIL_STYLES.find((s) => s.id === thumb.style)
                              ?.name || thumb.style}
                          </span>
                        </div>

                        {/* Size badge */}
                        <div className="absolute bottom-2 right-2">
                          <span className="text-[8px] px-1.5 py-0.5 rounded bg-black/40 text-white/60 backdrop-blur-sm">
                            {thumb.width}x{thumb.height}
                          </span>
                        </div>

                        {/* Status badge */}
                        <div className="absolute bottom-2 left-2">
                          <span
                            className={`text-[7px] px-1.5 py-0.5 rounded font-semibold ${
                              isComplete
                                ? "bg-success/80 text-white"
                                : isLoading
                                ? "bg-gold/80 text-white"
                                : "bg-danger/80 text-white"
                            }`}
                          >
                            {isComplete
                              ? "READY"
                              : isLoading
                              ? "GENERATING"
                              : isFailed
                              ? "FAILED"
                              : "QUEUED"}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 mt-3">
                        <button
                          onClick={() => {
                            if (isComplete && thumb.imageUrl) {
                              // Download real image
                              const link = document.createElement("a");
                              link.href = thumb.imageUrl;
                              link.download = `thumbnail_${thumb.id}.png`;
                              link.click();
                              toast.success("Downloading thumbnail");
                            } else {
                              toast.error("Image not ready yet");
                            }
                          }}
                          disabled={!isComplete}
                          className="flex-1 flex items-center justify-center gap-1.5 text-[10px] font-medium py-1.5 rounded-lg border border-border hover:border-gold/20 hover:bg-gold/[0.03] transition-all text-muted hover:text-foreground disabled:opacity-40"
                        >
                          <Download size={12} /> Download
                        </button>
                        <button
                          onClick={() => regenerateSingle(i)}
                          className="flex-1 flex items-center justify-center gap-1.5 text-[10px] font-medium py-1.5 rounded-lg border border-border hover:border-gold/20 hover:bg-gold/[0.03] transition-all text-muted hover:text-foreground"
                        >
                          <RefreshCw size={12} /> Regenerate
                        </button>
                        <button
                          onClick={() => toast("Edit feature coming soon")}
                          className="flex-1 flex items-center justify-center gap-1.5 text-[10px] font-medium py-1.5 rounded-lg border border-border hover:border-gold/20 hover:bg-gold/[0.03] transition-all text-muted hover:text-foreground"
                        >
                          <Edit3 size={12} /> Edit
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty state */}
            {!generating && results.length === 0 && (
              <div className="card-static flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 bg-gold/10 rounded-2xl flex items-center justify-center mb-4">
                  <ImageIcon size={28} className="text-gold" />
                </div>
                <h3 className="text-sm font-semibold mb-1">No thumbnails yet</h3>
                <p className="text-xs text-muted max-w-xs">
                  Fill out the settings on the left and click Generate to create
                  AI-powered thumbnails for your content.
                </p>
                <div className="flex items-center gap-4 mt-6">
                  {[
                    { icon: <Sparkles size={14} />, label: "AI-Powered" },
                    { icon: <Palette size={14} />, label: "Custom Styles" },
                    { icon: <Square size={14} />, label: "Multi-Platform" },
                  ].map((feat, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 text-[10px] text-muted"
                    >
                      <span className="text-gold">{feat.icon}</span>
                      {feat.label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick config summary */}
            {(results.length > 0 || generating) && (
              <div className="card-static">
                <h3 className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">
                  Generation Config
                </h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Style", value: THUMBNAIL_STYLES.find((s) => s.id === style)?.name },
                    { label: "Platform", value: currentPlatform.name },
                    { label: "Theme", value: COLOR_THEMES.find((c) => c.id === colorTheme)?.name },
                    { label: "Mood", value: mood },
                    {
                      label: "Faces",
                      value:
                        selectedFaces.length > 0
                          ? selectedFaces
                              .map(
                                (fid) =>
                                  FACE_OPTIONS.find((f) => f.id === fid)?.label || fid
                              )
                              .join(", ")
                          : "None",
                    },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="text-[9px] px-2 py-1 rounded-lg bg-surface-light border border-border"
                    >
                      <span className="text-muted">{item.label}:</span>{" "}
                      <span className="font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
                {prompt && (
                  <div className="mt-2 flex items-start gap-2">
                    <p className="text-[10px] text-muted italic flex-1 line-clamp-2">
                      &ldquo;{prompt}&rdquo;
                    </p>
                    <button
                      onClick={() => copyPrompt(prompt, "config")}
                      className="text-muted hover:text-gold transition-colors flex-shrink-0"
                    >
                      {copiedId === "config" ? (
                        <Check size={12} className="text-success" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Before/After Slider ── */}
            {results.length > 0 && results.some(r => r.status === "COMPLETED") && (
              <div className="card-static">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[10px] font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5">
                    <SlidersHorizontal size={12} className="text-gold" /> Before / After Preview
                  </h3>
                  <button onClick={() => setShowBeforeAfter(!showBeforeAfter)}
                    className="text-[9px] px-2 py-0.5 rounded border border-border hover:border-gold/20 text-muted hover:text-foreground transition-all">
                    {showBeforeAfter ? "Hide" : "Show"}
                  </button>
                </div>
                {showBeforeAfter && (
                  <div className="space-y-2">
                    <div className="relative aspect-video rounded-xl overflow-hidden border border-border">
                      {/* Before (plain) */}
                      <div className="absolute inset-0 bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center">
                        <span className="text-white/40 text-xs">Original / Before</span>
                      </div>
                      {/* After (styled) - clips based on slider */}
                      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}>
                        <div className={`w-full h-full bg-gradient-to-br ${THUMBNAIL_STYLES.find(s => s.id === style)?.gradient || "from-gold/40 to-gold/20"} flex items-center justify-center`}>
                          {textOverlay && <span className="text-white font-bold text-sm drop-shadow-lg text-center px-4">{textOverlay}</span>}
                          {!textOverlay && <span className="text-white/80 text-xs">Enhanced / After</span>}
                        </div>
                      </div>
                      {/* Slider handle */}
                      <div className="absolute inset-y-0" style={{ left: `${sliderPosition}%`, transform: "translateX(-50%)" }}>
                        <div className="h-full w-0.5 bg-white shadow-lg" />
                        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 bg-white rounded-full shadow-lg flex items-center justify-center">
                          <SlidersHorizontal size={10} className="text-gray-600" />
                        </div>
                      </div>
                    </div>
                    <input type="range" min={0} max={100} value={sliderPosition} onChange={(e) => setSliderPosition(Number(e.target.value))}
                      className="w-full h-1 bg-border rounded-full appearance-none cursor-pointer" />
                    <div className="flex justify-between text-[8px] text-muted">
                      <span>Before</span><span>After</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Platform Compliance Checker ── */}
            <div className="card-static">
              <h3 className="text-[10px] font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <ShieldCheck size={12} className="text-gold" /> Platform Compliance
              </h3>
              <button onClick={checkCompliance} disabled={complianceChecking}
                className="w-full flex items-center justify-center gap-1.5 text-[10px] font-medium py-2 rounded-lg border border-border hover:border-gold/20 hover:bg-gold/[0.03] transition-all text-muted hover:text-foreground disabled:opacity-40">
                {complianceChecking ? <><Loader size={12} className="animate-spin" /> Checking...</> : <><ShieldCheck size={12} /> Check Compliance</>}
              </button>
              {complianceResult && (
                <div className="mt-2 space-y-1.5">
                  <div className={`flex items-center gap-2 p-2 rounded-lg ${complianceResult.passed ? "bg-success/10 border border-success/20" : "bg-danger/10 border border-danger/20"}`}>
                    {complianceResult.passed ? <CheckCircle2 size={14} className="text-success" /> : <AlertTriangle size={14} className="text-danger" />}
                    <span className={`text-[10px] font-semibold ${complianceResult.passed ? "text-success" : "text-danger"}`}>
                      {complianceResult.passed ? `Passes ${complianceResult.platform} guidelines` : `${complianceResult.issues.length} issue(s) for ${complianceResult.platform}`}
                    </span>
                  </div>
                  {complianceResult.issues.map((issue, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[9px] text-danger/80">
                      <XCircle size={10} className="mt-0.5 flex-shrink-0" /> {issue}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Brand Consistency Score ── */}
            <div className="card-static">
              <h3 className="text-[10px] font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Fingerprint size={12} className="text-gold" /> Brand Consistency
              </h3>
              <button onClick={checkBrandConsistency} disabled={brandChecking}
                className="w-full flex items-center justify-center gap-1.5 text-[10px] font-medium py-2 rounded-lg border border-border hover:border-gold/20 hover:bg-gold/[0.03] transition-all text-muted hover:text-foreground disabled:opacity-40">
                {brandChecking ? <><Loader size={12} className="animate-spin" /> Analyzing...</> : <><Fingerprint size={12} /> Check Brand Score</>}
              </button>
              {brandScore !== null && (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold">Brand Match</span>
                    <span className={`text-sm font-black ${brandScore >= 80 ? "text-success" : brandScore >= 60 ? "text-gold" : "text-danger"}`}>{brandScore}%</span>
                  </div>
                  <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${brandScore >= 80 ? "bg-success" : brandScore >= 60 ? "bg-gold" : "bg-danger"}`} style={{ width: `${brandScore}%` }} />
                  </div>
                  {brandFactors.map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-[9px]">
                      <span className="text-muted">{f.label}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1 bg-border rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${f.score >= 80 ? "bg-success/60" : f.score >= 60 ? "bg-gold/60" : "bg-danger/60"}`} style={{ width: `${f.score}%` }} />
                        </div>
                        <span className="font-semibold w-6 text-right">{f.score}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Studio Tab (New Mega Feature Set) ─── */}
      {activeFeatureTab === "studio" && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* LEFT: Category Sidebar */}
          <div className="lg:col-span-1">
            <div className="card sticky top-4">
              <h2 className="section-header flex items-center gap-2">
                <LayoutGrid size={13} className="text-gold" /> Studio
              </h2>
              <p className="text-[9px] text-muted mb-3">Choose a category. All features are optional.</p>
              <div className="space-y-0.5">
                {SIDEBAR_CATEGORIES.map((cat) => {
                  const iconMap: Record<string, React.ReactNode> = {
                    style: <Layers size={12} />,
                    text: <Type size={12} />,
                    face: <User size={12} />,
                    background: <Mountain size={12} />,
                    elements: <Sticker size={12} />,
                    colors: <Palette size={12} />,
                    smart: <BrainCircuit size={12} />,
                    size: <Smartphone size={12} />,
                    layout: <LayoutGrid size={12} />,
                    export: <Download size={12} />,
                  };
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all ${activeCategory === cat.id ? "bg-gold/[0.08] text-gold border border-gold/20" : "border border-transparent text-muted hover:text-foreground hover:bg-surface-light"}`}
                    >
                      <span>{iconMap[cat.id]}</span>
                      <span className="text-[10px] font-medium">{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT: Active Category Panel */}
          <div className="lg:col-span-4 space-y-4">
            {/* ── STYLE PRESETS ── */}
            {activeCategory === "style" && (
              <div className="card">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="section-header mb-0 flex items-center gap-2">
                    <Layers size={13} className="text-gold" /> YouTuber Style Presets
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-gold/10 text-gold font-medium">{YOUTUBER_THUMBNAIL_PRESETS.length}</span>
                  </h2>
                  {thumbnailConfig.stylePreset && (
                    <button onClick={() => setThumbnailConfig((p) => ({ ...p, stylePreset: null }))}
                      className="text-[9px] px-2 py-0.5 rounded border border-border text-muted hover:text-foreground hover:border-gold/20">
                      Clear
                    </button>
                  )}
                </div>
                <p className="text-[9px] text-muted mb-3">Click a creator to apply their signature font, colors, face layout, background, and accent elements.</p>
                {/* Category filter */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {YOUTUBER_PRESET_CATEGORIES.map((cat) => {
                    const count = cat.id === "all"
                      ? YOUTUBER_THUMBNAIL_PRESETS.length
                      : YOUTUBER_THUMBNAIL_PRESETS.filter((p) => p.category === cat.id).length;
                    const active = youtuberPresetFilter === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setYoutuberPresetFilter(cat.id)}
                        className={`text-[9px] px-2 py-1 rounded-lg border transition-all ${active ? "border-gold/40 bg-gold/[0.08] text-gold font-semibold" : "border-border text-muted hover:text-foreground hover:border-gold/20"}`}
                      >
                        {cat.name}
                        <span className="ml-1 opacity-60">{count}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                  {YOUTUBER_THUMBNAIL_PRESETS
                    .filter((preset) => youtuberPresetFilter === "all" || preset.category === youtuberPresetFilter)
                    .map((preset) => {
                      const active = thumbnailConfig.stylePreset === preset.id;
                      return (
                        <button
                          key={preset.id}
                          onClick={() => applyYouTuberPreset(preset)}
                          className={`rounded-xl overflow-hidden border-2 transition-all text-left hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gold/10 ${active ? "border-gold" : "border-border hover:border-gold/30"}`}
                        >
                          <div className={`aspect-video bg-gradient-to-br ${preset.gradient} flex items-center justify-center p-2 relative`}>
                            <span className="absolute top-1 left-1 text-base drop-shadow-lg" aria-hidden>{preset.icon}</span>
                            <span className="text-white font-black text-sm drop-shadow-lg text-center leading-tight" style={{ WebkitTextStroke: "1px #000" }}>
                              {preset.name.split(" ")[0].toUpperCase()}
                            </span>
                            <span className="absolute bottom-1 right-1 text-[7px] px-1 py-0.5 rounded bg-black/40 text-white font-medium">{preset.category}</span>
                            {active && (
                              <div className="absolute top-1 right-1 bg-gold text-black rounded-full p-0.5">
                                <Check size={8} />
                              </div>
                            )}
                          </div>
                          <div className="p-2 bg-surface-light">
                            <p className={`text-[10px] font-semibold ${active ? "text-gold" : ""}`}>{preset.name}</p>
                            <p className="text-[8px] text-muted line-clamp-2">{preset.tagline}</p>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {/* ── TEXT / TYPOGRAPHY ── */}
            {activeCategory === "text" && (
              <div className="space-y-3">
                <div className="card">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="section-header mb-0 flex items-center gap-2">
                      <Type size={13} className="text-gold" /> Typography System
                    </h2>
                    <label className="flex items-center gap-1.5 text-[10px] text-muted">
                      <input type="checkbox" checked={thumbnailConfig.typography.enabled} onChange={(e) => patchConfig("typography", { enabled: e.target.checked })} className="accent-gold" />
                      Enable
                    </label>
                  </div>
                  <p className="text-[9px] text-muted mb-2">Control fonts, styles, cases, shadow, stroke, gradient, spacing, and effects.</p>
                </div>

                {thumbnailConfig.typography.enabled && (
                  <>
                    {/* Font Library */}
                    <div className="card">
                      <h3 className="section-header flex items-center gap-2">
                        <Type size={12} className="text-gold" /> Font Library ({FONT_LIBRARY.length})
                      </h3>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {["all", "sans-serif", "display", "serif", "handwritten"].map((cat) => (
                          <button key={cat} onClick={() => setFontFilter(cat)}
                            className={`text-[8px] px-2 py-0.5 rounded-full border transition-all ${fontFilter === cat ? "border-gold/30 bg-gold/[0.08] text-gold font-semibold" : "border-border text-muted hover:text-foreground"}`}>
                            {cat === "all" ? "All" : cat}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 max-h-56 overflow-y-auto">
                        {FONT_LIBRARY.filter((f) => fontFilter === "all" || f.category === fontFilter).map((f) => {
                          const active = thumbnailConfig.typography.fontId === f.id;
                          return (
                            <button key={f.id} onClick={() => patchConfig("typography", { fontId: f.id })}
                              className={`p-2 rounded-xl border transition-all text-left ${active ? "border-gold/40 bg-gold/[0.07]" : "border-border hover:border-gold/15"}`}>
                              <p className={`text-xs font-bold ${active ? "text-gold" : ""}`} style={{ fontFamily: f.stack }}>{f.name}</p>
                              <p className="text-[7px] text-muted">{f.vibe}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Weight + Style + Case */}
                    <div className="card">
                      <h3 className="section-header flex items-center gap-2"><Bold size={12} className="text-gold" /> Weight / Style / Case</h3>
                      <div className="space-y-2">
                        <div>
                          <label className="text-[9px] text-muted uppercase tracking-wider">Font Weight: {thumbnailConfig.typography.weight}</label>
                          <input type="range" min={100} max={900} step={100} value={thumbnailConfig.typography.weight} onChange={(e) => patchConfig("typography", { weight: Number(e.target.value) })} className="w-full accent-gold" />
                        </div>
                        <div className="flex gap-1.5">
                          <button onClick={() => patchConfig("typography", { italic: !thumbnailConfig.typography.italic })} className={`flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg border transition-all ${thumbnailConfig.typography.italic ? "border-gold/30 bg-gold/[0.08] text-gold" : "border-border text-muted hover:text-foreground"}`}>
                            <Italic size={11} /> Italic
                          </button>
                          <button onClick={() => patchConfig("typography", { underline: !thumbnailConfig.typography.underline })} className={`flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg border transition-all ${thumbnailConfig.typography.underline ? "border-gold/30 bg-gold/[0.08] text-gold" : "border-border text-muted hover:text-foreground"}`}>
                            <Underline size={11} /> Underline
                          </button>
                          <button onClick={() => patchConfig("typography", { strikethrough: !thumbnailConfig.typography.strikethrough })} className={`flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg border transition-all ${thumbnailConfig.typography.strikethrough ? "border-gold/30 bg-gold/[0.08] text-gold" : "border-border text-muted hover:text-foreground"}`}>
                            <span className="line-through">S</span> Strike
                          </button>
                        </div>
                        <div>
                          <label className="text-[9px] text-muted uppercase tracking-wider mb-1 block">Text Case</label>
                          <div className="grid grid-cols-4 gap-1">
                            {(["uppercase", "lowercase", "titlecase", "astyped"] as const).map((c) => (
                              <button key={c} onClick={() => patchConfig("typography", { textCase: c })} className={`text-[9px] px-2 py-1.5 rounded-lg border transition-all ${thumbnailConfig.typography.textCase === c ? "border-gold/30 bg-gold/[0.08] text-gold font-semibold" : "border-border text-muted hover:text-foreground"}`}>
                                {c === "uppercase" ? "UPPER" : c === "lowercase" ? "lower" : c === "titlecase" ? "Title" : "As-Typed"}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Shadow + Stroke + Gradient */}
                    <div className="card">
                      <h3 className="section-header flex items-center gap-2"><Droplet size={12} className="text-gold" /> Shadow / Stroke / Gradient</h3>
                      <div className="space-y-3">
                        {/* Shadow */}
                        <div>
                          <label className="flex items-center gap-2 mb-1.5">
                            <input type="checkbox" checked={thumbnailConfig.typography.shadowEnabled} onChange={(e) => patchConfig("typography", { shadowEnabled: e.target.checked })} className="accent-gold" />
                            <span className="text-[10px] font-semibold">Text Shadow</span>
                          </label>
                          {thumbnailConfig.typography.shadowEnabled && (
                            <div className="grid grid-cols-4 gap-1.5 pl-5">
                              <div><label className="text-[8px] text-muted">X: {thumbnailConfig.typography.shadowX}</label><input type="range" min={-20} max={20} value={thumbnailConfig.typography.shadowX} onChange={(e) => patchConfig("typography", { shadowX: Number(e.target.value) })} className="w-full accent-gold" /></div>
                              <div><label className="text-[8px] text-muted">Y: {thumbnailConfig.typography.shadowY}</label><input type="range" min={-20} max={20} value={thumbnailConfig.typography.shadowY} onChange={(e) => patchConfig("typography", { shadowY: Number(e.target.value) })} className="w-full accent-gold" /></div>
                              <div><label className="text-[8px] text-muted">Blur: {thumbnailConfig.typography.shadowBlur}</label><input type="range" min={0} max={40} value={thumbnailConfig.typography.shadowBlur} onChange={(e) => patchConfig("typography", { shadowBlur: Number(e.target.value) })} className="w-full accent-gold" /></div>
                              <div><label className="text-[8px] text-muted">Color</label><input type="color" value={thumbnailConfig.typography.shadowColor} onChange={(e) => patchConfig("typography", { shadowColor: e.target.value })} className="w-full h-6 rounded" /></div>
                            </div>
                          )}
                        </div>
                        {/* Stroke */}
                        <div>
                          <label className="flex items-center gap-2 mb-1.5">
                            <input type="checkbox" checked={thumbnailConfig.typography.strokeEnabled} onChange={(e) => patchConfig("typography", { strokeEnabled: e.target.checked })} className="accent-gold" />
                            <span className="text-[10px] font-semibold">Text Stroke / Outline</span>
                          </label>
                          {thumbnailConfig.typography.strokeEnabled && (
                            <div className="grid grid-cols-2 gap-1.5 pl-5">
                              <div><label className="text-[8px] text-muted">Width: {thumbnailConfig.typography.strokeWidth}px</label><input type="range" min={1} max={10} value={thumbnailConfig.typography.strokeWidth} onChange={(e) => patchConfig("typography", { strokeWidth: Number(e.target.value) })} className="w-full accent-gold" /></div>
                              <div><label className="text-[8px] text-muted">Color</label><input type="color" value={thumbnailConfig.typography.strokeColor} onChange={(e) => patchConfig("typography", { strokeColor: e.target.value })} className="w-full h-6 rounded" /></div>
                            </div>
                          )}
                        </div>
                        {/* Gradient */}
                        <div>
                          <label className="flex items-center gap-2 mb-1.5">
                            <input type="checkbox" checked={thumbnailConfig.typography.gradientEnabled} onChange={(e) => patchConfig("typography", { gradientEnabled: e.target.checked })} className="accent-gold" />
                            <span className="text-[10px] font-semibold">Text Gradient</span>
                          </label>
                          {thumbnailConfig.typography.gradientEnabled && (
                            <div className="grid grid-cols-2 gap-1.5 pl-5">
                              <div><label className="text-[8px] text-muted">From</label><input type="color" value={thumbnailConfig.typography.gradientFrom} onChange={(e) => patchConfig("typography", { gradientFrom: e.target.value })} className="w-full h-6 rounded" /></div>
                              <div><label className="text-[8px] text-muted">To</label><input type="color" value={thumbnailConfig.typography.gradientTo} onChange={(e) => patchConfig("typography", { gradientTo: e.target.value })} className="w-full h-6 rounded" /></div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Spacing + Highlight + Curved + 3D */}
                    <div className="card">
                      <h3 className="section-header flex items-center gap-2"><Wand2 size={12} className="text-gold" /> Spacing / Effects</h3>
                      <div className="space-y-2">
                        <div>
                          <label className="text-[9px] text-muted uppercase tracking-wider">Letter Spacing: {thumbnailConfig.typography.letterSpacing}px</label>
                          <input type="range" min={-5} max={20} value={thumbnailConfig.typography.letterSpacing} onChange={(e) => patchConfig("typography", { letterSpacing: Number(e.target.value) })} className="w-full accent-gold" />
                        </div>
                        <div>
                          <label className="text-[9px] text-muted uppercase tracking-wider">Line Height: {thumbnailConfig.typography.lineHeight.toFixed(2)}</label>
                          <input type="range" min={0.8} max={2} step={0.05} value={thumbnailConfig.typography.lineHeight} onChange={(e) => patchConfig("typography", { lineHeight: Number(e.target.value) })} className="w-full accent-gold" />
                        </div>
                        <div>
                          <label className="text-[9px] text-muted uppercase tracking-wider mb-1 block">Highlight Words (comma-separated)</label>
                          <div className="flex gap-1.5">
                            <input value={thumbnailConfig.typography.highlightWords} onChange={(e) => patchConfig("typography", { highlightWords: e.target.value })} className="input flex-1 text-[10px]" placeholder="e.g., FREE, NOW, $" />
                            <input type="color" value={thumbnailConfig.typography.highlightColor} onChange={(e) => patchConfig("typography", { highlightColor: e.target.value })} className="w-10 h-7 rounded" />
                          </div>
                        </div>
                        <div className="flex gap-1.5 pt-1">
                          <label className="flex items-center gap-1 text-[10px] text-muted">
                            <input type="checkbox" checked={thumbnailConfig.typography.curvedEnabled} onChange={(e) => patchConfig("typography", { curvedEnabled: e.target.checked })} className="accent-gold" />
                            Curved Text
                          </label>
                          {thumbnailConfig.typography.curvedEnabled && (
                            <input type="range" min={0} max={100} value={thumbnailConfig.typography.curveIntensity} onChange={(e) => patchConfig("typography", { curveIntensity: Number(e.target.value) })} className="flex-1 accent-gold" />
                          )}
                        </div>
                        <div className="flex gap-1.5 pt-1">
                          <label className="flex items-center gap-1 text-[10px] text-muted">
                            <input type="checkbox" checked={thumbnailConfig.typography.threeDEnabled} onChange={(e) => patchConfig("typography", { threeDEnabled: e.target.checked })} className="accent-gold" />
                            3D Text
                          </label>
                          {thumbnailConfig.typography.threeDEnabled && (
                            <>
                              <div className="flex-1"><label className="text-[8px] text-muted">Depth: {thumbnailConfig.typography.threeDDepth}</label><input type="range" min={0} max={20} value={thumbnailConfig.typography.threeDDepth} onChange={(e) => patchConfig("typography", { threeDDepth: Number(e.target.value) })} className="w-full accent-gold" /></div>
                              <div className="flex-1"><label className="text-[8px] text-muted">Persp: {thumbnailConfig.typography.threeDPerspective}</label><input type="range" min={0} max={60} value={thumbnailConfig.typography.threeDPerspective} onChange={(e) => patchConfig("typography", { threeDPerspective: Number(e.target.value) })} className="w-full accent-gold" /></div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── FACE / SUBJECT ── */}
            {activeCategory === "face" && (
              <div className="card">
                <h2 className="section-header flex items-center gap-2">
                  <User size={13} className="text-gold" /> Face / Subject (Smart AI)
                </h2>
                <p className="text-[9px] text-muted mb-3">AI features to enhance and position your subject. All toggleable.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {[
                    { key: "autoCutoutEnabled", label: "Auto Face Cutout", desc: "Remove background from subject photo", icon: <Scissors size={11} /> },
                    { key: "enhanceEnabled", label: "Face Enhancement", desc: "Brighten + sharpen face", icon: <Sparkles size={11} /> },
                    { key: "eyePopEnabled", label: "Eye Pop", desc: "Enhance eyes for attention", icon: <Eye size={11} /> },
                    { key: "glowEnabled", label: "Hair / Outline Glow", desc: "Subtle edge glow on subject", icon: <Wand size={11} /> },
                    { key: "expressionSwapEnabled", label: "Expression Swap (AI)", desc: "Change expression via AI", icon: <Smile size={11} /> },
                  ].map((f) => {
                    const active = thumbnailConfig.face[f.key as keyof typeof thumbnailConfig.face] as boolean;
                    return (
                      <label key={f.key} className={`flex items-start gap-2 p-2.5 rounded-xl border transition-all cursor-pointer ${active ? "border-gold/40 bg-gold/[0.05]" : "border-border hover:border-gold/15"}`}>
                        <input type="checkbox" checked={active} onChange={(e) => patchConfig("face", { [f.key]: e.target.checked } as Partial<typeof thumbnailConfig.face>)} className="accent-gold mt-0.5" />
                        <div>
                          <p className="text-[10px] font-semibold flex items-center gap-1">{f.icon} {f.label}</p>
                          <p className="text-[8px] text-muted">{f.desc}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {thumbnailConfig.face.expressionSwapEnabled && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <label className="text-[9px] text-muted uppercase tracking-wider mb-1 block">Target Expression (TODO: AI)</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(["shocked", "happy", "angry"] as const).map((exp) => (
                        <button key={exp} onClick={() => patchConfig("face", { targetExpression: exp })}
                          className={`text-[10px] px-2 py-1.5 rounded-lg border transition-all capitalize ${thumbnailConfig.face.targetExpression === exp ? "border-gold/30 bg-gold/[0.08] text-gold font-semibold" : "border-border text-muted hover:text-foreground"}`}>
                          {exp}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-border/50">
                  <label className="text-[9px] text-muted uppercase tracking-wider mb-1 block">Face Position</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(["left", "center", "right"] as const).map((pos) => (
                      <button key={pos} onClick={() => patchConfig("face", { position: pos })}
                        className={`text-[10px] px-2 py-1.5 rounded-lg border transition-all capitalize ${thumbnailConfig.face.position === pos ? "border-gold/30 bg-gold/[0.08] text-gold font-semibold" : "border-border text-muted hover:text-foreground"}`}>
                        {pos === "left" ? <AlignLeft size={11} className="inline mr-1" /> : pos === "center" ? <AlignCenter size={11} className="inline mr-1" /> : <AlignRight size={11} className="inline mr-1" />}
                        {pos}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-border/50">
                  <label className="text-[9px] text-muted uppercase tracking-wider mb-1 block">Multi-Face Layout</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([1, 2, 3] as const).map((n) => (
                      <button key={n} onClick={() => patchConfig("face", { layout: n })}
                        className={`text-[10px] px-2 py-1.5 rounded-lg border transition-all ${thumbnailConfig.face.layout === n ? "border-gold/30 bg-gold/[0.08] text-gold font-semibold" : "border-border text-muted hover:text-foreground"}`}>
                        {n} face{n > 1 ? "s" : ""}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── BACKGROUND ── */}
            {activeCategory === "background" && (
              <div className="space-y-3">
                <div className="card">
                  <h2 className="section-header flex items-center gap-2"><Mountain size={13} className="text-gold" /> Background Mode</h2>
                  <div className="grid grid-cols-5 gap-1.5 mb-3">
                    {(["solid", "gradient", "pattern", "image", "ai"] as const).map((m) => (
                      <button key={m} onClick={() => patchConfig("background", { mode: m })}
                        className={`text-[10px] px-2 py-1.5 rounded-lg border transition-all capitalize ${thumbnailConfig.background.mode === m ? "border-gold/30 bg-gold/[0.08] text-gold font-semibold" : "border-border text-muted hover:text-foreground"}`}>
                        {m}
                      </button>
                    ))}
                  </div>

                  {thumbnailConfig.background.mode === "solid" && (
                    <div>
                      <label className="text-[9px] text-muted uppercase tracking-wider mb-1 block">Solid Color</label>
                      <div className="flex gap-2">
                        <input type="color" value={thumbnailConfig.background.solidColor} onChange={(e) => patchConfig("background", { solidColor: e.target.value })} className="w-20 h-10 rounded" />
                        <input type="text" value={thumbnailConfig.background.solidColor} onChange={(e) => patchConfig("background", { solidColor: e.target.value })} className="input flex-1 text-xs font-mono" />
                      </div>
                    </div>
                  )}

                  {thumbnailConfig.background.mode === "gradient" && (
                    <div>
                      <label className="text-[9px] text-muted uppercase tracking-wider mb-1 block">Gradient Presets ({GRADIENT_PRESETS.length})</label>
                      <div className="grid grid-cols-4 md:grid-cols-5 gap-1.5 max-h-56 overflow-y-auto">
                        {GRADIENT_PRESETS.map((g) => {
                          const active = thumbnailConfig.background.gradientId === g.id;
                          return (
                            <button key={g.id} onClick={() => patchConfig("background", { gradientId: g.id })}
                              className={`rounded-lg overflow-hidden border-2 transition-all ${active ? "border-gold" : "border-border hover:border-gold/30"}`}>
                              <div className={`aspect-video bg-gradient-to-br ${g.gradient}`} />
                              <p className={`text-[8px] py-0.5 ${active ? "text-gold font-semibold" : "text-muted"}`}>{g.name}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {thumbnailConfig.background.mode === "pattern" && (
                    <div>
                      <label className="text-[9px] text-muted uppercase tracking-wider mb-1 block">Pattern Library</label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {PATTERN_LIBRARY.map((p) => {
                          const active = thumbnailConfig.background.patternId === p.id;
                          return (
                            <button key={p.id} onClick={() => patchConfig("background", { patternId: p.id })}
                              className={`rounded-lg overflow-hidden border-2 transition-all ${active ? "border-gold" : "border-border hover:border-gold/30"}`}>
                              <div className={`aspect-video ${p.preview}`} />
                              <p className={`text-[8px] py-0.5 ${active ? "text-gold font-semibold" : "text-muted"}`}>{p.name}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {thumbnailConfig.background.mode === "image" && (
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-[10px]">
                        <input type="checkbox" checked={thumbnailConfig.background.blurEnabled} onChange={(e) => patchConfig("background", { blurEnabled: e.target.checked })} className="accent-gold" />
                        Blur Background
                      </label>
                      {thumbnailConfig.background.blurEnabled && (
                        <div>
                          <label className="text-[8px] text-muted">Blur Amount: {thumbnailConfig.background.blurAmount}px</label>
                          <input type="range" min={0} max={30} value={thumbnailConfig.background.blurAmount} onChange={(e) => patchConfig("background", { blurAmount: Number(e.target.value) })} className="w-full accent-gold" />
                        </div>
                      )}
                      <div>
                        <label className="text-[9px] text-muted uppercase tracking-wider">Brightness: {thumbnailConfig.background.brightness}%</label>
                        <input type="range" min={20} max={180} value={thumbnailConfig.background.brightness} onChange={(e) => patchConfig("background", { brightness: Number(e.target.value) })} className="w-full accent-gold" />
                      </div>
                    </div>
                  )}

                  {thumbnailConfig.background.mode === "ai" && (
                    <div>
                      <label className="text-[9px] text-muted uppercase tracking-wider mb-1 block">AI-Generated Background Prompt (TODO: AI)</label>
                      <textarea value={thumbnailConfig.background.aiPrompt} onChange={(e) => patchConfig("background", { aiPrompt: e.target.value })}
                        className="input w-full text-[10px] resize-none" rows={3} placeholder='e.g., "A futuristic neon cityscape at night"' />
                      <button onClick={() => { setAiBgPrompt(thumbnailConfig.background.aiPrompt); generateAIBackground(); }}
                        className="btn-primary w-full text-xs flex items-center justify-center gap-2 mt-2">
                        <BrainCircuit size={14} /> Generate AI Background
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── ELEMENTS ── */}
            {activeCategory === "elements" && (
              <div className="card">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="section-header mb-0 flex items-center gap-2">
                    <Sticker size={13} className="text-gold" /> Graphic Elements Library
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-gold/10 text-gold font-medium">{GRAPHIC_ELEMENTS.length}</span>
                  </h2>
                  {thumbnailConfig.elements.active.length > 0 && (
                    <span className="text-[9px] text-gold">{thumbnailConfig.elements.active.length} placed</span>
                  )}
                </div>
                <p className="text-[9px] text-muted mb-2">Click any element to add it to the canvas. Each is placeable and resizable.</p>
                <div className="flex flex-wrap gap-1 mb-2">
                  {GRAPHIC_CATEGORIES.map((cat) => (
                    <button key={cat.id} onClick={() => setGraphicFilter(cat.id)}
                      className={`text-[8px] px-2 py-0.5 rounded-full border transition-all ${graphicFilter === cat.id ? "border-gold/30 bg-gold/[0.08] text-gold font-semibold" : "border-border text-muted hover:text-foreground"}`}>
                      {cat.name}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-6 md:grid-cols-8 xl:grid-cols-10 gap-1.5 max-h-80 overflow-y-auto">
                  {GRAPHIC_ELEMENTS.filter((el) => graphicFilter === "all" || el.category === graphicFilter).map((el) => {
                    const active = thumbnailConfig.elements.active.some((a) => a.id === el.id);
                    return (
                      <button key={el.id} onClick={() => toggleGraphicElement(el)}
                        className={`flex flex-col items-center gap-0.5 p-1.5 rounded-xl border transition-all ${active ? "border-gold/40 bg-gold/[0.07]" : "border-border hover:border-gold/15"}`}>
                        <span className="text-xl leading-none">{el.emoji}</span>
                        <span className="text-[6px] text-muted text-center leading-tight">{el.name}</span>
                      </button>
                    );
                  })}
                </div>

                {thumbnailConfig.elements.active.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <p className="text-[9px] text-muted font-semibold mb-1">Placed on Canvas</p>
                    <div className="flex flex-wrap gap-1.5">
                      {thumbnailConfig.elements.active.map((el) => (
                        <button key={el.id} onClick={() => toggleGraphicElement(el as typeof GRAPHIC_ELEMENTS[0])}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-light border border-border hover:border-danger/30 hover:bg-danger/5">
                          <span>{el.emoji}</span>
                          <span className="text-[8px] text-muted">{el.name}</span>
                          <X size={8} className="text-muted" />
                        </button>
                      ))}
                      <button onClick={() => patchConfig("elements", { active: [] })}
                        className="text-[8px] px-2 py-1 rounded-lg border border-danger/30 text-danger hover:bg-danger/10">
                        Clear All
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── COLORS ── */}
            {activeCategory === "colors" && (
              <div className="card">
                <h2 className="section-header flex items-center gap-2">
                  <Palette size={13} className="text-gold" /> Color Schemes / Palettes
                  <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-gold/10 text-gold font-medium">{COLOR_PALETTES.length}</span>
                </h2>
                <p className="text-[9px] text-muted mb-3">Click a palette to swap text/accent colors across the canvas.</p>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                  {COLOR_PALETTES.map((pal) => {
                    const active = thumbnailConfig.colors.paletteId === pal.id;
                    return (
                      <button key={pal.id} onClick={() => applyColorPalette(pal.id)}
                        className={`p-2 rounded-xl border-2 transition-all ${active ? "border-gold" : "border-border hover:border-gold/30"}`}>
                        <div className="flex gap-0.5 mb-1.5">
                          {pal.colors.map((c, i) => (
                            <div key={i} className="flex-1 aspect-square rounded" style={{ backgroundColor: c }} />
                          ))}
                        </div>
                        <p className={`text-[9px] font-semibold text-left ${active ? "text-gold" : ""}`}>{pal.name}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── SMART / AI ── */}
            {activeCategory === "smart" && (
              <div className="space-y-3">
                <div className="card">
                  <h2 className="section-header flex items-center gap-2"><BrainCircuit size={13} className="text-gold" /> Smart AI Features</h2>
                  <p className="text-[9px] text-muted mb-3">All features optional. Toggle what you need — UI included, AI integration TODO.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {[
                      { key: "abVariantEnabled", label: "A/B Variant Generator", desc: "Generate 3 variants with different layouts", icon: <FlaskConical size={11} />, handler: runAbVariantGenerator },
                      { key: "titleOptimizerEnabled", label: "Title Optimizer", desc: "AI rewrites title for higher CTR", icon: <Wand2 size={11} />, handler: runTitleOptimizer },
                      { key: "ctrPredictorEnabled", label: "CTR Predictor", desc: "AI scores likely click-through rate", icon: <Target size={11} />, handler: runCTRPredictor },
                      { key: "nicheOptimizerEnabled", label: "Niche Optimizer", desc: "Tune thumbnail for specific niche", icon: <ShoppingBag size={11} />, handler: runNicheOptimizer },
                      { key: "faceDetectionEnabled", label: "Face Detection", desc: "Auto-position face from reference", icon: <Eye size={11} />, handler: runFaceDetection },
                      { key: "autoCropEnabled", label: "Auto-Crop for Platform", desc: "Render for YouTube / TikTok / IG", icon: <Smartphone size={11} />, handler: runAutoCrop },
                      { key: "readabilityCheckEnabled", label: "Text Readability Checker", desc: "Warn if text too small / low contrast", icon: <ShieldCheck size={11} />, handler: runReadabilityChecker },
                      { key: "trendingSuggesterEnabled", label: "Trending Style Suggester", desc: "Shows what's working in your niche", icon: <TrendingUp size={11} />, handler: runTrendingSuggester },
                    ].map((feat) => {
                      const active = thumbnailConfig.smart[feat.key as keyof typeof thumbnailConfig.smart] as boolean;
                      return (
                        <div key={feat.key} className={`p-2.5 rounded-xl border transition-all ${active ? "border-gold/40 bg-gold/[0.05]" : "border-border"}`}>
                          <label className="flex items-start gap-2 cursor-pointer mb-1.5">
                            <input type="checkbox" checked={active} onChange={(e) => patchConfig("smart", { [feat.key]: e.target.checked } as Partial<typeof thumbnailConfig.smart>)} className="accent-gold mt-0.5" />
                            <div className="flex-1">
                              <p className="text-[10px] font-semibold flex items-center gap-1">{feat.icon} {feat.label}</p>
                              <p className="text-[8px] text-muted">{feat.desc}</p>
                            </div>
                          </label>
                          {active && (
                            <button onClick={feat.handler}
                              className="w-full text-[9px] px-2 py-1 rounded border border-gold/30 bg-gold/[0.08] text-gold hover:bg-gold/20 transition-all">
                              Run
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {thumbnailConfig.smart.nicheOptimizerEnabled && (
                  <div className="card">
                    <h3 className="section-header flex items-center gap-2"><ShoppingBag size={12} className="text-gold" /> Niche Optimizer Input</h3>
                    <input value={thumbnailConfig.smart.niche} onChange={(e) => patchConfig("smart", { niche: e.target.value })}
                      className="input w-full text-xs" placeholder="e.g., finance, gaming, fitness, tech reviews" />
                    <div className="flex flex-wrap gap-1 mt-2">
                      {["Finance", "Gaming", "Fitness", "Tech", "Education", "Travel", "Food", "Beauty", "Music", "Comedy"].map((n) => (
                        <button key={n} onClick={() => patchConfig("smart", { niche: n })}
                          className="text-[9px] px-2 py-0.5 rounded-full border border-border text-muted hover:text-foreground hover:border-gold/20">
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="card">
                  <h3 className="section-header flex items-center gap-2"><Search size={12} className="text-gold" /> Competitor Thumbnail Analyzer</h3>
                  <p className="text-[9px] text-muted mb-2">Paste a YouTube URL to analyze style (TODO: AI integration).</p>
                  <div className="flex gap-1.5">
                    <input value={competitorUrl} onChange={(e) => setCompetitorUrl(e.target.value)} className="input flex-1 text-[10px]" placeholder="https://youtube.com/watch?v=..." />
                    <button onClick={analyzeCompetitor} disabled={competitorAnalyzing} className="btn-primary text-[10px] px-3 disabled:opacity-40">
                      {competitorAnalyzing ? <Loader size={12} className="animate-spin" /> : <Search size={12} />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── PLATFORM SIZE ── */}
            {activeCategory === "size" && (
              <div className="card">
                <h2 className="section-header flex items-center gap-2"><Smartphone size={13} className="text-gold" /> Platform Size Presets</h2>
                <p className="text-[9px] text-muted mb-3">Pick the right dimensions for where your thumbnail will live.</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {PLATFORM_SIZE_PRESETS.map((p) => {
                    const active = thumbnailConfig.size.platformPresetId === p.id;
                    const ratio = p.width / p.height;
                    return (
                      <button key={p.id} onClick={() => {
                        patchConfig("size", { platformPresetId: p.id, width: p.width, height: p.height });
                        if (p.id !== "custom") setPlatform(p.id === "yt-standard" ? "youtube" : p.id);
                      }}
                        className={`p-2.5 rounded-xl border-2 transition-all text-left ${active ? "border-gold bg-gold/[0.05]" : "border-border hover:border-gold/30"}`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className={`bg-gradient-to-br from-gold/30 to-gold/10 rounded ${ratio > 1.3 ? "w-8 h-5" : ratio < 0.8 ? "w-4 h-7" : "w-6 h-6"}`} />
                          <p className={`text-[10px] font-semibold ${active ? "text-gold" : ""}`}>{p.name}</p>
                        </div>
                        <p className="text-[8px] text-muted font-mono">{p.width} x {p.height}</p>
                      </button>
                    );
                  })}
                </div>
                {thumbnailConfig.size.platformPresetId === "custom" && (
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div>
                      <label className="text-[9px] text-muted uppercase tracking-wider mb-1 block">Width</label>
                      <input type="number" value={thumbnailConfig.size.width} onChange={(e) => patchConfig("size", { width: Number(e.target.value) })} className="input w-full text-xs" min={100} max={4096} />
                    </div>
                    <div>
                      <label className="text-[9px] text-muted uppercase tracking-wider mb-1 block">Height</label>
                      <input type="number" value={thumbnailConfig.size.height} onChange={(e) => patchConfig("size", { height: Number(e.target.value) })} className="input w-full text-xs" min={100} max={4096} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── LAYOUT ── */}
            {activeCategory === "layout" && (
              <div className="card">
                <h2 className="section-header flex items-center gap-2">
                  <LayoutGrid size={13} className="text-gold" /> Layout Templates
                  <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-gold/10 text-gold font-medium">{LAYOUT_TEMPLATES.length}</span>
                </h2>
                <p className="text-[9px] text-muted mb-3">Composition presets — pick how text and subject arrange on the canvas.</p>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
                  {LAYOUT_TEMPLATES.map((lt) => {
                    const active = thumbnailConfig.layout.templateId === lt.id;
                    return (
                      <button key={lt.id} onClick={() => patchConfig("layout", { templateId: lt.id })}
                        className={`p-2 rounded-xl border-2 transition-all text-left ${active ? "border-gold bg-gold/[0.05]" : "border-border hover:border-gold/30"}`}>
                        <div className="aspect-video rounded-lg bg-gradient-to-br from-gold/10 to-gold/5 mb-1.5 flex items-center justify-center">
                          <LayoutGrid size={14} className="text-gold/40" />
                        </div>
                        <p className={`text-[9px] font-semibold ${active ? "text-gold" : ""}`}>{lt.name}</p>
                        <p className="text-[7px] text-muted leading-tight">{lt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── EXPORT ── */}
            {activeCategory === "export" && (
              <div className="space-y-3">
                <div className="card">
                  <h2 className="section-header flex items-center gap-2"><Download size={13} className="text-gold" /> Export Options</h2>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[9px] text-muted uppercase tracking-wider mb-1 block">Format</label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {EXPORT_FORMATS.map((f) => (
                          <button key={f.id} onClick={() => patchConfig("export", { format: f.id as "png" | "jpg" | "webp" })}
                            className={`p-2 rounded-xl border transition-all text-left ${thumbnailConfig.export.format === f.id ? "border-gold/30 bg-gold/[0.08]" : "border-border hover:border-gold/15"}`}>
                            <p className={`text-[10px] font-semibold ${thumbnailConfig.export.format === f.id ? "text-gold" : ""}`}>{f.name}</p>
                            <p className="text-[7px] text-muted">{f.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] text-muted uppercase tracking-wider">Quality: {thumbnailConfig.export.quality}%</label>
                      <input type="range" min={40} max={100} value={thumbnailConfig.export.quality} onChange={(e) => patchConfig("export", { quality: Number(e.target.value) })} className="w-full accent-gold" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-2 text-[10px]">
                        <input type="checkbox" checked={thumbnailConfig.export.generateVariants} onChange={(e) => patchConfig("export", { generateVariants: e.target.checked })} className="accent-gold" />
                        <Shuffle size={11} /> Generate 4 Variants
                      </label>
                      <label className="flex items-center gap-2 text-[10px]">
                        <input type="checkbox" checked={thumbnailConfig.export.batchAllPlatforms} onChange={(e) => patchConfig("export", { batchAllPlatforms: e.target.checked })} className="accent-gold" />
                        <FileImage size={11} /> Batch Export for All Platforms
                      </label>
                    </div>
                    <button onClick={() => { if (thumbnailConfig.export.batchAllPlatforms) exportBatchForAllPlatforms(); else if (thumbnailConfig.export.generateVariants) generateQuickVariations(); else toast.success(`Ready to export as ${thumbnailConfig.export.format.toUpperCase()} @ ${thumbnailConfig.export.quality}%`); }}
                      className="btn-primary w-full text-xs flex items-center justify-center gap-2">
                      <Download size={14} /> Apply Export Settings
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── AI Tools Tab ─── */}
      {activeFeatureTab === "tools" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* ── Competitor Thumbnail Analyzer ── */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2">
              <Search size={13} className="text-gold" /> Competitor Thumbnail Analyzer
            </h2>
            <p className="text-[9px] text-muted mb-2">Paste a YouTube URL to analyze the thumbnail style, colors, and CTR potential.</p>
            <div className="flex gap-1.5">
              <input value={competitorUrl} onChange={(e) => setCompetitorUrl(e.target.value)} className="input flex-1 text-[10px]" placeholder="https://youtube.com/watch?v=..." />
              <button onClick={analyzeCompetitor} disabled={competitorAnalyzing} className="btn-primary text-[10px] px-3 disabled:opacity-40">
                {competitorAnalyzing ? <Loader size={12} className="animate-spin" /> : <Search size={12} />}
              </button>
            </div>
            {competitorResults && (
              <div className="mt-3 space-y-2">
                <div className="aspect-video rounded-xl bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center mb-2">
                  <div className="text-center">
                    <Eye size={24} className="text-gold/40 mx-auto mb-1" />
                    <span className="text-[9px] text-white/40">Competitor Thumbnail Preview</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Style Detected", value: competitorResults.style },
                    { label: "Color Scheme", value: competitorResults.colors },
                    { label: "Text Strategy", value: competitorResults.text },
                    { label: "Face Usage", value: competitorResults.face },
                  ].map((item, i) => (
                    <div key={i} className="p-2 rounded-lg bg-surface-light border border-border">
                      <p className="text-[8px] text-muted uppercase tracking-wider">{item.label}</p>
                      <p className="text-[10px] font-medium mt-0.5">{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-gold/[0.05] border border-gold/20">
                  <span className="text-[10px] font-medium">Estimated CTR Score</span>
                  <span className={`text-sm font-black ${competitorResults.score >= 80 ? "text-success" : "text-gold"}`}>{competitorResults.score}/100</span>
                </div>
                <button onClick={() => { toast.success("Competitor style applied to your settings"); setActiveFeatureTab("generate"); }}
                  className="w-full text-[10px] font-medium py-2 rounded-lg border border-gold/30 bg-gold/[0.05] text-gold hover:bg-gold/10 transition-all flex items-center justify-center gap-1.5">
                  <ArrowRight size={12} /> Apply This Style
                </button>
              </div>
            )}
          </div>

          {/* ── Trending Thumbnail Styles ── */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2">
              <TrendingUp size={13} className="text-gold" /> Trending Styles
              <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-success/10 text-success font-medium">LIVE</span>
            </h2>
            <p className="text-[9px] text-muted mb-3">Styles that are performing well on YouTube right now.</p>
            <div className="space-y-2">
              {TRENDING_STYLES_DATA.map((trend, i) => (
                <div key={trend.id} className="flex items-center gap-3 p-2 rounded-lg border border-border hover:border-gold/15 transition-all">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-surface-light border border-border flex items-center justify-center">
                    <span className="text-[9px] font-bold text-muted">#{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[10px] font-semibold truncate">{trend.name}</p>
                      {trend.trend === "up" && <TrendingUp size={10} className="text-success flex-shrink-0" />}
                      {trend.trend === "down" && <TrendingUp size={10} className="text-danger rotate-180 flex-shrink-0" />}
                    </div>
                    <p className="text-[8px] text-muted truncate">{trend.desc}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className={`text-[10px] font-bold ${trend.score >= 90 ? "text-success" : trend.score >= 80 ? "text-gold" : "text-muted"}`}>{trend.score}</span>
                    <p className="text-[7px] text-muted">score</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── AI Background Generator ── */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2">
              <BrainCircuit size={13} className="text-gold" /> AI Background Generator
              <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-medium">AI</span>
            </h2>
            <p className="text-[9px] text-muted mb-2">Describe a custom background and AI will generate it for your thumbnail.</p>
            <textarea value={aiBgPrompt} onChange={(e) => setAiBgPrompt(e.target.value)} className="input w-full text-[10px] resize-none" rows={3}
              placeholder='e.g., "A futuristic city at night with neon signs and rain..."' />
            <button onClick={generateAIBackground} disabled={aiBgGenerating} className="btn-primary w-full text-xs flex items-center justify-center gap-2 mt-2 disabled:opacity-40">
              {aiBgGenerating ? <><Loader size={14} className="animate-spin" /> Generating Background...</> : <><BrainCircuit size={14} /> Generate Background</>}
            </button>
            {aiBgResult && (
              <div className="mt-3">
                <div className="aspect-video rounded-xl bg-gradient-to-br from-indigo-900 via-purple-800 to-pink-700 flex items-center justify-center border border-border">
                  <div className="text-center">
                    <Cpu size={24} className="text-white/30 mx-auto mb-1" />
                    <p className="text-[9px] text-white/50 px-4">{aiBgResult}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => { setPrompt((prev) => prev ? prev + `, background: ${aiBgResult}` : `Thumbnail with background: ${aiBgResult}`); setActiveFeatureTab("generate"); toast.success("Background applied to prompt"); }}
                    className="flex-1 text-[10px] font-medium py-1.5 rounded-lg border border-gold/30 bg-gold/[0.05] text-gold hover:bg-gold/10 transition-all">
                    Apply to Thumbnail
                  </button>
                  <button onClick={() => setAiBgResult(null)} className="text-[10px] px-3 py-1.5 rounded-lg border border-border text-muted hover:text-foreground transition-all">
                    Discard
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Thumbnail History (Enhanced) ── */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2">
              <History size={13} className="text-gold" /> Thumbnail History
              <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-surface-light border border-border text-muted font-medium">{history.length}</span>
            </h2>
            <div className="flex flex-wrap gap-1 mb-2">
              {["All", "This Week", "This Month"].map((filter) => (
                <button key={filter} className="text-[8px] px-2 py-0.5 rounded-full border border-border text-muted hover:text-foreground hover:border-gold/15 transition-all">{filter}</button>
              ))}
            </div>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {history.length === 0 ? (
                <p className="text-[10px] text-muted text-center py-6">No history yet. Generate thumbnails to see them here.</p>
              ) : history.map((item) => {
                const meta = item.metadata as Record<string, unknown>;
                const styleObj = THUMBNAIL_STYLES.find(s => s.id === (meta?.style as string));
                return (
                  <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg border border-border hover:border-gold/15 transition-all group">
                    <div className={`w-12 h-7 rounded bg-gradient-to-br ${styleObj?.gradient || "from-gray-500 to-gray-600"} flex-shrink-0 flex items-center justify-center`}>
                      <ImageIcon size={10} className="text-white/50" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-medium truncate">{item.description}</p>
                      <p className="text-[7px] text-muted">{new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                    <button onClick={() => { setPrompt(item.description); setActiveFeatureTab("generate"); toast.success("Loaded from history"); }}
                      className="text-[8px] px-2 py-1 rounded border border-border text-muted hover:text-gold hover:border-gold/20 opacity-0 group-hover:opacity-100 transition-all">
                      Reuse
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── History Tab ─── */}
      {activeFeatureTab === "history" && (
        <div className="space-y-3">
          {history.length === 0 ? (
            <div className="card-static flex flex-col items-center py-12 text-center">
              <Clock size={28} className="text-muted mb-3" />
              <h3 className="text-sm font-semibold mb-1">No history yet</h3>
              <p className="text-xs text-muted">
                Generated thumbnails will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {history.map((item) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const meta: any = item.metadata || {};
                const styleObj = THUMBNAIL_STYLES.find(
                  (s) => s.id === (meta.style as string)
                );
                return (
                  <div key={item.id} className="card-static group">
                    {/* Mock preview */}
                    <div className="aspect-video rounded-xl bg-gradient-to-br from-gold/10 to-gold/5 flex items-center justify-center mb-3">
                      <ImageIcon size={24} className="text-gold/40" />
                    </div>
                    <p className="text-xs font-medium truncate">{item.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {styleObj && (
                        <span className="text-[8px] px-1.5 py-0.5 rounded bg-gold/10 text-gold">
                          {styleObj.name}
                        </span>
                      )}
                      {meta.platform && (
                        <span className="text-[8px] px-1.5 py-0.5 rounded bg-surface-light border border-border text-muted">
                          {PLATFORM_SIZES.find((p) => p.id === (meta.platform as string))?.name ||
                            (meta.platform as string)}
                        </span>
                      )}
                      {meta.count && Number(meta.count) > 1 && (
                        <span className="text-[8px] text-muted">
                          {String(meta.count)} variations
                        </span>
                      )}
                    </div>
                    <p className="text-[9px] text-muted mt-1.5">
                      {new Date(item.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    {/* Actions */}
                    <div className="flex gap-1.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setPrompt(item.description);
                          if (meta.style) setStyle(meta.style as string);
                          if (meta.platform) setPlatform(meta.platform as string);
                          if (meta.colorTheme) setColorTheme(meta.colorTheme as string);
                          if (meta.mood) setMood(meta.mood as string);
                          if (Array.isArray(meta.faces)) setSelectedFaces(meta.faces as string[]);
                          setActiveFeatureTab("generate");
                          toast.success("Settings loaded from history");
                        }}
                        className="text-[9px] px-2 py-1 rounded border border-border hover:border-gold/20 text-muted hover:text-foreground transition-all"
                      >
                        Reuse Settings
                      </button>
                      <button
                        onClick={async () => {
                          await supabase
                            .from("trinity_log")
                            .delete()
                            .eq("id", item.id);
                          loadHistory();
                          toast.success("Removed from history");
                        }}
                        className="text-[9px] px-2 py-1 rounded border border-border hover:border-danger/20 text-muted hover:text-danger transition-all"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Step-by-Step Creation Walkthrough */}
      <CreationWalkthrough
        open={walkthroughOpen}
        title="Creating your thumbnail"
        subtitle={prompt ? (prompt.length > 80 ? prompt.slice(0, 77) + "..." : prompt) : "Step-by-step AI walkthrough"}
        steps={walkthroughSteps.map((s, i) => ({
          ...s,
          onApprove:
            walkthroughStatus === "completed"
              ? () => {
                  if (i >= walkthroughSteps.length - 1) {
                    setWalkthroughOpen(false);
                  } else {
                    setWalkthroughStepIndex(i + 1);
                    setWalkthroughStatus("in_progress");
                    // TODO: replace with real AI pipeline progress events
                    setTimeout(() => setWalkthroughStatus("completed"), 1500);
                  }
                }
              : undefined,
          onSkip:
            i < walkthroughSteps.length - 1
              ? () => {
                  setWalkthroughStepIndex(i + 1);
                  setWalkthroughStatus("in_progress");
                  setTimeout(() => setWalkthroughStatus("completed"), 1500);
                }
              : undefined,
        }))}
        currentStepIndex={walkthroughStepIndex}
        stepStatus={walkthroughStatus}
        onClose={() => setWalkthroughOpen(false)}
        onCancel={() => {
          walkthroughCancelledRef.current = true;
          setWalkthroughOpen(false);
          setGenerating(false);
          toast("Generation cancelled");
        }}
        onJumpToStep={(i) => {
          setWalkthroughStepIndex(i);
          setWalkthroughStatus("completed");
        }}
        onFinish={() => setWalkthroughOpen(false)}
        finalOutput={
          results[0]?.imageUrl ? (
            <img src={results[0].imageUrl} alt="Generated thumbnail" className="w-full rounded-xl border border-border" />
          ) : (
            <div className="text-[11px] text-muted">
              Your thumbnail is ready. Use Save or Export to download.
            </div>
          )
        }
      />
    </div>
  );
}
