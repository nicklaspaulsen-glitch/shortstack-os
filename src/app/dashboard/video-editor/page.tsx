"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { useManagedClient } from "@/lib/use-managed-client";
import {
  Film, Sparkles, Loader, Play, Copy, Download,
  Clock, Camera, Monitor, Zap, Music, Type, Wand2,
  Layers, Mic, Volume2, Palette, LayoutGrid, Eye,
  BookOpen, Scissors, Image as ImageIcon, Upload, X,
  GripVertical, FileText, Paintbrush, Sliders, Ratio,
  SunMedium, MessageSquare, History, Speech, MonitorPlay,
  Gauge, TextCursorInput, Droplets, BarChart3, ListChecks,
  ImagePlus, Megaphone, Settings2,
  Plus, Minus, Check, AlertCircle, Timer
} from "lucide-react";
import toast from "react-hot-toast";
import PromptEnhancer from "@/components/prompt-enhancer";
import { VIDEO_PRESETS, VIDEO_PRESET_CATEGORIES } from "@/lib/presets";
import { getMaxReferenceFile, formatBytes } from "@/lib/plan-config";

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

const MUSIC_MOODS = [
  { id: "upbeat", name: "Upbeat", emoji: "🎵" },
  { id: "motivational", name: "Motivational", emoji: "💪" },
  { id: "chill", name: "Chill", emoji: "😎" },
  { id: "dramatic", name: "Dramatic", emoji: "🎬" },
  { id: "corporate", name: "Corporate", emoji: "💼" },
  { id: "trendy", name: "Trendy/Pop", emoji: "🔥" },
  { id: "emotional", name: "Emotional", emoji: "❤️" },
  { id: "lofi", name: "Lo-Fi", emoji: "🎧" },
  { id: "cinematic", name: "Cinematic", emoji: "🎞️" },
  { id: "edm", name: "EDM/Electronic", emoji: "⚡" },
  { id: "hip-hop", name: "Hip-Hop", emoji: "🎤" },
  { id: "acoustic", name: "Acoustic", emoji: "🎸" },
  { id: "jazz", name: "Jazz", emoji: "🎷" },
  { id: "ambient", name: "Ambient", emoji: "🌊" },
  { id: "epic", name: "Epic/Orchestral", emoji: "🎻" },
  { id: "funk", name: "Funk/Groove", emoji: "🕺" },
  { id: "none", name: "No Music", emoji: "🔇" },
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
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<VideoResult | null>(null);
  const [clients, setClients] = useState<Array<{ id: string; business_name: string }>>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const supabase = createClient();

  const [referenceFiles, setReferenceFiles] = useState<Array<{ name: string; type: string; preview: string; data: string }>>([]);
  const [tab, setTab] = useState<"create" | "storyboard" | "templates" | "assets" | "export">("create");
  const [mode, setMode] = useState<"render" | "plan" | "storyboard">("plan");
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
  const [createSubTab, setCreateSubTab] = useState<"editor" | "scene-builder" | "ai-script" | "audio-mixer" | "advanced">("editor");
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
  const [versionHistory] = useState([
    { id: "v3", version: "v3", date: "Apr 14, 2026 2:30 PM", status: "current", changes: "Added CTA overlay + music" },
    { id: "v2", version: "v2", date: "Apr 14, 2026 1:15 PM", status: "previous", changes: "Updated script timing" },
    { id: "v1", version: "v1", date: "Apr 14, 2026 11:00 AM", status: "previous", changes: "Initial render" },
  ]);
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
  const [analyticsPreview] = useState({
    predictedWatchThrough: 72,
    hookStrength: 85,
    optimalLength: 28,
    engagementScore: 78,
  });
  const [batchQueue, setBatchQueue] = useState<Array<{ id: string; title: string; status: "queued" | "rendering" | "done" | "failed"; progress: number }>>([]);
  const [thumbnailFrames] = useState([
    { id: "f1", time: "0:03", score: 92, desc: "High-energy hook moment" },
    { id: "f2", time: "0:12", score: 87, desc: "Key visual with text overlay" },
    { id: "f3", time: "0:08", score: 81, desc: "Product close-up shot" },
    { id: "f4", time: "0:22", score: 76, desc: "Before/after comparison" },
  ]);
  const [selectedThumbnail, setSelectedThumbnail] = useState("f1");
  const [hookVariants] = useState([
    { id: "h1", text: "Stop scrolling. This changes everything.", style: "bold-statement" },
    { id: "h2", text: "Nobody talks about this... but they should.", style: "curiosity-gap" },
    { id: "h3", text: "I tested this for 30 days. Here's what happened.", style: "personal-story" },
  ]);
  const [selectedHook, setSelectedHook] = useState("");
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

  async function generateVideo() {
    if (!config.title) { toast.error("Enter a video title"); return; }
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
        toast.error(data.error || "Failed");
      }
    } catch {
      clearInterval(progressInterval);
      toast.dismiss();
      toast.error("Error");
    }
    setGenerating(false);
  }

  const selectedType = VIDEO_TYPES.find(t => t.id === config.type) || VIDEO_TYPES[0];

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
            <Film size={20} className="text-gold" />
          </div>
          <div>
            <h1 className="page-header mb-0">Video Editor</h1>
            <p className="text-xs text-muted">AI storyboards, video plans & GPU rendering via Remotion & Mochi</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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

              {/* Hook Generator */}
              <div className="card">
                <h2 className="section-header flex items-center gap-2"><Megaphone size={13} className="text-gold" /> AI Hook Generator</h2>
                <p className="text-[9px] text-muted mb-3">AI generates attention-grabbing first 3 seconds based on your content.</p>
                <div className="grid grid-cols-1 gap-2">
                  {hookVariants.map(hook => (
                    <button key={hook.id} onClick={() => {
                      setSelectedHook(hook.id);
                      toast.success("Hook selected");
                    }}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        selectedHook === hook.id ? "border-gold/30 bg-gold/[0.05]" : "border-border hover:border-gold/15"
                      }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[8px] uppercase tracking-wider text-gold">{hook.style.replace(/-/g, " ")}</span>
                        {selectedHook === hook.id && <Check size={10} className="text-gold" />}
                      </div>
                      <p className="text-[11px] font-medium">{hook.text}</p>
                    </button>
                  ))}
                </div>
                <button onClick={() => toast.success("Generating new hooks...")} className="mt-2 text-[9px] text-gold hover:underline flex items-center gap-1">
                  <Sparkles size={9} /> Generate More Hooks
                </button>
              </div>
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

        {/* Main Editor (default sub-tab) */}
        {createSubTab === "editor" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {/* Brand Kit Integration */}
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
                    input.accept = "image/*,video/*,audio/*";
                    input.onchange = (ev) => {
                      const files = Array.from((ev.target as HTMLInputElement).files || []);
                      handleFileUpload(files);
                    };
                    input.click();
                  }}
                >
                  <Upload size={16} className="mx-auto text-muted mb-1" />
                  <p className="text-[10px] text-muted">Drop files or click to upload (up to 5, max {maxRefLabel} each)</p>
                  <p className="text-[8px] text-muted/60">Images, video clips, audio, logos</p>
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
                      </div>
                    ))}
                  </div>
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

            {/* Style */}
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

            {/* AI Options */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2"><Wand2 size={13} className="text-gold" /> AI Enhancement Options</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] text-muted uppercase tracking-wider mb-1.5">Music Mood</label>
                  <div className="grid grid-cols-4 gap-1">
                    {MUSIC_MOODS.map(m => (
                      <button key={m.id} onClick={() => setConfig({ ...config, music_mood: m.id })}
                        className={`text-[9px] p-1.5 rounded-lg border transition-all text-center ${
                          config.music_mood === m.id ? "border-gold/30 bg-gold/[0.05] text-gold" : "border-border text-muted hover:text-foreground"
                        }`}>
                        <span className="text-sm">{m.emoji}</span>
                        <p className="text-[8px] mt-0.5">{m.name}</p>
                      </button>
                    ))}
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
          </div>

          {/* Preview / Result */}
          <div className="space-y-4">
            <div className="card-premium border-gold/10 text-center py-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-mesh opacity-20" />
              <div className="relative">
                <div className={`mx-auto mb-3 rounded-xl flex items-center justify-center overflow-hidden ${
                  selectedType.aspect === "9:16" ? "w-28 h-48" : selectedType.aspect === "16:9" ? "w-48 h-28" : "w-36 h-36"
                } bg-surface-light/50 border border-border`}>
                  {result?.url ? (
                    <video src={result.url} controls className="w-full h-full object-cover rounded-xl" />
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

            <div className="card border-gold/10">
              <h3 className="section-header flex items-center gap-2"><Clock size={12} className="text-gold" /> How it works</h3>
              <div className="space-y-1.5 text-[9px] text-muted">
                <p><span className="text-gold font-medium">1.</span> Pick video type, style & AI options</p>
                <p><span className="text-gold font-medium">2.</span> Choose: Storyboard / Plan / Direct Render</p>
                <p><span className="text-gold font-medium">3.</span> AI creates your video with music, captions & CTA</p>
                <p><span className="text-gold font-medium">4.</span> Download and post to social media</p>
              </div>
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

          {/* AI Thumbnail Extractor */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><ImagePlus size={13} className="text-gold" /> AI Thumbnail Extractor</h2>
            <p className="text-[9px] text-muted mb-3">AI selects the best frames from your video as thumbnail candidates.</p>
            <div className="space-y-2">
              {thumbnailFrames.map(frame => (
                <button key={frame.id} onClick={() => setSelectedThumbnail(frame.id)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left ${
                    selectedThumbnail === frame.id ? "border-gold/30 bg-gold/[0.05]" : "border-border hover:border-gold/15"
                  }`}>
                  <div className="w-16 h-10 rounded-lg bg-surface-light border border-border flex items-center justify-center flex-shrink-0">
                    <ImageIcon size={14} className="text-muted" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] font-semibold">{frame.desc}</span>
                      <span className="text-[9px] font-mono text-gold">{frame.score}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] text-muted">@ {frame.time}</span>
                      <div className="flex-1 bg-surface-light rounded-full h-1">
                        <div className="bg-gold rounded-full h-1" style={{ width: `${frame.score}%` }} />
                      </div>
                    </div>
                  </div>
                  {selectedThumbnail === frame.id && <Check size={12} className="text-gold flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Video Analytics Preview */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><BarChart3 size={13} className="text-gold" /> Video Analytics Preview</h2>
            <p className="text-[9px] text-muted mb-3">AI-predicted performance metrics based on video length, style, and content.</p>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[9px] text-muted">Predicted Watch-Through Rate</span>
                  <span className="text-[10px] font-bold text-gold">{analyticsPreview.predictedWatchThrough}%</span>
                </div>
                <div className="w-full bg-surface-light rounded-full h-2">
                  <div className="bg-gradient-gold rounded-full h-2" style={{ width: `${analyticsPreview.predictedWatchThrough}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[9px] text-muted">Hook Strength Score</span>
                  <span className="text-[10px] font-bold text-gold">{analyticsPreview.hookStrength}%</span>
                </div>
                <div className="w-full bg-surface-light rounded-full h-2">
                  <div className="bg-gradient-gold rounded-full h-2" style={{ width: `${analyticsPreview.hookStrength}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[9px] text-muted">Engagement Score</span>
                  <span className="text-[10px] font-bold text-gold">{analyticsPreview.engagementScore}%</span>
                </div>
                <div className="w-full bg-surface-light rounded-full h-2">
                  <div className="bg-gradient-gold rounded-full h-2" style={{ width: `${analyticsPreview.engagementScore}%` }} />
                </div>
              </div>
              <div className="p-2.5 bg-surface-light rounded-xl">
                <div className="flex items-center gap-2 text-[9px]">
                  <AlertCircle size={10} className="text-gold" />
                  <span className="text-muted">Optimal length for this type: <strong className="text-gold">{analyticsPreview.optimalLength}s</strong></span>
                </div>
                {config.duration > analyticsPreview.optimalLength + 15 && (
                  <p className="text-[8px] text-amber-400 mt-1 ml-4">Video may be too long for maximum engagement. Consider trimming.</p>
                )}
              </div>
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

          {/* Version History */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><History size={13} className="text-gold" /> Version History</h2>
            <div className="space-y-2">
              {versionHistory.map(v => (
                <div key={v.id} className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                  v.status === "current" ? "border-gold/30 bg-gold/[0.05]" : "border-border"
                }`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold ${
                    v.status === "current" ? "bg-gold/10 text-gold" : "bg-surface-light text-muted"
                  }`}>{v.version}</div>
                  <div className="flex-1">
                    <p className="text-[10px] font-medium">{v.changes}</p>
                    <p className="text-[8px] text-muted">{v.date}</p>
                  </div>
                  {v.status === "current" ? (
                    <span className="text-[8px] bg-gold/10 text-gold px-1.5 py-0.5 rounded">Current</span>
                  ) : (
                    <button onClick={() => toast.success(`Restored ${v.version}`)} className="text-[8px] text-gold hover:underline">Restore</button>
                  )}
                </div>
              ))}
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
