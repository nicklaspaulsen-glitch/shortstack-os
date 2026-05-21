"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Globe, Palette, Type, Image as ImageIcon, Sparkles, Save,
  Loader, Search, Download, Copy, Check, ExternalLink,
  Megaphone, FileText, Film, Mail, MessageSquare,
  Layout, Eye, Share2, Zap,
  ChevronRight, RefreshCw, Link2, Hash,
  ChevronDown, Braces, ClipboardList, FileCode
} from "lucide-react";
import toast from "react-hot-toast";
import PageAI from "@/components/page-ai";
import { PrismPanel, PRISM_RAINBOW_GRADIENT } from "@/components/prism";
import WebsiteScraper from "@/components/ui/website-scraper";
import { useAutoSave } from "@/lib/use-auto-save";
import AutoSaveIndicator from "@/components/ui/auto-save-indicator";
import { MotionPage } from "@/components/motion/motion-page";

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

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
} as const;

const tileVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
} as const;

const rowVariants = {
  hidden: { opacity: 0, x: -18 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
} as const;

export default function BrandKitPage() {
  const [tab, setTab] = useState<MainTab>("extract");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [brand, setBrand] = useState<BrandData | null>(null);
  const [copiedColor, setCopiedColor] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
 // `generating` is retained so the preset cards can flip into a loading state
 // once the /api/brand-generate endpoint lands.
  const [generating, setGenerating] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

 // Restore previously extracted brand from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const rawBrand = localStorage.getItem("ss_brand_kit_data");
      if (rawBrand) {
        const parsed = JSON.parse(rawBrand) as BrandData;
        if (parsed && parsed.siteName !== undefined) {
          setBrand(parsed);
          if (parsed.colors?.length) setTab("colors");
        }
      }
      const rawUrl = localStorage.getItem("ss_brand_kit_url");
      if (rawUrl) setUrl(rawUrl);
    } catch (err) {
      console.warn("Brand kit localStorage restore failed:", err);
    }
  }, []);

 // Auto-save brand kit state to localStorage
  const saveBrandKit = useCallback(async (v: { url: string; brand: BrandData | null }) => {
    if (typeof window === "undefined") return;
    localStorage.setItem("ss_brand_kit_url", v.url);
    if (v.brand) {
      localStorage.setItem("ss_brand_kit_data", JSON.stringify(v.brand));
    }
  }, []);
  const { status: autoSaveStatus, lastSavedAt: autoSaveAt, error: autoSaveError } = useAutoSave({
    value: { url, brand },
    save: saveBrandKit,
    delay: 800,
    skip: (v) => !v.url.trim() && !v.brand,
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    }
    if (showExportMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showExportMenu]);

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
    } catch (err) {
      console.error("Brand scrape failed:", err);
      toast.error("Network error ï¿½ check the URL and try again");
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
 // TODO: Wire to real /api/brand-generate endpoint that renders assets.
 // For now show an honest message instead of a fake-success toast.
    setSelectedPreset(presetId);
    toast("Brand asset generation ships with the next AI update.", { icon: "info" });
  }

  function exportAsJSON() {
    if (!brand) return;
    const kit = {
      name: brand.siteName,
      description: brand.description,
      favicon: brand.favicon,
      ogImage: brand.ogImage,
      colors: brand.colors,
      fonts: brand.fonts,
      images: brand.images,
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
    setShowExportMenu(false);
    toast.success("Brand kit JSON downloaded!");
  }

  function exportCSSVariables() {
    if (!brand) return;
    const lines: string[] = [":root {"];

    brand.colors.forEach((color, i) => {
      const label = i === 0 ? "primary" : i === 1 ? "secondary" : i === 2 ? "accent" : `color-${i + 1}`;
      lines.push(` --brand-${label}: ${color};`);
    });

    if (brand.fonts.length> 0) {
      lines.push(` --brand-font-heading: '${brand.fonts[0]}';`);
    }
    if (brand.fonts.length> 1) {
      lines.push(` --brand-font-body: '${brand.fonts[1]}';`);
    } else if (brand.fonts.length === 1) {
      lines.push(` --brand-font-body: '${brand.fonts[0]}';`);
    }

    lines.push("}");

    const css = `/* Brand Kit ï¿½ ${brand.siteName || "Extracted Brand"} */\n/* Generated ${new Date().toISOString()} */\n\n${lines.join("\n")}\n`;
    const blob = new Blob([css], { type: "text/css" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${brand.siteName.replace(/\s+/g, "-").toLowerCase() || "brand"}-variables.css`;
    a.click();
    URL.revokeObjectURL(a.href);
    setShowExportMenu(false);
    toast.success("CSS variables downloaded!");
  }

  function copyBrandSummary() {
    if (!brand) return;
    const parts: string[] = [];
    parts.push(`BRAND KIT ï¿½ ${brand.siteName || "Unknown"}`);
    parts.push("=".repeat(40));

    if (brand.description) {
      parts.push(`\nDescription: ${brand.description}`);
    }

    if (brand.colors.length> 0) {
      parts.push(`\nColors (${brand.colors.length}):`);
      brand.colors.forEach((c, i) => {
        const label = i === 0 ? "Primary" : i === 1 ? "Secondary" : i === 2 ? "Accent" : `Color ${i + 1}`;
        parts.push(` ${label}: ${c}`);
      });
    }

    if (brand.fonts.length> 0) {
      parts.push(`\nFonts (${brand.fonts.length}):`);
      brand.fonts.forEach((f) => parts.push(` - ${f}`));
    }

    if (brand.headings.length> 0) {
      parts.push(`\nKey Headlines (${brand.headings.length}):`);
      brand.headings.forEach((h) => parts.push(` - ${h}`));
    }

    if (brand.ctaTexts.length> 0) {
      parts.push(`\nCTA Texts (${brand.ctaTexts.length}):`);
      brand.ctaTexts.forEach((cta) => parts.push(` - ${cta}`));
    }

    if (brand.socialLinks.length> 0) {
      parts.push(`\nSocial Links (${brand.socialLinks.length}):`);
      brand.socialLinks.forEach((s) => parts.push(` ${s.platform}: ${s.url}`));
    }

    navigator.clipboard.writeText(parts.join("\n"));
    setShowExportMenu(false);
    toast.success("Brand summary copied to clipboard!");
  }

  const tabs: { key: MainTab; label: string; icon: React.ReactNode; disabled?: boolean }[] = [
    { key: "extract", label: "Extract", icon: <Search size={14} /> },
    { key: "colors", label: "Colors", icon: <Palette size={14} />, disabled: !brand },
    { key: "typography", label: "Typography", icon: <Type size={14} />, disabled: !brand },
    { key: "media", label: "Media", icon: <ImageIcon size={14} />, disabled: !brand },
    { key: "generate", label: "Generate", icon: <Sparkles size={14} />, disabled: !brand },
  ];

  return (
    <MotionPage className="max-w-7xl mx-auto space-y-6"><AutoSaveIndicator status={autoSaveStatus} lastSavedAt={autoSaveAt} error={autoSaveError} />{/* -- Brand Kit command strip -- */}
              <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
                <div className="min-w-0">
                  <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">Visual Identity System</p>
                  <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">Brand Kit</h1>
                </div>
                {brand && (
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="relative" ref={exportMenuRef}>
                      <button
                        onClick={() => setShowExportMenu((v) => !v)}
                        className="px-3 py-1.5 rounded-lg bg-white/5 border border-border-subtle text-text-primary text-xs font-medium hover:bg-white/10 transition-all flex items-center gap-1.5"
>
                        <Download size={13} /> Export Kit
                        <ChevronDown size={12} className={showExportMenu ? "rotate-180 transition-transform" : "transition-transform"} />
                      </button>
                      {showExportMenu && (
                        <div className="absolute right-0 top-full mt-2 w-56 bg-surface border border-border-subtle/30 rounded-xl shadow-2xl z-50 py-1 overflow-hidden">
                          <button onClick={exportAsJSON} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-left hover:bg-[rgba(212,255,0,0.05)] transition-colors">
                            <Braces size={14} className="text-brand-accent shrink-0" />
                            <div><p className="font-medium">Export as JSON</p><p className="text-[10px] text-text-muted">Full brand data file</p></div>
                          </button>
                          <button onClick={copyBrandSummary} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-left hover:bg-[rgba(212,255,0,0.05)] transition-colors">
                            <ClipboardList size={14} className="text-brand-accent shrink-0" />
                            <div><p className="font-medium">Copy Brand Summary</p><p className="text-[10px] text-text-muted">Formatted text to clipboard</p></div>
                          </button>
                          <button onClick={exportCSSVariables} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-left hover:bg-[rgba(212,255,0,0.05)] transition-colors">
                            <FileCode size={14} className="text-brand-accent shrink-0" />
                            <div><p className="font-medium">Export CSS Variables</p><p className="text-[10px] text-text-muted">Colors &amp; fonts as CSS</p></div>
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => { setBrand(null); setUrl(""); setTab("extract"); if (typeof window !== "undefined") { localStorage.removeItem("ss_brand_kit_data"); localStorage.removeItem("ss_brand_kit_url"); } }}
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-border-subtle text-text-primary text-xs font-medium hover:bg-white/10 transition-all flex items-center gap-1.5"
>
                      <RefreshCw size={13} /> New Scan
                    </button>
                  </div>
                )}
              </div>
              {/* Auto-save footer */}{(brand || url.trim()) && (
              <div className="flex items-center justify-between text-[10px] text-text-muted/70 px-1">
                <span className="flex items-center gap-1">
                  <Check size={10} className="text-emerald-400/60" />
                  Brand kit auto-saves locally as you extract
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-text-muted/50">or save manually</span>
                  <button
                    disabled={savingManual}
                    onClick={async () => {
                      setSavingManual(true);
                      try {
                        await saveBrandKit({ url, brand });
                        toast.success("Brand kit saved");
                      } catch (err) {
                        console.error("Manual brand save failed:", err);
                        toast.error("Save failed");
                      }
                      setSavingManual(false);
                    }}
                    className="btn-secondary text-[10px] px-2 py-1 flex items-center gap-1"
>
                    <Save size={10} /> {savingManual ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            )}{/* Tabs */}<div className="flex gap-1 border-b border-border-subtle/30 pb-px">
              {tabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => !t.disabled && setTab(t.key)}
                  disabled={t.disabled}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-all ${
                    tab === t.key
                      ? "text-brand-accent border-b-2 border-brand-accent bg-[rgba(212,255,0,0.05)]"
                      : t.disabled
                        ? "text-text-muted/40 cursor-not-allowed"
                        : "text-text-muted hover:text-text-primary"
                  }`}
>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>{/* -- EXTRACT TAB -- */}{tab === "extract" && (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-6"
>
                {/* URL Input */}
                <motion.div variants={tileVariants} className="glass rounded-xl p-8 text-center space-y-4">
                  <div className="w-16 h-16 mx-auto bg-[rgba(212,255,0,0.08)] flex items-center justify-center mb-4">
                    <Globe size={28} className="text-brand-accent" />
                  </div>
                  <h2 className="text-lg font-bold">Extract Brand Identity</h2>
                  <p className="text-xs text-text-muted max-w-md mx-auto">
                    Enter a website URL and we&apos;ll analyze it to extract brand colors, fonts, logos, imagery, and social profiles.
                    Use this data to generate on-brand content instantly.
                  </p>
                  <div className="max-w-lg mx-auto flex gap-2">
                    <div className="relative flex-1">
                      <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                      <input
                        type="url"
                        placeholder="https://example.com"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && scrapeBrand()}
                        className="rounded-lg w-full pl-9 py-2.5 text-sm bg-transparent focus:outline-none focus:ring-1 focus:ring-brand-accent/40 placeholder:text-text-muted" style={{ border: "1px solid rgba(212,255,0,0.12)" }}
                        disabled={loading}
 />
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={scrapeBrand}
                      disabled={loading}
                      className="btn-primary px-6 py-2.5 text-sm flex items-center gap-2"
>
                      {loading ? <Loader size={14} className="animate-spin" /> : <Zap size={14} />}
                      {loading ? "Scanning..." : "Extract"}
                    </motion.button>
                  </div>
                </motion.div>

                {/* Optional business + brand analyzer (AI-augmented website extraction) */}
                <motion.div variants={tileVariants}>
                  <WebsiteScraper
                    ctaLabel="Pull brand colors + logo"
                    onExtract={(r) => {
                      if (!url && r.url) setUrl(r.url);
                      const colors = r.extracted.primaryColor ? [r.extracted.primaryColor] : [];
                      const socials = r.extracted.socialLinks.map((s) => ({ platform: s.platform, url: s.url }));
                      setBrand({
                        siteName: r.extracted.businessName || "Unknown Site",
                        description: r.extracted.description || "",
                        favicon: r.extracted.logo || "",
                        ogImage: r.extracted.ogImage || "",
                        colors,
                        fonts: [],
                        images: r.extracted.ogImage ? [r.extracted.ogImage] : [],
                        socialLinks: socials,
                        headings: r.extracted.keywords.slice(0, 8),
                        ctaTexts: r.ai?.services || [],
                      });
                      toast.success("Brand profile populated from website");
                      setTab("colors");
                    }}
 />
                </motion.div>

                {/* How it works */}
                <motion.div variants={containerVariants} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { icon: <Globe size={18} />, title: "1. Paste URL", desc: "Enter any website address" },
                    { icon: <Eye size={18} />, title: "2. We Analyze", desc: "Colors, fonts, images, socials" },
                    { icon: <Palette size={18} />, title: "3. Brand Kit", desc: "Complete brand profile ready" },
                    { icon: <Sparkles size={18} />, title: "4. Generate", desc: "Create on-brand content" },
                  ].map((step, i) => (
                    <motion.div key={i} variants={tileVariants} whileHover={{ y: -2 }} className="glass rounded-xl p-4 text-center relative overflow-hidden spotlight-card" onMouseMove={(e) => { const rect = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`); e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`); }}>
                      <div style={{ height: 3, background: PRISM_RAINBOW_GRADIENT }} className="absolute top-0 inset-x-0" />
                      <div className="w-10 h-10 mx-auto bg-[rgba(212,255,0,0.08)] rounded-lg flex items-center justify-center text-brand-accent mb-2 mt-1">
                        {step.icon}
                      </div>
                      <p className="text-xs font-semibold">{step.title}</p>
                      <p className="text-[10px] text-text-muted mt-0.5">{step.desc}</p>
                    </motion.div>
                  ))}
                </motion.div>

                {/* Brand overview (after scan) */}
                {brand && (
                  <motion.div variants={tileVariants} className="glass rounded-xl p-6 space-y-4">
                    <div className="flex items-center gap-4">
                      {brand.favicon && (
 // eslint-disable-next-line @next/next/no-img-element
                        <img src={brand.favicon} alt="Favicon" className="w-10 h-10 rounded-lg bg-surface-light border border-border-subtle/20" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      )}
                      <div>
                        <h3 className="font-bold text-sm">{brand.siteName || "Unknown Site"}</h3>
                        <p className="text-[10px] text-text-muted">{brand.description || "No description found"}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-[4fr_2fr_2fr_2fr] gap-3 mb-4">
                      {/* Focal tile */}
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, delay: 0.04 }}
                        className="flex items-start gap-3 glass rounded-2xl p-5"
                      >
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Colors</p>
                          <p className="font-display text-3xl font-bold tracking-[-0.03em] text-text-primary tabular-nums">{brand.colors.length}</p>
                        </div>
                      </motion.div>
                      {/* Support: Fonts */}
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, delay: 0.10 }}
                        className="glass rounded-2xl p-5"
                      >
                        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Fonts</p>
                        <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">{brand.fonts.length}</p>
                      </motion.div>
                      {/* Support: Images */}
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, delay: 0.14 }}
                        className="glass rounded-2xl p-5"
                      >
                        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Images</p>
                        <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">{brand.images.length}</p>
                      </motion.div>
                      {/* Support: Socials */}
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, delay: 0.18 }}
                        className="glass rounded-2xl p-5"
                      >
                        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Socials</p>
                        <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">{brand.socialLinks.length}</p>
                      </motion.div>
                    </div>

                    <div className="flex items-center gap-2">
                      <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setTab("colors")} className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5">
                        <Palette size={13} /> View Colors <ChevronRight size={12} />
                      </motion.button>
                      <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setTab("generate")} className="btn-secondary text-xs px-4 py-2 flex items-center gap-1.5">
                        <Sparkles size={13} /> Generate Content <ChevronRight size={12} />
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}{/* -- COLORS TAB -- */}{tab === "colors" && brand && (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-6"
>
                {/* Color palette */}
                <motion.div variants={tileVariants} className="glass rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Palette size={14} className="text-brand-accent" /> Extracted Color Palette
                    </h3>
                    <motion.button whileHover={{ scale: 1.05 }} onClick={copyAllColors} className="text-xs text-text-muted hover:text-brand-accent flex items-center gap-1">
                      <Copy size={12} /> Copy All
                    </motion.button>
                  </div>

                  {brand.colors.length === 0 ? (
                    <p className="text-xs text-text-muted text-center py-8">No brand colors detected. The site may use CSS variables or external stylesheets.</p>
                  ) : (
                    <>
                      {/* Large swatches */}
                      <motion.div variants={containerVariants} className="grid grid-cols-6 gap-3 mb-6">
                        {brand.colors.slice(0, 6).map((color) => (
                          <motion.button
                            key={color}
                            variants={tileVariants}
                            whileHover={{ scale: 1.07 }}
                            onClick={() => copyColor(color)}
                            className="group relative aspect-square rounded-xl border border-border-subtle/20 transition-all hover:shadow-lg"
                            style={{ backgroundColor: color }}
>
                            <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-sm rounded-b-xl px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <p className="text-[10px] font-mono text-white text-center flex items-center justify-center gap-1">
                                {copiedColor === color ? <Check size={10} /> : <Copy size={10} />}
                                {color}
                              </p>
                            </div>
                          </motion.button>
                        ))}
                      </motion.div>

                      {/* Small swatches */}
                      {brand.colors.length> 6 && (
                        <motion.div variants={containerVariants} className="flex flex-wrap gap-2">
                          {brand.colors.slice(6).map((color) => (
                            <motion.button
                              key={color}
                              variants={rowVariants}
                              whileHover={{ x: 2 }}
                              onClick={() => copyColor(color)}
                              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:border-[rgba(212,255,0,0.25)] transition-all text-xs" style={{ background: "rgba(255,255,255,0.88)", border: "1px solid rgba(0,0,0,0.10)" }}
>
                              <div className="w-4 h-4 rounded-md border border-border-subtle/30" style={{ backgroundColor: color }} />
                              <span className="font-mono text-[10px]">{color}</span>
                            </motion.button>
                          ))}
                        </motion.div>
                      )}
                    </>
                  )}
                </motion.div>

                {/* Color harmony suggestions */}
                {brand.colors.length>= 2 && (
                  <motion.div variants={tileVariants} className="glass rounded-xl p-6">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Hash size={14} className="text-brand-accent" /> Suggested Pairings
                    </h3>
                    <motion.div variants={containerVariants} className="grid grid-cols-3 gap-3">
                      {brand.colors.length>= 2 && (
                        <motion.div variants={tileVariants} className="glass rounded-lg p-3">
                          <p className="text-[9px] text-text-muted uppercase mb-2">Primary + Accent</p>
                          <div className="flex h-12 rounded-lg overflow-hidden">
                            <div className="flex-1" style={{ backgroundColor: brand.colors[0] }} />
                            <div className="flex-1" style={{ backgroundColor: brand.colors[1] }} />
                          </div>
                        </motion.div>
                      )}
                      {brand.colors.length>= 3 && (
                        <motion.div variants={tileVariants} className="glass rounded-lg p-3">
                          <p className="text-[9px] text-text-muted uppercase mb-2">Tricolor</p>
                          <div className="flex h-12 rounded-lg overflow-hidden">
                            <div className="flex-1" style={{ backgroundColor: brand.colors[0] }} />
                            <div className="flex-1" style={{ backgroundColor: brand.colors[1] }} />
                            <div className="flex-1" style={{ backgroundColor: brand.colors[2] }} />
                          </div>
                        </motion.div>
                      )}
                      {brand.colors.length>= 4 && (
                        <motion.div variants={tileVariants} className="glass rounded-lg p-3">
                          <p className="text-[9px] text-text-muted uppercase mb-2">Full Palette</p>
                          <div className="flex h-12 rounded-lg overflow-hidden">
                            {brand.colors.slice(0, 5).map((c, i) => (
                              <div key={i} className="flex-1" style={{ backgroundColor: c }} />
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  </motion.div>
                )}

                {/* Social links found */}
                {brand.socialLinks.length> 0 && (
                  <motion.div variants={tileVariants} className="glass rounded-xl p-6">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Share2 size={14} className="text-brand-accent" /> Social Profiles Found
                    </h3>
                    <motion.div variants={containerVariants} className="flex flex-wrap gap-2">
                      {brand.socialLinks.map((s, i) => (
                        <motion.a
                          key={i}
                          variants={rowVariants}
                          whileHover={{ x: 2 }}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 rounded-lg px-3 py-2 hover:border-[rgba(212,255,0,0.25)] transition-all text-xs" style={{ background: "rgba(255,255,255,0.88)", border: "1px solid rgba(0,0,0,0.10)" }}
>
                          <ExternalLink size={12} className="text-brand-accent" />
                          {s.platform}
                        </motion.a>
                      ))}
                    </motion.div>
                  </motion.div>
                )}
              </motion.div>
            )}{/* -- TYPOGRAPHY TAB -- */}{tab === "typography" && brand && (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-6"
>
                <motion.div variants={tileVariants} className="glass rounded-xl p-6">
                  <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                    <Type size={14} className="text-brand-accent" /> Extracted Fonts
                  </h3>
                  {brand.fonts.length === 0 ? (
                    <p className="text-xs text-text-muted text-center py-8">No custom fonts detected. The site may use system fonts or load fonts dynamically.</p>
                  ) : (
                    <motion.div variants={containerVariants} className="space-y-4">
                      {brand.fonts.map((font, i) => (
                        <motion.div key={i} variants={tileVariants} whileHover={{ y: -1 }} className="glass rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold">{font}</p>
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              onClick={() => { navigator.clipboard.writeText(font); toast.success(`Copied "${font}"`); }}
                              className="text-[10px] text-text-muted hover:text-brand-accent flex items-center gap-1"
>
                              <Copy size={10} /> Copy
                            </motion.button>
                          </div>
                          <p className="text-2xl" style={{ fontFamily: `"${font}", sans-serif` }}>
                            The quick brown fox jumps over the lazy dog
                          </p>
                          <p className="text-sm mt-1" style={{ fontFamily: `"${font}", sans-serif` }}>
                            ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789
                          </p>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </motion.div>

                {/* Headings from site */}
                {brand.headings.length> 0 && (
                  <motion.div variants={tileVariants} className="glass rounded-xl p-6">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <FileText size={14} className="text-brand-accent" /> Key Headlines Found
                    </h3>
                    <motion.div variants={containerVariants} className="space-y-2">
                      {brand.headings.map((h, i) => (
                        <motion.div
                          key={i}
                          variants={rowVariants}
                          whileHover={{ x: 4, backgroundColor: "rgba(0,0,0,0.03)" }}
                          className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.88)", border: "1px solid rgba(0,0,0,0.10)" }}
>
                          <p className="text-xs">{h}</p>
                          <button
                            onClick={() => { navigator.clipboard.writeText(h); toast.success("Copied!"); }}
                            className="text-text-muted hover:text-brand-accent shrink-0 ml-2"
>
                            <Copy size={12} />
                          </button>
                        </motion.div>
                      ))}
                    </motion.div>
                  </motion.div>
                )}

                {/* CTAs */}
                {brand.ctaTexts.length> 0 && (
                  <motion.div variants={tileVariants} className="glass rounded-xl p-6">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Zap size={14} className="text-brand-accent" /> Call-to-Action Texts
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {brand.ctaTexts.map((cta, i) => (
                        <span key={i} className="bg-[rgba(212,255,0,0.08)] text-brand-accent border border-[rgba(212,255,0,0.20)] px-3 py-1.5 rounded-lg text-xs font-medium">
                          {cta}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}{/* -- MEDIA TAB -- */}{tab === "media" && brand && (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-6"
>
                {/* OG Image */}
                {brand.ogImage && (
                  <motion.div variants={tileVariants} className="glass rounded-xl p-6">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Share2 size={14} className="text-brand-accent" /> Social Preview Image (OG)
                    </h3>
                    <div className="rounded-lg overflow-hidden border border-border-subtle/20 max-w-2xl">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={brand.ogImage} alt="OG Preview" className="w-full h-auto" onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }} />
                    </div>
                  </motion.div>
                )}

                {/* All images */}
                <motion.div variants={tileVariants} className="glass rounded-xl p-6">
                  <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                    <ImageIcon size={14} className="text-brand-accent" /> Extracted Images
                    <span className="text-[10px] text-text-muted bg-white/5 px-1.5 py-0.5 rounded">{brand.images.length}</span>
                  </h3>
                  {brand.images.length === 0 ? (
                    <p className="text-xs text-text-muted text-center py-8">No images found on the page.</p>
                  ) : (
                    <motion.div variants={containerVariants} className="grid grid-cols-4 gap-3">
                      {brand.images.map((img, i) => (
                        <motion.div
                          key={i}
                          variants={tileVariants}
                          whileHover={{ y: -2 }}
                          className="group relative aspect-video rounded-lg overflow-hidden border border-border-subtle/20 bg-surface-light"
>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img}
                            alt={`Brand image ${i + 1}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
 />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <a href={img} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-white/10 rounded-lg hover:bg-white/15">
                              <ExternalLink size={14} className="text-white" />
                            </a>
                            <button
                              onClick={() => { navigator.clipboard.writeText(img); toast.success("Image URL copied!"); }}
                              className="p-1.5 bg-white/10 rounded-lg hover:bg-white/15"
>
                              <Copy size={14} className="text-white" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              </motion.div>
            )}{/* -- GENERATE TAB -- */}{tab === "generate" && brand && (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-6"
>
                {/* Brand context summary */}
                <motion.div variants={tileVariants} className="glass rounded-xl p-4 flex items-center gap-4">
                  {brand.favicon && (
 // eslint-disable-next-line @next/next/no-img-element
                    <img src={brand.favicon} alt="" className="w-8 h-8 rounded-lg" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold">{brand.siteName || "Brand"}</p>
                    <p className="text-[10px] text-text-muted truncate">{brand.colors.length} colors, {brand.fonts.length} fonts, {brand.images.length} images extracted</p>
                  </div>
                  <div className="flex gap-1">
                    {brand.colors.slice(0, 5).map((c, i) => (
                      <div key={i} className="w-5 h-5 rounded-md border border-border-subtle/20" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </motion.div>

                {/* Presets grid */}
                <motion.div variants={tileVariants}>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Sparkles size={14} className="text-brand-accent" /> Content Presets
                  </h3>
                  <p className="text-xs text-text-muted mb-4">
                    Choose what to generate using the extracted brand data. Each preset uses your colors, fonts, and imagery automatically.
                  </p>
                  <motion.div variants={containerVariants} className="grid grid-cols-2 gap-3">
                    {GENERATE_PRESETS.map((preset) => (
                      <motion.button
                        key={preset.id}
                        variants={tileVariants}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => generateFromPreset(preset.id)}
                        disabled={generating}
                        
                        className={`text-left rounded-xl p-4 hover:border-[rgba(212,255,0,0.25)] transition-all group ${
                          selectedPreset === preset.id && generating
                            ? "border-[rgba(212,255,0,0.40)] bg-[rgba(212,255,0,0.05)]"
                            : ""
                        }`}
>
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${
                            selectedPreset === preset.id && generating
                              ? "bg-[rgba(212,255,0,0.12)] text-brand-accent"
                              : "bg-white/5 text-text-muted group-hover:text-brand-accent"
                          } transition-colors`}>
                            {selectedPreset === preset.id && generating ? <Loader size={16} className="animate-spin" /> : preset.icon}
                          </div>
                          <div>
                            <p className="text-xs font-semibold">{preset.label}</p>
                            <p className="text-[10px] text-text-muted mt-0.5">{preset.desc}</p>
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </motion.div>
                </motion.div>
              </motion.div>
            )}<PageAI
              pageName="brand-kit"
              context="Brand Kit page ï¿½ extracts brand identity (colors, fonts, logos, imagery) from any website URL and generates on-brand content using presets."
              suggestions={[
                "What colors work best for social media ads?",
                "Suggest font pairings for this brand",
                "Generate ad copy ideas from these brand elements",
              ]}
 /></MotionPage>
  );
}


