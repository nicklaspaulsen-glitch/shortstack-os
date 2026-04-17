"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  Globe, Sparkles, Loader, ExternalLink, Copy,
  Code, Zap, Eye, Mail, CheckCircle, Wand2,
  Palette, Layout, Search, BarChart3, Smartphone,
  Monitor, Tablet, FileText, RefreshCw, Layers,
  Shield, Link, Image as ImageIcon, Settings, AlertTriangle,
  Clock, Plus, Trash2, Edit3, MapPin, Hash,
  PenTool, Gauge, BookOpen,
} from "lucide-react";
import toast from "react-hot-toast";

const STYLES = [
  { id: "modern-dark", name: "Modern Dark", desc: "Dark bg, clean typography, gold accents", preview: "bg-gray-900" },
  { id: "clean-white", name: "Clean White", desc: "Light, minimal, professional", preview: "bg-white" },
  { id: "bold-gradient", name: "Bold Gradient", desc: "Gradient backgrounds, bold fonts", preview: "bg-gradient-to-r from-purple-500 to-pink-500" },
  { id: "corporate", name: "Corporate", desc: "Traditional, trust-focused, blue tones", preview: "bg-blue-900" },
  { id: "startup", name: "Startup", desc: "Modern, vibrant, tech-forward", preview: "bg-indigo-600" },
  { id: "luxury", name: "Luxury", desc: "Elegant, gold accents, premium feel", preview: "bg-black" },
  { id: "restaurant", name: "Restaurant", desc: "Warm, appetizing, inviting atmosphere", preview: "bg-amber-800" },
  { id: "portfolio", name: "Portfolio", desc: "Creative, showcase-focused, gallery", preview: "bg-gray-800" },
  { id: "saas", name: "SaaS Landing", desc: "Conversion-focused, feature grids", preview: "bg-slate-900" },
  { id: "ecommerce", name: "E-commerce", desc: "Product-focused, shop layout", preview: "bg-white" },
];

const ALL_SECTIONS = [
  "Hero", "Services", "About", "Testimonials", "Pricing", "Contact",
  "FAQ", "Gallery", "Team", "Blog", "Features", "How It Works",
  "Case Studies", "Stats/Numbers", "CTA Banner", "Newsletter",
];

const PAGE_TYPES = [
  { id: "landing", name: "Landing Page", desc: "Single page, conversion focused", icon: <Zap size={14} /> },
  { id: "full_site", name: "Full Website", desc: "Multi-section business site", icon: <Globe size={14} /> },
  { id: "portfolio", name: "Portfolio", desc: "Creative work showcase", icon: <Layout size={14} /> },
  { id: "coming_soon", name: "Coming Soon", desc: "Pre-launch with email capture", icon: <Mail size={14} /> },
];

const SEO_TIPS = [
  { title: "Title Tag", desc: "Include business name + primary service + location" },
  { title: "Meta Description", desc: "150-160 chars, include CTA and unique value prop" },
  { title: "H1 Tag", desc: "One per page, matches search intent" },
  { title: "Image Alt Tags", desc: "Descriptive text for all images" },
  { title: "Page Speed", desc: "Optimize images, minimize CSS/JS" },
  { title: "Mobile First", desc: "Responsive design is mandatory for ranking" },
];

