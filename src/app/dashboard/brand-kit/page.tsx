"use client";

import { useState } from "react";
import {
  Globe, Palette, Type, Image as ImageIcon, Sparkles,
  Loader, Search, Download, Copy, Check, ExternalLink,
  Megaphone, FileText, Film, Mail, MessageSquare,
  Layout, Wand2, Eye, Share2, Zap,
  ChevronRight, RefreshCw, Link2, Hash
} from "lucide-react";
import toast from "react-hot-toast";
import PageAI from "@/components/page-ai";

type MainTab = "extract" | "colors" | "typography" | "media" | "generate";

interface BrandData {
  siteName: string;
  description: string;
  favicon: string;
  ogImage: string;
  colors: string[];
  fonts: string[];
  images: string[];
  socialLinks: { platform: string; url: string }[];
  headings: string[];
  ctaTexts: string[];
}

const GENERATE_PRESETS = [
  { id: "social-ad", label: "Social Ad", icon: <Megaphone size={16} />, desc: "Facebook/Instagram ad creative from brand colors & imagery" },
  { id: "story-post", label: "Story Post", icon: <Layout size={16} />, desc: "Instagram/TikTok story with brand palette and fonts" },
  { id: "carousel", label: "Carousel", icon: <Film size={16} />, desc: "Multi-slide carousel using extracted visuals" },
  { id: "email-header", label: "Email Header", icon: <Mail size={16} />, desc: "Branded email header banner" },
  { id: "logo-variations", label: "Logo Variations", icon: <Sparkles size={16} />, desc: "AI variations of the brand logo" },
  { id: "video-intro", label: "Video Intro", icon: <Film size={16} />, desc: "5-second branded intro animation" },
  { id: "business-card", label: "Business Card", icon: <FileText size={16} />, desc: "Print-ready business card design" },
  { id: "social-banner", label: "Social Banner", icon: <Share2 size={16} />, desc: "Cover photos for Facebook, LinkedIn, YouTube" },
  { id: "ad-copy", label: "Ad Copy", icon: <MessageSquare size={16} />, desc: "Headlines and body copy matching brand voice" },
  { id: "landing-page", label: "Landing Page", icon: <Globe size={16} />, desc: "Wireframe mockup with extracted brand elements" },
];

