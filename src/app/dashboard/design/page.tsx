"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  Sparkles, Copy, ExternalLink, Image as ImageIcon, Award, Flag, Monitor,
  Camera, MessageCircle, Play, Briefcase, Music, Wand2, Palette, Loader,
  Grid, Layers, Mail, FileText, Podcast, RotateCcw
} from "lucide-react";
import toast from "react-hot-toast";
import PageAI from "@/components/page-ai";
import PromptEnhancer from "@/components/prompt-enhancer";

interface GeneratedPrompt {
  id: string;
  section: string;
  prompt: string;
  style: string;
  dimensions: string;
}

interface TemplatePreset {
  label: string;
  icon: React.ReactNode;
  width: number;
  height: number;
  style: string;
  category: string;
}

const SECTIONS = [
  { key: "thumbnails", label: "Thumbnails", icon: <ImageIcon size={16} />, description: "YouTube & video thumbnails" },
  { key: "social", label: "Social Posts", icon: <Camera size={16} />, description: "Posts for all platforms" },
  { key: "carousels", label: "Carousels", icon: <RotateCcw size={16} />, description: "Multi-slide carousel posts" },
  { key: "ads", label: "Ad Creatives", icon: <Flag size={16} />, description: "Facebook, Google & display ads" },
  { key: "logos", label: "Logos & Marks", icon: <Award size={16} />, description: "Logos, icons & brand marks" },
  { key: "banners", label: "Banners", icon: <Monitor size={16} />, description: "Website & social banners" },
  { key: "infographics", label: "Infographics", icon: <Grid size={16} />, description: "Data visualization & info layouts" },
  { key: "presentations", label: "Presentations", icon: <Layers size={16} />, description: "Slide decks & pitch decks" },
  { key: "email_headers", label: "Email Headers", icon: <Mail size={16} />, description: "Newsletter & email graphics" },
  { key: "podcast_covers", label: "Podcast Covers", icon: <Podcast size={16} />, description: "Podcast & audio artwork" },
  { key: "brochures", label: "Brochures", icon: <FileText size={16} />, description: "Print-ready marketing materials" },
  { key: "mockups", label: "Mockups", icon: <Monitor size={16} />, description: "Device & product mockups" },
];

