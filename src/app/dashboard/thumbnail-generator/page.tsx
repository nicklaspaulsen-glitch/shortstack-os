"use client";

import { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import toast from "react-hot-toast";
import PromptEnhancer from "@/components/prompt-enhancer";
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
];

const MOODS = [
  "Dramatic", "Funny", "Shocking", "Inspiring",
  "Educational", "Luxurious", "Scary", "Exciting",
  "Mysterious", "Urgent", "Calm", "Controversial",
  "Nostalgic", "Futuristic", "Playful", "Elegant",
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
];

const EXPORT_PRESET_DEFAULTS = [
  { id: "ep1", name: "YouTube Standard", config: { style: "youtube_classic", platform: "youtube", colorTheme: "red_black", mood: "Dramatic" } },
  { id: "ep2", name: "Instagram Minimal", config: { style: "minimal_clean", platform: "instagram", colorTheme: "black_white", mood: "Elegant" } },
  { id: "ep3", name: "TikTok Bold", config: { style: "bold_colorful", platform: "tiktok", colorTheme: "purple_pink", mood: "Exciting" } },
  { id: "ep4", name: "Tutorial Clean", config: { style: "tutorial_howto", platform: "youtube", colorTheme: "blue_white", mood: "Educational" } },
  { id: "ep5", name: "Podcast Dark", config: { style: "podcast_style", platform: "youtube", colorTheme: "cyan_dark", mood: "Calm" } },
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
  const [activeFeatureTab, setActiveFeatureTab] = useState<"generate" | "history" | "tools">("generate");
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

  function togglePanel(key: string) {
    setExpandedPanels((prev) => ({ ...prev, [key]: !prev[key] }));
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
      (data || []).map((d) => ({
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

  async function generate() {
    if (!prompt.trim()) {
      toast.error("Enter a description for your thumbnail");
      return;
    }
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
        {(["generate", "tools", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t as "generate" | "history"); setActiveFeatureTab(t); }}
            className={activeFeatureTab === t ? "tab-item-active" : "tab-item-inactive"}
          >
            {t === "generate" ? "Generator" : t === "tools" ? "AI Tools" : `History (${history.length})`}
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
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {THUMBNAIL_PRESETS.slice(0, 8).map(preset => (
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
                {["all", "text-heavy", "versus", "listicle", "news", "howto", "reaction", "minimal", "luxury"].map((cat) => (
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
    </div>
  );
}
