"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { useManagedClient } from "@/lib/use-managed-client";
import {
  Film, Sparkles, Loader, Play, Copy, Download,
  Clock, Camera, Monitor, Zap, Music, Type, Wand2,
  Layers, Mic, Volume2, Palette, LayoutGrid, Eye,
  BookOpen, Scissors, Image as ImageIcon, Upload, X,
  GripVertical, FileText, Paintbrush, Sliders, Ratio,
  SunMedium, MessageSquare, Speech, MonitorPlay,
  Gauge, TextCursorInput, Droplets, BarChart3, ListChecks,
  ImagePlus, Megaphone, Settings2,
  Plus, Minus, Check, AlertCircle, Timer,
  Captions, Wind, ArrowUpDown, Brain, Share2, Crop,
  MousePointer2, Star, Smile, Flame, TrendingUp, Bot,
  VolumeX, Waves, ChevronDown, ChevronRight,
  Loader2,
  Cloud, Briefcase, Heart, Headphones, Guitar, Crown, Disc3,
  Activity,
  type LucideIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import PromptEnhancer from "@/components/prompt-enhancer";
import CreationWalkthrough, { type WalkthroughStep, type WalkthroughStepStatus } from "@/components/creation-walkthrough";
import CreationWizard, { type WizardStep } from "@/components/creation-wizard";
import { useQuotaWall } from "@/components/billing/quota-wall";
import Modal from "@/components/ui/modal";
import PageHero from "@/components/ui/page-hero";
import { Wizard, AdvancedToggle, useAdvancedMode } from "@/components/ui/wizard";
import RollingPreview, { type RollingPreviewItem } from "@/components/RollingPreview";
import { VIDEO_PRESETS, VIDEO_PRESET_CATEGORIES } from "@/lib/presets";
import { ADS_PRESET } from "@/lib/video-presets/ads";
import { getMaxReferenceFile, formatBytes } from "@/lib/plan-config";
import {
  CAPTION_STYLES_LIBRARY,
  EFFECTS_CATALOG,
  SFX_LIBRARY,
  MUSIC_LIBRARY,
  playSfxPlaceholderTone,
  type CaptionBestFor,
  type EffectCategory,
  type SfxCategory,
} from "@/lib/asset-catalog";
import {
  Timeline as VideoTimeline,
  buildProjectFromStoryboard,
  DEFAULT_TRACKS as DEFAULT_TIMELINE_TRACKS,
  type TimelineProject,
  type TimelineClip,
} from "@/components/video-editor/timeline";
import {
  PresetPickerPanel,
  type PresetDropPayload,
} from "@/components/video-editor/preset-picker-panel";
import FootageBadge, { type FootageType } from "@/components/video-editor/footage-badge";

// UI caption-style id → server-accepted id. Server accepts only 6 styles
// (see src/app/api/video/auto-edit/captions/route.ts:36-43). Everything else
// silently falls back to "clean-sans". This map fixes that mismatch when
// the timeline fires POST /auto-edit/captions.
const CAPTION_STYLE_UI_TO_API: Record<string, string> = {
  // Legacy CAPTION_STYLES list → server IDs
  bottom_bar: "subtle-lower-third",
  word_highlight: "kinetic-colour",
  centered_bold: "mrbeast-pop",
  karaoke: "hormozi-bounce",
  typewriter: "vlog-handwritten",
  bounce: "hormozi-bounce",
  gradient_text: "mrbeast-pop",
  neon_glow: "mrbeast-pop",
  handwritten: "vlog-handwritten",
  subtitle_bar: "subtle-lower-third",
  pop_in: "kinetic-colour",
  classic_white: "clean-sans",
  bold_impact: "mrbeast-pop",
  karaoke_gold: "hormozi-bounce",
  subtitle_pro: "subtle-lower-third",
  tiktok_style: "kinetic-colour",
  minimal_gray: "clean-sans",
  // CAPTION_STYLES_LIBRARY ids → server IDs
  "bold-yellow-word": "hormozi-bounce",
  "hormozi-karaoke": "hormozi-bounce",
  "bottom-bar-clean": "subtle-lower-third",
  "centered-bold-outline": "mrbeast-pop",
  "gold-highlight": "hormozi-bounce",
  "word-pop": "kinetic-colour",
  "typewriter-white": "vlog-handwritten",
  "subtitles-2line-bottom": "subtle-lower-third",
  "minimal-white": "clean-sans",
  "film-style": "clean-sans",
};

function resolveCaptionStyleForApi(uiId: string | undefined): string {
  if (!uiId) return "clean-sans";
  return CAPTION_STYLE_UI_TO_API[uiId] || uiId; // already-valid ids pass through
}

// Real ad / brand / product thumbnails served from ytimg.com (public CDN).
// RollingPreview with fetchRemote + tool="video_editor" swaps these for the
// curated library in `preview_content` at runtime; this list is the fallback
// if that table is unreachable.
const YT = (id: string) => `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
const VIDEO_EDITOR_PREVIEW_ITEMS: RollingPreviewItem[] = [
  { id: "ve1", src: YT("pWtH9PbsXYs"), alt: "Shot on iPhone", tag: "Apple" },
  { id: "ve2", src: YT("tQ0yjYUFKAE"), alt: "Dollar Shave Club", tag: "DTC" },
  { id: "ve3", src: YT("I38b8-9syRU"), alt: "Squarespace Super Bowl", tag: "Ad" },
  { id: "ve4", src: YT("hXWIENcHtyQ"), alt: "Volvo Epic Split", tag: "Volvo" },
  { id: "ve5", src: YT("uYPbbksJxIg"), alt: "Oatly Wow No Cow", tag: "Oatly" },
  { id: "ve6", src: YT("ZOCcDbJ5uV4"), alt: "Nike Dream Crazy", tag: "Nike" },
  { id: "ve7", src: YT("JxS5E-kZc2s"), alt: "Dove Real Beauty", tag: "Dove" },
  { id: "ve8", src: YT("u4ZoJKF_VuA"), alt: "Red Bull Gives Wings", tag: "Red Bull" },
  { id: "ve9", src: YT("L_LUpnjgPso"), alt: "Airbnb Belong Anywhere", tag: "Airbnb" },
  { id: "ve10", src: YT("Q7P7oMRyq-o"), alt: "Rolex Pioneer", tag: "Luxury" },
  { id: "ve11", src: YT("KqffpTQVAqY"), alt: "BMW The 8", tag: "Auto" },
  { id: "ve12", src: YT("PnzVhqbzyMw"), alt: "Tesla Cybertruck", tag: "Tesla" },
];

/* ──────────────────── AI API TYPES ──────────────────── */

interface AiGeneratedScene {
  time?: string;
  title?: string;
  description?: string;
  duration?: number;
}

interface AiGeneratedCaption {
  text: string;
  start?: number;
  end?: number;
  emphasis?: boolean;
}

interface AiGeneratedShot {
  scene?: string;
  shot?: string;
  camera?: string;
  duration?: number;
  broll?: string[];
}

interface AiProjectData {
  project_id?: string;
  script?: string;
  hook?: string;
  scenes?: AiGeneratedScene[];
  captions?: AiGeneratedCaption[];
  shotlist?: AiGeneratedShot[];
  editor_settings?: Record<string, unknown>;
  cta?: string;
  captions_keywords?: string[];
  total_duration?: number;
}

const VIDEO_TYPES = [
  { id: "reel", name: "Reel / TikTok", aspect: "9:16", duration: 30, icon: <Camera size={14} />, desc: "Vertical short-form" },
  { id: "youtube", name: "YouTube Video", aspect: "16:9", duration: 60, icon: <Monitor size={14} />, desc: "Horizontal long-form" },
  { id: "youtube_short", name: "YouTube Short", aspect: "9:16", duration: 60, icon: <Film size={14} />, desc: "Vertical YouTube format" },
  { id: "ad", name: "Ad Creative", aspect: "1:1", duration: 15, icon: <Zap size={14} />, desc: "Square ad format" },
  { id: "story", name: "Story", aspect: "9:16", duration: 15, icon: <Film size={14} />, desc: "Full-screen ephemeral" },
  { id: "explainer", name: "Explainer", aspect: "16:9", duration: 90, icon: <BookOpen size={14} />, desc: "Educational walkthrough" },
  { id: "testimonial", name: "Testimonial", aspect: "1:1", duration: 30, icon: <Mic size={14} />, desc: "Client success story" },
  { id: "product_demo", name: "Product Demo", aspect: "16:9", duration: 45, icon: <Eye size={14} />, desc: "Feature showcase" },
  { id: "carousel_video", name: "Carousel Video", aspect: "1:1", duration: 60, icon: <Layers size={14} />, desc: "Multi-slide video" },
  { id: "podcast_clip", name: "Podcast Clip", aspect: "1:1", duration: 60, icon: <Mic size={14} />, desc: "Audio waveform + captions" },
  { id: "before_after", name: "Before / After", aspect: "9:16", duration: 20, icon: <Scissors size={14} />, desc: "Side-by-side comparison" },
  { id: "countdown", name: "Countdown/Reveal", aspect: "9:16", duration: 15, icon: <Clock size={14} />, desc: "Suspense + reveal" },
  { id: "tutorial", name: "Tutorial/How-To", aspect: "16:9", duration: 120, icon: <BookOpen size={14} />, desc: "Step-by-step guide" },
  { id: "vlog", name: "Vlog Style", aspect: "16:9", duration: 180, icon: <Camera size={14} />, desc: "Personal/behind scenes" },
  { id: "promo", name: "Promo Video", aspect: "16:9", duration: 30, icon: <Zap size={14} />, desc: "High-energy promotion" },
  { id: "slideshow", name: "Photo Slideshow", aspect: "1:1", duration: 30, icon: <Layers size={14} />, desc: "Image + music sequence" },
  { id: "lyric_video", name: "Lyric/Quote Video", aspect: "9:16", duration: 30, icon: <Wand2 size={14} />, desc: "Animated text + bg" },
  { id: "reaction", name: "Reaction Video", aspect: "9:16", duration: 30, icon: <Eye size={14} />, desc: "Split screen react" },
];

const STYLES = [
  { id: "modern-dark", name: "Modern Dark", desc: "Dark bg, neon accents, clean" },
  { id: "clean-white", name: "Clean White", desc: "Light, airy, professional" },
  { id: "bold-gradient", name: "Bold Gradient", desc: "Vibrant color transitions" },
  { id: "neon", name: "Neon Glow", desc: "Dark with neon highlights" },
  { id: "minimal", name: "Minimal", desc: "Less is more, whitespace" },
  { id: "corporate", name: "Corporate", desc: "Professional, trust-focused" },
  { id: "retro", name: "Retro / Y2K", desc: "Nostalgic, colorful, playful" },
  { id: "cinematic", name: "Cinematic", desc: "Film grain, moody lighting" },
  { id: "glassmorphism", name: "Glassmorphism", desc: "Frosted glass, blur effects" },
  { id: "brutalist", name: "Brutalist", desc: "Raw, bold typography" },
  { id: "3d-depth", name: "3D Depth", desc: "Parallax, layered depth" },
  { id: "anime", name: "Anime / Manga", desc: "Japanese animation style" },
  { id: "vaporwave", name: "Vaporwave", desc: "Purple/pink retro aesthetic" },
  { id: "luxury", name: "Luxury / Gold", desc: "Dark + gold, premium feel" },
  { id: "organic", name: "Organic / Nature", desc: "Earth tones, natural feel" },
  { id: "glitch", name: "Glitch Art", desc: "Digital distortion effects" },
  { id: "pop-art", name: "Pop Art", desc: "Bold colors, comic style" },
  { id: "watercolor", name: "Watercolor", desc: "Soft painted aesthetic" },
  { id: "newspaper", name: "Newspaper / Editorial", desc: "Print media look" },
  { id: "cyberpunk", name: "Cyberpunk", desc: "Futuristic neon dystopia" },
];

// Music moods — each gets a lucide icon + a color tint so the grid feels
// like a designed product instead of an emoji picker. Tints are tailwind
// arbitrary-value classes so every tile can have its own hue without a
// full theme extension.
interface MoodOption {
  id: string;
  name: string;
  icon: LucideIcon;
  tint: string; // tailwind class for icon color when inactive
  bg: string;   // tailwind class for icon tile background tint
}
const MUSIC_MOODS: MoodOption[] = [
  { id: "upbeat",       name: "Upbeat",          icon: Zap,        tint: "text-amber-300",  bg: "bg-amber-500/15" },
  { id: "motivational", name: "Motivational",    icon: Flame,      tint: "text-orange-300", bg: "bg-orange-500/15" },
  { id: "chill",        name: "Chill",           icon: Cloud,      tint: "text-sky-300",    bg: "bg-sky-500/15" },
  { id: "dramatic",     name: "Dramatic",        icon: Film,       tint: "text-violet-300", bg: "bg-violet-500/15" },
  { id: "corporate",    name: "Corporate",       icon: Briefcase,  tint: "text-slate-300",  bg: "bg-slate-500/15" },
  { id: "trendy",       name: "Trendy/Pop",      icon: Sparkles,   tint: "text-pink-300",   bg: "bg-pink-500/15" },
  { id: "emotional",    name: "Emotional",       icon: Heart,      tint: "text-rose-300",   bg: "bg-rose-500/15" },
  { id: "lofi",         name: "Lo-Fi",           icon: Headphones, tint: "text-indigo-300", bg: "bg-indigo-500/15" },
  { id: "cinematic",    name: "Cinematic",       icon: Camera,     tint: "text-teal-300",   bg: "bg-teal-500/15" },
  { id: "edm",          name: "EDM/Electronic",  icon: Activity,   tint: "text-cyan-300",   bg: "bg-cyan-500/15" },
  { id: "hip-hop",      name: "Hip-Hop",         icon: Mic,        tint: "text-purple-300", bg: "bg-purple-500/15" },
  { id: "acoustic",     name: "Acoustic",        icon: Guitar,     tint: "text-amber-400",  bg: "bg-amber-600/15" },
  { id: "jazz",         name: "Jazz",            icon: Music,      tint: "text-blue-300",   bg: "bg-blue-500/15" },
  { id: "ambient",      name: "Ambient",         icon: Waves,      tint: "text-emerald-300",bg: "bg-emerald-500/15" },
  { id: "epic",         name: "Epic/Orchestral", icon: Crown,      tint: "text-yellow-300", bg: "bg-yellow-500/15" },
  { id: "funk",         name: "Funk/Groove",     icon: Disc3,      tint: "text-fuchsia-300",bg: "bg-fuchsia-500/15" },
  { id: "none",         name: "No Music",        icon: VolumeX,    tint: "text-muted",      bg: "bg-surface-light" },
];

const CAPTION_STYLES = [
  { id: "none", name: "No Captions" },
  { id: "bottom_bar", name: "Bottom Bar" },
  { id: "word_highlight", name: "Word-by-Word Highlight" },
  { id: "centered_bold", name: "Centered Bold" },
  { id: "karaoke", name: "Karaoke Style" },
  { id: "typewriter", name: "Typewriter Effect" },
  { id: "bounce", name: "Bounce Animation" },
  { id: "gradient_text", name: "Gradient Text" },
  { id: "neon_glow", name: "Neon Glow Text" },
  { id: "handwritten", name: "Handwritten Style" },
  { id: "subtitle_bar", name: "Subtitle Bar (Netflix)" },
  { id: "pop_in", name: "Pop-In Words" },
  { id: "classic_white", name: "Classic White" },
  { id: "bold_impact", name: "Bold Impact" },
  { id: "karaoke_gold", name: "Karaoke Gold" },
  { id: "subtitle_pro", name: "Subtitle Pro" },
  { id: "tiktok_style", name: "TikTok Style" },
  { id: "minimal_gray", name: "Minimal" },
];

const MOTION_GRAPHICS = [
  { id: "lower_third_simple", name: "Simple Lower Third", category: "lower-thirds", desc: "Clean name + title bar" },
  { id: "lower_third_animated", name: "Animated Lower Third", category: "lower-thirds", desc: "Slide-in with accent line" },
  { id: "lower_third_social", name: "Social Handle Bar", category: "lower-thirds", desc: "@ handle with icon" },
  { id: "transition_swipe", name: "Swipe Transition", category: "transitions", desc: "Directional swipe wipe" },
  { id: "transition_zoom", name: "Zoom Blur", category: "transitions", desc: "Zoom into next scene" },
  { id: "transition_glitch", name: "Glitch Cut", category: "transitions", desc: "Digital glitch effect" },
  { id: "transition_fade", name: "Cross Fade", category: "transitions", desc: "Smooth opacity blend" },
  { id: "transition_morph", name: "Shape Morph", category: "transitions", desc: "Geometric morph wipe" },
  { id: "intro_logo_reveal", name: "Logo Reveal", category: "intros", desc: "Particle logo animation" },
  { id: "intro_text_stack", name: "Text Stack Intro", category: "intros", desc: "Stacked words animate in" },
  { id: "intro_countdown", name: "Countdown Intro", category: "intros", desc: "3-2-1 with motion" },
  { id: "outro_subscribe", name: "Subscribe CTA", category: "outros", desc: "Like + Subscribe prompt" },
  { id: "outro_endscreen", name: "End Screen", category: "outros", desc: "Multi-video end cards" },
  { id: "outro_social_links", name: "Social Links", category: "outros", desc: "All social handles" },
];

const COLOR_PRESETS = [
  { id: "warm_sunset", name: "Warm Sunset", colors: ["#FF6B35", "#F7C59F", "#EFEFD0"], desc: "Golden hour warmth" },
  { id: "cool_ocean", name: "Cool Ocean", colors: ["#1B4965", "#5FA8D3", "#BEE9E8"], desc: "Blue aquatic tones" },
  { id: "vintage_film", name: "Vintage Film", colors: ["#8B7355", "#C4A882", "#E8DCC8"], desc: "Faded retro look" },
  { id: "cyberpunk_neon", name: "Cyberpunk Neon", colors: ["#FF00FF", "#00FFFF", "#0D0221"], desc: "Electric neon glow" },
  { id: "forest_green", name: "Forest Green", colors: ["#2D6A4F", "#52B788", "#D8F3DC"], desc: "Natural earth tones" },
  { id: "moody_noir", name: "Moody Noir", colors: ["#1a1a2e", "#16213e", "#e94560"], desc: "Dark cinematic mood" },
  { id: "pastel_dream", name: "Pastel Dream", colors: ["#FFB5E8", "#B5DEFF", "#E7FFAC"], desc: "Soft pastel palette" },
  { id: "high_contrast", name: "High Contrast", colors: ["#000000", "#FFFFFF", "#FFD700"], desc: "Bold B&W + accent" },
  { id: "desert_sand", name: "Desert Sand", colors: ["#C2956A", "#E8D5B7", "#F5EBE0"], desc: "Warm sandy tones" },
  { id: "arctic_frost", name: "Arctic Frost", colors: ["#CAF0F8", "#90E0EF", "#023E8A"], desc: "Icy blue palette" },
];

const TEXT_ANIMATIONS = [
  { id: "fade_in", name: "Fade In" }, { id: "slide_up", name: "Slide Up" },
  { id: "slide_left", name: "Slide Left" }, { id: "slide_right", name: "Slide Right" },
  { id: "zoom_in", name: "Zoom In" }, { id: "zoom_out", name: "Zoom Out" },
  { id: "typewriter", name: "Typewriter" }, { id: "bounce_in", name: "Bounce In" },
  { id: "flip_in", name: "Flip In" }, { id: "rotate_in", name: "Rotate In" },
  { id: "blur_in", name: "Blur In" }, { id: "glitch_in", name: "Glitch In" },
  { id: "wave", name: "Wave" }, { id: "letter_by_letter", name: "Letter by Letter" },
  { id: "scale_bounce", name: "Scale Bounce" }, { id: "neon_flicker", name: "Neon Flicker" },
];

const EFFECT_PRESETS = [
  { id: "zoom_pulse", name: "Zoom Pulse", category: "motion", desc: "Gentle zoom in/out on beat" },
  { id: "film_grain", name: "Film Grain", category: "overlay", desc: "Vintage film grain overlay" },
  { id: "vhs_retro", name: "VHS Retro", category: "overlay", desc: "VHS tracking lines + color bleed" },
  { id: "cinematic_bars", name: "Cinematic Bars", category: "overlay", desc: "Letterbox bars top/bottom" },
  { id: "light_leak", name: "Light Leak", category: "overlay", desc: "Warm orange light leak overlay" },
  { id: "glitch", name: "Glitch", category: "overlay", desc: "Random glitch/distortion" },
  { id: "blur_transition", name: "Blur Transition", category: "transitions", desc: "Gaussian blur between scenes" },
  { id: "color_pop", name: "Color Pop", category: "color", desc: "Desaturate except primary color" },
];

const FONT_PRESETS = [
  { id: "montserrat_bold", name: "Montserrat Bold", family: "Montserrat", weight: "700", category: "sans-serif" },
  { id: "oswald", name: "Oswald", family: "Oswald", weight: "600", category: "sans-serif" },
  { id: "bebas_neue", name: "Bebas Neue", family: "Bebas Neue", weight: "400", category: "display" },
  { id: "poppins", name: "Poppins", family: "Poppins", weight: "500", category: "sans-serif" },
  { id: "playfair_display", name: "Playfair Display", family: "Playfair Display", weight: "700", category: "serif" },
  { id: "roboto_condensed", name: "Roboto Condensed", family: "Roboto Condensed", weight: "500", category: "sans-serif" },
  { id: "anton", name: "Anton", family: "Anton", weight: "400", category: "display" },
  { id: "lato", name: "Lato", family: "Lato", weight: "400", category: "sans-serif" },
  { id: "raleway", name: "Raleway", family: "Raleway", weight: "500", category: "sans-serif" },
  { id: "permanent_marker", name: "Permanent Marker", family: "Permanent Marker", weight: "400", category: "handwriting" },
  { id: "fredoka_one", name: "Fredoka One", family: "Fredoka One", weight: "400", category: "display" },
  { id: "source_sans_pro", name: "Source Sans Pro", family: "Source Sans Pro", weight: "400", category: "sans-serif" },
];

const GREEN_SCREEN_BG = [
  { id: "office_modern", name: "Modern Office", desc: "Clean workspace" },
  { id: "office_cozy", name: "Cozy Office", desc: "Bookshelf + plants" },
  { id: "gradient_purple", name: "Purple Gradient", desc: "Smooth gradient bg" },
  { id: "gradient_blue", name: "Blue Gradient", desc: "Cool blue wash" },
  { id: "city_skyline", name: "City Skyline", desc: "Urban backdrop" },
  { id: "abstract_shapes", name: "Abstract Shapes", desc: "Geometric motion" },
  { id: "nature_blur", name: "Nature Bokeh", desc: "Blurred greenery" },
  { id: "studio_dark", name: "Dark Studio", desc: "Pro studio lighting" },
  { id: "studio_white", name: "White Studio", desc: "Clean white cyclorama" },
  { id: "custom_color", name: "Solid Color", desc: "Pick any color" },
];

const VOICEOVER_VOICES = [
  { id: "alloy", name: "Alloy", gender: "Neutral", desc: "Warm and balanced" },
  { id: "echo", name: "Echo", gender: "Male", desc: "Deep and confident" },
  { id: "fable", name: "Fable", gender: "Male", desc: "British storyteller" },
  { id: "onyx", name: "Onyx", gender: "Male", desc: "Bold and authoritative" },
  { id: "nova", name: "Nova", gender: "Female", desc: "Friendly and energetic" },
  { id: "shimmer", name: "Shimmer", gender: "Female", desc: "Soft and professional" },
];

const EXPANDED_TEMPLATES = [
  { id: "t01", name: "Product Launch Hype", category: "marketing", thumb: "gradient", aspect: "9:16", duration: 30 },
  { id: "t02", name: "Customer Testimonial", category: "social-proof", thumb: "warm", aspect: "1:1", duration: 45 },
  { id: "t03", name: "Before & After Reveal", category: "transformation", thumb: "split", aspect: "9:16", duration: 20 },
  { id: "t04", name: "5 Tips Listicle", category: "educational", thumb: "clean", aspect: "9:16", duration: 60 },
  { id: "t05", name: "Team Introduction", category: "brand", thumb: "corporate", aspect: "16:9", duration: 45 },
  { id: "t06", name: "Flash Sale Countdown", category: "marketing", thumb: "bold", aspect: "9:16", duration: 15 },
  { id: "t07", name: "Podcast Audiogram", category: "content", thumb: "wave", aspect: "1:1", duration: 60 },
  { id: "t08", name: "Event Promo", category: "marketing", thumb: "neon", aspect: "16:9", duration: 30 },
  { id: "t09", name: "Quote of the Day", category: "content", thumb: "minimal", aspect: "1:1", duration: 10 },
  { id: "t10", name: "How-To Tutorial", category: "educational", thumb: "step", aspect: "16:9", duration: 120 },
  { id: "t11", name: "App Demo Walkthrough", category: "product", thumb: "screen", aspect: "9:16", duration: 45 },
  { id: "t12", name: "Recipe Video", category: "content", thumb: "food", aspect: "9:16", duration: 60 },
  { id: "t13", name: "Real Estate Tour", category: "industry", thumb: "luxury", aspect: "16:9", duration: 60 },
  { id: "t14", name: "Fitness Workout", category: "content", thumb: "energy", aspect: "9:16", duration: 30 },
  { id: "t15", name: "Year in Review", category: "brand", thumb: "collage", aspect: "16:9", duration: 60 },
  { id: "t16", name: "FAQ Carousel", category: "educational", thumb: "qa", aspect: "1:1", duration: 45 },
  { id: "t17", name: "Behind the Scenes", category: "brand", thumb: "candid", aspect: "9:16", duration: 30 },
  { id: "t18", name: "Hiring / Job Post", category: "brand", thumb: "career", aspect: "1:1", duration: 20 },
  { id: "t19", name: "Countdown Reveal", category: "marketing", thumb: "suspense", aspect: "9:16", duration: 15 },
  { id: "t20", name: "Client Case Study", category: "social-proof", thumb: "data", aspect: "16:9", duration: 90 },
  { id: "t21", name: "Unboxing", category: "product", thumb: "box", aspect: "9:16", duration: 45 },
  { id: "t22", name: "Side-by-Side Compare", category: "product", thumb: "versus", aspect: "9:16", duration: 20 },
  { id: "t23", name: "Announcement Banner", category: "marketing", thumb: "alert", aspect: "16:9", duration: 10 },
  { id: "t24", name: "Thank You / Gratitude", category: "brand", thumb: "warm", aspect: "1:1", duration: 15 },
  { id: "t25", name: "Trending Audio Remix", category: "content", thumb: "trend", aspect: "9:16", duration: 15 },
  { id: "t26", name: "Story Poll / Quiz", category: "engagement", thumb: "interactive", aspect: "9:16", duration: 15 },
  { id: "t27", name: "Myth vs Fact", category: "educational", thumb: "debate", aspect: "9:16", duration: 30 },
  { id: "t28", name: "Weekend Vlog Recap", category: "content", thumb: "vlog", aspect: "16:9", duration: 120 },
  { id: "t29", name: "Giveaway Announcement", category: "engagement", thumb: "prize", aspect: "1:1", duration: 20 },
  { id: "t30", name: "Holiday Greeting", category: "brand", thumb: "festive", aspect: "9:16", duration: 15 },
  { id: "t31", name: "Webinar Teaser", category: "marketing", thumb: "webinar", aspect: "16:9", duration: 30 },
  { id: "t32", name: "Data / Stats Infographic", category: "educational", thumb: "chart", aspect: "1:1", duration: 30 },
];

/* ─── NEW: Advanced Preset Libraries ──────────────────────────── */

const ADVANCED_CAPTION_PRESETS = [
  { id: "tiktok_bold", name: "TikTok Bold", desc: "Thick yellow stroke, centered", bg: "#000", color: "#FFD700", stroke: "#000", weight: 900, size: 72, position: "bottom" },
  { id: "youtube_standard", name: "YouTube Standard", desc: "White on dark box", bg: "rgba(0,0,0,0.75)", color: "#fff", stroke: "transparent", weight: 500, size: 28, position: "bottom" },
  { id: "podcast_minimal", name: "Podcast Minimal", desc: "Clean sans, no backdrop", bg: "transparent", color: "#fff", stroke: "transparent", weight: 400, size: 24, position: "bottom" },
  { id: "mrbeast", name: "MrBeast Style", desc: "Huge yellow, word highlight", bg: "transparent", color: "#FFEB3B", stroke: "#000", weight: 900, size: 96, position: "center" },
  { id: "karaoke", name: "Karaoke", desc: "Word-by-word color fill", bg: "transparent", color: "#fff", stroke: "#C9A84C", weight: 700, size: 48, position: "bottom" },
  { id: "typewriter", name: "Typewriter", desc: "Letter-by-letter reveal", bg: "rgba(0,0,0,0.6)", color: "#00ff00", stroke: "transparent", weight: 400, size: 28, position: "bottom" },
  { id: "popup", name: "Pop-up", desc: "Fade + scale words", bg: "transparent", color: "#fff", stroke: "#000", weight: 800, size: 56, position: "center" },
  { id: "cinematic", name: "Cinematic", desc: "Italic lower-third", bg: "transparent", color: "#f5f5f5", stroke: "transparent", weight: 300, size: 22, position: "bottom" },
  { id: "meme_impact", name: "Meme Impact", desc: "Impact, uppercase, stroke", bg: "transparent", color: "#fff", stroke: "#000", weight: 900, size: 64, position: "top" },
  { id: "reel_trendy", name: "Reel Trendy", desc: "Bouncy colorful pop", bg: "transparent", color: "#FF3BFF", stroke: "#fff", weight: 800, size: 56, position: "center" },
];

const CAPTION_FONT_FAMILIES = [
  "Inter", "Poppins", "Montserrat", "Roboto", "Bebas Neue",
  "Oswald", "Anton", "Impact", "Playfair Display", "Lato",
  "Open Sans", "Raleway", "Merriweather",
];

const TEXT_ANIMATION_PRESETS = [
  { id: "none", name: "None", desc: "No animation" },
  { id: "fade_in", name: "Fade In", desc: "Opacity 0 → 1" },
  { id: "fade_out", name: "Fade Out", desc: "Opacity 1 → 0" },
  { id: "slide_left", name: "Slide Left", desc: "Enter from left" },
  { id: "slide_right", name: "Slide Right", desc: "Enter from right" },
  { id: "slide_top", name: "Slide Top", desc: "Enter from top" },
  { id: "slide_bottom", name: "Slide Bottom", desc: "Enter from bottom" },
  { id: "scale_up", name: "Scale Up", desc: "Grow from small" },
  { id: "scale_down", name: "Scale Down", desc: "Shrink from large" },
  { id: "pop", name: "Pop", desc: "Quick pop entrance" },
  { id: "typewriter", name: "Typewriter", desc: "Letter by letter" },
  { id: "word_cascade", name: "Word Cascade", desc: "Each word staggered" },
  { id: "blur_to_clear", name: "Blur to Clear", desc: "Blur 20 → 0" },
  { id: "wave", name: "Wave", desc: "Undulating motion" },
  { id: "bounce", name: "Bounce", desc: "Spring bounce in" },
  { id: "shake", name: "Shake", desc: "Wiggle effect" },
  { id: "glitch", name: "Glitch", desc: "Digital glitch enter" },
  { id: "flip", name: "Flip", desc: "3D flip entrance" },
];

const ANIMATION_EASINGS = [
  "linear", "ease-in", "ease-out", "ease-in-out", "bounce", "spring",
];

const MOTION_PRESETS = [
  { id: "slow_zoom_in", name: "Slow Zoom In (Ken Burns)", desc: "Gentle zoom in over time" },
  { id: "slow_zoom_out", name: "Slow Zoom Out", desc: "Gentle zoom out over time" },
  { id: "punch_zoom", name: "Punch Zoom", desc: "Rapid zoom at a key moment" },
  { id: "pan_left", name: "Pan Left", desc: "Smooth pan left" },
  { id: "pan_right", name: "Pan Right", desc: "Smooth pan right" },
  { id: "pan_up", name: "Pan Up", desc: "Smooth pan up" },
  { id: "pan_down", name: "Pan Down", desc: "Smooth pan down" },
  { id: "orbit", name: "Orbit", desc: "Orbit around subject" },
  { id: "dolly", name: "Dolly", desc: "Linear dolly move" },
  { id: "crash_zoom", name: "Crash Zoom", desc: "Fast snappy zoom" },
  { id: "breathing", name: "Subtle Breathing", desc: "Gentle scale pulse" },
];

const TRANSITION_PRESETS = [
  { id: "cut", name: "Cut", category: "basic", color: "#aaa" },
  { id: "fade", name: "Fade", category: "basic", color: "#777" },
  { id: "dissolve", name: "Dissolve", category: "basic", color: "#888" },
  { id: "wipe_left", name: "Wipe Left", category: "wipe", color: "#e91e63" },
  { id: "wipe_right", name: "Wipe Right", category: "wipe", color: "#e91e63" },
  { id: "wipe_up", name: "Wipe Up", category: "wipe", color: "#e91e63" },
  { id: "wipe_down", name: "Wipe Down", category: "wipe", color: "#e91e63" },
  { id: "zoom_in", name: "Zoom In", category: "zoom", color: "#2196f3" },
  { id: "zoom_out", name: "Zoom Out", category: "zoom", color: "#2196f3" },
  { id: "spin", name: "Spin", category: "motion", color: "#9c27b0" },
  { id: "flash", name: "Flash", category: "fx", color: "#fff" },
  { id: "blur", name: "Blur", category: "fx", color: "#64b5f6" },
  { id: "slide_left", name: "Slide Left", category: "slide", color: "#4caf50" },
  { id: "slide_right", name: "Slide Right", category: "slide", color: "#4caf50" },
  { id: "slide_up", name: "Slide Up", category: "slide", color: "#4caf50" },
  { id: "slide_down", name: "Slide Down", category: "slide", color: "#4caf50" },
  { id: "whip_left", name: "Whip Pan Left", category: "motion", color: "#ff9800" },
  { id: "whip_right", name: "Whip Pan Right", category: "motion", color: "#ff9800" },
  { id: "iris_in", name: "Iris In", category: "wipe", color: "#e91e63" },
  { id: "iris_out", name: "Iris Out", category: "wipe", color: "#e91e63" },
  { id: "clock_wipe", name: "Clock Wipe", category: "wipe", color: "#e91e63" },
  { id: "cross_zoom", name: "Cross-Zoom", category: "zoom", color: "#2196f3" },
  { id: "morph", name: "Morph", category: "fx", color: "#00bcd4" },
  { id: "glitch", name: "Glitch", category: "fx", color: "#f44336" },
  { id: "rgb_split", name: "RGB Split", category: "fx", color: "#ff00ff" },
];

const COLOR_LUT_PRESETS = [
  { id: "cinematic", name: "Cinematic", desc: "Film-like contrast", preview: "linear-gradient(135deg, #1a2a3a, #2a1a0a)" },
  { id: "film_look", name: "Film Look", desc: "35mm film emulation", preview: "linear-gradient(135deg, #3a2f1a, #5a4f2a)" },
  { id: "vibrant", name: "Vibrant", desc: "Boost saturation", preview: "linear-gradient(135deg, #ff6b00, #ff00aa)" },
  { id: "muted", name: "Muted", desc: "Desaturated tones", preview: "linear-gradient(135deg, #6a6a6a, #8a8a8a)" },
  { id: "vintage", name: "Vintage", desc: "Faded retro look", preview: "linear-gradient(135deg, #b89068, #d4a574)" },
  { id: "moody", name: "Moody", desc: "Dark cinematic", preview: "linear-gradient(135deg, #1a0a2a, #2a1a3a)" },
  { id: "warm", name: "Warm", desc: "Golden hour tones", preview: "linear-gradient(135deg, #ff9500, #ffcc00)" },
  { id: "cool", name: "Cool", desc: "Blue-biased", preview: "linear-gradient(135deg, #0066cc, #00aaff)" },
  { id: "bw", name: "B&W", desc: "Black and white", preview: "linear-gradient(135deg, #000, #fff)" },
  { id: "sepia", name: "Sepia", desc: "Classic sepia wash", preview: "linear-gradient(135deg, #704214, #c8985a)" },
  { id: "teal_orange", name: "Teal & Orange", desc: "Blockbuster grade", preview: "linear-gradient(135deg, #008080, #ff8c00)" },
  { id: "pastel", name: "Pastel", desc: "Soft pastel hues", preview: "linear-gradient(135deg, #ffb3ba, #bae1ff)" },
  { id: "high_contrast", name: "High Contrast", desc: "Punchy blacks and whites", preview: "linear-gradient(135deg, #000, #fff 50%, #000)" },
  { id: "log_rec709", name: "Log-to-Rec709", desc: "Log footage conversion", preview: "linear-gradient(135deg, #4a4a4a, #8a8a8a)" },
];

const MUSIC_GENRE_PRESETS = [
  { id: "upbeat", name: "Upbeat", desc: "High-energy modern" },
  { id: "chill", name: "Chill", desc: "Relaxed ambient vibes" },
  { id: "cinematic", name: "Cinematic", desc: "Epic orchestral" },
  { id: "hip_hop", name: "Hip Hop", desc: "Beats & bass" },
  { id: "edm", name: "EDM", desc: "Electronic dance" },
  { id: "lofi", name: "Lo-fi", desc: "Chill study beats" },
  { id: "corporate", name: "Corporate", desc: "Clean professional" },
  { id: "emotional", name: "Emotional", desc: "Heartfelt piano" },
  { id: "trailer", name: "Trailer", desc: "Dramatic build" },
  { id: "piano", name: "Piano", desc: "Solo piano" },
  { id: "ambient", name: "Ambient", desc: "Atmospheric textures" },
];

const OVERLAY_STICKER_PRESETS = [
  { id: "progress_top", name: "Progress Bar (Top)", desc: "Top progress indicator" },
  { id: "progress_bottom", name: "Progress Bar (Bottom)", desc: "Bottom progress indicator" },
  { id: "subscribe_btn", name: "Subscribe Button", desc: "Animated subscribe CTA" },
  { id: "follow_cta", name: "Follow CTA", desc: "Follow button prompt" },
  { id: "wait_for_it", name: "Wait For It...", desc: "Suspense label" },
  { id: "countdown", name: "Countdown", desc: "3-2-1 timer overlay" },
  { id: "arrow_pointer", name: "Arrow Pointer", desc: "Directional arrow" },
  { id: "emoji_reaction", name: "Emoji Reaction", desc: "Reaction sticker burst" },
  { id: "sound_wave", name: "Sound Wave Visualizer", desc: "Audio waveform" },
];

const PLATFORM_EXPORT_PRESETS = [
  { id: "tiktok", name: "TikTok", aspect: "9:16", maxDur: 60, captions: true, desc: "Vertical 9:16, max 60s, baked captions" },
  { id: "reels", name: "Instagram Reels", aspect: "9:16", maxDur: 90, captions: true, desc: "Vertical 9:16, max 90s" },
  { id: "shorts", name: "YouTube Shorts", aspect: "9:16", maxDur: 60, captions: true, desc: "Vertical 9:16, max 60s" },
  { id: "yt_long", name: "YouTube Long-form", aspect: "16:9", maxDur: 600, captions: false, desc: "16:9 4K, up to 10 min" },
  { id: "linkedin", name: "LinkedIn", aspect: "1:1", maxDur: 600, captions: true, desc: "Square or 16:9, 10 min" },
  { id: "twitter", name: "Twitter / X", aspect: "16:9", maxDur: 140, captions: true, desc: "16:9, max 2:20" },
  { id: "facebook", name: "Facebook", aspect: "1:1", maxDur: 240, captions: true, desc: "1:1 square, max 4 min" },
  { id: "vimeo", name: "Vimeo", aspect: "16:9", maxDur: 1800, captions: true, desc: "16:9 high quality, up to 30 min" },
  { id: "twitch_clip", name: "Twitch Clip", aspect: "16:9", maxDur: 60, captions: false, desc: "16:9, clipped 60s moments" },
  { id: "podcast_audio", name: "Podcast Audio-only", aspect: "1:1", maxDur: 7200, captions: false, desc: "Audio wave w/ thumbnail, up to 2h" },
  { id: "snapchat", name: "Snapchat", aspect: "9:16", maxDur: 60, captions: true, desc: "Vertical 9:16, max 60s" },
];

/* ─── Effects Library (50+ VFX presets, 5 categories) ─── */
const EFFECTS_LIBRARY: Array<{ id: string; name: string; category: string; preview: string; desc: string }> = [
  // Light & Glow
  { id: "lens_flare", name: "Lens Flare", category: "Light & Glow", preview: "bg-gradient-to-br from-yellow-300 via-orange-400 to-transparent", desc: "Anamorphic horizontal streak" },
  { id: "god_rays", name: "God Rays", category: "Light & Glow", preview: "bg-gradient-to-b from-yellow-100 via-amber-300 to-transparent", desc: "Volumetric light shafts" },
  { id: "light_leak", name: "Light Leak", category: "Light & Glow", preview: "bg-gradient-to-tr from-pink-300 via-orange-300 to-yellow-200", desc: "Retro film light bleed" },
  { id: "glow_edges", name: "Glow Edges", category: "Light & Glow", preview: "bg-[radial-gradient(circle,rgba(255,255,255,0.8)_0%,rgba(0,0,0,0.9)_100%)]", desc: "Luminous edge halo" },
  { id: "rim_light", name: "Rim Light", category: "Light & Glow", preview: "bg-gradient-to-r from-amber-400 via-black to-amber-400", desc: "Subject rim lighting" },
  { id: "spotlight_vignette", name: "Spotlight Vignette", category: "Light & Glow", preview: "bg-[radial-gradient(circle,rgba(255,220,150,0.8)_0%,rgba(0,0,0,1)_80%)]", desc: "Soft spotlight falloff" },
  { id: "radial_blur", name: "Radial Blur", category: "Light & Glow", preview: "bg-[conic-gradient(from_0deg,white,gray,white,gray)]", desc: "Center-radiating blur" },
  { id: "bloom", name: "Bloom", category: "Light & Glow", preview: "bg-gradient-to-br from-white via-yellow-200 to-orange-200", desc: "Soft highlight bloom" },
  { id: "fog", name: "Fog", category: "Light & Glow", preview: "bg-gradient-to-b from-gray-200 via-white to-gray-300", desc: "Atmospheric haze layer" },
  { id: "dust_particles", name: "Dust Particles", category: "Light & Glow", preview: "bg-gradient-to-br from-amber-100 via-yellow-50 to-orange-100", desc: "Floating sunlit dust" },

  // Distortion
  { id: "glitch", name: "Glitch", category: "Distortion", preview: "bg-gradient-to-r from-red-500 via-cyan-400 to-green-500", desc: "Digital signal glitch" },
  { id: "rgb_split", name: "RGB Split", category: "Distortion", preview: "bg-gradient-to-r from-red-500 via-black to-blue-500", desc: "Channel-separated edges" },
  { id: "chromatic_aberration", name: "Chromatic Aberration", category: "Distortion", preview: "bg-gradient-to-r from-rose-400 via-slate-800 to-cyan-400", desc: "Color-fringe lens effect" },
  { id: "vhs", name: "VHS", category: "Distortion", preview: "bg-[repeating-linear-gradient(0deg,#222_0_2px,#555_2px_3px)]", desc: "Tracking lines + warble" },
  { id: "film_grain", name: "Film Grain", category: "Distortion", preview: "bg-gradient-to-br from-neutral-800 via-neutral-700 to-neutral-900", desc: "Analog film texture" },
  { id: "scan_lines", name: "Scan Lines", category: "Distortion", preview: "bg-[repeating-linear-gradient(0deg,#000_0_2px,#0f0_2px_4px)]", desc: "CRT horizontal scan" },
  { id: "digital_noise", name: "Digital Noise", category: "Distortion", preview: "bg-gradient-to-br from-slate-700 via-slate-800 to-black", desc: "Static/noise overlay" },
  { id: "pixelation", name: "Pixelation", category: "Distortion", preview: "bg-[conic-gradient(at_top_left,#f97316,#eab308,#22c55e,#06b6d4,#8b5cf6)]", desc: "Mosaic-style pixels" },
  { id: "mosaic", name: "Mosaic", category: "Distortion", preview: "bg-gradient-to-br from-purple-400 via-pink-400 to-orange-400", desc: "Tiled mosaic blur" },
  { id: "kaleidoscope", name: "Kaleidoscope", category: "Distortion", preview: "bg-[conic-gradient(from_0deg,#ec4899,#8b5cf6,#06b6d4,#22c55e,#eab308,#ec4899)]", desc: "Mirrored pattern FX" },

  // Color FX
  { id: "duotone", name: "Duotone", category: "Color FX", preview: "bg-gradient-to-br from-fuchsia-600 to-cyan-400", desc: "Two-color pop art" },
  { id: "tritone", name: "Tritone", category: "Color FX", preview: "bg-gradient-to-br from-yellow-400 via-rose-500 to-indigo-700", desc: "Three-color mapping" },
  { id: "posterize", name: "Posterize", category: "Color FX", preview: "bg-gradient-to-r from-rose-400 via-amber-300 to-emerald-400", desc: "Flat color banding" },
  { id: "invert", name: "Invert", category: "Color FX", preview: "bg-gradient-to-br from-white via-slate-400 to-black", desc: "Negative inversion" },
  { id: "solarize", name: "Solarize", category: "Color FX", preview: "bg-gradient-to-br from-orange-400 via-yellow-200 to-blue-400", desc: "Partial tone inversion" },
  { id: "sepia_blast", name: "Sepia Blast", category: "Color FX", preview: "bg-gradient-to-br from-amber-200 via-amber-600 to-amber-900", desc: "Vintage sepia boost" },
  { id: "cyber_neon", name: "Cyber Neon", category: "Color FX", preview: "bg-gradient-to-br from-fuchsia-500 via-cyan-400 to-violet-600", desc: "Synthwave neon grade" },
  { id: "infrared", name: "Infrared", category: "Color FX", preview: "bg-gradient-to-br from-pink-300 via-rose-400 to-red-500", desc: "Pink-shifted IR look" },
  { id: "xray", name: "X-Ray", category: "Color FX", preview: "bg-gradient-to-br from-black via-blue-900 to-cyan-300", desc: "Negative blue glow" },
  { id: "thermal", name: "Thermal", category: "Color FX", preview: "bg-gradient-to-br from-indigo-900 via-red-500 to-yellow-300", desc: "Heat-map thermal view" },

  // Motion FX
  { id: "motion_blur", name: "Motion Blur", category: "Motion FX", preview: "bg-gradient-to-r from-transparent via-white to-transparent", desc: "Smear along motion" },
  { id: "speed_ramp", name: "Speed Ramp", category: "Motion FX", preview: "bg-gradient-to-r from-slate-500 via-sky-400 to-slate-800", desc: "Dynamic time-remap" },
  { id: "freeze_frame", name: "Freeze Frame", category: "Motion FX", preview: "bg-gradient-to-br from-slate-700 to-slate-900", desc: "Pause on moment" },
  { id: "time_warp", name: "Time Warp", category: "Motion FX", preview: "bg-[conic-gradient(from_90deg,#8b5cf6,#06b6d4,#8b5cf6)]", desc: "Warped time curve" },
  { id: "reverse", name: "Reverse", category: "Motion FX", preview: "bg-gradient-to-l from-slate-800 via-sky-500 to-slate-800", desc: "Backward playback" },
  { id: "slowmo_ramp", name: "Slow-mo Ramp", category: "Motion FX", preview: "bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-700", desc: "Ease into slow motion" },
  { id: "ghosting", name: "Ghosting", category: "Motion FX", preview: "bg-gradient-to-br from-white/60 via-slate-400/50 to-black/70", desc: "Trailing ghost images" },
  { id: "echo_trail", name: "Echo Trail", category: "Motion FX", preview: "bg-gradient-to-r from-pink-300/40 via-pink-400/60 to-pink-500", desc: "Fading echo copies" },
  { id: "zoom_blur", name: "Zoom Blur", category: "Motion FX", preview: "bg-[radial-gradient(circle,transparent_20%,white_80%)]", desc: "Radial zoom smear" },
  { id: "spin_blur", name: "Spin Blur", category: "Motion FX", preview: "bg-[conic-gradient(from_0deg,white,transparent,white)]", desc: "Rotational motion blur" },

  // Atmospheric
  { id: "rain_overlay", name: "Rain Overlay", category: "Atmospheric", preview: "bg-gradient-to-b from-slate-700 via-slate-600 to-slate-800", desc: "Animated rain drops" },
  { id: "snow", name: "Snow", category: "Atmospheric", preview: "bg-gradient-to-br from-slate-100 via-white to-slate-200", desc: "Falling snowflakes" },
  { id: "sparkles", name: "Sparkles", category: "Atmospheric", preview: "bg-gradient-to-br from-amber-300 via-yellow-200 to-rose-300", desc: "Shimmer glitter FX" },
  { id: "confetti", name: "Confetti", category: "Atmospheric", preview: "bg-gradient-to-br from-rose-400 via-yellow-300 to-emerald-400", desc: "Celebration burst" },
  { id: "embers", name: "Embers", category: "Atmospheric", preview: "bg-gradient-to-t from-orange-700 via-red-500 to-yellow-300", desc: "Glowing embers rise" },
  { id: "bubbles", name: "Bubbles", category: "Atmospheric", preview: "bg-gradient-to-tr from-cyan-200 via-blue-300 to-indigo-400", desc: "Floating bubbles" },
  { id: "clouds", name: "Clouds", category: "Atmospheric", preview: "bg-gradient-to-b from-sky-200 via-white to-slate-200", desc: "Drifting cloud layer" },
  { id: "stars", name: "Stars", category: "Atmospheric", preview: "bg-gradient-to-br from-indigo-900 via-purple-900 to-black", desc: "Twinkling starfield" },
  { id: "lightning", name: "Lightning", category: "Atmospheric", preview: "bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-950", desc: "Strike flashes" },
  { id: "aurora", name: "Aurora", category: "Atmospheric", preview: "bg-gradient-to-br from-green-400 via-teal-400 to-purple-500", desc: "Northern lights wash" },
];

const EFFECT_CATEGORIES = ["Light & Glow", "Distortion", "Color FX", "Motion FX", "Atmospheric"];

/* ─── Voice Presets (20+ voices across styles/accents) ─── */
const VOICE_PRESETS: Array<{ id: string; name: string; gender: string; style: string; accent: string }> = [
  { id: "morgan_freeman", name: "Morgan Freeman Style", gender: "male", style: "cinematic", accent: "US" },
  { id: "young_male_friendly", name: "Young Male Friendly", gender: "male", style: "friendly", accent: "US" },
  { id: "news_anchor", name: "News Anchor", gender: "male", style: "professional", accent: "US" },
  { id: "energetic_female", name: "Energetic Female", gender: "female", style: "upbeat", accent: "US" },
  { id: "calm_narrator", name: "Calm Narrator", gender: "female", style: "calm", accent: "US" },
  { id: "british_male", name: "British Male", gender: "male", style: "professional", accent: "UK" },
  { id: "australian_female", name: "Australian Female", gender: "female", style: "friendly", accent: "AU" },
  { id: "deep_cinematic", name: "Deep Cinematic", gender: "male", style: "cinematic", accent: "US" },
  { id: "youthful_upbeat", name: "Youthful Upbeat", gender: "female", style: "upbeat", accent: "US" },
  { id: "professional_corporate", name: "Professional Corporate", gender: "male", style: "professional", accent: "US" },
  { id: "casual_podcast", name: "Casual Podcast", gender: "male", style: "casual", accent: "US" },
  { id: "dramatic_trailer", name: "Dramatic Trailer", gender: "male", style: "cinematic", accent: "US" },
  { id: "soft_spoken_female", name: "Soft-Spoken Female", gender: "female", style: "calm", accent: "US" },
  { id: "charismatic_host", name: "Charismatic Host", gender: "male", style: "upbeat", accent: "US" },
  { id: "documentary_female", name: "Documentary Female", gender: "female", style: "professional", accent: "UK" },
  { id: "gentle_elder", name: "Gentle Elder", gender: "male", style: "calm", accent: "US" },
  { id: "confident_coach", name: "Confident Coach", gender: "female", style: "upbeat", accent: "US" },
  { id: "storybook_narrator", name: "Storybook Narrator", gender: "female", style: "cinematic", accent: "UK" },
  { id: "southern_gentleman", name: "Southern Gentleman", gender: "male", style: "casual", accent: "US-South" },
  { id: "irish_charm", name: "Irish Charm", gender: "male", style: "friendly", accent: "IE" },
  { id: "tech_reviewer", name: "Tech Reviewer", gender: "male", style: "casual", accent: "US" },
  { id: "warm_motherly", name: "Warm Motherly", gender: "female", style: "calm", accent: "US" },
];

/* ─── Stock B-Roll Categories ─── */
const STOCK_CATEGORIES = [
  { id: "nature", name: "Nature", icon: "🌿" },
  { id: "city", name: "City", icon: "🏙️" },
  { id: "tech", name: "Tech", icon: "💻" },
  { id: "people", name: "People", icon: "👥" },
  { id: "abstract", name: "Abstract", icon: "✨" },
  { id: "money", name: "Money", icon: "💰" },
  { id: "sports", name: "Sports", icon: "⚽" },
  { id: "food", name: "Food", icon: "🍔" },
  { id: "travel", name: "Travel", icon: "✈️" },
  { id: "business", name: "Business", icon: "💼" },
];

/* ─── Export Formats & Quality Presets ─── */
const EXPORT_FORMATS = [
  { id: "prores", name: "ProRes", desc: "Apple ProRes 422 HQ — mastering" },
  { id: "h264", name: "H.264", desc: "Universal codec, web-ready" },
  { id: "h265", name: "H.265 / HEVC", desc: "Efficient 4K/8K compression" },
  { id: "webm", name: "WebM", desc: "Open web format, VP9" },
  { id: "av1", name: "AV1", desc: "Next-gen streaming codec" },
  { id: "gif", name: "GIF", desc: "Animated GIF, looping" },
  { id: "png_seq", name: "PNG Sequence", desc: "Frame-by-frame PNG export" },
];

const QUALITY_PRESETS = [
  { id: "4k_master", name: "4K Master", desc: "3840x2160 mastering quality" },
  { id: "1080p_yt", name: "1080p YouTube", desc: "1920x1080, YouTube optimized" },
  { id: "720p_web", name: "720p Web", desc: "1280x720, web delivery" },
  { id: "480p_social", name: "480p Social", desc: "854x480, compressed social" },
  { id: "preview_low", name: "Preview Low", desc: "640x360, fast preview render" },
];

const ASPECT_RATIO_PRESETS = [
  { id: "9:16", name: "9:16", desc: "TikTok / Reels / Shorts", w: 16, h: 28 },
  { id: "16:9", name: "16:9", desc: "YouTube / Web", w: 28, h: 16 },
  { id: "1:1", name: "1:1", desc: "Instagram Feed", w: 20, h: 20 },
  { id: "4:5", name: "4:5", desc: "Instagram Portrait", w: 20, h: 25 },
  { id: "3:4", name: "3:4", desc: "Portrait", w: 18, h: 24 },
  { id: "21:9", name: "21:9", desc: "Cinematic", w: 32, h: 14 },
  { id: "custom", name: "Custom", desc: "Pick any ratio", w: 22, h: 22 },
];

/* ─── YouTuber Style Presets ─────────────────────────────────
 * One-click full-config presets emulating popular creators' editing styles.
 * Each preset applies a coordinated set of captions/motion/color/audio/smart
 * settings. Config keys match the editorSettings state shape exactly.
 */
const YOUTUBER_PRESETS = [
  {
    id: "mrbeast",
    name: "MrBeast",
    tagline: "Huge yellow captions, punch zooms, high-energy",
    preview: "bg-gradient-to-br from-red-600 via-yellow-500 to-red-500",
    tags: ["Caption: Impact", "Grade: Vibrant", "Music: EDM"],
    config: {
      captions: { enabled: true, autoGenerate: true, preset: "meme_impact", fontFamily: "Impact", fontSize: 80, textColor: "#FFDD00", strokeColor: "#000000", backdropColor: "transparent", strokeWidth: 6, position: "bottom" as const, customY: 78, maxWordsPerLine: 3, emphasizeKeywords: true, autoEmoji: true },
      textAnimation: { enabled: true, preset: "pop", duration: 0.3, easing: "spring" },
      motion: { enabled: true, autoZoomSpeakers: true, preset: "punch_zoom", intensity: 80, autoReframe: true, motionBlur: true },
      transitions: { enabled: true, preset: "flash", duration: 0.2, autoBetweenCuts: true },
      color: { enabled: true, lut: "vibrant", brightness: 5, contrast: 15, saturation: 20, temperature: 5, tint: 0, highlights: 0, shadows: 0, autoColorMatch: true, autoWhiteBalance: false },
      audio: { enabled: true, autoDucking: true, bgGenre: "edm", volumeAutomation: true, noiseRemoval: true, voiceEnhance: true, autoBeatSync: true },
      smart: { autoCutSilence: true, silenceThreshold: 0.5, autoReframeRatio: "9:16" as const, removeFillerWords: true, autoChapters: false, smartPacing: true, hookDetector: true, viralMomentFinder: true, autoBroll: true, trendingAudioMatch: true },
      aspect: { preset: "9:16", customW: 9, customH: 16 },
    },
  },
  {
    id: "pewdiepie",
    name: "PewDiePie",
    tagline: "Bold white captions, meme overlays, gaming energy",
    preview: "bg-gradient-to-br from-red-500 via-pink-500 to-purple-600",
    tags: ["Caption: Bold White", "Grade: Neutral", "Music: Hip-Hop"],
    config: {
      captions: { enabled: true, autoGenerate: true, preset: "meme_impact", fontFamily: "Impact", fontSize: 64, textColor: "#FFFFFF", strokeColor: "#000000", backdropColor: "transparent", strokeWidth: 5, position: "top" as const, customY: 15, maxWordsPerLine: 5, emphasizeKeywords: true, autoEmoji: true },
      textAnimation: { enabled: true, preset: "pop", duration: 0.25, easing: "bounce" },
      motion: { enabled: true, autoZoomSpeakers: false, preset: "crash_zoom", intensity: 70, autoReframe: false, motionBlur: true },
      transitions: { enabled: true, preset: "cut", duration: 0.1, autoBetweenCuts: true },
      color: { enabled: true, lut: "high_contrast", brightness: 0, contrast: 10, saturation: 5, temperature: 0, tint: 0, highlights: 0, shadows: 0, autoColorMatch: false, autoWhiteBalance: false },
      audio: { enabled: true, autoDucking: true, bgGenre: "hip_hop", volumeAutomation: false, noiseRemoval: true, voiceEnhance: true, autoBeatSync: false },
      smart: { autoCutSilence: true, silenceThreshold: 0.4, autoReframeRatio: "none" as const, removeFillerWords: false, autoChapters: false, smartPacing: true, hookDetector: true, viralMomentFinder: false, autoBroll: false, trendingAudioMatch: true },
      aspect: { preset: "16:9", customW: 16, customH: 9 },
    },
  },
  {
    id: "mkbhd",
    name: "MKBHD",
    tagline: "Clean minimalist, cinematic grade, smooth slow-mo",
    preview: "bg-gradient-to-br from-slate-700 via-slate-900 to-red-900",
    tags: ["Caption: Minimal", "Grade: Cinematic", "Music: Ambient Tech"],
    config: {
      captions: { enabled: false, autoGenerate: false, preset: "podcast_minimal", fontFamily: "Inter", fontSize: 28, textColor: "#FFFFFF", strokeColor: "transparent", backdropColor: "transparent", strokeWidth: 0, position: "bottom" as const, customY: 85, maxWordsPerLine: 6, emphasizeKeywords: false, autoEmoji: false },
      textAnimation: { enabled: true, preset: "fade_in", duration: 0.6, easing: "ease-out" },
      motion: { enabled: true, autoZoomSpeakers: false, preset: "slow_zoom_in", intensity: 30, autoReframe: false, motionBlur: true },
      transitions: { enabled: true, preset: "fade", duration: 0.5, autoBetweenCuts: true },
      color: { enabled: true, lut: "cinematic", brightness: 0, contrast: 10, saturation: -5, temperature: -3, tint: 0, highlights: -5, shadows: 5, autoColorMatch: true, autoWhiteBalance: true },
      audio: { enabled: true, autoDucking: true, bgGenre: "ambient", volumeAutomation: true, noiseRemoval: true, voiceEnhance: true, autoBeatSync: false },
      smart: { autoCutSilence: false, silenceThreshold: 1.5, autoReframeRatio: "none" as const, removeFillerWords: true, autoChapters: true, smartPacing: false, hookDetector: false, viralMomentFinder: false, autoBroll: true, trendingAudioMatch: false },
      aspect: { preset: "16:9", customW: 16, customH: 9 },
    },
  },
  {
    id: "ali_abdaal",
    name: "Ali Abdaal",
    tagline: "Friendly clean captions, gentle transitions, warm grade",
    preview: "bg-gradient-to-br from-orange-300 via-amber-400 to-yellow-500",
    tags: ["Caption: Clean Sans", "Grade: Warm", "Music: Upbeat"],
    config: {
      captions: { enabled: true, autoGenerate: true, preset: "youtube_standard", fontFamily: "Poppins", fontSize: 32, textColor: "#FFFFFF", strokeColor: "transparent", backdropColor: "rgba(0,0,0,0.6)", strokeWidth: 0, position: "bottom" as const, customY: 82, maxWordsPerLine: 6, emphasizeKeywords: true, autoEmoji: false },
      textAnimation: { enabled: true, preset: "fade_in", duration: 0.4, easing: "ease-out" },
      motion: { enabled: true, autoZoomSpeakers: true, preset: "breathing", intensity: 25, autoReframe: false, motionBlur: false },
      transitions: { enabled: true, preset: "dissolve", duration: 0.35, autoBetweenCuts: true },
      color: { enabled: true, lut: "warm", brightness: 5, contrast: 5, saturation: 8, temperature: 10, tint: 2, highlights: 0, shadows: 3, autoColorMatch: true, autoWhiteBalance: true },
      audio: { enabled: true, autoDucking: true, bgGenre: "upbeat", volumeAutomation: true, noiseRemoval: true, voiceEnhance: true, autoBeatSync: false },
      smart: { autoCutSilence: true, silenceThreshold: 1.0, autoReframeRatio: "none" as const, removeFillerWords: true, autoChapters: true, smartPacing: false, hookDetector: true, viralMomentFinder: false, autoBroll: true, trendingAudioMatch: false },
      aspect: { preset: "16:9", customW: 16, customH: 9 },
    },
  },
  {
    id: "veritasium",
    name: "Veritasium",
    tagline: "Educational with emphasis, motion graphics, clean grade",
    preview: "bg-gradient-to-br from-sky-600 via-blue-700 to-indigo-900",
    tags: ["Caption: Emphasized", "Grade: Clean", "Music: Corporate"],
    config: {
      captions: { enabled: true, autoGenerate: true, preset: "youtube_standard", fontFamily: "Inter", fontSize: 34, textColor: "#FFFFFF", strokeColor: "#000000", backdropColor: "rgba(0,0,0,0.5)", strokeWidth: 2, position: "bottom" as const, customY: 80, maxWordsPerLine: 7, emphasizeKeywords: true, autoEmoji: false },
      textAnimation: { enabled: true, preset: "word_cascade", duration: 0.5, easing: "ease-out" },
      motion: { enabled: true, autoZoomSpeakers: true, preset: "slow_zoom_in", intensity: 35, autoReframe: false, motionBlur: false },
      transitions: { enabled: true, preset: "fade", duration: 0.4, autoBetweenCuts: true },
      color: { enabled: true, lut: "muted", brightness: 0, contrast: 8, saturation: 0, temperature: 0, tint: 0, highlights: 0, shadows: 0, autoColorMatch: true, autoWhiteBalance: true },
      audio: { enabled: true, autoDucking: true, bgGenre: "corporate", volumeAutomation: true, noiseRemoval: true, voiceEnhance: true, autoBeatSync: false },
      smart: { autoCutSilence: true, silenceThreshold: 1.2, autoReframeRatio: "none" as const, removeFillerWords: true, autoChapters: true, smartPacing: false, hookDetector: true, viralMomentFinder: false, autoBroll: true, trendingAudioMatch: false },
      aspect: { preset: "16:9", customW: 16, customH: 9 },
    },
  },
  {
    id: "matt_davella",
    name: "Matt D'Avella",
    tagline: "Cinematic minimalism, letterbox, muted piano",
    preview: "bg-gradient-to-br from-stone-700 via-stone-800 to-stone-900",
    tags: ["Caption: None", "Grade: Muted", "Music: Piano"],
    config: {
      captions: { enabled: false, autoGenerate: false, preset: "cinematic", fontFamily: "Playfair Display", fontSize: 22, textColor: "#f5f5f5", strokeColor: "transparent", backdropColor: "transparent", strokeWidth: 0, position: "bottom" as const, customY: 88, maxWordsPerLine: 8, emphasizeKeywords: false, autoEmoji: false },
      textAnimation: { enabled: true, preset: "fade_in", duration: 0.8, easing: "ease-in-out" },
      motion: { enabled: true, autoZoomSpeakers: false, preset: "slow_zoom_in", intensity: 20, autoReframe: false, motionBlur: true },
      transitions: { enabled: true, preset: "fade", duration: 0.7, autoBetweenCuts: true },
      color: { enabled: true, lut: "muted", brightness: -3, contrast: 12, saturation: -15, temperature: -5, tint: 0, highlights: -8, shadows: 8, autoColorMatch: true, autoWhiteBalance: true },
      audio: { enabled: true, autoDucking: true, bgGenre: "piano", volumeAutomation: true, noiseRemoval: true, voiceEnhance: true, autoBeatSync: false },
      smart: { autoCutSilence: false, silenceThreshold: 2.0, autoReframeRatio: "none" as const, removeFillerWords: false, autoChapters: false, smartPacing: false, hookDetector: false, viralMomentFinder: false, autoBroll: true, trendingAudioMatch: false },
      aspect: { preset: "21:9", customW: 21, customH: 9 },
    },
  },
  {
    id: "peter_mckinnon",
    name: "Peter McKinnon",
    tagline: "Cinematic orange/teal, dramatic transitions, slow-mo",
    preview: "bg-gradient-to-br from-orange-600 via-teal-700 to-slate-900",
    tags: ["Caption: Cinematic", "Grade: Teal & Orange", "Music: Cinematic"],
    config: {
      captions: { enabled: true, autoGenerate: true, preset: "cinematic", fontFamily: "Playfair Display", fontSize: 26, textColor: "#F5F5F5", strokeColor: "transparent", backdropColor: "transparent", strokeWidth: 0, position: "bottom" as const, customY: 85, maxWordsPerLine: 7, emphasizeKeywords: false, autoEmoji: false },
      textAnimation: { enabled: true, preset: "fade_in", duration: 0.6, easing: "ease-out" },
      motion: { enabled: true, autoZoomSpeakers: false, preset: "dolly", intensity: 55, autoReframe: false, motionBlur: true },
      transitions: { enabled: true, preset: "whip_right", duration: 0.3, autoBetweenCuts: true },
      color: { enabled: true, lut: "teal_orange", brightness: 0, contrast: 15, saturation: 10, temperature: 0, tint: 0, highlights: -5, shadows: 5, autoColorMatch: true, autoWhiteBalance: false },
      audio: { enabled: true, autoDucking: true, bgGenre: "cinematic", volumeAutomation: true, noiseRemoval: true, voiceEnhance: true, autoBeatSync: true },
      smart: { autoCutSilence: true, silenceThreshold: 1.0, autoReframeRatio: "none" as const, removeFillerWords: true, autoChapters: false, smartPacing: true, hookDetector: true, viralMomentFinder: false, autoBroll: true, trendingAudioMatch: false },
      aspect: { preset: "16:9", customW: 16, customH: 9 },
    },
  },
  {
    id: "graham_stephan",
    name: "Graham Stephan",
    tagline: "Finance vibe, green/gold accents, casual captions",
    preview: "bg-gradient-to-br from-green-600 via-emerald-700 to-yellow-600",
    tags: ["Caption: Casual", "Grade: Warm", "Music: Upbeat"],
    config: {
      captions: { enabled: true, autoGenerate: true, preset: "youtube_standard", fontFamily: "Montserrat", fontSize: 36, textColor: "#FFFFFF", strokeColor: "#000000", backdropColor: "rgba(0,0,0,0.55)", strokeWidth: 2, position: "bottom" as const, customY: 80, maxWordsPerLine: 5, emphasizeKeywords: true, autoEmoji: false },
      textAnimation: { enabled: true, preset: "slide_bottom", duration: 0.35, easing: "ease-out" },
      motion: { enabled: true, autoZoomSpeakers: true, preset: "punch_zoom", intensity: 50, autoReframe: false, motionBlur: false },
      transitions: { enabled: true, preset: "cut", duration: 0.15, autoBetweenCuts: true },
      color: { enabled: true, lut: "warm", brightness: 3, contrast: 8, saturation: 8, temperature: 5, tint: 0, highlights: 0, shadows: 0, autoColorMatch: true, autoWhiteBalance: true },
      audio: { enabled: true, autoDucking: true, bgGenre: "upbeat", volumeAutomation: true, noiseRemoval: true, voiceEnhance: true, autoBeatSync: false },
      smart: { autoCutSilence: true, silenceThreshold: 0.7, autoReframeRatio: "none" as const, removeFillerWords: true, autoChapters: true, smartPacing: true, hookDetector: true, viralMomentFinder: false, autoBroll: true, trendingAudioMatch: false },
      aspect: { preset: "16:9", customW: 16, customH: 9 },
    },
  },
  {
    id: "joe_rogan",
    name: "Joe Rogan",
    tagline: "Podcast style, minimal edits, center focus",
    preview: "bg-gradient-to-br from-neutral-800 via-neutral-900 to-black",
    tags: ["Caption: Podcast", "Grade: Muted", "Music: None"],
    config: {
      captions: { enabled: true, autoGenerate: true, preset: "podcast_minimal", fontFamily: "Inter", fontSize: 30, textColor: "#FFFFFF", strokeColor: "transparent", backdropColor: "transparent", strokeWidth: 0, position: "bottom" as const, customY: 88, maxWordsPerLine: 8, emphasizeKeywords: false, autoEmoji: false },
      textAnimation: { enabled: true, preset: "fade_in", duration: 0.3, easing: "linear" },
      motion: { enabled: false, autoZoomSpeakers: true, preset: "breathing", intensity: 10, autoReframe: false, motionBlur: false },
      transitions: { enabled: true, preset: "cut", duration: 0.1, autoBetweenCuts: false },
      color: { enabled: true, lut: "muted", brightness: 0, contrast: 5, saturation: -5, temperature: 0, tint: 0, highlights: 0, shadows: 0, autoColorMatch: true, autoWhiteBalance: true },
      audio: { enabled: true, autoDucking: false, bgGenre: "ambient", volumeAutomation: false, noiseRemoval: true, voiceEnhance: true, autoBeatSync: false },
      smart: { autoCutSilence: false, silenceThreshold: 2.5, autoReframeRatio: "none" as const, removeFillerWords: false, autoChapters: true, smartPacing: false, hookDetector: false, viralMomentFinder: true, autoBroll: false, trendingAudioMatch: false },
      aspect: { preset: "16:9", customW: 16, customH: 9 },
    },
  },
  {
    id: "casey_neistat",
    name: "Casey Neistat",
    tagline: "Vlog energy, handheld feel, punchy text overlays",
    preview: "bg-gradient-to-br from-yellow-500 via-red-500 to-orange-600",
    tags: ["Caption: Bold", "Grade: High Contrast", "Music: Upbeat"],
    config: {
      captions: { enabled: true, autoGenerate: true, preset: "meme_impact", fontFamily: "Bebas Neue", fontSize: 54, textColor: "#FFFFFF", strokeColor: "#000000", backdropColor: "transparent", strokeWidth: 4, position: "center" as const, customY: 50, maxWordsPerLine: 4, emphasizeKeywords: true, autoEmoji: false },
      textAnimation: { enabled: true, preset: "slide_left", duration: 0.3, easing: "ease-out" },
      motion: { enabled: true, autoZoomSpeakers: false, preset: "crash_zoom", intensity: 65, autoReframe: false, motionBlur: true },
      transitions: { enabled: true, preset: "whip_left", duration: 0.25, autoBetweenCuts: true },
      color: { enabled: true, lut: "high_contrast", brightness: 3, contrast: 18, saturation: 8, temperature: 3, tint: 0, highlights: 0, shadows: 0, autoColorMatch: true, autoWhiteBalance: true },
      audio: { enabled: true, autoDucking: true, bgGenre: "upbeat", volumeAutomation: true, noiseRemoval: true, voiceEnhance: true, autoBeatSync: true },
      smart: { autoCutSilence: true, silenceThreshold: 0.6, autoReframeRatio: "none" as const, removeFillerWords: true, autoChapters: false, smartPacing: true, hookDetector: true, viralMomentFinder: true, autoBroll: false, trendingAudioMatch: false },
      aspect: { preset: "16:9", customW: 16, customH: 9 },
    },
  },
  {
    id: "ryan_trahan",
    name: "Ryan Trahan",
    tagline: "Adventure vlog, dynamic captions, warm grade",
    preview: "bg-gradient-to-br from-amber-500 via-orange-600 to-rose-600",
    tags: ["Caption: Dynamic", "Grade: Warm", "Music: Upbeat"],
    config: {
      captions: { enabled: true, autoGenerate: true, preset: "reel_trendy", fontFamily: "Montserrat", fontSize: 48, textColor: "#FFFFFF", strokeColor: "#000000", backdropColor: "transparent", strokeWidth: 4, position: "center" as const, customY: 55, maxWordsPerLine: 4, emphasizeKeywords: true, autoEmoji: true },
      textAnimation: { enabled: true, preset: "pop", duration: 0.3, easing: "spring" },
      motion: { enabled: true, autoZoomSpeakers: false, preset: "punch_zoom", intensity: 60, autoReframe: false, motionBlur: true },
      transitions: { enabled: true, preset: "whip_right", duration: 0.3, autoBetweenCuts: true },
      color: { enabled: true, lut: "warm", brightness: 5, contrast: 10, saturation: 12, temperature: 8, tint: 0, highlights: 0, shadows: 3, autoColorMatch: true, autoWhiteBalance: true },
      audio: { enabled: true, autoDucking: true, bgGenre: "upbeat", volumeAutomation: true, noiseRemoval: true, voiceEnhance: true, autoBeatSync: true },
      smart: { autoCutSilence: true, silenceThreshold: 0.5, autoReframeRatio: "none" as const, removeFillerWords: true, autoChapters: false, smartPacing: true, hookDetector: true, viralMomentFinder: true, autoBroll: true, trendingAudioMatch: true },
      aspect: { preset: "16:9", customW: 16, customH: 9 },
    },
  },
  {
    id: "dude_perfect",
    name: "Dude Perfect",
    tagline: "Sports energy, high-impact transitions, slow-mo hits",
    preview: "bg-gradient-to-br from-blue-600 via-cyan-500 to-red-500",
    tags: ["Caption: Bold", "Grade: Vibrant", "Music: Epic"],
    config: {
      captions: { enabled: true, autoGenerate: true, preset: "meme_impact", fontFamily: "Oswald", fontSize: 60, textColor: "#FFFFFF", strokeColor: "#000000", backdropColor: "transparent", strokeWidth: 5, position: "top" as const, customY: 18, maxWordsPerLine: 4, emphasizeKeywords: true, autoEmoji: false },
      textAnimation: { enabled: true, preset: "scale_up", duration: 0.3, easing: "spring" },
      motion: { enabled: true, autoZoomSpeakers: false, preset: "crash_zoom", intensity: 85, autoReframe: false, motionBlur: true },
      transitions: { enabled: true, preset: "flash", duration: 0.2, autoBetweenCuts: true },
      color: { enabled: true, lut: "vibrant", brightness: 3, contrast: 12, saturation: 18, temperature: 3, tint: 0, highlights: 0, shadows: 0, autoColorMatch: true, autoWhiteBalance: true },
      audio: { enabled: true, autoDucking: true, bgGenre: "trailer", volumeAutomation: true, noiseRemoval: true, voiceEnhance: true, autoBeatSync: true },
      smart: { autoCutSilence: true, silenceThreshold: 0.6, autoReframeRatio: "none" as const, removeFillerWords: true, autoChapters: false, smartPacing: true, hookDetector: true, viralMomentFinder: true, autoBroll: false, trendingAudioMatch: false },
      aspect: { preset: "16:9", customW: 16, customH: 9 },
    },
  },
  {
    id: "emma_chamberlain",
    name: "Emma Chamberlain",
    tagline: "Relaxed vlog, hand-written text, vintage grade",
    preview: "bg-gradient-to-br from-amber-200 via-orange-300 to-rose-400",
    tags: ["Caption: Handwritten", "Grade: Vintage", "Music: Lo-Fi"],
    config: {
      captions: { enabled: true, autoGenerate: true, preset: "cinematic", fontFamily: "Merriweather", fontSize: 28, textColor: "#FFFFFF", strokeColor: "#000000", backdropColor: "transparent", strokeWidth: 2, position: "bottom" as const, customY: 83, maxWordsPerLine: 6, emphasizeKeywords: false, autoEmoji: false },
      textAnimation: { enabled: true, preset: "typewriter", duration: 0.5, easing: "linear" },
      motion: { enabled: true, autoZoomSpeakers: false, preset: "slow_zoom_in", intensity: 25, autoReframe: false, motionBlur: false },
      transitions: { enabled: true, preset: "dissolve", duration: 0.4, autoBetweenCuts: true },
      color: { enabled: true, lut: "vintage", brightness: -3, contrast: -5, saturation: -10, temperature: 5, tint: 3, highlights: -5, shadows: 5, autoColorMatch: true, autoWhiteBalance: false },
      audio: { enabled: true, autoDucking: true, bgGenre: "lofi", volumeAutomation: true, noiseRemoval: true, voiceEnhance: true, autoBeatSync: false },
      smart: { autoCutSilence: true, silenceThreshold: 1.0, autoReframeRatio: "none" as const, removeFillerWords: false, autoChapters: false, smartPacing: false, hookDetector: false, viralMomentFinder: false, autoBroll: true, trendingAudioMatch: true },
      aspect: { preset: "16:9", customW: 16, customH: 9 },
    },
  },
  {
    id: "dream",
    name: "Dream / Minecraft",
    tagline: "Gaming, red/green highlights, dramatic music swells",
    preview: "bg-gradient-to-br from-green-500 via-lime-500 to-red-600",
    tags: ["Caption: Gaming", "Grade: High Contrast", "Music: Trailer"],
    config: {
      captions: { enabled: true, autoGenerate: true, preset: "tiktok_bold", fontFamily: "Impact", fontSize: 56, textColor: "#00FF66", strokeColor: "#000000", backdropColor: "transparent", strokeWidth: 4, position: "top" as const, customY: 20, maxWordsPerLine: 4, emphasizeKeywords: true, autoEmoji: true },
      textAnimation: { enabled: true, preset: "shake", duration: 0.25, easing: "bounce" },
      motion: { enabled: true, autoZoomSpeakers: false, preset: "crash_zoom", intensity: 75, autoReframe: false, motionBlur: true },
      transitions: { enabled: true, preset: "flash", duration: 0.15, autoBetweenCuts: true },
      color: { enabled: true, lut: "high_contrast", brightness: 3, contrast: 15, saturation: 15, temperature: 0, tint: 0, highlights: 0, shadows: 0, autoColorMatch: true, autoWhiteBalance: false },
      audio: { enabled: true, autoDucking: true, bgGenre: "trailer", volumeAutomation: true, noiseRemoval: true, voiceEnhance: true, autoBeatSync: true },
      smart: { autoCutSilence: true, silenceThreshold: 0.5, autoReframeRatio: "none" as const, removeFillerWords: true, autoChapters: false, smartPacing: true, hookDetector: true, viralMomentFinder: true, autoBroll: false, trendingAudioMatch: true },
      aspect: { preset: "16:9", customW: 16, customH: 9 },
    },
  },
  {
    id: "linus_tech_tips",
    name: "Linus Tech Tips",
    tagline: "Tech review, clean captions, blue/silver grade",
    preview: "bg-gradient-to-br from-sky-500 via-slate-400 to-slate-700",
    tags: ["Caption: Clean", "Grade: Cool", "Music: Corporate"],
    config: {
      captions: { enabled: true, autoGenerate: true, preset: "youtube_standard", fontFamily: "Roboto", fontSize: 32, textColor: "#FFFFFF", strokeColor: "transparent", backdropColor: "rgba(0,0,0,0.65)", strokeWidth: 0, position: "bottom" as const, customY: 82, maxWordsPerLine: 7, emphasizeKeywords: true, autoEmoji: false },
      textAnimation: { enabled: true, preset: "slide_left", duration: 0.35, easing: "ease-out" },
      motion: { enabled: true, autoZoomSpeakers: true, preset: "slow_zoom_in", intensity: 35, autoReframe: false, motionBlur: false },
      transitions: { enabled: true, preset: "wipe_left", duration: 0.3, autoBetweenCuts: true },
      color: { enabled: true, lut: "cool", brightness: 0, contrast: 8, saturation: 0, temperature: -8, tint: -2, highlights: 0, shadows: 0, autoColorMatch: true, autoWhiteBalance: true },
      audio: { enabled: true, autoDucking: true, bgGenre: "corporate", volumeAutomation: true, noiseRemoval: true, voiceEnhance: true, autoBeatSync: false },
      smart: { autoCutSilence: true, silenceThreshold: 0.8, autoReframeRatio: "none" as const, removeFillerWords: true, autoChapters: true, smartPacing: true, hookDetector: true, viralMomentFinder: false, autoBroll: true, trendingAudioMatch: false },
      aspect: { preset: "16:9", customW: 16, customH: 9 },
    },
  },
  {
    id: "corridor_crew",
    name: "Corridor Crew",
    tagline: "VFX heavy, dramatic cuts, bass-heavy cinematic",
    preview: "bg-gradient-to-br from-purple-700 via-fuchsia-600 to-slate-900",
    tags: ["Caption: Cinematic", "Grade: Cinematic", "Music: Trailer"],
    config: {
      captions: { enabled: true, autoGenerate: true, preset: "cinematic", fontFamily: "Playfair Display", fontSize: 30, textColor: "#FFFFFF", strokeColor: "transparent", backdropColor: "transparent", strokeWidth: 0, position: "bottom" as const, customY: 85, maxWordsPerLine: 6, emphasizeKeywords: false, autoEmoji: false },
      textAnimation: { enabled: true, preset: "blur_to_clear", duration: 0.5, easing: "ease-out" },
      motion: { enabled: true, autoZoomSpeakers: false, preset: "crash_zoom", intensity: 70, autoReframe: false, motionBlur: true },
      transitions: { enabled: true, preset: "glitch", duration: 0.3, autoBetweenCuts: true },
      color: { enabled: true, lut: "cinematic", brightness: -3, contrast: 15, saturation: 5, temperature: -3, tint: 0, highlights: -5, shadows: 5, autoColorMatch: true, autoWhiteBalance: false },
      audio: { enabled: true, autoDucking: true, bgGenre: "trailer", volumeAutomation: true, noiseRemoval: true, voiceEnhance: true, autoBeatSync: true },
      smart: { autoCutSilence: true, silenceThreshold: 0.7, autoReframeRatio: "none" as const, removeFillerWords: true, autoChapters: false, smartPacing: true, hookDetector: true, viralMomentFinder: false, autoBroll: true, trendingAudioMatch: false },
      aspect: { preset: "16:9", customW: 16, customH: 9 },
    },
  },
  {
    id: "sam_kolder",
    name: "Sam Kolder",
    tagline: "Cinematic travel, match cuts, epic moody grade",
    preview: "bg-gradient-to-br from-teal-800 via-slate-900 to-amber-700",
    tags: ["Caption: Cinematic", "Grade: Moody", "Music: Epic"],
    config: {
      captions: { enabled: false, autoGenerate: false, preset: "cinematic", fontFamily: "Playfair Display", fontSize: 26, textColor: "#F5F5F5", strokeColor: "transparent", backdropColor: "transparent", strokeWidth: 0, position: "bottom" as const, customY: 88, maxWordsPerLine: 8, emphasizeKeywords: false, autoEmoji: false },
      textAnimation: { enabled: true, preset: "fade_in", duration: 0.7, easing: "ease-out" },
      motion: { enabled: true, autoZoomSpeakers: false, preset: "dolly", intensity: 55, autoReframe: false, motionBlur: true },
      transitions: { enabled: true, preset: "morph", duration: 0.4, autoBetweenCuts: true },
      color: { enabled: true, lut: "moody", brightness: -5, contrast: 18, saturation: -3, temperature: -5, tint: 0, highlights: -8, shadows: 10, autoColorMatch: true, autoWhiteBalance: false },
      audio: { enabled: true, autoDucking: true, bgGenre: "cinematic", volumeAutomation: true, noiseRemoval: true, voiceEnhance: true, autoBeatSync: true },
      smart: { autoCutSilence: false, silenceThreshold: 1.5, autoReframeRatio: "none" as const, removeFillerWords: false, autoChapters: false, smartPacing: true, hookDetector: true, viralMomentFinder: false, autoBroll: true, trendingAudioMatch: false },
      aspect: { preset: "21:9", customW: 21, customH: 9 },
    },
  },
  {
    id: "colin_samir",
    name: "Colin and Samir",
    tagline: "Creator economy, podcast clean, neutral center",
    preview: "bg-gradient-to-br from-zinc-600 via-zinc-700 to-zinc-900",
    tags: ["Caption: Center", "Grade: Muted", "Music: Corporate"],
    config: {
      captions: { enabled: true, autoGenerate: true, preset: "podcast_minimal", fontFamily: "Inter", fontSize: 30, textColor: "#FFFFFF", strokeColor: "transparent", backdropColor: "rgba(0,0,0,0.4)", strokeWidth: 0, position: "bottom" as const, customY: 85, maxWordsPerLine: 7, emphasizeKeywords: false, autoEmoji: false },
      textAnimation: { enabled: true, preset: "fade_in", duration: 0.4, easing: "ease-out" },
      motion: { enabled: true, autoZoomSpeakers: true, preset: "breathing", intensity: 15, autoReframe: false, motionBlur: false },
      transitions: { enabled: true, preset: "fade", duration: 0.35, autoBetweenCuts: true },
      color: { enabled: true, lut: "muted", brightness: 0, contrast: 5, saturation: -3, temperature: 0, tint: 0, highlights: 0, shadows: 0, autoColorMatch: true, autoWhiteBalance: true },
      audio: { enabled: true, autoDucking: true, bgGenre: "corporate", volumeAutomation: true, noiseRemoval: true, voiceEnhance: true, autoBeatSync: false },
      smart: { autoCutSilence: true, silenceThreshold: 1.2, autoReframeRatio: "none" as const, removeFillerWords: true, autoChapters: true, smartPacing: false, hookDetector: false, viralMomentFinder: false, autoBroll: false, trendingAudioMatch: false },
      aspect: { preset: "16:9", customW: 16, customH: 9 },
    },
  },
  {
    id: "hamza_ahmed",
    name: "Hamza Ahmed",
    tagline: "Self-improvement, bold lower-third, motivational",
    preview: "bg-gradient-to-br from-stone-800 via-amber-700 to-stone-900",
    tags: ["Caption: Lower-Third", "Grade: Cinematic", "Music: Emotional"],
    config: {
      captions: { enabled: true, autoGenerate: true, preset: "tiktok_bold", fontFamily: "Montserrat", fontSize: 44, textColor: "#FFD700", strokeColor: "#000000", backdropColor: "transparent", strokeWidth: 3, position: "bottom" as const, customY: 78, maxWordsPerLine: 5, emphasizeKeywords: true, autoEmoji: false },
      textAnimation: { enabled: true, preset: "slide_bottom", duration: 0.4, easing: "ease-out" },
      motion: { enabled: true, autoZoomSpeakers: true, preset: "slow_zoom_in", intensity: 40, autoReframe: false, motionBlur: true },
      transitions: { enabled: true, preset: "fade", duration: 0.4, autoBetweenCuts: true },
      color: { enabled: true, lut: "cinematic", brightness: -2, contrast: 15, saturation: 5, temperature: -3, tint: 0, highlights: -5, shadows: 8, autoColorMatch: true, autoWhiteBalance: false },
      audio: { enabled: true, autoDucking: true, bgGenre: "emotional", volumeAutomation: true, noiseRemoval: true, voiceEnhance: true, autoBeatSync: true },
      smart: { autoCutSilence: true, silenceThreshold: 0.7, autoReframeRatio: "none" as const, removeFillerWords: true, autoChapters: false, smartPacing: true, hookDetector: true, viralMomentFinder: true, autoBroll: true, trendingAudioMatch: false },
      aspect: { preset: "16:9", customW: 16, customH: 9 },
    },
  },
  {
    id: "iman_gadzhi",
    name: "Iman Gadzhi",
    tagline: "Business/marketing, corporate grade, scroll-stop hooks",
    preview: "bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800",
    tags: ["Caption: Corporate", "Grade: Muted", "Music: Corporate"],
    config: {
      captions: { enabled: true, autoGenerate: true, preset: "tiktok_bold", fontFamily: "Poppins", fontSize: 46, textColor: "#FFFFFF", strokeColor: "#000000", backdropColor: "transparent", strokeWidth: 3, position: "center" as const, customY: 60, maxWordsPerLine: 4, emphasizeKeywords: true, autoEmoji: false },
      textAnimation: { enabled: true, preset: "scale_up", duration: 0.3, easing: "ease-out" },
      motion: { enabled: true, autoZoomSpeakers: true, preset: "punch_zoom", intensity: 55, autoReframe: true, motionBlur: false },
      transitions: { enabled: true, preset: "cut", duration: 0.15, autoBetweenCuts: true },
      color: { enabled: true, lut: "muted", brightness: 0, contrast: 10, saturation: -3, temperature: -2, tint: 0, highlights: 0, shadows: 0, autoColorMatch: true, autoWhiteBalance: true },
      audio: { enabled: true, autoDucking: true, bgGenre: "corporate", volumeAutomation: true, noiseRemoval: true, voiceEnhance: true, autoBeatSync: false },
      smart: { autoCutSilence: true, silenceThreshold: 0.5, autoReframeRatio: "9:16" as const, removeFillerWords: true, autoChapters: false, smartPacing: true, hookDetector: true, viralMomentFinder: true, autoBroll: true, trendingAudioMatch: false },
      aspect: { preset: "9:16", customW: 9, customH: 16 },
    },
  },
  {
    id: "pitch_meeting",
    name: "Pitch Meeting",
    tagline: "Comedy sketch, simple edits, center captions",
    preview: "bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500",
    tags: ["Caption: Center", "Grade: Clean", "Music: Corporate"],
    config: {
      captions: { enabled: true, autoGenerate: true, preset: "popup", fontFamily: "Oswald", fontSize: 40, textColor: "#FFFFFF", strokeColor: "#000000", backdropColor: "transparent", strokeWidth: 3, position: "center" as const, customY: 50, maxWordsPerLine: 5, emphasizeKeywords: true, autoEmoji: false },
      textAnimation: { enabled: true, preset: "pop", duration: 0.3, easing: "bounce" },
      motion: { enabled: false, autoZoomSpeakers: false, preset: "breathing", intensity: 10, autoReframe: false, motionBlur: false },
      transitions: { enabled: true, preset: "cut", duration: 0.1, autoBetweenCuts: true },
      color: { enabled: true, lut: "muted", brightness: 0, contrast: 5, saturation: 0, temperature: 0, tint: 0, highlights: 0, shadows: 0, autoColorMatch: false, autoWhiteBalance: true },
      audio: { enabled: true, autoDucking: true, bgGenre: "corporate", volumeAutomation: false, noiseRemoval: true, voiceEnhance: true, autoBeatSync: false },
      smart: { autoCutSilence: true, silenceThreshold: 0.8, autoReframeRatio: "none" as const, removeFillerWords: true, autoChapters: false, smartPacing: false, hookDetector: false, viralMomentFinder: false, autoBroll: false, trendingAudioMatch: false },
      aspect: { preset: "16:9", customW: 16, customH: 9 },
    },
  },
  {
    id: "babish",
    name: "Binging with Babish",
    tagline: "Cooking, overhead shots, calm jazzy warm",
    preview: "bg-gradient-to-br from-amber-700 via-orange-600 to-rose-700",
    tags: ["Caption: Calm", "Grade: Warm", "Music: Jazz"],
    config: {
      captions: { enabled: true, autoGenerate: true, preset: "cinematic", fontFamily: "Playfair Display", fontSize: 26, textColor: "#FFFFFF", strokeColor: "transparent", backdropColor: "rgba(0,0,0,0.4)", strokeWidth: 0, position: "bottom" as const, customY: 85, maxWordsPerLine: 8, emphasizeKeywords: false, autoEmoji: false },
      textAnimation: { enabled: true, preset: "fade_in", duration: 0.5, easing: "ease-out" },
      motion: { enabled: true, autoZoomSpeakers: false, preset: "slow_zoom_in", intensity: 20, autoReframe: false, motionBlur: false },
      transitions: { enabled: true, preset: "dissolve", duration: 0.5, autoBetweenCuts: true },
      color: { enabled: true, lut: "warm", brightness: 3, contrast: 8, saturation: 8, temperature: 8, tint: 0, highlights: 0, shadows: 3, autoColorMatch: true, autoWhiteBalance: true },
      audio: { enabled: true, autoDucking: true, bgGenre: "lofi", volumeAutomation: true, noiseRemoval: true, voiceEnhance: true, autoBeatSync: false },
      smart: { autoCutSilence: false, silenceThreshold: 1.5, autoReframeRatio: "none" as const, removeFillerWords: false, autoChapters: true, smartPacing: false, hookDetector: false, viralMomentFinder: false, autoBroll: true, trendingAudioMatch: false },
      aspect: { preset: "16:9", customW: 16, customH: 9 },
    },
  },
  {
    id: "mkbhd_shorts",
    name: "MKBHD Shorts",
    tagline: "Tech shorts, vertical, tight captions, quick B-roll",
    preview: "bg-gradient-to-br from-red-900 via-slate-800 to-slate-900",
    tags: ["Caption: Clean Vertical", "Grade: Cinematic", "Music: Ambient"],
    config: {
      captions: { enabled: true, autoGenerate: true, preset: "tiktok_bold", fontFamily: "Inter", fontSize: 44, textColor: "#FFFFFF", strokeColor: "#000000", backdropColor: "transparent", strokeWidth: 3, position: "bottom" as const, customY: 75, maxWordsPerLine: 4, emphasizeKeywords: true, autoEmoji: false },
      textAnimation: { enabled: true, preset: "slide_bottom", duration: 0.3, easing: "ease-out" },
      motion: { enabled: true, autoZoomSpeakers: true, preset: "punch_zoom", intensity: 45, autoReframe: true, motionBlur: true },
      transitions: { enabled: true, preset: "cross_zoom", duration: 0.25, autoBetweenCuts: true },
      color: { enabled: true, lut: "cinematic", brightness: 0, contrast: 12, saturation: -3, temperature: -3, tint: 0, highlights: -5, shadows: 5, autoColorMatch: true, autoWhiteBalance: true },
      audio: { enabled: true, autoDucking: true, bgGenre: "ambient", volumeAutomation: true, noiseRemoval: true, voiceEnhance: true, autoBeatSync: true },
      smart: { autoCutSilence: true, silenceThreshold: 0.5, autoReframeRatio: "9:16" as const, removeFillerWords: true, autoChapters: false, smartPacing: true, hookDetector: true, viralMomentFinder: true, autoBroll: true, trendingAudioMatch: false },
      aspect: { preset: "9:16", customW: 9, customH: 16 },
    },
  },
  {
    id: "airrack",
    name: "Airrack",
    tagline: "High energy challenge, bold yellow, fast cuts",
    preview: "bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500",
    tags: ["Caption: Yellow Bold", "Grade: Vibrant", "Music: EDM"],
    config: {
      captions: { enabled: true, autoGenerate: true, preset: "mrbeast", fontFamily: "Impact", fontSize: 72, textColor: "#FFEB3B", strokeColor: "#000000", backdropColor: "transparent", strokeWidth: 5, position: "center" as const, customY: 55, maxWordsPerLine: 3, emphasizeKeywords: true, autoEmoji: true },
      textAnimation: { enabled: true, preset: "bounce", duration: 0.3, easing: "spring" },
      motion: { enabled: true, autoZoomSpeakers: true, preset: "punch_zoom", intensity: 75, autoReframe: true, motionBlur: true },
      transitions: { enabled: true, preset: "whip_left", duration: 0.2, autoBetweenCuts: true },
      color: { enabled: true, lut: "vibrant", brightness: 5, contrast: 15, saturation: 20, temperature: 5, tint: 0, highlights: 0, shadows: 0, autoColorMatch: true, autoWhiteBalance: false },
      audio: { enabled: true, autoDucking: true, bgGenre: "edm", volumeAutomation: true, noiseRemoval: true, voiceEnhance: true, autoBeatSync: true },
      smart: { autoCutSilence: true, silenceThreshold: 0.4, autoReframeRatio: "9:16" as const, removeFillerWords: true, autoChapters: false, smartPacing: true, hookDetector: true, viralMomentFinder: true, autoBroll: true, trendingAudioMatch: true },
      aspect: { preset: "16:9", customW: 16, customH: 9 },
    },
  },
  {
    id: "kurzgesagt",
    name: "Kurzgesagt",
    tagline: "Animated science, bright colors, clean sans-serif captions",
    preview: "bg-gradient-to-br from-sky-400 via-cyan-500 to-blue-600",
    tags: ["Caption: Clean Sans", "Grade: Vibrant", "Music: Upbeat"],
    config: {
      captions: { enabled: true, autoGenerate: true, preset: "youtube_standard", fontFamily: "Inter", fontSize: 30, textColor: "#FFFFFF", strokeColor: "transparent", backdropColor: "rgba(0,0,0,0.5)", strokeWidth: 0, position: "bottom" as const, customY: 82, maxWordsPerLine: 7, emphasizeKeywords: true, autoEmoji: false },
      textAnimation: { enabled: true, preset: "fade_in", duration: 0.5, easing: "ease-out" },
      motion: { enabled: true, autoZoomSpeakers: false, preset: "breathing", intensity: 25, autoReframe: false, motionBlur: false },
      transitions: { enabled: true, preset: "dissolve", duration: 0.35, autoBetweenCuts: true },
      color: { enabled: true, lut: "vibrant", brightness: 5, contrast: 12, saturation: 22, temperature: 3, tint: 0, highlights: 0, shadows: 0, autoColorMatch: true, autoWhiteBalance: true },
      audio: { enabled: true, autoDucking: true, bgGenre: "upbeat", volumeAutomation: true, noiseRemoval: true, voiceEnhance: true, autoBeatSync: false },
      smart: { autoCutSilence: true, silenceThreshold: 1.0, autoReframeRatio: "none" as const, removeFillerWords: true, autoChapters: true, smartPacing: false, hookDetector: true, viralMomentFinder: false, autoBroll: true, trendingAudioMatch: false },
      aspect: { preset: "16:9", customW: 16, customH: 9 },
    },
  },
  {
    id: "jenna_marbles",
    name: "Jenna Marbles Style",
    tagline: "Casual vlog, punchy edits, friendly caption",
    preview: "bg-gradient-to-br from-pink-400 via-rose-500 to-fuchsia-500",
    tags: ["Caption: Friendly", "Grade: Neutral", "Music: Upbeat"],
    config: {
      captions: { enabled: true, autoGenerate: true, preset: "youtube_standard", fontFamily: "Poppins", fontSize: 34, textColor: "#FFFFFF", strokeColor: "#000000", backdropColor: "transparent", strokeWidth: 3, position: "bottom" as const, customY: 80, maxWordsPerLine: 5, emphasizeKeywords: true, autoEmoji: true },
      textAnimation: { enabled: true, preset: "pop", duration: 0.3, easing: "bounce" },
      motion: { enabled: true, autoZoomSpeakers: true, preset: "punch_zoom", intensity: 50, autoReframe: false, motionBlur: false },
      transitions: { enabled: true, preset: "cut", duration: 0.15, autoBetweenCuts: true },
      color: { enabled: true, lut: "neutral", brightness: 3, contrast: 8, saturation: 5, temperature: 2, tint: 0, highlights: 0, shadows: 0, autoColorMatch: true, autoWhiteBalance: true },
      audio: { enabled: true, autoDucking: true, bgGenre: "upbeat", volumeAutomation: true, noiseRemoval: true, voiceEnhance: true, autoBeatSync: false },
      smart: { autoCutSilence: true, silenceThreshold: 0.6, autoReframeRatio: "none" as const, removeFillerWords: true, autoChapters: false, smartPacing: true, hookDetector: true, viralMomentFinder: false, autoBroll: false, trendingAudioMatch: true },
      aspect: { preset: "16:9", customW: 16, customH: 9 },
    },
  },
  {
    id: "smosh",
    name: "Smosh",
    tagline: "Comedy skit, bright colors, meme energy",
    preview: "bg-gradient-to-br from-yellow-500 via-orange-500 to-red-500",
    tags: ["Caption: Meme", "Grade: Vibrant", "Music: Upbeat"],
    config: {
      captions: { enabled: true, autoGenerate: true, preset: "meme_impact", fontFamily: "Impact", fontSize: 60, textColor: "#FFFFFF", strokeColor: "#000000", backdropColor: "transparent", strokeWidth: 4, position: "top" as const, customY: 20, maxWordsPerLine: 4, emphasizeKeywords: true, autoEmoji: true },
      textAnimation: { enabled: true, preset: "pop", duration: 0.3, easing: "spring" },
      motion: { enabled: true, autoZoomSpeakers: false, preset: "crash_zoom", intensity: 70, autoReframe: false, motionBlur: true },
      transitions: { enabled: true, preset: "flash", duration: 0.15, autoBetweenCuts: true },
      color: { enabled: true, lut: "vibrant", brightness: 5, contrast: 15, saturation: 25, temperature: 5, tint: 0, highlights: 0, shadows: 0, autoColorMatch: true, autoWhiteBalance: false },
      audio: { enabled: true, autoDucking: true, bgGenre: "upbeat", volumeAutomation: true, noiseRemoval: true, voiceEnhance: true, autoBeatSync: true },
      smart: { autoCutSilence: true, silenceThreshold: 0.5, autoReframeRatio: "none" as const, removeFillerWords: true, autoChapters: false, smartPacing: true, hookDetector: true, viralMomentFinder: true, autoBroll: false, trendingAudioMatch: true },
      aspect: { preset: "16:9", customW: 16, customH: 9 },
    },
  },
  {
    id: "h3h3",
    name: "H3H3",
    tagline: "Podcast casual, simple cuts, blue accent",
    preview: "bg-gradient-to-br from-blue-500 via-sky-600 to-slate-700",
    tags: ["Caption: Podcast", "Grade: Muted", "Music: Corporate"],
    config: {
      captions: { enabled: true, autoGenerate: true, preset: "podcast_minimal", fontFamily: "Inter", fontSize: 28, textColor: "#FFFFFF", strokeColor: "transparent", backdropColor: "rgba(0,0,0,0.5)", strokeWidth: 0, position: "bottom" as const, customY: 88, maxWordsPerLine: 8, emphasizeKeywords: false, autoEmoji: false },
      textAnimation: { enabled: true, preset: "fade_in", duration: 0.4, easing: "ease-out" },
      motion: { enabled: false, autoZoomSpeakers: true, preset: "breathing", intensity: 12, autoReframe: false, motionBlur: false },
      transitions: { enabled: true, preset: "cut", duration: 0.1, autoBetweenCuts: false },
      color: { enabled: true, lut: "cool", brightness: 0, contrast: 5, saturation: -2, temperature: -5, tint: 0, highlights: 0, shadows: 0, autoColorMatch: true, autoWhiteBalance: true },
      audio: { enabled: true, autoDucking: false, bgGenre: "corporate", volumeAutomation: false, noiseRemoval: true, voiceEnhance: true, autoBeatSync: false },
      smart: { autoCutSilence: false, silenceThreshold: 2.0, autoReframeRatio: "none" as const, removeFillerWords: false, autoChapters: true, smartPacing: false, hookDetector: false, viralMomentFinder: true, autoBroll: false, trendingAudioMatch: false },
      aspect: { preset: "16:9", customW: 16, customH: 9 },
    },
  },
  {
    id: "shane_dawson",
    name: "Shane Dawson",
    tagline: "Investigative vlog, moody grade, dramatic music",
    preview: "bg-gradient-to-br from-slate-900 via-purple-950 to-red-950",
    tags: ["Caption: Cinematic", "Grade: Moody", "Music: Cinematic"],
    config: {
      captions: { enabled: true, autoGenerate: true, preset: "cinematic", fontFamily: "Playfair Display", fontSize: 28, textColor: "#F5F5F5", strokeColor: "transparent", backdropColor: "rgba(0,0,0,0.5)", strokeWidth: 0, position: "bottom" as const, customY: 86, maxWordsPerLine: 7, emphasizeKeywords: false, autoEmoji: false },
      textAnimation: { enabled: true, preset: "fade_in", duration: 0.7, easing: "ease-out" },
      motion: { enabled: true, autoZoomSpeakers: true, preset: "slow_zoom_in", intensity: 35, autoReframe: false, motionBlur: true },
      transitions: { enabled: true, preset: "fade", duration: 0.6, autoBetweenCuts: true },
      color: { enabled: true, lut: "moody", brightness: -8, contrast: 18, saturation: -10, temperature: -8, tint: 0, highlights: -10, shadows: 12, autoColorMatch: true, autoWhiteBalance: false },
      audio: { enabled: true, autoDucking: true, bgGenre: "cinematic", volumeAutomation: true, noiseRemoval: true, voiceEnhance: true, autoBeatSync: false },
      smart: { autoCutSilence: false, silenceThreshold: 1.8, autoReframeRatio: "none" as const, removeFillerWords: false, autoChapters: true, smartPacing: false, hookDetector: true, viralMomentFinder: true, autoBroll: true, trendingAudioMatch: false },
      aspect: { preset: "16:9", customW: 16, customH: 9 },
    },
  },
  {
    id: "mark_rober",
    name: "Mark Rober",
    tagline: "Science experiments, clean visuals, warm lighting",
    preview: "bg-gradient-to-br from-orange-400 via-amber-500 to-red-500",
    tags: ["Caption: Clean", "Grade: Warm", "Music: Upbeat"],
    config: {
      captions: { enabled: true, autoGenerate: true, preset: "youtube_standard", fontFamily: "Inter", fontSize: 32, textColor: "#FFFFFF", strokeColor: "#000000", backdropColor: "transparent", strokeWidth: 2, position: "bottom" as const, customY: 82, maxWordsPerLine: 6, emphasizeKeywords: true, autoEmoji: false },
      textAnimation: { enabled: true, preset: "slide_bottom", duration: 0.35, easing: "ease-out" },
      motion: { enabled: true, autoZoomSpeakers: true, preset: "slow_zoom_in", intensity: 30, autoReframe: false, motionBlur: false },
      transitions: { enabled: true, preset: "fade", duration: 0.3, autoBetweenCuts: true },
      color: { enabled: true, lut: "warm", brightness: 4, contrast: 10, saturation: 10, temperature: 8, tint: 0, highlights: 0, shadows: 3, autoColorMatch: true, autoWhiteBalance: true },
      audio: { enabled: true, autoDucking: true, bgGenre: "upbeat", volumeAutomation: true, noiseRemoval: true, voiceEnhance: true, autoBeatSync: false },
      smart: { autoCutSilence: true, silenceThreshold: 0.8, autoReframeRatio: "none" as const, removeFillerWords: true, autoChapters: true, smartPacing: true, hookDetector: true, viralMomentFinder: false, autoBroll: true, trendingAudioMatch: false },
      aspect: { preset: "16:9", customW: 16, customH: 9 },
    },
  },
  {
    id: "michelle_khare",
    name: "Michelle Khare",
    tagline: "Challenges vlog, warm grade, upbeat music",
    preview: "bg-gradient-to-br from-rose-400 via-orange-400 to-amber-500",
    tags: ["Caption: Vlog", "Grade: Warm", "Music: Upbeat"],
    config: {
      captions: { enabled: true, autoGenerate: true, preset: "youtube_standard", fontFamily: "Montserrat", fontSize: 34, textColor: "#FFFFFF", strokeColor: "#000000", backdropColor: "transparent", strokeWidth: 2, position: "bottom" as const, customY: 80, maxWordsPerLine: 5, emphasizeKeywords: true, autoEmoji: true },
      textAnimation: { enabled: true, preset: "slide_bottom", duration: 0.3, easing: "ease-out" },
      motion: { enabled: true, autoZoomSpeakers: true, preset: "punch_zoom", intensity: 55, autoReframe: false, motionBlur: true },
      transitions: { enabled: true, preset: "whip_right", duration: 0.25, autoBetweenCuts: true },
      color: { enabled: true, lut: "warm", brightness: 4, contrast: 10, saturation: 12, temperature: 7, tint: 0, highlights: 0, shadows: 3, autoColorMatch: true, autoWhiteBalance: true },
      audio: { enabled: true, autoDucking: true, bgGenre: "upbeat", volumeAutomation: true, noiseRemoval: true, voiceEnhance: true, autoBeatSync: true },
      smart: { autoCutSilence: true, silenceThreshold: 0.6, autoReframeRatio: "none" as const, removeFillerWords: true, autoChapters: false, smartPacing: true, hookDetector: true, viralMomentFinder: true, autoBroll: true, trendingAudioMatch: true },
      aspect: { preset: "16:9", customW: 16, customH: 9 },
    },
  },
  {
    id: "five_minute_crafts",
    name: "5-Minute Crafts",
    tagline: "Super fast cuts, bright colors, high contrast",
    preview: "bg-gradient-to-br from-lime-400 via-yellow-500 to-orange-500",
    tags: ["Caption: Bold", "Grade: Vibrant", "Music: Upbeat"],
    config: {
      captions: { enabled: true, autoGenerate: true, preset: "tiktok_bold", fontFamily: "Bebas Neue", fontSize: 52, textColor: "#FFFFFF", strokeColor: "#000000", backdropColor: "transparent", strokeWidth: 4, position: "bottom" as const, customY: 78, maxWordsPerLine: 4, emphasizeKeywords: true, autoEmoji: true },
      textAnimation: { enabled: true, preset: "pop", duration: 0.2, easing: "spring" },
      motion: { enabled: true, autoZoomSpeakers: false, preset: "crash_zoom", intensity: 75, autoReframe: false, motionBlur: true },
      transitions: { enabled: true, preset: "flash", duration: 0.12, autoBetweenCuts: true },
      color: { enabled: true, lut: "vibrant", brightness: 8, contrast: 18, saturation: 25, temperature: 5, tint: 0, highlights: 0, shadows: 0, autoColorMatch: true, autoWhiteBalance: false },
      audio: { enabled: true, autoDucking: true, bgGenre: "upbeat", volumeAutomation: true, noiseRemoval: true, voiceEnhance: true, autoBeatSync: true },
      smart: { autoCutSilence: true, silenceThreshold: 0.3, autoReframeRatio: "9:16" as const, removeFillerWords: true, autoChapters: false, smartPacing: true, hookDetector: true, viralMomentFinder: true, autoBroll: true, trendingAudioMatch: true },
      aspect: { preset: "9:16", customW: 9, customH: 16 },
    },
  },
];

// Default editor settings snapshot — used by the "Custom" reset card
const DEFAULT_EDITOR_SETTINGS_CONFIG = {
  captions: { enabled: false, autoGenerate: true, preset: "tiktok_bold", fontFamily: "Inter", fontSize: 48, textColor: "#FFFFFF", strokeColor: "#000000", backdropColor: "transparent", strokeWidth: 4, position: "bottom" as const, customY: 80, maxWordsPerLine: 4, emphasizeKeywords: false, autoEmoji: false },
  textAnimation: { enabled: false, preset: "fade_in", duration: 0.4, easing: "ease-out" },
  motion: { enabled: false, autoZoomSpeakers: false, preset: "slow_zoom_in", intensity: 50, autoReframe: false, motionBlur: false },
  transitions: { enabled: false, preset: "cut", duration: 0.3, autoBetweenCuts: false },
  color: { enabled: false, lut: "cinematic", brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, highlights: 0, shadows: 0, autoColorMatch: false, autoWhiteBalance: false },
  audio: { enabled: false, autoDucking: false, bgGenre: "upbeat", volumeAutomation: false, noiseRemoval: false, voiceEnhance: false, autoBeatSync: false },
  smart: { autoCutSilence: false, silenceThreshold: 1.5, autoReframeRatio: "none" as const, removeFillerWords: false, autoChapters: false, smartPacing: false, hookDetector: false, viralMomentFinder: false, autoBroll: false, trendingAudioMatch: false },
  aspect: { preset: "9:16", customW: 16, customH: 9 },
};

interface StoryboardScene {
  scene_number: number;
  duration: string;
  visual: string;
  text_overlay: string;
  voiceover: string;
  transition: string;
  camera_movement: string;
  music_note: string;
}

interface VideoResult {
  source: string;
  plan?: string;
  storyboard?: StoryboardScene[];
  url?: string;
  render_id?: string;
  thumbnail_suggestion?: string;
  music_suggestions?: string[];
}

export default function VideoEditorPage() {
  const { profile } = useAuth();
  const { clientId: managedClientId } = useManagedClient();
  const { fetchWithWall } = useQuotaWall();
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<VideoResult | null>(null);
  const [clients, setClients] = useState<Array<{ id: string; business_name: string }>>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const supabase = createClient();

  // ─── Adobe-Premiere-style multi-track timeline state ──────────────
  // Seeded from result.storyboard when one becomes available.
  // Shape is defensive — if nothing exists, we show empty rails.
  const timelineVideoRef = useRef<HTMLVideoElement | null>(null);
  const [timelineProject, setTimelineProject] = useState<TimelineProject>({
    duration: 30000,
    tracks: DEFAULT_TIMELINE_TRACKS,
    clips: [],
  });
  const [timelinePlayhead, setTimelinePlayhead] = useState(0);
  const [timelinePlaying, setTimelinePlaying] = useState(false);
  const lastSeededResultRef = useRef<string | null>(null);

  // ─── Preset Picker sidebar state ─────────────────────────────────────
  const [showPresetPicker, setShowPresetPicker] = useState(false);

  // ─── AI timeline suggestions (ghost markers with accept/reject) ──────
  const [timelineSuggestions, setTimelineSuggestions] = useState<
    Array<{
      id: string;
      timestamp_sec: number;
      type: string;
      payload: Record<string, unknown>;
      confidence: number;
      reasoning: string;
      scene_index?: number;
    }>
  >([]);

  // Drop a preset onto the timeline at the current playhead. Each preset
  // kind maps to a different default track (SFX → A2, music → A1, etc.).
  const handlePresetDrop = (drop: PresetDropPayload) => {
    setTimelineProject((p) => {
      const at = Math.max(0, timelinePlayhead);
      let newClip: TimelineClip | null = null;
      if (drop.kind === "sfx") {
        const dur = Number(drop.payload.duration_ms) || 500;
        newClip = {
          id: `sfx-${drop.id}-${Date.now()}`,
          trackId: "a2",
          start: at,
          duration: dur,
          label: String(drop.payload.name || drop.id).slice(0, 32),
          color: "#F59E0B",
        };
      } else if (drop.kind === "music") {
        const durSec = Number(drop.payload.duration_sec) || 0;
        const durMs = durSec > 0 ? durSec * 1000 : Math.max(p.duration, 10000);
        newClip = {
          id: `mus-${drop.id}-${Date.now()}`,
          trackId: "a1",
          start: at,
          duration: durMs,
          label: String(drop.payload.title || drop.id).slice(0, 32),
          color: "#22C55E",
        };
      } else if (drop.kind === "vfx") {
        newClip = {
          id: `vfx-${drop.id}-${Date.now()}`,
          trackId: "fx",
          start: at,
          duration: 800,
          label: String(drop.payload.name || drop.id).slice(0, 32),
          color: "#EF4444",
          isMarker: true,
        };
      } else if (drop.kind === "transition") {
        const dur = Number(drop.payload.duration_ms) || 400;
        newClip = {
          id: `tr-${drop.id}-${Date.now()}`,
          trackId: "fx",
          start: at,
          duration: dur,
          label: String(drop.payload.name || drop.id).slice(0, 32),
          color: "#EF4444",
          isMarker: true,
        };
      } else if (drop.kind === "broll") {
        const durSec = Number(drop.payload.duration_sec) || 6;
        newClip = {
          id: `br-${drop.id}-${Date.now()}`,
          trackId: "v2",
          start: at,
          duration: durSec * 1000,
          label: String(drop.payload.label || drop.id).slice(0, 32),
          color: "#60A5FA",
          thumbnailUrl:
            typeof drop.payload.thumbnail_url === "string"
              ? (drop.payload.thumbnail_url as string)
              : undefined,
        };
      } else if (drop.kind === "font") {
        // Fonts aren't clips — apply to the selected caption layer instead.
        // Store the font family into CSS variable so caption rendering can
        // pick it up. Silent no-op on the timeline.
        try {
          document.documentElement.style.setProperty(
            "--caption-font-family",
            `"${String(drop.payload.family || "Inter")}"`,
          );
        } catch {
          /* ignore */
        }
        toast.success(`Font applied: ${drop.payload.family}`);
        return p;
      }
      if (!newClip) return p;
      const nextDuration = Math.max(p.duration, newClip.start + newClip.duration);
      toast.success(`Added ${drop.kind} to timeline`);
      return {
        ...p,
        duration: nextDuration,
        clips: [...p.clips, newClip],
      };
    });
  };

  useEffect(() => {
    if (!result) return;
    // Only seed when storyboard first arrives — don't clobber user's manual edits.
    const sig = JSON.stringify({ u: result.url, s: result.storyboard?.length, id: result.render_id });
    if (lastSeededResultRef.current === sig) return;
    lastSeededResultRef.current = sig;

    if (result.storyboard && result.storyboard.length > 0) {
      const next = buildProjectFromStoryboard(result.storyboard);
      setTimelineProject(next);
    } else if (result.url) {
      // No storyboard but we have a rendered MP4 — create a single-clip project.
      const durMs = 30000;
      setTimelineProject({
        duration: durMs,
        tracks: DEFAULT_TIMELINE_TRACKS,
        clips: [
          { id: "main", trackId: "v1", start: 0, duration: durMs, label: "Rendered video", color: "#60A5FA", thumbnailUrl: undefined },
        ],
      });
    }
  }, [result]);

  // Keep the internal "playing" state in sync with the real <video>.
  useEffect(() => {
    const el = timelineVideoRef.current;
    if (!el) return;
    const onPlay = () => setTimelinePlaying(true);
    const onPause = () => setTimelinePlaying(false);
    const onTime = () => setTimelinePlayhead(Math.round(el.currentTime * 1000));
    const onDurChange = () => {
      if (isFinite(el.duration) && el.duration > 0) {
        setTimelineProject((p) => ({ ...p, duration: Math.max(p.duration, Math.round(el.duration * 1000)) }));
      }
    };
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("durationchange", onDurChange);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("durationchange", onDurChange);
    };
  }, [result?.url]);

  const [referenceFiles, setReferenceFiles] = useState<Array<{ name: string; type: string; preview: string; data: string }>>([]);
  const [tab, setTab] = useState<"create" | "storyboard" | "templates" | "assets" | "export">("create");
  const [mode, setMode] = useState<"render" | "plan" | "storyboard">("plan");

  // Guided wizard state
  const [videoWizardOpen, setVideoWizardOpen] = useState(false);
  useEffect(() => {
    try {
      const seen = localStorage.getItem("ss-video-wizard-seen");
      if (!seen) setVideoWizardOpen(true);
    } catch {}
  }, []);

  // Guided Mode ↔ Advanced Mode (full 6-subtab editor)
  const [advancedMode, setAdvancedMode] = useAdvancedMode("video-editor");
  const [guidedStep, setGuidedStep] = useState(0);
  const [guidedFootageSource, setGuidedFootageSource] = useState<"upload" | "record" | "ai">("upload");
  const [config, setConfig] = useState({
    type: "reel",
    title: "",
    script: "",
    style: "modern-dark",
    duration: 30,
    aspect_ratio: "9:16",
    music_mood: "upbeat",
    caption_style: "word_highlight",
    include_voiceover: false,
    include_cta: true,
    cta_text: "",
    brand_colors: "",
    target_platform: "instagram",
  });

  // --- New feature states ---
  const [createSubTab, setCreateSubTab] = useState<"editor" | "scene-builder" | "ai-script" | "audio-mixer" | "advanced" | "smart">("editor");
  // Left-panel tab (replaces the wall of accordions in the editor sub-tab).
  // Style  → caption/effects/SFX/music libraries + visual style
  // Brand  → brand kit + color palette
  // AI     → Claude-driven actions (auto-edit, classify, analyze viral)
  // Assets → references / uploads / project details
  const [editorLeftTab, setEditorLeftTab] = useState<"style" | "brand" | "ai" | "assets">("style");

  // Classify-footage wiring — maps reference-file index → detected footage type + confidence.
  const [footageBadges, setFootageBadges] = useState<Record<number, { footage_type: FootageType; confidence: number; recommended_creator_pack_id?: string } | null>>({});
  const [classifyingIdx, setClassifyingIdx] = useState<number | null>(null);

  // Viral-analysis wiring — one-shot analyze of a pasted URL.
  const [viralUrl, setViralUrl] = useState("");
  const [viralAnalyzing, setViralAnalyzing] = useState(false);
  const [viralResult, setViralResult] = useState<Record<string, unknown> | null>(null);

  // One-click auto-edit (full-pass) state.
  const [fullPassRunning, setFullPassRunning] = useState(false);
  const [sceneBuilderScenes, setSceneBuilderScenes] = useState<Array<{ id: string; name: string; duration: number; description: string }>>([
    { id: "s1", name: "Hook / Intro", duration: 3, description: "Attention-grabbing opening" },
    { id: "s2", name: "Main Content", duration: 15, description: "Core message delivery" },
    { id: "s3", name: "CTA / Outro", duration: 5, description: "Call to action and close" },
  ]);
  const [draggedScene, setDraggedScene] = useState<string | null>(null);
  const [aiScriptInput, setAiScriptInput] = useState("");
  const [aiScriptScenes, setAiScriptScenes] = useState<Array<{ text: string; suggestedStyle: string; duration: number }>>([]);
  const [selectedBrandKit, setSelectedBrandKit] = useState("");
  const [brandKits] = useState([
    { id: "bk1", name: "Default Brand", colors: ["#C9A84C", "#1a1a1a", "#ffffff"], font: "Inter", logo: "logo.png" },
  ]);
  const [selectedMotionGraphics, setSelectedMotionGraphics] = useState<string[]>([]);
  const [motionGraphicsCategory, setMotionGraphicsCategory] = useState("lower-thirds");
  const [audioLayers, setAudioLayers] = useState({
    bgMusic: { enabled: true, volume: 60, track: "upbeat-corporate" },
    voiceover: { enabled: false, volume: 85, track: "" },
    sfx: { enabled: true, volume: 40, track: "whoosh-transitions" },
  });
  const [subtitlePreview, setSubtitlePreview] = useState({
    position: "bottom" as "top" | "center" | "bottom",
    font: "Inter",
    size: "medium" as "small" | "medium" | "large",
    animation: "word_highlight",
    bgOpacity: 60,
  });
  const [aspectRatioConverter, setAspectRatioConverter] = useState({
    from: "16:9",
    to: "9:16",
    cropMode: "smart" as "smart" | "center" | "top" | "bottom",
  });
  const [colorGrading, setColorGrading] = useState("none");
  const [exportSettings, setExportSettings] = useState({
    resolution: "1080p" as "720p" | "1080p" | "4k",
    bitrate: "high" as "low" | "medium" | "high",
    format: "mp4" as "mp4" | "webm" | "mov",
    fps: 30,
  });
  const [collabNotes, setCollabNotes] = useState<Array<{ time: string; note: string; author: string }>>([]);
  const [newNote, setNewNote] = useState({ time: "0:00", note: "" });
  const [voiceoverConfig, setVoiceoverConfig] = useState({
    voice: "nova",
    script: "",
    speed: 1.0,
    generating: false,
  });
  const [greenScreenBg, setGreenScreenBg] = useState("none");
  const [speedControl, setSpeedControl] = useState<Record<string, number>>({});
  const [selectedTextAnimation, setSelectedTextAnimation] = useState("fade_in");
  const [watermarkSettings, setWatermarkSettings] = useState({
    enabled: false,
    text: "",
    position: "bottom-right" as "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center",
    opacity: 50,
    size: "small" as "small" | "medium" | "large",
  });
  const [batchQueue, setBatchQueue] = useState<Array<{ id: string; title: string; status: "queued" | "rendering" | "done" | "failed"; progress: number }>>([]);
  // --- New upgrade: consolidated editor settings for new preset/toggle panels ---
  type EditorSettings = {
    captions: {
      enabled: boolean;
      autoGenerate: boolean;
      preset: string;
      fontFamily: string;
      fontSize: number;
      textColor: string;
      strokeColor: string;
      backdropColor: string;
      strokeWidth: number;
      position: "top" | "center" | "bottom" | "custom";
      customY: number;
      maxWordsPerLine: number;
      emphasizeKeywords: boolean;
      autoEmoji: boolean;
    };
    textAnimation: {
      enabled: boolean;
      preset: string;
      duration: number;
      easing: string;
    };
    motion: {
      enabled: boolean;
      autoZoomSpeakers: boolean;
      preset: string;
      intensity: number;
      autoReframe: boolean;
      motionBlur: boolean;
    };
    transitions: {
      enabled: boolean;
      preset: string;
      duration: number;
      autoBetweenCuts: boolean;
    };
    color: {
      enabled: boolean;
      lut: string;
      brightness: number;
      contrast: number;
      saturation: number;
      temperature: number;
      tint: number;
      highlights: number;
      shadows: number;
      autoColorMatch: boolean;
      autoWhiteBalance: boolean;
    };
    audio: {
      enabled: boolean;
      autoDucking: boolean;
      bgGenre: string;
      volumeAutomation: boolean;
      noiseRemoval: boolean;
      voiceEnhance: boolean;
      autoBeatSync: boolean;
    };
    smart: {
      autoCutSilence: boolean;
      silenceThreshold: number;
      autoReframeRatio: "9:16" | "1:1" | "16:9" | "none";
      removeFillerWords: boolean;
      autoChapters: boolean;
      smartPacing: boolean;
      hookDetector: boolean;
      viralMomentFinder: boolean;
      autoBroll: boolean;
      trendingAudioMatch: boolean;
    };
    aspect: {
      preset: string;
      customW: number;
      customH: number;
    };
    overlays: {
      enabled: boolean;
      selected: string[];
    };
    platformExport: string;
    effects: {
      active: string[];
      intensity: Record<string, number>;
    };
    voice: {
      enabled: boolean;
      preset: string;
      pitch: number;
      speed: number;
      emphasis: number;
      pauseLength: number;
      cloneSampleUrl: string;
    };
    broll: {
      enabled: boolean;
      aiMatch: boolean;
      selectedClips: string[];
      searchQuery: string;
      activeCategory: string;
    };
    timeline: {
      multiTrack: boolean;
      keyframes: boolean;
      sceneEditing: boolean;
      audioDucking: number;
      syncToBeat: boolean;
    };
    exportAdvanced: {
      format: string;
      quality: string;
    };
  };

  const [editorSettings, setEditorSettings] = useState<EditorSettings>({
    captions: {
      enabled: false,
      autoGenerate: true,
      preset: "tiktok_bold",
      fontFamily: "Inter",
      fontSize: 48,
      textColor: "#FFFFFF",
      strokeColor: "#000000",
      backdropColor: "transparent",
      strokeWidth: 4,
      position: "bottom",
      customY: 80,
      maxWordsPerLine: 4,
      emphasizeKeywords: false,
      autoEmoji: false,
    },
    textAnimation: {
      enabled: false,
      preset: "fade_in",
      duration: 0.4,
      easing: "ease-out",
    },
    motion: {
      enabled: false,
      autoZoomSpeakers: false,
      preset: "slow_zoom_in",
      intensity: 50,
      autoReframe: false,
      motionBlur: false,
    },
    transitions: {
      enabled: false,
      preset: "cut",
      duration: 0.3,
      autoBetweenCuts: false,
    },
    color: {
      enabled: false,
      lut: "cinematic",
      brightness: 0,
      contrast: 0,
      saturation: 0,
      temperature: 0,
      tint: 0,
      highlights: 0,
      shadows: 0,
      autoColorMatch: false,
      autoWhiteBalance: false,
    },
    audio: {
      enabled: false,
      autoDucking: false,
      bgGenre: "upbeat",
      volumeAutomation: false,
      noiseRemoval: false,
      voiceEnhance: false,
      autoBeatSync: false,
    },
    smart: {
      autoCutSilence: false,
      silenceThreshold: 1.5,
      autoReframeRatio: "none",
      removeFillerWords: false,
      autoChapters: false,
      smartPacing: false,
      hookDetector: false,
      viralMomentFinder: false,
      autoBroll: false,
      trendingAudioMatch: false,
    },
    aspect: {
      preset: "9:16",
      customW: 16,
      customH: 9,
    },
    overlays: {
      enabled: false,
      selected: [],
    },
    platformExport: "",
    effects: {
      active: [],
      intensity: {},
    },
    voice: {
      enabled: false,
      preset: "",
      pitch: 0,
      speed: 1.0,
      emphasis: 50,
      pauseLength: 50,
      cloneSampleUrl: "",
    },
    broll: {
      enabled: false,
      aiMatch: false,
      selectedClips: [],
      searchQuery: "",
      activeCategory: "nature",
    },
    timeline: {
      multiTrack: false,
      keyframes: false,
      sceneEditing: false,
      audioDucking: 40,
      syncToBeat: false,
    },
    exportAdvanced: {
      format: "h264",
      quality: "1080p_yt",
    },
  });

  // Collapsible panel open-state (each panel can be folded)
  const [openPanels, setOpenPanels] = useState<Record<string, boolean>>({
    youtuberStyles: true,
    adsPack: true,
    captions: true,
    textAnimation: false,
    motion: false,
    transitions: false,
    color: false,
    audio: false,
    smart: true,
    aspect: false,
    overlays: false,
    platformExport: false,
    // New panels
    effects: false,
    voice: false,
    broll: false,
    advancedTimeline: false,
  });

  // Effect-category filter state for Effects Library panel
  const [effectCategoryFilter, setEffectCategoryFilter] = useState<string>("All");

  // ── Asset-catalog selections (caption style / effects / SFX / music) ──
  // These pass through to the AI script generator / GPU render request.
  const [selectedCaptionStyleId, setSelectedCaptionStyleId] = useState<string>("");
  const [captionStyleFilter, setCaptionStyleFilter] = useState<CaptionBestFor | "all">("all");
  const [selectedEffectIds, setSelectedEffectIds] = useState<string[]>([]);
  const [effectsCategoryTab, setEffectsCategoryTab] = useState<EffectCategory | "all">("all");
  const [selectedSfxIds, setSelectedSfxIds] = useState<string[]>([]);
  const [sfxCategoryTab, setSfxCategoryTab] = useState<SfxCategory | "all">("all");
  const [selectedMusicId, setSelectedMusicId] = useState<string>("");
  const [musicMoodFilter, setMusicMoodFilter] = useState<string>("all");
  const [musicBpmFilter, setMusicBpmFilter] = useState<string>("all"); // "all" | "slow" | "medium" | "fast"

  // Collapsible panels for the new asset sections
  const [openAssetPanels, setOpenAssetPanels] = useState<Record<string, boolean>>({
    captionStyle: true,
    effectsTransitions: false,
    sfxPalette: false,
    music: false,
  });
  const toggleAssetPanel = (k: string) => setOpenAssetPanels((p) => ({ ...p, [k]: !p[k] }));

  // Voice preview state
  const [voiceScriptPreview, setVoiceScriptPreview] = useState<string>("");
  const [voicePreviewLoading, setVoicePreviewLoading] = useState<boolean>(false);
  const voiceSampleInputRef = useRef<HTMLInputElement | null>(null);

  // B-roll search state
  const brollFileInputRef = useRef<HTMLInputElement | null>(null);

  // YouTuber-style preset selection state (for UI highlight only)
  const [selectedYouTuberPreset, setSelectedYouTuberPreset] = useState<string>("");

  // Step-by-step creation walkthrough state
  const [walkthroughEnabled, setWalkthroughEnabled] = useState(true);
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);
  const [walkthroughStepIndex, setWalkthroughStepIndex] = useState(0);
  const [walkthroughStatus, setWalkthroughStatus] = useState<WalkthroughStepStatus>("pending");
  const walkthroughCancelledRef = useRef(false);

  // ── AI Project Generator state (Task 2A) ──
  const [aiGenOpen, setAiGenOpen] = useState(false);
  const [aiGenLoading, setAiGenLoading] = useState(false);
  const [aiGenTopic, setAiGenTopic] = useState("");
  const [aiGenDuration, setAiGenDuration] = useState(60);
  const [aiGenStyle, setAiGenStyle] = useState<string>("");
  const [aiGenAudience, setAiGenAudience] = useState("");
  // Generated project data
  const [aiProject, setAiProject] = useState<AiProjectData | null>(null);

  // ── Reference video analyzer state (Task 2B) ──
  const [refAnalyzing, setRefAnalyzing] = useState(false);
  const [refAnalysis, setRefAnalysis] = useState<Record<string, unknown> | null>(null);
  const [refAnalysisOpen, setRefAnalysisOpen] = useState(false);

  // ── Ads pack state (script-to-ad, kinetic captions, b-roll, music) ──
  const [adsPresetActive, setAdsPresetActive] = useState(false);
  const [adsGenOpen, setAdsGenOpen] = useState(false);
  const [adsGenLoading, setAdsGenLoading] = useState(false);
  const [adsGenDescription, setAdsGenDescription] = useState("");
  const [adsGenDuration, setAdsGenDuration] = useState(30);
  const [adsResult, setAdsResult] = useState<{
    video_id: string;
    script: { hook: string; benefits: string[]; cta: string; full_script: string; suggested_mood: string };
    broll: Array<{ time_range: [number, number]; description: string; search_terms: string[]; priority: string; pexels_video_url?: string }>;
    music: { id: string; title: string; mood: string; bpm: number; duration_sec: number; url: string };
    edit_url: string;
  } | null>(null);

  const [brollSuggestLoading, setBrollSuggestLoading] = useState(false);
  const [brollSuggestions, setBrollSuggestions] = useState<
    Array<{ time_range: [number, number]; description: string; search_terms: string[]; priority: string; pexels_video_url?: string }>
  >([]);

  const [musicMatchLoading, setMusicMatchLoading] = useState(false);
  const [musicMatch, setMusicMatch] = useState<{
    id: string;
    title: string;
    mood: string;
    bpm: number;
    duration_sec: number;
    url: string;
    source?: string;
  } | null>(null);

  const [captionsLoading, setCaptionsLoading] = useState(false);
  const [captionsResult, setCaptionsResult] = useState<{
    caption_id: string;
    style: "kinetic" | "classic" | "highlight";
    words: Array<{ text: string; start_ms: number; end_ms: number; emphasis?: boolean }>;
    duration_ms: number;
  } | null>(null);
  const [captionsStyle, setCaptionsStyle] = useState<"kinetic" | "classic" | "highlight">("kinetic");
  const [captionsVideoUrl, setCaptionsVideoUrl] = useState("");

  const togglePanel = (id: string) =>
    setOpenPanels(prev => ({ ...prev, [id]: !prev[id] }));

  function applyYouTuberPreset(preset: typeof YOUTUBER_PRESETS[number]) {
    const cfg = preset.config;
    setEditorSettings(prev => ({
      ...prev,
      captions: { ...prev.captions, ...cfg.captions },
      textAnimation: { ...prev.textAnimation, ...cfg.textAnimation },
      motion: { ...prev.motion, ...cfg.motion },
      transitions: { ...prev.transitions, ...cfg.transitions },
      color: { ...prev.color, ...cfg.color },
      audio: { ...prev.audio, ...cfg.audio },
      smart: { ...prev.smart, ...cfg.smart },
      aspect: { ...prev.aspect, ...cfg.aspect },
    }));
    setConfig(prev => ({ ...prev, aspect_ratio: cfg.aspect.preset }));
    setSelectedYouTuberPreset(preset.id);
    toast.success(`Applied ${preset.name} style preset`);
  }

  function resetYouTuberPreset() {
    const d = DEFAULT_EDITOR_SETTINGS_CONFIG;
    setEditorSettings(prev => ({
      ...prev,
      captions: { ...prev.captions, ...d.captions },
      textAnimation: { ...prev.textAnimation, ...d.textAnimation },
      motion: { ...prev.motion, ...d.motion },
      transitions: { ...prev.transitions, ...d.transitions },
      color: { ...prev.color, ...d.color },
      audio: { ...prev.audio, ...d.audio },
      smart: { ...prev.smart, ...d.smart },
      aspect: { ...prev.aspect, ...d.aspect },
    }));
    setSelectedYouTuberPreset("");
    toast.success("Reset to custom (defaults)");
  }

  function applyAdsPreset() {
    const patch = ADS_PRESET.editor_settings_patch;
    setEditorSettings(prev => ({
      ...prev,
      captions: { ...prev.captions, ...patch.captions } as typeof prev.captions,
      textAnimation: { ...prev.textAnimation, ...patch.textAnimation } as typeof prev.textAnimation,
      motion: { ...prev.motion, ...patch.motion } as typeof prev.motion,
      transitions: { ...prev.transitions, ...patch.transitions } as typeof prev.transitions,
      color: { ...prev.color, ...patch.color } as typeof prev.color,
      audio: { ...prev.audio, ...patch.audio } as typeof prev.audio,
      smart: { ...prev.smart, ...patch.smart } as typeof prev.smart,
      aspect: { ...prev.aspect, ...patch.aspect } as typeof prev.aspect,
    }));
    setConfig(prev => ({
      ...prev,
      aspect_ratio: ADS_PRESET.aspect_ratio,
      duration: ADS_PRESET.default_duration,
      type: "ad",
      style: "bold-gradient",
      music_mood: ADS_PRESET.music_mood_filters[0],
    }));
    setSelectedYouTuberPreset("");
    setAdsPresetActive(true);
    toast.success(`Applied "${ADS_PRESET.name}" preset — bold type, hard cuts, kinetic captions`);
  }

  async function runScriptToAd() {
    const desc = adsGenDescription.trim();
    if (!desc) { toast.error("Paste a product description first"); return; }
    setAdsGenLoading(true);
    setAdsResult(null);
    try {
      const res = await fetch("/api/video/script-to-ad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_description: desc,
          duration: adsGenDuration,
          client_id: selectedClient || managedClientId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setAdsResult(data);
      // Populate editor with generated script
      setConfig(prev => ({
        ...prev,
        title: `Ad: ${desc.slice(0, 60)}`,
        script: data.script?.full_script || "",
        type: "ad",
        duration: adsGenDuration,
        aspect_ratio: ADS_PRESET.aspect_ratio,
        music_mood: data.script?.suggested_mood || "upbeat",
        cta_text: data.script?.cta || prev.cta_text,
      }));
      applyAdsPreset();
      setBrollSuggestions(Array.isArray(data.broll) ? data.broll : []);
      if (data.music) setMusicMatch(data.music);
      toast.success("Ad generated — script, B-roll, and music loaded");
      setAdsGenOpen(false);
    } catch (err) {
      console.error("[script-to-ad] failed", err);
      toast.error(err instanceof Error ? err.message : "Failed to generate ad");
    } finally {
      setAdsGenLoading(false);
    }
  }

  async function suggestBrollForScript() {
    const script = (config.script || "").trim();
    if (!script) { toast.error("Write a script first"); return; }
    setBrollSuggestLoading(true);
    try {
      const res = await fetch("/api/video/b-roll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script,
          count: 5,
          client_id: selectedClient || managedClientId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setBrollSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      toast.success(`${data.suggestions?.length || 0} B-roll moments suggested`);
    } catch (err) {
      console.error("[b-roll] failed", err);
      toast.error(err instanceof Error ? err.message : "Failed to suggest B-roll");
    } finally {
      setBrollSuggestLoading(false);
    }
  }

  async function matchMusicForScript() {
    setMusicMatchLoading(true);
    try {
      const res = await fetch("/api/video/music-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script_mood: config.music_mood || "upbeat",
          duration: config.duration || 30,
          preset: adsPresetActive ? "ads" : undefined,
          script: (config.script || "").slice(0, 1000),
          client_id: selectedClient || managedClientId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      if (data.track) setMusicMatch({ ...data.track, source: data.source });
      toast.success(`Matched music: ${data.track?.title || "track"}`);
    } catch (err) {
      console.error("[music-match] failed", err);
      toast.error(err instanceof Error ? err.message : "Failed to match music");
    } finally {
      setMusicMatchLoading(false);
    }
  }

  async function generateKineticCaptions(videoUrlOverride?: string) {
    const url = (videoUrlOverride || captionsVideoUrl || result?.url || "").trim();
    if (!url) { toast.error("Need a video URL (render the video first, or paste one)"); return; }
    setCaptionsLoading(true);
    setCaptionsResult(null);
    try {
      const res = await fetch("/api/captions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_url: url,
          style: captionsStyle,
          language: "en",
          client_id: selectedClient || managedClientId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setCaptionsResult({
        caption_id: data.caption_id,
        style: data.style,
        words: data.words,
        duration_ms: data.duration_ms,
      });
      toast.success(`${data.words?.length || 0} caption words generated (${data.style})`);
    } catch (err) {
      console.error("[captions/generate] failed", err);
      toast.error(err instanceof Error ? err.message : "Failed to generate captions");
    } finally {
      setCaptionsLoading(false);
    }
  }

  function applyPlatformExportPreset(presetId: string) {
    const p = PLATFORM_EXPORT_PRESETS.find(x => x.id === presetId);
    if (!p) return;
    setEditorSettings(prev => ({
      ...prev,
      platformExport: presetId,
      aspect: { ...prev.aspect, preset: p.aspect },
      captions: { ...prev.captions, enabled: p.captions },
    }));
    setConfig(prev => ({
      ...prev,
      aspect_ratio: p.aspect,
      duration: Math.min(prev.duration, p.maxDur),
      target_platform: p.id === "reels" ? "instagram" : p.id === "shorts" ? "youtube" : p.id === "yt_long" ? "youtube" : p.id === "linkedin" ? "linkedin" : p.id === "twitter" ? "twitter" : p.id === "facebook" ? "facebook" : "tiktok",
    }));
    toast.success(`${p.name} preset applied`);
  }

  function handleSceneDragStart(sceneId: string) {
    setDraggedScene(sceneId);
  }

  function handleSceneDrop(targetId: string) {
    if (!draggedScene || draggedScene === targetId) return;
    setSceneBuilderScenes(prev => {
      const items = [...prev];
      const dragIdx = items.findIndex(s => s.id === draggedScene);
      const dropIdx = items.findIndex(s => s.id === targetId);
      const [removed] = items.splice(dragIdx, 1);
      items.splice(dropIdx, 0, removed);
      return items;
    });
    setDraggedScene(null);
  }

  function splitScriptToScenes() {
    if (!aiScriptInput.trim()) { toast.error("Paste a script first"); return; }
    const sentences = aiScriptInput.split(/[.!?]+/).filter(s => s.trim());
    const scenesPerGroup = Math.max(1, Math.ceil(sentences.length / 5));
    const scenes: typeof aiScriptScenes = [];
    for (let i = 0; i < sentences.length; i += scenesPerGroup) {
      const chunk = sentences.slice(i, i + scenesPerGroup).join(". ").trim();
      if (chunk) {
        scenes.push({
          text: chunk + ".",
          suggestedStyle: STYLES[Math.floor(Math.random() * STYLES.length)].name,
          duration: Math.max(3, Math.round(chunk.split(" ").length / 3)),
        });
      }
    }
    setAiScriptScenes(scenes);
    toast.success(`Script split into ${scenes.length} scenes`);
  }

  function addSceneToBuilder() {
    const id = `s${Date.now()}`;
    setSceneBuilderScenes(prev => [...prev, { id, name: `Scene ${prev.length + 1}`, duration: 5, description: "New scene" }]);
  }

  function removeScene(id: string) {
    setSceneBuilderScenes(prev => prev.filter(s => s.id !== id));
  }

  function addCollabNote() {
    if (!newNote.note.trim()) return;
    setCollabNotes(prev => [...prev, { time: newNote.time, note: newNote.note, author: profile?.full_name || "You" }]);
    setNewNote({ time: "0:00", note: "" });
    toast.success("Note added");
  }

  function addToBatchQueue() {
    if (!config.title) { toast.error("Enter a title first"); return; }
    setBatchQueue(prev => [...prev, { id: `bq${Date.now()}`, title: config.title, status: "queued", progress: 0 }]);
    toast.success("Added to render queue");
  }

  // ── Effects Library helpers ──
  function toggleEffect(effectId: string) {
    setEditorSettings(prev => {
      const isActive = prev.effects.active.includes(effectId);
      const nextActive = isActive
        ? prev.effects.active.filter(id => id !== effectId)
        : [...prev.effects.active, effectId];
      // set default intensity to 50 when newly enabled
      const nextIntensity = { ...prev.effects.intensity };
      if (!isActive && nextIntensity[effectId] === undefined) {
        nextIntensity[effectId] = 50;
      }
      return {
        ...prev,
        effects: {
          active: nextActive,
          intensity: nextIntensity,
        },
      };
    });
  }

  function setEffectIntensity(effectId: string, value: number) {
    setEditorSettings(prev => ({
      ...prev,
      effects: {
        ...prev.effects,
        intensity: { ...prev.effects.intensity, [effectId]: value },
      },
    }));
  }

  function clearAllEffects() {
    setEditorSettings(prev => ({
      ...prev,
      effects: { active: [], intensity: {} },
    }));
    toast.success("Effects cleared");
  }

  // ── Voice panel helpers ──
  function selectVoicePreset(voiceId: string) {
    setEditorSettings(prev => ({
      ...prev,
      voice: { ...prev.voice, enabled: true, preset: voiceId },
    }));
    toast.success(`Voice preset applied: ${VOICE_PRESETS.find(v => v.id === voiceId)?.name || voiceId}`);
  }

  function handleVoiceSampleUpload(files: File[]) {
    const audioFiles = files.filter(f => f.type.startsWith("audio/"));
    if (audioFiles.length === 0) {
      toast.error("Please upload audio file(s)");
      return;
    }
    // Keep the first as the primary cloneSampleUrl (for backward compat with
    // the single-string voice.cloneSampleUrl field) and just surface a count
    // toast so the user sees that all files were accepted for the clone job.
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setEditorSettings(prev => ({
        ...prev,
        voice: { ...prev.voice, cloneSampleUrl: base64 },
      }));
      toast.success(
        audioFiles.length > 1
          ? `${audioFiles.length} voice samples uploaded — ready to clone`
          : "Voice sample uploaded — ready to clone",
      );
    };
    reader.readAsDataURL(audioFiles[0]);
  }

  async function previewVoiceScript() {
    if (!voiceScriptPreview.trim()) {
      toast.error("Type some text to preview");
      return;
    }
    if (!editorSettings.voice.preset) {
      toast.error("Select a voice preset first");
      return;
    }
    setVoicePreviewLoading(true);
    try {
      const res = await fetch("/api/ai/voice-clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: voiceScriptPreview,
          voice: editorSettings.voice.preset,
          pitch: editorSettings.voice.pitch,
          speed: editorSettings.voice.speed,
        }),
      });
      if (!res.ok) {
        toast.error("Voice preview backend pending — endpoint not ready");
      } else {
        toast.success("Voice preview ready");
      }
    } catch (err) {
      console.error("[video-editor] Voice preview error:", err);
      toast.error("Voice preview endpoint not yet wired");
    } finally {
      setVoicePreviewLoading(false);
    }
  }

  // ── B-Roll helpers ──
  function toggleBrollClip(clipId: string) {
    setEditorSettings(prev => ({
      ...prev,
      broll: {
        ...prev.broll,
        selectedClips: prev.broll.selectedClips.includes(clipId)
          ? prev.broll.selectedClips.filter(id => id !== clipId)
          : [...prev.broll.selectedClips, clipId],
      },
    }));
  }

  function handleBrollUpload(files: File[]) {
    const videoFiles = files.filter(f => f.type.startsWith("video/"));
    if (videoFiles.length === 0) {
      toast.error("Please upload video file(s)");
      return;
    }
    videoFiles.forEach(() => {
      const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      toggleBrollClip(id);
    });
    toast.success(
      videoFiles.length > 1
        ? `${videoFiles.length} B-roll clips uploaded`
        : `B-roll uploaded: ${videoFiles[0].name}`,
    );
  }

  function openThumbnailEditor() {
    // Navigate to thumbnail editor (best-effort, falls back to in-app route)
    if (typeof window !== "undefined") {
      window.open("/dashboard/thumbnail-editor", "_blank");
    }
    toast.success("Opening thumbnail editor...");
  }

  useEffect(() => {
    supabase.from("clients").select("id, business_name").eq("is_active", true).then(({ data }: { data: { id: string; business_name: string }[] | null }) => setClients(data || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-select managed client
  useEffect(() => {
    if (managedClientId && clients.length > 0) {
      setSelectedClient(managedClientId);
    }
  }, [managedClientId, clients]);

  const maxRefFile = getMaxReferenceFile(profile?.plan_tier);
  const maxRefLabel = formatBytes(maxRefFile);

  function handleFileUpload(files: File[]) {
    const remaining = 5 - referenceFiles.length;
    if (remaining <= 0) { toast.error("Max 5 files"); return; }
    const toProcess = files.slice(0, remaining);
    toProcess.forEach(file => {
      if (file.size > maxRefFile) {
        toast.error(`${file.name} is too large (max ${maxRefLabel})`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setReferenceFiles(prev => [...prev, {
          name: file.name,
          type: file.type,
          preview: file.type.startsWith("image/") ? base64 : "",
          data: base64,
        }]);
      };
      reader.readAsDataURL(file);
    });
  }

  function selectType(type: typeof VIDEO_TYPES[0]) {
    setConfig(prev => ({ ...prev, type: type.id, aspect_ratio: type.aspect, duration: type.duration }));
  }

  const [renderProgress, setRenderProgress] = useState(0);

  // Walkthrough step definitions (computed fresh per render from current settings)
  const walkthroughSteps: WalkthroughStep[] = [
    {
      id: "analyze",
      title: "Analyzing Your Content",
      description: "Claude generates the script + hook + scene breakdown",
      progressText: "Calling /api/video/script-generate",
      preview: (
        <div className="space-y-1.5">
          <div className="text-[11px] text-muted">Detected</div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div><span className="text-muted">Title:</span> <span className="text-foreground">{config.title || "(none)"}</span></div>
            <div><span className="text-muted">Type:</span> <span className="text-foreground">{config.type}</span></div>
            <div><span className="text-muted">Aspect:</span> <span className="text-foreground">{config.aspect_ratio}</span></div>
            <div><span className="text-muted">Duration:</span> <span className="text-foreground">{config.duration}s</span></div>
            <div><span className="text-muted">Platform:</span> <span className="text-foreground">{config.target_platform}</span></div>
            <div><span className="text-muted">Ref files:</span> <span className="text-foreground">{referenceFiles.length}</span></div>
          </div>
          {aiProject?.hook && (
            <div className="pt-2 border-t border-border mt-2">
              <div className="text-[9px] text-muted uppercase tracking-wider mb-0.5">Hook</div>
              <div className="text-xs text-foreground italic">&ldquo;{aiProject.hook}&rdquo;</div>
            </div>
          )}
          {Array.isArray(aiProject?.scenes) && (aiProject.scenes?.length ?? 0) > 0 && (
            <div className="text-[10px] text-muted">Scenes: {aiProject.scenes?.length}</div>
          )}
        </div>
      ),
    },
    {
      id: "style",
      title: "Selecting Visual Style",
      description: "Applying the style preset that matches your niche",
      progressText: "Matching a creator preset",
      preview: (() => {
        const p = YOUTUBER_PRESETS.find(x => x.id === selectedYouTuberPreset);
        return p ? (
          <div className="flex items-center gap-3">
            <div className={`w-14 h-14 rounded-xl ${p.preview}`} />
            <div>
              <div className="text-xs font-semibold">{p.name}</div>
              <div className="text-[10px] text-muted mt-0.5">{p.tagline}</div>
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-muted">No preset selected — using custom settings.</div>
        );
      })(),
      editableSettings: [
        {
          key: "style",
          label: "Style Preset",
          type: "select",
          value: selectedYouTuberPreset || "",
          options: [
            { label: "Custom (no preset)", value: "" },
            ...YOUTUBER_PRESETS.map(p => ({ label: p.name, value: p.id })),
          ],
        },
      ],
      onSettingChange: (key, value) => {
        if (key === "style") {
          const v = String(value);
          if (!v) {
            resetYouTuberPreset();
          } else {
            const p = YOUTUBER_PRESETS.find(x => x.id === v);
            if (p) applyYouTuberPreset(p);
          }
        }
      },
    },
    {
      id: "captions",
      title: "Generating Captions",
      description: "Claude splits the script into timed captions",
      progressText: "Calling /api/video/captions-generate",
      preview: (
        <div className="space-y-2">
          <div className="text-[10px] text-muted">Sample</div>
          <div
            className="rounded-lg p-4 text-center"
            style={{
              color: editorSettings.captions.textColor,
              fontFamily: editorSettings.captions.fontFamily,
              fontSize: Math.min(editorSettings.captions.fontSize, 36),
              WebkitTextStroke: `${Math.min(editorSettings.captions.strokeWidth, 3)}px ${editorSettings.captions.strokeColor}`,
              background: editorSettings.captions.backdropColor === "transparent" ? "rgba(0,0,0,0.4)" : editorSettings.captions.backdropColor,
              fontWeight: 700,
            }}
          >
            {aiProject?.captions?.[0]?.text || "This is your caption style"}
          </div>
          <div className="text-[10px] text-muted">
            {editorSettings.captions.fontFamily} · {editorSettings.captions.fontSize}px · {editorSettings.captions.position}
          </div>
          {Array.isArray(aiProject?.captions) && (aiProject.captions?.length ?? 0) > 0 && (
            <div className="text-[10px] text-muted space-y-0.5 max-h-24 overflow-y-auto pt-1">
              <div className="font-semibold text-foreground">Generated ({aiProject.captions?.length}):</div>
              {aiProject.captions?.slice(0, 6).map((c, i) => (
                <div key={i}>
                  <span className={c.emphasis ? "font-bold text-gold" : ""}>{c.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
      editableSettings: [
        { key: "fontSize", label: "Font Size", type: "slider", value: editorSettings.captions.fontSize, min: 20, max: 120 },
        { key: "textColor", label: "Text Color", type: "color", value: editorSettings.captions.textColor },
        { key: "strokeColor", label: "Stroke Color", type: "color", value: editorSettings.captions.strokeColor },
        { key: "strokeWidth", label: "Stroke Width", type: "slider", value: editorSettings.captions.strokeWidth, min: 0, max: 12 },
        {
          key: "position",
          label: "Position",
          type: "select",
          value: editorSettings.captions.position,
          options: [
            { label: "Top", value: "top" },
            { label: "Center", value: "center" },
            { label: "Bottom", value: "bottom" },
          ],
        },
      ],
      onSettingChange: (key, value) => {
        setEditorSettings(prev => ({
          ...prev,
          captions: { ...prev.captions, [key]: value as never },
        }));
      },
    },
    {
      id: "motion",
      title: "Adding Motion & Zoom",
      description: "Applying motion presets to keep viewers engaged",
      progressText: "Generating motion tracks",
      preview: (
        <div className="text-[11px] space-y-1">
          <div><span className="text-muted">Preset:</span> <span className="text-foreground">{editorSettings.motion.preset}</span></div>
          <div><span className="text-muted">Intensity:</span> <span className="text-foreground">{editorSettings.motion.intensity}%</span></div>
          <div><span className="text-muted">Auto zoom on speakers:</span> <span className="text-foreground">{editorSettings.motion.autoZoomSpeakers ? "Yes" : "No"}</span></div>
        </div>
      ),
      editableSettings: [
        { key: "intensity", label: "Intensity", type: "slider", value: editorSettings.motion.intensity, min: 0, max: 100 },
        { key: "autoZoomSpeakers", label: "Auto Zoom Speakers", type: "toggle", value: editorSettings.motion.autoZoomSpeakers },
        { key: "motionBlur", label: "Motion Blur", type: "toggle", value: editorSettings.motion.motionBlur },
      ],
      onSettingChange: (key, value) => {
        setEditorSettings(prev => ({
          ...prev,
          motion: { ...prev.motion, [key]: value as never },
        }));
      },
    },
    {
      id: "transitions",
      title: "Adding Transitions",
      description: "Smooth transitions between clips",
      progressText: "Applying transition presets",
      preview: (
        <div className="text-[11px] space-y-1">
          <div><span className="text-muted">Transition:</span> <span className="text-foreground">{editorSettings.transitions.preset}</span></div>
          <div><span className="text-muted">Duration:</span> <span className="text-foreground">{editorSettings.transitions.duration}s</span></div>
          <div><span className="text-muted">Auto between cuts:</span> <span className="text-foreground">{editorSettings.transitions.autoBetweenCuts ? "Yes" : "No"}</span></div>
        </div>
      ),
      editableSettings: [
        { key: "duration", label: "Duration (s)", type: "number", value: editorSettings.transitions.duration, min: 0.1, max: 2, step: 0.1 },
        { key: "autoBetweenCuts", label: "Auto Between Cuts", type: "toggle", value: editorSettings.transitions.autoBetweenCuts },
      ],
      onSettingChange: (key, value) => {
        setEditorSettings(prev => ({
          ...prev,
          transitions: { ...prev.transitions, [key]: value as never },
        }));
      },
    },
    {
      id: "color",
      title: "Color Grading",
      description: "Applying cinematic color grade",
      progressText: "Applying LUT and color correction",
      preview: (
        <div className="text-[11px] space-y-1">
          <div><span className="text-muted">LUT:</span> <span className="text-foreground">{editorSettings.color.lut}</span></div>
          <div><span className="text-muted">Saturation:</span> <span className="text-foreground">{editorSettings.color.saturation}</span></div>
          <div><span className="text-muted">Contrast:</span> <span className="text-foreground">{editorSettings.color.contrast}</span></div>
        </div>
      ),
      editableSettings: [
        { key: "saturation", label: "Saturation", type: "slider", value: editorSettings.color.saturation, min: -50, max: 50 },
        { key: "contrast", label: "Contrast", type: "slider", value: editorSettings.color.contrast, min: -50, max: 50 },
        { key: "brightness", label: "Brightness", type: "slider", value: editorSettings.color.brightness, min: -50, max: 50 },
        { key: "temperature", label: "Temperature", type: "slider", value: editorSettings.color.temperature, min: -50, max: 50 },
      ],
      onSettingChange: (key, value) => {
        setEditorSettings(prev => ({
          ...prev,
          color: { ...prev.color, [key]: value as never },
        }));
      },
    },
    {
      id: "audio",
      title: "Audio Processing",
      description: "Mixing music and cleaning audio",
      progressText: "Mixing tracks",
      preview: (
        <div className="text-[11px] space-y-1">
          <div><span className="text-muted">Music genre:</span> <span className="text-foreground">{editorSettings.audio.bgGenre}</span></div>
          <div><span className="text-muted">Auto ducking:</span> <span className="text-foreground">{editorSettings.audio.autoDucking ? "Yes" : "No"}</span></div>
          <div><span className="text-muted">Noise removal:</span> <span className="text-foreground">{editorSettings.audio.noiseRemoval ? "Yes" : "No"}</span></div>
        </div>
      ),
      editableSettings: [
        { key: "autoDucking", label: "Auto Ducking", type: "toggle", value: editorSettings.audio.autoDucking },
        { key: "noiseRemoval", label: "Noise Removal", type: "toggle", value: editorSettings.audio.noiseRemoval },
        { key: "voiceEnhance", label: "Voice Enhance", type: "toggle", value: editorSettings.audio.voiceEnhance },
      ],
      onSettingChange: (key, value) => {
        setEditorSettings(prev => ({
          ...prev,
          audio: { ...prev.audio, [key]: value as never },
        }));
      },
    },
    {
      id: "finalize",
      title: "Finalizing Video",
      description: "Rendering the video via Remotion",
      progressText: "Calling /api/video/render",
      preview: (
        <div className="text-[11px] space-y-2">
          <div className="text-muted">
            Packaging assets, encoding output, and preparing downloads.
          </div>
          {result?.url && (
            <video src={result.url} controls className="w-full rounded-lg border border-border" />
          )}
          {result && !result.url && (result.plan || result.storyboard) && (
            <div className="text-muted">Plan/storyboard ready — open the Storyboard tab.</div>
          )}
        </div>
      ),
    },
  ];

  // Sleep helper for walkthrough progression simulation
  function sleep(ms: number) {
    return new Promise<void>(resolve => setTimeout(resolve, ms));
  }

  // ─── One-click Auto-Edit (full-pass) — detect-scenes → suggest → captions → broll ─
  // Wired to /api/video/auto-edit/full-pass. Requires an existing project_id
  // (from AI-generated project) and a video_url. Seeds the timeline with the
  // returned scenes + suggestions. This replaces the stubbed "AI Auto-Edit"
  // button from the old AI Smart Tools grid.
  async function runFullPassAutoEdit() {
    const videoUrl = result?.url;
    const projectId = aiProject?.project_id;
    if (!videoUrl) { toast.error("Render or load a video first (need a video URL)"); return; }
    if (!projectId) { toast.error("Generate an AI project first — full-pass needs a project_id"); return; }
    setFullPassRunning(true);
    const tid = toast.loading("Running full-pass auto-edit…");
    try {
      const res = await fetch("/api/video/auto-edit/full-pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_url: videoUrl,
          project_id: projectId,
          client_id: selectedClient || managedClientId || undefined,
          auto_accept: false,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        toast.error(j.error || `Full-pass failed (${res.status})`, { id: tid });
        return;
      }
      // Seed timeline suggestions from the returned suggestions (if any).
      const sugs = Array.isArray(j.suggestions) ? j.suggestions : [];
      if (sugs.length > 0) {
        setTimelineSuggestions(sugs);
      }
      toast.success(`Full-pass complete — ${sugs.length} suggestion(s), ${j.errors?.length || 0} sub-error(s)`, { id: tid });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Full-pass request failed", { id: tid });
    } finally {
      setFullPassRunning(false);
    }
  }

  // ─── Classify Footage — detect footage type + confidence → render FootageBadge ─
  async function classifyReferenceFootage(idx: number) {
    const f = referenceFiles[idx];
    if (!f) return;
    if (!f.type.startsWith("video/") && !f.type.startsWith("image/")) {
      toast.error("Reference must be an image or video");
      return;
    }
    setClassifyingIdx(idx);
    const tid = toast.loading(`Classifying ${f.name}…`);
    try {
      const body: Record<string, unknown> = { client_id: selectedClient || managedClientId || undefined };
      if (f.type.startsWith("video/")) {
        body.video_url = f.data; // data: URL — server accepts per route docs
      } else {
        body.video_url = f.data;
      }
      const res = await fetch("/api/video/classify-footage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok || !j) {
        toast.error(j?.error || `Classify failed (${res.status})`, { id: tid });
        return;
      }
      setFootageBadges((prev) => ({
        ...prev,
        [idx]: {
          footage_type: (j.footage_type as FootageType) || "unknown",
          confidence: typeof j.confidence === "number" ? j.confidence : 0,
          recommended_creator_pack_id:
            typeof j.recommended_creator_pack_id === "string"
              ? (j.recommended_creator_pack_id as string)
              : undefined,
        },
      }));
      toast.success(`Detected: ${j.footage_type}`, { id: tid });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Classify request failed", { id: tid });
    } finally {
      setClassifyingIdx(null);
    }
  }

  // ─── Analyze Viral Video — pass a URL, get a ViralPattern ─
  async function analyzeViralUrl() {
    const url = viralUrl.trim();
    if (!url) { toast.error("Paste a YouTube / Shorts URL first"); return; }
    setViralAnalyzing(true);
    const tid = toast.loading("Analyzing viral video…");
    try {
      const res = await fetch("/api/video/analyze-viral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_url: url,
          client_id: selectedClient || managedClientId || undefined,
          store_as_template: false,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        toast.error(j.error || `Analyze failed (${res.status})`, { id: tid });
        return;
      }
      setViralResult(j as Record<string, unknown>);
      toast.success("Pattern extracted — see results below", { id: tid });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analyze request failed", { id: tid });
    } finally {
      setViralAnalyzing(false);
    }
  }

  // ─── Task 2A: Generate full AI project (script + captions + shotlist) ───
  async function runAiProjectGeneration() {
    if (!aiGenTopic.trim()) { toast.error("Enter a topic first"); return; }
    setAiGenLoading(true);
    try {
      // fetchWithWall surfaces the QuotaWall on 402 (plan limit) — saves
      // the user from a mysterious "Request failed (402)" toast.
      const res = await fetchWithWall("/api/video/generate-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: aiGenTopic,
          duration_seconds: aiGenDuration,
          style_preset: aiGenStyle || undefined,
          target_audience: aiGenAudience || undefined,
          niche: undefined,
        }),
      });
      if (res.status === 402) {
        toast.error("You hit your AI token limit — upgrade to continue", { duration: 6000 });
        setAiGenLoading(false);
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Request failed (${res.status})`);
      }
      const data = (await res.json()) as AiProjectData;
      setAiProject(data);
      applyAiProjectToEditor(data);
      setAiGenOpen(false);
      toast.success("Project generated — script, captions, and shotlist ready");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI generation failed");
    } finally {
      setAiGenLoading(false);
    }
  }

  // Populate editor state with the AI-generated project
  function applyAiProjectToEditor(data: AiProjectData) {
    if (data.script) {
      setConfig(prev => ({ ...prev, script: data.script as string }));
    }
    if (typeof data.total_duration === "number") {
      setConfig(prev => ({ ...prev, duration: Math.round(data.total_duration as number) }));
    }
    if (data.editor_settings && typeof data.editor_settings === "object") {
      setEditorSettings(prev => ({
        ...prev,
        ...(data.editor_settings as Partial<EditorSettings>),
      }));
    }
    // Apply selected style preset (we do NOT have the full cfg here, but we can mark it)
    if (aiGenStyle) setSelectedYouTuberPreset(aiGenStyle);
    // Populate the AI script textarea if present
    if (data.script) setAiScriptInput(data.script);
    // Populate the scene builder from the AI scenes
    if (Array.isArray(data.scenes) && data.scenes.length > 0) {
      setSceneBuilderScenes(
        data.scenes.map((s, i) => ({
          id: `s${Date.now()}-${i}`,
          name: s.title || `Scene ${i + 1}`,
          duration: s.duration ?? 5,
          description: s.description || "",
        })),
      );
    }
  }

  // ─── Task 2B: Reference analyzer ───
  // Analyze a reference file with /api/video/analyze-reference.
  // Uses first frame as base64 if the file is an image, else sends URL if file is remote.
  async function analyzeReferenceFile(idx: number) {
    const f = referenceFiles[idx];
    if (!f) { toast.error("No reference file at that slot"); return; }
    setRefAnalyzing(true);
    setRefAnalysis(null);
    try {
      const body: Record<string, unknown> = {};
      if (f.type.startsWith("image/")) {
        // Already base64 data URL — strip prefix
        const base64 = (f.data || "").split(",")[1] || f.data;
        body.frame_base64 = base64;
      } else if (f.type.startsWith("video/")) {
        // Send data URL as video_url (backend may need to handle data URLs)
        body.video_url = f.data;
      } else {
        throw new Error("Reference must be an image or video file");
      }
      const res = await fetch("/api/video/analyze-reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Analysis failed (${res.status})`);
      }
      const data = await res.json();
      const suggested = (data.suggested_editor_settings || data) as Record<string, unknown>;
      setRefAnalysis(suggested);
      setRefAnalysisOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setRefAnalyzing(false);
    }
  }

  function applyAnalyzedReference() {
    if (!refAnalysis) return;
    setEditorSettings(prev => ({
      ...prev,
      ...(refAnalysis as Partial<EditorSettings>),
    }));
    setRefAnalysisOpen(false);
    toast.success("Settings applied from reference");
  }

  // Helper used by walkthrough steps.
  // Returns true if the step completed, false if it was cancelled OR threw.
  // When a step throws we mark it as `failed` and set the cancelled ref so
  // the caller bails out — otherwise we'd pretend the remaining steps
  // succeeded and mislead the user ("fake success").
  async function runStep(index: number, task: () => Promise<void>): Promise<boolean> {
    if (walkthroughCancelledRef.current) return false;
    setWalkthroughStepIndex(index);
    setWalkthroughStatus("in_progress");
    try {
      await task();
    } catch (err) {
      console.error("walkthrough step failed", index, err);
      setWalkthroughStatus("failed");
      walkthroughCancelledRef.current = true;
      return false;
    }
    if (walkthroughCancelledRef.current) return false;
    setWalkthroughStatus("completed");
    await sleep(400);
    return !walkthroughCancelledRef.current;
  }

  // Runs the walkthrough against the REAL AI pipeline.
  // Steps:
  //   1 Analyze    → /api/video/script-generate
  //   2 Style      → apply preset (no API)
  //   3 Captions   → /api/video/captions-generate
  //   4 Motion     → preview of motion preset (no API)
  //   5 Transitions→ preview of transitions preset (no API)
  //   6 Color      → preview of color grading (no API)
  //   7 Audio      → optionally /api/ai/music-gen
  //   8 Finalize   → /api/video/render
  async function runWalkthrough() {
    walkthroughCancelledRef.current = false;
    setWalkthroughOpen(true);
    setGenerating(true);
    setResult(null);

    let script = config.script || "";
    let captions: AiGeneratedCaption[] = [];

    // Step 1 — Analyze: generate script via Claude
    const ok1 = await runStep(0, async () => {
      const res = await fetch("/api/video/script-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: config.title,
          duration_seconds: config.duration,
          style_preset: selectedYouTuberPreset || undefined,
          call_to_action: config.cta_text || undefined,
        }),
      });
      if (!res.ok) throw new Error("Script generation failed");
      const data = await res.json();
      const scriptText = (data.script as string) || "";
      if (scriptText) {
        script = scriptText;
        setConfig(prev => ({ ...prev, script: scriptText }));
        setAiScriptInput(scriptText);
      }
      setAiProject({
        hook: data.hook,
        script: scriptText,
        scenes: data.scenes,
        captions_keywords: data.captions_keywords,
        cta: data.cta,
      });
    });
    if (!ok1) { setGenerating(false); return; }

    // Step 2 — Style: apply preset (already applied via UI)
    const ok2 = await runStep(1, async () => { await sleep(400); });
    if (!ok2) { setGenerating(false); return; }

    // Step 3 — Captions: generate from the script
    const ok3 = await runStep(2, async () => {
      if (!script) return;
      const res = await fetch("/api/video/captions-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: script,
          max_words_per_caption: editorSettings.captions.maxWordsPerLine,
          duration_seconds: config.duration,
          emphasize_keywords: editorSettings.captions.emphasizeKeywords,
        }),
      });
      if (!res.ok) throw new Error("Caption generation failed");
      const data = await res.json();
      captions = Array.isArray(data.captions) ? data.captions : [];
      setAiProject(prev => ({ ...(prev || {}), captions }));
    });
    if (!ok3) { setGenerating(false); return; }

    // Step 4 — Motion: apply motion presets from settings
    const ok4 = await runStep(3, async () => { await sleep(300); });
    if (!ok4) { setGenerating(false); return; }

    // Step 5 — Transitions
    const ok5 = await runStep(4, async () => { await sleep(300); });
    if (!ok5) { setGenerating(false); return; }

    // Step 6 — Color grading
    const ok6 = await runStep(5, async () => { await sleep(300); });
    if (!ok6) { setGenerating(false); return; }

    // Step 7 — Audio (optional music gen)
    const ok7 = await runStep(6, async () => {
      // Fire-and-forget music gen; don't block on it
      try {
        await fetch("/api/ai/music-gen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mood: editorSettings.audio.bgGenre, duration_seconds: config.duration }),
        });
      } catch { /* ignore */ }
    });
    if (!ok7) { setGenerating(false); return; }

    // Step 8 — Finalize: render via existing endpoint
    const ok8 = await runStep(7, async () => {
      const res = await fetch("/api/video/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...config,
          script,
          music_mood: config.music_mood,
          client_id: selectedClient || null,
          plan_only: mode === "plan" || mode === "storyboard",
          storyboard_mode: mode === "storyboard",
          reference_files: referenceFiles.map(f => ({ name: f.name, type: f.type, data: f.data })),
          editor_settings: editorSettings,
          captions,
          asset_selections: {
            caption_style_id: selectedCaptionStyleId || null,
            effect_ids: selectedEffectIds,
            sfx_ids: selectedSfxIds,
            music_id: selectedMusicId || null,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
        if (data.url) {
          toast.success("Video rendered — ready to download");
        } else if (data.storyboard || data.plan) {
          toast.success(mode === "storyboard" ? "Storyboard created!" : "Video plan generated!");
          if (mode === "storyboard") setTab("storyboard");
        }
      } else {
        const attemptedMsg = Array.isArray(data.attempted) && data.attempted.length > 0
          ? `Video render failed. Tried: ${data.attempted.join(", ")}`
          : (data.error || "Render failed");
        toast.error(attemptedMsg);
      }
    });
    if (!ok8) { setGenerating(false); return; }

    setGenerating(false);
  }

  async function generateVideo() {
    if (!config.title) { toast.error("Enter a video title"); return; }
    // If walkthrough enabled, show the walkthrough and run the real AI pipeline step-by-step.
    if (walkthroughEnabled && !walkthroughOpen) {
      await runWalkthrough();
      return;
    }
    await generateVideoReal();
  }

  async function generateVideoReal() {
    setGenerating(true);
    setResult(null);
    setRenderProgress(0);

    const progressInterval = setInterval(() => {
      setRenderProgress(prev => Math.min(prev + Math.random() * 8, 90));
    }, 500);

    const loadMsg = mode === "storyboard" ? "Creating AI storyboard..." : mode === "plan" ? "Generating video plan..." : "Rendering video...";
    toast.loading(loadMsg);

    try {
      const res = await fetch("/api/video/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...config,
          music_mood: config.music_mood,
          client_id: selectedClient || null,
          plan_only: mode === "plan" || mode === "storyboard",
          storyboard_mode: mode === "storyboard",
          reference_files: referenceFiles.map(f => ({ name: f.name, type: f.type, data: f.data })),
          editor_settings: editorSettings,
          asset_selections: {
            caption_style_id: selectedCaptionStyleId || null,
            effect_ids: selectedEffectIds,
            sfx_ids: selectedSfxIds,
            music_id: selectedMusicId || null,
          },
        }),
      });
      clearInterval(progressInterval);
      setRenderProgress(100);
      toast.dismiss();
      const data = await res.json();
      if (data.success) {
        setResult(data);
        if (data.url) {
          toast.success("Video rendered! Ready to download.");
        } else if (data.storyboard || data.plan) {
          toast.success(mode === "storyboard" ? "Storyboard created!" : "Video plan generated!");
          if (mode === "storyboard") setTab("storyboard");
        }
      } else {
        const attemptedMsg = Array.isArray(data.attempted) && data.attempted.length > 0
          ? `Video render failed. Tried: ${data.attempted.join(", ")}`
          : (data.error || "Failed");
        toast.error(attemptedMsg);
      }
    } catch {
      clearInterval(progressInterval);
      toast.dismiss();
      toast.error("Error");
    }
    setGenerating(false);
  }

  const selectedType = VIDEO_TYPES.find(t => t.id === config.type) || VIDEO_TYPES[0];

  /* ─── Wizard steps for newbies ─── */
  const videoWizardSteps: WizardStep[] = [
    {
      id: "topic",
      title: "What's your video about?",
      description: "A quick description helps us generate the right script, captions, and visuals.",
      icon: <Type size={16} />,
      field: { type: "textarea", key: "topic", placeholder: "e.g., A 30-second reel about the top 3 productivity tips for founders" },
    },
    {
      id: "platform",
      title: "Where will this video live?",
      description: "Different platforms need different aspect ratios and durations.",
      icon: <Film size={16} />,
      field: {
        type: "choice-cards",
        key: "platform",
        options: [
          { value: "tiktok", label: "TikTok", description: "9:16, up to 60s", emoji: "🎵", preview: "bg-pink-500/20" },
          { value: "instagram_reels", label: "Instagram Reels", description: "9:16, up to 90s", emoji: "📱", preview: "bg-gradient-to-br from-pink-500/30 to-purple-500/30" },
          { value: "youtube_shorts", label: "YouTube Shorts", description: "9:16, up to 60s", emoji: "▶️", preview: "bg-red-600/20" },
          { value: "youtube", label: "YouTube", description: "16:9, any length", emoji: "🎬", preview: "bg-red-500/20" },
          { value: "linkedin", label: "LinkedIn", description: "1:1 or 16:9", emoji: "💼", preview: "bg-blue-600/20" },
          { value: "twitter", label: "X / Twitter", description: "16:9, up to 2:20", emoji: "𝕏", preview: "bg-zinc-700/30" },
        ],
      },
    },
    {
      id: "duration",
      title: "How long should it be?",
      description: "Shorter videos have higher completion rates. 15-30s is the sweet spot for social.",
      icon: <Sparkles size={16} />,
      field: {
        type: "choice-cards",
        key: "duration",
        options: [
          { value: "15", label: "15 seconds", description: "Ultra-short hook", emoji: "⚡" },
          { value: "30", label: "30 seconds", description: "Standard reel/short", emoji: "📱" },
          { value: "60", label: "1 minute", description: "Detailed explainer", emoji: "🎯" },
          { value: "90", label: "1.5 minutes", description: "Longer narrative", emoji: "📖" },
          { value: "180", label: "3 minutes", description: "Deep dive", emoji: "🔍" },
          { value: "600", label: "10 minutes", description: "Full YouTube video", emoji: "🎥" },
        ],
      },
    },
    {
      id: "style",
      title: "Pick a creator style",
      description: "We'll match captions, pacing, music, and color grade to this creator's signature.",
      icon: <Wand2 size={16} />,
      field: {
        type: "choice-cards",
        key: "style",
        options: YOUTUBER_PRESETS.slice(0, 12).map(p => ({
          value: p.id,
          label: p.name,
          description: p.tagline,
          preview: p.preview,
        })),
      },
    },
    {
      id: "captions",
      title: "Caption style",
      description: "Captions boost watch time by 40%. Pick the style that fits your content.",
      icon: <Type size={16} />,
      field: {
        type: "choice-cards",
        key: "captionStyle",
        options: [
          { value: "word_highlight", label: "Word-by-Word", description: "Karaoke-style highlight (TikTok)", emoji: "🎤" },
          { value: "meme_impact", label: "Meme Bold", description: "Impact font, yellow + black stroke", emoji: "💥" },
          { value: "cinematic", label: "Cinematic", description: "Lower-third subtle subtitles", emoji: "🎬" },
          { value: "podcast", label: "Podcast Clean", description: "Simple white on dark", emoji: "🎙️" },
          { value: "bouncy", label: "Bouncy Reel", description: "Colorful, playful pop-ins", emoji: "🎈" },
          { value: "none", label: "No Captions", description: "Skip captions entirely", emoji: "🚫" },
        ],
      },
    },
    {
      id: "music",
      title: "Music vibe",
      description: "Background music dramatically affects how your video feels.",
      icon: <Music size={16} />,
      field: {
        type: "choice-cards",
        key: "musicMood",
        options: [
          { value: "upbeat", label: "Upbeat", description: "High energy, fun", emoji: "⚡" },
          { value: "cinematic", label: "Cinematic", description: "Epic, dramatic", emoji: "🎬" },
          { value: "chill", label: "Chill", description: "Lo-fi, relaxed", emoji: "🎧" },
          { value: "emotional", label: "Emotional", description: "Heartfelt, moving", emoji: "💖" },
          { value: "hip_hop", label: "Hip Hop", description: "Trending, street", emoji: "🎤" },
          { value: "corporate", label: "Corporate", description: "Clean, professional", emoji: "💼" },
          { value: "edm", label: "EDM", description: "Electronic, intense", emoji: "🔊" },
          { value: "none", label: "No Music", description: "Voice only", emoji: "🔇" },
        ],
      },
    },
    {
      id: "effects",
      title: "Visual effects (optional)",
      description: "Add punch. Zoom-ins and transitions keep viewers watching.",
      icon: <Zap size={16} />,
      field: {
        type: "chip-select",
        key: "effects",
        optional: true,
        options: [
          { value: "punch_zoom", label: "Punch Zoom", emoji: "🔍" },
          { value: "motion_blur", label: "Motion Blur", emoji: "💨" },
          { value: "flash_cuts", label: "Flash Cuts", emoji: "⚡" },
          { value: "glitch", label: "Glitch", emoji: "📺" },
          { value: "slow_mo", label: "Slow Motion", emoji: "🐢" },
          { value: "speed_ramp", label: "Speed Ramp", emoji: "🚀" },
          { value: "sparkles", label: "Sparkles", emoji: "✨" },
          { value: "light_leak", label: "Light Leak", emoji: "💡" },
        ],
      },
    },
    {
      id: "cta",
      title: "Call to action",
      description: "What should viewers do after watching? Leave blank to skip.",
      icon: <Sparkles size={16} />,
      field: {
        type: "text",
        key: "cta",
        placeholder: "e.g., Follow for more tips • Visit the link in bio",
        optional: true,
      },
    },
  ];

  return (
    <div className="fade-in space-y-5">
      <PageHero
        icon={<Film size={22} />}
        title="AI Video Editor"
        subtitle="Script, style, caption. AI writes, GPU renders — you hit publish."
        gradient="sunset"
        actions={<AdvancedToggle value={advancedMode} onChange={setAdvancedMode} />}
      />

      {/* Guided Mode — 5-step "4-year-old friendly" flow */}
      {!advancedMode && (
        <Wizard
          steps={[
            {
              id: "type",
              title: "What kind of video?",
              description: "This sets the aspect ratio and default length.",
              icon: <Film size={18} />,
              component: (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  {VIDEO_TYPES.slice(0, 4).map(vt => {
                    const selected = config.type === vt.id;
                    return (
                      <button
                        key={vt.id}
                        onClick={() => setConfig(prev => ({ ...prev, type: vt.id, aspect_ratio: vt.aspect, duration: vt.duration }))}
                        className={`text-left p-4 rounded-xl border transition-all ${
                          selected ? "border-gold bg-gold/10 shadow-lg shadow-gold/10" : "border-border hover:border-gold/30 bg-surface-light"
                        }`}
                      >
                        <div className={`w-full rounded-lg mb-2 bg-gradient-to-br from-gold/30 to-amber-400/20 flex items-center justify-center ${
                          vt.aspect === "9:16" ? "h-20" : vt.aspect === "1:1" ? "h-16" : "h-14"
                        }`}>
                          <span className="text-gold">{vt.icon}</span>
                        </div>
                        <p className="text-xs font-bold">{vt.name}</p>
                        <p className="text-[10px] text-muted">{vt.aspect} · ~{vt.duration}s</p>
                      </button>
                    );
                  })}
                </div>
              ),
            },
            {
              id: "topic",
              title: "What's it about?",
              description: "A single sentence works. This becomes the script title and drives everything downstream.",
              icon: <Type size={18} />,
              canProceed: config.title.trim().length > 0,
              component: (
                <textarea
                  value={config.title}
                  onChange={e => setConfig(prev => ({ ...prev, title: e.target.value, script: e.target.value }))}
                  placeholder="e.g., 30-second hook for my new course launch"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-surface-light border border-border text-sm focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20 transition-all resize-none"
                  autoFocus
                />
              ),
            },
            {
              id: "footage",
              title: "Do you have footage?",
              description: "No worries either way — AI can fill in with stock/b-roll.",
              icon: <Upload size={18} />,
              component: (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { id: "upload" as const, label: "Upload clips", sub: "Your own video files", icon: <Upload size={24} /> },
                    { id: "record" as const, label: "Record now", sub: "Use your camera", icon: <Camera size={24} /> },
                    { id: "ai" as const, label: "AI generates", sub: "Stock + b-roll + text", icon: <Sparkles size={24} /> },
                  ].map(opt => {
                    const selected = guidedFootageSource === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setGuidedFootageSource(opt.id)}
                        className={`p-5 rounded-xl border text-center transition-all ${
                          selected ? "border-gold bg-gold/10 shadow-lg shadow-gold/10" : "border-border hover:border-gold/30 bg-surface-light"
                        }`}
                      >
                        <div className="w-12 h-12 rounded-full bg-gold/15 flex items-center justify-center mx-auto mb-3 text-gold">
                          {opt.icon}
                        </div>
                        <p className="text-sm font-bold">{opt.label}</p>
                        <p className="text-[10px] text-muted mt-0.5">{opt.sub}</p>
                      </button>
                    );
                  })}
                </div>
              ),
            },
            {
              id: "pack",
              title: "Pick a creator pack",
              description: "These are proven styles — captions, zooms, color grading tuned for each creator.",
              icon: <Palette size={18} />,
              optional: true,
              component: (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                  {YOUTUBER_PRESETS.slice(0, 6).map(p => {
                    const selected = selectedYouTuberPreset === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => applyYouTuberPreset(p)}
                        className={`text-left rounded-xl border overflow-hidden transition-all ${
                          selected ? "border-gold ring-2 ring-gold/30 shadow-lg shadow-gold/20" : "border-border hover:border-gold/30"
                        }`}
                      >
                        <div className={`h-16 ${p.preview}`} />
                        <div className="p-2.5 bg-surface-light">
                          <p className="text-xs font-bold">{p.name}</p>
                          <p className="text-[9px] text-muted line-clamp-2">{p.tagline}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ),
            },
            {
              id: "review",
              title: "Ready to generate?",
              description: "We'll assemble the edit. Fine-tune captions, music, SFX, and scenes in Advanced mode.",
              icon: <Wand2 size={18} />,
              component: (
                <div className="card bg-gold/[0.04] border-gold/20 space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-muted">Type</p>
                      <p className="text-xs font-semibold">{VIDEO_TYPES.find(t => t.id === config.type)?.name}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-muted">Aspect</p>
                      <p className="text-xs font-semibold">{config.aspect_ratio}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-muted">Footage</p>
                      <p className="text-xs font-semibold capitalize">{guidedFootageSource}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-muted">Duration</p>
                      <p className="text-xs font-semibold">{config.duration}s</p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border/50">
                    <p className="text-[9px] uppercase tracking-wider text-muted">Topic</p>
                    <p className="text-sm font-semibold line-clamp-2">{config.title || <span className="text-muted italic">(none)</span>}</p>
                  </div>
                </div>
              ),
            },
          ]}
          activeIdx={guidedStep}
          onStepChange={setGuidedStep}
          finishLabel={generating ? "Rendering…" : "Generate video"}
          busy={generating}
          onFinish={async () => {
            await generateVideo();
          }}
          onCancel={() => setAdvancedMode(true)}
          cancelLabel="Advanced mode"
        />
      )}

      {/* Result in guided mode */}
      {!advancedMode && result && (
        <div className="card space-y-3">
          <h2 className="section-header flex items-center gap-2">
            <Film size={14} className="text-gold" /> {config.title || "Your video"}
          </h2>
          {result.url ? (
            <video src={result.url} controls className="w-full rounded-xl border border-border bg-black" />
          ) : (
            <div className="rounded-xl border border-gold/20 bg-gold/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-wider text-gold font-semibold mb-1.5">Scene plan ready</p>
              <pre className="text-[11px] text-foreground/90 whitespace-pre-wrap font-sans leading-relaxed">{result.plan || "Plan generated — check Advanced mode to review full details."}</pre>
            </div>
          )}
        </div>
      )}

      {/* Landing-state rolling preview — compact strip, only while empty. */}
      {advancedMode && !aiProject && (
        <div className="relative rounded-xl overflow-hidden border border-border bg-surface-light/30 py-2 h-14">
          <div className="absolute inset-0 pointer-events-none">
            <RollingPreview
              items={VIDEO_EDITOR_PREVIEW_ITEMS}
              rows={1}
              aspectRatio="9:16"
              opacity={0.35}
              speed="medium"
              fetchRemote
              tool="video_editor"
            />
          </div>
          <div className="relative text-center px-4">
            <p className="text-[10px] uppercase tracking-widest text-gold/80 font-semibold">
              Example ad library — describe a product below to generate a full ad
            </p>
          </div>
        </div>
      )}

      {/* Step-by-Step Guided Creation Wizard */}
      <CreationWizard
        open={videoWizardOpen}
        title="Create Your Video"
        subtitle="Step-by-step — pick a style, captions, music. We handle the rest."
        icon={<Film size={18} />}
        submitLabel="Apply & Continue"
        initialData={{
          topic: config.title,
          platform: config.target_platform,
          duration: String(config.duration),
          style: selectedYouTuberPreset,
          captionStyle: config.caption_style,
          musicMood: config.music_mood,
        }}
        steps={videoWizardSteps}
        onClose={() => {
          setVideoWizardOpen(false);
          try { localStorage.setItem("ss-video-wizard-seen", "1"); } catch {}
        }}
        onComplete={async (data) => {
          // Apply all wizard choices to the editor config
          setConfig(prev => ({
            ...prev,
            title: (data.topic as string) || prev.title,
            script: (data.topic as string) || prev.script,
            target_platform: (data.platform as string) || prev.target_platform,
            duration: data.duration ? parseInt(data.duration as string) : prev.duration,
            caption_style: (data.captionStyle as string) || prev.caption_style,
            music_mood: (data.musicMood as string) || prev.music_mood,
            cta_text: (data.cta as string) || prev.cta_text,
          }));
          if (data.style) {
            const preset = YOUTUBER_PRESETS.find(p => p.id === data.style);
            if (preset) applyYouTuberPreset(preset);
          }
          setVideoWizardOpen(false);
          try { localStorage.setItem("ss-video-wizard-seen", "1"); } catch {}
          toast.success("Settings applied! Now click Generate to create your video.");
        }}
      />

      {advancedMode && (
      <>
      <div className="flex items-center justify-end flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setVideoWizardOpen(true)}
            className="text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-gold/20 to-amber-500/20 border border-gold/30 text-gold hover:from-gold/30 hover:to-amber-500/30 hover-lift flex items-center gap-1.5"
            title="Step-by-step guided creation for beginners"
          >
            <Sparkles size={12} /> Legacy Wizard
          </button>
          <button
            onClick={() => {
              console.log("[video-editor] Generate with AI clicked, opening modal");
              setAiGenOpen(true);
            }}
            type="button"
            className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
            title="Generate a full video project with AI — script, captions, shotlist, and editor settings"
          >
            <Sparkles size={14} /> Generate with AI
          </button>
          <button
            onClick={() => setAdsGenOpen(true)}
            type="button"
            className="text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-red-500/90 to-amber-500/90 text-white hover:from-red-500 hover:to-amber-500 hover-lift flex items-center gap-1.5 border border-red-400/50"
            title="Paste a product description → get a complete ad video ready to render"
          >
            <Megaphone size={14} /> Generate Full Ad from Description
          </button>
          <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} className="input text-xs py-1.5 min-w-[140px]">
            <option value="">No client</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.business_name}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-group w-fit">
        {(["create", "storyboard", "templates", "assets", "export"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={tab === t ? "tab-item-active" : "tab-item-inactive"}>
            {t === "create" ? "Create Video" : t === "storyboard" ? "Storyboard" : t === "templates" ? "Quick Templates" : t === "assets" ? "Assets & Effects" : "Export & Review"}
          </button>
        ))}
      </div>

      {/* Create Tab */}
      {tab === "create" && (
        <>
        {/* Create Sub-Tabs */}
        <div className="flex flex-wrap gap-1.5">
          {([
            { id: "editor", label: "Editor", icon: <Film size={11} /> },
            { id: "scene-builder", label: "Scene Builder", icon: <GripVertical size={11} /> },
            { id: "ai-script", label: "AI Script-to-Video", icon: <FileText size={11} /> },
            { id: "audio-mixer", label: "Audio Mixer", icon: <Music size={11} /> },
            { id: "advanced", label: "Advanced", icon: <Settings2 size={11} /> },
            { id: "smart", label: "Smart Presets", icon: <Brain size={11} /> },
          ] as const).map(st => (
            <button key={st.id} onClick={() => setCreateSubTab(st.id)}
              className={`text-[10px] px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                createSubTab === st.id ? "bg-gold/10 text-gold border-gold/20 font-semibold" : "text-muted border-border hover:border-gold/15"
              }`}>
              {st.icon} {st.label}
            </button>
          ))}
        </div>

        {/* Scene Builder Sub-Tab */}
        {createSubTab === "scene-builder" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              {/* Scene Builder - Drag & Drop */}
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="section-header flex items-center gap-2 mb-0"><GripVertical size={13} className="text-gold" /> Scene Builder</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-muted">Total: {sceneBuilderScenes.reduce((sum, s) => sum + s.duration, 0)}s</span>
                    <button onClick={addSceneToBuilder} className="text-[9px] px-2 py-1 bg-gold/10 text-gold rounded-lg border border-gold/20 flex items-center gap-1">
                      <Plus size={10} /> Add Scene
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {sceneBuilderScenes.map((scene, idx) => (
                    <div
                      key={scene.id}
                      draggable
                      onDragStart={() => handleSceneDragStart(scene.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleSceneDrop(scene.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-grab active:cursor-grabbing ${
                        draggedScene === scene.id ? "border-gold/40 bg-gold/5 opacity-60" : "border-border hover:border-gold/20"
                      }`}
                    >
                      <GripVertical size={14} className="text-muted flex-shrink-0" />
                      <span className="text-[10px] font-bold text-gold w-6">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <input
                          value={scene.name}
                          onChange={e => setSceneBuilderScenes(prev => prev.map(s => s.id === scene.id ? { ...s, name: e.target.value } : s))}
                          className="text-[11px] font-semibold bg-transparent border-none outline-none w-full"
                        />
                        <input
                          value={scene.description}
                          onChange={e => setSceneBuilderScenes(prev => prev.map(s => s.id === scene.id ? { ...s, description: e.target.value } : s))}
                          className="text-[9px] text-muted bg-transparent border-none outline-none w-full"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => setSceneBuilderScenes(prev => prev.map(s => s.id === scene.id ? { ...s, duration: Math.max(1, s.duration - 1) } : s))}
                          className="w-5 h-5 rounded bg-surface-light flex items-center justify-center text-muted hover:text-foreground">
                          <Minus size={10} />
                        </button>
                        <span className="text-[10px] font-mono w-8 text-center">{scene.duration}s</span>
                        <button onClick={() => setSceneBuilderScenes(prev => prev.map(s => s.id === scene.id ? { ...s, duration: s.duration + 1 } : s))}
                          className="w-5 h-5 rounded bg-surface-light flex items-center justify-center text-muted hover:text-foreground">
                          <Plus size={10} />
                        </button>
                      </div>
                      <button onClick={() => removeScene(scene.id)}
                        className="w-5 h-5 rounded bg-danger/10 flex items-center justify-center text-danger hover:bg-danger/20 flex-shrink-0">
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-[9px] text-muted">
                      <span>Scenes: {sceneBuilderScenes.length}</span>
                      <span>Est. Duration: {sceneBuilderScenes.reduce((sum, s) => sum + s.duration, 0)}s</span>
                    </div>
                    <button onClick={() => {
                      setConfig(prev => ({ ...prev, duration: sceneBuilderScenes.reduce((sum, s) => sum + s.duration, 0) }));
                      toast.success("Scene durations applied to video config");
                    }} className="text-[9px] text-gold hover:underline">Apply to Video</button>
                  </div>
                </div>
              </div>

              {/* Speed Control per Scene */}
              <div className="card">
                <h2 className="section-header flex items-center gap-2"><Gauge size={13} className="text-gold" /> Speed Control per Scene</h2>
                <div className="space-y-2">
                  {sceneBuilderScenes.map(scene => (
                    <div key={scene.id} className="flex items-center gap-3 p-2 rounded-lg border border-border">
                      <span className="text-[10px] font-medium w-32 truncate">{scene.name}</span>
                      <input
                        type="range" min={0.25} max={4} step={0.25}
                        value={speedControl[scene.id] || 1}
                        onChange={e => setSpeedControl(prev => ({ ...prev, [scene.id]: parseFloat(e.target.value) }))}
                        className="flex-1 accent-gold h-1"
                      />
                      <span className="text-[9px] font-mono text-gold w-10 text-right">{speedControl[scene.id] || 1}x</span>
                      <span className="text-[8px] text-muted w-16 text-right">
                        {(speedControl[scene.id] || 1) < 1 ? "Slow-mo" : (speedControl[scene.id] || 1) > 1 ? "Timelapse" : "Normal"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Scene Builder Sidebar */}
            <div className="space-y-4">
              <div className="card border-gold/10">
                <h3 className="section-header flex items-center gap-2"><Timer size={12} className="text-gold" /> Scene Timeline</h3>
                <div className="space-y-1">
                  {sceneBuilderScenes.map((scene, idx) => {
                    const startTime = sceneBuilderScenes.slice(0, idx).reduce((sum, s) => sum + s.duration, 0);
                    return (
                      <div key={scene.id} className="flex items-center gap-2 text-[9px]">
                        <span className="text-muted font-mono w-10">{startTime}s</span>
                        <div className="flex-1 bg-gold/10 rounded-full h-3 overflow-hidden" style={{ flex: scene.duration }}>
                          <div className="bg-gradient-gold h-full rounded-full flex items-center px-1.5">
                            <span className="text-[7px] text-white font-medium truncate">{scene.name}</span>
                          </div>
                        </div>
                        <span className="text-muted font-mono w-8 text-right">{scene.duration}s</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="card">
                <h3 className="section-header flex items-center gap-2"><Sparkles size={12} className="text-gold" /> AI Suggestions</h3>
                <div className="space-y-2 text-[9px] text-muted">
                  <p><AlertCircle size={9} className="inline text-gold mr-1" /> Hook should be under 3 seconds for best retention</p>
                  <p><AlertCircle size={9} className="inline text-gold mr-1" /> Consider adding a pattern interrupt at scene 2</p>
                  <p><Check size={9} className="inline text-success mr-1" /> CTA placement at end is optimal</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Script-to-Video Sub-Tab */}
        {createSubTab === "ai-script" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <div className="card">
                <h2 className="section-header flex items-center gap-2"><FileText size={13} className="text-gold" /> AI Script-to-Video</h2>
                <p className="text-[9px] text-muted mb-3">Paste your script and AI will auto-split it into timed scenes with style suggestions.</p>
                <textarea
                  value={aiScriptInput}
                  onChange={e => setAiScriptInput(e.target.value)}
                  rows={6}
                  className="input w-full text-xs"
                  placeholder="Paste your full video script here. Each sentence becomes a scene suggestion..."
                />
                <div className="flex items-center gap-2 mt-2">
                  <button onClick={splitScriptToScenes} className="btn-primary text-[10px] flex items-center gap-1.5">
                    <Sparkles size={12} /> Split into Scenes
                  </button>
                  <span className="text-[8px] text-muted">{aiScriptInput.split(/\s+/).filter(Boolean).length} words</span>
                </div>
              </div>

              {aiScriptScenes.length > 0 && (
                <div className="card">
                  <h3 className="section-header flex items-center gap-2"><Layers size={13} className="text-gold" /> Generated Scenes ({aiScriptScenes.length})</h3>
                  <div className="space-y-2">
                    {aiScriptScenes.map((scene, idx) => (
                      <div key={idx} className="p-3 rounded-xl border border-border hover:border-gold/20 transition-all">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-gold">Scene {idx + 1}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] bg-gold/10 text-gold px-1.5 py-0.5 rounded">{scene.suggestedStyle}</span>
                            <span className="text-[8px] text-muted font-mono">{scene.duration}s</span>
                          </div>
                        </div>
                        <p className="text-[10px] text-muted">{scene.text}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                    <button onClick={() => {
                      setSceneBuilderScenes(aiScriptScenes.map((s, i) => ({
                        id: `ai-${Date.now()}-${i}`,
                        name: `Scene ${i + 1}`,
                        duration: s.duration,
                        description: s.text,
                      })));
                      setCreateSubTab("scene-builder");
                      toast.success("Scenes loaded into Scene Builder");
                    }} className="btn-primary text-[10px] flex items-center gap-1">
                      <GripVertical size={10} /> Load into Scene Builder
                    </button>
                    <button onClick={() => {
                      setConfig(prev => ({ ...prev, script: aiScriptInput }));
                      setCreateSubTab("editor");
                      toast.success("Script applied to editor");
                    }} className="btn-secondary text-[10px] flex items-center gap-1">
                      <FileText size={10} /> Use Full Script
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* Script Sidebar */}
            <div className="space-y-4">
              <div className="card border-gold/10">
                <h3 className="section-header flex items-center gap-2"><BarChart3 size={12} className="text-gold" /> Script Analysis</h3>
                <div className="space-y-2 text-[9px]">
                  <div className="flex justify-between"><span className="text-muted">Word Count</span><span className="font-mono">{aiScriptInput.split(/\s+/).filter(Boolean).length}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Est. Speaking Time</span><span className="font-mono">{Math.round(aiScriptInput.split(/\s+/).filter(Boolean).length / 2.5)}s</span></div>
                  <div className="flex justify-between"><span className="text-muted">Scenes Generated</span><span className="font-mono">{aiScriptScenes.length}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Reading Level</span><span className="font-mono">Grade 8</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Audio Mixer Sub-Tab */}
        {createSubTab === "audio-mixer" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <div className="card">
                <h2 className="section-header flex items-center gap-2"><Music size={13} className="text-gold" /> Audio Mixer</h2>
                <p className="text-[9px] text-muted mb-3">Layer background music, voiceover, and sound effects with individual volume controls.</p>
                <div className="space-y-4">
                  {/* Background Music Layer */}
                  <div className="p-3 rounded-xl border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Music size={12} className="text-gold" />
                        <span className="text-[10px] font-semibold">Background Music</span>
                      </div>
                      <label className="flex items-center gap-1.5 text-[9px] text-muted cursor-pointer">
                        <input type="checkbox" checked={audioLayers.bgMusic.enabled}
                          onChange={e => setAudioLayers(prev => ({ ...prev, bgMusic: { ...prev.bgMusic, enabled: e.target.checked } }))}
                          className="rounded border-border text-gold focus:ring-gold/30" />
                        Enabled
                      </label>
                    </div>
                    <select
                      value={audioLayers.bgMusic.track}
                      onChange={e => setAudioLayers(prev => ({ ...prev, bgMusic: { ...prev.bgMusic, track: e.target.value } }))}
                      className="input text-[10px] w-full mb-2"
                    >
                      <option value="upbeat-corporate">Upbeat Corporate</option>
                      <option value="chill-lofi">Chill Lo-Fi</option>
                      <option value="cinematic-epic">Cinematic Epic</option>
                      <option value="acoustic-warm">Acoustic Warm</option>
                      <option value="electronic-pulse">Electronic Pulse</option>
                    </select>
                    <div className="flex items-center gap-2">
                      <Volume2 size={10} className="text-muted" />
                      <input type="range" min={0} max={100} value={audioLayers.bgMusic.volume}
                        onChange={e => setAudioLayers(prev => ({ ...prev, bgMusic: { ...prev.bgMusic, volume: parseInt(e.target.value) } }))}
                        className="flex-1 accent-gold h-1" />
                      <span className="text-[9px] font-mono w-8 text-right">{audioLayers.bgMusic.volume}%</span>
                    </div>
                  </div>

                  {/* Voiceover Layer */}
                  <div className="p-3 rounded-xl border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Mic size={12} className="text-gold" />
                        <span className="text-[10px] font-semibold">Voiceover</span>
                      </div>
                      <label className="flex items-center gap-1.5 text-[9px] text-muted cursor-pointer">
                        <input type="checkbox" checked={audioLayers.voiceover.enabled}
                          onChange={e => setAudioLayers(prev => ({ ...prev, voiceover: { ...prev.voiceover, enabled: e.target.checked } }))}
                          className="rounded border-border text-gold focus:ring-gold/30" />
                        Enabled
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Volume2 size={10} className="text-muted" />
                      <input type="range" min={0} max={100} value={audioLayers.voiceover.volume}
                        onChange={e => setAudioLayers(prev => ({ ...prev, voiceover: { ...prev.voiceover, volume: parseInt(e.target.value) } }))}
                        className="flex-1 accent-gold h-1" />
                      <span className="text-[9px] font-mono w-8 text-right">{audioLayers.voiceover.volume}%</span>
                    </div>
                  </div>

                  {/* SFX Layer */}
                  <div className="p-3 rounded-xl border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Zap size={12} className="text-gold" />
                        <span className="text-[10px] font-semibold">Sound Effects</span>
                      </div>
                      <label className="flex items-center gap-1.5 text-[9px] text-muted cursor-pointer">
                        <input type="checkbox" checked={audioLayers.sfx.enabled}
                          onChange={e => setAudioLayers(prev => ({ ...prev, sfx: { ...prev.sfx, enabled: e.target.checked } }))}
                          className="rounded border-border text-gold focus:ring-gold/30" />
                        Enabled
                      </label>
                    </div>
                    <select
                      value={audioLayers.sfx.track}
                      onChange={e => setAudioLayers(prev => ({ ...prev, sfx: { ...prev.sfx, track: e.target.value } }))}
                      className="input text-[10px] w-full mb-2"
                    >
                      <option value="whoosh-transitions">Whoosh Transitions</option>
                      <option value="pop-notifications">Pop Notifications</option>
                      <option value="click-ui">Click UI</option>
                      <option value="swoosh-subtle">Swoosh Subtle</option>
                      <option value="impact-bass">Impact Bass</option>
                    </select>
                    <div className="flex items-center gap-2">
                      <Volume2 size={10} className="text-muted" />
                      <input type="range" min={0} max={100} value={audioLayers.sfx.volume}
                        onChange={e => setAudioLayers(prev => ({ ...prev, sfx: { ...prev.sfx, volume: parseInt(e.target.value) } }))}
                        className="flex-1 accent-gold h-1" />
                      <span className="text-[9px] font-mono w-8 text-right">{audioLayers.sfx.volume}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Voiceover Generator */}
              <div className="card">
                <h2 className="section-header flex items-center gap-2"><Speech size={13} className="text-gold" /> AI Voiceover Generator</h2>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Voice</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {VOICEOVER_VOICES.map(v => (
                        <button key={v.id} onClick={() => setVoiceoverConfig(prev => ({ ...prev, voice: v.id }))}
                          className={`p-2 rounded-xl border text-left transition-all ${
                            voiceoverConfig.voice === v.id ? "border-gold/30 bg-gold/[0.05]" : "border-border hover:border-gold/15"
                          }`}>
                          <p className="text-[10px] font-semibold">{v.name}</p>
                          <p className="text-[8px] text-muted">{v.gender} - {v.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Voiceover Script</label>
                    <textarea
                      value={voiceoverConfig.script}
                      onChange={e => setVoiceoverConfig(prev => ({ ...prev, script: e.target.value }))}
                      rows={3}
                      className="input w-full text-xs"
                      placeholder="Enter the script for AI voiceover generation..."
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Speed</label>
                      <div className="flex items-center gap-2">
                        <input type="range" min={0.5} max={2} step={0.1} value={voiceoverConfig.speed}
                          onChange={e => setVoiceoverConfig(prev => ({ ...prev, speed: parseFloat(e.target.value) }))}
                          className="flex-1 accent-gold h-1" />
                        <span className="text-[9px] font-mono w-8">{voiceoverConfig.speed}x</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => {
                    if (!voiceoverConfig.script.trim()) { toast.error("Enter a voiceover script"); return; }
                    setVoiceoverConfig(prev => ({ ...prev, generating: true }));
                    setTimeout(() => {
                      setVoiceoverConfig(prev => ({ ...prev, generating: false }));
                      setAudioLayers(prev => ({ ...prev, voiceover: { ...prev.voiceover, enabled: true } }));
                      toast.success("Voiceover generated!");
                    }, 2000);
                  }} disabled={voiceoverConfig.generating}
                    className="btn-primary text-[10px] flex items-center gap-1.5 w-full justify-center">
                    {voiceoverConfig.generating ? <Loader size={12} className="animate-spin" /> : <Mic size={12} />}
                    {voiceoverConfig.generating ? "Generating..." : "Generate Voiceover"}
                  </button>
                </div>
              </div>
            </div>

            {/* Audio Sidebar */}
            <div className="space-y-4">
              <div className="card border-gold/10">
                <h3 className="section-header flex items-center gap-2"><Sliders size={12} className="text-gold" /> Mix Summary</h3>
                <div className="space-y-2 text-[9px]">
                  <div className="flex justify-between items-center">
                    <span className="text-muted">Music</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 bg-surface-light rounded-full h-1.5">
                        <div className="bg-gold rounded-full h-1.5" style={{ width: `${audioLayers.bgMusic.volume}%` }} />
                      </div>
                      <span className={audioLayers.bgMusic.enabled ? "text-gold" : "text-muted"}>{audioLayers.bgMusic.volume}%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted">Voiceover</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 bg-surface-light rounded-full h-1.5">
                        <div className="bg-gold rounded-full h-1.5" style={{ width: `${audioLayers.voiceover.volume}%` }} />
                      </div>
                      <span className={audioLayers.voiceover.enabled ? "text-gold" : "text-muted"}>{audioLayers.voiceover.volume}%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted">SFX</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 bg-surface-light rounded-full h-1.5">
                        <div className="bg-gold rounded-full h-1.5" style={{ width: `${audioLayers.sfx.volume}%` }} />
                      </div>
                      <span className={audioLayers.sfx.enabled ? "text-gold" : "text-muted"}>{audioLayers.sfx.volume}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Advanced Sub-Tab */}
        {createSubTab === "advanced" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Color Grading Presets */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2"><SunMedium size={13} className="text-gold" /> Color Grading Presets</h2>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setColorGrading("none")}
                  className={`p-2.5 rounded-xl border text-left transition-all ${colorGrading === "none" ? "border-gold/30 bg-gold/[0.05]" : "border-border hover:border-gold/15"}`}>
                  <p className="text-[10px] font-semibold">None</p>
                  <p className="text-[8px] text-muted">Original colors</p>
                </button>
                {COLOR_PRESETS.map(preset => (
                  <button key={preset.id} onClick={() => setColorGrading(preset.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      colorGrading === preset.id ? "border-gold/30 bg-gold/[0.05]" : "border-border hover:border-gold/15"
                    }`}>
                    <div className="flex items-center gap-1 mb-1">
                      {preset.colors.map((c, i) => (
                        <div key={i} className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <p className="text-[10px] font-semibold">{preset.name}</p>
                    <p className="text-[8px] text-muted">{preset.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Subtitle Style Editor */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2"><Type size={13} className="text-gold" /> Subtitle Style Editor</h2>
              <div className="space-y-3">
                <div className="bg-surface-light rounded-xl p-4 text-center relative" style={{ minHeight: 120 }}>
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/30 rounded-xl" />
                  <div className={`absolute left-0 right-0 px-4 ${
                    subtitlePreview.position === "top" ? "top-3" : subtitlePreview.position === "center" ? "top-1/2 -translate-y-1/2" : "bottom-3"
                  }`}>
                    <span className={`inline-block px-3 py-1.5 rounded-lg font-semibold ${
                      subtitlePreview.size === "small" ? "text-[10px]" : subtitlePreview.size === "large" ? "text-[16px]" : "text-[13px]"
                    }`} style={{
                      backgroundColor: `rgba(0,0,0,${subtitlePreview.bgOpacity / 100})`,
                      fontFamily: subtitlePreview.font,
                      color: "white",
                    }}>
                      This is a subtitle preview
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(["top", "center", "bottom"] as const).map(pos => (
                    <button key={pos} onClick={() => setSubtitlePreview(prev => ({ ...prev, position: pos }))}
                      className={`text-[9px] p-1.5 rounded-lg border transition-all capitalize ${
                        subtitlePreview.position === pos ? "border-gold/30 bg-gold/[0.05] text-gold" : "border-border text-muted"
                      }`}>{pos}</button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[8px] text-muted uppercase mb-1">Font</label>
                    <select value={subtitlePreview.font} onChange={e => setSubtitlePreview(prev => ({ ...prev, font: e.target.value }))} className="input text-[10px] w-full">
                      <option value="Inter">Inter</option>
                      <option value="Roboto Mono">Roboto Mono</option>
                      {FONT_PRESETS.map(f => (
                        <option key={f.id} value={f.family}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[8px] text-muted uppercase mb-1">Size</label>
                    <select value={subtitlePreview.size} onChange={e => setSubtitlePreview(prev => ({ ...prev, size: e.target.value as "small" | "medium" | "large" }))} className="input text-[10px] w-full">
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                      <option value="large">Large</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[8px] text-muted uppercase mb-1">Background Opacity</label>
                  <div className="flex items-center gap-2">
                    <input type="range" min={0} max={100} value={subtitlePreview.bgOpacity}
                      onChange={e => setSubtitlePreview(prev => ({ ...prev, bgOpacity: parseInt(e.target.value) }))}
                      className="flex-1 accent-gold h-1" />
                    <span className="text-[9px] font-mono w-8">{subtitlePreview.bgOpacity}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Text Animation Presets */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2"><TextCursorInput size={13} className="text-gold" /> Text Animation Presets</h2>
              <div className="grid grid-cols-4 gap-1.5">
                {TEXT_ANIMATIONS.map(anim => (
                  <button key={anim.id} onClick={() => setSelectedTextAnimation(anim.id)}
                    className={`text-[9px] p-2 rounded-lg border transition-all text-center ${
                      selectedTextAnimation === anim.id ? "border-gold/30 bg-gold/[0.05] text-gold font-semibold" : "border-border text-muted hover:text-foreground"
                    }`}>
                    {anim.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Watermark Settings */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2"><Droplets size={13} className="text-gold" /> Watermark Settings</h2>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-[10px] text-muted cursor-pointer">
                  <input type="checkbox" checked={watermarkSettings.enabled}
                    onChange={e => setWatermarkSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                    className="rounded border-border text-gold focus:ring-gold/30" />
                  Enable Watermark
                </label>
                {watermarkSettings.enabled && (
                  <>
                    <div>
                      <label className="block text-[8px] text-muted uppercase mb-1">Watermark Text</label>
                      <input value={watermarkSettings.text}
                        onChange={e => setWatermarkSettings(prev => ({ ...prev, text: e.target.value }))}
                        className="input w-full text-xs" placeholder="@yourbrand" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[8px] text-muted uppercase mb-1">Position</label>
                        <select value={watermarkSettings.position}
                          onChange={e => setWatermarkSettings(prev => ({ ...prev, position: e.target.value as typeof watermarkSettings.position }))}
                          className="input text-[10px] w-full">
                          <option value="top-left">Top Left</option>
                          <option value="top-right">Top Right</option>
                          <option value="bottom-left">Bottom Left</option>
                          <option value="bottom-right">Bottom Right</option>
                          <option value="center">Center</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[8px] text-muted uppercase mb-1">Size</label>
                        <select value={watermarkSettings.size}
                          onChange={e => setWatermarkSettings(prev => ({ ...prev, size: e.target.value as typeof watermarkSettings.size }))}
                          className="input text-[10px] w-full">
                          <option value="small">Small</option>
                          <option value="medium">Medium</option>
                          <option value="large">Large</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[8px] text-muted uppercase mb-1">Opacity</label>
                      <div className="flex items-center gap-2">
                        <input type="range" min={10} max={100} value={watermarkSettings.opacity}
                          onChange={e => setWatermarkSettings(prev => ({ ...prev, opacity: parseInt(e.target.value) }))}
                          className="flex-1 accent-gold h-1" />
                        <span className="text-[9px] font-mono w-8">{watermarkSettings.opacity}%</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Aspect Ratio Converter */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2"><Ratio size={13} className="text-gold" /> Aspect Ratio Converter</h2>
              <p className="text-[9px] text-muted mb-3">One-click convert between aspect ratios with smart cropping.</p>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {(["9:16", "16:9", "1:1", "4:5"] as const).map(ratio => (
                  <button key={ratio} onClick={() => {
                    setAspectRatioConverter(prev => ({ ...prev, to: ratio }));
                    setConfig(prev => ({ ...prev, aspect_ratio: ratio }));
                    toast.success(`Aspect ratio set to ${ratio}`);
                  }}
                    className={`p-2 rounded-xl border text-center transition-all ${
                      config.aspect_ratio === ratio ? "border-gold/30 bg-gold/[0.05]" : "border-border hover:border-gold/15"
                    }`}>
                    <div className={`mx-auto mb-1 border border-current rounded ${
                      ratio === "9:16" ? "w-4 h-7" : ratio === "16:9" ? "w-7 h-4" : ratio === "4:5" ? "w-5 h-6" : "w-5 h-5"
                    } ${config.aspect_ratio === ratio ? "text-gold" : "text-muted"}`} />
                    <p className="text-[9px] font-semibold">{ratio}</p>
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-[8px] text-muted uppercase mb-1">Crop Mode</label>
                <div className="grid grid-cols-4 gap-1">
                  {(["smart", "center", "top", "bottom"] as const).map(mode => (
                    <button key={mode} onClick={() => setAspectRatioConverter(prev => ({ ...prev, cropMode: mode }))}
                      className={`text-[8px] p-1.5 rounded-lg border capitalize transition-all ${
                        aspectRatioConverter.cropMode === mode ? "border-gold/30 bg-gold/[0.05] text-gold" : "border-border text-muted"
                      }`}>{mode}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Green Screen Backgrounds */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2"><MonitorPlay size={13} className="text-gold" /> Green Screen Backgrounds</h2>
              <div className="grid grid-cols-2 gap-1.5">
                <button onClick={() => setGreenScreenBg("none")}
                  className={`text-[9px] p-2 rounded-lg border transition-all ${greenScreenBg === "none" ? "border-gold/30 bg-gold/[0.05] text-gold" : "border-border text-muted"}`}>
                  None
                </button>
                {GREEN_SCREEN_BG.map(bg => (
                  <button key={bg.id} onClick={() => setGreenScreenBg(bg.id)}
                    className={`text-[9px] p-2 rounded-lg border transition-all text-left ${
                      greenScreenBg === bg.id ? "border-gold/30 bg-gold/[0.05] text-gold" : "border-border text-muted hover:text-foreground"
                    }`}>
                    <p className="font-semibold">{bg.name}</p>
                    <p className="text-[8px] opacity-70">{bg.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Smart Presets Sub-Tab — MASSIVE upgrade with captions, animations, motion, transitions, color, audio, smart features */}
        {createSubTab === "smart" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-3">

              {/* === YouTuber Styles Panel (FIRST) === */}
              <CollapsiblePanel
                id="youtuberStyles"
                icon={<Star size={13} className="text-gold" />}
                title="YouTuber Styles"
                desc="One-click presets that emulate popular creators' editing styles"
                open={openPanels.youtuberStyles}
                onToggle={() => togglePanel("youtuberStyles")}
                badge={selectedYouTuberPreset ? 1 : 0}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-[9px] text-muted">
                    {YOUTUBER_PRESETS.length} creator presets — click any card to apply a full suite of caption, motion, color, audio, and smart settings
                  </p>
                  {selectedYouTuberPreset && (
                    <span className="text-[9px] bg-gold/10 text-gold px-2 py-0.5 rounded-full font-mono border border-gold/20">
                      {YOUTUBER_PRESETS.find(p => p.id === selectedYouTuberPreset)?.name} active
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {/* Ads preset — our signature ad template, promoted to the top */}
                  <div
                    key="ads"
                    className={`group relative rounded-lg border overflow-hidden transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-lg ${adsPresetActive ? "border-red-400 ring-2 ring-red-400/40" : "border-red-500/40 hover:border-red-400"}`}
                    onClick={applyAdsPreset}
                    title={ADS_PRESET.description}
                  >
                    <div className="h-12 w-full bg-gradient-to-br from-red-600 via-black to-amber-500 relative flex items-center justify-center">
                      <div className="absolute inset-0 bg-black/10" />
                      <span className="text-white font-black tracking-widest text-[10px] relative z-10">ADS</span>
                      {adsPresetActive && (
                        <div className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 z-10">
                          <Check size={10} />
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <h4 className="text-[10px] font-bold leading-tight flex items-center gap-1">
                        <Megaphone size={10} className="text-red-500" /> {ADS_PRESET.name}
                      </h4>
                      <p className="text-[8px] text-muted mt-0.5 leading-tight line-clamp-2">
                        Bold display type, hard cuts, kinetic captions — IG Reels / TikTok ads
                      </p>
                      <div className="flex flex-wrap gap-0.5 mt-1.5">
                        <span className="text-[7px] bg-red-500/10 text-red-400 px-1 py-0.5 rounded font-mono">9:16</span>
                        <span className="text-[7px] bg-red-500/10 text-red-400 px-1 py-0.5 rounded font-mono">Fast-Cut</span>
                        <span className="text-[7px] bg-red-500/10 text-red-400 px-1 py-0.5 rounded font-mono">Kinetic</span>
                      </div>
                    </div>
                  </div>
                  {YOUTUBER_PRESETS.map(preset => {
                    const active = selectedYouTuberPreset === preset.id;
                    return (
                      <div
                        key={preset.id}
                        className={`group relative rounded-lg border overflow-hidden transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-lg ${active ? "border-gold ring-2 ring-gold/40" : "border-border hover:border-gold/30"}`}
                        onClick={() => applyYouTuberPreset(preset)}
                      >
                        {/* Visual preview gradient */}
                        <div className={`h-12 w-full ${preset.preview} relative`}>
                          <div className="absolute inset-0 bg-black/10" />
                          {active && (
                            <div className="absolute top-1 right-1 bg-gold text-black rounded-full p-0.5">
                              <Check size={10} />
                            </div>
                          )}
                          {/* Preview button on hover (no-op placeholder) */}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); }}
                            className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-[8px] bg-black/60 text-white px-1.5 py-0.5 rounded border border-white/10"
                          >
                            <Eye size={8} className="inline-block mr-0.5" />
                            Preview
                          </button>
                        </div>
                        <div className="p-2">
                          <h4 className="text-[10px] font-bold leading-tight">{preset.name}</h4>
                          <p className="text-[8px] text-muted mt-0.5 leading-tight line-clamp-2">{preset.tagline}</p>
                          <div className="flex flex-wrap gap-0.5 mt-1.5">
                            {preset.tags.map((tag, i) => (
                              <span key={i} className="text-[7px] bg-surface-light text-muted px-1 py-0.5 rounded font-mono">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Custom / Reset card */}
                  <div
                    className={`group relative rounded-lg border-2 border-dashed overflow-hidden transition-all cursor-pointer hover:-translate-y-0.5 ${selectedYouTuberPreset === "" ? "border-gold/60 bg-gold/[0.03]" : "border-border hover:border-gold/30"}`}
                    onClick={resetYouTuberPreset}
                  >
                    <div className="h-12 w-full bg-gradient-to-br from-surface-light via-surface to-surface-light flex items-center justify-center">
                      <Settings2 size={16} className="text-muted group-hover:text-gold transition-colors" />
                    </div>
                    <div className="p-2">
                      <h4 className="text-[10px] font-bold leading-tight">Custom</h4>
                      <p className="text-[8px] text-muted mt-0.5 leading-tight">Reset all settings to defaults and build your own look</p>
                      <div className="flex flex-wrap gap-0.5 mt-1.5">
                        <span className="text-[7px] bg-surface-light text-muted px-1 py-0.5 rounded font-mono">Reset</span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="mt-3 text-[8px] text-muted italic">
                  Tip: Applying a creator preset overwrites captions, motion, color, audio, transitions, smart flags, and aspect ratio in one click. Use the panels below to fine-tune further.
                </p>
              </CollapsiblePanel>

              {/* === Ads Pack Sidebar — B-roll, Music, Kinetic Captions === */}
              <CollapsiblePanel
                id="adsPack"
                icon={<Megaphone size={13} className="text-red-500" />}
                title="Ads Pack — B-roll, Music, Captions"
                desc="Script-driven helpers tuned for high-converting ads"
                open={openPanels.adsPack}
                onToggle={() => togglePanel("adsPack")}
                badge={(brollSuggestions.length ? 1 : 0) + (musicMatch ? 1 : 0) + (captionsResult ? 1 : 0)}
              >
                <div className="space-y-3">
                  {/* Top action row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={suggestBrollForScript}
                      disabled={brollSuggestLoading}
                      className="text-[10px] px-2.5 py-2 rounded-lg bg-surface-light hover:bg-red-500/10 border border-border hover:border-red-400 text-foreground hover-lift flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Claude reads the script and returns 3-5 timed B-roll moments"
                    >
                      {brollSuggestLoading ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} className="text-red-400" />}
                      Suggest B-roll
                    </button>
                    <button
                      type="button"
                      onClick={matchMusicForScript}
                      disabled={musicMatchLoading}
                      className="text-[10px] px-2.5 py-2 rounded-lg bg-surface-light hover:bg-red-500/10 border border-border hover:border-red-400 text-foreground hover-lift flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Claude picks a track from 20 curated royalty-free options"
                    >
                      {musicMatchLoading ? <Loader2 size={12} className="animate-spin" /> : <Music size={12} className="text-red-400" />}
                      Match Music
                    </button>
                    <button
                      type="button"
                      onClick={() => generateKineticCaptions()}
                      disabled={captionsLoading}
                      className="text-[10px] px-2.5 py-2 rounded-lg bg-surface-light hover:bg-red-500/10 border border-border hover:border-red-400 text-foreground hover-lift flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Whisper transcribes video → kinetic word-by-word captions"
                    >
                      {captionsLoading ? <Loader2 size={12} className="animate-spin" /> : <Captions size={12} className="text-red-400" />}
                      Generate Captions
                    </button>
                  </div>

                  {/* Caption style selector + optional video URL */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[8px] text-muted uppercase mb-1">Caption Style</label>
                      <div className="grid grid-cols-3 gap-1">
                        {(["kinetic", "classic", "highlight"] as const).map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setCaptionsStyle(s)}
                            className={`text-[9px] px-2 py-1.5 rounded border capitalize transition-all ${captionsStyle === s ? "border-red-400 bg-red-500/10 text-red-400" : "border-border text-muted hover:text-foreground"}`}
                          >{s}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[8px] text-muted uppercase mb-1">Video URL (optional — uses render URL if empty)</label>
                      <input
                        value={captionsVideoUrl}
                        onChange={e => setCaptionsVideoUrl(e.target.value)}
                        placeholder="https://...mp4"
                        className="input text-[10px] py-1.5 w-full"
                      />
                    </div>
                  </div>

                  {/* B-roll suggestions chip list */}
                  {brollSuggestions.length > 0 && (
                    <div>
                      <h4 className="text-[9px] font-bold uppercase text-muted mb-1">B-roll Moments ({brollSuggestions.length})</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {brollSuggestions.map((b, i) => (
                          <div
                            key={i}
                            className={`text-[9px] px-2 py-1 rounded-lg border flex items-center gap-1.5 ${
                              b.priority === "high" ? "border-red-500/40 bg-red-500/10 text-red-300" :
                              b.priority === "medium" ? "border-amber-500/40 bg-amber-500/10 text-amber-300" :
                              "border-border bg-surface-light text-muted"
                            }`}
                            title={`${b.description}\nSearch: ${b.search_terms.join(", ")}`}
                          >
                            <span className="font-mono">{b.time_range[0]}s-{b.time_range[1]}s</span>
                            <span className="max-w-[200px] truncate">{b.description}</span>
                            {b.pexels_video_url && <Check size={9} className="text-emerald-400" />}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Music match card */}
                  {musicMatch && (
                    <div className="p-2.5 rounded-lg border border-red-500/30 bg-red-500/[0.05]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Music size={14} className="text-red-400" />
                          <div>
                            <h4 className="text-[10px] font-bold">{musicMatch.title}</h4>
                            <p className="text-[8px] text-muted">
                              {musicMatch.mood} • {musicMatch.bpm} BPM • {musicMatch.duration_sec}s
                            </p>
                          </div>
                        </div>
                        <a
                          href={musicMatch.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[8px] px-2 py-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30"
                        >Preview</a>
                      </div>
                    </div>
                  )}

                  {/* Caption preview */}
                  {captionsResult && (
                    <div className="p-2.5 rounded-lg border border-border bg-surface-light">
                      <h4 className="text-[9px] font-bold uppercase text-muted mb-1.5">
                        Caption Track ({captionsResult.style}) — {captionsResult.words.length} words
                      </h4>
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                        {captionsResult.words.slice(0, 60).map((w, i) => (
                          <span
                            key={i}
                            className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${w.emphasis ? "bg-yellow-400 text-black font-bold" : "bg-surface text-muted"}`}
                            title={`${w.start_ms}ms – ${w.end_ms}ms`}
                          >{w.text}</span>
                        ))}
                        {captionsResult.words.length > 60 && (
                          <span className="text-[8px] text-muted">+{captionsResult.words.length - 60} more…</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CollapsiblePanel>

              {/* === Smart Features Panel (TOP) === */}
              <CollapsiblePanel
                id="smart"
                icon={<Brain size={13} className="text-gold" />}
                title="Smart Editing Features"
                desc="AI-powered one-click editing shortcuts"
                open={openPanels.smart}
                onToggle={() => togglePanel("smart")}
                badge={(
                  [editorSettings.smart.autoCutSilence, editorSettings.smart.removeFillerWords, editorSettings.smart.autoChapters, editorSettings.smart.smartPacing, editorSettings.smart.hookDetector, editorSettings.smart.viralMomentFinder, editorSettings.smart.autoBroll, editorSettings.smart.trendingAudioMatch].filter(Boolean).length
                ) + (editorSettings.smart.autoReframeRatio !== "none" ? 1 : 0)}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <ToggleRow
                    label="Auto-cut silence"
                    desc={`Remove pauses longer than ${editorSettings.smart.silenceThreshold}s`}
                    icon={<VolumeX size={11} />}
                    checked={editorSettings.smart.autoCutSilence}
                    onChange={(v) => setEditorSettings(p => ({ ...p, smart: { ...p.smart, autoCutSilence: v } }))}
                  />
                  <ToggleRow
                    label="Remove filler words"
                    desc="Strip 'um', 'uh', 'like'"
                    icon={<Wind size={11} />}
                    checked={editorSettings.smart.removeFillerWords}
                    onChange={(v) => setEditorSettings(p => ({ ...p, smart: { ...p.smart, removeFillerWords: v } }))}
                  />
                  <ToggleRow
                    label="Auto chapters"
                    desc="Detect scene changes → markers"
                    icon={<ListChecks size={11} />}
                    checked={editorSettings.smart.autoChapters}
                    onChange={(v) => setEditorSettings(p => ({ ...p, smart: { ...p.smart, autoChapters: v } }))}
                  />
                  <ToggleRow
                    label="Smart pacing"
                    desc="Adjust speed to content density"
                    icon={<Gauge size={11} />}
                    checked={editorSettings.smart.smartPacing}
                    onChange={(v) => setEditorSettings(p => ({ ...p, smart: { ...p.smart, smartPacing: v } }))}
                  />
                  <ToggleRow
                    label="Hook detector"
                    desc="AI finds best opening moment"
                    icon={<Flame size={11} />}
                    checked={editorSettings.smart.hookDetector}
                    onChange={(v) => setEditorSettings(p => ({ ...p, smart: { ...p.smart, hookDetector: v } }))}
                  />
                  <ToggleRow
                    label="Viral moment finder"
                    desc="Top 15–60s clips identified"
                    icon={<TrendingUp size={11} />}
                    checked={editorSettings.smart.viralMomentFinder}
                    onChange={(v) => setEditorSettings(p => ({ ...p, smart: { ...p.smart, viralMomentFinder: v } }))}
                  />
                  <ToggleRow
                    label="Auto B-roll suggestions"
                    desc="Cutaway stock footage ideas"
                    icon={<ImagePlus size={11} />}
                    checked={editorSettings.smart.autoBroll}
                    onChange={(v) => setEditorSettings(p => ({ ...p, smart: { ...p.smart, autoBroll: v } }))}
                  />
                  <ToggleRow
                    label="Trending audio match"
                    desc="Suggest trending sounds"
                    icon={<Waves size={11} />}
                    checked={editorSettings.smart.trendingAudioMatch}
                    onChange={(v) => setEditorSettings(p => ({ ...p, smart: { ...p.smart, trendingAudioMatch: v } }))}
                  />
                </div>

                {editorSettings.smart.autoCutSilence && (
                  <div className="mt-3 p-2 rounded-lg bg-surface-light">
                    <label className="block text-[8px] text-muted uppercase mb-1">Silence threshold (sec)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range" min={0.3} max={5} step={0.1}
                        value={editorSettings.smart.silenceThreshold}
                        onChange={e => setEditorSettings(p => ({ ...p, smart: { ...p.smart, silenceThreshold: parseFloat(e.target.value) } }))}
                        className="flex-1 accent-gold h-1"
                      />
                      <span className="text-[9px] font-mono text-gold w-10 text-right">{editorSettings.smart.silenceThreshold}s</span>
                    </div>
                  </div>
                )}

                <div className="mt-3 p-2 rounded-lg bg-surface-light">
                  <label className="block text-[8px] text-muted uppercase mb-1">Auto-reframe</label>
                  <div className="grid grid-cols-4 gap-1">
                    {(["none", "9:16", "1:1", "16:9"] as const).map(r => (
                      <button key={r} onClick={() => setEditorSettings(p => ({ ...p, smart: { ...p.smart, autoReframeRatio: r } }))}
                        className={`text-[9px] py-1 rounded-lg border transition-all ${editorSettings.smart.autoReframeRatio === r ? "border-gold/40 bg-gold/10 text-gold font-semibold" : "border-border text-muted"}`}>
                        {r === "none" ? "Off" : r}
                      </button>
                    ))}
                  </div>
                </div>
              </CollapsiblePanel>

              {/* === Captions / Subtitles Panel === */}
              <CollapsiblePanel
                id="captions"
                icon={<Captions size={13} className="text-gold" />}
                title="Captions & Subtitles"
                desc="Auto-generate and style captions from audio"
                open={openPanels.captions}
                onToggle={() => togglePanel("captions")}
                enabledToggle={{
                  value: editorSettings.captions.enabled,
                  onChange: (v) => setEditorSettings(p => ({ ...p, captions: { ...p.captions, enabled: v } })),
                }}
              >
                {editorSettings.captions.enabled && (
                  <div className="space-y-3">
                    <ToggleRow
                      label="Auto-caption from audio"
                      desc="Generate captions by transcription"
                      icon={<Bot size={11} />}
                      checked={editorSettings.captions.autoGenerate}
                      onChange={(v) => setEditorSettings(p => ({ ...p, captions: { ...p.captions, autoGenerate: v } }))}
                    />

                    <div>
                      <label className="block text-[9px] text-muted uppercase tracking-wider mb-1.5">Caption Style Preset</label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {ADVANCED_CAPTION_PRESETS.map(preset => {
                          const active = editorSettings.captions.preset === preset.id;
                          return (
                            <button
                              key={preset.id}
                              onClick={() => setEditorSettings(p => ({
                                ...p,
                                captions: {
                                  ...p.captions,
                                  preset: preset.id,
                                  fontSize: preset.size,
                                  textColor: preset.color,
                                  strokeColor: preset.stroke === "transparent" ? "#000000" : preset.stroke,
                                  backdropColor: preset.bg,
                                  position: preset.position as "top" | "center" | "bottom",
                                },
                              }))}
                              className={`p-2 rounded-xl border text-left transition-all ${active ? "border-gold/40 bg-gold/[0.06]" : "border-border hover:border-gold/15"}`}
                            >
                              <div
                                className="mb-1.5 rounded-md flex items-center justify-center h-8 relative overflow-hidden"
                                style={{ background: "linear-gradient(135deg, #222 0%, #333 100%)" }}
                              >
                                <span
                                  className="text-[9px] font-bold"
                                  style={{
                                    color: preset.color,
                                    WebkitTextStroke: preset.stroke !== "transparent" ? `0.5px ${preset.stroke}` : undefined,
                                    fontStyle: preset.id === "cinematic" ? "italic" : undefined,
                                    textTransform: preset.id === "meme_impact" ? "uppercase" : undefined,
                                    fontFamily: preset.id === "meme_impact" ? "Impact, sans-serif" : undefined,
                                    backgroundColor: preset.bg !== "transparent" ? preset.bg : undefined,
                                    padding: preset.bg !== "transparent" ? "1px 4px" : undefined,
                                    borderRadius: preset.bg !== "transparent" ? 3 : 0,
                                  }}
                                >
                                  Sample
                                </span>
                              </div>
                              <p className="text-[10px] font-semibold">{preset.name}</p>
                              <p className="text-[8px] text-muted">{preset.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[8px] text-muted uppercase mb-1">Font Family</label>
                        <select
                          value={editorSettings.captions.fontFamily}
                          onChange={e => setEditorSettings(p => ({ ...p, captions: { ...p.captions, fontFamily: e.target.value } }))}
                          className="input text-[10px] w-full"
                        >
                          {CAPTION_FONT_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[8px] text-muted uppercase mb-1">Font Size ({editorSettings.captions.fontSize}px)</label>
                        <input
                          type="range" min={12} max={120} step={1}
                          value={editorSettings.captions.fontSize}
                          onChange={e => setEditorSettings(p => ({ ...p, captions: { ...p.captions, fontSize: parseInt(e.target.value) } }))}
                          className="w-full accent-gold h-1"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[8px] text-muted uppercase mb-1">Text Color</label>
                        <input type="color" value={editorSettings.captions.textColor}
                          onChange={e => setEditorSettings(p => ({ ...p, captions: { ...p.captions, textColor: e.target.value } }))}
                          className="w-full h-7 rounded border border-border" />
                      </div>
                      <div>
                        <label className="block text-[8px] text-muted uppercase mb-1">Stroke Color</label>
                        <input type="color" value={editorSettings.captions.strokeColor}
                          onChange={e => setEditorSettings(p => ({ ...p, captions: { ...p.captions, strokeColor: e.target.value } }))}
                          className="w-full h-7 rounded border border-border" />
                      </div>
                      <div>
                        <label className="block text-[8px] text-muted uppercase mb-1">Backdrop</label>
                        <input type="color" value={editorSettings.captions.backdropColor === "transparent" ? "#000000" : editorSettings.captions.backdropColor}
                          onChange={e => setEditorSettings(p => ({ ...p, captions: { ...p.captions, backdropColor: e.target.value } }))}
                          className="w-full h-7 rounded border border-border" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[8px] text-muted uppercase mb-1">Stroke Width ({editorSettings.captions.strokeWidth}px)</label>
                        <input type="range" min={0} max={12} step={1}
                          value={editorSettings.captions.strokeWidth}
                          onChange={e => setEditorSettings(p => ({ ...p, captions: { ...p.captions, strokeWidth: parseInt(e.target.value) } }))}
                          className="w-full accent-gold h-1" />
                      </div>
                      <div>
                        <label className="block text-[8px] text-muted uppercase mb-1">Max Words Per Line</label>
                        <input type="number" min={1} max={20}
                          value={editorSettings.captions.maxWordsPerLine}
                          onChange={e => setEditorSettings(p => ({ ...p, captions: { ...p.captions, maxWordsPerLine: parseInt(e.target.value) || 4 } }))}
                          className="input text-[10px] w-full" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[8px] text-muted uppercase mb-1">Position</label>
                      <div className="grid grid-cols-4 gap-1">
                        {(["top", "center", "bottom", "custom"] as const).map(pos => (
                          <button key={pos} onClick={() => setEditorSettings(p => ({ ...p, captions: { ...p.captions, position: pos } }))}
                            className={`text-[9px] py-1.5 rounded-lg border capitalize transition-all ${editorSettings.captions.position === pos ? "border-gold/40 bg-gold/10 text-gold font-semibold" : "border-border text-muted"}`}>
                            {pos}
                          </button>
                        ))}
                      </div>
                      {editorSettings.captions.position === "custom" && (
                        <div className="mt-2">
                          <label className="block text-[8px] text-muted uppercase mb-1">Custom Y ({editorSettings.captions.customY}%)</label>
                          <input type="range" min={0} max={100}
                            value={editorSettings.captions.customY}
                            onChange={e => setEditorSettings(p => ({ ...p, captions: { ...p.captions, customY: parseInt(e.target.value) } }))}
                            className="w-full accent-gold h-1" />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <ToggleRow
                        label="Emphasize keywords"
                        desc="Highlight key words in gold"
                        icon={<Star size={11} />}
                        checked={editorSettings.captions.emphasizeKeywords}
                        onChange={(v) => setEditorSettings(p => ({ ...p, captions: { ...p.captions, emphasizeKeywords: v } }))}
                      />
                      <ToggleRow
                        label="Auto-insert emojis"
                        desc="Add contextual emojis"
                        icon={<Smile size={11} />}
                        checked={editorSettings.captions.autoEmoji}
                        onChange={(v) => setEditorSettings(p => ({ ...p, captions: { ...p.captions, autoEmoji: v } }))}
                      />
                    </div>
                  </div>
                )}
              </CollapsiblePanel>

              {/* === Text Animation Panel === */}
              <CollapsiblePanel
                id="textAnimation"
                icon={<TextCursorInput size={13} className="text-gold" />}
                title="Text Animations"
                desc="Entrance / exit animations for text layers"
                open={openPanels.textAnimation}
                onToggle={() => togglePanel("textAnimation")}
                enabledToggle={{
                  value: editorSettings.textAnimation.enabled,
                  onChange: (v) => setEditorSettings(p => ({ ...p, textAnimation: { ...p.textAnimation, enabled: v } })),
                }}
              >
                {editorSettings.textAnimation.enabled && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
                      {TEXT_ANIMATION_PRESETS.map(a => {
                        const active = editorSettings.textAnimation.preset === a.id;
                        return (
                          <button
                            key={a.id}
                            onClick={() => setEditorSettings(p => ({ ...p, textAnimation: { ...p.textAnimation, preset: a.id } }))}
                            className={`p-1.5 rounded-lg border text-center transition-all ${active ? "border-gold/40 bg-gold/10 text-gold font-semibold" : "border-border text-muted hover:border-gold/20"}`}
                          >
                            <p className="text-[9px] font-semibold leading-tight">{a.name}</p>
                            <p className="text-[7px] opacity-70 leading-tight mt-0.5">{a.desc}</p>
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[8px] text-muted uppercase mb-1">Duration ({editorSettings.textAnimation.duration}s)</label>
                        <input type="range" min={0.1} max={3} step={0.1}
                          value={editorSettings.textAnimation.duration}
                          onChange={e => setEditorSettings(p => ({ ...p, textAnimation: { ...p.textAnimation, duration: parseFloat(e.target.value) } }))}
                          className="w-full accent-gold h-1" />
                      </div>
                      <div>
                        <label className="block text-[8px] text-muted uppercase mb-1">Easing</label>
                        <select
                          value={editorSettings.textAnimation.easing}
                          onChange={e => setEditorSettings(p => ({ ...p, textAnimation: { ...p.textAnimation, easing: e.target.value } }))}
                          className="input text-[10px] w-full"
                        >
                          {ANIMATION_EASINGS.map(ease => <option key={ease} value={ease}>{ease}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </CollapsiblePanel>

              {/* === Motion / Zoom Panel === */}
              <CollapsiblePanel
                id="motion"
                icon={<Camera size={13} className="text-gold" />}
                title="Motion & Zoom Presets"
                desc="Camera movements and zoom effects"
                open={openPanels.motion}
                onToggle={() => togglePanel("motion")}
                enabledToggle={{
                  value: editorSettings.motion.enabled,
                  onChange: (v) => setEditorSettings(p => ({ ...p, motion: { ...p.motion, enabled: v } })),
                }}
              >
                {editorSettings.motion.enabled && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <ToggleRow
                        label="Auto-zoom on speakers"
                        desc="Zoom onto whoever's talking"
                        icon={<MousePointer2 size={11} />}
                        checked={editorSettings.motion.autoZoomSpeakers}
                        onChange={(v) => setEditorSettings(p => ({ ...p, motion: { ...p.motion, autoZoomSpeakers: v } }))}
                      />
                      <ToggleRow
                        label="Auto-reframe (faces)"
                        desc="Detect faces, auto-crop"
                        icon={<Crop size={11} />}
                        checked={editorSettings.motion.autoReframe}
                        onChange={(v) => setEditorSettings(p => ({ ...p, motion: { ...p.motion, autoReframe: v } }))}
                      />
                      <ToggleRow
                        label="Motion blur"
                        desc="Natural blur on movement"
                        icon={<Wind size={11} />}
                        checked={editorSettings.motion.motionBlur}
                        onChange={(v) => setEditorSettings(p => ({ ...p, motion: { ...p.motion, motionBlur: v } }))}
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] text-muted uppercase tracking-wider mb-1.5">Motion Preset</label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {MOTION_PRESETS.map(m => {
                          const active = editorSettings.motion.preset === m.id;
                          return (
                            <button key={m.id} onClick={() => setEditorSettings(p => ({ ...p, motion: { ...p.motion, preset: m.id } }))}
                              className={`p-2 rounded-xl border text-left transition-all ${active ? "border-gold/40 bg-gold/[0.06]" : "border-border hover:border-gold/15"}`}>
                              <p className="text-[10px] font-semibold">{m.name}</p>
                              <p className="text-[8px] text-muted">{m.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[8px] text-muted uppercase mb-1">Intensity ({editorSettings.motion.intensity}%)</label>
                      <input type="range" min={0} max={100}
                        value={editorSettings.motion.intensity}
                        onChange={e => setEditorSettings(p => ({ ...p, motion: { ...p.motion, intensity: parseInt(e.target.value) } }))}
                        className="w-full accent-gold h-1" />
                    </div>
                  </div>
                )}
              </CollapsiblePanel>

              {/* === Transitions Panel === */}
              <CollapsiblePanel
                id="transitions"
                icon={<ArrowUpDown size={13} className="text-gold" />}
                title="Transitions Library"
                desc="25+ transitions between clips"
                open={openPanels.transitions}
                onToggle={() => togglePanel("transitions")}
                enabledToggle={{
                  value: editorSettings.transitions.enabled,
                  onChange: (v) => setEditorSettings(p => ({ ...p, transitions: { ...p.transitions, enabled: v } })),
                }}
              >
                {editorSettings.transitions.enabled && (
                  <div className="space-y-3">
                    <ToggleRow
                      label="Auto transitions between cuts"
                      desc="Apply chosen preset to every cut automatically"
                      icon={<Sparkles size={11} />}
                      checked={editorSettings.transitions.autoBetweenCuts}
                      onChange={(v) => setEditorSettings(p => ({ ...p, transitions: { ...p.transitions, autoBetweenCuts: v } }))}
                    />
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
                      {TRANSITION_PRESETS.map(t => {
                        const active = editorSettings.transitions.preset === t.id;
                        return (
                          <button key={t.id}
                            onClick={() => setEditorSettings(p => ({ ...p, transitions: { ...p.transitions, preset: t.id } }))}
                            className={`p-1.5 rounded-lg border text-center transition-all ${active ? "border-gold/40 bg-gold/10 text-gold" : "border-border text-muted hover:border-gold/20"}`}>
                            <div
                              className="mx-auto mb-1 rounded h-5 w-full"
                              style={{ background: `linear-gradient(90deg, ${t.color}33, ${t.color}aa)` }}
                            />
                            <p className="text-[9px] font-semibold leading-tight">{t.name}</p>
                          </button>
                        );
                      })}
                    </div>
                    <div>
                      <label className="block text-[8px] text-muted uppercase mb-1">Duration ({editorSettings.transitions.duration}s)</label>
                      <input type="range" min={0.1} max={2} step={0.1}
                        value={editorSettings.transitions.duration}
                        onChange={e => setEditorSettings(p => ({ ...p, transitions: { ...p.transitions, duration: parseFloat(e.target.value) } }))}
                        className="w-full accent-gold h-1" />
                    </div>
                  </div>
                )}
              </CollapsiblePanel>

              {/* === Color Grading Panel === */}
              <CollapsiblePanel
                id="color"
                icon={<Palette size={13} className="text-gold" />}
                title="Color Grading"
                desc="LUTs and manual color controls"
                open={openPanels.color}
                onToggle={() => togglePanel("color")}
                enabledToggle={{
                  value: editorSettings.color.enabled,
                  onChange: (v) => setEditorSettings(p => ({ ...p, color: { ...p.color, enabled: v } })),
                }}
              >
                {editorSettings.color.enabled && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <ToggleRow
                        label="Auto color match"
                        desc="Harmonize multiple clips"
                        icon={<Palette size={11} />}
                        checked={editorSettings.color.autoColorMatch}
                        onChange={(v) => setEditorSettings(p => ({ ...p, color: { ...p.color, autoColorMatch: v } }))}
                      />
                      <ToggleRow
                        label="Auto white balance"
                        desc="Balance color temperature"
                        icon={<SunMedium size={11} />}
                        checked={editorSettings.color.autoWhiteBalance}
                        onChange={(v) => setEditorSettings(p => ({ ...p, color: { ...p.color, autoWhiteBalance: v } }))}
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] text-muted uppercase tracking-wider mb-1.5">LUT Preset</label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {COLOR_LUT_PRESETS.map(lut => {
                          const active = editorSettings.color.lut === lut.id;
                          return (
                            <button key={lut.id}
                              onClick={() => setEditorSettings(p => ({ ...p, color: { ...p.color, lut: lut.id } }))}
                              className={`p-2 rounded-xl border text-left transition-all ${active ? "border-gold/40 bg-gold/[0.06]" : "border-border hover:border-gold/15"}`}>
                              <div className="w-full h-6 rounded-md mb-1.5" style={{ background: lut.preview }} />
                              <p className="text-[10px] font-semibold">{lut.name}</p>
                              <p className="text-[8px] text-muted">{lut.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {([
                        { key: "brightness", label: "Brightness", min: -100, max: 100 },
                        { key: "contrast", label: "Contrast", min: -100, max: 100 },
                        { key: "saturation", label: "Saturation", min: -100, max: 100 },
                        { key: "temperature", label: "Temperature", min: -100, max: 100 },
                        { key: "tint", label: "Tint", min: -100, max: 100 },
                        { key: "highlights", label: "Highlights", min: -100, max: 100 },
                        { key: "shadows", label: "Shadows", min: -100, max: 100 },
                      ] as const).map(s => (
                        <div key={s.key}>
                          <div className="flex justify-between">
                            <label className="block text-[8px] text-muted uppercase mb-1">{s.label}</label>
                            <span className="text-[8px] font-mono text-gold">{editorSettings.color[s.key]}</span>
                          </div>
                          <input type="range" min={s.min} max={s.max}
                            value={editorSettings.color[s.key]}
                            onChange={e => setEditorSettings(p => ({ ...p, color: { ...p.color, [s.key]: parseInt(e.target.value) } }))}
                            className="w-full accent-gold h-1" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CollapsiblePanel>

              {/* === Audio / Music Panel === */}
              <CollapsiblePanel
                id="audio"
                icon={<Music size={13} className="text-gold" />}
                title="Audio & Music Enhancers"
                desc="Music, ducking, noise removal, beat sync"
                open={openPanels.audio}
                onToggle={() => togglePanel("audio")}
                enabledToggle={{
                  value: editorSettings.audio.enabled,
                  onChange: (v) => setEditorSettings(p => ({ ...p, audio: { ...p.audio, enabled: v } })),
                }}
              >
                {editorSettings.audio.enabled && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <ToggleRow
                        label="Auto-ducking"
                        desc="Music ducks under voice"
                        icon={<Volume2 size={11} />}
                        checked={editorSettings.audio.autoDucking}
                        onChange={(v) => setEditorSettings(p => ({ ...p, audio: { ...p.audio, autoDucking: v } }))}
                      />
                      <ToggleRow
                        label="Volume automation"
                        desc="Smooth volume curve"
                        icon={<Sliders size={11} />}
                        checked={editorSettings.audio.volumeAutomation}
                        onChange={(v) => setEditorSettings(p => ({ ...p, audio: { ...p.audio, volumeAutomation: v } }))}
                      />
                      <ToggleRow
                        label="Noise removal"
                        desc="Remove hum / hiss"
                        icon={<VolumeX size={11} />}
                        checked={editorSettings.audio.noiseRemoval}
                        onChange={(v) => setEditorSettings(p => ({ ...p, audio: { ...p.audio, noiseRemoval: v } }))}
                      />
                      <ToggleRow
                        label="Voice enhance"
                        desc="Boost clarity and presence"
                        icon={<Mic size={11} />}
                        checked={editorSettings.audio.voiceEnhance}
                        onChange={(v) => setEditorSettings(p => ({ ...p, audio: { ...p.audio, voiceEnhance: v } }))}
                      />
                      <ToggleRow
                        label="Auto-beat sync"
                        desc="Cut on music beats"
                        icon={<Waves size={11} />}
                        checked={editorSettings.audio.autoBeatSync}
                        onChange={(v) => setEditorSettings(p => ({ ...p, audio: { ...p.audio, autoBeatSync: v } }))}
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] text-muted uppercase tracking-wider mb-1.5">Background Music Genre</label>
                      <div className="grid grid-cols-3 md:grid-cols-4 gap-1.5">
                        {MUSIC_GENRE_PRESETS.map(g => {
                          const active = editorSettings.audio.bgGenre === g.id;
                          return (
                            <button key={g.id} onClick={() => setEditorSettings(p => ({ ...p, audio: { ...p.audio, bgGenre: g.id } }))}
                              className={`p-1.5 rounded-lg border text-center transition-all ${active ? "border-gold/40 bg-gold/10 text-gold font-semibold" : "border-border text-muted hover:border-gold/20"}`}>
                              <p className="text-[9px] font-semibold">{g.name}</p>
                              <p className="text-[7px] opacity-70">{g.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </CollapsiblePanel>

              {/* === Aspect Ratio Panel === */}
              <CollapsiblePanel
                id="aspect"
                icon={<Ratio size={13} className="text-gold" />}
                title="Aspect Ratio Presets"
                desc="Pick a canvas ratio"
                open={openPanels.aspect}
                onToggle={() => togglePanel("aspect")}
              >
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
                  {ASPECT_RATIO_PRESETS.map(ar => {
                    const active = editorSettings.aspect.preset === ar.id;
                    return (
                      <button key={ar.id}
                        onClick={() => {
                          setEditorSettings(p => ({ ...p, aspect: { ...p.aspect, preset: ar.id } }));
                          if (ar.id !== "custom") setConfig(prev => ({ ...prev, aspect_ratio: ar.id }));
                        }}
                        className={`p-2 rounded-xl border text-center transition-all ${active ? "border-gold/40 bg-gold/[0.06] text-gold" : "border-border text-muted hover:border-gold/20"}`}>
                        <div className="mx-auto mb-1 border border-current rounded" style={{ width: ar.w, height: ar.h }} />
                        <p className="text-[9px] font-semibold">{ar.name}</p>
                        <p className="text-[7px] opacity-70 leading-tight">{ar.desc}</p>
                      </button>
                    );
                  })}
                </div>
                {editorSettings.aspect.preset === "custom" && (
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div>
                      <label className="block text-[8px] text-muted uppercase mb-1">Custom W</label>
                      <input type="number" min={1} value={editorSettings.aspect.customW}
                        onChange={e => setEditorSettings(p => ({ ...p, aspect: { ...p.aspect, customW: parseInt(e.target.value) || 16 } }))}
                        className="input text-[10px] w-full" />
                    </div>
                    <div>
                      <label className="block text-[8px] text-muted uppercase mb-1">Custom H</label>
                      <input type="number" min={1} value={editorSettings.aspect.customH}
                        onChange={e => setEditorSettings(p => ({ ...p, aspect: { ...p.aspect, customH: parseInt(e.target.value) || 9 } }))}
                        className="input text-[10px] w-full" />
                    </div>
                  </div>
                )}
              </CollapsiblePanel>

              {/* === Overlays / Stickers Panel === */}
              <CollapsiblePanel
                id="overlays"
                icon={<Star size={13} className="text-gold" />}
                title="Overlays & Stickers"
                desc="Progress bars, CTAs, arrows, emojis"
                open={openPanels.overlays}
                onToggle={() => togglePanel("overlays")}
                enabledToggle={{
                  value: editorSettings.overlays.enabled,
                  onChange: (v) => setEditorSettings(p => ({ ...p, overlays: { ...p.overlays, enabled: v } })),
                }}
              >
                {editorSettings.overlays.enabled && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {OVERLAY_STICKER_PRESETS.map(ov => {
                      const active = editorSettings.overlays.selected.includes(ov.id);
                      return (
                        <button key={ov.id}
                          onClick={() => setEditorSettings(p => ({
                            ...p,
                            overlays: {
                              ...p.overlays,
                              selected: active
                                ? p.overlays.selected.filter(id => id !== ov.id)
                                : [...p.overlays.selected, ov.id],
                            },
                          }))}
                          className={`p-2 rounded-xl border text-left transition-all relative ${active ? "border-gold/40 bg-gold/[0.06]" : "border-border hover:border-gold/15"}`}>
                          {active && (
                            <div className="absolute top-1 right-1 w-3.5 h-3.5 bg-gold rounded-full flex items-center justify-center">
                              <Check size={7} className="text-white" />
                            </div>
                          )}
                          <p className="text-[10px] font-semibold">{ov.name}</p>
                          <p className="text-[8px] text-muted">{ov.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CollapsiblePanel>

              {/* === Platform-Optimized Export Presets === */}
              <CollapsiblePanel
                id="platformExport"
                icon={<Share2 size={13} className="text-gold" />}
                title="Platform Export Presets"
                desc="One-click platform optimization"
                open={openPanels.platformExport}
                onToggle={() => togglePanel("platformExport")}
              >
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {PLATFORM_EXPORT_PRESETS.map(p => {
                    const active = editorSettings.platformExport === p.id;
                    return (
                      <button key={p.id} onClick={() => applyPlatformExportPreset(p.id)}
                        className={`p-2 rounded-xl border text-left transition-all ${active ? "border-gold/40 bg-gold/[0.06]" : "border-border hover:border-gold/15"}`}>
                        <p className="text-[10px] font-semibold">{p.name}</p>
                        <p className="text-[8px] text-muted">{p.desc}</p>
                        <div className="flex gap-1 mt-1">
                          <span className="text-[7px] px-1 py-0.5 rounded bg-gold/10 text-gold">{p.aspect}</span>
                          <span className="text-[7px] px-1 py-0.5 rounded bg-surface-light text-muted">{p.maxDur}s max</span>
                          {p.captions && <span className="text-[7px] px-1 py-0.5 rounded bg-surface-light text-muted">CC baked</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Export formats + quality presets */}
                <div className="mt-4 pt-3 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-[10px] font-semibold mb-2 flex items-center gap-1.5">
                      <Download size={11} className="text-gold" /> Export Formats
                    </h4>
                    <div className="grid grid-cols-2 gap-1.5">
                      {EXPORT_FORMATS.map(fmt => {
                        const active = editorSettings.exportAdvanced.format === fmt.id;
                        return (
                          <button key={fmt.id}
                            onClick={() => setEditorSettings(prev => ({
                              ...prev,
                              exportAdvanced: { ...prev.exportAdvanced, format: fmt.id },
                            }))}
                            className={`p-2 rounded-lg border text-left transition-all ${active ? "border-gold/40 bg-gold/[0.06]" : "border-border hover:border-gold/15"}`}>
                            <p className="text-[9px] font-semibold">{fmt.name}</p>
                            <p className="text-[8px] text-muted mt-0.5 leading-tight">{fmt.desc}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-[10px] font-semibold mb-2 flex items-center gap-1.5">
                      <Gauge size={11} className="text-gold" /> Quality Presets
                    </h4>
                    <div className="grid grid-cols-1 gap-1.5">
                      {QUALITY_PRESETS.map(q => {
                        const active = editorSettings.exportAdvanced.quality === q.id;
                        return (
                          <button key={q.id}
                            onClick={() => setEditorSettings(prev => ({
                              ...prev,
                              exportAdvanced: { ...prev.exportAdvanced, quality: q.id },
                            }))}
                            className={`p-2 rounded-lg border text-left transition-all ${active ? "border-gold/40 bg-gold/[0.06]" : "border-border hover:border-gold/15"}`}>
                            <p className="text-[9px] font-semibold">{q.name}</p>
                            <p className="text-[8px] text-muted">{q.desc}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={openThumbnailEditor}
                    className="btn btn-sm w-full flex items-center justify-center gap-1.5"
                  >
                    <ImageIcon size={12} /> Extract Thumbnails from Current Video
                  </button>
                  <p className="text-[8px] text-muted mt-1 text-center">Opens thumbnail editor with auto-extracted frames</p>
                </div>
              </CollapsiblePanel>

              {/* === Effects Library (50+ VFX presets) === */}
              <CollapsiblePanel
                id="effects"
                icon={<Sparkles size={13} className="text-gold" />}
                title="Effects Library"
                desc={`${EFFECTS_LIBRARY.length} VFX presets across ${EFFECT_CATEGORIES.length} categories`}
                open={openPanels.effects}
                onToggle={() => togglePanel("effects")}
                badge={editorSettings.effects.active.length}
              >
                <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                  <div className="flex flex-wrap gap-1.5">
                    {["All", ...EFFECT_CATEGORIES].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setEffectCategoryFilter(cat)}
                        className={`text-[9px] px-2 py-1 rounded-lg border transition-all ${
                          effectCategoryFilter === cat
                            ? "bg-gold/10 text-gold border-gold/20 font-semibold"
                            : "text-muted border-border hover:border-gold/15"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  {editorSettings.effects.active.length > 0 && (
                    <button
                      type="button"
                      onClick={clearAllEffects}
                      className="text-[9px] text-muted hover:text-gold flex items-center gap-1"
                    >
                      <X size={10} /> Clear ({editorSettings.effects.active.length})
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {EFFECTS_LIBRARY.filter(fx => effectCategoryFilter === "All" || fx.category === effectCategoryFilter).map(fx => {
                    const active = editorSettings.effects.active.includes(fx.id);
                    const intensity = editorSettings.effects.intensity[fx.id] ?? 50;
                    return (
                      <div
                        key={fx.id}
                        className={`relative rounded-lg border overflow-hidden transition-all ${active ? "border-gold ring-1 ring-gold/30" : "border-border hover:border-gold/20"}`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleEffect(fx.id)}
                          className="block w-full text-left"
                          aria-label={`Toggle ${fx.name}`}
                        >
                          <div className={`h-10 w-full ${fx.preview} relative animate-pulse`}>
                            {active && (
                              <div className="absolute top-0.5 right-0.5 bg-gold text-black rounded-full p-0.5">
                                <Check size={8} />
                              </div>
                            )}
                          </div>
                          <div className="p-1.5">
                            <p className="text-[9px] font-semibold leading-tight">{fx.name}</p>
                            <p className="text-[7px] text-muted mt-0.5 leading-tight line-clamp-1">{fx.desc}</p>
                          </div>
                        </button>
                        {active && (
                          <div className="px-1.5 pb-1.5">
                            <label className="block text-[7px] text-muted mb-0.5">Intensity: {intensity}%</label>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={intensity}
                              onChange={(e) => setEffectIntensity(fx.id, Number(e.target.value))}
                              className="w-full accent-gold"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CollapsiblePanel>

              {/* === Voice & Narration Panel === */}
              <CollapsiblePanel
                id="voice"
                icon={<Mic size={13} className="text-gold" />}
                title="Voice & Narration"
                desc={`${VOICE_PRESETS.length} AI voices + cloning + tone controls`}
                open={openPanels.voice}
                onToggle={() => togglePanel("voice")}
                enabledToggle={{
                  value: editorSettings.voice.enabled,
                  onChange: v => setEditorSettings(prev => ({ ...prev, voice: { ...prev.voice, enabled: v } })),
                }}
              >
                {/* Voice preset grid */}
                <div className="mb-4">
                  <h4 className="text-[10px] font-semibold mb-2 flex items-center gap-1.5">
                    <Speech size={11} className="text-gold" /> Select a Voice Preset
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                    {VOICE_PRESETS.map(v => {
                      const active = editorSettings.voice.preset === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => selectVoicePreset(v.id)}
                          className={`p-2 rounded-lg border text-left transition-all ${active ? "border-gold/40 bg-gold/[0.06]" : "border-border hover:border-gold/15"}`}
                        >
                          <p className="text-[9px] font-semibold leading-tight">{v.name}</p>
                          <div className="flex gap-0.5 mt-1 flex-wrap">
                            <span className="text-[7px] px-1 py-0.5 rounded bg-gold/10 text-gold">{v.gender}</span>
                            <span className="text-[7px] px-1 py-0.5 rounded bg-surface-light text-muted">{v.style}</span>
                            <span className="text-[7px] px-1 py-0.5 rounded bg-surface-light text-muted">{v.accent}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Voice cloning */}
                <div className="mb-4 p-3 rounded-lg border border-border">
                  <h4 className="text-[10px] font-semibold mb-2 flex items-center gap-1.5">
                    <Upload size={11} className="text-gold" /> Voice Cloning
                  </h4>
                  <p className="text-[9px] text-muted mb-2">Upload a 30-second voice sample to clone the voice</p>
                  <input
                    ref={voiceSampleInputRef}
                    type="file"
                    accept="audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,.mp3,.wav,.m4a,.ogg"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length) handleVoiceSampleUpload(files);
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => voiceSampleInputRef.current?.click()}
                    className="btn btn-sm w-full flex items-center justify-center gap-1.5"
                  >
                    <Upload size={11} /> {editorSettings.voice.cloneSampleUrl ? "Sample Uploaded — Replace" : "Upload Voice Sample"}
                  </button>
                </div>

                {/* Tone controls */}
                <div className="mb-4 p-3 rounded-lg border border-border">
                  <h4 className="text-[10px] font-semibold mb-2 flex items-center gap-1.5">
                    <Sliders size={11} className="text-gold" /> Tone Controls
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] text-muted block mb-1">Pitch: {editorSettings.voice.pitch > 0 ? "+" : ""}{editorSettings.voice.pitch}</label>
                      <input
                        type="range"
                        min={-12}
                        max={12}
                        value={editorSettings.voice.pitch}
                        onChange={(e) => setEditorSettings(prev => ({ ...prev, voice: { ...prev.voice, pitch: Number(e.target.value) } }))}
                        className="w-full accent-gold"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-muted block mb-1">Speed: {editorSettings.voice.speed.toFixed(2)}x</label>
                      <input
                        type="range"
                        min={0.5}
                        max={2.0}
                        step={0.05}
                        value={editorSettings.voice.speed}
                        onChange={(e) => setEditorSettings(prev => ({ ...prev, voice: { ...prev.voice, speed: Number(e.target.value) } }))}
                        className="w-full accent-gold"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-muted block mb-1">Emphasis: {editorSettings.voice.emphasis}%</label>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={editorSettings.voice.emphasis}
                        onChange={(e) => setEditorSettings(prev => ({ ...prev, voice: { ...prev.voice, emphasis: Number(e.target.value) } }))}
                        className="w-full accent-gold"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-muted block mb-1">Pause Length: {editorSettings.voice.pauseLength}%</label>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={editorSettings.voice.pauseLength}
                        onChange={(e) => setEditorSettings(prev => ({ ...prev, voice: { ...prev.voice, pauseLength: Number(e.target.value) } }))}
                        className="w-full accent-gold"
                      />
                    </div>
                  </div>
                </div>

                {/* Script-to-voice preview */}
                <div className="p-3 rounded-lg border border-border">
                  <h4 className="text-[10px] font-semibold mb-2 flex items-center gap-1.5">
                    <MessageSquare size={11} className="text-gold" /> Script-to-Voice Preview
                  </h4>
                  <textarea
                    value={voiceScriptPreview}
                    onChange={(e) => setVoiceScriptPreview(e.target.value)}
                    placeholder="Type text to preview in the selected voice..."
                    rows={2}
                    className="input w-full text-[10px] resize-none mb-2"
                  />
                  <button
                    type="button"
                    onClick={previewVoiceScript}
                    disabled={voicePreviewLoading}
                    className="btn btn-sm w-full flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {voicePreviewLoading ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
                    {voicePreviewLoading ? "Generating..." : "Preview Voice"}
                  </button>
                </div>
              </CollapsiblePanel>

              {/* === B-Roll & Stock Footage === */}
              <CollapsiblePanel
                id="broll"
                icon={<Film size={13} className="text-gold" />}
                title="B-Roll & Stock"
                desc="Search stock libraries + AI match + upload custom clips"
                open={openPanels.broll}
                onToggle={() => togglePanel("broll")}
                enabledToggle={{
                  value: editorSettings.broll.enabled,
                  onChange: v => setEditorSettings(prev => ({ ...prev, broll: { ...prev.broll, enabled: v } })),
                }}
                badge={editorSettings.broll.selectedClips.length}
              >
                {/* Search bar */}
                <div className="mb-3">
                  <input
                    type="text"
                    placeholder="Search Pexels / Unsplash / Pixabay..."
                    value={editorSettings.broll.searchQuery}
                    onChange={(e) => setEditorSettings(prev => ({ ...prev, broll: { ...prev.broll, searchQuery: e.target.value } }))}
                    className="input w-full text-[10px]"
                  />
                </div>

                {/* Upload + Browse all */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setShowPresetPicker(true)}
                    className="btn btn-sm flex items-center justify-center gap-1.5"
                    title="Open the full B-roll browser (Cmd/Ctrl+K)"
                  >
                    <Sparkles size={11} className="text-gold" /> Browse all B-roll
                  </button>
                  <input
                    ref={brollFileInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,.mp4,.webm,.mov,.avi,.mkv"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length) handleBrollUpload(files);
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => brollFileInputRef.current?.click()}
                    className="btn btn-sm flex items-center justify-center gap-1.5"
                  >
                    <Upload size={11} /> Upload Custom B-Roll
                  </button>
                </div>

                {/* Stock library categories */}
                <div className="mb-3">
                  <h4 className="text-[10px] font-semibold mb-2">Stock Categories</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {STOCK_CATEGORIES.map(cat => {
                      const active = editorSettings.broll.activeCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => setEditorSettings(prev => ({ ...prev, broll: { ...prev.broll, activeCategory: cat.id } }))}
                          className={`text-[9px] px-2 py-1 rounded-lg border transition-all flex items-center gap-1 ${active ? "border-gold/40 bg-gold/[0.06] text-gold" : "border-border hover:border-gold/15 text-muted"}`}
                        >
                          <span>{cat.icon}</span> {cat.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Pointer to the real Preset Picker — previously this was a
                    grid of 8 fake gradient tiles. The real clip browser lives
                    in the sidebar at Cmd/Ctrl+K (Preset Picker). */}
                <div className="p-3 rounded-lg border border-dashed border-gold/25 bg-gold/[0.03] text-center">
                  <p className="text-[10px] text-muted mb-2">
                    {editorSettings.broll.selectedClips.length} clip{editorSettings.broll.selectedClips.length === 1 ? "" : "s"} selected. For the full library
                    (real Pexels / Pixabay results), open the Preset Picker.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowPresetPicker(true)}
                    className="text-[10px] px-3 py-1.5 rounded-lg border border-gold/30 bg-gold/10 text-gold hover:bg-gold/20 flex items-center justify-center gap-1.5 mx-auto"
                  >
                    <Wand2 size={10} /> Open Preset Picker <span className="text-[8px] opacity-70">⌘K</span>
                  </button>
                </div>
              </CollapsiblePanel>

              {/* === Advanced Timeline === */}
              <CollapsiblePanel
                id="advancedTimeline"
                icon={<Layers size={13} className="text-gold" />}
                title="Advanced Timeline"
                desc="Multi-track preview, keyframes, beat sync, audio ducking"
                open={openPanels.advancedTimeline}
                onToggle={() => togglePanel("advancedTimeline")}
              >
                {/* Feature toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-4">
                  <ToggleRow
                    label="Keyframe animation"
                    desc="Animate props over time with curves"
                    icon={<TrendingUp size={10} />}
                    checked={editorSettings.timeline.keyframes}
                    onChange={v => setEditorSettings(prev => ({ ...prev, timeline: { ...prev.timeline, keyframes: v } }))}
                  />
                  <ToggleRow
                    label="Scene-by-scene editing"
                    desc="Granular per-scene property overrides"
                    icon={<Layers size={10} />}
                    checked={editorSettings.timeline.sceneEditing}
                    onChange={v => setEditorSettings(prev => ({ ...prev, timeline: { ...prev.timeline, sceneEditing: v } }))}
                  />
                  <ToggleRow
                    label="Multi-track layout"
                    desc="Enable stacked tracks (video + audio + captions)"
                    icon={<LayoutGrid size={10} />}
                    checked={editorSettings.timeline.multiTrack}
                    onChange={v => setEditorSettings(prev => ({ ...prev, timeline: { ...prev.timeline, multiTrack: v } }))}
                  />
                  <ToggleRow
                    label="Sync to beat"
                    desc="Cut on detected music beats"
                    icon={<Waves size={10} />}
                    checked={editorSettings.timeline.syncToBeat}
                    onChange={v => setEditorSettings(prev => ({ ...prev, timeline: { ...prev.timeline, syncToBeat: v } }))}
                  />
                </div>

                {/* Audio ducking customization */}
                <div className="p-3 rounded-lg border border-border">
                  <h4 className="text-[10px] font-semibold mb-2 flex items-center gap-1.5">
                    <VolumeX size={11} className="text-gold" /> Audio Ducking
                  </h4>
                  <p className="text-[9px] text-muted mb-2">How much music volume ducks under voiceover (higher = quieter)</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={editorSettings.timeline.audioDucking}
                      onChange={(e) => setEditorSettings(prev => ({ ...prev, timeline: { ...prev.timeline, audioDucking: Number(e.target.value) } }))}
                      className="flex-1 accent-gold"
                    />
                    <span className="text-[10px] font-mono text-gold w-10 text-right">{editorSettings.timeline.audioDucking}%</span>
                  </div>
                </div>
              </CollapsiblePanel>

            </div>

            {/* Sidebar — active-config summary */}
            <div className="space-y-3">
              <div className="card border-gold/10">
                <h3 className="section-header flex items-center gap-2"><ListChecks size={12} className="text-gold" /> Active Config Summary</h3>
                <div className="space-y-1.5 text-[9px]">
                  <SummaryRow label="Captions" on={editorSettings.captions.enabled} value={editorSettings.captions.enabled ? ADVANCED_CAPTION_PRESETS.find(x => x.id === editorSettings.captions.preset)?.name : "off"} />
                  <SummaryRow label="Text Anim" on={editorSettings.textAnimation.enabled} value={editorSettings.textAnimation.enabled ? editorSettings.textAnimation.preset : "off"} />
                  <SummaryRow label="Motion" on={editorSettings.motion.enabled} value={editorSettings.motion.enabled ? editorSettings.motion.preset : "off"} />
                  <SummaryRow label="Transitions" on={editorSettings.transitions.enabled} value={editorSettings.transitions.enabled ? editorSettings.transitions.preset : "off"} />
                  <SummaryRow label="Color" on={editorSettings.color.enabled} value={editorSettings.color.enabled ? editorSettings.color.lut : "off"} />
                  <SummaryRow label="Audio" on={editorSettings.audio.enabled} value={editorSettings.audio.enabled ? editorSettings.audio.bgGenre : "off"} />
                  <SummaryRow label="Aspect" on={true} value={editorSettings.aspect.preset === "custom" ? `${editorSettings.aspect.customW}:${editorSettings.aspect.customH}` : editorSettings.aspect.preset} />
                  <SummaryRow label="Overlays" on={editorSettings.overlays.enabled && editorSettings.overlays.selected.length > 0} value={editorSettings.overlays.selected.length > 0 ? `${editorSettings.overlays.selected.length} selected` : "off"} />
                  <SummaryRow label="Platform" on={!!editorSettings.platformExport} value={editorSettings.platformExport || "none"} />
                  <SummaryRow label="Effects" on={editorSettings.effects.active.length > 0} value={editorSettings.effects.active.length > 0 ? `${editorSettings.effects.active.length} active` : "off"} />
                  <SummaryRow label="Voice" on={editorSettings.voice.enabled && !!editorSettings.voice.preset} value={editorSettings.voice.preset ? VOICE_PRESETS.find(v => v.id === editorSettings.voice.preset)?.name : "off"} />
                  <SummaryRow label="B-Roll" on={editorSettings.broll.enabled && editorSettings.broll.selectedClips.length > 0} value={editorSettings.broll.selectedClips.length > 0 ? `${editorSettings.broll.selectedClips.length} clips` : "off"} />
                  <SummaryRow label="Timeline" on={editorSettings.timeline.keyframes || editorSettings.timeline.multiTrack || editorSettings.timeline.syncToBeat} value={[editorSettings.timeline.keyframes && "keyframes", editorSettings.timeline.multiTrack && "multi-track", editorSettings.timeline.syncToBeat && "beat sync"].filter(Boolean).join(", ") || "off"} />
                  <SummaryRow label="Export" on={true} value={`${EXPORT_FORMATS.find(f => f.id === editorSettings.exportAdvanced.format)?.name || "H.264"} / ${QUALITY_PRESETS.find(q => q.id === editorSettings.exportAdvanced.quality)?.name || "1080p"}`} />
                </div>
              </div>

              <div className="card">
                <h3 className="section-header flex items-center gap-2"><Sparkles size={12} className="text-gold" /> Smart Flags</h3>
                <div className="space-y-1 text-[9px]">
                  {[
                    ["Cut silence", editorSettings.smart.autoCutSilence],
                    ["Filler word removal", editorSettings.smart.removeFillerWords],
                    ["Auto chapters", editorSettings.smart.autoChapters],
                    ["Smart pacing", editorSettings.smart.smartPacing],
                    ["Hook detector", editorSettings.smart.hookDetector],
                    ["Viral finder", editorSettings.smart.viralMomentFinder],
                    ["Auto B-roll", editorSettings.smart.autoBroll],
                    ["Trending audio", editorSettings.smart.trendingAudioMatch],
                  ].map(([label, on], i) => (
                    <div key={i} className="flex justify-between">
                      <span className="text-muted">{label as string}</span>
                      <span className={on ? "text-gold font-mono" : "text-muted/50 font-mono"}>{on ? "on" : "-"}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card border-gold/10">
                <h3 className="section-header flex items-center gap-2"><AlertCircle size={12} className="text-gold" /> Tips</h3>
                <ul className="text-[9px] text-muted space-y-1 list-disc pl-3.5">
                  <li>Every panel is optional — toggle only what you need.</li>
                  <li>Platform presets auto-set aspect, duration, and captions.</li>
                  <li>All settings pass through to the render backend on generate.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Main Editor (default sub-tab) */}
        {createSubTab === "editor" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {/* ─── Left-panel tabs: Style / Brand / AI / Assets ─────────
             *  Collapses the old wall of 4 accordions (Caption/Effects/SFX/
             *  Music + Brand + Details + AI Options + Style) into a single
             *  tab-switcher. Only one group renders at a time — this is the
             *  biggest win against the "every section is the same weight"
             *  complaint from the audit. */}
            <div className="tab-group">
              {([
                { id: "style" as const, label: "Style", icon: <Palette size={11} /> },
                { id: "brand" as const, label: "Brand", icon: <Paintbrush size={11} /> },
                { id: "ai" as const, label: "AI", icon: <Sparkles size={11} /> },
                { id: "assets" as const, label: "Assets", icon: <FileText size={11} /> },
              ]).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setEditorLeftTab(t.id)}
                  className={editorLeftTab === t.id ? "tab-item-active" : "tab-item-inactive"}
                >
                  <span className="flex items-center gap-1.5">{t.icon}{t.label}</span>
                </button>
              ))}
            </div>

            {/* ─── AI Tab: three REAL backend-wired actions ─────────
             *  Replaces the 12-tool stub grid that the audit flagged as 11/12
             *  fake endpoints. These three call existing, shipped backends. */}
            {editorLeftTab === "ai" && (
              <div className="space-y-3">
                <div className="card space-y-2">
                  <h2 className="section-header flex items-center gap-2 mb-0">
                    <Wand2 size={13} className="text-gold" /> One-click Auto-Edit
                  </h2>
                  <p className="text-[9px] text-muted">
                    Runs detect-scenes → suggest → captions → B-roll candidates on your rendered video.
                    Seeds the timeline with ghost-marker suggestions you can accept or reject.
                  </p>
                  <button
                    type="button"
                    onClick={runFullPassAutoEdit}
                    disabled={fullPassRunning || !result?.url || !aiProject?.project_id}
                    className="btn-primary w-full text-xs py-2 flex items-center justify-center gap-1.5 disabled:opacity-40"
                  >
                    {fullPassRunning ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    {fullPassRunning ? "Running full-pass…" : "Run Full-Pass Auto-Edit"}
                  </button>
                  {(!result?.url || !aiProject?.project_id) && (
                    <p className="text-[8px] text-muted italic">
                      Requires a rendered video + AI-generated project (use &ldquo;Generate with AI&rdquo; above).
                    </p>
                  )}
                </div>

                <div className="card space-y-2">
                  <h2 className="section-header flex items-center gap-2 mb-0">
                    <Eye size={13} className="text-gold" /> Classify Footage
                  </h2>
                  <p className="text-[9px] text-muted">
                    Claude Vision detects the content type of each reference (webcam talk,
                    vlog, drone, gameplay…) and suggests a creator pack. Click any
                    reference below, then click Classify.
                  </p>
                  {referenceFiles.length === 0 ? (
                    <p className="text-[9px] text-muted italic">
                      Upload a reference video or image in the Assets tab first.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {referenceFiles.map((f, i) => (
                        <div key={i} className="p-2 rounded-lg border border-border flex items-center gap-2">
                          <div className="w-10 h-10 rounded bg-surface-light flex items-center justify-center flex-shrink-0">
                            {f.type.startsWith("image/") ? (
                              <img src={f.preview} alt={f.name} className="w-10 h-10 object-cover rounded" />
                            ) : f.type.startsWith("video/") ? (
                              <Film size={12} className="text-gold" />
                            ) : (
                              <ImageIcon size={12} className="text-muted" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[9px] font-semibold truncate">{f.name}</p>
                            {footageBadges[i] && (
                              <div className="mt-0.5">
                                <FootageBadge
                                  footage_type={footageBadges[i]!.footage_type}
                                  confidence={footageBadges[i]!.confidence}
                                  recommended_creator_pack_id={footageBadges[i]!.recommended_creator_pack_id}
                                  compact
                                />
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => classifyReferenceFootage(i)}
                            disabled={classifyingIdx === i}
                            className="text-[8px] px-1.5 py-0.5 rounded border border-gold/30 bg-gold/10 text-gold hover:bg-gold/20 flex items-center gap-1 disabled:opacity-40"
                          >
                            {classifyingIdx === i ? <Loader2 size={8} className="animate-spin" /> : <Bot size={8} />}
                            {classifyingIdx === i ? "Classifying" : "Classify"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="card space-y-2">
                  <h2 className="section-header flex items-center gap-2 mb-0">
                    <TrendingUp size={13} className="text-gold" /> Analyze Viral Video
                  </h2>
                  <p className="text-[9px] text-muted">
                    Paste a YouTube / Shorts URL. Claude Vision extracts the visual
                    pattern (hook, thumbnail, pacing, caption style) and returns a
                    prompt suffix you can paste into any generator.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={viralUrl}
                      onChange={(e) => setViralUrl(e.target.value)}
                      placeholder="https://youtube.com/watch?v=…"
                      className="input flex-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={analyzeViralUrl}
                      disabled={viralAnalyzing || !viralUrl.trim()}
                      className="btn-primary text-xs px-3 flex items-center gap-1 disabled:opacity-40"
                    >
                      {viralAnalyzing ? <Loader2 size={11} className="animate-spin" /> : <TrendingUp size={11} />}
                      {viralAnalyzing ? "…" : "Analyze"}
                    </button>
                  </div>
                  {viralResult && (
                    <pre className="text-[9px] bg-surface-light border border-border rounded-lg p-2 overflow-x-auto max-h-72">
                      {JSON.stringify(viralResult, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            )}

            {/* Brand Kit Integration */}
            {editorLeftTab === "brand" && (
            <div className="card">
              <h2 className="section-header flex items-center gap-2"><Paintbrush size={13} className="text-gold" /> Brand Kit</h2>
              <div className="grid grid-cols-3 gap-2">
                {brandKits.map(kit => (
                  <button key={kit.id} onClick={() => {
                    setSelectedBrandKit(kit.id);
                    setConfig(prev => ({ ...prev, brand_colors: kit.colors.join(", ") }));
                    toast.success(`Brand kit "${kit.name}" applied`);
                  }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      selectedBrandKit === kit.id ? "border-gold/30 bg-gold/[0.05]" : "border-border hover:border-gold/15"
                    }`}>
                    <div className="flex items-center gap-1 mb-1">
                      {kit.colors.map((c, i) => (
                        <div key={i} className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <p className="text-[10px] font-semibold">{kit.name}</p>
                    <p className="text-[8px] text-muted">{kit.font}</p>
                  </button>
                ))}
              </div>
            </div>
            )}

            {editorLeftTab === "style" && (
            <>
            {/* Caption Style (asset catalog) */}
            <div className="card">
              <button
                onClick={() => toggleAssetPanel("captionStyle")}
                className="w-full flex items-center justify-between mb-2"
              >
                <h2 className="section-header flex items-center gap-2 mb-0">
                  <Captions size={13} className="text-gold" /> Caption Style ({CAPTION_STYLES_LIBRARY.length})
                </h2>
                {openAssetPanels.captionStyle ? <ChevronDown size={13} className="text-muted" /> : <ChevronRight size={13} className="text-muted" />}
              </button>
              {openAssetPanels.captionStyle && (
                <>
                  <p className="text-[9px] text-muted mb-2">Live CSS previews of viral caption styles. Click to apply.</p>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {(["all", "tiktok", "youtube", "reel", "shorts", "podcast"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setCaptionStyleFilter(f)}
                        className={`text-[8px] px-2 py-0.5 rounded-full border transition-all ${
                          captionStyleFilter === f
                            ? "border-gold/30 bg-gold/[0.08] text-gold font-semibold"
                            : "border-border text-muted hover:text-foreground"
                        }`}
                      >
                        {f === "all" ? "All" : f}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-80 overflow-y-auto">
                    {CAPTION_STYLES_LIBRARY.filter(
                      (c) => captionStyleFilter === "all" || c.best_for.includes(captionStyleFilter)
                    ).map((c) => {
                      const active = selectedCaptionStyleId === c.id;
                      return (
                        <button
                          key={c.id}
                          onClick={() => {
                            setSelectedCaptionStyleId(c.id);
                            setConfig((prev) => ({ ...prev, caption_style: c.id }));
                            // Sync editorSettings preview fields so downstream render consumes them
                            setEditorSettings((prev) => ({
                              ...prev,
                              captions: {
                                ...prev.captions,
                                enabled: true,
                                fontFamily: c.css_preview.fontFamily.replace(/['",]/g, "").split(" ")[0] || "Inter",
                                fontSize: c.css_preview.size * 2,
                                textColor: c.css_preview.color,
                                strokeColor: c.css_preview.stroke === "transparent" ? "#000000" : c.css_preview.stroke,
                                backdropColor: c.css_preview.bg,
                                strokeWidth: c.css_preview.stroke === "transparent" ? 0 : 4,
                              },
                            }));
                          }}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            active ? "border-gold/40 bg-gold/[0.07]" : "border-border hover:border-gold/15"
                          }`}
                        >
                          <div
                            className="rounded-md py-3 px-2 text-center mb-1.5"
                            style={{
                              background: c.css_preview.bg === "transparent" ? "rgba(0,0,0,0.35)" : c.css_preview.bg,
                              color: c.css_preview.color,
                              fontFamily: c.css_preview.fontFamily,
                              fontSize: c.css_preview.size,
                              fontWeight: c.css_preview.weight,
                              WebkitTextStroke:
                                c.css_preview.stroke === "transparent" ? "0" : `1.5px ${c.css_preview.stroke}`,
                              letterSpacing: "0.5px",
                            }}
                          >
                            YOUR TEXT HERE
                          </div>
                          <p className={`text-[10px] font-semibold ${active ? "text-gold" : ""}`}>{c.name}</p>
                          <p className="text-[8px] text-muted">{c.desc}</p>
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {c.best_for.map((b) => (
                              <span key={b} className="text-[7px] px-1 py-[1px] rounded bg-gold/10 text-gold/90">
                                {b}
                              </span>
                            ))}
                            <span className="text-[7px] px-1 py-[1px] rounded bg-muted/20 text-muted ml-auto">
                              {c.css_preview.animation}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Effects & Transitions (asset catalog) */}
            <div className="card">
              <button
                onClick={() => toggleAssetPanel("effectsTransitions")}
                className="w-full flex items-center justify-between mb-2"
              >
                <h2 className="section-header flex items-center gap-2 mb-0">
                  <Wand2 size={13} className="text-gold" /> Effects &amp; Transitions ({EFFECTS_CATALOG.length})
                </h2>
                {openAssetPanels.effectsTransitions ? <ChevronDown size={13} className="text-muted" /> : <ChevronRight size={13} className="text-muted" />}
              </button>
              {openAssetPanels.effectsTransitions && (
                <>
                  <p className="text-[9px] text-muted mb-2">Hover for description. Click to toggle — multiple allowed.</p>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {(["all", "transition", "overlay", "filter"] as const).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setEffectsCategoryTab(cat)}
                        className={`text-[8px] px-2 py-0.5 rounded-full border transition-all ${
                          effectsCategoryTab === cat
                            ? "border-gold/30 bg-gold/[0.08] text-gold font-semibold"
                            : "border-border text-muted hover:text-foreground"
                        }`}
                      >
                        {cat === "all" ? "All" : cat}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {EFFECTS_CATALOG.filter(
                      (e) => effectsCategoryTab === "all" || e.category === effectsCategoryTab
                    ).map((e) => {
                      const active = selectedEffectIds.includes(e.id);
                      return (
                        <button
                          key={e.id}
                          title={e.description}
                          onClick={() => {
                            const next = active
                              ? selectedEffectIds.filter((id) => id !== e.id)
                              : [...selectedEffectIds, e.id];
                            setSelectedEffectIds(next);
                            // Mirror into editorSettings.effects.active so render consumes it
                            setEditorSettings((prev) => ({
                              ...prev,
                              effects: { ...prev.effects, active: next },
                            }));
                          }}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] transition-all ${
                            active
                              ? "border-gold/40 bg-gold/[0.08] text-gold"
                              : "border-border text-muted hover:border-gold/20 hover:text-foreground"
                          }`}
                        >
                          {e.preview && <span className={`inline-block w-3 h-3 rounded-sm ${e.preview}`} />}
                          <span className="font-semibold">{e.name}</span>
                          <span className="text-[8px] text-muted/80">{e.category}</span>
                        </button>
                      );
                    })}
                  </div>
                  {selectedEffectIds.length > 0 && (
                    <p className="text-[9px] text-gold mt-2">{selectedEffectIds.length} effect{selectedEffectIds.length === 1 ? "" : "s"} selected</p>
                  )}
                </>
              )}
            </div>

            {/* SFX Palette (asset catalog) */}
            <div className="card">
              <button
                onClick={() => toggleAssetPanel("sfxPalette")}
                className="w-full flex items-center justify-between mb-2"
              >
                <h2 className="section-header flex items-center gap-2 mb-0">
                  <Volume2 size={13} className="text-gold" /> SFX Palette ({SFX_LIBRARY.length})
                </h2>
                {openAssetPanels.sfxPalette ? <ChevronDown size={13} className="text-muted" /> : <ChevronRight size={13} className="text-muted" />}
              </button>
              {openAssetPanels.sfxPalette && (
                <>
                  <p className="text-[9px] text-muted mb-2">Short-form favorites. Preview plays a placeholder tone.</p>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {(["all", "impact", "ambient", "tech", "transition"] as const).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSfxCategoryTab(cat)}
                        className={`text-[8px] px-2 py-0.5 rounded-full border transition-all ${
                          sfxCategoryTab === cat
                            ? "border-gold/30 bg-gold/[0.08] text-gold font-semibold"
                            : "border-border text-muted hover:text-foreground"
                        }`}
                      >
                        {cat === "all" ? "All" : cat}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                    {SFX_LIBRARY.filter((s) => sfxCategoryTab === "all" || s.category === sfxCategoryTab).map((s) => {
                      const active = selectedSfxIds.includes(s.id);
                      return (
                        <div
                          key={s.id}
                          className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                            active ? "border-gold/40 bg-gold/[0.06]" : "border-border hover:border-gold/15"
                          }`}
                        >
                          <button
                            onClick={() => playSfxPlaceholderTone(s)}
                            className="p-1 rounded-full bg-gold/15 text-gold hover:bg-gold/25 transition-all flex-shrink-0"
                            title={`Preview ${s.name}`}
                          >
                            <Play size={10} />
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[10px] font-semibold truncate ${active ? "text-gold" : ""}`}>{s.name}</p>
                            <p className="text-[8px] text-muted truncate">{s.desc} · {s.duration_sec}s</p>
                          </div>
                          <span className="text-[7px] px-1 py-[1px] rounded bg-muted/20 text-muted">{s.category}</span>
                          <button
                            onClick={() =>
                              setSelectedSfxIds((prev) =>
                                active ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                              )
                            }
                            className={`text-[9px] px-2 py-0.5 rounded-full border transition-all flex-shrink-0 ${
                              active
                                ? "border-gold/40 bg-gold/[0.12] text-gold"
                                : "border-border text-muted hover:text-foreground"
                            }`}
                          >
                            {active ? "Added" : "Add"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {selectedSfxIds.length > 0 && (
                    <p className="text-[9px] text-gold mt-2">{selectedSfxIds.length} SFX selected</p>
                  )}
                </>
              )}
            </div>

            {/* Music (asset catalog) */}
            <div className="card">
              <button
                onClick={() => toggleAssetPanel("music")}
                className="w-full flex items-center justify-between mb-2"
              >
                <h2 className="section-header flex items-center gap-2 mb-0">
                  <Music size={13} className="text-gold" /> Music ({MUSIC_LIBRARY.length})
                </h2>
                {openAssetPanels.music ? <ChevronDown size={13} className="text-muted" /> : <ChevronRight size={13} className="text-muted" />}
              </button>
              {openAssetPanels.music && (
                <>
                  <p className="text-[9px] text-muted mb-2">Royalty-free tracks filtered by BPM + mood.</p>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="text-[8px] text-muted uppercase tracking-wider block mb-1">Mood</label>
                      <select
                        value={musicMoodFilter}
                        onChange={(e) => setMusicMoodFilter(e.target.value)}
                        className="input w-full text-[10px] py-1"
                      >
                        <option value="all">All moods</option>
                        {Array.from(new Set(MUSIC_LIBRARY.map((m) => m.mood))).sort().map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[8px] text-muted uppercase tracking-wider block mb-1">BPM</label>
                      <select
                        value={musicBpmFilter}
                        onChange={(e) => setMusicBpmFilter(e.target.value)}
                        className="input w-full text-[10px] py-1"
                      >
                        <option value="all">Any BPM</option>
                        <option value="slow">Slow (&lt; 90)</option>
                        <option value="medium">Medium (90-120)</option>
                        <option value="fast">Fast (&gt; 120)</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                    {MUSIC_LIBRARY.filter((m) => {
                      if (musicMoodFilter !== "all" && m.mood !== musicMoodFilter) return false;
                      if (musicBpmFilter === "slow" && m.bpm >= 90) return false;
                      if (musicBpmFilter === "medium" && (m.bpm < 90 || m.bpm > 120)) return false;
                      if (musicBpmFilter === "fast" && m.bpm <= 120) return false;
                      return true;
                    }).map((m) => {
                      const active = selectedMusicId === m.id;
                      return (
                        <button
                          key={m.id}
                          onClick={() => {
                            setSelectedMusicId(m.id);
                            setConfig((prev) => ({ ...prev, music_mood: m.mood.toLowerCase() }));
                            // Sync editorSettings.audio.bgGenre so render picks it up
                            setEditorSettings((prev) => ({
                              ...prev,
                              audio: { ...prev.audio, enabled: true, bgGenre: m.genre.toLowerCase() },
                            }));
                          }}
                          className={`w-full flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                            active ? "border-gold/40 bg-gold/[0.06]" : "border-border hover:border-gold/15"
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className={`text-[10px] font-semibold truncate ${active ? "text-gold" : ""}`}>{m.name}</p>
                              {active && <Check size={10} className="text-gold flex-shrink-0" />}
                            </div>
                            <p className="text-[8px] text-muted truncate">{m.genre} · {m.mood} · {m.bpm} BPM · {m.duration_sec}s</p>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            {m.suggested_platforms.slice(0, 2).map((p) => (
                              <span key={p} className="text-[7px] px-1 py-[1px] rounded bg-gold/10 text-gold/90">{p}</span>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {selectedMusicId && (
                    <p className="text-[9px] text-gold mt-2">
                      Selected: {MUSIC_LIBRARY.find((m) => m.id === selectedMusicId)?.name}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Style (visual style — belongs with Style tab) */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2"><Palette size={13} className="text-gold" /> Visual Style</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {STYLES.map(s => (
                  <button key={s.id} onClick={() => setConfig({ ...config, style: s.id })}
                    className={`p-2 rounded-xl border text-left transition-all ${
                      config.style === s.id ? "border-gold/30 bg-gold/[0.05]" : "border-border hover:border-gold/15"
                    }`}>
                    <p className="text-[10px] font-semibold">{s.name}</p>
                    <p className="text-[8px] text-muted">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            </>
            )}

            {editorLeftTab === "assets" && (
            <>
            {/* Video type */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2"><Film size={13} className="text-gold" /> Video Type</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {VIDEO_TYPES.map(t => (
                  <button key={t.id} onClick={() => selectType(t)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all ${
                      config.type === t.id ? "border-gold/30 bg-gold/[0.05]" : "border-border"
                    }`}>
                    <span className={config.type === t.id ? "text-gold" : "text-muted"}>{t.icon}</span>
                    <div>
                      <p className="text-[10px] font-semibold">{t.name}</p>
                      <p className="text-[8px] text-muted">{t.aspect} / {t.duration}s</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Details */}
            <div className="card space-y-3">
              <h2 className="section-header">Video Details</h2>
              <div>
                <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Title *</label>
                <input value={config.title} onChange={e => setConfig({ ...config, title: e.target.value })}
                  className="input w-full text-xs" placeholder="e.g., 5 Dental Marketing Tips That Actually Work" />
              </div>
              <div>
                <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Script (optional — AI will create one if empty)</label>
                <PromptEnhancer
                  value={config.script}
                  onChange={(v) => setConfig({ ...config, script: v })}
                  type="video"
                  placeholder="Paste your script here, or leave empty for AI to write..."
                  rows={3}
                />
              </div>
              {/* Reference Files */}
              <div>
                <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Reference Files (faces, logos, footage, effects)</label>
                <div
                  className="border-2 border-dashed border-border/40 rounded-xl p-3 text-center hover:border-gold/30 transition-colors cursor-pointer"
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("border-gold/40", "bg-gold/5"); }}
                  onDragLeave={e => { e.currentTarget.classList.remove("border-gold/40", "bg-gold/5"); }}
                  onDrop={e => {
                    e.preventDefault();
                    e.currentTarget.classList.remove("border-gold/40", "bg-gold/5");
                    handleFileUpload(Array.from(e.dataTransfer.files));
                  }}
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.multiple = true;
                    input.accept = "image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/wav,.png,.jpg,.jpeg,.webp,.mp4,.webm,.mov,.mp3,.wav";
                    input.onchange = (ev) => {
                      const files = Array.from((ev.target as HTMLInputElement).files || []);
                      handleFileUpload(files);
                    };
                    input.click();
                  }}
                >
                  <Upload size={16} className="mx-auto text-muted mb-1" />
                  <p className="text-[10px] text-muted">Drop files or click to upload (up to 5, max {maxRefLabel} each)</p>
                  <p className="text-[8px] text-muted/60">PNG, JPG, WEBP, MP4, MOV, WEBM, MP3, WAV</p>
                </div>
                {referenceFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {referenceFiles.map((f, i) => (
                      <div key={i} className="relative group">
                        {f.type.startsWith("image/") ? (
                          <img src={f.preview} alt={f.name} className="w-14 h-14 object-cover rounded-lg border border-border" />
                        ) : (
                          <div className="w-14 h-14 bg-surface-light rounded-lg border border-border flex flex-col items-center justify-center">
                            {f.type.startsWith("video/") ? <Film size={14} className="text-gold mb-0.5" /> :
                             f.type.startsWith("audio/") ? <Music size={14} className="text-gold mb-0.5" /> :
                             <ImageIcon size={14} className="text-muted mb-0.5" />}
                            <span className="text-[7px] text-muted truncate max-w-[48px]">{f.name}</span>
                          </div>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); setReferenceFiles(prev => prev.filter((_, idx) => idx !== i)); }}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-danger/80 text-white rounded-full items-center justify-center text-[8px] hidden group-hover:flex"
                        >
                          <X size={8} />
                        </button>
                        {(f.type.startsWith("image/") || f.type.startsWith("video/")) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); void analyzeReferenceFile(i); }}
                            disabled={refAnalyzing}
                            className="absolute -bottom-1 -right-1 px-1 py-0.5 rounded-full bg-gold text-black text-[7px] font-bold items-center justify-center hidden group-hover:flex disabled:opacity-40"
                            title="Analyze this style with AI"
                          >
                            {refAnalyzing ? <Loader2 size={7} className="animate-spin" /> : "AI"}
                          </button>
                        )}
                        {footageBadges[i] && (
                          <div className="absolute top-1 left-1">
                            <FootageBadge
                              footage_type={footageBadges[i]!.footage_type}
                              confidence={footageBadges[i]!.confidence}
                              recommended_creator_pack_id={footageBadges[i]!.recommended_creator_pack_id}
                              compact
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {referenceFiles.length > 0 && (
                  <button
                    onClick={() => analyzeReferenceFile(0)}
                    disabled={refAnalyzing}
                    className="mt-2 w-full text-[10px] py-1.5 rounded-lg border border-gold/30 bg-gold/[0.05] text-gold hover:bg-gold/10 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
                  >
                    {refAnalyzing ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                    Analyze this style with AI
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Duration (sec)</label>
                  <input type="number" min={5} max={300} value={config.duration}
                    onChange={e => setConfig({ ...config, duration: parseInt(e.target.value) || 30 })}
                    className="input w-full text-xs" />
                </div>
                <div>
                  <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Platform</label>
                  <select value={config.target_platform} onChange={e => setConfig({ ...config, target_platform: e.target.value })} className="input w-full text-xs">
                    <option value="instagram">Instagram</option>
                    <option value="tiktok">TikTok</option>
                    <option value="youtube">YouTube</option>
                    <option value="facebook">Facebook</option>
                    <option value="linkedin">LinkedIn</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Brand Colors</label>
                  <input value={config.brand_colors} onChange={e => setConfig({ ...config, brand_colors: e.target.value })}
                    className="input w-full text-xs" placeholder="#C9A84C, #1a1a1a" />
                </div>
              </div>
            </div>

            {/* AI Options */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2"><Wand2 size={13} className="text-gold" /> AI Enhancement Options</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] text-muted uppercase tracking-wider mb-1.5">Music Mood</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {MUSIC_MOODS.map(m => {
                      const active = config.music_mood === m.id;
                      const Icon = m.icon;
                      return (
                        <button
                          key={m.id}
                          onClick={() => setConfig({ ...config, music_mood: m.id })}
                          className={`group flex flex-col items-center gap-1 rounded-lg border p-2 transition-all ${
                            active
                              ? "border-gold/40 bg-gold/[0.08] text-gold shadow-[0_0_0_1px_rgba(201,168,76,0.15)]"
                              : "border-border text-muted hover:border-border/80 hover:text-foreground"
                          }`}
                          title={m.name}
                        >
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
                              active ? "bg-gold/15" : m.bg
                            }`}
                          >
                            <Icon size={13} className={active ? "text-gold" : m.tint} />
                          </span>
                          <p className="text-[8.5px] leading-tight">{m.name}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] text-muted uppercase tracking-wider mb-1.5">Caption Style</label>
                  <div className="space-y-1">
                    {CAPTION_STYLES.map(c => (
                      <button key={c.id} onClick={() => setConfig({ ...config, caption_style: c.id })}
                        className={`w-full text-left text-[10px] px-2.5 py-1.5 rounded-lg border transition-all ${
                          config.caption_style === c.id ? "border-gold/30 bg-gold/[0.05] text-gold" : "border-border text-muted hover:text-foreground"
                        }`}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-border">
                <label className="flex items-center gap-2 text-[10px] text-muted cursor-pointer">
                  <input type="checkbox" checked={config.include_voiceover}
                    onChange={e => setConfig({ ...config, include_voiceover: e.target.checked })}
                    className="rounded border-border text-gold focus:ring-gold/30" />
                  <Volume2 size={11} /> AI Voiceover Notes
                </label>
                <label className="flex items-center gap-2 text-[10px] text-muted cursor-pointer">
                  <input type="checkbox" checked={config.include_cta}
                    onChange={e => setConfig({ ...config, include_cta: e.target.checked })}
                    className="rounded border-border text-gold focus:ring-gold/30" />
                  <Zap size={11} /> Include CTA Overlay
                </label>
                {config.include_cta && (
                  <input value={config.cta_text} onChange={e => setConfig({ ...config, cta_text: e.target.value })}
                    className="input text-xs py-1 flex-1 min-w-[150px]" placeholder="CTA text (e.g., Book Now)" />
                )}
              </div>
            </div>

            {/* ── AI-Generated Shot List / Script / Captions ── */}
            {aiProject && (aiProject.shotlist || aiProject.scenes || aiProject.captions) && (
              <div className="card space-y-3">
                <h2 className="section-header flex items-center gap-2">
                  <Bot size={13} className="text-gold" /> AI Project
                  <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-gold/10 text-gold font-medium">Claude</span>
                </h2>
                {aiProject.hook && (
                  <div>
                    <p className="text-[9px] text-muted uppercase tracking-wider mb-1">Hook</p>
                    <p className="text-xs text-foreground italic">&ldquo;{aiProject.hook}&rdquo;</p>
                  </div>
                )}
                {aiProject.cta && (
                  <div>
                    <p className="text-[9px] text-muted uppercase tracking-wider mb-1">CTA</p>
                    <p className="text-xs text-foreground">{aiProject.cta}</p>
                  </div>
                )}
                {Array.isArray(aiProject.scenes) && aiProject.scenes.length > 0 && (
                  <div>
                    <p className="text-[9px] text-muted uppercase tracking-wider mb-1">Scenes ({aiProject.scenes.length})</p>
                    <ol className="space-y-1 list-decimal list-inside">
                      {aiProject.scenes.map((sc, i) => (
                        <li key={i} className="text-[10px] text-foreground">
                          <span className="font-semibold">{sc.title || sc.description?.slice(0, 50) || `Scene ${i + 1}`}</span>
                          {sc.duration ? <span className="text-muted"> · {sc.duration}s</span> : null}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {Array.isArray(aiProject.shotlist) && aiProject.shotlist.length > 0 && (
                  <div>
                    <p className="text-[9px] text-muted uppercase tracking-wider mb-1">Shot List ({aiProject.shotlist.length})</p>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {aiProject.shotlist.map((s, i) => (
                        <div key={i} className="p-2 rounded-lg border border-border text-[10px]">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-semibold text-foreground">Shot {i + 1}{s.scene ? ` · ${s.scene}` : ""}</span>
                            {s.duration ? <span className="text-muted font-mono">{s.duration}s</span> : null}
                          </div>
                          {s.shot && <div className="text-muted">{s.shot}</div>}
                          {s.camera && <div className="text-muted text-[9px]">Camera: {s.camera}</div>}
                          {Array.isArray(s.broll) && s.broll.length > 0 && (
                            <div className="text-muted text-[9px] mt-0.5">B-roll: {s.broll.join(", ")}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {Array.isArray(aiProject.captions) && aiProject.captions.length > 0 && (
                  <div>
                    <p className="text-[9px] text-muted uppercase tracking-wider mb-1">Captions ({aiProject.captions.length})</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {aiProject.captions.slice(0, 12).map((c, i) => (
                        <div key={i} className="text-[10px] text-foreground">
                          <span className={c.emphasis ? "font-bold text-gold" : ""}>{c.text}</span>
                          {typeof c.start === "number" && typeof c.end === "number" && (
                            <span className="text-muted text-[9px] ml-1">({c.start.toFixed(1)}s – {c.end.toFixed(1)}s)</span>
                          )}
                        </div>
                      ))}
                      {aiProject.captions.length > 12 && (
                        <div className="text-[9px] text-muted">… and {aiProject.captions.length - 12} more</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            </>
            )}

            {/* Mode toggle */}
            <div className="flex gap-2">
              <button onClick={() => setMode("storyboard")}
                className={`flex-1 text-xs py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all border ${
                  mode === "storyboard" ? "bg-gold/10 border-gold/30 text-gold" : "border-border text-muted hover:text-foreground"
                }`}>
                <LayoutGrid size={14} /> AI Storyboard
              </button>
              <button onClick={() => setMode("plan")}
                className={`flex-1 text-xs py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all border ${
                  mode === "plan" ? "bg-gold/10 border-gold/30 text-gold" : "border-border text-muted hover:text-foreground"
                }`}>
                <Sparkles size={14} /> AI Plan
              </button>
              <button onClick={() => setMode("render")}
                className={`flex-1 text-xs py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all border ${
                  mode === "render" ? "bg-gold/10 border-gold/30 text-gold" : "border-border text-muted hover:text-foreground"
                }`}>
                <Film size={14} /> Render MP4
              </button>
            </div>

            <button onClick={generateVideo} disabled={generating || !config.title}
              className={`w-full text-xs py-2.5 flex items-center justify-center gap-2 disabled:opacity-50 rounded-xl font-semibold transition-all ${
                mode === "render" ? "btn-primary" : "bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20"
              }`}>
              {generating ? <Loader size={14} className="animate-spin" /> : mode === "storyboard" ? <LayoutGrid size={14} /> : mode === "render" ? <Film size={14} /> : <Sparkles size={14} />}
              {generating ? "Creating..." : mode === "storyboard" ? "Generate Storyboard" : mode === "render" ? "Render Video" : "Generate Video Plan"}
            </button>
            <p className="text-[8px] text-muted text-center">
              {mode === "render" ? "Remotion + Higgsfield render an MP4 with animations, text, and transitions (~30-60s)" : mode === "storyboard" ? "AI creates scene-by-scene breakdown with visuals, transitions, and timing" : "AI creates a detailed shot list, timing, overlays, and music suggestions"}
            </p>
            <label className="flex items-center justify-center gap-2 text-[10px] text-muted cursor-pointer select-none mt-1">
              <input
                type="checkbox"
                checked={walkthroughEnabled}
                onChange={(e) => setWalkthroughEnabled(e.target.checked)}
                className="accent-gold"
              />
              Show step-by-step walkthrough when generating
            </label>
          </div>

          {/* Preview / Result */}
          <div className="space-y-4">
            {/* Inspector — shows project meta when nothing's selected; swaps to
                clip properties when a timeline clip is picked. Minimal v1. */}
            <div className="card border-gold/15 p-3 space-y-1">
              <h3 className="section-header flex items-center gap-2 mb-0">
                <Sliders size={11} className="text-gold" /> Inspector
              </h3>
              <div className="text-[9px] text-muted space-y-0.5">
                <div className="flex justify-between">
                  <span>Title</span>
                  <span className="text-foreground font-medium truncate max-w-[140px]" title={config.title || "Untitled"}>{config.title || "Untitled"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Duration</span>
                  <span className="text-foreground font-mono">{Math.round(timelineProject.duration / 1000)}s</span>
                </div>
                <div className="flex justify-between">
                  <span>Aspect</span>
                  <span className="text-foreground font-mono">{selectedType.aspect}</span>
                </div>
                <div className="flex justify-between">
                  <span>Clips</span>
                  <span className="text-foreground font-mono">{timelineProject.clips.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Suggestions</span>
                  <span className="text-foreground font-mono">{timelineSuggestions.length}</span>
                </div>
              </div>
            </div>

            <div className="card-premium border-gold/10 text-center py-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-mesh opacity-20" />
              <div className="relative">
                <div className={`mx-auto mb-3 rounded-xl flex items-center justify-center overflow-hidden ${
                  selectedType.aspect === "9:16" ? "w-28 h-48" : selectedType.aspect === "16:9" ? "w-48 h-28" : "w-36 h-36"
                } bg-surface-light/50 border border-border`}>
                  {result?.url ? (
                    <video ref={timelineVideoRef} src={result.url} controls className="w-full h-full object-cover rounded-xl" />
                  ) : generating ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader size={20} className="animate-spin text-gold" />
                      <span className="text-[9px] text-gold font-mono">{Math.round(renderProgress)}%</span>
                    </div>
                  ) : (
                    <Film size={24} className="text-muted/30" />
                  )}
                </div>
                {generating && (
                  <div className="mx-auto w-40 mt-2">
                    <div className="w-full bg-surface-light rounded-full h-1.5">
                      <div className="bg-gradient-gold rounded-full h-1.5 transition-all duration-300"
                        style={{ width: `${renderProgress}%` }} />
                    </div>
                    <p className="text-[8px] text-muted mt-1">Creating {config.duration}s {selectedType.name}...</p>
                  </div>
                )}
                <p className="text-[10px] text-muted mt-2">{selectedType.name} / {selectedType.aspect} / {config.duration}s</p>
              </div>
            </div>

            {/* Result */}
            {result && (
              <div className="card">
                <h3 className="section-header flex items-center gap-2">
                  {result.url ? <Play size={12} className="text-success" /> : <Sparkles size={12} className="text-gold" />}
                  {result.url ? "Rendered Video" : result.storyboard ? "Storyboard Ready" : "Production Plan"}
                </h3>
                {result.url && (
                  <div className="space-y-2">
                    <a href={result.url} target="_blank" rel="noopener" download
                      className="btn-primary btn-shine w-full text-xs flex items-center justify-center gap-1">
                      <Download size={12} /> Download MP4
                    </a>
                    <button onClick={() => { navigator.clipboard.writeText(result.url || ""); toast.success("Link copied!"); }}
                      className="btn-secondary w-full text-xs flex items-center justify-center gap-1">
                      <Copy size={12} /> Copy Video URL
                    </button>
                  </div>
                )}
                {result.plan && !result.storyboard && (
                  <div className="space-y-2">
                    <pre className="text-[9px] text-muted bg-surface-light rounded-lg p-2.5 max-h-[300px] overflow-y-auto whitespace-pre-wrap">{result.plan}</pre>
                    <button onClick={() => { navigator.clipboard.writeText(result.plan || ""); toast.success("Copied!"); }}
                      className="btn-ghost text-[9px] w-full flex items-center justify-center gap-1"><Copy size={10} /> Copy Plan</button>
                  </div>
                )}
                {result.music_suggestions && result.music_suggestions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-[9px] text-gold uppercase tracking-wider font-medium mb-1 flex items-center gap-1"><Music size={9} /> Music Suggestions</p>
                    {result.music_suggestions.map((m, i) => (
                      <p key={i} className="text-[9px] text-muted">{m}</p>
                    ))}
                  </div>
                )}
                {result.thumbnail_suggestion && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <p className="text-[9px] text-gold uppercase tracking-wider font-medium mb-1 flex items-center gap-1"><ImageIcon size={9} /> Thumbnail Idea</p>
                    <p className="text-[9px] text-muted">{result.thumbnail_suggestion}</p>
                  </div>
                )}
              </div>
            )}

            {/* ─── Adobe-Premiere-style multi-track timeline ─────────
             *  Shown once we have either a storyboard or a rendered URL.
             *  Before that, it renders empty rails (harmless). */}
            <div className="card">
              <h3 className="section-header flex items-center gap-2">
                <Film size={12} className="text-gold" /> Timeline
                <span className="text-[8px] text-muted font-normal">multi-track editor</span>
                <span className="flex-1" />
                <button
                  type="button"
                  onClick={() => setShowPresetPicker((v) => !v)}
                  className={`flex items-center gap-1 rounded border px-2 py-0.5 text-[9px] transition ${
                    showPresetPicker
                      ? "border-gold/40 bg-gold/10 text-gold"
                      : "border-border text-muted hover:text-foreground"
                  }`}
                  title="Open Preset Picker (Cmd/Ctrl+K)"
                >
                  <Wand2 size={9} /> Presets <span className="text-[7px]">⌘K</span>
                </button>
              </h3>
              <VideoTimeline
                project={timelineProject}
                onProjectChange={setTimelineProject}
                playhead={timelinePlayhead}
                onPlayheadChange={setTimelinePlayhead}
                playing={timelinePlaying}
                onPlayPause={() => setTimelinePlaying((v) => !v)}
                videoRef={timelineVideoRef}
                onGenerateCaptions={result?.url ? async () => {
                  const toastId = toast.loading("Generating captions…");
                  try {
                    const res = await fetch("/api/video/auto-edit/captions", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ video_url: result.url, style_id: resolveCaptionStyleForApi(config.caption_style) }),
                    });
                    const j = await res.json();
                    if (!res.ok || !j.ok) {
                      toast.error(j.error || "Caption generation failed", { id: toastId });
                      return;
                    }
                    const caps: Array<{ start: number; end: number; text: string }> = j.captions || [];
                    if (caps.length === 0) {
                      toast.error("No captions returned", { id: toastId });
                      return;
                    }
                    setTimelineProject((p) => ({
                      ...p,
                      clips: [
                        ...p.clips.filter((c) => c.trackId !== "cap"),
                        ...caps.map((c, i) => ({
                          id: `cap-auto-${i}-${Date.now()}`,
                          trackId: "cap",
                          start: Math.round(c.start * 1000),
                          duration: Math.max(300, Math.round((c.end - c.start) * 1000)),
                          label: c.text.slice(0, 32),
                          color: "#A855F7",
                          isMarker: false,
                        })),
                      ],
                    }));
                    toast.success(`Added ${caps.length} captions`, { id: toastId });
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Caption request failed", { id: toastId });
                  }
                } : undefined}
                onSuggestEdits={result?.url ? async () => {
                  const toastId = toast.loading("Asking AI for edits…");
                  try {
                    // Use existing scenes from timeline video clips as a minimal scene list.
                    const videoClips = timelineProject.clips.filter((c) => c.trackId.startsWith("v") && !c.isMarker);
                    const scenes = videoClips.length > 0
                      ? videoClips.map((c, i) => ({
                          index: i,
                          start_sec: c.start / 1000,
                          end_sec: (c.start + c.duration) / 1000,
                          scene_type: "talking_head" as const,
                          motion_level: "medium" as const,
                        }))
                      : [{
                          index: 0,
                          start_sec: 0,
                          end_sec: Math.max(5, timelineProject.duration / 1000),
                          scene_type: "talking_head" as const,
                          motion_level: "medium" as const,
                        }];
                    const res = await fetch("/api/video/auto-edit/suggest", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ video_url: result.url, scenes }),
                    });
                    const j = await res.json();
                    if (!res.ok || !j.ok) {
                      toast.error(j.error || "AI suggestions failed", { id: toastId });
                      return;
                    }
                    setTimelineSuggestions(Array.isArray(j.suggestions) ? j.suggestions : []);
                    toast.success(`Got ${j.total || 0} suggestion(s)`, { id: toastId });
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Suggest request failed", { id: toastId });
                  }
                } : undefined}
                suggestions={timelineSuggestions}
                onAcceptSuggestion={(sug) => {
                  // Turn the suggestion into a clip/marker and push to the timeline.
                  const at = Math.round(sug.timestamp_sec * 1000);
                  let clip: TimelineClip | null = null;
                  if (sug.type === "sfx") {
                    clip = { id: `sug-${sug.id}`, trackId: "a2", start: at, duration: 500, label: `SFX: ${String((sug.payload as Record<string, unknown>).sfx_id || "")}`.slice(0, 32), color: "#F59E0B" };
                  } else if (sug.type === "transition") {
                    clip = { id: `sug-${sug.id}`, trackId: "fx", start: at, duration: 400, label: `${String((sug.payload as Record<string, unknown>).transition_id || "")}`.slice(0, 32), color: "#EF4444", isMarker: true };
                  } else if (sug.type === "color_grade") {
                    clip = { id: `sug-${sug.id}`, trackId: "fx", start: at, duration: 800, label: `${String((sug.payload as Record<string, unknown>).effect_id || "")}`.slice(0, 32), color: "#EF4444", isMarker: true };
                  } else if (sug.type === "caption") {
                    clip = { id: `sug-${sug.id}`, trackId: "cap", start: at, duration: 2000, label: sug.reasoning.slice(0, 32), color: "#A855F7", isMarker: false };
                  } else if (sug.type === "broll_insert") {
                    clip = { id: `sug-${sug.id}`, trackId: "v2", start: at, duration: Math.round((Number((sug.payload as Record<string, unknown>).duration_sec) || 3) * 1000), label: `B-roll: ${String((sug.payload as Record<string, unknown>).query || "")}`.slice(0, 32), color: "#60A5FA" };
                  } else {
                    clip = { id: `sug-${sug.id}`, trackId: "fx", start: at, duration: 400, label: sug.reasoning.slice(0, 32), color: "#EF4444", isMarker: true };
                  }
                  if (clip) {
                    const nextClip = clip;
                    setTimelineProject((p) => ({ ...p, clips: [...p.clips, nextClip], duration: Math.max(p.duration, nextClip.start + nextClip.duration) }));
                  }
                  setTimelineSuggestions((s) => s.filter((x) => x.id !== sug.id));
                  toast.success("Suggestion accepted");
                }}
                onRejectSuggestion={(sug) => {
                  setTimelineSuggestions((s) => s.filter((x) => x.id !== sug.id));
                }}
              />
            </div>

          </div>
        </div>
        )}
        </>
      )}

      {/* Assets & Effects Tab */}
      {tab === "assets" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Motion Graphics Library */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Layers size={13} className="text-gold" /> Motion Graphics Library</h2>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {(["lower-thirds", "transitions", "intros", "outros"] as const).map(cat => (
                <button key={cat} onClick={() => setMotionGraphicsCategory(cat)}
                  className={`text-[9px] px-2.5 py-1 rounded-lg border capitalize transition-all ${
                    motionGraphicsCategory === cat ? "bg-gold/10 text-gold border-gold/20 font-semibold" : "text-muted border-border hover:border-gold/15"
                  }`}>{cat.replace("-", " ")}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {MOTION_GRAPHICS.filter(m => m.category === motionGraphicsCategory).map(mg => (
                <button key={mg.id} onClick={() => {
                  setSelectedMotionGraphics(prev =>
                    prev.includes(mg.id) ? prev.filter(id => id !== mg.id) : [...prev, mg.id]
                  );
                }}
                  className={`p-2.5 rounded-xl border text-left transition-all relative ${
                    selectedMotionGraphics.includes(mg.id) ? "border-gold/30 bg-gold/[0.05]" : "border-border hover:border-gold/15"
                  }`}>
                  {selectedMotionGraphics.includes(mg.id) && (
                    <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-gold rounded-full flex items-center justify-center">
                      <Check size={8} className="text-white" />
                    </div>
                  )}
                  <p className="text-[10px] font-semibold">{mg.name}</p>
                  <p className="text-[8px] text-muted">{mg.desc}</p>
                </button>
              ))}
            </div>
            {selectedMotionGraphics.length > 0 && (
              <p className="text-[8px] text-gold mt-2">{selectedMotionGraphics.length} graphic(s) selected</p>
            )}
          </div>

          {/* Video Template Library (30+) */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><LayoutGrid size={13} className="text-gold" /> Video Template Library</h2>
            <p className="text-[9px] text-muted mb-2">{EXPANDED_TEMPLATES.length} templates with preview thumbnails</p>
            <div className="max-h-[400px] overflow-y-auto space-y-1.5 pr-1">
              {EXPANDED_TEMPLATES.map(tmpl => (
                <button key={tmpl.id} onClick={() => {
                  setConfig(prev => ({ ...prev, title: tmpl.name, aspect_ratio: tmpl.aspect, duration: tmpl.duration }));
                  setTab("create");
                  toast.success(`Template "${tmpl.name}" loaded`);
                }}
                  className="w-full flex items-center gap-2.5 p-2 rounded-lg border border-border hover:border-gold/20 transition-all text-left">
                  <div className="w-10 h-10 rounded-lg bg-surface-light border border-border flex items-center justify-center flex-shrink-0">
                    <Film size={12} className="text-muted" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold truncate">{tmpl.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] text-muted">{tmpl.aspect}</span>
                      <span className="text-[8px] text-muted">{tmpl.duration}s</span>
                      <span className="text-[8px] bg-surface-light text-muted px-1 py-0.5 rounded">{tmpl.category}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Effect Presets */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Sparkles size={13} className="text-gold" /> Effect Presets</h2>
            <p className="text-[9px] text-muted mb-3">Overlay effects, transitions, and motion styles to enhance your video.</p>
            <div className="grid grid-cols-2 gap-2">
              {EFFECT_PRESETS.map(effect => (
                <button key={effect.id} onClick={() => toast.success(`Effect applied: ${effect.name}`)}
                  className="p-2.5 rounded-xl border border-border hover:border-gold/15 text-left transition-all">
                  <p className="text-[10px] font-semibold">{effect.name}</p>
                  <p className="text-[8px] text-muted">{effect.desc}</p>
                  <span className="text-[7px] bg-surface-light text-muted px-1 py-0.5 rounded mt-1 inline-block">{effect.category}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Font Library */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Type size={13} className="text-gold" /> Font Library</h2>
            <p className="text-[9px] text-muted mb-3">Choose a font for captions, titles, and text overlays.</p>
            <div className="grid grid-cols-2 gap-1.5">
              {FONT_PRESETS.map(font => (
                <button key={font.id} onClick={() => {
                  setSubtitlePreview(prev => ({ ...prev, font: font.family }));
                  toast.success(`Font set: ${font.name}`);
                }}
                  className={`p-2 rounded-xl border text-left transition-all ${
                    subtitlePreview.font === font.family ? "border-gold/30 bg-gold/[0.05]" : "border-border hover:border-gold/15"
                  }`}>
                  <p className="text-[10px] font-semibold" style={{ fontFamily: font.family }}>{font.name}</p>
                  <p className="text-[8px] text-muted">{font.category} / {font.weight}</p>
                </button>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* Export & Review Tab */}
      {tab === "export" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Export Quality Settings */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Settings2 size={13} className="text-gold" /> Export Quality Settings</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Resolution</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["720p", "1080p", "4k"] as const).map(res => (
                    <button key={res} onClick={() => setExportSettings(prev => ({ ...prev, resolution: res }))}
                      className={`text-[10px] p-2 rounded-xl border transition-all text-center uppercase font-semibold ${
                        exportSettings.resolution === res ? "border-gold/30 bg-gold/[0.05] text-gold" : "border-border text-muted"
                      }`}>{res}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Bitrate</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["low", "medium", "high"] as const).map(br => (
                    <button key={br} onClick={() => setExportSettings(prev => ({ ...prev, bitrate: br }))}
                      className={`text-[10px] p-2 rounded-xl border transition-all text-center capitalize ${
                        exportSettings.bitrate === br ? "border-gold/30 bg-gold/[0.05] text-gold" : "border-border text-muted"
                      }`}>{br} {br === "low" ? "(~5Mb)" : br === "medium" ? "(~15Mb)" : "(~30Mb)"}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Format</label>
                  <select value={exportSettings.format} onChange={e => setExportSettings(prev => ({ ...prev, format: e.target.value as typeof exportSettings.format }))} className="input text-xs w-full">
                    <option value="mp4">MP4 (H.264)</option>
                    <option value="webm">WebM (VP9)</option>
                    <option value="mov">MOV (ProRes)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Frame Rate</label>
                  <select value={exportSettings.fps} onChange={e => setExportSettings(prev => ({ ...prev, fps: parseInt(e.target.value) }))} className="input text-xs w-full">
                    <option value={24}>24 fps (Film)</option>
                    <option value={30}>30 fps (Standard)</option>
                    <option value={60}>60 fps (Smooth)</option>
                  </select>
                </div>
              </div>
              <div className="p-2 bg-surface-light rounded-lg text-[8px] text-muted">
                Est. file size: ~{exportSettings.resolution === "4k" ? "120" : exportSettings.resolution === "1080p" ? "30" : "12"}MB for {config.duration}s at {exportSettings.bitrate} bitrate
              </div>
            </div>
          </div>

          {/* Batch Render Queue */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><ListChecks size={13} className="text-gold" /> Batch Render Queue</h2>
            <p className="text-[9px] text-muted mb-3">Queue multiple videos for sequential rendering.</p>
            <button onClick={addToBatchQueue} className="btn-secondary text-[10px] w-full flex items-center justify-center gap-1.5 mb-3">
              <Plus size={10} /> Add Current Video to Queue
            </button>
            {batchQueue.length > 0 ? (
              <div className="space-y-1.5">
                {batchQueue.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg border border-border">
                    <span className="text-[9px] font-mono text-muted w-4">{idx + 1}</span>
                    <span className="text-[10px] font-medium flex-1 truncate">{item.title}</span>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded ${
                      item.status === "done" ? "bg-success/10 text-success" :
                      item.status === "rendering" ? "bg-gold/10 text-gold" :
                      item.status === "failed" ? "bg-danger/10 text-danger" :
                      "bg-surface-light text-muted"
                    }`}>{item.status}</span>
                    <button onClick={() => setBatchQueue(prev => prev.filter(q => q.id !== item.id))}
                      className="text-muted hover:text-danger"><X size={10} /></button>
                  </div>
                ))}
                <button onClick={() => toast.success("Batch render started!")}
                  className="btn-primary text-[10px] w-full flex items-center justify-center gap-1.5 mt-2">
                  <Play size={10} /> Start Batch Render ({batchQueue.length} videos)
                </button>
              </div>
            ) : (
              <p className="text-[9px] text-muted text-center py-4">No videos in queue. Add from the editor.</p>
            )}
          </div>

          {/* Collaboration Notes */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><MessageSquare size={13} className="text-gold" /> Collaboration Notes</h2>
            <p className="text-[9px] text-muted mb-3">Add timestamped notes for team review and feedback.</p>
            <div className="flex gap-2 mb-3">
              <input value={newNote.time} onChange={e => setNewNote(prev => ({ ...prev, time: e.target.value }))}
                className="input text-[10px] w-16" placeholder="0:00" />
              <input value={newNote.note} onChange={e => setNewNote(prev => ({ ...prev, note: e.target.value }))}
                className="input text-[10px] flex-1" placeholder="Add a note..." />
              <button onClick={addCollabNote} className="btn-primary text-[10px] px-3">
                <Plus size={10} />
              </button>
            </div>
            <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
              {collabNotes.length > 0 ? collabNotes.map((note, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-surface-light">
                  <span className="text-[9px] font-mono text-gold flex-shrink-0">{note.time}</span>
                  <div className="flex-1">
                    <p className="text-[10px]">{note.note}</p>
                    <p className="text-[8px] text-muted">{note.author}</p>
                  </div>
                  <button onClick={() => setCollabNotes(prev => prev.filter((_, i) => i !== idx))}
                    className="text-muted hover:text-danger flex-shrink-0"><X size={8} /></button>
                </div>
              )) : (
                <p className="text-[9px] text-muted text-center py-3">No notes yet. Add one above.</p>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Storyboard Tab */}
      {tab === "storyboard" && (
        <div className="space-y-4">
          {result?.storyboard ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">{config.title}</h2>
                  <p className="text-[10px] text-muted">{result.storyboard.length} scenes / {config.duration}s / {selectedType.name}</p>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => {
                    const text = result.storyboard!.map(s => `Scene ${s.scene_number} (${s.duration})\nVisual: ${s.visual}\nText: ${s.text_overlay}\nVO: ${s.voiceover}\nTransition: ${s.transition}\n`).join("\n");
                    navigator.clipboard.writeText(text);
                    toast.success("Storyboard copied!");
                  }} className="btn-secondary text-[10px] flex items-center gap-1"><Copy size={10} /> Copy</button>
                  <button onClick={() => { setMode("render"); setTab("create"); }}
                    className="btn-primary text-[10px] flex items-center gap-1"><Film size={10} /> Render This</button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {result.storyboard.map((scene, i) => (
                  <div key={i} className="card card-hover">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-gold">Scene {scene.scene_number}</span>
                      <span className="text-[9px] text-muted font-mono">{scene.duration}</span>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-[8px] text-muted uppercase tracking-wider">Visual</p>
                        <p className="text-[10px]">{scene.visual}</p>
                      </div>
                      {scene.text_overlay && (
                        <div>
                          <p className="text-[8px] text-muted uppercase tracking-wider flex items-center gap-1"><Type size={8} /> Text Overlay</p>
                          <p className="text-[10px] text-gold font-medium">{scene.text_overlay}</p>
                        </div>
                      )}
                      {scene.voiceover && (
                        <div>
                          <p className="text-[8px] text-muted uppercase tracking-wider flex items-center gap-1"><Mic size={8} /> Voiceover</p>
                          <p className="text-[10px] italic">{scene.voiceover}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-3 pt-1 border-t border-border">
                        {scene.transition && <span className="text-[8px] text-muted flex items-center gap-1"><Scissors size={8} /> {scene.transition}</span>}
                        {scene.camera_movement && <span className="text-[8px] text-muted flex items-center gap-1"><Camera size={8} /> {scene.camera_movement}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : result?.plan ? (
            <div className="card">
              <h2 className="section-header flex items-center gap-2"><Sparkles size={13} className="text-gold" /> Video Plan</h2>
              <pre className="text-[10px] text-muted bg-surface-light rounded-lg p-3 whitespace-pre-wrap max-h-[500px] overflow-y-auto">{result.plan}</pre>
              <div className="flex gap-2 mt-3">
                <button onClick={() => { navigator.clipboard.writeText(result.plan || ""); toast.success("Copied!"); }}
                  className="btn-secondary text-[10px] flex items-center gap-1"><Copy size={10} /> Copy Plan</button>
                <button onClick={() => { setMode("storyboard"); generateVideo(); }}
                  className="btn-primary text-[10px] flex items-center gap-1"><LayoutGrid size={10} /> Convert to Storyboard</button>
              </div>
            </div>
          ) : (
            <div className="card text-center py-12">
              <LayoutGrid size={24} className="mx-auto mb-2 text-muted/30" />
              <p className="text-xs text-muted">No storyboard yet. Generate one from the Create tab.</p>
              <button onClick={() => { setMode("storyboard"); setTab("create"); }}
                className="btn-primary text-[10px] mt-3 flex items-center gap-1 mx-auto"><Sparkles size={10} /> Create Storyboard</button>
            </div>
          )}
        </div>
      )}

      {/* Templates / Presets Tab */}
      {tab === "templates" && (
        <VideoPresetsTab onSelect={(preset) => {
          setConfig(prev => ({
            ...prev,
            ...preset.config,
            title: preset.config.title || prev.title,
            script: preset.config.script || prev.script,
          }));
          setTab("create");
          toast.success(`Preset loaded: ${preset.name}`);
        }} />
      )}

      {/* ─── AI Generate Modal ─── */}
      <Modal
        isOpen={aiGenOpen}
        onClose={() => { if (!aiGenLoading) setAiGenOpen(false); }}
        title="Generate Full Video Project with AI"
        size="lg"
      >
        <div className="space-y-3">
          <p className="text-[11px] text-muted">
            Claude will generate a script, captions, shotlist, and matching editor settings.
          </p>
          <div>
            <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Topic</label>
            <input
              value={aiGenTopic}
              onChange={e => setAiGenTopic(e.target.value)}
              className="input w-full text-xs"
              placeholder="e.g., 5 dental marketing tips that actually work in 2026"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Duration</label>
              <select
                value={aiGenDuration}
                onChange={e => setAiGenDuration(parseInt(e.target.value, 10))}
                className="input w-full text-xs"
              >
                <option value={30}>30 seconds</option>
                <option value={60}>60 seconds</option>
                <option value={90}>90 seconds</option>
                <option value={180}>3 minutes</option>
                <option value={300}>5 minutes</option>
                <option value={600}>10 minutes</option>
                <option value={900}>15 minutes</option>
              </select>
            </div>
            <div>
              <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Style Preset</label>
              <select
                value={aiGenStyle}
                onChange={e => setAiGenStyle(e.target.value)}
                className="input w-full text-xs"
              >
                <option value="">Auto (no preset)</option>
                {YOUTUBER_PRESETS.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Target Audience (optional)</label>
            <input
              value={aiGenAudience}
              onChange={e => setAiGenAudience(e.target.value)}
              className="input w-full text-xs"
              placeholder="e.g., dentists with private practices"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setAiGenOpen(false)}
              disabled={aiGenLoading}
              className="flex-1 text-xs py-2 rounded-xl border border-border text-muted hover:text-foreground disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={runAiProjectGeneration}
              disabled={aiGenLoading || !aiGenTopic.trim()}
              className="flex-1 btn-primary text-xs py-2 flex items-center justify-center gap-1.5 disabled:opacity-40"
            >
              {aiGenLoading ? (
                <><Loader2 size={12} className="animate-spin" /> Generating...</>
              ) : (
                <><Sparkles size={12} /> Generate Full Project</>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Generate Full Ad from Description Modal ─── */}
      <Modal
        isOpen={adsGenOpen}
        onClose={() => { if (!adsGenLoading) setAdsGenOpen(false); }}
        title="Generate Full Ad from Description"
        size="lg"
      >
        <div className="space-y-3">
          <div className="p-2.5 rounded-lg bg-gradient-to-r from-red-500/10 to-amber-500/10 border border-red-500/30">
            <p className="text-[11px] text-foreground flex items-center gap-1.5">
              <Megaphone size={13} className="text-red-400" />
              <span><strong>Ads Pack</strong> — paste your product / offer. We write a 30s ad script (hook + benefits + CTA), pick B-roll moments, match music, and load the Ads preset into the editor.</span>
            </p>
          </div>
          <div>
            <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Product / Offer Description</label>
            <textarea
              value={adsGenDescription}
              onChange={e => setAdsGenDescription(e.target.value)}
              rows={4}
              className="input w-full text-xs"
              placeholder="e.g., A posture-correcting backpack for college students — lightweight frame, USB-C charging port, 25L capacity, waterproof, currently 30% off"
            />
          </div>
          <div>
            <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Duration</label>
            <select
              value={adsGenDuration}
              onChange={e => setAdsGenDuration(parseInt(e.target.value, 10))}
              className="input w-full text-xs"
            >
              <option value={15}>15 seconds</option>
              <option value={30}>30 seconds (recommended)</option>
              <option value={45}>45 seconds</option>
              <option value={60}>60 seconds</option>
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setAdsGenOpen(false)}
              disabled={adsGenLoading}
              className="flex-1 text-xs py-2 rounded-xl border border-border text-muted hover:text-foreground disabled:opacity-40"
            >Cancel</button>
            <button
              onClick={runScriptToAd}
              disabled={adsGenLoading || !adsGenDescription.trim()}
              className="flex-1 text-xs py-2 rounded-xl bg-gradient-to-r from-red-500 to-amber-500 text-white hover:from-red-600 hover:to-amber-600 flex items-center justify-center gap-1.5 disabled:opacity-40"
            >
              {adsGenLoading ? (
                <><Loader2 size={12} className="animate-spin" /> Generating ad...</>
              ) : (
                <><Megaphone size={12} /> Generate Full Ad</>
              )}
            </button>
          </div>
          {adsResult && (
            <div className="mt-3 p-2.5 rounded-lg border border-red-500/30 bg-red-500/[0.05] space-y-1.5">
              <h4 className="text-[10px] font-bold text-red-300">Generated</h4>
              <div className="text-[10px] space-y-1">
                <p><span className="font-bold text-muted">HOOK:</span> {adsResult.script.hook}</p>
                <p><span className="font-bold text-muted">CTA:</span> {adsResult.script.cta}</p>
                <p><span className="font-bold text-muted">B-roll:</span> {adsResult.broll.length} moments</p>
                <p><span className="font-bold text-muted">Music:</span> {adsResult.music.title} ({adsResult.music.bpm} BPM)</p>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ─── Reference Analysis Modal ─── */}
      <Modal
        isOpen={refAnalysisOpen}
        onClose={() => setRefAnalysisOpen(false)}
        title="AI Reference Analysis"
        size="lg"
      >
        <div className="space-y-3">
          <p className="text-[11px] text-muted">
            Suggested editor settings based on the reference you uploaded.
          </p>
          <pre className="text-[10px] bg-surface-light border border-border rounded-lg p-3 overflow-x-auto max-h-80">
            {JSON.stringify(refAnalysis, null, 2)}
          </pre>
          <div className="flex gap-2">
            <button
              onClick={() => setRefAnalysisOpen(false)}
              className="flex-1 text-xs py-2 rounded-xl border border-border text-muted hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={applyAnalyzedReference}
              disabled={!refAnalysis}
              className="flex-1 btn-primary text-xs py-2 flex items-center justify-center gap-1.5 disabled:opacity-40"
            >
              <Check size={12} /> Apply Settings
            </button>
          </div>
        </div>
      </Modal>

      {/* Step-by-Step Creation Walkthrough */}
      <CreationWalkthrough
        open={walkthroughOpen}
        title="Creating your video"
        subtitle={config.title || "Step-by-step AI walkthrough"}
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
        onClose={() => {
          // Closing the modal mid-generation should also abort the pipeline —
          // otherwise `generating` stays true and the UI gets stuck.
          walkthroughCancelledRef.current = true;
          setWalkthroughOpen(false);
          setGenerating(false);
        }}
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
          result?.url ? (
            <video src={result.url} controls className="w-full rounded-xl" />
          ) : (
            <div className="text-[11px] text-muted">
              Your video is ready. Use Save or Export to download.
            </div>
          )
        }
      />

      {/* ─── Footer action bar ──────────────────────────────────────
       *  Sticks to the bottom of the viewport. Primary: Export / Download.
       *  Secondary: One-click Auto-Edit. Shows render progress when active.
       *  Only rendered on the Create tab so other tabs stay clean. */}
      {tab === "create" && (
        <div
          className="sticky bottom-2 z-30 mt-2 rounded-2xl border border-gold/25 bg-surface/95 backdrop-blur px-3 py-2 flex items-center gap-2 shadow-lg"
          role="toolbar"
          aria-label="Video editor actions"
        >
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold truncate">
              {config.title || "Untitled video"}
              <span className="text-muted font-normal ml-2">
                · {selectedType.aspect} · {config.duration}s
              </span>
            </p>
            {generating && (
              <div className="mt-1 w-full h-1 bg-surface-light rounded-full overflow-hidden">
                <div
                  className="h-1 bg-gradient-gold transition-all duration-300"
                  style={{ width: `${renderProgress}%` }}
                />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={runFullPassAutoEdit}
            disabled={fullPassRunning || !result?.url || !aiProject?.project_id}
            className="text-[10px] px-3 py-1.5 rounded-lg border border-gold/30 bg-gold/10 text-gold hover:bg-gold/20 flex items-center gap-1.5 disabled:opacity-40"
            title={
              !result?.url || !aiProject?.project_id
                ? "Generate a video + AI project first"
                : "Run detect-scenes → suggest → captions → B-roll"
            }
          >
            {fullPassRunning ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
            One-click AI edit
          </button>
          {result?.url ? (
            <a
              href={result.url}
              download
              target="_blank"
              rel="noopener"
              className="btn-primary text-[10px] px-3 py-1.5 flex items-center gap-1.5"
            >
              <Download size={10} /> Export
            </a>
          ) : (
            <button
              type="button"
              onClick={generateVideo}
              disabled={generating || !config.title}
              className="btn-primary text-[10px] px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-40"
            >
              {generating ? <Loader2 size={10} className="animate-spin" /> : <Film size={10} />}
              {generating ? "Rendering…" : "Render + Export"}
            </button>
          )}
        </div>
      )}

      {/* Preset Picker sidebar — right-side drawer; Cmd/Ctrl+K toggles. */}
      <PresetPickerPanel
        open={showPresetPicker}
        onOpenChange={setShowPresetPicker}
        onDropOnTimeline={handlePresetDrop}
        onApplyFont={(font) => {
          try {
            document.documentElement.style.setProperty(
              "--caption-font-family",
              `"${font.family}"`,
            );
          } catch {
            /* ignore */
          }
          toast.success(`Font applied: ${font.family}`);
        }}
      />
      </>
      )}
    </div>
  );
}

/* ─── Helper components for Smart Presets sub-tab ───────────── */

function CollapsiblePanel({
  id, icon, title, desc, open, onToggle, children,
  enabledToggle, badge,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  desc?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  enabledToggle?: { value: boolean; onChange: (v: boolean) => void };
  badge?: number;
}) {
  return (
    <div className="card">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 text-left"
        aria-expanded={open}
        aria-controls={`panel-${id}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <div className="min-w-0">
            <h2 className="section-header mb-0 flex items-center gap-2">
              {title}
              {typeof badge === "number" && badge > 0 && (
                <span className="text-[8px] bg-gold/15 text-gold px-1.5 py-0.5 rounded-full font-mono">{badge}</span>
              )}
            </h2>
            {desc && <p className="text-[9px] text-muted mt-0.5">{desc}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {enabledToggle && (
            <label
              className="flex items-center gap-1.5 text-[9px] text-muted cursor-pointer"
              onClick={e => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={enabledToggle.value}
                onChange={e => enabledToggle.onChange(e.target.checked)}
                className="rounded border-border text-gold focus:ring-gold/30"
              />
              {enabledToggle.value ? "Enabled" : "Off"}
            </label>
          )}
          {open ? <ChevronDown size={14} className="text-muted" /> : <ChevronRight size={14} className="text-muted" />}
        </div>
      </button>
      {open && (
        <div id={`panel-${id}`} className="mt-3 pt-3 border-t border-border">
          {children}
        </div>
      )}
    </div>
  );
}

function ToggleRow({
  label, desc, icon, checked, onChange,
}: {
  label: string;
  desc?: string;
  icon?: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className={`flex items-start gap-2 p-2 rounded-lg border transition-all cursor-pointer ${checked ? "border-gold/30 bg-gold/[0.05]" : "border-border hover:border-gold/15"}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="mt-0.5 rounded border-border text-gold focus:ring-gold/30 flex-shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {icon && <span className={checked ? "text-gold" : "text-muted"}>{icon}</span>}
          <p className="text-[10px] font-semibold leading-tight">{label}</p>
        </div>
        {desc && <p className="text-[8px] text-muted mt-0.5 leading-tight">{desc}</p>}
      </div>
    </label>
  );
}

function SummaryRow({ label, on, value }: { label: string; on: boolean; value?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted">{label}</span>
      <span className={`font-mono ${on ? "text-gold" : "text-muted/50"}`}>{value || (on ? "on" : "off")}</span>
    </div>
  );
}

/* ─── Video Presets Tab ──────────────────────────────────────── */
import { VideoPreset } from "@/lib/presets";

function VideoPresetsTab({ onSelect }: { onSelect: (preset: VideoPreset) => void }) {
  const [activeCategory, setActiveCategory] = useState("hooks");
  const [search, setSearch] = useState("");

  const filtered = VIDEO_PRESETS.filter(p => {
    const matchesCategory = p.category === activeCategory;
    const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.desc.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">{VIDEO_PRESETS.length} presets — select one to auto-fill all settings</p>
        <div className="relative">
          <input
            type="text" placeholder="Search presets..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="input text-[10px] w-48 pl-3 py-1"
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1.5">
        {VIDEO_PRESET_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`text-[10px] px-3 py-1.5 rounded-lg border transition-all ${
              activeCategory === cat.id
                ? "bg-gold/10 text-gold border-gold/20 font-semibold"
                : "text-muted border-border hover:border-gold/15 hover:text-foreground"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Preset cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(preset => (
          <button
            key={preset.id}
            onClick={() => onSelect(preset)}
            className="card card-hover text-left p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-semibold">{preset.name}</h3>
              <span className="text-[8px] text-muted bg-surface-light px-1.5 py-0.5 rounded">
                {preset.config.aspect_ratio} / {preset.config.duration}s
              </span>
            </div>
            <p className="text-[9px] text-muted mb-2">{preset.desc}</p>
            <div className="flex flex-wrap gap-1">
              <span className="text-[8px] bg-gold/10 text-gold px-1.5 py-0.5 rounded">{preset.config.style}</span>
              <span className="text-[8px] bg-surface-light text-muted px-1.5 py-0.5 rounded">{preset.config.caption_style}</span>
              <span className="text-[8px] bg-surface-light text-muted px-1.5 py-0.5 rounded">{preset.config.music_mood}</span>
            </div>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8 text-xs text-muted">
          No presets found. Try a different category or search term.
        </div>
      )}

      {/* Batch ideas */}
      <div className="card border-gold/10">
        <h3 className="section-header flex items-center gap-2"><Zap size={12} className="text-gold" /> Weekly Content Plan</h3>
        <p className="text-[10px] text-muted mb-3">Auto-generate a week of video content — one preset per day</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {["Monday Motivation", "Tuesday Tip", "Wednesday BTS", "Thursday Myth Bust", "Friday Client Win", "Saturday Q&A", "Sunday Recap"].map((day, i) => (
            <div key={i} className="p-2 rounded-lg border border-border text-center">
              <p className="text-[10px] font-semibold">{day}</p>
              <p className="text-[8px] text-muted">Auto-generate</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