const TEMPLATES: TemplatePreset[] = [
  // Social
  { label: "Instagram Post", icon: <Camera size={12} />, width: 1080, height: 1080, style: "vibrant, social media aesthetic, clean typography", category: "social" },
  { label: "Instagram Story", icon: <Camera size={12} />, width: 1080, height: 1920, style: "bold, full-screen, vertical, eye-catching", category: "social" },
  { label: "TikTok Cover", icon: <Music size={12} />, width: 1080, height: 1920, style: "trendy, Gen-Z aesthetic, bold colors", category: "social" },
  { label: "Pinterest Pin", icon: <ImageIcon size={12} />, width: 1000, height: 1500, style: "aesthetic, pin-worthy, clean layout", category: "social" },
  { label: "Facebook Post", icon: <MessageCircle size={12} />, width: 1200, height: 630, style: "engaging, conversational, clear text", category: "social" },
  { label: "LinkedIn Post", icon: <Briefcase size={12} />, width: 1200, height: 1200, style: "professional, thought leadership, clean", category: "social" },
  // Carousels
  { label: "IG Carousel Slide", icon: <RotateCcw size={12} />, width: 1080, height: 1080, style: "cohesive multi-slide, numbered, educational, swipe-worthy", category: "carousels" },
  { label: "IG Carousel (4:5)", icon: <RotateCcw size={12} />, width: 1080, height: 1350, style: "tall carousel slide, bold headers, listicle layout", category: "carousels" },
  { label: "LinkedIn Carousel", icon: <RotateCcw size={12} />, width: 1080, height: 1080, style: "corporate carousel, data-driven, chart-ready", category: "carousels" },
  { label: "Carousel Cover Slide", icon: <RotateCcw size={12} />, width: 1080, height: 1080, style: "attention-grabbing cover, bold hook text, swipe CTA", category: "carousels" },
  // Ads
  { label: "Facebook Ad", icon: <MessageCircle size={12} />, width: 1200, height: 628, style: "professional, high-converting ad creative, bold CTA", category: "ads" },
  { label: "Google Display Ad", icon: <Flag size={12} />, width: 300, height: 250, style: "high-converting, clear CTA, bold", category: "ads" },
  { label: "Google Leaderboard", icon: <Flag size={12} />, width: 728, height: 90, style: "minimal, direct, clear CTA banner", category: "ads" },
  { label: "Instagram Ad", icon: <Camera size={12} />, width: 1080, height: 1080, style: "native-feeling, engaging, thumb-stopping", category: "ads" },
  // Thumbnails
  { label: "YouTube Thumbnail", icon: <Play size={12} />, width: 1280, height: 720, style: "eye-catching, bold text overlay, expressive", category: "thumbnails" },
  { label: "Podcast Episode Art", icon: <Podcast size={12} />, width: 1280, height: 720, style: "guest photo, episode number, bold branding", category: "thumbnails" },
  // Logos & Marks
  { label: "Primary Logo", icon: <Award size={12} />, width: 1000, height: 1000, style: "clean, scalable, versatile, professional brand mark", category: "logos" },
  { label: "Logo Icon / Favicon", icon: <Award size={12} />, width: 512, height: 512, style: "simple, recognizable at small sizes, icon mark", category: "logos" },
  { label: "Logo Wordmark", icon: <Award size={12} />, width: 2000, height: 600, style: "typography-focused, clean wordmark, brand font", category: "logos" },
  { label: "Logo + Tagline", icon: <Award size={12} />, width: 1500, height: 800, style: "full lockup with tagline, professional", category: "logos" },
  { label: "App Icon", icon: <Award size={12} />, width: 1024, height: 1024, style: "iOS/Android app icon, rounded corners, bold, simple", category: "logos" },
  // Banners
  { label: "LinkedIn Banner", icon: <Briefcase size={12} />, width: 1584, height: 396, style: "corporate, professional, clean gradient", category: "banners" },
  { label: "Twitter Header", icon: <MessageCircle size={12} />, width: 1500, height: 500, style: "clean, professional, brand-focused", category: "banners" },
  { label: "YouTube Channel Art", icon: <Play size={12} />, width: 2560, height: 1440, style: "bold, channel branding, subscribe CTA", category: "banners" },
  { label: "Website Hero", icon: <Monitor size={12} />, width: 1920, height: 800, style: "hero section, compelling, conversion-focused", category: "banners" },
  // Other
  { label: "Email Header", icon: <Mail size={12} />, width: 600, height: 200, style: "clean, on-brand, professional", category: "email_headers" },
  { label: "Podcast Cover", icon: <Podcast size={12} />, width: 3000, height: 3000, style: "bold, recognizable, clear text", category: "podcast_covers" },
  { label: "Presentation Slide", icon: <Layers size={12} />, width: 1920, height: 1080, style: "modern, clean, corporate", category: "presentations" },
  { label: "Phone Mockup", icon: <Monitor size={12} />, width: 1080, height: 1920, style: "device frame, app screenshot, professional", category: "mockups" },
  { label: "Desktop Mockup", icon: <Monitor size={12} />, width: 1920, height: 1080, style: "laptop/desktop frame, website screenshot", category: "mockups" },
];

const INDUSTRY_STYLES: Record<string, string> = {
  dental: "Clean, trustworthy, white/blue tones, friendly faces, modern medical aesthetic",
  legal: "Professional, navy/gold, serif fonts, trust-focused, sophisticated",
  real_estate: "Luxury, warm tones, property photography, aspirational lifestyle",
  fitness: "Bold, energetic, dark with vibrant accents, action shots, motivational",
  restaurant: "Warm, appetizing, food photography, rustic/modern, inviting",
  tech: "Sleek, minimal, blue/purple gradients, futuristic, clean",
  beauty: "Elegant, soft pastels, clean typography, luxury feel",
  ecommerce: "Product-focused, clean white, lifestyle shots, aspirational",
};

