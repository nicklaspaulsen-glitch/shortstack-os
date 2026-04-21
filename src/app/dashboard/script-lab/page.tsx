"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { useManagedClient } from "@/lib/use-managed-client";
import {
  Sparkles, Film, Camera,
  Search, Loader, Copy, Zap, Target, MessageSquare,
  ArrowRight, RefreshCw, Eye, CheckCircle, Clock,
  Download, FileText, Wand2, BookOpen,
  Mic, Mail, Hash, TrendingUp, Layers, PenTool,
  ListChecks, Type, Volume2,
  Clapperboard, Box, Headphones, Music,
  ArrowRightLeft, Quote,
  Flame, ExternalLink, Users as UsersIcon, Activity, Repeat
} from "lucide-react";
import toast from "react-hot-toast";
import PageHero from "@/components/ui/page-hero";
import RollingPreview, { type RollingPreviewItem } from "@/components/RollingPreview";
import { Wizard, AdvancedToggle, useAdvancedMode, type WizardStepDef } from "@/components/ui/wizard";
import { trackGeneration } from "@/lib/track-generation";
import AIEnhanceButton from "@/components/ui/ai-enhance-button";

// Example "phone mockup" script cards used in the landing state marquee.
// Each card shows 2-3 lines of a sample script opener — just enough to
// hint at the range of frameworks (Hook-Story-Offer, PAS, AIDA, etc.).
const SCRIPT_LAB_PREVIEW_FALLBACK: RollingPreviewItem[] = [
  { id: "s1", tag: "Reel 30s", title: "Hook-Story-Offer", text: "\"I made $10k last month doing nothing. Here's the system…\"  Pattern-interrupt + story + CTA." },
  { id: "s2", tag: "TikTok 45s", title: "Contrarian Hook", text: "\"Everyone tells you to post daily. That's wrong. Here's what actually works…\"" },
  { id: "s3", tag: "Ad 15s", title: "PAS Framework", text: "\"Still using spreadsheets? You're losing 4 hours a week. Meet the fix…\"" },
  { id: "s4", tag: "YouTube 8min", title: "Storytelling", text: "\"3 years ago I was broke. Today I run a 7-figure agency. Here's the turning point.\"" },
  { id: "s5", tag: "Thread 9 tweets", title: "Listicle", text: "\"7 mistakes that quietly killed my first business. #3 still haunts me.\"" },
  { id: "s6", tag: "Reel 60s", title: "Before/After", text: "\"I used to send 200 cold emails a day and get 2 replies. Now I send 30 and get 18.\"" },
  { id: "s7", tag: "Podcast Intro", title: "Authority", text: "\"Today's guest has built 4 companies from zero to eight figures. Here's what nobody asks him…\"" },
  { id: "s8", tag: "Email 1/5", title: "Curiosity", text: "\"I almost quit last Tuesday. Then one email changed everything. This is that email.\"" },
  { id: "s9", tag: "TikTok 22s", title: "Myth Buster", text: "\"You don't need a funnel. You don't need ads. You need ONE thing and everyone ignores it…\"" },
  { id: "s10", tag: "Carousel 8 slides", title: "How-To", text: "\"How I wrote 100 cold emails in 30 minutes (step-by-step, no AI fluff).\"" },
  { id: "s11", tag: "Short 35s", title: "Question Hook", text: "\"What if I told you the #1 rule of marketing is a lie? Let me prove it in 35 seconds.\"" },
  { id: "s12", tag: "Ad 30s", title: "Direct Offer", text: "\"Attention e-com founders: we'll 2x your AOV in 30 days or you pay nothing. No catch.\"" },
];

const FRAMEWORKS = [
  { id: "hook_story_offer", name: "Hook-Story-Offer", desc: "Stop scroll → tell story → make offer", color: "text-gold" },
  { id: "pas", name: "PAS", desc: "Problem → Agitate → Solution", color: "text-danger" },
  { id: "aida", name: "AIDA", desc: "Attention → Interest → Desire → Action", color: "text-gold" },
  { id: "before_after", name: "Before/After", desc: "Pain state → transformation → results", color: "text-success" },
  { id: "contrarian", name: "Contrarian", desc: "Challenge beliefs → new perspective", color: "text-warning" },
  { id: "listicle", name: "Listicle", desc: "X things/mistakes/secrets that...", color: "text-purple-400" },
  { id: "storytelling", name: "Storytelling", desc: "Personal story → lesson → takeaway", color: "text-info" },
  { id: "myth_buster", name: "Myth Buster", desc: "Common belief → why it's wrong → truth", color: "text-danger" },
  { id: "faq", name: "FAQ Style", desc: "Answer common questions your audience has", color: "text-success" },
  { id: "how_to", name: "How-To", desc: "Step-by-step guide solving a problem", color: "text-info" },
];

const SCRIPT_TYPES = [
  { id: "short_form", name: "Short Form", desc: "30-60s Reel/TikTok", icon: <Camera size={14} /> },
  { id: "long_form", name: "Long Form", desc: "8-15min YouTube", icon: <Film size={14} /> },
  { id: "ad_script", name: "Ad Script", desc: "15-30s paid ad", icon: <Zap size={14} /> },
  { id: "email_sequence", name: "Email Sequence", desc: "3-5 email nurture", icon: <Mail size={14} /> },
  { id: "podcast_outline", name: "Podcast Outline", desc: "Episode structure", icon: <Mic size={14} /> },
  { id: "blog_intro", name: "Blog Intro", desc: "Hook + outline", icon: <BookOpen size={14} /> },
  { id: "twitter_thread", name: "Twitter Thread", desc: "5-10 tweet thread", icon: <Hash size={14} /> },
  { id: "carousel", name: "Carousel Script", desc: "Slide-by-slide copy", icon: <Layers size={14} /> },
];

const TONES = [
  "professional", "casual", "bold", "educational", "storytelling",
  "controversial", "humorous", "urgent", "empathetic", "authoritative",
  "inspirational", "conversational",
];

const PLATFORMS = [
  { id: "instagram", name: "Instagram Reels" },
  { id: "tiktok", name: "TikTok" },
  { id: "youtube", name: "YouTube" },
  { id: "linkedin", name: "LinkedIn" },
  { id: "facebook", name: "Facebook" },
  { id: "twitter", name: "X / Twitter" },
  { id: "podcast", name: "Podcast" },
  { id: "email", name: "Email" },
];

interface ScriptResult {
  title: string;
  hook: { text: string; type: string; why_it_works: string };
  script: { sections: Array<{ name: string; duration: string; dialogue: string; visual_direction: string; text_overlay: string; emotion: string }> };
  pain_points_addressed: string[];
  value_delivered: string;
  cta: { text: string; type: string; placement: string };
  caption: string;
  hashtags: string[];
  posting_strategy: { best_time: string; best_day: string; boost_tip: string };
  thumbnail: { text: string; emotion: string; colors: string };
  ab_variations: Array<{ hook_alt: string; why: string }>;
}

interface ViralResearch {
  viral_videos: Array<{ title: string; hook: string; format: string; why_it_works: string; estimated_views: string; transcript_summary: string; cta_used: string }>;
  patterns: { top_hooks: string[]; best_formats: string[]; optimal_length: string; posting_times: string; content_pillars: string[] };
  competitor_analysis: { strengths: string[]; weaknesses: string[]; content_frequency: string };
  opportunities: string[];
}