export default function WebsitesPage() {
  useAuth();
  const [clients, setClients] = useState<Array<{ id: string; business_name: string; industry: string }>>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [generating, setGenerating] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [deployUrl, setDeployUrl] = useState("");
  const [tab, setTab] = useState<"build" | "preview" | "deploy" | "seo" | "demos" | "pages" | "domains" | "analytics" | "blog">("build");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const supabase = createClient();

  const [proBuilderPrompt, setProBuilderPrompt] = useState("");
  const [proBuilderLoading, setProBuilderLoading] = useState(false);
  const [demos, setDemos] = useState<Array<{ id: string; business_name: string; url: string; status: string; created_at: string; client_id: string | null }>>([]);

  // Page manager state
  // TODO: fetch from API
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [pages] = useState<Array<{ id: string; name: string; slug: string; status: "published" | "draft"; lastEdited: string }>>([]);

  // Domain manager state
  // TODO: fetch from API
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [domains] = useState<Array<{ domain: string; type: "vercel" | "custom"; ssl: boolean; primary: boolean }>>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [newDomain, setNewDomain] = useState("");

  // Analytics state
  // TODO: fetch from API
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [siteAnalytics] = useState<{
    visitors: number; pageViews: number; bounceRate: number; avgDuration: string;
    speedScore: number; mobileScore: number; seoScore: number; accessibilityScore: number;
    topPages: Array<{ page: string; views: number }>;
  }>({
    visitors: 0, pageViews: 0, bounceRate: 0, avgDuration: "0s",
    speedScore: 0, mobileScore: 0, seoScore: 0, accessibilityScore: 0,
    topPages: [],
  });

  // Blog manager state
  // TODO: fetch from API
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [blogPosts] = useState<Array<{ id: string; title: string; status: "published" | "draft" | "scheduled"; date: string; views: number }>>([]);

  // Form embed state
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [formEmbedType, setFormEmbedType] = useState<"contact" | "newsletter" | "booking" | "custom">("contact");

  // Sitemap/meta state
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [faviconUrl, setFaviconUrl] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [ogImageUrl, setOgImageUrl] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [sitemapEnabled, setSitemapEnabled] = useState(true);

  const [config, setConfig] = useState({
    business_name: "",
    industry: "",
    style: "modern-dark",
    description: "",
    color_scheme: "dark with gold accents (#C9A84C)",
    sections: ["Hero", "Services", "About", "Testimonials", "Contact"],
    page_type: "full_site",
    custom_colors: { primary: "#C9A84C", secondary: "#1a1a1a", accent: "#ffffff" },
    include_seo: true,
    include_analytics: false,
    cta_text: "",
    phone: "",
    email_address: "",
    address: "",
  });

  useEffect(() => {
    supabase.from("clients").select("id, business_name, industry").eq("is_active", true).then(({ data }: { data: { id: string; business_name: string; industry: string }[] | null }) => {
      setClients(data || []);
    });
    fetchDemos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchDemos() {
    const { data } = await supabase
      .from("trinity_log")
      .select("id, description, result, status, created_at, client_id")
      .eq("action_type", "website_deploy")
      .order("created_at", { ascending: false })
      .limit(20);
    setDemos((data || []).map((d: Record<string, unknown>) => ({
      id: d.id as string,
      business_name: d.description as string,
      url: ((d.result as Record<string, string>)?.url) || "",
      status: d.status as string,
      created_at: d.created_at as string,
      client_id: d.client_id as string | null,
    })));
  }

  async function generateDemoSite() {
    if (!config.business_name) { toast.error("Enter a business name"); return; }
    setGenerating(true);
    toast.loading("Generating demo site...");
    try {
      const res = await fetch("/api/websites/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: selectedClient || null,
          business_name: config.business_name,
          industry: config.industry,
          description: config.description,
          services: config.sections,
          demo: true,
          page_type: config.page_type,
          style: config.style,
          custom_colors: config.custom_colors,
          include_seo: config.include_seo,
          cta_text: config.cta_text,
          phone: config.phone,
          email_address: config.email_address,
          address: config.address,
        }),
      });
      const genData = await res.json();
      const html = genData.pages?.[0]?.html || genData.html;
      if (!html) { toast.dismiss(); toast.error("Generation failed"); setGenerating(false); return; }

      const safeName = config.business_name.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-demo";
      const deployRes = await fetch("/api/websites/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, project_name: safeName, client_id: selectedClient || null }),
      });
      toast.dismiss();
      const deployData = await deployRes.json();
      if (deployData.url) {
        setDeployUrl(deployData.url);
        setGeneratedHtml(html);
        await supabase.from("trinity_log").insert({
          action_type: "website_deploy",
          description: config.business_name,
          client_id: selectedClient || null,
          status: "demo",
          result: { url: deployData.url, style: config.style },
        });
        fetchDemos();
        setTab("deploy");
        toast.success("Demo site live!");
      } else {
        setGeneratedHtml(html);
        setTab("preview");
        toast.success("Website generated! Add VERCEL_TOKEN to auto-deploy.");
      }
    } catch { toast.dismiss(); toast.error("Error"); }
    setGenerating(false);
  }

  function selectClient(id: string) {
    setSelectedClient(id);
    const client = clients.find(c => c.id === id);
    if (client) {
      setConfig(prev => ({ ...prev, business_name: client.business_name, industry: client.industry || "" }));
    }
  }

  async function generateWebsite() {
    if (!config.business_name) { toast.error("Enter a business name"); return; }
    setGenerating(true);
    toast.loading("AI is building the website...");

    try {
      const res = await fetch("/api/websites/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: selectedClient || null,
          business_name: config.business_name,
          industry: config.industry,
          description: config.description,
          services: config.sections,
          page_type: config.page_type,
          style: config.style,
          custom_colors: config.custom_colors,
          include_seo: config.include_seo,
          cta_text: config.cta_text,
          phone: config.phone,
          email_address: config.email_address,
          address: config.address,
        }),
      });
      toast.dismiss();
      const data = await res.json();

      if (data.success && data.pages) {
        const mainPage = data.pages.find((p: { name: string; html: string }) => p.name === "index" || p.name === "Home") || data.pages[0];
        if (mainPage) {
          setGeneratedHtml(mainPage.html);
          setTab("preview");
          toast.success("Website generated!");
        }
      } else if (data.html) {
        setGeneratedHtml(data.html);
        setTab("preview");
        toast.success("Website generated!");
      } else {
        toast.error(data.error || "Failed to generate");
      }
    } catch {
      toast.dismiss();
      toast.error("Error generating website");
    }
    setGenerating(false);
  }

  async function buildProSite() {
    if (!config.business_name) { toast.error("Enter a business name"); return; }
    setProBuilderLoading(true);
    try {
      const res = await fetch("/api/lovable/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: config.business_name,
          industry: config.industry,
          description: config.description,
          style: config.style,
          sections: config.sections,
          page_type: config.page_type,
          custom_colors: config.custom_colors,
        }),
      });
      const data = await res.json();
      if (data.lovable_prompt || data.prompt) {
        setProBuilderPrompt(data.lovable_prompt || data.prompt);
        toast.success("Pro site prompt generated!");
      } else {
        toast.error(data.error || "Failed to generate prompt");
      }
    } catch {
      toast.error("Error generating prompt");
    }
    setProBuilderLoading(false);
  }

  async function deployWebsite() {
    if (!generatedHtml) { toast.error("Generate a website first"); return; }
    setDeploying(true);
    toast.loading("Deploying to Vercel...");

    try {
      const safeName = config.business_name.toLowerCase().replace(/[^a-z0-9]/g, "-");
      const res = await fetch("/api/websites/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: generatedHtml,
          project_name: safeName,
          client_id: selectedClient || null,
        }),
      });
      toast.dismiss();
      const data = await res.json();

      if (data.success && data.url) {
        setDeployUrl(data.url);
        setTab("deploy");
        toast.success("Website deployed!");
      } else if (data.preview_only) {
        toast.success("Preview ready! Add VERCEL_TOKEN to deploy live.");
        setTab("preview");
      } else {
        toast.error(data.error || "Deployment failed");
      }
    } catch {
      toast.dismiss();
      toast.error("Deployment error");
    }
    setDeploying(false);
  }

  const toggleSection = (s: string) => {
    setConfig(prev => ({
      ...prev,
      sections: prev.sections.includes(s) ? prev.sections.filter(x => x !== s) : [...prev.sections, s],
    }));
  };

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
            <Globe size={20} className="text-gold" />
          </div>
          <div>
            <h1 className="page-header mb-0">Website Builder</h1>
            <p className="text-xs text-muted">AI builds full websites — deploy as demo, go live with custom domain</p>
          </div>
        </div>
        <select value={selectedClient} onChange={e => selectClient(e.target.value)} className="input text-xs py-1.5 min-w-[160px]">
          <option value="">No client</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.business_name}</option>)}
        </select>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border pb-0">
        {([
          { id: "build" as const, label: "Build", icon: Wand2 },
          { id: "preview" as const, label: "Preview", icon: Eye },
          { id: "pages" as const, label: "Pages", icon: FileText },
          { id: "deploy" as const, label: "Deploy", icon: Globe },
          { id: "domains" as const, label: "Domains", icon: Link },
          { id: "seo" as const, label: "SEO", icon: Search },
          { id: "analytics" as const, label: "Analytics", icon: BarChart3 },
          { id: "blog" as const, label: "Blog", icon: BookOpen },
          { id: "demos" as const, label: `Demos (${demos.length})`, icon: Layers },
        ]).map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); if (t.id === "demos") fetchDemos(); }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors whitespace-nowrap ${
              tab === t.id
                ? "bg-surface-light text-gold border border-border border-b-transparent -mb-px"
                : "text-muted hover:text-foreground"
            }`}>
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </div>

      {/* Build Tab */}
      {tab === "build" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {/* Page type */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2"><Layout size={13} className="text-gold" /> Page Type</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {PAGE_TYPES.map(pt => (
                  <button key={pt.id} onClick={() => setConfig({ ...config, page_type: pt.id })}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all ${
                      config.page_type === pt.id ? "border-gold/30 bg-gold/[0.05]" : "border-border"
                    }`}>
                    <span className={config.page_type === pt.id ? "text-gold" : "text-muted"}>{pt.icon}</span>
                    <div>
                      <p className="text-[10px] font-semibold">{pt.name}</p>
                      <p className="text-[8px] text-muted">{pt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Website Details */}
            <div className="card space-y-3">
              <h2 className="section-header">Website Details</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Business Name *</label>
                  <input value={config.business_name} onChange={e => setConfig({ ...config, business_name: e.target.value })}
                    className="input w-full text-xs" placeholder="e.g., Bright Smile Dental" />
                </div>
                <div>
                  <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Industry</label>
                  <input value={config.industry} onChange={e => setConfig({ ...config, industry: e.target.value })}
                    className="input w-full text-xs" placeholder="e.g., Dental, HVAC, Legal" />
                </div>
              </div>
              <div>
                <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Business Description</label>
                <textarea value={config.description} onChange={e => setConfig({ ...config, description: e.target.value })}
                  className="input w-full h-14 text-xs" placeholder="What does this business do? What makes them unique?" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Phone</label>
                  <input value={config.phone} onChange={e => setConfig({ ...config, phone: e.target.value })}
                    className="input w-full text-xs" placeholder="(555) 123-4567" />
                </div>
                <div>
                  <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Email</label>
                  <input value={config.email_address} onChange={e => setConfig({ ...config, email_address: e.target.value })}
                    className="input w-full text-xs" placeholder="info@business.com" />
                </div>
                <div>
                  <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">CTA Button Text</label>
                  <input value={config.cta_text} onChange={e => setConfig({ ...config, cta_text: e.target.value })}
                    className="input w-full text-xs" placeholder="Book Now / Get Quote" />
                </div>
              </div>
            </div>

            {/* Style */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2"><Palette size={13} className="text-gold" /> Style</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {STYLES.map(s => (
                  <button key={s.id} onClick={() => setConfig({ ...config, style: s.id })}
                    className={`p-2 rounded-xl border text-left transition-all ${config.style === s.id ? "border-gold/30 bg-gold/[0.05]" : "border-border"}`}>
                    <div className={`w-full h-4 rounded-md mb-1.5 ${s.preview} border border-border`} />
                    <p className="text-[10px] font-semibold">{s.name}</p>
                    <p className="text-[8px] text-muted leading-tight">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Colors */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2"><Wand2 size={13} className="text-gold" /> Brand Colors</h2>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-[9px] text-muted">Primary</label>
                  <input type="color" value={config.custom_colors.primary}
                    onChange={e => setConfig({ ...config, custom_colors: { ...config.custom_colors, primary: e.target.value } })}
                    className="w-8 h-8 rounded-lg border border-border cursor-pointer" />
                  <span className="text-[9px] text-muted font-mono">{config.custom_colors.primary}</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[9px] text-muted">Secondary</label>
                  <input type="color" value={config.custom_colors.secondary}
                    onChange={e => setConfig({ ...config, custom_colors: { ...config.custom_colors, secondary: e.target.value } })}
                    className="w-8 h-8 rounded-lg border border-border cursor-pointer" />
                  <span className="text-[9px] text-muted font-mono">{config.custom_colors.secondary}</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[9px] text-muted">Accent</label>
                  <input type="color" value={config.custom_colors.accent}
                    onChange={e => setConfig({ ...config, custom_colors: { ...config.custom_colors, accent: e.target.value } })}
                    className="w-8 h-8 rounded-lg border border-border cursor-pointer" />
                  <span className="text-[9px] text-muted font-mono">{config.custom_colors.accent}</span>
                </div>
              </div>
            </div>

            {/* Sections */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2"><Layers size={13} className="text-gold" /> Sections</h2>
              <div className="flex flex-wrap gap-1.5">
                {ALL_SECTIONS.map(s => (
                  <button key={s} onClick={() => toggleSection(s)}
                    className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${config.sections.includes(s) ? "border-gold/30 bg-gold/[0.05] text-gold" : "border-border text-muted hover:text-foreground"}`}>
                    {s}
                  </button>
                ))}
              </div>
              <p className="text-[8px] text-muted mt-2">{config.sections.length} sections selected</p>
            </div>

            {/* AI Options */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2"><Sparkles size={13} className="text-gold" /> AI Options</h2>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-[10px] text-muted cursor-pointer">
                  <input type="checkbox" checked={config.include_seo}
                    onChange={e => setConfig({ ...config, include_seo: e.target.checked })}
                    className="rounded border-border text-gold focus:ring-gold/30" />
                  <Search size={11} /> SEO Optimized
                </label>
                <label className="flex items-center gap-2 text-[10px] text-muted cursor-pointer">
                  <input type="checkbox" checked={config.include_analytics}
                    onChange={e => setConfig({ ...config, include_analytics: e.target.checked })}
                    className="rounded border-border text-gold focus:ring-gold/30" />
                  <BarChart3 size={11} /> Analytics Ready
                </label>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button onClick={generateDemoSite} disabled={generating || !config.business_name}
                className="flex-1 text-xs py-2.5 flex items-center justify-center gap-2 disabled:opacity-50 rounded-xl border border-success/30 bg-success/[0.08] text-success hover:bg-success/[0.15] transition-all font-semibold">
                {generating ? <Loader size={14} className="animate-spin" /> : <Eye size={14} />}
                {generating ? "Building..." : "One-Click Demo"}
              </button>
              <button onClick={generateWebsite} disabled={generating || !config.business_name}
                className="btn-primary flex-1 text-xs py-2.5 flex items-center justify-center gap-2 disabled:opacity-50">
                {generating ? <Loader size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {generating ? "Building..." : "Generate with AI"}
              </button>
            </div>
            <button onClick={buildProSite} disabled={proBuilderLoading || !config.business_name}
              className="w-full text-xs py-2.5 flex items-center justify-center gap-2 disabled:opacity-50 rounded-xl border border-gold/30 bg-gold/[0.08] text-gold hover:bg-gold/[0.15] transition-all font-medium">
              {proBuilderLoading ? <Loader size={14} className="animate-spin" /> : <Code size={14} />}
              {proBuilderLoading ? "Generating..." : "Pro Builder (React App)"}
            </button>

            {proBuilderPrompt && (
              <div className="card border-gold/15 space-y-2 mt-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] text-gold uppercase tracking-wider font-bold flex items-center gap-1.5">
                    <Code size={10} /> Pro Builder Prompt Ready
                  </h3>
                  <button onClick={() => {
                    navigator.clipboard.writeText(proBuilderPrompt);
                    toast.success("Prompt copied to clipboard!");
                  }} className="text-[10px] px-2.5 py-1 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 transition-all flex items-center gap-1">
                    <Copy size={10} /> Copy Prompt
                  </button>
                </div>
                <pre className="text-[9px] text-muted bg-surface-light rounded-lg p-2.5 max-h-32 overflow-y-auto whitespace-pre-wrap">{proBuilderPrompt}</pre>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-3">
            <div className="card border-gold/10">
              <h3 className="section-header flex items-center gap-2"><Zap size={12} className="text-gold" /> How it works</h3>
              <div className="space-y-2 text-[10px] text-muted">
                <p><span className="text-gold font-medium">1.</span> Configure the website details and style</p>
                <p><span className="text-gold font-medium">2.</span> AI generates a full responsive website</p>
                <p><span className="text-gold font-medium">3.</span> Preview it in the browser</p>
                <p><span className="text-gold font-medium">4.</span> Deploy as a demo link for the client</p>
                <p><span className="text-gold font-medium">5.</span> Client approves → add custom domain + payment</p>
              </div>
            </div>

            <div className="card border-gold/10">
              <h3 className="section-header flex items-center gap-2"><Code size={12} className="text-gold" /> Pro Builder</h3>
              <div className="space-y-2 text-[10px] text-muted">
                <p>Pro Builder creates <span className="text-gold font-medium">full React + database apps</span>:</p>
                <ul className="list-disc list-inside space-y-0.5 text-[9px] pl-1">
                  <li>Responsive design with animations</li>
                  <li>Working contact forms</li>
                  <li>SEO optimization built in</li>
                  <li>Hosted on its own URL instantly</li>
                </ul>
              </div>
            </div>

            <div className="card border-gold/10">
              <h3 className="section-header flex items-center gap-2"><FileText size={12} className="text-gold" /> Quick Stats</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-center p-2 rounded-lg bg-surface-light">
                  <p className="text-lg font-bold text-gold">{demos.length}</p>
                  <p className="text-[8px] text-muted">Sites Created</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-surface-light">
                  <p className="text-lg font-bold text-success">{demos.filter(d => d.status === "live").length}</p>
                  <p className="text-[8px] text-muted">Live Sites</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Tab */}
      {tab === "preview" && (
        <div className="space-y-3">
          {generatedHtml ? (
            <>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs text-muted">Preview of {config.business_name} website</p>
                <div className="flex items-center gap-2">
                  {/* Device preview toggle */}
                  <div className="flex bg-surface-light rounded-lg border border-border">
                    <button onClick={() => setPreviewDevice("desktop")}
                      className={`p-1.5 rounded-l-lg ${previewDevice === "desktop" ? "bg-gold/10 text-gold" : "text-muted"}`}>
                      <Monitor size={12} />
                    </button>
                    <button onClick={() => setPreviewDevice("tablet")}
                      className={`p-1.5 ${previewDevice === "tablet" ? "bg-gold/10 text-gold" : "text-muted"}`}>
                      <Tablet size={12} />
                    </button>
                    <button onClick={() => setPreviewDevice("mobile")}
                      className={`p-1.5 rounded-r-lg ${previewDevice === "mobile" ? "bg-gold/10 text-gold" : "text-muted"}`}>
                      <Smartphone size={12} />
                    </button>
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(generatedHtml); toast.success("HTML copied!"); }}
                    className="btn-ghost text-[10px] flex items-center gap-1"><Code size={10} /> Copy HTML</button>
                  <button onClick={() => {
                    const win = window.open("", "_blank");
                    if (win) { win.document.write(generatedHtml); win.document.close(); }
                  }} className="btn-secondary text-[10px] flex items-center gap-1"><ExternalLink size={10} /> Open Full</button>
                  <button onClick={() => { setGeneratedHtml(""); setTab("build"); }}
                    className="btn-ghost text-[10px] flex items-center gap-1"><RefreshCw size={10} /> Rebuild</button>
                  <button onClick={deployWebsite} disabled={deploying}
                    className="btn-primary text-[10px] flex items-center gap-1 disabled:opacity-50">
                    {deploying ? <Loader size={10} className="animate-spin" /> : <Globe size={10} />}
                    {deploying ? "Deploying..." : "Deploy to Vercel"}
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-border overflow-hidden bg-[#1a1c23] mx-auto transition-all duration-300" style={{
                height: "600px",
                maxWidth: previewDevice === "mobile" ? "375px" : previewDevice === "tablet" ? "768px" : "100%",
              }}>
                <iframe srcDoc={generatedHtml} className="w-full h-full" title="Website Preview" sandbox="allow-scripts" />
              </div>
            </>
          ) : (
            <div className="card text-center py-12">
              <Globe size={24} className="mx-auto mb-2 text-muted/30" />
              <p className="text-xs text-muted">No website generated yet. Go to Build tab first.</p>
            </div>
          )}
        </div>
      )}

      {/* Deploy Tab */}
      {tab === "deploy" && (
        <div className="max-w-lg mx-auto space-y-4">
          {deployUrl ? (
            <div className="card border-success/15 text-center py-8">
              <div className="w-14 h-14 bg-success/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <CheckCircle size={24} className="text-success" />
              </div>
              <h2 className="text-sm font-bold mb-1">Demo Site Live!</h2>
              <p className="text-xs text-muted mb-4">{config.business_name} demo is ready to share</p>

              <div className="bg-surface-light/50 rounded-xl p-3 mb-4 flex items-center justify-between border border-border">
                <a href={deployUrl} target="_blank" rel="noopener" className="text-xs text-gold hover:text-gold-light truncate">{deployUrl}</a>
                <button onClick={() => { navigator.clipboard.writeText(deployUrl); toast.success("URL copied!"); }}>
                  <Copy size={12} className="text-muted hover:text-foreground" />
                </button>
              </div>

              <div className="space-y-2">
                <button onClick={() => window.open(deployUrl, "_blank")} className="btn-primary w-full text-xs flex items-center justify-center gap-1.5">
                  <ExternalLink size={12} /> Open Demo Site
                </button>
                <button onClick={() => { navigator.clipboard.writeText(`Hey! Here's a preview of your new website: ${deployUrl}\n\nLet me know what you think!`); toast.success("Message copied with link!"); }}
                  className="btn-secondary w-full text-xs flex items-center justify-center gap-1.5">
                  <Mail size={12} /> Copy Message for Client
                </button>
                <button onClick={() => { navigator.clipboard.writeText(deployUrl); toast.success("Link copied!"); }}
                  className="btn-ghost w-full text-xs flex items-center justify-center gap-1.5">
                  <Copy size={12} /> Copy Link Only
                </button>
              </div>

              <div className="mt-6 pt-4 border-t border-border text-left">
                <h3 className="text-[10px] text-muted uppercase tracking-wider font-bold mb-2">Client Likes It? Next Steps</h3>
                <div className="space-y-1.5 text-[10px] text-muted">
                  <p><span className="text-success font-medium">1.</span> Send payment link via Stripe</p>
                  <p><span className="text-success font-medium">2.</span> After payment → add custom domain in Vercel</p>
                  <p><span className="text-success font-medium">3.</span> Client points their DNS to Vercel (76.76.21.21)</p>
                  <p><span className="text-success font-medium">4.</span> SSL auto-configured — site is live!</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="card text-center py-12">
              <Globe size={24} className="mx-auto mb-2 text-muted/30" />
              <p className="text-xs text-muted">No deployment yet. Use One-Click Demo to auto-generate and deploy.</p>
            </div>
          )}
        </div>
      )}

      {/* SEO Tips Tab */}
      {tab === "seo" && (
        <div className="space-y-4 max-w-2xl">
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Search size={13} className="text-gold" /> SEO Checklist</h2>
            <p className="text-[10px] text-muted mb-3">AI-generated websites include these SEO best practices when enabled</p>
            <div className="space-y-2">
              {SEO_TIPS.map((tip, i) => (
                <div key={i} className="flex items-start gap-3 p-2.5 rounded-xl border border-border">
                  <CheckCircle size={14} className="text-success shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-semibold">{tip.title}</p>
                    <p className="text-[10px] text-muted">{tip.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card border-gold/10">
            <h3 className="section-header flex items-center gap-2"><Zap size={12} className="text-gold" /> Performance Tips</h3>
            <div className="space-y-1.5 text-[10px] text-muted">
              <p><span className="text-gold font-medium">Images:</span> Use WebP format, lazy load below-fold images</p>
              <p><span className="text-gold font-medium">Fonts:</span> Use system fonts or Google Fonts with display=swap</p>
              <p><span className="text-gold font-medium">CSS:</span> Inline critical CSS, defer non-critical styles</p>
              <p><span className="text-gold font-medium">JS:</span> Minimize JavaScript, defer non-essential scripts</p>
              <p><span className="text-gold font-medium">Hosting:</span> Use CDN (Vercel Edge), enable gzip compression</p>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* PAGES TAB                                                           */}
      {/* ================================================================== */}
      {tab === "pages" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">Manage individual pages of your website</p>
            <button onClick={() => toast.success("New page created (demo)")} className="btn-primary text-[10px] flex items-center gap-1"><Plus size={10} /> Add Page</button>
          </div>
          <div className="space-y-1.5">
            <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[10px] text-muted uppercase tracking-wider font-semibold">
              <div className="col-span-3">Page Name</div><div className="col-span-3">Slug</div><div className="col-span-2">Status</div><div className="col-span-2">Last Edited</div><div className="col-span-2 text-right">Actions</div>
            </div>
            {pages.map(page => (
              <div key={page.id} className="grid grid-cols-12 gap-2 items-center px-4 py-2.5 rounded-xl bg-surface-light border border-border hover:border-border/80">
                <div className="col-span-3"><p className="text-sm font-semibold flex items-center gap-1.5"><FileText size={12} className="text-muted" /> {page.name}</p></div>
                <div className="col-span-3"><span className="text-[10px] font-mono text-muted">{page.slug}</span></div>
                <div className="col-span-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${page.status === "published" ? "text-green-400 border-green-400/30 bg-green-400/10" : "text-yellow-400 border-yellow-400/30 bg-yellow-400/10"}`}>
                    {page.status === "published" ? "Published" : "Draft"}
                  </span>
                </div>
                <div className="col-span-2"><span className="text-[10px] text-muted">{page.lastEdited}</span></div>
                <div className="col-span-2 flex justify-end gap-1.5">
                  <button onClick={() => toast.success("Editing page (demo)")} className="p-1.5 rounded-md hover:bg-surface text-muted hover:text-foreground"><Edit3 size={12} /></button>
                  <button onClick={() => toast.success("Page SEO (demo)")} className="p-1.5 rounded-md hover:bg-surface text-muted hover:text-foreground"><Search size={12} /></button>
                  <button onClick={() => toast("Cannot delete (demo)")} className="p-1.5 rounded-md hover:bg-red-500/10 text-muted hover:text-red-400"><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="card p-4">
            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5"><Search size={13} className="text-gold" /> Per-Page SEO Settings</p>
            <div className="space-y-3">
              <div><label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Page Title Tag</label><input className="input w-full text-xs" placeholder="Business Name | Page Title - Primary Keyword" /></div>
              <div><label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Meta Description</label><textarea className="input w-full h-16 text-xs" placeholder="150-160 character description with CTA..." /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Canonical URL</label><input className="input w-full text-xs" placeholder="https://..." /></div>
                <div><label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Robots</label><select className="input w-full text-xs"><option>index, follow</option><option>noindex, follow</option><option>index, nofollow</option><option>noindex, nofollow</option></select></div>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5"><Code size={13} className="text-gold" /> Form Embed</p>
            <div className="flex gap-2 mb-3">
              {(["contact", "newsletter", "booking", "custom"] as const).map(type => (
                <button key={type} onClick={() => setFormEmbedType(type)} className={`px-3 py-1.5 rounded-lg text-[10px] border transition-colors ${formEmbedType === type ? "border-gold bg-gold/10 text-gold" : "border-border text-muted hover:text-foreground"}`}>{type.charAt(0).toUpperCase() + type.slice(1)}</button>
              ))}
            </div>
            <div className="bg-surface-light rounded-lg p-3 border border-border">
              <pre className="text-[9px] text-muted font-mono whitespace-pre-wrap">{`<iframe src="https://yoursite.com/forms/${formEmbedType}" width="100%" height="400" frameborder="0" style="border:none;"></iframe>`}</pre>
            </div>
            <button onClick={() => { navigator.clipboard.writeText(`<iframe src="https://yoursite.com/forms/${formEmbedType}" width="100%" height="400" frameborder="0"></iframe>`); toast.success("Embed code copied!"); }} className="btn-secondary text-[10px] mt-2 flex items-center gap-1"><Copy size={10} /> Copy Embed Code</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-4">
              <p className="text-xs font-semibold mb-3 flex items-center gap-1.5"><MapPin size={13} className="text-gold" /> Sitemap</p>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-muted">Auto-generate sitemap.xml</span>
                <button onClick={() => setSitemapEnabled(!sitemapEnabled)} className={`w-10 h-5 rounded-full transition-colors relative ${sitemapEnabled ? "bg-gold" : "bg-surface-light border border-border"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${sitemapEnabled ? "left-5" : "left-0.5"}`} />
                </button>
              </div>
              <p className="text-[9px] text-muted">Includes all published pages. Updates on publish.</p>
              <button onClick={() => toast.success("Sitemap regenerated")} className="btn-secondary text-[10px] mt-2 flex items-center gap-1"><RefreshCw size={10} /> Regenerate</button>
            </div>
            <div className="card p-4">
              <p className="text-xs font-semibold mb-3 flex items-center gap-1.5"><ImageIcon size={13} className="text-gold" /> Favicon & OG Image</p>
              <div className="space-y-2">
                <div><label className="block text-[10px] text-muted mb-1">Favicon URL</label><input value={faviconUrl} onChange={e => setFaviconUrl(e.target.value)} className="input w-full text-xs" placeholder="https://...favicon.ico" /></div>
                <div><label className="block text-[10px] text-muted mb-1">OG Image URL</label><input value={ogImageUrl} onChange={e => setOgImageUrl(e.target.value)} className="input w-full text-xs" placeholder="https://...og-image.png" /></div>
                <button onClick={() => toast.success("Meta images updated")} className="btn-secondary text-[10px] flex items-center gap-1"><CheckCircle size={10} /> Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* DOMAINS TAB                                                         */}
      {/* ================================================================== */}
      {tab === "domains" && (
        <div className="space-y-4">
          <div className="card p-4">
            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5"><Link size={13} className="text-gold" /> Connected Domains</p>
            <div className="space-y-2">
              {domains.map(d => (
                <div key={d.domain} className="flex items-center justify-between p-3 rounded-lg bg-surface-light border border-border">
                  <div className="flex items-center gap-3">
                    <Globe size={14} className={d.type === "custom" ? "text-gold" : "text-muted"} />
                    <div>
                      <p className="text-sm font-semibold">{d.domain}</p>
                      <p className="text-[9px] text-muted">{d.type === "custom" ? "Custom Domain" : "Vercel Subdomain"}{d.primary && " (Primary)"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.ssl && <span className="text-[9px] flex items-center gap-1 text-green-400"><Shield size={10} /> SSL</span>}
                    <button onClick={() => toast("Domain settings (demo)")} className="p-1.5 rounded-md hover:bg-surface text-muted hover:text-foreground"><Settings size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-4">
            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5"><Plus size={13} className="text-gold" /> Add Custom Domain</p>
            <div className="flex gap-2 mb-3">
              <input value={newDomain} onChange={e => setNewDomain(e.target.value)} className="input flex-1 text-xs" placeholder="www.yourdomain.com" />
              <button onClick={() => { if (newDomain) { toast.success(`Domain ${newDomain} added (demo)`); setNewDomain(""); } }} className="btn-primary text-xs">Add Domain</button>
            </div>
            <div className="bg-surface-light rounded-lg p-3 border border-border">
              <p className="text-[10px] font-semibold mb-2">DNS Configuration</p>
              <div className="space-y-1.5 text-[9px] text-muted font-mono">
                <p>Type: <span className="text-foreground">A</span> | Name: <span className="text-foreground">@</span> | Value: <span className="text-gold">76.76.21.21</span></p>
                <p>Type: <span className="text-foreground">CNAME</span> | Name: <span className="text-foreground">www</span> | Value: <span className="text-gold">cname.vercel-dns.com</span></p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5"><Shield size={13} className="text-gold" /> SSL Certificates</p>
            <div className="space-y-2">
              {domains.map(d => (
                <div key={d.domain + "-ssl"} className="flex items-center justify-between p-2.5 rounded-lg border border-border">
                  <div className="flex items-center gap-2"><Shield size={12} className={d.ssl ? "text-green-400" : "text-red-400"} /><span className="text-xs">{d.domain}</span></div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${d.ssl ? "bg-green-400/10 text-green-400 border border-green-400/30" : "bg-red-400/10 text-red-400 border border-red-400/30"}`}>{d.ssl ? "Valid" : "Not Configured"}</span>
                </div>
              ))}
              <p className="text-[9px] text-muted mt-1">SSL certificates auto-provision via Let&apos;s Encrypt when DNS is configured.</p>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* ANALYTICS TAB                                                       */}
      {/* ================================================================== */}
      {tab === "analytics" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <div className="card p-3"><div className="flex items-center gap-1.5 mb-1"><Eye size={12} className="text-gold" /><p className="text-[10px] text-muted uppercase tracking-wider">Visitors</p></div><p className="text-lg font-bold text-gold">{siteAnalytics.visitors.toLocaleString()}</p><p className="text-[10px] text-muted mt-0.5">this month</p></div>
            <div className="card p-3"><div className="flex items-center gap-1.5 mb-1"><FileText size={12} className="text-blue-400" /><p className="text-[10px] text-muted uppercase tracking-wider">Page Views</p></div><p className="text-lg font-bold text-blue-400">{siteAnalytics.pageViews.toLocaleString()}</p><p className="text-[10px] text-muted mt-0.5">{(siteAnalytics.pageViews / siteAnalytics.visitors).toFixed(1)} per visitor</p></div>
            <div className="card p-3"><div className="flex items-center gap-1.5 mb-1"><AlertTriangle size={12} className="text-yellow-400" /><p className="text-[10px] text-muted uppercase tracking-wider">Bounce Rate</p></div><p className="text-lg font-bold text-yellow-400">{siteAnalytics.bounceRate}%</p></div>
            <div className="card p-3"><div className="flex items-center gap-1.5 mb-1"><Clock size={12} className="text-purple-400" /><p className="text-[10px] text-muted uppercase tracking-wider">Avg Duration</p></div><p className="text-lg font-bold text-purple-400">{siteAnalytics.avgDuration}</p></div>
          </div>
          <div className="card p-4">
            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5"><Gauge size={13} className="text-gold" /> Performance Scores</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Speed", score: siteAnalytics.speedScore, icon: Zap },
                { label: "Mobile", score: siteAnalytics.mobileScore, icon: Smartphone },
                { label: "SEO", score: siteAnalytics.seoScore, icon: Search },
                { label: "Accessibility", score: siteAnalytics.accessibilityScore, icon: Eye },
              ].map(metric => (
                <div key={metric.label} className="text-center p-3 rounded-lg bg-surface-light border border-border">
                  <metric.icon size={16} className={`mx-auto mb-2 ${metric.score >= 90 ? "text-green-400" : metric.score >= 70 ? "text-yellow-400" : "text-red-400"}`} />
                  <p className={`text-2xl font-bold ${metric.score >= 90 ? "text-green-400" : metric.score >= 70 ? "text-yellow-400" : "text-red-400"}`}>{metric.score}</p>
                  <p className="text-[10px] text-muted mt-1">{metric.label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-4">
            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5"><BarChart3 size={13} className="text-gold" /> Top Pages</p>
            <div className="space-y-2">
              {siteAnalytics.topPages.map(page => {
                const maxViews = Math.max(...siteAnalytics.topPages.map(p => p.views));
                return (
                  <div key={page.page} className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-muted w-24 shrink-0">{page.page}</span>
                    <div className="flex-1 h-4 rounded bg-surface-light border border-border overflow-hidden"><div className="h-full rounded bg-gold/50 transition-all duration-500" style={{ width: `${(page.views / maxViews) * 100}%` }} /></div>
                    <span className="text-[10px] font-semibold text-foreground w-16 text-right">{page.views.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card p-4">
            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5"><Smartphone size={13} className="text-gold" /> Device Breakdown</p>
            <div className="grid grid-cols-3 gap-3">
              {[{ device: "Desktop", pct: 52, icon: Monitor }, { device: "Mobile", pct: 38, icon: Smartphone }, { device: "Tablet", pct: 10, icon: Tablet }].map(d => (
                <div key={d.device} className="text-center p-3 rounded-lg bg-surface-light border border-border">
                  <d.icon size={16} className="mx-auto mb-2 text-muted" /><p className="text-lg font-bold text-foreground">{d.pct}%</p><p className="text-[10px] text-muted">{d.device}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* BLOG TAB                                                            */}
      {/* ================================================================== */}
      {tab === "blog" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">Manage blog posts for your website</p>
            <button onClick={() => toast.success("New blog post created (demo)")} className="btn-primary text-[10px] flex items-center gap-1"><PenTool size={10} /> New Post</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <div className="card p-3"><p className="text-[10px] text-muted uppercase tracking-wider">Total Posts</p><p className="text-lg font-bold text-gold">{blogPosts.length}</p></div>
            <div className="card p-3"><p className="text-[10px] text-muted uppercase tracking-wider">Published</p><p className="text-lg font-bold text-green-400">{blogPosts.filter(p => p.status === "published").length}</p></div>
            <div className="card p-3"><p className="text-[10px] text-muted uppercase tracking-wider">Drafts</p><p className="text-lg font-bold text-yellow-400">{blogPosts.filter(p => p.status === "draft").length}</p></div>
            <div className="card p-3"><p className="text-[10px] text-muted uppercase tracking-wider">Total Views</p><p className="text-lg font-bold text-blue-400">{blogPosts.reduce((s, p) => s + p.views, 0)}</p></div>
          </div>
          <div className="space-y-1.5">
            <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[10px] text-muted uppercase tracking-wider font-semibold">
              <div className="col-span-5">Title</div><div className="col-span-2">Status</div><div className="col-span-2">Date</div><div className="col-span-1 text-right">Views</div><div className="col-span-2 text-right">Actions</div>
            </div>
            {blogPosts.map(post => (
              <div key={post.id} className="grid grid-cols-12 gap-2 items-center px-4 py-2.5 rounded-xl bg-surface-light border border-border hover:border-border/80">
                <div className="col-span-5"><p className="text-sm font-semibold truncate">{post.title}</p></div>
                <div className="col-span-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${post.status === "published" ? "text-green-400 border-green-400/30 bg-green-400/10" : post.status === "scheduled" ? "text-blue-400 border-blue-400/30 bg-blue-400/10" : "text-yellow-400 border-yellow-400/30 bg-yellow-400/10"}`}>{post.status.charAt(0).toUpperCase() + post.status.slice(1)}</span>
                </div>
                <div className="col-span-2"><span className="text-[10px] text-muted">{post.date}</span></div>
                <div className="col-span-1 text-right"><span className="text-[10px] text-foreground">{post.views}</span></div>
                <div className="col-span-2 flex justify-end gap-1.5">
                  <button onClick={() => toast.success("Editing post (demo)")} className="p-1.5 rounded-md hover:bg-surface text-muted hover:text-foreground"><Edit3 size={12} /></button>
                  <button onClick={() => toast.success("Post deleted (demo)")} className="p-1.5 rounded-md hover:bg-red-500/10 text-muted hover:text-red-400"><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="card p-4">
            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5"><Sparkles size={13} className="text-gold" /> AI Blog Tools</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { label: "Generate Post", desc: "AI writes a full blog post", icon: PenTool, color: "text-gold" },
                { label: "SEO Optimize", desc: "Optimize existing posts", icon: Search, color: "text-green-400" },
                { label: "Generate Ideas", desc: "Get 10 blog topic ideas", icon: Sparkles, color: "text-purple-400" },
                { label: "Bulk Schedule", desc: "Schedule posts for the month", icon: Hash, color: "text-blue-400" },
              ].map(tool => (
                <button key={tool.label} onClick={() => toast.success(`${tool.label} (demo)`)} className="card-hover p-3 text-left">
                  <tool.icon size={14} className={`${tool.color} mb-1.5`} /><p className="text-[10px] font-semibold">{tool.label}</p><p className="text-[9px] text-muted">{tool.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Demos Tab */}
      {tab === "demos" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">All demo sites created for prospects and clients</p>
            <button onClick={() => setTab("build")} className="btn-primary text-[10px] flex items-center gap-1"><Sparkles size={10} /> New Demo</button>
          </div>
          {demos.length === 0 ? (
            <div className="card text-center py-12"><Globe size={20} className="mx-auto mb-2 text-muted/30" /><p className="text-xs text-muted">No demos yet. Create one to show prospects their website.</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {demos.map((d) => (
                <div key={d.id} className="card-hover p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div><h3 className="text-xs font-semibold">{d.business_name}</h3><p className="text-[9px] text-muted">{new Date(d.created_at).toLocaleDateString()}</p></div>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full ${d.status === "demo" ? "bg-gold/10 text-gold" : d.status === "live" ? "bg-success/10 text-success" : "bg-surface-light text-muted"}`}>{d.status === "demo" ? "Demo" : d.status === "live" ? "Live" : d.status}</span>
                  </div>
                  {d.url && (
                    <div className="bg-surface-light rounded-lg px-2.5 py-1.5 mb-2.5 flex items-center justify-between border border-border">
                      <a href={d.url} target="_blank" rel="noopener" className="text-[10px] text-gold hover:text-gold-light truncate">{d.url}</a>
                      <button onClick={() => { navigator.clipboard.writeText(d.url); toast.success("Copied!"); }}><Copy size={10} className="text-muted hover:text-foreground shrink-0 ml-2" /></button>
                    </div>
                  )}
                  <div className="flex gap-1.5">
                    {d.url && <a href={d.url} target="_blank" rel="noopener" className="btn-secondary text-[9px] py-1 px-2 flex items-center gap-1"><ExternalLink size={9} /> View</a>}
                    <button onClick={() => { navigator.clipboard.writeText(`Hey! Here's a preview of your new website: ${d.url}\n\nLet me know what you think!`); toast.success("Message copied!"); }} className="btn-ghost text-[9px] py-1 px-2 flex items-center gap-1"><Mail size={9} /> Send</button>
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