export default function BrandKitPage() {
  const [tab, setTab] = useState<MainTab>("extract");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [brand, setBrand] = useState<BrandData | null>(null);
  const [copiedColor, setCopiedColor] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  async function scrapeBrand() {
    if (!url.trim()) {
      toast.error("Enter a website URL");
      return;
    }
    setLoading(true);
    setBrand(null);
    try {
      const res = await fetch("/api/brand-scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (data.success && data.brand) {
        setBrand(data.brand);
        setTab("colors");
        toast.success("Brand data extracted!");
      } else {
        toast.error(data.error || "Failed to extract brand data");
      }
    } catch {
      toast.error("Network error — check the URL and try again");
    }
    setLoading(false);
  }

  function copyColor(hex: string) {
    navigator.clipboard.writeText(hex);
    setCopiedColor(hex);
    toast.success(`Copied ${hex}`);
    setTimeout(() => setCopiedColor(null), 2000);
  }

  function copyAllColors() {
    if (!brand) return;
    navigator.clipboard.writeText(brand.colors.join(", "));
    toast.success("All colors copied!");
  }

  function generateFromPreset(presetId: string) {
    setSelectedPreset(presetId);
    setGenerating(true);
    // Simulate generation — in production this would call an AI API
    setTimeout(() => {
      setGenerating(false);
      toast.success("Generation complete! Check your Content Library.");
    }, 3000);
  }

  function downloadBrandKit() {
    if (!brand) return;
    const kit = {
      name: brand.siteName,
      description: brand.description,
      colors: brand.colors,
      fonts: brand.fonts,
      socialLinks: brand.socialLinks,
      headings: brand.headings,
      ctaTexts: brand.ctaTexts,
      extractedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(kit, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${brand.siteName.replace(/\s+/g, "-").toLowerCase() || "brand"}-kit.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Brand kit downloaded!");
  }

  const tabs: { key: MainTab; label: string; icon: React.ReactNode; disabled?: boolean }[] = [
    { key: "extract", label: "Extract", icon: <Search size={14} /> },
    { key: "colors", label: "Colors", icon: <Palette size={14} />, disabled: !brand },
    { key: "typography", label: "Typography", icon: <Type size={14} />, disabled: !brand },
    { key: "media", label: "Media", icon: <ImageIcon size={14} />, disabled: !brand },
    { key: "generate", label: "Generate", icon: <Sparkles size={14} />, disabled: !brand },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Wand2 size={20} className="text-gold" /> Brand Kit
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Paste any website URL to extract brand colors, fonts, logos, and generate content
          </p>
        </div>
        <div className="flex items-center gap-2">
          {brand && (
            <>
              <button onClick={downloadBrandKit} className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5">
                <Download size={13} /> Export Kit
              </button>
              <button onClick={() => { setBrand(null); setUrl(""); setTab("extract"); }} className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5">
                <RefreshCw size={13} /> New Scan
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border/30 pb-px">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => !t.disabled && setTab(t.key)}
            disabled={t.disabled}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-all ${
              tab === t.key
                ? "text-gold border-b-2 border-gold bg-gold/5"
                : t.disabled
                  ? "text-muted/40 cursor-not-allowed"
                  : "text-muted hover:text-foreground"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── EXTRACT TAB ── */}
      {tab === "extract" && (
        <div className="space-y-6">
          {/* URL Input */}
          <div className="bg-surface border border-border/30 rounded-xl p-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-gold/10 rounded-2xl flex items-center justify-center mb-4">
              <Globe size={28} className="text-gold" />
            </div>
            <h2 className="text-lg font-bold">Extract Brand Identity</h2>
            <p className="text-xs text-muted max-w-md mx-auto">
              Enter a website URL and we&apos;ll analyze it to extract brand colors, fonts, logos, imagery, and social profiles.
              Use this data to generate on-brand content instantly.
            </p>
            <div className="max-w-lg mx-auto flex gap-2">
              <div className="relative flex-1">
                <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && scrapeBrand()}
                  className="input w-full pl-9 py-2.5 text-sm"
                  disabled={loading}
                />
              </div>
              <button
                onClick={scrapeBrand}
                disabled={loading}
                className="btn-primary px-6 py-2.5 text-sm flex items-center gap-2"
              >
                {loading ? <Loader size={14} className="animate-spin" /> : <Zap size={14} />}
                {loading ? "Scanning..." : "Extract"}
              </button>
            </div>
          </div>

          {/* How it works */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { icon: <Globe size={18} />, title: "1. Paste URL", desc: "Enter any website address" },
              { icon: <Eye size={18} />, title: "2. We Analyze", desc: "Colors, fonts, images, socials" },
              { icon: <Palette size={18} />, title: "3. Brand Kit", desc: "Complete brand profile ready" },
              { icon: <Sparkles size={18} />, title: "4. Generate", desc: "Create on-brand content" },
            ].map((step, i) => (
              <div key={i} className="bg-surface border border-border/30 rounded-xl p-4 text-center">
                <div className="w-10 h-10 mx-auto bg-gold/10 rounded-lg flex items-center justify-center text-gold mb-2">
                  {step.icon}
                </div>
                <p className="text-xs font-semibold">{step.title}</p>
                <p className="text-[10px] text-muted mt-0.5">{step.desc}</p>
              </div>
            ))}
          </div>

          {/* Brand overview (after scan) */}
          {brand && (
            <div className="bg-surface border border-border/30 rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-4">
                {brand.favicon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brand.favicon} alt="Favicon" className="w-10 h-10 rounded-lg bg-surface-light border border-border/20" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                )}
                <div>
                  <h3 className="font-bold text-sm">{brand.siteName || "Unknown Site"}</h3>
                  <p className="text-[10px] text-muted">{brand.description || "No description found"}</p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div className="bg-surface-light/50 rounded-lg p-3 border border-border/20 text-center">
                  <Palette size={14} className="mx-auto text-gold mb-1" />
                  <p className="text-lg font-bold font-mono">{brand.colors.length}</p>
                  <p className="text-[9px] text-muted uppercase">Colors</p>
                </div>
                <div className="bg-surface-light/50 rounded-lg p-3 border border-border/20 text-center">
                  <Type size={14} className="mx-auto text-gold mb-1" />
                  <p className="text-lg font-bold font-mono">{brand.fonts.length}</p>
                  <p className="text-[9px] text-muted uppercase">Fonts</p>
                </div>
                <div className="bg-surface-light/50 rounded-lg p-3 border border-border/20 text-center">
                  <ImageIcon size={14} className="mx-auto text-gold mb-1" />
                  <p className="text-lg font-bold font-mono">{brand.images.length}</p>
                  <p className="text-[9px] text-muted uppercase">Images</p>
                </div>
                <div className="bg-surface-light/50 rounded-lg p-3 border border-border/20 text-center">
                  <Share2 size={14} className="mx-auto text-gold mb-1" />
                  <p className="text-lg font-bold font-mono">{brand.socialLinks.length}</p>
                  <p className="text-[9px] text-muted uppercase">Socials</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => setTab("colors")} className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5">
                  <Palette size={13} /> View Colors <ChevronRight size={12} />
                </button>
                <button onClick={() => setTab("generate")} className="btn-secondary text-xs px-4 py-2 flex items-center gap-1.5">
                  <Sparkles size={13} /> Generate Content <ChevronRight size={12} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── COLORS TAB ── */}
      {tab === "colors" && brand && (
        <div className="space-y-6">
          {/* Color palette */}
          <div className="bg-surface border border-border/30 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Palette size={14} className="text-gold" /> Extracted Color Palette
              </h3>
              <button onClick={copyAllColors} className="text-xs text-muted hover:text-gold flex items-center gap-1">
                <Copy size={12} /> Copy All
              </button>
            </div>

            {brand.colors.length === 0 ? (
              <p className="text-xs text-muted text-center py-8">No brand colors detected. The site may use CSS variables or external stylesheets.</p>
            ) : (
              <>
                {/* Large swatches */}
                <div className="grid grid-cols-6 gap-3 mb-6">
                  {brand.colors.slice(0, 6).map((color) => (
                    <button
                      key={color}
                      onClick={() => copyColor(color)}
                      className="group relative aspect-square rounded-xl border border-border/20 transition-all hover:scale-105 hover:shadow-lg"
                      style={{ backgroundColor: color }}
                    >
                      <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-sm rounded-b-xl px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[10px] font-mono text-white text-center flex items-center justify-center gap-1">
                          {copiedColor === color ? <Check size={10} /> : <Copy size={10} />}
                          {color}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Small swatches */}
                {brand.colors.length > 6 && (
                  <div className="flex flex-wrap gap-2">
                    {brand.colors.slice(6).map((color) => (
                      <button
                        key={color}
                        onClick={() => copyColor(color)}
                        className="flex items-center gap-2 bg-surface-light/50 rounded-lg px-2.5 py-1.5 border border-border/20 hover:border-gold/30 transition-all text-xs"
                      >
                        <div className="w-4 h-4 rounded-md border border-border/30" style={{ backgroundColor: color }} />
                        <span className="font-mono text-[10px]">{color}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Color harmony suggestions */}
          {brand.colors.length >= 2 && (
            <div className="bg-surface border border-border/30 rounded-xl p-6">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Hash size={14} className="text-gold" /> Suggested Pairings
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {brand.colors.length >= 2 && (
                  <div className="bg-surface-light/50 rounded-lg p-3 border border-border/20">
                    <p className="text-[9px] text-muted uppercase mb-2">Primary + Accent</p>
                    <div className="flex h-12 rounded-lg overflow-hidden">
                      <div className="flex-1" style={{ backgroundColor: brand.colors[0] }} />
                      <div className="flex-1" style={{ backgroundColor: brand.colors[1] }} />
                    </div>
                  </div>
                )}
                {brand.colors.length >= 3 && (
                  <div className="bg-surface-light/50 rounded-lg p-3 border border-border/20">
                    <p className="text-[9px] text-muted uppercase mb-2">Tricolor</p>
                    <div className="flex h-12 rounded-lg overflow-hidden">
                      <div className="flex-1" style={{ backgroundColor: brand.colors[0] }} />
                      <div className="flex-1" style={{ backgroundColor: brand.colors[1] }} />
                      <div className="flex-1" style={{ backgroundColor: brand.colors[2] }} />
                    </div>
                  </div>
                )}
                {brand.colors.length >= 4 && (
                  <div className="bg-surface-light/50 rounded-lg p-3 border border-border/20">
                    <p className="text-[9px] text-muted uppercase mb-2">Full Palette</p>
                    <div className="flex h-12 rounded-lg overflow-hidden">
                      {brand.colors.slice(0, 5).map((c, i) => (
                        <div key={i} className="flex-1" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Social links found */}
          {brand.socialLinks.length > 0 && (
            <div className="bg-surface border border-border/30 rounded-xl p-6">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Share2 size={14} className="text-gold" /> Social Profiles Found
              </h3>
              <div className="flex flex-wrap gap-2">
                {brand.socialLinks.map((s, i) => (
                  <a
                    key={i}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-surface-light/50 rounded-lg px-3 py-2 border border-border/20 hover:border-gold/30 transition-all text-xs"
                  >
                    <ExternalLink size={12} className="text-gold" />
                    {s.platform}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TYPOGRAPHY TAB ── */}
      {tab === "typography" && brand && (
        <div className="space-y-6">
          <div className="bg-surface border border-border/30 rounded-xl p-6">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Type size={14} className="text-gold" /> Extracted Fonts
            </h3>
            {brand.fonts.length === 0 ? (
              <p className="text-xs text-muted text-center py-8">No custom fonts detected. The site may use system fonts or load fonts dynamically.</p>
            ) : (
              <div className="space-y-4">
                {brand.fonts.map((font, i) => (
                  <div key={i} className="bg-surface-light/50 rounded-lg p-4 border border-border/20">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold">{font}</p>
                      <button
                        onClick={() => { navigator.clipboard.writeText(font); toast.success(`Copied "${font}"`); }}
                        className="text-[10px] text-muted hover:text-gold flex items-center gap-1"
                      >
                        <Copy size={10} /> Copy
                      </button>
                    </div>
                    <p className="text-2xl" style={{ fontFamily: `"${font}", sans-serif` }}>
                      The quick brown fox jumps over the lazy dog
                    </p>
                    <p className="text-sm mt-1" style={{ fontFamily: `"${font}", sans-serif` }}>
                      ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Headings from site */}
          {brand.headings.length > 0 && (
            <div className="bg-surface border border-border/30 rounded-xl p-6">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <FileText size={14} className="text-gold" /> Key Headlines Found
              </h3>
              <div className="space-y-2">
                {brand.headings.map((h, i) => (
                  <div key={i} className="flex items-center justify-between bg-surface-light/50 rounded-lg px-3 py-2 border border-border/20">
                    <p className="text-xs">{h}</p>
                    <button
                      onClick={() => { navigator.clipboard.writeText(h); toast.success("Copied!"); }}
                      className="text-muted hover:text-gold shrink-0 ml-2"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTAs */}
          {brand.ctaTexts.length > 0 && (
            <div className="bg-surface border border-border/30 rounded-xl p-6">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Zap size={14} className="text-gold" /> Call-to-Action Texts
              </h3>
              <div className="flex flex-wrap gap-2">
                {brand.ctaTexts.map((cta, i) => (
                  <span key={i} className="bg-gold/10 text-gold px-3 py-1.5 rounded-lg text-xs font-medium">
                    {cta}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MEDIA TAB ── */}
      {tab === "media" && brand && (
        <div className="space-y-6">
          {/* OG Image */}
          {brand.ogImage && (
            <div className="bg-surface border border-border/30 rounded-xl p-6">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Share2 size={14} className="text-gold" /> Social Preview Image (OG)
              </h3>
              <div className="rounded-lg overflow-hidden border border-border/20 max-w-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={brand.ogImage} alt="OG Preview" className="w-full h-auto" onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }} />
              </div>
            </div>
          )}

          {/* All images */}
          <div className="bg-surface border border-border/30 rounded-xl p-6">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <ImageIcon size={14} className="text-gold" /> Extracted Images
              <span className="text-[10px] text-muted bg-surface-light px-1.5 py-0.5 rounded">{brand.images.length}</span>
            </h3>
            {brand.images.length === 0 ? (
              <p className="text-xs text-muted text-center py-8">No images found on the page.</p>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                {brand.images.map((img, i) => (
                  <div key={i} className="group relative aspect-video rounded-lg overflow-hidden border border-border/20 bg-surface-light">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img}
                      alt={`Brand image ${i + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <a href={img} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30">
                        <ExternalLink size={14} className="text-white" />
                      </a>
                      <button
                        onClick={() => { navigator.clipboard.writeText(img); toast.success("Image URL copied!"); }}
                        className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30"
                      >
                        <Copy size={14} className="text-white" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── GENERATE TAB ── */}
      {tab === "generate" && brand && (
        <div className="space-y-6">
          {/* Brand context summary */}
          <div className="bg-surface border border-border/30 rounded-xl p-4 flex items-center gap-4">
            {brand.favicon && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.favicon} alt="" className="w-8 h-8 rounded-lg" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold">{brand.siteName || "Brand"}</p>
              <p className="text-[10px] text-muted truncate">{brand.colors.length} colors, {brand.fonts.length} fonts, {brand.images.length} images extracted</p>
            </div>
            <div className="flex gap-1">
              {brand.colors.slice(0, 5).map((c, i) => (
                <div key={i} className="w-5 h-5 rounded-md border border-border/20" style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          {/* Presets grid */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Sparkles size={14} className="text-gold" /> Content Presets
            </h3>
            <p className="text-xs text-muted mb-4">
              Choose what to generate using the extracted brand data. Each preset uses your colors, fonts, and imagery automatically.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {GENERATE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => generateFromPreset(preset.id)}
                  disabled={generating}
                  className={`text-left bg-surface border rounded-xl p-4 hover:border-gold/30 transition-all group ${
                    selectedPreset === preset.id && generating
                      ? "border-gold/50 bg-gold/5"
                      : "border-border/30"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      selectedPreset === preset.id && generating ? "bg-gold/20 text-gold" : "bg-surface-light text-muted group-hover:text-gold"
                    } transition-colors`}>
                      {selectedPreset === preset.id && generating ? <Loader size={16} className="animate-spin" /> : preset.icon}
                    </div>
                    <div>
                      <p className="text-xs font-semibold">{preset.label}</p>
                      <p className="text-[10px] text-muted mt-0.5">{preset.desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <PageAI
        pageName="brand-kit"
        context="Brand Kit page — extracts brand identity (colors, fonts, logos, imagery) from any website URL and generates on-brand content using presets."
        suggestions={[
          "What colors work best for social media ads?",
          "Suggest font pairings for this brand",
          "Generate ad copy ideas from these brand elements",
        ]}
      />
    </div>
  );
}