interface SavedScript {
  id: string;
  title: string;
  framework: string;
  platform: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

// ── Trending / Viral Remix types ──────────────────────────────────
interface TrendingVideo {
  id: string;
  title: string;
  creator_name: string;
  creator_handle: string;
  platform: string;
  thumbnail_hint: string;
  thumbnail_emoji?: string;
  view_count: number;
  view_count_label: string;
  published_days_ago: number;
  engagement_rate: number;
  duration_sec: number;
  hook: string;
  why_trending: string;
  keywords_used: string[];
  url_hint: string;
}

interface RemixResult {
  remixed_script: string;
  hook: string;
  cta: string;
  suggested_title: string;
  differences: string[];
  structure_kept: string;
  twist_applied: string;
}

const TRENDING_NICHES = [
  "dental", "fitness", "saas", "coaching", "real estate", "ecommerce",
  "law", "finance", "beauty", "food", "travel", "automotive",
  "education", "health", "marketing", "construction", "automotive",
] as const;

const TRENDING_PLATFORM_OPTS = [
  { id: "youtube", label: "YouTube" },
  { id: "tiktok", label: "TikTok" },
  { id: "instagram", label: "Instagram Reels" },
  { id: "shorts", label: "YouTube Shorts" },
] as const;

function platformColor(p: string): string {
  switch (p) {
    case "youtube": return "text-red-400 border-red-400/30 bg-red-400/5";
    case "tiktok": return "text-pink-400 border-pink-400/30 bg-pink-400/5";
    case "instagram": return "text-purple-400 border-purple-400/30 bg-purple-400/5";
    case "shorts": return "text-orange-400 border-orange-400/30 bg-orange-400/5";
    default: return "text-muted border-border";
  }
}

function daysAgoLabel(n: number): string {
  if (n === 0) return "Today";
  if (n === 1) return "Yesterday";
  if (n < 7) return `${n}d ago`;
  return `${Math.round(n / 7)}w ago`;
}

// ── Storyboard types ──────────────────────────────────────────────
type StoryboardFormat =
  | "ugc"
  | "ad"
  | "motion_graphics"
  | "talking_head"
  | "product_demo"
  | "explainer"
  | "cinematic"
  | "podcast_clip";

interface StoryboardShot {
  shot_number: number;
  duration_sec: number;
  visual_description: string;
  camera: string;
  dialog: string;
  action: string;
  transition_in: string;
  transition_out: string;
  on_screen_text: string;
  b_roll_suggestions: string[];
  music_cue: string;
}

interface Storyboard {
  total_duration_sec: number;
  format: StoryboardFormat;
  shots: StoryboardShot[];
  style_notes: string;
  total_shots: number;
}

const STORYBOARD_FORMATS: Array<{ id: StoryboardFormat; name: string; desc: string; icon: React.ReactNode }> = [
  { id: "ugc", name: "UGC", desc: "Handheld, authentic, 15-30s", icon: <Film size={12} /> },
  { id: "ad", name: "Ad", desc: "Punchy cuts, CTA, 15-60s", icon: <Target size={12} /> },
  { id: "motion_graphics", name: "Motion Graphics", desc: "Typography, kinetic, 10-30s", icon: <Layers size={12} /> },
  { id: "talking_head", name: "Talking Head", desc: "Wide + A/B close-ups, 60-180s", icon: <Mic size={12} /> },
  { id: "product_demo", name: "Product Demo", desc: "Tabletop, feature zooms, 30-90s", icon: <Box size={12} /> },
  { id: "explainer", name: "Explainer", desc: "Screen rec + talking head, 60-180s", icon: <BookOpen size={12} /> },
  { id: "cinematic", name: "Cinematic", desc: "B-roll montage, slow moves", icon: <Clapperboard size={12} /> },
  { id: "podcast_clip", name: "Podcast Clip", desc: "Waveform + quotes, 30-60s", icon: <Headphones size={12} /> },
];

const TOPIC_PRESETS: Record<string, string[]> = {
  general: [
    "Why most businesses fail at social media",
    "3 things your competitors don't want you to know",
    "The biggest mistake local businesses make online",
    "How to get 50 new clients in 30 days",
    "Stop wasting money on ads that don't convert",
    "Why your website is losing you customers",
  ],
  dental: [
    "Why most dental practices lose patients to Google",
    "3 things patients check before booking a dentist",
    "The $100K mistake dentists make with their marketing",
    "How to fill your schedule with high-value patients",
  ],
  real_estate: [
    "Why open houses are dead (and what works instead)",
    "3 listing tricks that sell homes 2x faster",
    "The social media strategy top realtors won't share",
    "How to generate leads while you sleep",
  ],
  fitness: [
    "Why 90% of gym memberships go unused",
    "3 ways to get clients without cold calling",
    "The transformation post formula that goes viral",
    "How to turn one client into ten referrals",
  ],
  legal: [
    "Why most law firms waste money on ads",
    "3 ways to build trust before the consultation",
    "The content strategy that fills your case pipeline",
    "How to stand out in a sea of attorneys",
  ],
};

export default function ScriptLabPage() {
  useAuth();
  const { clientId: managedClientId } = useManagedClient();
  const [clients, setClients] = useState<Array<{ id: string; business_name: string; industry: string }>>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [tab, setTab] = useState<"generate" | "research" | "trending" | "results" | "history" | "templates" | "tools" | "voiceover" | "approval">("generate");

  // Guided Mode ↔ Advanced Mode (full tabbed workspace)
  const [advancedMode, setAdvancedMode] = useAdvancedMode("script-lab");
  const [guidedStep, setGuidedStep] = useState(0);
  const supabase = createClient();

  const [config, setConfig] = useState({
    script_type: "short_form",
    platform: "instagram",
    topic: "",
    framework: "hook_story_offer",
    tone: "professional",
    viral_reference: "",
    target_audience: "",
    pain_points: "",
    industry_preset: "general",
    batch_count: 1,
    include_voiceover_notes: false,
    include_b_roll_suggestions: false,
  });

  const [researchConfig, setResearchConfig] = useState({
    competitor_name: "",
    industry: "",
    platform: "instagram",
  });

  const [generating, setGenerating] = useState(false);
  const [researching, setResearching] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [script, setScript] = useState<ScriptResult | null>(null);
  const [batchScripts, setBatchScripts] = useState<ScriptResult[]>([]);
  const [activeBatchIndex, setActiveBatchIndex] = useState(0);
  const [research, setResearch] = useState<ViralResearch | null>(null);
  const [savedScripts, setSavedScripts] = useState<SavedScript[]>([]);

  // Storyboard state
  const [storyboardFormat, setStoryboardFormat] = useState<StoryboardFormat>("ugc");
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [generatingStoryboard, setGeneratingStoryboard] = useState(false);

  // ── Trending (viral research) state ─────────────────────────────
  const [trendingNiche, setTrendingNiche] = useState("");
  const [trendingKeywords, setTrendingKeywords] = useState("");
  const [trendingPlatforms, setTrendingPlatforms] = useState<string[]>(["youtube", "tiktok", "instagram"]);
  const [trendingVideos, setTrendingVideos] = useState<TrendingVideo[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(false);
  const [trendingCached, setTrendingCached] = useState<{ cached: boolean; cached_at?: string; expires_at?: string } | null>(null);
  const [transcribingId, setTranscribingId] = useState<string | null>(null);
  const [remixingId, setRemixingId] = useState<string | null>(null);
  const [transcriptsById, setTranscriptsById] = useState<Record<string, { transcript: string; is_estimated: boolean; source: string }>>({});
  const [remixModal, setRemixModal] = useState<{ video: TrendingVideo; transcript: string } | null>(null);
  const [remixTwistAngle, setRemixTwistAngle] = useState("");
  const [remixResult, setRemixResult] = useState<RemixResult | null>(null);

  // ── Watchlists state ────────────────────────────────────────────
  interface Watchlist {
    id: string;
    name: string;
    niche: string;
    keywords: string[];
    platforms: string[];
    active: boolean;
    alert_on_new: boolean;
    created_at: string;
    updated_at: string;
    last_scanned_at: string | null;
  }
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [loadingWatchlists, setLoadingWatchlists] = useState(false);
  const [scanningWatchlistId, setScanningWatchlistId] = useState<string | null>(null);
  const [savingWatchlist, setSavingWatchlist] = useState(false);
  const [editingWatchlist, setEditingWatchlist] = useState<Watchlist | null>(null);
  const [saveWatchlistModal, setSaveWatchlistModal] = useState(false);
  const [newWatchlistName, setNewWatchlistName] = useState("");

  // Template categories
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [templateCategory, setTemplateCategory] = useState("all");
  const scriptTemplates = [
    { id: "1", name: "Product Launch Announcement", category: "launch", framework: "aida", platform: "instagram", desc: "Build hype for a new product or service launch" },
    { id: "2", name: "Customer Testimonial Story", category: "social_proof", framework: "storytelling", platform: "instagram", desc: "Turn client results into compelling stories" },
    { id: "3", name: "Behind-the-Scenes Tour", category: "brand", framework: "storytelling", platform: "tiktok", desc: "Show the human side of your business" },
    { id: "4", name: "Problem-Solution Demo", category: "educational", framework: "pas", platform: "youtube", desc: "Demonstrate how you solve specific problems" },
    { id: "5", name: "Industry Myth Debunking", category: "educational", framework: "myth_buster", platform: "tiktok", desc: "Challenge common misconceptions" },
    { id: "6", name: "Quick Tips Listicle", category: "educational", framework: "listicle", platform: "instagram", desc: "Share actionable tips in 60 seconds" },
    { id: "7", name: "Before/After Transformation", category: "social_proof", framework: "before_after", platform: "instagram", desc: "Showcase dramatic client results" },
    { id: "8", name: "Day-in-the-Life Vlog", category: "brand", framework: "storytelling", platform: "youtube", desc: "Build personal connection with audience" },
    { id: "9", name: "Trending Sound Script", category: "viral", framework: "hook_story_offer", platform: "tiktok", desc: "Ride trending audio for reach" },
    { id: "10", name: "FAQ Response Series", category: "educational", framework: "faq", platform: "instagram", desc: "Address top questions from audience" },
    { id: "11", name: "Objection Handling Script", category: "sales", framework: "contrarian", platform: "instagram", desc: "Overcome common buying objections" },
    { id: "12", name: "Case Study Breakdown", category: "social_proof", framework: "before_after", platform: "linkedin", desc: "Deep dive into a success story" },
    { id: "13", name: "Seasonal Promotion", category: "sales", framework: "aida", platform: "facebook", desc: "Limited-time offer announcement" },
    { id: "14", name: "Podcast Episode Promo", category: "promotion", framework: "hook_story_offer", platform: "instagram", desc: "Tease podcast episodes for downloads" },
    { id: "15", name: "Email Nurture Welcome", category: "email", framework: "storytelling", platform: "email", desc: "Welcome new subscribers and set expectations" },
    { id: "16", name: "Cold Outreach Script", category: "sales", framework: "pas", platform: "email", desc: "Persuasive first-touch email" },
    { id: "17", name: "Webinar Invitation", category: "promotion", framework: "aida", platform: "email", desc: "Drive registrations for live events" },
    { id: "18", name: "Twitter/X Thread Deep Dive", category: "educational", framework: "how_to", platform: "twitter", desc: "Long-form thread for authority building" },
    { id: "19", name: "LinkedIn Thought Leadership", category: "brand", framework: "contrarian", platform: "linkedin", desc: "Position yourself as an industry expert" },
    { id: "20", name: "Carousel Storytelling", category: "educational", framework: "storytelling", platform: "instagram", desc: "Multi-slide educational content" },
    { id: "21", name: "YouTube Shorts Hook", category: "viral", framework: "hook_story_offer", platform: "youtube", desc: "Maximum impact in 60 seconds" },
    { id: "22", name: "Re-engagement Email", category: "email", framework: "pas", platform: "email", desc: "Win back inactive subscribers" },
    { id: "23", name: "Community Challenge Launch", category: "viral", framework: "hook_story_offer", platform: "tiktok", desc: "Start a challenge for massive reach" },
    { id: "24", name: "Local Business Highlight", category: "brand", framework: "storytelling", platform: "facebook", desc: "Showcase local business partnerships" },
  ];

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const templateCategories = ["all", "educational", "social_proof", "brand", "sales", "viral", "email", "promotion", "launch"];

  // Tone analyzer state
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [toneAnalysisText, setToneAnalysisText] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [toneResult, setToneResult] = useState<{ tones: { tone: string; score: number }[]; readability: string; wordCount: number; sentiment: string } | null>(null);

  // SEO optimizer state
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [seoKeyword, setSeoKeyword] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [seoContent, setSeoContent] = useState("");

  // Voice-over state
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [voiceoverText, setVoiceoverText] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [voiceSpeed, setVoiceSpeed] = useState<"slow" | "normal" | "fast">("normal");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [voiceStyle, setVoiceStyle] = useState<"professional" | "casual" | "energetic" | "calm">("professional");

  // Approval flow state
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [approvalScripts] = useState<{ id: string; title: string; client: string; status: "pending" | "approved" | "revision"; submitted: string; feedback?: string }[]>([]);

  // Multi-platform formatter
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [formatPlatform, setFormatPlatform] = useState("tiktok");

  useEffect(() => {
    supabase.from("clients").select("id, business_name, industry").eq("is_active", true).then(({ data }: { data: { id: string; business_name: string; industry: string }[] | null }) => {
      setClients(data || []);
    });
    loadSavedScripts();
    loadWatchlists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-select managed client
  useEffect(() => {
    if (managedClientId && clients.length > 0) {
      setSelectedClient(managedClientId);
    }
  }, [managedClientId, clients]);

  // Seed trending niche from the selected client's industry (if not already set)
  useEffect(() => {
    if (trendingNiche) return;
    const c = clients.find(x => x.id === selectedClient);
    if (c?.industry) setTrendingNiche(c.industry.toLowerCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClient, clients]);

  // Load niche from profile.onboarding on first mount
  useEffect(() => {
    if (trendingNiche) return;
    supabase.from("profiles").select("onboarding_personalization").then((res: { data: Array<{ onboarding_personalization?: Record<string, unknown> }> | null }) => {
      const row = res.data?.[0];
      const industry = (row?.onboarding_personalization as Record<string, unknown> | undefined)?.industry;
      if (typeof industry === "string" && industry.trim()) setTrendingNiche(industry.toLowerCase());
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSavedScripts() {
    const { data } = await supabase
      .from("trinity_log")
      .select("id, description, metadata, created_at, client_id")
      .eq("action_type", "script_generated")
      .order("created_at", { ascending: false })
      .limit(20);
    setSavedScripts((data || []).map((d: any) => ({
      id: d.id as string,
      title: d.description as string,
      framework: (d.metadata as Record<string, string>)?.framework || "",
      platform: (d.metadata as Record<string, string>)?.platform || "",
      created_at: d.created_at as string,
      metadata: d.metadata as Record<string, unknown>,
    })));
  }

  async function generateScript() {
    if (!config.topic) { toast.error("Enter a topic"); return; }
    setGenerating(true);
    setBatchScripts([]);
    setActiveBatchIndex(0);
    const toastId = "gen-script";
    toast.loading(config.batch_count > 1 ? `Generating ${config.batch_count} variations...` : "AI is crafting your script...", { id: toastId });
    try {
      const results: ScriptResult[] = [];
      for (let i = 0; i < config.batch_count; i++) {
        const res = await fetch("/api/content/advanced-script", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...config,
            client_id: selectedClient || null,
            variation_index: i,
            include_voiceover_notes: config.include_voiceover_notes,
            include_b_roll_suggestions: config.include_b_roll_suggestions,
          }),
        });
        const data = await res.json();
        if (data.success) results.push(data.script);
      }
      if (results.length > 0) {
        setScript(results[0]);
        setBatchScripts(results);
        setTab("results");
        // Save to history
        await supabase.from("trinity_log").insert({
          action_type: "script_generated",
          description: results[0].title,
          client_id: selectedClient || null,
          status: "completed",
          metadata: { framework: config.framework, platform: config.platform, tone: config.tone, script_type: config.script_type, script: results[0] },
        });
        loadSavedScripts();
        toast.success(results.length > 1 ? `${results.length} script variations generated!` : "Script generated!", { id: toastId });
      } else {
        toast.error("Failed to generate", { id: toastId });
      }
    } catch {
      toast.error("Error generating script", { id: toastId });
    } finally {
      setGenerating(false);
    }
  }

  async function rewriteScript(instruction: string) {
    if (!script) return;
    setRewriting(true);
    const toastId = "rewrite";
    toast.loading("AI is rewriting...", { id: toastId });
    try {
      const res = await fetch("/api/content/advanced-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...config,
          client_id: selectedClient || null,
          rewrite_instruction: instruction,
          original_script: JSON.stringify(script),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setScript(data.script);
        toast.success("Script rewritten!", { id: toastId });
      } else {
        toast.error("Rewrite failed", { id: toastId });
      }
    } catch {
      toast.error("Error", { id: toastId });
    }
    setRewriting(false);
  }

  async function generateStoryboard() {
    if (!activeScript) { toast.error("Generate a script first"); return; }
    const scriptText = buildScriptPlainText(activeScript);
    if (!scriptText) { toast.error("Script has no content"); return; }
    setGeneratingStoryboard(true);
    setStoryboard(null);
    const toastId = "storyboard";
    toast.loading("AI is breaking down your script shot-by-shot...", { id: toastId });
    try {
      const res = await fetch("/api/script-lab/storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script_text: scriptText,
          format: storyboardFormat,
          platform: config.platform,
        }),
      });
      const data = await res.json();
      if (data.success && data.storyboard) {
        setStoryboard(data.storyboard);
        toast.success(`Storyboard ready — ${data.storyboard.total_shots} shots`, { id: toastId });
        // Fire-and-forget Generations tracking
        trackGeneration({
          category: "storyboard",
          title: `${activeScript.title} — ${storyboardFormat.replace(/_/g, " ")}`,
          source_tool: "Script Lab",
          content_preview: data.storyboard.style_notes?.slice(0, 200) || "",
          metadata: {
            format: storyboardFormat,
            platform: config.platform,
            total_duration_sec: data.storyboard.total_duration_sec,
            total_shots: data.storyboard.total_shots,
            storyboard_id: data.storyboard_id,
          },
        });
      } else {
        toast.error(data.error || "Storyboard generation failed", { id: toastId });
      }
    } catch {
      toast.error("Error generating storyboard", { id: toastId });
    } finally {
      setGeneratingStoryboard(false);
    }
  }

  function buildScriptPlainText(s: ScriptResult): string {
    const hook = s.hook?.text ? `HOOK: ${s.hook.text}\n\n` : "";
    const sections = (s.script?.sections || [])
      .map(sec => `[${sec.name}] (${sec.duration})\n${sec.dialogue}${sec.visual_direction ? `\nVisual: ${sec.visual_direction}` : ""}${sec.text_overlay ? `\nOverlay: ${sec.text_overlay}` : ""}`)
      .join("\n\n");
    const cta = s.cta?.text ? `\n\nCTA: ${s.cta.text}` : "";
    return `${hook}${sections}${cta}`.trim();
  }

  function getShotTheme(index: number, total: number): "opening" | "middle" | "ending" {
    if (index === 0) return "opening";
    if (index >= total - 1) return "ending";
    return "middle";
  }

  function copyStoryboardAsMarkdown() {
    if (!storyboard) return;
    const lines: string[] = [];
    lines.push(`# Storyboard — ${storyboardFormat.replace(/_/g, " ")}`);
    lines.push("");
    lines.push(`**Total duration:** ${storyboard.total_duration_sec}s | **Total shots:** ${storyboard.total_shots}`);
    if (storyboard.style_notes) {
      lines.push("");
      lines.push(`**Style notes:** ${storyboard.style_notes}`);
    }
    lines.push("");
    storyboard.shots.forEach(shot => {
      lines.push(`## Shot ${shot.shot_number} — ${shot.duration_sec}s`);
      lines.push("");
      lines.push(`- **Visual:** ${shot.visual_description}`);
      lines.push(`- **Camera:** ${shot.camera}`);
      if (shot.dialog) lines.push(`- **Dialog:** "${shot.dialog}"`);
      if (shot.action) lines.push(`- **Action:** ${shot.action}`);
      lines.push(`- **Transition in:** ${shot.transition_in}`);
      lines.push(`- **Transition out:** ${shot.transition_out}`);
      if (shot.on_screen_text) lines.push(`- **On-screen text:** ${shot.on_screen_text}`);
      if (shot.b_roll_suggestions?.length) lines.push(`- **B-roll:** ${shot.b_roll_suggestions.join(", ")}`);
      if (shot.music_cue) lines.push(`- **Music:** ${shot.music_cue}`);
      lines.push("");
    });
    navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Storyboard copied as Markdown!");
  }

  function copyStoryboardAsCSV() {
    if (!storyboard) return;
    const header = [
      "shot_number", "duration_sec", "visual_description", "camera", "dialog",
      "action", "transition_in", "transition_out", "on_screen_text",
      "b_roll_suggestions", "music_cue"
    ];
    const escape = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = storyboard.shots.map(s => [
      s.shot_number,
      s.duration_sec,
      escape(s.visual_description),
      escape(s.camera),
      escape(s.dialog),
      escape(s.action),
      escape(s.transition_in),
      escape(s.transition_out),
      escape(s.on_screen_text),
      escape((s.b_roll_suggestions || []).join(" | ")),
      escape(s.music_cue),
    ].join(","));
    const csv = [header.join(","), ...rows].join("\n");
    navigator.clipboard.writeText(csv);
    toast.success("CSV copied — paste into Premiere/Resolve spreadsheet!");
  }

  async function doResearch() {
    if (!researchConfig.industry) { toast.error("Enter an industry"); return; }
    setResearching(true);
    const toastId = "research";
    toast.loading("Researching viral content...", { id: toastId });
    try {
      const res = await fetch("/api/content/viral-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...researchConfig, client_id: selectedClient || null }),
      });
      const data = await res.json();
      if (data.success) {
        setResearch(data.research);
        toast.success("Research complete!", { id: toastId });
      } else {
        toast.error(data.error || "Research failed", { id: toastId });
      }
    } catch {
      toast.error("Error", { id: toastId });
    } finally {
      setResearching(false);
    }
  }

  // ── Trending / Viral Remix handlers ────────────────────────────
  async function findTrending(forceRefresh = false) {
    const niche = trendingNiche.trim();
    if (!niche) { toast.error("Pick a niche first"); return; }
    if (trendingPlatforms.length === 0) { toast.error("Select at least one platform"); return; }
    setLoadingTrending(true);
    setTrendingVideos([]);
    setTrendingCached(null);
    // Use a stable toast id so rapid clicks don't stack bubbles and so the
    // success/error update the same toast instead of leaking a stray loader.
    const toastId = "trending";
    toast.loading(forceRefresh ? "Refreshing trending videos..." : "Finding today's trending videos...", { id: toastId });
    try {
      const keywords = trendingKeywords.split(",").map(k => k.trim()).filter(Boolean);
      const res = await fetch("/api/script-lab/trending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche,
          keywords,
          platforms: trendingPlatforms,
          limit: 30,
          force_refresh: forceRefresh,
        }),
      });
      const data = await res.json().catch(() => ({ error: "Invalid response from server" }));
      if (res.ok && data.success && Array.isArray(data.videos)) {
        setTrendingVideos(data.videos);
        setTrendingCached({ cached: Boolean(data.cached), cached_at: data.cached_at, expires_at: data.expires_at });
        toast.success(`${data.videos.length} trending videos loaded${data.cached ? " (cached)" : ""}`, { id: toastId });
      } else {
        toast.error(data.error || "Couldn't load trending", { id: toastId });
      }
    } catch {
      toast.error("Network error", { id: toastId });
    } finally {
      setLoadingTrending(false);
    }
  }

  // ── Watchlist handlers ─────────────────────────────────────────
  async function loadWatchlists() {
    setLoadingWatchlists(true);
    try {
      const res = await fetch("/api/viral/watchlists");
      const data = await res.json();
      if (res.ok && Array.isArray(data.watchlists)) {
        setWatchlists(data.watchlists);
      }
    } catch {
      // silent — watchlist UI stays empty
    } finally {
      setLoadingWatchlists(false);
    }
  }

  async function saveAsWatchlist() {
    const niche = trendingNiche.trim();
    const name = newWatchlistName.trim() || niche;
    if (!name) { toast.error("Give the watchlist a name"); return; }
    if (!niche) { toast.error("Pick a niche first"); return; }
    if (trendingPlatforms.length === 0) { toast.error("Select at least one platform"); return; }
    setSavingWatchlist(true);
    const toastId = "save-watchlist";
    toast.loading("Saving watchlist...", { id: toastId });
    try {
      const keywords = trendingKeywords.split(",").map(k => k.trim()).filter(Boolean);
      const res = await fetch("/api/viral/watchlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, niche, keywords, platforms: trendingPlatforms, active: true, alert_on_new: false }),
      });
      const data = await res.json();
      if (res.ok && data.watchlist) {
        toast.success("Watchlist saved!", { id: toastId });
        setSaveWatchlistModal(false);
        setNewWatchlistName("");
        loadWatchlists();
      } else {
        toast.error(data.error || "Couldn't save watchlist", { id: toastId });
      }
    } catch {
      toast.error("Network error", { id: toastId });
    } finally {
      setSavingWatchlist(false);
    }
  }

  async function loadWatchlistTrending(w: Watchlist) {
    // Hydrate the search form from the watchlist, then fire the normal
    // trending fetch — the 24h cache means this is usually instant.
    setTrendingNiche(w.niche);
    setTrendingKeywords(w.keywords.join(", "));
    setTrendingPlatforms(w.platforms);
    setLoadingTrending(true);
    setTrendingVideos([]);
    setTrendingCached(null);
    const toastId = "watchlist-load";
    toast.loading(`Loading ${w.name}...`, { id: toastId });
    try {
      const res = await fetch("/api/script-lab/trending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche: w.niche,
          keywords: w.keywords,
          platforms: w.platforms,
          limit: 30,
        }),
      });
      const data = await res.json().catch(() => ({ error: "Invalid response" }));
      if (res.ok && data.success && Array.isArray(data.videos)) {
        setTrendingVideos(data.videos);
        setTrendingCached({ cached: Boolean(data.cached), cached_at: data.cached_at, expires_at: data.expires_at });
        toast.success(`${data.videos.length} videos loaded${data.cached ? " (cached)" : ""}`, { id: toastId });
      } else {
        toast.error(data.error || "Couldn't load watchlist", { id: toastId });
      }
    } catch {
      toast.error("Network error", { id: toastId });
    } finally {
      setLoadingTrending(false);
    }
  }

  async function scanWatchlistNow(w: Watchlist) {
    setScanningWatchlistId(w.id);
    const toastId = `scan-${w.id}`;
    toast.loading(`Scanning ${w.name}...`, { id: toastId });
    try {
      const res = await fetch(`/api/viral/watchlists/${w.id}/scan-now`, { method: "POST" });
      const data = await res.json().catch(() => ({ error: "Invalid response" }));
      if (res.ok && data.success && Array.isArray(data.videos)) {
        setTrendingNiche(w.niche);
        setTrendingKeywords(w.keywords.join(", "));
        setTrendingPlatforms(w.platforms);
        setTrendingVideos(data.videos);
        setTrendingCached({ cached: false });
        toast.success(`${data.videos.length} fresh videos for ${w.name}`, { id: toastId });
        loadWatchlists(); // refresh last_scanned_at
      } else {
        toast.error(data.error || "Scan failed", { id: toastId });
      }
    } catch {
      toast.error("Network error", { id: toastId });
    } finally {
      setScanningWatchlistId(null);
    }
  }

  async function deleteWatchlist(w: Watchlist) {
    if (!confirm(`Delete watchlist "${w.name}"?`)) return;
    try {
      const res = await fetch(`/api/viral/watchlists/${w.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Watchlist deleted");
        setWatchlists(prev => prev.filter(x => x.id !== w.id));
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Delete failed");
      }
    } catch {
      toast.error("Network error");
    }
  }

  async function toggleWatchlistAlerts(w: Watchlist) {
    try {
      const res = await fetch(`/api/viral/watchlists/${w.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alert_on_new: !w.alert_on_new }),
      });
      const data = await res.json();
      if (res.ok && data.watchlist) {
        setWatchlists(prev => prev.map(x => x.id === w.id ? data.watchlist : x));
        toast.success(data.watchlist.alert_on_new ? "Alerts on" : "Alerts off");
      } else {
        toast.error(data.error || "Toggle failed");
      }
    } catch {
      toast.error("Network error");
    }
  }

  async function saveEditedWatchlist() {
    if (!editingWatchlist) return;
    setSavingWatchlist(true);
    try {
      const res = await fetch(`/api/viral/watchlists/${editingWatchlist.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingWatchlist.name,
          niche: editingWatchlist.niche,
          keywords: editingWatchlist.keywords,
          platforms: editingWatchlist.platforms,
          active: editingWatchlist.active,
          alert_on_new: editingWatchlist.alert_on_new,
        }),
      });
      const data = await res.json();
      if (res.ok && data.watchlist) {
        setWatchlists(prev => prev.map(x => x.id === editingWatchlist.id ? data.watchlist : x));
        toast.success("Watchlist updated");
        setEditingWatchlist(null);
      } else {
        toast.error(data.error || "Update failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSavingWatchlist(false);
    }
  }

  async function transcribeVideo(video: TrendingVideo): Promise<string | null> {
    setTranscribingId(video.id);
    try {
      const res = await fetch("/api/script-lab/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_url: video.url_hint,
          title: video.title,
          creator_name: video.creator_name,
          hook: video.hook,
          platform: video.platform,
        }),
      });
      const data = await res.json();
      if (data.success && data.transcript) {
        setTranscriptsById(prev => ({
          ...prev,
          [video.id]: { transcript: data.transcript, is_estimated: Boolean(data.is_estimated), source: String(data.source || "") },
        }));
        toast.success(data.is_estimated ? "Transcript (AI-estimated)" : "Real transcript fetched!");
        return data.transcript as string;
      }
      toast.error(data.error || "Transcript failed");
      return null;
    } catch {
      toast.error("Network error");
      return null;
    } finally {
      setTranscribingId(null);
    }
  }

  async function openRemix(video: TrendingVideo) {
    let transcript = transcriptsById[video.id]?.transcript;
    if (!transcript) {
      const fetched = await transcribeVideo(video);
      if (!fetched) return;
      transcript = fetched;
    }
    setRemixModal({ video, transcript });
    setRemixTwistAngle("");
    setRemixResult(null);
  }

  async function runRemix() {
    if (!remixModal) return;
    setRemixingId(remixModal.video.id);
    setRemixResult(null);
    const toastId = "remix";
    toast.loading("Remixing with your twist...", { id: toastId });
    try {
      const clientObj = clients.find(c => c.id === selectedClient);
      const niche = clientObj?.industry || trendingNiche || "general business";
      const res = await fetch("/api/script-lab/remix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: remixModal.transcript,
          client_niche: niche,
          client_voice: config.tone || "professional, conversational",
          original_hook: remixModal.video.hook,
          original_title: remixModal.video.title,
          twist_angle: remixTwistAngle,
          platform: remixModal.video.platform,
          client_id: selectedClient || null,
        }),
      });
      const data = await res.json();
      if (data.success && data.remix) {
        setRemixResult(data.remix);
        toast.success("Remix ready!", { id: toastId });
        // Track generation
        await trackGeneration({
          category: "script",
          source_tool: "Script Lab — Viral Remix",
          title: data.remix.suggested_title || remixModal.video.title,
          content_preview: (data.remix.remixed_script || "").slice(0, 200),
          metadata: {
            original_video: {
              title: remixModal.video.title,
              creator: remixModal.video.creator_handle,
              platform: remixModal.video.platform,
              url: remixModal.video.url_hint,
            },
            twist_angle: remixTwistAngle,
            niche,
            hook: data.remix.hook,
            cta: data.remix.cta,
          },
        });
        loadSavedScripts();
      } else {
        toast.error(data.error || "Remix failed", { id: toastId });
      }
    } catch {
      toast.error("Network error", { id: toastId });
    } finally {
      setRemixingId(null);
    }
  }

  function useRemixAsTopic() {
    if (!remixResult || !remixModal) return;
    setConfig(prev => ({
      ...prev,
      topic: remixResult.suggested_title,
      viral_reference: `${remixModal.video.title}: ${remixModal.video.hook}`,
      platform: remixModal.video.platform === "shorts" ? "youtube" : remixModal.video.platform,
    }));
    setRemixModal(null);
    setTab("generate");
    toast.success("Loaded into Generator — tweak then click Generate!");
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied!");
  }

  function getWordCount(): number {
    if (!script) return 0;
    return script.script.sections.reduce((acc, s) => acc + s.dialogue.split(/\s+/).length, 0);
  }

  function getEstimatedDuration(): string {
    const words = getWordCount();
    const minutes = Math.floor(words / 150);
    const seconds = Math.round((words % 150) / 2.5);
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  }

  function downloadAsText() {
    if (!script) return;
    const text = [
      "═══════════════════════════════════════",
      "              TRINITY",
      "           Script Document",
      "═══════════════════════════════════════",
      "",
      `Title: ${script.title}`,
      `Generated: ${new Date().toLocaleDateString()}`,
      `Framework: ${config.framework.replace(/_/g, " ").toUpperCase()}`,
      `Platform: ${config.platform.toUpperCase()}`,
      `Words: ${getWordCount()} | Est. Duration: ${getEstimatedDuration()}`,
      "",
      "─────────────────────────────────────",
      "THE HOOK",
      "─────────────────────────────────────",
      `"${script.hook.text}"`,
      `Type: ${script.hook.type}`,
      `Why it works: ${script.hook.why_it_works}`,
      "",
      "─────────────────────────────────────",
      "FULL SCRIPT",
      "─────────────────────────────────────",
      ...script.script.sections.map(s => [
        "", `[${s.name}] (${s.duration}) — ${s.emotion}`,
        s.dialogue,
        s.visual_direction ? `  Visual: ${s.visual_direction}` : "",
        s.text_overlay ? `  Text overlay: ${s.text_overlay}` : "",
      ].filter(Boolean)).flat(),
      "",
      "─────────────────────────────────────",
      "CTA",
      "─────────────────────────────────────",
      `"${script.cta.text}" (${script.cta.type} — ${script.cta.placement})`,
      "",
      "POSTING: " + script.posting_strategy.best_time + " on " + script.posting_strategy.best_day,
      "TIP: " + script.posting_strategy.boost_tip,
      "",
      "─────────────────────────────────────",
      "CAPTION",
      "─────────────────────────────────────",
      script.caption,
      "",
      "HASHTAGS: " + (script.hashtags?.join(" ") || ""),
      "",
      "─────────────────────────────────────",
      "A/B HOOK VARIATIONS",
      "─────────────────────────────────────",
      ...(script.ab_variations?.map((v, i) => `${i+1}. "${v.hook_alt}" — ${v.why}`) || []),
      "",
      "═══════════════════════════════════════",
      "  Generated by Trinity",
      "═══════════════════════════════════════",
    ].join("\n");

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `${script.title.replace(/[^a-zA-Z0-9]/g, "_")}_script.txt`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("Script downloaded as TXT!");
  }

  function downloadAsHTML() {
    if (!script) return;
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${script.title} — Trinity Script</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', system-ui, sans-serif; background: #fff; color: #1a1a1a; padding: 40px; max-width: 800px; margin: 0 auto; }
  .logo-bar { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #C9A84C; padding-bottom: 16px; margin-bottom: 32px; }
  .logo-bar h1 { font-size: 20px; font-weight: 800; color: #C9A84C; letter-spacing: -0.5px; }
  .logo-bar .sub { font-size: 11px; color: #666; }
  .meta { font-size: 12px; color: #888; margin-bottom: 24px; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 2px; color: #C9A84C; margin: 24px 0 12px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
  .hook-box { background: linear-gradient(135deg, #fdf8ed, #fff9e0); border: 1px solid #C9A84C40; border-radius: 12px; padding: 16px; margin: 12px 0; }
  .hook-text { font-size: 16px; font-style: italic; font-weight: 600; color: #1a1a1a; }
  .section { background: #f9f9f9; border-radius: 8px; padding: 16px; margin: 8px 0; border-left: 3px solid #C9A84C; }
  .section-name { font-weight: 700; font-size: 12px; color: #C9A84C; text-transform: uppercase; }
  .section-meta { font-size: 11px; color: #888; }
  .dialogue { font-size: 14px; line-height: 1.6; margin-top: 8px; }
  .visual { font-size: 11px; color: #0ea5e9; margin-top: 6px; }
  .cta-box { background: #1a1a1a; color: white; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0; }
  .cta-text { font-size: 18px; font-weight: 700; color: #C9A84C; }
  .caption { background: #f5f5f5; border-radius: 8px; padding: 16px; white-space: pre-wrap; font-size: 13px; line-height: 1.5; }
  .hashtags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
  .hashtag { background: #e8f4fd; color: #0ea5e9; font-size: 11px; padding: 3px 8px; border-radius: 20px; }
  .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 16px; }
  @media print { body { padding: 20px; } }
</style></head><body>
<div class="logo-bar">
  <div><h1>TRINITY</h1><div class="sub">Script Document</div></div>
  <div style="font-size:11px;color:#888">Script Document<br>${new Date().toLocaleDateString()}</div>
</div>
<div class="meta">Framework: ${config.framework.replace(/_/g, " ")} | Platform: ${config.platform} | Tone: ${config.tone} | Words: ${getWordCount()} | Duration: ${getEstimatedDuration()}</div>
<h2>The Hook</h2>
<div class="hook-box">
  <div class="hook-text">"${script.hook.text}"</div>
  <div style="font-size:11px;color:#888;margin-top:8px">${script.hook.type} — ${script.hook.why_it_works}</div>
</div>
<h2>Full Script</h2>
${script.script.sections.map(s => `<div class="section">
  <div class="section-name">${s.name} <span class="section-meta">(${s.duration}) — ${s.emotion}</span></div>
  <div class="dialogue">${s.dialogue}</div>
  ${s.visual_direction ? `<div class="visual">Visual: ${s.visual_direction}</div>` : ""}
  ${s.text_overlay ? `<div class="visual">Text overlay: ${s.text_overlay}</div>` : ""}
</div>`).join("")}
<h2>Call to Action</h2>
<div class="cta-box">
  <div class="cta-text">"${script.cta.text}"</div>
  <div style="font-size:11px;margin-top:6px;color:#999">${script.cta.type} — ${script.cta.placement}</div>
</div>
<h2>Posting Strategy</h2>
<p style="font-size:13px">Best time: ${script.posting_strategy.best_time} | Day: ${script.posting_strategy.best_day}<br>Tip: ${script.posting_strategy.boost_tip}</p>
<h2>Caption</h2>
<div class="caption">${script.caption}</div>
<div class="hashtags">${(script.hashtags || []).map(h => `<span class="hashtag">${h}</span>`).join("")}</div>
${script.ab_variations ? `<h2>A/B Hook Variations</h2>${script.ab_variations.map((v,i) => `<p style="font-size:13px;margin:6px 0"><strong>${i+1}.</strong> "${v.hook_alt}" — <em>${v.why}</em></p>`).join("")}` : ""}
<div class="footer">Generated by Trinity</div>
</body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `${script.title.replace(/[^a-zA-Z0-9]/g, "_")}_script.html`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("Script downloaded as HTML!");
  }

  const activeScript = batchScripts.length > 0 ? batchScripts[activeBatchIndex] : script;
  const topicPresets = TOPIC_PRESETS[config.industry_preset] || TOPIC_PRESETS.general;

  // ── Guided steps (Guided Mode) ───────────────────────────────────
  const guidedSteps: WizardStepDef[] = [
    {
      id: "topic",
      title: "What's the video about?",
      description: "One sentence is plenty. Specific topics get much better scripts than vague ones.",
      icon: <Sparkles size={18} />,
      canProceed: config.topic.trim().length > 0,
      component: (
        <div className="space-y-3">
          <input
            type="text"
            value={config.topic}
            onChange={e => setConfig(prev => ({ ...prev, topic: e.target.value }))}
            placeholder="e.g., How to land your first freelance client without cold outreach"
            className="w-full px-4 py-3 rounded-xl bg-surface-light border border-border text-sm focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20 transition-all"
            autoFocus
          />
          <div>
            <p className="text-[10px] text-muted uppercase tracking-wider mb-1.5 font-semibold">Quick starters</p>
            <div className="flex flex-wrap gap-1.5">
              {topicPresets.slice(0, 4).map((p: string, i: number) => (
                <button
                  key={i}
                  onClick={() => setConfig(prev => ({ ...prev, topic: p }))}
                  className="text-[10px] text-muted hover:text-foreground bg-surface-light hover:bg-gold/10 hover:border-gold/30 px-2.5 py-1 rounded-full border border-border/50 transition-all"
                >
                  {p.slice(0, 40)}…
                </button>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "type",
      title: "What kind of script?",
      description: "This sets the length and pacing — short-form hooks hard, long-form unfolds slower.",
      icon: <Film size={18} />,
      component: (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
          {SCRIPT_TYPES.slice(0, 6).map(st => {
            const selected = config.script_type === st.id;
            return (
              <button
                key={st.id}
                onClick={() => setConfig(prev => ({ ...prev, script_type: st.id }))}
                className={`text-left p-3 rounded-xl border transition-all ${
                  selected ? "border-gold bg-gold/10 shadow-lg shadow-gold/10" : "border-border hover:border-gold/30 bg-surface-light"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-gold">{st.icon}</span>
                  <p className="text-xs font-semibold">{st.name}</p>
                </div>
                <p className="text-[10px] text-muted">{st.desc}</p>
              </button>
            );
          })}
        </div>
      ),
    },
    {
      id: "framework",
      title: "Pick a framework",
      description: "Proven structures that keep viewers watching. Pick one — we'll apply it automatically.",
      icon: <Target size={18} />,
      component: (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {FRAMEWORKS.slice(0, 6).map(fw => {
            const selected = config.framework === fw.id;
            return (
              <button
                key={fw.id}
                onClick={() => setConfig(prev => ({ ...prev, framework: fw.id }))}
                className={`text-left p-3 rounded-xl border transition-all ${
                  selected ? "border-gold bg-gold/10" : "border-border hover:border-gold/30 bg-surface-light"
                }`}
              >
                <p className={`text-xs font-bold ${fw.color}`}>{fw.name}</p>
                <p className="text-[10px] text-muted mt-0.5">{fw.desc}</p>
              </button>
            );
          })}
        </div>
      ),
    },
    {
      id: "review",
      title: "Ready for the AI?",
      description: "Hit the button and we'll write the script. Each tab above unlocks advanced research, voice-over, and approval flows.",
      icon: <Wand2 size={18} />,
      component: (
        <div className="card bg-gold/[0.04] border-gold/20 space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[9px] uppercase tracking-wider text-muted">Topic</p>
              <p className="text-xs font-semibold">{config.topic || <span className="text-muted italic">(none)</span>}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider text-muted">Script type</p>
              <p className="text-xs font-semibold">{SCRIPT_TYPES.find(t => t.id === config.script_type)?.name}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider text-muted">Framework</p>
              <p className="text-xs font-semibold">{FRAMEWORKS.find(f => f.id === config.framework)?.name}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider text-muted">Platform</p>
              <p className="text-xs font-semibold capitalize">{config.platform}</p>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="fade-in space-y-5">
      <PageHero
        icon={<Sparkles size={28} />}
        title="Script Lab"
        subtitle="AI scripts with viral research & frameworks."
        gradient="ocean"
        actions={
          <>
            <AdvancedToggle value={advancedMode} onChange={setAdvancedMode} />
            <select value={selectedClient} onChange={e => {
              setSelectedClient(e.target.value);
              const client = clients.find(c => c.id === e.target.value);
              if (client?.industry) {
                const matchedPreset = Object.keys(TOPIC_PRESETS).find(k => client.industry.toLowerCase().includes(k));
                if (matchedPreset) setConfig(prev => ({ ...prev, industry_preset: matchedPreset }));
              }
            }} className="text-xs py-1.5 px-2 min-w-[160px] rounded-lg bg-white/10 border border-white/20 text-white">
              <option value="" className="bg-slate-800">No client</option>
              {clients.map(c => <option key={c.id} value={c.id} className="bg-slate-800">{c.business_name}</option>)}
            </select>
          </>
        }
      />

      {/* Guided Mode — "4-year-old friendly" flow */}
      {!advancedMode && (
        <>
          <Wizard
            steps={guidedSteps}
            activeIdx={guidedStep}
            onStepChange={setGuidedStep}
            finishLabel={generating ? "Writing…" : "Generate script"}
            busy={generating}
            onFinish={async () => {
              await generateScript();
            }}
            onCancel={() => setAdvancedMode(true)}
            cancelLabel="Advanced mode"
          />
          {activeScript && (
            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="section-header flex items-center gap-2">
                  <CheckCircle size={14} className="text-success" /> {activeScript.title}
                </h2>
                <button
                  onClick={() => {
                    const full = [
                      activeScript.hook.text,
                      ...activeScript.script.sections.map(s => `[${s.name}] ${s.dialogue}`),
                      activeScript.cta.text,
                    ].join("\n\n");
                    navigator.clipboard.writeText(full);
                    toast.success("Copied!");
                  }}
                  className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 transition-colors"
                >
                  <Copy size={11} /> Copy script
                </button>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gold font-semibold mb-1">Hook</p>
                  <p className="leading-relaxed">{activeScript.hook.text}</p>
                </div>
                {activeScript.script.sections.map((section, i) => (
                  <div key={i}>
                    <p className="text-[10px] uppercase tracking-wider text-gold font-semibold mb-1">
                      {section.name} <span className="text-muted">· {section.duration}</span>
                    </p>
                    <p className="whitespace-pre-wrap leading-relaxed">{section.dialogue}</p>
                  </div>
                ))}
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gold font-semibold mb-1">Call to action</p>
                  <p className="leading-relaxed">{activeScript.cta.text}</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Rolling preview of example scripts — phone-mockup style text cards */}
      {advancedMode && (
      <div className="relative rounded-2xl overflow-hidden border border-border bg-surface-light/30 py-6">
        <div className="absolute inset-0 pointer-events-none">
          <RollingPreview
            items={SCRIPT_LAB_PREVIEW_FALLBACK}
            variant="text"
            rows={2}
            aspectRatio="9:16"
            opacity={0.5}
            speed="medium"
          />
        </div>
        <div className="relative text-center px-4">
          <p className="text-[11px] uppercase tracking-widest text-gold/80 font-semibold">
            Script library
          </p>
          <h3 className="text-lg font-bold text-foreground mt-1">
            Hooks that stop the scroll. Frameworks that convert.
          </h3>
          <p className="text-xs text-muted max-w-md mx-auto mt-1">
            Reels, TikToks, ads, email sequences — built on proven frameworks
            and validated against live viral research.
          </p>
        </div>
      </div>
      )}

      {/* Tabs */}
      {advancedMode && (
      <div className="flex gap-1 overflow-x-auto border-b border-border pb-0">
        {([
          { id: "generate" as const, label: "Generator", icon: Sparkles },
          { id: "templates" as const, label: `Templates (${scriptTemplates.length})`, icon: BookOpen },
          { id: "trending" as const, label: "🔥 Trending", icon: Flame },
          { id: "research" as const, label: "Viral Research", icon: Search },
          { id: "results" as const, label: `Results ${batchScripts.length > 1 ? `(${batchScripts.length})` : script ? "(1)" : ""}`, icon: FileText },
          { id: "tools" as const, label: "Tools", icon: Wand2 },
          { id: "voiceover" as const, label: "Voice-Over", icon: Volume2 },
          { id: "approval" as const, label: "Approval", icon: CheckCircle },
          { id: "history" as const, label: `History (${savedScripts.length})`, icon: Clock },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors whitespace-nowrap ${
              tab === t.id
                ? "bg-surface-light text-gold border border-border border-b-transparent -mb-px"
                : "text-muted hover:text-foreground"
            }`}>
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </div>
      )}

      {advancedMode && (
      <>
      {/* Generate Tab */}
      {tab === "generate" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {/* Script Type selector */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2"><Type size={13} className="text-gold" /> Script Type</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {SCRIPT_TYPES.map(t => (
                  <button key={t.id} onClick={() => setConfig({ ...config, script_type: t.id })}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all ${
                      config.script_type === t.id ? "border-gold/30 bg-gold/[0.05]" : "border-border hover:border-gold/15"
                    }`}>
                    <span className={config.script_type === t.id ? "text-gold" : "text-muted"}>{t.icon}</span>
                    <div>
                      <p className="text-[10px] font-semibold">{t.name}</p>
                      <p className="text-[8px] text-muted">{t.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Framework selector */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2"><Target size={13} className="text-gold" /> Script Framework</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {FRAMEWORKS.map(f => (
                  <button key={f.id} onClick={() => setConfig({ ...config, framework: f.id })}
                    className={`p-2 rounded-xl border text-left transition-all ${
                      config.framework === f.id ? "border-gold/30 bg-gold/[0.05]" : "border-border hover:border-gold/15"
                    }`}>
                    <p className={`text-[10px] font-semibold ${f.color}`}>{f.name}</p>
                    <p className="text-[8px] text-muted leading-tight">{f.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Script config */}
            <div className="card space-y-3">
              <h2 className="section-header">Script Details</h2>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Platform</label>
                  <select value={config.platform} onChange={e => setConfig({ ...config, platform: e.target.value })}
                    className="input w-full text-xs">
                    {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Tone</label>
                  <select value={config.tone} onChange={e => setConfig({ ...config, tone: e.target.value })}
                    className="input w-full text-xs">
                    {TONES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Target Audience</label>
                  <input value={config.target_audience} onChange={e => setConfig({ ...config, target_audience: e.target.value })}
                    className="input w-full text-xs" placeholder="e.g., business owners 30-50" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[9px] text-muted uppercase tracking-wider">Topic *</label>
                  <select value={config.industry_preset} onChange={e => setConfig({ ...config, industry_preset: e.target.value })}
                    className="text-[9px] text-muted bg-transparent border-none p-0 cursor-pointer">
                    <option value="general">General Presets</option>
                    <option value="dental">Dental</option>
                    <option value="real_estate">Real Estate</option>
                    <option value="fitness">Fitness</option>
                    <option value="legal">Legal</option>
                  </select>
                </div>
                <input value={config.topic} onChange={e => setConfig({ ...config, topic: e.target.value })}
                  className="input w-full text-xs" placeholder="e.g., Why most dental practices fail at social media" />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {topicPresets.map((t, i) => (
                    <button key={i} onClick={() => setConfig({ ...config, topic: t })}
                      className="text-[8px] px-2 py-0.5 rounded bg-surface-light/60 border border-border text-muted hover:text-foreground hover:border-gold/20 transition-all">
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Pain Points to Address</label>
                <input value={config.pain_points} onChange={e => setConfig({ ...config, pain_points: e.target.value })}
                  className="input w-full text-xs" placeholder="e.g., no time, don't know what to post, not getting engagement" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[9px] text-muted uppercase tracking-wider">Viral Reference (remix existing content)</label>
                  <AIEnhanceButton value={config.viral_reference} onResult={next => setConfig({ ...config, viral_reference: next })} context="short-form video concept" variant="inline" />
                </div>
                <textarea value={config.viral_reference} onChange={e => setConfig({ ...config, viral_reference: e.target.value })}
                  className="input w-full h-14 text-xs" placeholder="Paste a viral video concept, hook, or transcript to remix with your own angle..." />
              </div>
            </div>

            {/* Storyboard format picker */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2"><Clapperboard size={13} className="text-gold" /> Storyboard Format (for visual breakdown)</h2>
              <p className="text-[9px] text-muted mb-2">Pick the visual style your storyboard will follow. You can generate a shot-by-shot breakdown after your script is created.</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                {STORYBOARD_FORMATS.map(f => (
                  <button key={f.id} onClick={() => setStoryboardFormat(f.id)}
                    className={`flex items-center gap-1.5 p-2 rounded-xl border text-left transition-all ${
                      storyboardFormat === f.id ? "border-gold/30 bg-gold/[0.05]" : "border-border hover:border-gold/15"
                    }`}>
                    <span className={storyboardFormat === f.id ? "text-gold" : "text-muted"}>{f.icon}</span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold truncate">{f.name}</p>
                      <p className="text-[8px] text-muted truncate">{f.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* AI Extras */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2"><Wand2 size={13} className="text-gold" /> AI Options</h2>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2 text-[10px] text-muted cursor-pointer">
                  <input type="checkbox" checked={config.include_voiceover_notes}
                    onChange={e => setConfig({ ...config, include_voiceover_notes: e.target.checked })}
                    className="rounded border-border text-gold focus:ring-gold/30" />
                  <Volume2 size={11} /> Voiceover Notes
                </label>
                <label className="flex items-center gap-2 text-[10px] text-muted cursor-pointer">
                  <input type="checkbox" checked={config.include_b_roll_suggestions}
                    onChange={e => setConfig({ ...config, include_b_roll_suggestions: e.target.checked })}
                    className="rounded border-border text-gold focus:ring-gold/30" />
                  <Film size={11} /> B-Roll Suggestions
                </label>
                <div className="flex items-center gap-2 ml-auto">
                  <label className="text-[9px] text-muted uppercase tracking-wider">Variations</label>
                  <div className="flex gap-1">
                    {[1, 3, 5].map(n => (
                      <button key={n} onClick={() => setConfig({ ...config, batch_count: n })}
                        className={`text-[10px] px-2 py-0.5 rounded border transition-all ${
                          config.batch_count === n ? "border-gold/30 bg-gold/[0.05] text-gold font-semibold" : "border-border text-muted hover:text-foreground"
                        }`}>
                        {n}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <button onClick={generateScript} disabled={generating || !config.topic}
              className="btn-primary w-full text-xs py-2.5 flex items-center justify-center gap-2 disabled:opacity-50">
              {generating ? <Loader size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {generating ? "Generating..." : config.batch_count > 1 ? `Generate ${config.batch_count} Variations` : "Generate Script"}
            </button>
          </div>

          {/* Right sidebar */}
          <div className="space-y-3">
            <div className="card border-gold/10">
              <h3 className="section-header flex items-center gap-2"><Zap size={12} className="text-gold" /> Pro Tips</h3>
              <div className="space-y-2 text-[10px] text-muted">
                <p><span className="text-gold font-medium">Hook:</span> First 3 seconds decide if someone watches or scrolls</p>
                <p><span className="text-gold font-medium">PAS:</span> Best for service businesses selling to pain points</p>
                <p><span className="text-gold font-medium">Contrarian:</span> Best for standing out and getting comments</p>
                <p><span className="text-gold font-medium">Batch:</span> Generate 3-5 variations and A/B test hooks</p>
                <p><span className="text-gold font-medium">Reference:</span> Find a viral video, paste the concept, AI creates your version</p>
              </div>
            </div>

            {research?.opportunities && (
              <div className="card border-accent/10">
                <h3 className="section-header flex items-center gap-2"><Search size={12} className="text-gold" /> From Research</h3>
                <div className="space-y-1.5">
                  {research.opportunities.slice(0, 4).map((opp, i) => (
                    <button key={i} onClick={() => setConfig({ ...config, topic: opp })}
                      className="w-full text-left text-[10px] p-2 rounded-lg border border-border hover:border-gold/15 transition-all">
                      {opp}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="card border-gold/10">
              <h3 className="section-header flex items-center gap-2"><TrendingUp size={12} className="text-gold" /> Quick Stats</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-center p-2 rounded-lg bg-surface-light">
                  <p className="text-lg font-bold text-gold">{savedScripts.length}</p>
                  <p className="text-[8px] text-muted">Scripts Created</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-surface-light">
                  <p className="text-lg font-bold text-gold">{FRAMEWORKS.length}</p>
                  <p className="text-[8px] text-muted">Frameworks</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🔥 Trending Tab — live viral research across platforms */}
      {tab === "trending" && (
        <div className="space-y-4">
          {/* My Watchlists — scheduled daily scans */}
          <div className="card border-gold/10 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye size={14} className="text-gold" />
                <h3 className="text-xs font-semibold">My Watchlists</h3>
                <span className="text-[9px] text-muted">Auto-refreshed daily at 6 AM</span>
              </div>
              {loadingWatchlists && <Loader size={11} className="animate-spin text-muted" />}
            </div>

            {!loadingWatchlists && watchlists.length === 0 && (
              <p className="text-[10px] text-muted py-1">
                Save a niche + keyword search as a watchlist to get fresh trends every morning — one click, no Claude call needed.
              </p>
            )}

            {watchlists.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {watchlists.map(w => {
                  const isScanning = scanningWatchlistId === w.id;
                  return (
                    <div
                      key={w.id}
                      className="rounded-lg border border-border p-2.5 hover:border-gold/30 transition-all bg-surface-light/30 group"
                    >
                      <div
                        className="cursor-pointer"
                        onClick={() => loadWatchlistTrending(w)}
                      >
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <h4 className="text-[11px] font-semibold line-clamp-1 group-hover:text-gold transition-colors">{w.name}</h4>
                          {w.alert_on_new && (
                            <span title="Alerts on" className="text-[9px] text-gold"><Activity size={9} /></span>
                          )}
                        </div>
                        <p className="text-[9px] text-muted mb-1">
                          <span className="text-gold/80">#{w.niche}</span>
                          {w.platforms.length > 0 && <span> · {w.platforms.join(", ")}</span>}
                        </p>
                        <p className="text-[8px] text-muted">
                          {w.last_scanned_at
                            ? <>Last scanned {new Date(w.last_scanned_at).toLocaleString()}</>
                            : <>Never scanned</>}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/50">
                        <button
                          onClick={() => scanWatchlistNow(w)}
                          disabled={isScanning}
                          className="flex-1 text-[9px] py-1 rounded border border-border hover:border-gold/30 transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                          title="Scan now"
                        >
                          {isScanning ? <Loader size={9} className="animate-spin" /> : <RefreshCw size={9} />}
                          Scan
                        </button>
                        <button
                          onClick={() => toggleWatchlistAlerts(w)}
                          className={`text-[9px] py-1 px-1.5 rounded border transition-all ${
                            w.alert_on_new
                              ? "border-gold/40 bg-gold/10 text-gold"
                              : "border-border text-muted hover:text-foreground"
                          }`}
                          title={w.alert_on_new ? "Alerts on" : "Alerts off"}
                        >
                          <Activity size={9} />
                        </button>
                        <button
                          onClick={() => setEditingWatchlist({ ...w })}
                          className="text-[9px] py-1 px-1.5 rounded border border-border text-muted hover:text-foreground transition-all"
                          title="Edit"
                        >
                          <PenTool size={9} />
                        </button>
                        <button
                          onClick={() => deleteWatchlist(w)}
                          className="text-[9px] py-1 px-1.5 rounded border border-border text-muted hover:text-danger transition-all"
                          title="Delete"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="card bg-gradient-to-br from-gold/[0.05] via-surface to-surface border-gold/15 space-y-3">
            <div className="flex items-center gap-2">
              <Flame size={16} className="text-gold animate-pulse" />
              <h2 className="text-sm font-semibold">Find today&apos;s trending videos</h2>
              <Sparkles size={12} className="text-gold" />
            </div>
            <p className="text-[10px] text-muted">Discover what&apos;s going viral right now in your niche across YouTube, TikTok, and Instagram. Transcribe the top performers and remix them with your own twist.</p>

            {/* Niche chip-select */}
            <div>
              <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Niche *</label>
              <div className="flex flex-wrap gap-1 mb-1.5">
                {TRENDING_NICHES.map(n => (
                  <button key={n} onClick={() => setTrendingNiche(n)}
                    className={`text-[9px] px-2 py-0.5 rounded-full border transition-all ${
                      trendingNiche === n
                        ? "border-gold/40 bg-gold/[0.08] text-gold"
                        : "border-border text-muted hover:text-foreground hover:border-gold/20"
                    }`}>
                    {n}
                  </button>
                ))}
              </div>
              <input value={trendingNiche} onChange={e => setTrendingNiche(e.target.value)}
                className="input w-full text-xs" placeholder="Or type your own niche…" />
            </div>

            {/* Keywords */}
            <div>
              <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Keywords the client searches for (comma-separated)</label>
              <input value={trendingKeywords} onChange={e => setTrendingKeywords(e.target.value)}
                className="input w-full text-xs" placeholder="e.g. teeth whitening, Invisalign, smile makeover" />
            </div>

            {/* Platform filter */}
            <div>
              <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Platforms</label>
              <div className="flex flex-wrap gap-1.5">
                {TRENDING_PLATFORM_OPTS.map(p => {
                  const active = trendingPlatforms.includes(p.id);
                  return (
                    <button key={p.id} onClick={() => {
                      setTrendingPlatforms(prev => active ? prev.filter(x => x !== p.id) : [...prev, p.id]);
                    }}
                      className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
                        active
                          ? `${platformColor(p.id)} border-opacity-50`
                          : "border-border text-muted hover:text-foreground"
                      }`}>
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Refresh button */}
            <div className="flex items-center gap-2 pt-1">
              <button onClick={() => findTrending(false)} disabled={loadingTrending || !trendingNiche}
                className="btn-primary text-xs py-2 flex items-center gap-2 disabled:opacity-50">
                {loadingTrending ? <Loader size={12} className="animate-spin" /> : <Flame size={12} />}
                {loadingTrending ? "Searching…" : "Find today's trending"}
              </button>
              {trendingVideos.length > 0 && (
                <button onClick={() => findTrending(true)} disabled={loadingTrending}
                  className="btn-secondary text-xs py-2 flex items-center gap-1.5 disabled:opacity-50">
                  <RefreshCw size={11} /> Force refresh
                </button>
              )}
              <button
                onClick={() => { setNewWatchlistName(trendingNiche); setSaveWatchlistModal(true); }}
                disabled={!trendingNiche || trendingPlatforms.length === 0}
                className="btn-secondary text-xs py-2 flex items-center gap-1.5 disabled:opacity-50"
                title="Save this search as a watchlist"
              >
                <Eye size={11} /> Save as watchlist
              </button>
              {trendingCached?.cached && (
                <span className="text-[9px] text-muted ml-auto flex items-center gap-1">
                  <Clock size={9} /> Cached {trendingCached.cached_at ? new Date(trendingCached.cached_at).toLocaleTimeString() : ""}
                </span>
              )}
            </div>
          </div>

          {/* Empty state */}
          {!loadingTrending && trendingVideos.length === 0 && (
            <div className="card text-center py-10">
              <Flame size={32} className="text-gold/40 mx-auto mb-3" />
              <p className="text-xs text-muted">Pick a niche + platform to see what&apos;s working today</p>
              <p className="text-[9px] text-muted mt-1">We&apos;ll surface up to 30 trending videos, then you can transcribe and remix any of them.</p>
            </div>
          )}

          {/* Loading state */}
          {loadingTrending && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card animate-pulse">
                  <div className="h-24 bg-surface-light rounded-lg mb-2" />
                  <div className="h-3 bg-surface-light rounded w-3/4 mb-1.5" />
                  <div className="h-2 bg-surface-light rounded w-1/2" />
                </div>
              ))}
            </div>
          )}

          {/* Results grid */}
          {!loadingTrending && trendingVideos.length > 0 && (
            <div className="fade-in">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold flex items-center gap-1.5">
                  <TrendingUp size={13} className="text-gold" />
                  {trendingVideos.length} trending in {trendingNiche}
                </h3>
                <p className="text-[9px] text-muted">Click any card to transcribe + remix</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {trendingVideos.map(v => {
                  const hasTranscript = Boolean(transcriptsById[v.id]);
                  const isTranscribing = transcribingId === v.id;
                  const isRemixing = remixingId === v.id;
                  return (
                    <div key={v.id} className="card hover:border-gold/20 transition-all group overflow-hidden">
                      {/* Thumbnail placeholder — gold gradient with emoji + hint */}
                      <div className="relative h-28 rounded-lg bg-gradient-to-br from-gold/15 via-gold/5 to-surface-light border border-gold/10 mb-2 flex items-center justify-center overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(218,165,32,0.15),transparent_60%)]" />
                        <div className="relative text-4xl">{v.thumbnail_emoji || "🔥"}</div>
                        <div className={`absolute top-1.5 left-1.5 text-[8px] px-1.5 py-0.5 rounded border ${platformColor(v.platform)}`}>
                          {v.platform}
                        </div>
                        <div className="absolute bottom-1.5 right-1.5 text-[8px] px-1.5 py-0.5 rounded bg-black/60 text-white">
                          {Math.floor(v.duration_sec / 60)}:{String(v.duration_sec % 60).padStart(2, "0")}
                        </div>
                        {hasTranscript && (
                          <div className="absolute top-1.5 right-1.5 text-[8px] px-1.5 py-0.5 rounded bg-success/20 text-success border border-success/30 flex items-center gap-0.5">
                            <CheckCircle size={8} /> Transcribed
                          </div>
                        )}
                      </div>

                      {/* Title + creator */}
                      <h4 className="text-[11px] font-semibold line-clamp-2 mb-0.5 group-hover:text-gold transition-colors">{v.title}</h4>
                      <p className="text-[9px] text-muted mb-1.5 flex items-center gap-1">
                        <UsersIcon size={8} /> {v.creator_name} <span className="text-gold/70">{v.creator_handle}</span>
                      </p>

                      {/* Metrics row */}
                      <div className="flex items-center gap-2 text-[9px] mb-2">
                        <span className="flex items-center gap-0.5 text-success"><Eye size={9} /> {v.view_count_label}</span>
                        <span className="flex items-center gap-0.5 text-gold"><Activity size={9} /> {v.engagement_rate.toFixed(1)}%</span>
                        <span className="flex items-center gap-0.5 text-muted"><Clock size={9} /> {daysAgoLabel(v.published_days_ago)}</span>
                      </div>

                      {/* Hook */}
                      <div className="bg-gold/[0.03] border border-gold/10 rounded-lg p-2 mb-1.5">
                        <p className="text-[8px] text-gold uppercase tracking-wider font-medium mb-0.5">Hook</p>
                        <p className="text-[10px] italic line-clamp-2">&ldquo;{v.hook}&rdquo;</p>
                      </div>

                      {/* Why trending */}
                      <p className="text-[9px] text-muted mb-2 line-clamp-2">{v.why_trending}</p>

                      {/* Keywords */}
                      {v.keywords_used && v.keywords_used.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {v.keywords_used.slice(0, 4).map((k, i) => (
                            <span key={i} className="text-[8px] px-1.5 py-0.5 rounded bg-surface-light border border-border text-muted">#{k}</span>
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-1 pt-1 border-t border-border/50">
                        <button onClick={() => transcribeVideo(v)} disabled={isTranscribing}
                          className="flex-1 text-[9px] py-1.5 rounded-lg border border-border hover:border-gold/30 transition-all disabled:opacity-50 flex items-center justify-center gap-1">
                          {isTranscribing ? <Loader size={9} className="animate-spin" /> : <Mic size={9} />}
                          {hasTranscript ? "Re-transcribe" : "Transcribe"}
                        </button>
                        <button onClick={() => openRemix(v)} disabled={isRemixing || isTranscribing}
                          className="flex-1 text-[9px] py-1.5 rounded-lg bg-gradient-to-r from-gold/20 to-gold/10 border border-gold/30 text-gold hover:from-gold/30 hover:to-gold/20 transition-all disabled:opacity-50 flex items-center justify-center gap-1">
                          {isRemixing ? <Loader size={9} className="animate-spin" /> : <Sparkles size={9} />}
                          Remix
                        </button>
                        {v.url_hint && (
                          <a href={v.url_hint} target="_blank" rel="noopener noreferrer"
                            className="text-[9px] py-1.5 px-2 rounded-lg border border-border hover:border-gold/30 transition-all flex items-center justify-center gap-1">
                            <ExternalLink size={9} />
                          </a>
                        )}
                      </div>

                      {/* Inline transcript preview */}
                      {hasTranscript && (
                        <div className="mt-2 pt-2 border-t border-border/50">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[8px] text-muted uppercase tracking-wider">
                              Transcript {transcriptsById[v.id].is_estimated ? "(AI-estimated)" : "(real)"}
                            </span>
                            <button onClick={() => copyToClipboard(transcriptsById[v.id].transcript)}
                              className="text-[8px] text-muted hover:text-gold flex items-center gap-0.5">
                              <Copy size={8} /> Copy
                            </button>
                          </div>
                          <p className="text-[9px] text-muted line-clamp-3">{transcriptsById[v.id].transcript}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Remix modal — shown when user clicks ✨ Remix on any trending card */}
      {remixModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={() => setRemixModal(null)}>
          <div className="bg-surface border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-surface/95 backdrop-blur-md border-b border-border p-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <Repeat size={16} className="text-gold" />
                <h3 className="text-sm font-semibold">Remix with my twist</h3>
              </div>
              <button onClick={() => setRemixModal(null)} className="text-muted hover:text-foreground text-xs">Close</button>
            </div>
            <div className="p-4 space-y-4">
              {/* Original reference */}
              <div className="card bg-surface-light/50">
                <p className="text-[9px] text-muted uppercase tracking-wider mb-1">Original</p>
                <p className="text-[11px] font-semibold mb-1">{remixModal.video.title}</p>
                <p className="text-[9px] text-muted">{remixModal.video.creator_handle} · {remixModal.video.view_count_label} views · {remixModal.video.platform}</p>
              </div>

              {/* Transcript preview */}
              <div>
                <p className="text-[9px] text-muted uppercase tracking-wider mb-1">Transcript (used as the structural reference)</p>
                <div className="text-[10px] p-2.5 rounded-lg bg-surface-light border border-border max-h-32 overflow-y-auto whitespace-pre-wrap">{remixModal.transcript}</div>
              </div>

              {/* Twist angle input */}
              <div>
                <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Your twist / angle (optional)</label>
                <input value={remixTwistAngle} onChange={e => setRemixTwistAngle(e.target.value)}
                  className="input w-full text-xs" placeholder="e.g. contrarian take, personal story, industry-specific data" />
              </div>

              {/* Run button */}
              {!remixResult && (
                <button onClick={runRemix} disabled={remixingId !== null}
                  className="btn-primary text-xs py-2 w-full flex items-center justify-center gap-2 disabled:opacity-50">
                  {remixingId ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  {remixingId ? "Remixing…" : "Generate remixed script"}
                </button>
              )}

              {/* Result */}
              {remixResult && (
                <div className="space-y-3 fade-in">
                  <div className="card bg-gold/[0.03] border-gold/20">
                    <p className="text-[9px] text-gold uppercase tracking-wider mb-1">Suggested title</p>
                    <p className="text-sm font-semibold">{remixResult.suggested_title}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="card">
                      <p className="text-[9px] text-muted uppercase tracking-wider mb-1">New hook</p>
                      <p className="text-[11px] italic">&ldquo;{remixResult.hook}&rdquo;</p>
                    </div>
                    <div className="card">
                      <p className="text-[9px] text-muted uppercase tracking-wider mb-1">New CTA</p>
                      <p className="text-[11px]">{remixResult.cta}</p>
                    </div>
                  </div>

                  <div className="card">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[9px] text-muted uppercase tracking-wider">Remixed script</p>
                      <button onClick={() => copyToClipboard(remixResult.remixed_script)}
                        className="text-[9px] text-gold hover:text-gold-light flex items-center gap-0.5">
                        <Copy size={9} /> Copy
                      </button>
                    </div>
                    <div className="text-[10px] whitespace-pre-wrap leading-relaxed">{remixResult.remixed_script}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="card">
                      <p className="text-[9px] text-muted uppercase tracking-wider mb-1">Structure kept</p>
                      <p className="text-[10px]">{remixResult.structure_kept}</p>
                    </div>
                    <div className="card">
                      <p className="text-[9px] text-muted uppercase tracking-wider mb-1">Twist applied</p>
                      <p className="text-[10px]">{remixResult.twist_applied}</p>
                    </div>
                  </div>

                  {remixResult.differences?.length > 0 && (
                    <div className="card">
                      <p className="text-[9px] text-muted uppercase tracking-wider mb-1.5">Differences from original</p>
                      <ul className="space-y-1">
                        {remixResult.differences.map((d, i) => (
                          <li key={i} className="text-[10px] flex items-start gap-1.5">
                            <ArrowRight size={9} className="text-gold shrink-0 mt-0.5" />
                            <span>{d}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button onClick={useRemixAsTopic}
                      className="btn-primary text-xs py-2 flex-1 flex items-center justify-center gap-2">
                      <Wand2 size={12} /> Use in Generator
                    </button>
                    <button onClick={() => { setRemixResult(null); setRemixTwistAngle(""); }}
                      className="btn-secondary text-xs py-2 flex items-center gap-2">
                      <RefreshCw size={12} /> Redo
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Research Tab */}
      {tab === "research" && (
        <div className="space-y-4">
          <div className="card max-w-xl space-y-3">
            <h2 className="section-header flex items-center gap-2"><Search size={13} className="text-gold" /> Viral Content Research</h2>
            <p className="text-[10px] text-muted">Find what content is going viral in your niche and why</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Industry *</label>
                <input value={researchConfig.industry} onChange={e => setResearchConfig({ ...researchConfig, industry: e.target.value })}
                  className="input w-full text-xs" placeholder="e.g., dental, legal, fitness" />
              </div>
              <div>
                <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Competitor (optional)</label>
                <input value={researchConfig.competitor_name} onChange={e => setResearchConfig({ ...researchConfig, competitor_name: e.target.value })}
                  className="input w-full text-xs" placeholder="@competitor or business name" />
              </div>
            </div>
            <button onClick={doResearch} disabled={researching || !researchConfig.industry}
              className="btn-primary text-xs py-2 flex items-center gap-2 disabled:opacity-50">
              {researching ? <Loader size={12} className="animate-spin" /> : <Search size={12} />}
              {researching ? "Researching..." : "Research Viral Content"}
            </button>
          </div>

          {research && (
            <div className="space-y-4 fade-in">
              <div className="card">
                <h2 className="section-header flex items-center gap-2"><Film size={13} className="text-pink-400" /> Viral Video Analysis</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {research.viral_videos?.map((v, i) => (
                    <div key={i} className="p-3 rounded-xl border border-border bg-surface-light hover:border-gold/10 transition-all">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[11px] font-semibold">{v.title}</p>
                        <span className="text-[8px] text-success bg-success/10 px-1.5 py-0.5 rounded">{v.estimated_views}</span>
                      </div>
                      <div className="bg-gold/[0.03] border border-gold/10 rounded-lg p-2 mb-2">
                        <p className="text-[9px] text-gold uppercase tracking-wider font-medium mb-0.5">Hook</p>
                        <p className="text-[10px] italic">&ldquo;{v.hook}&rdquo;</p>
                      </div>
                      <p className="text-[9px] text-muted mb-1">{v.why_it_works}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] text-muted">{v.format}</span>
                        <button onClick={() => { setConfig({ ...config, viral_reference: `${v.title}: ${v.hook}`, topic: v.title }); setTab("generate"); }}
                          className="text-[9px] text-gold hover:text-gold-light flex items-center gap-0.5">
                          <Sparkles size={9} /> Use as reference
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card">
                  <h2 className="section-header">Patterns That Work</h2>
                  <div className="space-y-2">
                    <div>
                      <p className="text-[9px] text-muted uppercase tracking-wider mb-1">Top Hooks</p>
                      {research.patterns?.top_hooks?.map((h, i) => (
                        <p key={i} className="text-[10px] py-0.5">{h}</p>
                      ))}
                    </div>
                    <div>
                      <p className="text-[9px] text-muted uppercase tracking-wider mb-1">Best Formats</p>
                      <div className="flex flex-wrap gap-1">
                        {research.patterns?.best_formats?.map((f, i) => (
                          <span key={i} className="text-[9px] bg-surface-light px-2 py-0.5 rounded">{f}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted uppercase tracking-wider mb-1">Content Pillars</p>
                      {research.patterns?.content_pillars?.map((p, i) => (
                        <p key={i} className="text-[10px] py-0.5 flex items-center gap-1"><CheckCircle size={9} className="text-success" /> {p}</p>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="card">
                  <h2 className="section-header">Competitor Analysis</h2>
                  <div className="space-y-2">
                    <div>
                      <p className="text-[9px] text-success uppercase tracking-wider mb-1">Strengths</p>
                      {research.competitor_analysis?.strengths?.map((s, i) => (
                        <p key={i} className="text-[10px] py-0.5">{s}</p>
                      ))}
                    </div>
                    <div>
                      <p className="text-[9px] text-danger uppercase tracking-wider mb-1">Weaknesses (our opportunity)</p>
                      {research.competitor_analysis?.weaknesses?.map((w, i) => (
                        <p key={i} className="text-[10px] py-0.5">{w}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="card border-gold/10">
                <h2 className="section-header flex items-center gap-2"><Zap size={13} className="text-gold" /> Content Opportunities</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {research.opportunities?.map((opp, i) => (
                    <button key={i} onClick={() => { setConfig({ ...config, topic: opp }); setTab("generate"); }}
                      className="text-left p-2.5 rounded-xl border border-border hover:border-gold/15 transition-all flex items-center gap-2">
                      <ArrowRight size={10} className="text-gold shrink-0" />
                      <span className="text-[10px]">{opp}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results Tab */}
      {tab === "results" && activeScript && (
        <div className="space-y-4 fade-in">
          {/* Batch selector + Download bar */}
          <div className="flex items-center justify-between bg-surface-light rounded-xl px-4 py-2 border border-border flex-wrap gap-2">
            <div className="flex items-center gap-3">
              {batchScripts.length > 1 && (
                <div className="flex items-center gap-1">
                  {batchScripts.map((_, i) => (
                    <button key={i} onClick={() => { setActiveBatchIndex(i); setScript(batchScripts[i]); }}
                      className={`text-[10px] w-6 h-6 rounded-lg border transition-all ${
                        activeBatchIndex === i ? "border-gold/30 bg-gold/[0.08] text-gold font-bold" : "border-border text-muted hover:text-foreground"
                      }`}>
                      {i + 1}
                    </button>
                  ))}
                  <span className="text-[9px] text-muted ml-1">variations</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-[9px] text-muted">
                <span className="flex items-center gap-1"><PenTool size={9} /> {getWordCount()} words</span>
                <span className="flex items-center gap-1"><Clock size={9} /> {getEstimatedDuration()}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={downloadAsText} className="btn-secondary text-[9px] py-1 px-2.5 flex items-center gap-1">
                <FileText size={10} /> .TXT
              </button>
              <button onClick={downloadAsHTML} className="btn-secondary text-[9px] py-1 px-2.5 flex items-center gap-1">
                <Download size={10} /> .HTML
              </button>
              <button onClick={() => copyToClipboard(activeScript.script.sections.map(s => `[${s.name}] ${s.dialogue}`).join("\n\n"))}
                className="btn-ghost text-[9px] py-1 px-2.5 flex items-center gap-1">
                <Copy size={10} /> Copy All
              </button>
            </div>
          </div>

          {/* AI Rewrite bar */}
          <div className="card border-gold/10 py-2.5 px-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[9px] text-gold uppercase tracking-wider font-bold flex items-center gap-1"><Wand2 size={10} /> AI Rewrite</span>
              {[
                { label: "Make it shorter", icon: <ListChecks size={9} /> },
                { label: "Make it bolder", icon: <Zap size={9} /> },
                { label: "More casual tone", icon: <MessageSquare size={9} /> },
                { label: "Stronger CTA", icon: <Target size={9} /> },
                { label: "Add humor", icon: <Sparkles size={9} /> },
              ].map(btn => (
                <button key={btn.label} onClick={() => rewriteScript(btn.label)} disabled={rewriting}
                  className="text-[9px] px-2.5 py-1 rounded-lg border border-border text-muted hover:text-foreground hover:border-gold/20 transition-all flex items-center gap-1 disabled:opacity-50">
                  {btn.icon} {btn.label}
                </button>
              ))}
              {rewriting && <Loader size={12} className="animate-spin text-gold ml-2" />}
            </div>
          </div>

          {/* Generate Storyboard bar */}
          <div className="card border-gold/10 py-3 px-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Clapperboard size={14} className="text-gold" />
                <div>
                  <p className="text-[11px] font-bold text-foreground">Turn this script into a shot-by-shot storyboard</p>
                  <p className="text-[9px] text-muted">AI director breaks your script down into camera shots, dialog, transitions, b-roll, and music cues.</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                <div className="flex items-center gap-1">
                  {STORYBOARD_FORMATS.map(f => (
                    <button key={f.id} onClick={() => setStoryboardFormat(f.id)}
                      title={f.name}
                      className={`p-1.5 rounded-lg border transition-all ${
                        storyboardFormat === f.id ? "border-gold/40 bg-gold/[0.08] text-gold" : "border-border text-muted hover:text-foreground hover:border-gold/20"
                      }`}>
                      {f.icon}
                    </button>
                  ))}
                </div>
                <button onClick={generateStoryboard} disabled={generatingStoryboard}
                  className="relative group flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-gradient-to-r from-gold to-amber-500 text-black shadow-lg shadow-gold/30 hover:shadow-gold/50 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100">
                  {generatingStoryboard ? <Loader size={13} className="animate-spin" /> : <Clapperboard size={13} className="animate-pulse" />}
                  {generatingStoryboard ? "Generating..." : "Generate Storyboard"}
                  <Sparkles size={11} className="opacity-70" />
                </button>
              </div>
            </div>
          </div>

          {/* Title + Hook */}
          <div className="card border-gold/10 relative overflow-hidden">
            <div className="absolute inset-0 bg-mesh opacity-30" />
            <div className="relative">
              <h2 className="text-sm font-bold mb-1">{activeScript.title}</h2>
              <p className="text-[10px] text-muted mb-3">{activeScript.value_delivered}</p>
              <div className="bg-gold/[0.05] border border-gold/15 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[9px] text-gold uppercase tracking-wider font-medium">The Hook</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] bg-surface-light px-1.5 py-0.5 rounded">{activeScript.hook.type}</span>
                    <button onClick={() => copyToClipboard(activeScript.hook.text)}><Copy size={10} className="text-muted hover:text-foreground" /></button>
                  </div>
                </div>
                <p className="text-xs font-medium italic">&ldquo;{activeScript.hook.text}&rdquo;</p>
                <p className="text-[9px] text-muted mt-1">{activeScript.hook.why_it_works}</p>
              </div>
            </div>
          </div>

          {/* Full script sections */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="section-header mb-0">Full Script</h2>
              <button onClick={() => copyToClipboard(activeScript.script.sections.map(s => `[${s.name}] ${s.dialogue}`).join("\n\n"))}
                className="btn-ghost text-[10px] flex items-center gap-1"><Copy size={10} /> Copy All</button>
            </div>
            <div className="space-y-1">
              {activeScript.script.sections.map((section, i) => (
                <div key={i} className="rounded-xl border border-border overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-surface-light">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-gold">{section.name}</span>
                      <span className="text-[8px] text-muted font-mono">{section.duration}</span>
                    </div>
                    <span className="text-[8px] text-muted italic">{section.emotion}</span>
                  </div>
                  <div className="p-3 space-y-1.5">
                    <p className="text-[11px] leading-relaxed">{section.dialogue}</p>
                    {section.visual_direction && (
                      <p className="text-[9px] text-info flex items-center gap-1"><Eye size={9} /> {section.visual_direction}</p>
                    )}
                    {section.text_overlay && (
                      <p className="text-[9px] text-warning flex items-center gap-1"><MessageSquare size={9} /> Text: {section.text_overlay}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="card">
              <h3 className="section-header flex items-center gap-2"><Target size={12} className="text-gold" /> CTA</h3>
              <p className="text-xs font-medium mb-1">&ldquo;{activeScript.cta.text}&rdquo;</p>
              <div className="flex items-center gap-2 text-[9px] text-muted">
                <span className="bg-surface-light px-1.5 py-0.5 rounded">{activeScript.cta.type}</span>
                <span>{activeScript.cta.placement}</span>
              </div>
            </div>
            <div className="card">
              <h3 className="section-header flex items-center gap-2"><Clock size={12} className="text-gold" /> Posting Strategy</h3>
              <div className="space-y-1 text-[10px]">
                <p><span className="text-muted">Best time:</span> {activeScript.posting_strategy.best_time}</p>
                <p><span className="text-muted">Best day:</span> {activeScript.posting_strategy.best_day}</p>
                <p><span className="text-muted">Tip:</span> {activeScript.posting_strategy.boost_tip}</p>
              </div>
            </div>
            <div className="card">
              <h3 className="section-header flex items-center gap-2"><Camera size={12} className="text-pink-400" /> Thumbnail</h3>
              <div className="space-y-1 text-[10px]">
                <p><span className="text-muted">Text:</span> {activeScript.thumbnail.text}</p>
                <p><span className="text-muted">Expression:</span> {activeScript.thumbnail.emotion}</p>
                <p><span className="text-muted">Colors:</span> {activeScript.thumbnail.colors}</p>
              </div>
            </div>
          </div>

          {activeScript.ab_variations && (
            <div className="card">
              <h3 className="section-header flex items-center gap-2"><RefreshCw size={12} className="text-warning" /> A/B Hook Variations</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {activeScript.ab_variations.map((v, i) => (
                  <div key={i} className="p-2.5 rounded-xl border border-border bg-surface-light">
                    <p className="text-[11px] font-medium italic mb-1">&ldquo;{v.hook_alt}&rdquo;</p>
                    <p className="text-[9px] text-muted">{v.why}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="card">
              <h3 className="section-header">Pain Points Addressed</h3>
              <div className="space-y-1">
                {activeScript.pain_points_addressed?.map((p, i) => (
                  <p key={i} className="text-[10px] flex items-center gap-1.5"><Target size={9} className="text-danger" /> {p}</p>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <h3 className="section-header mb-0">Caption</h3>
                <button onClick={() => copyToClipboard(activeScript.caption)} className="btn-ghost text-[9px]"><Copy size={10} /></button>
              </div>
              <p className="text-[10px] whitespace-pre-wrap leading-relaxed">{activeScript.caption}</p>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="section-header mb-0">Hashtags</h3>
              <button onClick={() => copyToClipboard(activeScript.hashtags?.join(" ") || "")} className="btn-ghost text-[9px]"><Copy size={10} /> Copy</button>
            </div>
            <div className="flex flex-wrap gap-1">
              {activeScript.hashtags?.map((h, i) => (
                <span key={i} className="text-[9px] bg-surface-light px-1.5 py-0.5 rounded text-gold">{h}</span>
              ))}
            </div>
          </div>

          {/* ── Storyboard render ───────────────────────────────────── */}
          {storyboard && (
            <div className="space-y-3 fade-in">
              <div className="card border-gold/20 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-gold/[0.06] to-transparent pointer-events-none" />
                <div className="relative flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold to-amber-500 flex items-center justify-center text-black shadow-lg shadow-gold/30">
                      <Clapperboard size={18} />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold">Storyboard</h2>
                      <p className="text-[10px] text-muted">
                        {STORYBOARD_FORMATS.find(f => f.id === storyboard.format)?.name || storyboard.format} ·{" "}
                        {storyboard.total_shots} shots · ~{storyboard.total_duration_sec}s
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={copyStoryboardAsMarkdown} className="btn-secondary text-[9px] py-1 px-2.5 flex items-center gap-1">
                      <FileText size={10} /> Copy as Markdown
                    </button>
                    <button onClick={copyStoryboardAsCSV} className="btn-secondary text-[9px] py-1 px-2.5 flex items-center gap-1">
                      <Download size={10} /> Copy as CSV
                    </button>
                    <button onClick={() => toast("PDF export coming soon", { icon: "📄" })}
                      className="btn-ghost text-[9px] py-1 px-2.5 flex items-center gap-1">
                      <Download size={10} /> Export PDF
                    </button>
                  </div>
                </div>
                {storyboard.style_notes && (
                  <div className="relative mt-3 p-2.5 rounded-lg bg-surface-light/60 border border-gold/10">
                    <p className="text-[9px] text-gold uppercase tracking-wider font-medium mb-0.5">Style Notes</p>
                    <p className="text-[11px] leading-relaxed">{storyboard.style_notes}</p>
                  </div>
                )}
              </div>

              {/* Timeline */}
              <div className="space-y-2">
                {storyboard.shots.map((shot, idx) => {
                  const theme = getShotTheme(idx, storyboard.shots.length);
                  const themeStyles =
                    theme === "opening"
                      ? { border: "border-gold/30", accent: "text-gold", bg: "bg-gold/[0.06]", bar: "bg-gold" }
                      : theme === "ending"
                        ? { border: "border-emerald-400/30", accent: "text-emerald-400", bg: "bg-emerald-400/[0.05]", bar: "bg-emerald-400" }
                        : { border: "border-blue-400/25", accent: "text-blue-400", bg: "bg-blue-400/[0.04]", bar: "bg-blue-400" };
                  return (
                    <div key={idx} className={`card ${themeStyles.border} overflow-hidden relative`}>
                      <div className={`absolute inset-y-0 left-0 w-1 ${themeStyles.bar}`} />
                      <div className="pl-2">
                        {/* Header row */}
                        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                          <div className="flex items-center gap-3">
                            <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${themeStyles.bg} border ${themeStyles.border}`}>
                              <span className={`text-[11px] font-bold ${themeStyles.accent}`}>{shot.shot_number}</span>
                            </div>
                            <div>
                              <p className="text-[11px] font-bold">Shot {shot.shot_number}</p>
                              <p className="text-[9px] text-muted uppercase tracking-wider">{theme === "opening" ? "Opening" : theme === "ending" ? "CTA / Ending" : "Middle"}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 text-[10px] text-muted">
                              <Clock size={10} /> <span className="font-mono">{shot.duration_sec}s</span>
                            </div>
                            <div className="w-24 h-1.5 rounded-full bg-surface-light overflow-hidden">
                              <div className={`h-full ${themeStyles.bar}`}
                                style={{ width: `${Math.min(100, (shot.duration_sec / Math.max(1, storyboard.total_duration_sec)) * 100 * 3)}%` }} />
                            </div>
                          </div>
                        </div>

                        {/* Content grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {/* Visual */}
                          <div className="p-2.5 rounded-lg bg-surface-light/60 border border-border">
                            <p className="text-[9px] text-muted uppercase tracking-wider font-medium mb-1 flex items-center gap-1"><Eye size={9} /> Visual</p>
                            <p className="text-[11px] leading-relaxed">{shot.visual_description}</p>
                          </div>
                          {/* Camera */}
                          <div className="p-2.5 rounded-lg bg-surface-light/60 border border-border">
                            <p className="text-[9px] text-muted uppercase tracking-wider font-medium mb-1 flex items-center gap-1"><Camera size={9} /> Camera</p>
                            <p className="text-[11px] leading-relaxed">{shot.camera}</p>
                          </div>
                        </div>

                        {/* Dialog quote */}
                        {shot.dialog && (
                          <div className={`mt-2 p-3 rounded-lg ${themeStyles.bg} border ${themeStyles.border} relative`}>
                            <Quote size={12} className={`absolute top-2 left-2 ${themeStyles.accent} opacity-60`} />
                            <p className="text-[11px] italic font-medium leading-relaxed pl-6">&ldquo;{shot.dialog}&rdquo;</p>
                          </div>
                        )}

                        {/* Action */}
                        {shot.action && (
                          <div className="mt-2 flex items-start gap-2 text-[10px]">
                            <span className="text-[9px] text-muted uppercase tracking-wider font-medium shrink-0 mt-0.5">Action</span>
                            <p className="flex-1">{shot.action}</p>
                          </div>
                        )}

                        {/* Transition badges */}
                        {(shot.transition_in || shot.transition_out) && (
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            {shot.transition_in && (
                              <span className="inline-flex items-center gap-1 text-[9px] bg-surface-light border border-border rounded-full px-2 py-0.5">
                                <ArrowRight size={9} className="text-blue-400" />
                                In: {shot.transition_in}
                              </span>
                            )}
                            {shot.transition_out && (
                              <span className="inline-flex items-center gap-1 text-[9px] bg-surface-light border border-border rounded-full px-2 py-0.5">
                                <ArrowRightLeft size={9} className="text-purple-400" />
                                Out: {shot.transition_out}
                              </span>
                            )}
                          </div>
                        )}

                        {/* On-screen text */}
                        {shot.on_screen_text && (
                          <div className="mt-2 p-2 rounded-lg bg-warning/5 border border-warning/20">
                            <p className="text-[9px] text-warning uppercase tracking-wider font-medium mb-0.5 flex items-center gap-1"><Type size={9} /> On-screen Text</p>
                            <p className="text-[11px] font-semibold">{shot.on_screen_text}</p>
                          </div>
                        )}

                        {/* B-roll suggestions */}
                        {shot.b_roll_suggestions?.length > 0 && (
                          <div className="mt-2">
                            <p className="text-[9px] text-muted uppercase tracking-wider font-medium mb-1 flex items-center gap-1"><Film size={9} /> B-roll Suggestions</p>
                            <div className="flex flex-wrap gap-1">
                              {shot.b_roll_suggestions.map((b, bi) => (
                                <span key={bi} className="text-[9px] bg-surface-light border border-border rounded-full px-2 py-0.5">{b}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Music cue */}
                        {shot.music_cue && (
                          <div className="mt-2 flex items-center gap-2 text-[10px] text-muted">
                            <Music size={10} className="text-pink-400" />
                            <span className="text-[9px] uppercase tracking-wider font-medium">Music</span>
                            <span>{shot.music_cue}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* TEMPLATES TAB                                                       */}
      {/* ================================================================== */}
      {tab === "templates" && (
        <div className="space-y-4">
          <div className="flex gap-1.5 overflow-x-auto">
            {templateCategories.map(cat => (
              <button key={cat} onClick={() => setTemplateCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-[10px] border whitespace-nowrap transition-colors ${
                  templateCategory === cat ? "border-gold bg-gold/10 text-gold" : "border-border text-muted hover:text-foreground"
                }`}>
                {cat === "all" ? "All" : cat.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {scriptTemplates
              .filter(t => templateCategory === "all" || t.category === templateCategory)
              .map(template => (
                <div key={template.id} className="card-hover p-4 cursor-pointer" onClick={() => {
                  setConfig(prev => ({ ...prev, framework: template.framework, platform: template.platform, topic: template.name }));
                  setTab("generate");
                  toast.success(`Template loaded: ${template.name}`);
                }}>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-xs font-semibold">{template.name}</h3>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-gold/10 text-gold border border-gold/20">{template.framework.replace(/_/g, " ")}</span>
                  </div>
                  <p className="text-[10px] text-muted mb-2">{template.desc}</p>
                  <div className="flex items-center gap-2 text-[9px] text-muted">
                    <span className="bg-surface-light px-1.5 py-0.5 rounded">{template.platform}</span>
                    <span className="bg-surface-light px-1.5 py-0.5 rounded">{template.category.replace(/_/g, " ")}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* TOOLS TAB                                                           */}
      {/* ================================================================== */}
      {tab === "tools" && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold flex items-center gap-1.5"><Type size={13} className="text-gold" /> Tone Analyzer</p>
              <AIEnhanceButton value={toneAnalysisText} onResult={setToneAnalysisText} context="video script section" variant="inline" />
            </div>
            <textarea value={toneAnalysisText} onChange={e => setToneAnalysisText(e.target.value)} className="input w-full h-24 text-xs mb-3" placeholder="Paste your script text here to analyze tone, readability, and sentiment..." />
            <button onClick={() => {
              if (!toneAnalysisText.trim()) { toast.error("Enter text to analyze"); return; }
              const words = toneAnalysisText.split(/\s+/).length;
              setToneResult({ tones: [{ tone: "Professional", score: 72 }, { tone: "Persuasive", score: 65 }, { tone: "Confident", score: 88 }, { tone: "Casual", score: 34 }, { tone: "Urgent", score: 45 }], readability: words > 200 ? "Advanced" : words > 100 ? "Intermediate" : "Easy", wordCount: words, sentiment: "Positive" });
              toast.success("Analysis complete!");
            }} className="btn-primary text-xs flex items-center gap-1.5"><Wand2 size={12} /> Analyze Tone</button>
            {toneResult && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-surface-light rounded-lg p-2 text-center border border-border"><p className="text-lg font-bold text-gold">{toneResult.wordCount}</p><p className="text-[9px] text-muted">Words</p></div>
                  <div className="bg-surface-light rounded-lg p-2 text-center border border-border"><p className="text-sm font-bold text-blue-400">{toneResult.readability}</p><p className="text-[9px] text-muted">Readability</p></div>
                  <div className="bg-surface-light rounded-lg p-2 text-center border border-border"><p className="text-sm font-bold text-green-400">{toneResult.sentiment}</p><p className="text-[9px] text-muted">Sentiment</p></div>
                </div>
                <div className="space-y-1.5">
                  {toneResult.tones.map(t => (
                    <div key={t.tone} className="flex items-center gap-3">
                      <span className="text-[10px] text-muted w-24 shrink-0">{t.tone}</span>
                      <div className="flex-1 h-3 rounded bg-surface-light border border-border overflow-hidden"><div className="h-full rounded bg-gold/50" style={{ width: `${t.score}%` }} /></div>
                      <span className="text-[10px] font-semibold w-8 text-right">{t.score}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card p-4">
            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5"><Search size={13} className="text-gold" /> SEO Script Optimizer</p>
            <div className="space-y-3">
              <div><label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Target Keyword</label><input value={seoKeyword} onChange={e => setSeoKeyword(e.target.value)} className="input w-full text-xs" placeholder="e.g., dental marketing tips" /></div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] text-muted uppercase tracking-wider font-semibold">Script / Caption Content</label>
                  <AIEnhanceButton value={seoContent} onResult={setSeoContent} context="video script section" variant="inline" />
                </div>
                <textarea value={seoContent} onChange={e => setSeoContent(e.target.value)} className="input w-full h-20 text-xs" placeholder="Paste your script or caption text..." />
              </div>
              <button onClick={() => toast.success("SEO analysis complete (demo)")} className="btn-primary text-xs flex items-center gap-1.5"><TrendingUp size={12} /> Optimize for SEO</button>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[{ label: "Keyword Density", value: seoKeyword ? "2.4%" : "---" }, { label: "Title Optimized", value: "Yes" }, { label: "CTA Present", value: "Yes" }, { label: "Hashtag Relevance", value: "High" }].map(m => (
                  <div key={m.label} className="bg-surface-light rounded-lg p-2 text-center border border-border"><p className="text-sm font-bold text-green-400">{m.value}</p><p className="text-[9px] text-muted">{m.label}</p></div>
                ))}
              </div>
            </div>
          </div>

          <div className="card p-4">
            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5"><Layers size={13} className="text-gold" /> Multi-Platform Formatter</p>
            <p className="text-[10px] text-muted mb-3">Reformat your script for different platforms with optimal length and style</p>
            <div className="flex gap-2 mb-3 flex-wrap">
              {PLATFORMS.map(p => (
                <button key={p.id} onClick={() => setFormatPlatform(p.id)} className={`px-3 py-1.5 rounded-lg text-[10px] border transition-colors ${formatPlatform === p.id ? "border-gold bg-gold/10 text-gold" : "border-border text-muted hover:text-foreground"}`}>{p.name}</button>
              ))}
            </div>
            <button onClick={() => toast.success(`Script reformatted for ${PLATFORMS.find(p => p.id === formatPlatform)?.name} (demo)`)} className="btn-secondary text-xs flex items-center gap-1.5"><RefreshCw size={12} /> Reformat Script</button>
          </div>

          <div className="card p-4">
            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5"><TrendingUp size={13} className="text-gold" /> Script Performance Tracker</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {[
                { label: "Scripts Generated", value: savedScripts.length.toString(), color: "text-gold" },
                { label: "Avg. Hook Score", value: "8.4/10", color: "text-green-400" },
                { label: "Most Used Framework", value: "Hook-Story-Offer", color: "text-blue-400" },
                { label: "Top Platform", value: "Instagram", color: "text-purple-400" },
              ].map(stat => (
                <div key={stat.label} className="bg-surface-light rounded-lg p-3 text-center border border-border"><p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p><p className="text-[9px] text-muted">{stat.label}</p></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* VOICE-OVER TAB                                                      */}
      {/* ================================================================== */}
      {tab === "voiceover" && (
        <div className="space-y-4">
          <div className="card p-4">
            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5"><Volume2 size={13} className="text-gold" /> Voice-Over Preview</p>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] text-muted uppercase tracking-wider font-semibold">Script Text</label>
                  <AIEnhanceButton value={voiceoverText || (script?.script?.sections?.map(s => s.dialogue).join("\n\n") || "")} onResult={setVoiceoverText} context="video script section" variant="inline" />
                </div>
                <textarea value={voiceoverText || (script?.script?.sections?.map(s => s.dialogue).join("\n\n") || "")} onChange={e => setVoiceoverText(e.target.value)} className="input w-full h-32 text-xs" placeholder="Enter or paste your script text for voice-over preview..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Speed</label>
                  <div className="flex gap-2">{(["slow", "normal", "fast"] as const).map(speed => (<button key={speed} onClick={() => setVoiceSpeed(speed)} className={`flex-1 py-1.5 rounded-lg text-[10px] border transition-colors ${voiceSpeed === speed ? "border-gold bg-gold/10 text-gold" : "border-border text-muted"}`}>{speed.charAt(0).toUpperCase() + speed.slice(1)}</button>))}</div>
                </div>
                <div><label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Voice Style</label>
                  <div className="flex gap-2">{(["professional", "casual", "energetic", "calm"] as const).map(style => (<button key={style} onClick={() => setVoiceStyle(style)} className={`flex-1 py-1.5 rounded-lg text-[10px] border transition-colors ${voiceStyle === style ? "border-gold bg-gold/10 text-gold" : "border-border text-muted"}`}>{style.charAt(0).toUpperCase() + style.slice(1)}</button>))}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => toast.success("Voice-over preview generated (demo)")} className="btn-primary text-xs flex items-center gap-1.5"><Mic size={12} /> Generate Preview</button>
                <button onClick={() => toast.success("Voice-over downloaded (demo)")} className="btn-secondary text-xs flex items-center gap-1.5"><Download size={12} /> Download Audio</button>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5"><PenTool size={13} className="text-gold" /> Voiceover Notes</p>
            <div className="space-y-2">
              {(script?.script?.sections || []).map((section, i) => (
                <div key={i} className="p-3 rounded-lg bg-surface-light border border-border">
                  <div className="flex items-center justify-between mb-1"><span className="text-[10px] font-semibold text-gold">{section.name}</span><span className="text-[9px] text-muted">{section.duration} | {section.emotion}</span></div>
                  <p className="text-[10px] text-muted">{section.dialogue}</p>
                  {section.visual_direction && <p className="text-[9px] text-blue-400 mt-1">Visual: {section.visual_direction}</p>}
                </div>
              ))}
              {(!script || !script.script?.sections?.length) && <p className="text-[10px] text-muted text-center py-6">Generate a script first to see voiceover notes</p>}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <div className="card p-3 text-center"><p className="text-lg font-bold text-gold">{script ? getWordCount() : 0}</p><p className="text-[9px] text-muted">Total Words</p></div>
            <div className="card p-3 text-center"><p className="text-lg font-bold text-blue-400">{script ? getEstimatedDuration() : "---"}</p><p className="text-[9px] text-muted">Est. Duration</p></div>
            <div className="card p-3 text-center"><p className="text-lg font-bold text-purple-400">{script?.script?.sections?.length || 0}</p><p className="text-[9px] text-muted">Sections</p></div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* APPROVAL TAB                                                        */}
      {/* ================================================================== */}
      {tab === "approval" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">Track client approval status for scripts</p>
            <button onClick={() => toast.success("Script submitted for approval (demo)")} className="btn-primary text-[10px] flex items-center gap-1"><ArrowRight size={10} /> Submit for Approval</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <div className="card p-3"><p className="text-[10px] text-muted uppercase tracking-wider">Total</p><p className="text-lg font-bold text-gold">{approvalScripts.length}</p></div>
            <div className="card p-3"><p className="text-[10px] text-muted uppercase tracking-wider">Pending</p><p className="text-lg font-bold text-yellow-400">{approvalScripts.filter(s => s.status === "pending").length}</p></div>
            <div className="card p-3"><p className="text-[10px] text-muted uppercase tracking-wider">Approved</p><p className="text-lg font-bold text-green-400">{approvalScripts.filter(s => s.status === "approved").length}</p></div>
            <div className="card p-3"><p className="text-[10px] text-muted uppercase tracking-wider">Revisions</p><p className="text-lg font-bold text-red-400">{approvalScripts.filter(s => s.status === "revision").length}</p></div>
          </div>
          <div className="space-y-2">
            {approvalScripts.length === 0 ? (
              <div className="card text-center py-12">
                <CheckCircle size={24} className="mx-auto mb-2 text-muted/30" />
                <p className="text-xs text-muted">No scripts submitted for approval yet</p>
              </div>
            ) : approvalScripts.map(s => (
              <div key={s.id} className="card p-4">
                <div className="flex items-start justify-between mb-2">
                  <div><h3 className="text-xs font-semibold">{s.title}</h3><p className="text-[9px] text-muted">{s.client} | Submitted: {s.submitted}</p></div>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full border ${s.status === "approved" ? "text-green-400 border-green-400/30 bg-green-400/10" : s.status === "revision" ? "text-red-400 border-red-400/30 bg-red-400/10" : "text-yellow-400 border-yellow-400/30 bg-yellow-400/10"}`}>{s.status.charAt(0).toUpperCase() + s.status.slice(1)}</span>
                </div>
                {s.status === "revision" && s.feedback && (
                  <div className="bg-red-500/5 border border-red-400/20 rounded-lg p-2 mt-2"><p className="text-[9px] text-red-400 font-semibold mb-0.5">Client Feedback:</p><p className="text-[10px] text-muted">{s.feedback}</p></div>
                )}
                <div className="flex gap-1.5 mt-2">
                  <button onClick={() => toast.success("Opening script (demo)")} className="btn-secondary text-[9px] flex items-center gap-1"><Eye size={9} /> View</button>
                  {s.status === "revision" && <button onClick={() => toast.success("Revising script (demo)")} className="btn-primary text-[9px] flex items-center gap-1"><RefreshCw size={9} /> Revise</button>}
                  <button onClick={() => { navigator.clipboard.writeText("Here's the script for your review: [link]"); toast.success("Approval link copied!"); }} className="btn-ghost text-[9px] flex items-center gap-1"><Copy size={9} /> Share Link</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History Tab */}
      {tab === "history" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">Previously generated scripts</p>
            <button onClick={() => setTab("generate")} className="btn-primary text-[10px] flex items-center gap-1">
              <Sparkles size={10} /> New Script
            </button>
          </div>
          {savedScripts.length === 0 ? (
            <div className="card text-center py-12">
              <Sparkles size={20} className="mx-auto mb-2 text-muted/30" />
              <p className="text-xs text-muted">No scripts generated yet. Create your first one!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {savedScripts.map(s => (
                <div key={s.id} className="card card-hover cursor-pointer" onClick={() => {
                  const savedScript = s.metadata?.script as ScriptResult | undefined;
                  if (savedScript) {
                    setScript(savedScript);
                    setBatchScripts([savedScript]);
                    setActiveBatchIndex(0);
                    setTab("results");
                  }
                }}>
                  <h3 className="text-xs font-semibold mb-1 line-clamp-2">{s.title}</h3>
                  <div className="flex items-center gap-2 text-[9px] text-muted">
                    <span className="bg-gold/10 text-gold px-1.5 py-0.5 rounded">{s.framework.replace(/_/g, " ")}</span>
                    <span>{s.platform}</span>
                    <span className="ml-auto">{new Date(s.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Save-as-watchlist modal */}
      {saveWatchlistModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSaveWatchlistModal(false)}
        >
          <div
            className="bg-surface border border-border rounded-2xl max-w-md w-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="border-b border-border p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye size={14} className="text-gold" />
                <h3 className="text-sm font-semibold">Save as watchlist</h3>
              </div>
              <button onClick={() => setSaveWatchlistModal(false)} className="text-muted hover:text-foreground text-xs">Close</button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-[10px] text-muted">
                Saves the current niche, keywords, and platforms. The daily cron will refresh trending videos for it every morning.
              </p>
              <div>
                <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Watchlist name</label>
                <input
                  value={newWatchlistName}
                  onChange={e => setNewWatchlistName(e.target.value)}
                  className="input w-full text-xs"
                  placeholder="e.g. Dental — Invisalign"
                  autoFocus
                />
              </div>
              <div className="text-[10px] text-muted bg-surface-light/50 rounded p-2 space-y-0.5">
                <p><span className="text-gold">Niche:</span> {trendingNiche || "—"}</p>
                <p><span className="text-gold">Keywords:</span> {trendingKeywords || "—"}</p>
                <p><span className="text-gold">Platforms:</span> {trendingPlatforms.join(", ") || "—"}</p>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={saveAsWatchlist}
                  disabled={savingWatchlist}
                  className="btn-primary text-xs py-2 flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {savingWatchlist ? <Loader size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                  {savingWatchlist ? "Saving…" : "Save watchlist"}
                </button>
                <button
                  onClick={() => setSaveWatchlistModal(false)}
                  className="btn-secondary text-xs py-2 px-4"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit watchlist modal */}
      {editingWatchlist && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setEditingWatchlist(null)}
        >
          <div
            className="bg-surface border border-border rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-surface/95 backdrop-blur-md border-b border-border p-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <PenTool size={14} className="text-gold" />
                <h3 className="text-sm font-semibold">Edit watchlist</h3>
              </div>
              <button onClick={() => setEditingWatchlist(null)} className="text-muted hover:text-foreground text-xs">Close</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Name</label>
                <input
                  value={editingWatchlist.name}
                  onChange={e => setEditingWatchlist({ ...editingWatchlist, name: e.target.value })}
                  className="input w-full text-xs"
                />
              </div>
              <div>
                <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Niche</label>
                <input
                  value={editingWatchlist.niche}
                  onChange={e => setEditingWatchlist({ ...editingWatchlist, niche: e.target.value })}
                  className="input w-full text-xs"
                />
              </div>
              <div>
                <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Keywords (comma-separated)</label>
                <input
                  value={editingWatchlist.keywords.join(", ")}
                  onChange={e => setEditingWatchlist({
                    ...editingWatchlist,
                    keywords: e.target.value.split(",").map(k => k.trim()).filter(Boolean),
                  })}
                  className="input w-full text-xs"
                />
              </div>
              <div>
                <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Platforms</label>
                <div className="flex flex-wrap gap-1.5">
                  {TRENDING_PLATFORM_OPTS.map(p => {
                    const active = editingWatchlist.platforms.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => setEditingWatchlist({
                          ...editingWatchlist,
                          platforms: active
                            ? editingWatchlist.platforms.filter(x => x !== p.id)
                            : [...editingWatchlist.platforms, p.id],
                        })}
                        className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
                          active
                            ? `${platformColor(p.id)} border-opacity-50`
                            : "border-border text-muted hover:text-foreground"
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="flex items-center gap-2 text-[11px]">
                <input
                  type="checkbox"
                  checked={editingWatchlist.active}
                  onChange={e => setEditingWatchlist({ ...editingWatchlist, active: e.target.checked })}
                />
                Active (cron will scan)
              </label>
              <label className="flex items-center gap-2 text-[11px]">
                <input
                  type="checkbox"
                  checked={editingWatchlist.alert_on_new}
                  onChange={e => setEditingWatchlist({ ...editingWatchlist, alert_on_new: e.target.checked })}
                />
                Send Telegram alert when new trends found
              </label>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={saveEditedWatchlist}
                  disabled={savingWatchlist}
                  className="btn-primary text-xs py-2 flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {savingWatchlist ? <Loader size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                  Save changes
                </button>
                <button onClick={() => setEditingWatchlist(null)} className="btn-secondary text-xs py-2 px-4">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
