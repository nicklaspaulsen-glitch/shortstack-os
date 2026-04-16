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
  ListChecks, Type, Volume2
} from "lucide-react";
import toast from "react-hot-toast";

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
  const [tab, setTab] = useState<"generate" | "research" | "results" | "history" | "templates" | "tools" | "voiceover" | "approval">("generate");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-select managed client
  useEffect(() => {
    if (managedClientId && clients.length > 0) {
      setSelectedClient(managedClientId);
    }
  }, [managedClientId, clients]);

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
    toast.loading(config.batch_count > 1 ? `Generating ${config.batch_count} variations...` : "AI is crafting your script...");
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
      toast.dismiss();
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
        toast.success(results.length > 1 ? `${results.length} script variations generated!` : "Script generated!");
      } else {
        toast.error("Failed to generate");
      }
    } catch {
      toast.dismiss();
      toast.error("Error generating script");
    }
    setGenerating(false);
  }

  async function rewriteScript(instruction: string) {
    if (!script) return;
    setRewriting(true);
    toast.loading("AI is rewriting...");
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
      toast.dismiss();
      const data = await res.json();
      if (data.success) {
        setScript(data.script);
        toast.success("Script rewritten!");
      } else {
        toast.error("Rewrite failed");
      }
    } catch {
      toast.dismiss();
      toast.error("Error");
    }
    setRewriting(false);
  }

  async function doResearch() {
    if (!researchConfig.industry) { toast.error("Enter an industry"); return; }
    setResearching(true);
    toast.loading("Researching viral content...");
    try {
      const res = await fetch("/api/content/viral-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...researchConfig, client_id: selectedClient || null }),
      });
      toast.dismiss();
      const data = await res.json();
      if (data.success) {
        setResearch(data.research);
        toast.success("Research complete!");
      } else {
        toast.error(data.error || "Research failed");
      }
    } catch {
      toast.dismiss();
      toast.error("Error");
    }
    setResearching(false);
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
      "        SHORTSTACK DIGITAL AGENCY",
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
      "  Generated by ShortStack OS",
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
<html><head><meta charset="utf-8"><title>${script.title} — ShortStack Script</title>
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
  <div><h1>SHORTSTACK</h1><div class="sub">Digital Agency</div></div>
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
<div class="footer">Generated by ShortStack OS</div>
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

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
            <Sparkles size={20} className="text-gold" />
          </div>
          <div>
            <h1 className="page-header mb-0">Script Lab</h1>
            <p className="text-xs text-muted">AI script generator with viral research, proven frameworks & batch creation</p>
          </div>
        </div>
        <select value={selectedClient} onChange={e => {
          setSelectedClient(e.target.value);
          const client = clients.find(c => c.id === e.target.value);
          if (client?.industry) {
            const matchedPreset = Object.keys(TOPIC_PRESETS).find(k => client.industry.toLowerCase().includes(k));
            if (matchedPreset) setConfig(prev => ({ ...prev, industry_preset: matchedPreset }));
          }
        }} className="input text-xs py-1.5 min-w-[160px]">
          <option value="">No client</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.business_name}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-border pb-0">
        {([
          { id: "generate" as const, label: "Generator", icon: Sparkles },
          { id: "templates" as const, label: `Templates (${scriptTemplates.length})`, icon: BookOpen },
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
                <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Viral Reference (remix existing content)</label>
                <textarea value={config.viral_reference} onChange={e => setConfig({ ...config, viral_reference: e.target.value })}
                  className="input w-full h-14 text-xs" placeholder="Paste a viral video concept, hook, or transcript to remix with your own angle..." />
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
            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5"><Type size={13} className="text-gold" /> Tone Analyzer</p>
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
              <div><label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Script / Caption Content</label><textarea value={seoContent} onChange={e => setSeoContent(e.target.value)} className="input w-full h-20 text-xs" placeholder="Paste your script or caption text..." /></div>
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
              <div><label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Script Text</label>
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
    </div>
  );
}