const COLOR_PALETTES = [
  { name: "Professional", colors: ["#1a1a2e", "#16213e", "#0f3460", "#e94560", "#C9A84C"] },
  { name: "Fresh & Clean", colors: ["#ffffff", "#f0f0f0", "#2d3436", "#00cec9", "#6c5ce7"] },
  { name: "Bold & Vibrant", colors: ["#ff6b6b", "#feca57", "#48dbfb", "#ff9ff3", "#54a0ff"] },
  { name: "Luxury Gold", colors: ["#0d0d0d", "#1a1a1a", "#C9A84C", "#e8d5a3", "#ffffff"] },
  { name: "Nature", colors: ["#2d5016", "#3a7d0a", "#87c159", "#f5f5dc", "#8b4513"] },
  { name: "Ocean", colors: ["#003545", "#006d77", "#83c5be", "#edf6f9", "#ffddd2"] },
  { name: "Sunset", colors: ["#2b1055", "#d63230", "#f5a623", "#f7dc6f", "#fed8b1"] },
  { name: "Minimal Dark", colors: ["#0a0a0a", "#1a1a1a", "#333333", "#ffffff", "#C9A84C"] },
];

export default function DesignStudioPage() {
  useAuth();
  const supabase = createClient();
  const [clients, setClients] = useState<Array<{ id: string; business_name: string; industry: string }>>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [tab, setTab] = useState<"create" | "templates" | "palettes">("create");
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [generated, setGenerated] = useState<GeneratedPrompt[]>([]);
  const [generating, setGenerating] = useState<string | null>(null);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplatePreset | null>(null);
  const [dimensions, setDimensions] = useState({ width: 1080, height: 1080 });
  const [style, setStyle] = useState("");
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [selectedPalette, setSelectedPalette] = useState<typeof COLOR_PALETTES[0] | null>(null);

  useEffect(() => {
    supabase.from("clients").select("id, business_name, industry").eq("is_active", true).then(({ data }) => {
      setClients(data || []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sectionTypeMap: Record<string, string> = {
    thumbnails: "thumbnail", social: "social_post", carousels: "carousel", ads: "ad", logos: "logo",
    banners: "banner", infographics: "infographic", presentations: "presentation",
    email_headers: "email_header", podcast_covers: "podcast_cover", brochures: "brochure", mockups: "mockup",
  };

  function getAspectRatio(w: number, h: number): string {
    if (w === h) return "1:1";
    if (w / h > 1.7) return "16:9";
    if (h / w > 1.7) return "9:16";
    if (w / h > 1.3) return "3:2";
    return "4:5";
  }

  function getIndustryStyle(): string {
    if (selectedClient) {
      const client = clients.find(c => c.id === selectedClient);
      if (client?.industry) {
        const match = Object.entries(INDUSTRY_STYLES).find(([k]) => client.industry.toLowerCase().includes(k));
        if (match) return match[1];
      }
    }
    return "";
  }

  async function generateDesign(section: string) {
    const prompt = prompts[section];
    if (!prompt?.trim()) { toast.error("Please enter a design prompt"); return; }

    setGenerating(section);
    try {
      const w = selectedTemplate?.width || dimensions.width;
      const h = selectedTemplate?.height || dimensions.height;
      const industryStyle = getIndustryStyle();
      const paletteStr = selectedPalette ? `Color palette: ${selectedPalette.colors.join(", ")}. ` : "";

      const res = await fetch("/api/content/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: prompt,
          type: sectionTypeMap[section] || section,
          aspect_ratio: getAspectRatio(w, h),
          style: `${paletteStr}${industryStyle ? industryStyle + ". " : ""}${selectedTemplate?.style || style || "professional, modern"}`,
          client_id: selectedClient || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const mjPrompts = data.prompts || [];
        const mainPrompt = mjPrompts[0]?.prompt || data.midjourney_prompt || data.prompt || prompt;

        const newPrompt: GeneratedPrompt = {
          id: crypto.randomUUID(),
          section,
          prompt: mainPrompt,
          style: selectedTemplate?.style || style || "professional",
          dimensions: `${w}x${h}`,
        };
        setGenerated(prev => [newPrompt, ...prev]);

        if (mjPrompts.length > 1) {
          mjPrompts.slice(1).forEach((p: { prompt: string }) => {
            setGenerated(prev => [{
              id: crypto.randomUUID(), section, prompt: p.prompt,
              style: selectedTemplate?.style || style || "professional",
              dimensions: `${w}x${h}`,
            }, ...prev]);
          });
        }

        toast.success(`${mjPrompts.length || 1} prompt${(mjPrompts.length || 1) > 1 ? "s" : ""} generated!`);
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.error || "Failed to generate");
      }
    } catch {
      toast.error("Error connecting to AI service");
    }
    setGenerating(null);
  }

  async function batchGenerate() {
    const prompt = prompts[activeSection || "social"];
    if (!prompt?.trim()) { toast.error("Enter a description first"); return; }
    setBatchGenerating(true);
    toast.loading("Generating for all sizes...");

    const sizes = TEMPLATES.filter(t => activeSection ? t.category === activeSection : true).slice(0, 5);
    for (const template of sizes) {
      try {
        const res = await fetch("/api/content/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: prompt,
            type: sectionTypeMap[activeSection || "social"] || "social_post",
            aspect_ratio: getAspectRatio(template.width, template.height),
            style: template.style,
            client_id: selectedClient || null,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const mainPrompt = data.prompts?.[0]?.prompt || data.midjourney_prompt || data.prompt || prompt;
          setGenerated(prev => [{
            id: crypto.randomUUID(),
            section: activeSection || "social",
            prompt: mainPrompt,
            style: template.style,
            dimensions: `${template.width}x${template.height}`,
          }, ...prev]);
        }
      } catch { /* continue */ }
    }
    toast.dismiss();
    toast.success(`Generated prompts for ${sizes.length} sizes!`);
    setBatchGenerating(false);
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  }

  function applyTemplate(template: TemplatePreset) {
    setSelectedTemplate(template);
    setDimensions({ width: template.width, height: template.height });
    setStyle(template.style);
    toast.success(`Applied: ${template.label}`);
  }

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
            <Sparkles size={20} className="text-gold" />
          </div>
          <div>
            <h1 className="page-header mb-0">Design Studio</h1>
            <p className="text-xs text-muted">AI-powered designs with industry styles, color palettes & batch generation</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} className="input text-xs py-1.5 min-w-[140px]">
            <option value="">No client</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.business_name} {c.industry ? `(${c.industry})` : ""}</option>)}
          </select>
          <a href="https://www.canva.com" target="_blank" rel="noopener noreferrer"
            className="btn-primary flex items-center gap-1.5 text-xs">
            <ExternalLink size={12} /> Canva
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-group w-fit">
        {(["create", "templates", "palettes"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={tab === t ? "tab-item-active" : "tab-item-inactive"}>
            {t === "create" ? "Create" : t === "templates" ? "Templates" : "Color Palettes"}
          </button>
        ))}
      </div>

      {/* Create Tab */}
      {tab === "create" && (
        <div className="space-y-4">
          {/* Active template info */}
          {selectedTemplate && (
            <div className="flex items-center gap-3 bg-gold/[0.04] border border-gold/15 rounded-xl px-4 py-2">
              <span className="text-[10px] text-gold font-medium flex items-center gap-1">{selectedTemplate.icon} {selectedTemplate.label}</span>
              <span className="text-[9px] text-muted">{selectedTemplate.width}x{selectedTemplate.height}</span>
              <span className="text-[9px] text-muted truncate max-w-xs">{selectedTemplate.style}</span>
              <button onClick={() => { setSelectedTemplate(null); setStyle(""); }}
                className="text-[9px] text-gold hover:text-gold-light ml-auto flex items-center gap-1"><RotateCcw size={9} /> Clear</button>
            </div>
          )}

          {selectedPalette && (
            <div className="flex items-center gap-3 bg-surface-light border border-border rounded-xl px-4 py-2">
              <span className="text-[10px] font-medium flex items-center gap-1"><Palette size={10} /> {selectedPalette.name}</span>
              <div className="flex gap-1">
                {selectedPalette.colors.map((c, i) => (
                  <div key={i} className="w-5 h-5 rounded-md border border-border" style={{ background: c }} />
                ))}
              </div>
              <button onClick={() => setSelectedPalette(null)}
                className="text-[9px] text-muted hover:text-foreground ml-auto flex items-center gap-1"><RotateCcw size={9} /> Clear</button>
            </div>
          )}

          {/* Industry style hint */}
          {getIndustryStyle() && (
            <div className="flex items-center gap-2 text-[9px] text-gold bg-gold/[0.03] border border-gold/10 rounded-lg px-3 py-1.5">
              <Wand2 size={10} />
              <span>AI will use industry-specific style: <span className="font-medium">{getIndustryStyle().substring(0, 80)}...</span></span>
            </div>
          )}

          {/* Section selector */}
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setActiveSection(null)}
              className={`text-[10px] px-3 py-1.5 rounded-lg border transition-all ${!activeSection ? "border-gold/30 bg-gold/[0.05] text-gold font-medium" : "border-border text-muted hover:text-foreground"}`}>
              All
            </button>
            {SECTIONS.map(s => (
              <button key={s.key} onClick={() => setActiveSection(s.key)}
                className={`text-[10px] px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                  activeSection === s.key ? "border-gold/30 bg-gold/[0.05] text-gold font-medium" : "border-border text-muted hover:text-foreground"
                }`}>
                {s.icon} {s.label}
              </button>
            ))}
          </div>

          {/* Design cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(activeSection ? SECTIONS.filter(s => s.key === activeSection) : SECTIONS.slice(0, 6)).map(section => (
              <div key={section.key} className="card card-hover rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 bg-gold/10 rounded-xl flex items-center justify-center text-gold">
                    {section.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-sm">{section.label}</h3>
                    <p className="text-[10px] text-muted">{section.description}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <input type="number" min={100} max={5000} value={dimensions.width}
                      onChange={e => setDimensions({ ...dimensions, width: parseInt(e.target.value) || 1080 })}
                      className="input w-16 text-[9px] py-1 text-center" />
                    <span className="text-[9px] text-muted">x</span>
                    <input type="number" min={100} max={5000} value={dimensions.height}
                      onChange={e => setDimensions({ ...dimensions, height: parseInt(e.target.value) || 1080 })}
                      className="input w-16 text-[9px] py-1 text-center" />
                  </div>
                </div>
                <div className="mb-3">
                  <PromptEnhancer
                    value={prompts[section.key] || ""}
                    onChange={(v) => setPrompts(prev => ({ ...prev, [section.key]: v }))}
                    type="design"
                    placeholder={`Describe your ${section.label.toLowerCase()} design...`}
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => generateDesign(section.key)} disabled={generating === section.key}
                    className="btn-primary flex-1 flex items-center justify-center gap-2 rounded-lg text-xs">
                    {generating === section.key ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    {generating === section.key ? "Generating..." : "Generate with AI"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Batch generate */}
          {activeSection && (
            <button onClick={batchGenerate} disabled={batchGenerating || !prompts[activeSection]}
              className="w-full text-xs py-2.5 flex items-center justify-center gap-2 rounded-xl border border-gold/30 bg-gold/[0.06] text-gold hover:bg-gold/[0.12] transition-all font-medium disabled:opacity-50">
              {batchGenerating ? <Loader size={14} className="animate-spin" /> : <Layers size={14} />}
              {batchGenerating ? "Generating all sizes..." : "Batch Generate for All Sizes"}
            </button>
          )}

          {/* Generated Prompts */}
          {generated.length > 0 && (
            <div className="card rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="section-header flex items-center gap-2 mb-0">
                  <ImageIcon size={16} /> Generated Prompts ({generated.length})
                </h2>
                <button onClick={() => {
                  const all = generated.map(g => `[${g.section} - ${g.dimensions}]\n${g.prompt}`).join("\n\n");
                  navigator.clipboard.writeText(all);
                  toast.success("All prompts copied!");
                }} className="btn-ghost text-[9px] flex items-center gap-1"><Copy size={10} /> Copy All</button>
              </div>
              <div className="space-y-3">
                {generated.map(g => (
                  <div key={g.id} className="card-hover rounded-xl">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="badge bg-gold/10 text-gold text-[10px] px-2 py-0.5 rounded capitalize">
                            {g.section}
                          </span>
                          <span className="text-[10px] text-muted">{g.dimensions}</span>
                        </div>
                        <p className="text-xs text-foreground leading-relaxed">{g.prompt}</p>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <button onClick={() => copyToClipboard(g.prompt)}
                          className="btn-primary flex items-center gap-1 text-[10px] px-3 py-1.5 rounded-lg">
                          <Copy size={10} /> Copy Prompt
                        </button>
                        <a href="https://www.canva.com" target="_blank" rel="noopener noreferrer"
                          className="btn-secondary flex items-center gap-1 text-[10px] px-3 py-1.5 rounded-lg text-center justify-center">
                          <ExternalLink size={10} /> Canva
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Templates Tab */}
      {tab === "templates" && (
        <div className="space-y-4">
          <p className="text-xs text-muted">Click a template to apply its dimensions and style to your designs</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {TEMPLATES.map(t => (
              <button key={t.label} onClick={() => { applyTemplate(t); setTab("create"); }}
                className={`card card-hover text-left p-3 ${selectedTemplate?.label === t.label ? "border-gold/30" : ""}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-gold">{t.icon}</span>
                  <span className="text-[8px] text-muted bg-surface-light px-1.5 py-0.5 rounded capitalize">{t.category}</span>
                </div>
                <p className="text-[11px] font-semibold">{t.label}</p>
                <p className="text-[9px] text-muted">{t.width}x{t.height}</p>
                <p className="text-[8px] text-muted mt-1 line-clamp-2">{t.style}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Color Palettes Tab */}
      {tab === "palettes" && (
        <div className="space-y-4">
          <p className="text-xs text-muted">Select a palette to apply to AI-generated designs. AI will incorporate these colors.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {COLOR_PALETTES.map(palette => (
              <button key={palette.name} onClick={() => { setSelectedPalette(palette); setTab("create"); toast.success(`Palette applied: ${palette.name}`); }}
                className={`card card-hover p-4 text-left ${selectedPalette?.name === palette.name ? "border-gold/30" : ""}`}>
                <p className="text-xs font-semibold mb-2">{palette.name}</p>
                <div className="flex gap-1 mb-2">
                  {palette.colors.map((c, i) => (
                    <div key={i} className="flex-1 h-8 rounded-lg border border-border" style={{ background: c }} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-1">
                  {palette.colors.map((c, i) => (
                    <span key={i} className="text-[8px] text-muted font-mono">{c}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>

          <div className="card border-gold/10">
            <h3 className="section-header flex items-center gap-2"><Wand2 size={12} className="text-gold" /> Industry Styles</h3>
            <p className="text-[10px] text-muted mb-3">When you select a client, AI automatically uses an industry-appropriate style</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {Object.entries(INDUSTRY_STYLES).map(([industry, style]) => (
                <div key={industry} className="p-2.5 rounded-xl border border-border">
                  <p className="text-[10px] font-semibold capitalize">{industry}</p>
                  <p className="text-[9px] text-muted">{style}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <PageAI pageName="Design Studio" context="AI design prompt generator for thumbnails, social posts, ads, logos, banners, infographics, presentations, and more. Generates Midjourney prompts with industry-specific styling." suggestions={["Generate a thumbnail concept for '5 Marketing Tips'", "Create an Instagram post design for a restaurant", "What colors work best for dental practice ads?", "Design a YouTube banner concept", "Create a full brand kit for a fitness studio"]} />
    </div>
  );
}
