"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  Sparkles, Film, Camera,
  Search, Loader, Copy, Zap, Target, MessageSquare,
  ArrowRight, RefreshCw, Eye, CheckCircle, Clock,
  Download, FileText
} from "lucide-react";
import toast from "react-hot-toast";

const FRAMEWORKS = [
  { id: "hook_story_offer", name: "Hook-Story-Offer", desc: "Stop scroll → tell story → make offer", color: "text-gold" },
  { id: "pas", name: "PAS", desc: "Problem → Agitate → Solution", color: "text-danger" },
  { id: "aida", name: "AIDA", desc: "Attention → Interest → Desire → Action", color: "text-gold" },
  { id: "before_after", name: "Before/After", desc: "Pain state → transformation → results", color: "text-success" },
  { id: "contrarian", name: "Contrarian", desc: "Challenge beliefs → new perspective", color: "text-warning" },
  { id: "listicle", name: "Listicle", desc: "X things/mistakes/secrets that...", color: "text-purple-400" },
];

const TONES = ["professional", "casual", "bold", "educational", "storytelling", "controversial"];

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

export default function ScriptLabPage() {
  useAuth();
  const [clients, setClients] = useState<Array<{ id: string; business_name: string }>>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [tab, setTab] = useState<"generate" | "research" | "results">("generate");
  const supabase = createClient();

  // Script config
  const [config, setConfig] = useState({
    script_type: "short_form",
    platform: "instagram",
    topic: "",
    framework: "hook_story_offer",
    tone: "professional",
    viral_reference: "",
    target_audience: "",
    pain_points: "",
  });

  // Research config
  const [researchConfig, setResearchConfig] = useState({
    competitor_name: "",
    industry: "",
    platform: "instagram",
  });

  const [generating, setGenerating] = useState(false);
  const [researching, setResearching] = useState(false);
  const [script, setScript] = useState<ScriptResult | null>(null);
  const [research, setResearch] = useState<ViralResearch | null>(null);

  // Load clients
  useState(() => {
    supabase.from("clients").select("id, business_name").eq("is_active", true).then(({ data }) => {
      setClients(data || []);
    });
  });

  async function generateScript() {
    if (!config.topic) { toast.error("Enter a topic"); return; }
    setGenerating(true);
    toast.loading("AI is crafting your script...");
    try {
      const res = await fetch("/api/content/advanced-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...config, client_id: selectedClient || null }),
      });
      toast.dismiss();
      const data = await res.json();
      if (data.success) {
        setScript(data.script);
        setTab("results");
        toast.success("Script generated!");
      } else {
        toast.error(data.error || "Failed to generate");
      }
    } catch {
      toast.dismiss();
      toast.error("Error generating script");
    }
    setGenerating(false);
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
      "  www.shortstackdigital.com",
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
<div class="meta">Framework: ${config.framework.replace(/_/g, " ")} | Platform: ${config.platform} | Tone: ${config.tone}</div>
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
<div class="footer">Generated by ShortStack OS — shortstackdigital.com</div>
</body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `${script.title.replace(/[^a-zA-Z0-9]/g, "_")}_script.html`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("Script downloaded as HTML! Open in browser and print to PDF.");
  }

  function printScript() {
    if (!script) return;
    downloadAsHTML();
    toast("Open the HTML file and press Ctrl+P to save as PDF", { icon: "🖨️", duration: 4000 });
  }

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
            <Sparkles size={20} className="text-gold" />
          </div>
          <div>
            <h1 className="page-header mb-0">Script Lab</h1>
            <p className="text-xs text-muted">AI script generator with viral research & proven frameworks</p>
          </div>
        </div>
        <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)}
          className="input text-xs py-1.5 min-w-[160px]">
          <option value="">No client</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.business_name}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div className="tab-group w-fit">
        {(["generate", "research", "results"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={tab === t ? "tab-item-active" : "tab-item-inactive"}>
            {t === "generate" ? "Script Generator" : t === "research" ? "Viral Research" : `Results ${script ? "1" : ""}`}
          </button>
        ))}
      </div>

      {/* Generate Tab */}
      {tab === "generate" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {/* Framework selector */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2"><Target size={13} className="text-gold" /> Script Framework</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {FRAMEWORKS.map(f => (
                  <button key={f.id} onClick={() => setConfig({ ...config, framework: f.id })}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      config.framework === f.id ? "border-gold/30 bg-gold/[0.05]" : "border-border hover:border-gold/15"
                    }`}>
                    <p className={`text-[11px] font-semibold ${f.color}`}>{f.name}</p>
                    <p className="text-[9px] text-muted">{f.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Script config */}
            <div className="card space-y-3">
              <h2 className="section-header">Script Details</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Type</label>
                  <select value={config.script_type} onChange={e => setConfig({ ...config, script_type: e.target.value })}
                    className="input w-full text-xs">
                    <option value="short_form">Short Form (30-60s)</option>
                    <option value="long_form">Long Form (8-15min)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Platform</label>
                  <select value={config.platform} onChange={e => setConfig({ ...config, platform: e.target.value })}
                    className="input w-full text-xs">
                    <option value="instagram">Instagram Reels</option>
                    <option value="tiktok">TikTok</option>
                    <option value="youtube">YouTube</option>
                    <option value="linkedin">LinkedIn</option>
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
                <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Topic * <span className="text-muted/50">— or pick a preset below</span></label>
                <input value={config.topic} onChange={e => setConfig({ ...config, topic: e.target.value })}
                  className="input w-full text-xs" placeholder="e.g., Why most dental practices fail at social media" />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {[
                    "Why most businesses fail at social media",
                    "3 things your competitors don't want you to know",
                    "The biggest mistake local businesses make online",
                    "How to get 50 new clients in 30 days",
                    "Stop wasting money on ads that don't convert",
                    "Why your website is losing you customers",
                  ].map((t, i) => (
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
                <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Viral Reference (put your own twist on this)</label>
                <textarea value={config.viral_reference} onChange={e => setConfig({ ...config, viral_reference: e.target.value })}
                  className="input w-full h-16 text-xs" placeholder="Paste a viral video concept, hook, or transcript to remix with your own angle..." />
              </div>
            </div>

            <button onClick={generateScript} disabled={generating || !config.topic}
              className="btn-primary w-full text-xs py-2.5 flex items-center justify-center gap-2 disabled:opacity-50">
              {generating ? <Loader size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {generating ? "Generating Advanced Script..." : "Generate Script"}
            </button>
          </div>

          {/* Quick tips */}
          <div className="space-y-3">
            <div className="card border-gold/10">
              <h3 className="section-header flex items-center gap-2"><Zap size={12} className="text-gold" /> Pro Tips</h3>
              <div className="space-y-2 text-[10px] text-muted">
                <p><span className="text-gold font-medium">Hook:</span> First 3 seconds decide if someone watches or scrolls</p>
                <p><span className="text-gold font-medium">PAS:</span> Best for service businesses selling to pain points</p>
                <p><span className="text-gold font-medium">Contrarian:</span> Best for standing out and getting comments</p>
                <p><span className="text-gold font-medium">Viral Reference:</span> Find a viral video in your niche, paste the concept, AI will create your unique version</p>
              </div>
            </div>

            {/* Use research results */}
            {research && research.opportunities && (
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

          {/* Research Results */}
          {research && (
            <div className="space-y-4 fade-in">
              {/* Viral videos */}
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
                        <button onClick={() => setConfig({ ...config, viral_reference: `${v.title}: ${v.hook}`, topic: v.title })}
                          className="text-[9px] text-gold hover:text-gold-light flex items-center gap-0.5">
                          <Sparkles size={9} /> Use as reference
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Patterns */}
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

              {/* Opportunities */}
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
      {tab === "results" && script && (
        <div className="space-y-4 fade-in">
          {/* Download bar */}
          <div className="flex items-center justify-between bg-surface-light rounded-xl px-4 py-2 border border-border">
            <span className="text-[10px] text-muted">Export this script</span>
            <div className="flex items-center gap-1.5">
              <button onClick={downloadAsText} className="btn-secondary text-[9px] py-1 px-2.5 flex items-center gap-1">
                <FileText size={10} /> .TXT
              </button>
              <button onClick={downloadAsHTML} className="btn-secondary text-[9px] py-1 px-2.5 flex items-center gap-1">
                <Download size={10} /> .HTML
              </button>
              <button onClick={printScript} className="btn-primary text-[9px] py-1 px-2.5 flex items-center gap-1">
                <Download size={10} /> PDF (Print)
              </button>
              <button onClick={() => copyToClipboard(script.script.sections.map(s => `[${s.name}] ${s.dialogue}`).join("\n\n"))}
                className="btn-ghost text-[9px] py-1 px-2.5 flex items-center gap-1">
                <Copy size={10} /> Copy All
              </button>
            </div>
          </div>

          {/* Title + Hook */}
          <div className="card border-gold/10 relative overflow-hidden">
            <div className="absolute inset-0 bg-mesh opacity-30" />
            <div className="relative">
              <h2 className="text-sm font-bold mb-1">{script.title}</h2>
              <p className="text-[10px] text-muted mb-3">{script.value_delivered}</p>
              <div className="bg-gold/[0.05] border border-gold/15 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[9px] text-gold uppercase tracking-wider font-medium">The Hook</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] bg-surface-light px-1.5 py-0.5 rounded">{script.hook.type}</span>
                    <button onClick={() => copyToClipboard(script.hook.text)}><Copy size={10} className="text-muted hover:text-foreground" /></button>
                  </div>
                </div>
                <p className="text-xs font-medium italic">&ldquo;{script.hook.text}&rdquo;</p>
                <p className="text-[9px] text-muted mt-1">{script.hook.why_it_works}</p>
              </div>
            </div>
          </div>

          {/* Full script sections */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="section-header mb-0">Full Script</h2>
              <button onClick={() => copyToClipboard(script.script.sections.map(s => `[${s.name}] ${s.dialogue}`).join("\n\n"))}
                className="btn-ghost text-[10px] flex items-center gap-1"><Copy size={10} /> Copy All</button>
            </div>
            <div className="space-y-1">
              {script.script.sections.map((section, i) => (
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
            {/* CTA */}
            <div className="card">
              <h3 className="section-header flex items-center gap-2"><Target size={12} className="text-gold" /> CTA</h3>
              <p className="text-xs font-medium mb-1">&ldquo;{script.cta.text}&rdquo;</p>
              <div className="flex items-center gap-2 text-[9px] text-muted">
                <span className="bg-surface-light px-1.5 py-0.5 rounded">{script.cta.type}</span>
                <span>{script.cta.placement}</span>
              </div>
            </div>

            {/* Posting strategy */}
            <div className="card">
              <h3 className="section-header flex items-center gap-2"><Clock size={12} className="text-gold" /> Posting Strategy</h3>
              <div className="space-y-1 text-[10px]">
                <p><span className="text-muted">Best time:</span> {script.posting_strategy.best_time}</p>
                <p><span className="text-muted">Best day:</span> {script.posting_strategy.best_day}</p>
                <p><span className="text-muted">Tip:</span> {script.posting_strategy.boost_tip}</p>
              </div>
            </div>

            {/* Thumbnail */}
            <div className="card">
              <h3 className="section-header flex items-center gap-2"><Camera size={12} className="text-pink-400" /> Thumbnail</h3>
              <div className="space-y-1 text-[10px]">
                <p><span className="text-muted">Text:</span> {script.thumbnail.text}</p>
                <p><span className="text-muted">Expression:</span> {script.thumbnail.emotion}</p>
                <p><span className="text-muted">Colors:</span> {script.thumbnail.colors}</p>
              </div>
            </div>
          </div>

          {/* A/B variations */}
          {script.ab_variations && (
            <div className="card">
              <h3 className="section-header flex items-center gap-2"><RefreshCw size={12} className="text-warning" /> A/B Hook Variations</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {script.ab_variations.map((v, i) => (
                  <div key={i} className="p-2.5 rounded-xl border border-border bg-surface-light">
                    <p className="text-[11px] font-medium italic mb-1">&ldquo;{v.hook_alt}&rdquo;</p>
                    <p className="text-[9px] text-muted">{v.why}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pain points + Caption */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="card">
              <h3 className="section-header">Pain Points Addressed</h3>
              <div className="space-y-1">
                {script.pain_points_addressed?.map((p, i) => (
                  <p key={i} className="text-[10px] flex items-center gap-1.5"><Target size={9} className="text-danger" /> {p}</p>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <h3 className="section-header mb-0">Caption</h3>
                <button onClick={() => copyToClipboard(script.caption)} className="btn-ghost text-[9px]"><Copy size={10} /></button>
              </div>
              <p className="text-[10px] whitespace-pre-wrap leading-relaxed">{script.caption}</p>
            </div>
          </div>

          {/* Hashtags */}
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="section-header mb-0">Hashtags</h3>
              <button onClick={() => copyToClipboard(script.hashtags?.join(" ") || "")} className="btn-ghost text-[9px]"><Copy size={10} /> Copy</button>
            </div>
            <div className="flex flex-wrap gap-1">
              {script.hashtags?.map((h, i) => (
                <span key={i} className="text-[9px] bg-surface-light px-1.5 py-0.5 rounded text-gold">{h}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
