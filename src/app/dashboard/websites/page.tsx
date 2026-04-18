"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Globe, Sparkles, Loader, ExternalLink, Copy, Eye, Plus,
  Palette, Layout, Trash2, Wand2, Briefcase, Users, Store,
  MonitorSmartphone, UtensilsCrossed, Home, Building2, Target,
  Camera, GraduationCap, Newspaper, RefreshCw, CheckCircle,
  Zap, Link2, ShoppingBag, ShieldCheck, Megaphone,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import PageHero from "@/components/ui/page-hero";
import CreationWizard, { type WizardStep } from "@/components/creation-wizard";
import { VercelIcon, GoDaddyIcon } from "@/components/ui/platform-icons";

interface WebsiteProject {
  id: string;
  name: string;
  subdomain: string | null;
  custom_domain: string | null;
  vercel_url: string | null;
  preview_url: string | null;
  status: string;
  industry: string | null;
  template_style: string | null;
  generated_files: Record<string, string> | null;
  generated_content: Record<string, unknown> | null;
  business_info: Record<string, unknown> | null;
  wizard_answers: Record<string, unknown> | null;
  client_id: string | null;
  created_at: string;
}

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-slate-500/10 text-slate-400 border-slate-500/30",
  generating: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  preview: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  deploying: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  live: "bg-green-500/10 text-green-400 border-green-500/30",
  failed: "bg-red-500/10 text-red-400 border-red-500/30",
  archived: "bg-slate-500/10 text-slate-400 border-slate-500/30",
};

export default function WebsitesPage() {
  useAuth();
  const supabase = createClient();

  const [projects, setProjects] = useState<WebsiteProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Array<{ id: string; business_name: string; industry: string | null }>>([]);
  const [wizardOpen, setWizardOpen] = useState(false);

  // Active project for the result panel
  const [active, setActive] = useState<WebsiteProject | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [deploying, setDeploying] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [p, c] = await Promise.all([
      supabase.from("website_projects").select("*").order("created_at", { ascending: false }),
      supabase.from("clients").select("id, business_name, industry").eq("is_active", true),
    ]);
    setProjects((p.data as WebsiteProject[]) || []);
    setClients((c.data as Array<{ id: string; business_name: string; industry: string | null }>) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ───────────────────────────────────── Wizard steps ────────────────────────────────── */

  async function aiSuggestValueProp(data: Record<string, unknown>): Promise<Partial<Record<string, unknown>>> {
    try {
      const res = await fetch("/api/websites/ai-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: data, stage: "value_prop" }),
      });
      const d = await res.json();
      if (Array.isArray(d.questions) && d.questions.length > 0) {
        const suggestions = d.questions[0]?.suggestions || [];
        if (suggestions.length > 0) {
          return { value_prop: suggestions.slice(0, 2).join(" + ") };
        }
      }
    } catch {
      // ignore
    }
    return {};
  }

  async function aiSuggestColors(data: Record<string, unknown>): Promise<Partial<Record<string, unknown>>> {
    const industry = String(data.industry || data.business_type || "");
    const map: Record<string, { primary: string; accent: string }> = {
      restaurant: { primary: "#B45309", accent: "#78350F" },
      real_estate: { primary: "#C9A84C", accent: "#1E293B" },
      coach: { primary: "#7C3AED", accent: "#1E1B4B" },
      saas: { primary: "#2563EB", accent: "#0F172A" },
      ecommerce: { primary: "#EC4899", accent: "#111827" },
      local_service: { primary: "#0EA5E9", accent: "#0C4A6E" },
      portfolio: { primary: "#F97316", accent: "#18181B" },
      blog: { primary: "#059669", accent: "#064E3B" },
      agency: { primary: "#DC2626", accent: "#1F2937" },
    };
    const palette = map[industry.toLowerCase()] || { primary: "#C9A84C", accent: "#0F172A" };
    return { brand_primary: palette.primary, brand_accent: palette.accent };
  }

  const steps: WizardStep[] = [
    {
      id: "business_type",
      title: "What kind of business is this for?",
      description: "We use this to tune the layout, copy tone and color palette.",
      icon: <Briefcase size={16} />,
      field: {
        type: "choice-cards",
        key: "business_type",
        options: [
          { value: "local_service", label: "Local Service", description: "HVAC, plumbing, dental…", icon: <Home size={14} />, preview: "bg-gradient-to-br from-sky-500/40 to-cyan-500/40" },
          { value: "ecommerce", label: "E-commerce", description: "Online store", icon: <ShoppingBag size={14} />, preview: "bg-gradient-to-br from-pink-500/40 to-rose-500/40" },
          { value: "saas", label: "SaaS", description: "Software product", icon: <MonitorSmartphone size={14} />, preview: "bg-gradient-to-br from-blue-500/40 to-indigo-500/40" },
          { value: "portfolio", label: "Portfolio", description: "Creative showcase", icon: <Camera size={14} />, preview: "bg-gradient-to-br from-orange-500/40 to-amber-500/40" },
          { value: "coach", label: "Coach / Course", description: "Coaching, personal brand", icon: <GraduationCap size={14} />, preview: "bg-gradient-to-br from-purple-500/40 to-fuchsia-500/40" },
          { value: "blog", label: "Blog / Content", description: "Editorial & newsletter", icon: <Newspaper size={14} />, preview: "bg-gradient-to-br from-emerald-500/40 to-teal-500/40" },
          { value: "agency", label: "Agency", description: "Services company", icon: <Users size={14} />, preview: "bg-gradient-to-br from-red-500/40 to-orange-500/40" },
          { value: "restaurant", label: "Restaurant", description: "Menu, reservations", icon: <UtensilsCrossed size={14} />, preview: "bg-gradient-to-br from-amber-500/40 to-red-500/40" },
          { value: "real_estate", label: "Real Estate", description: "Listings, agent brand", icon: <Building2 size={14} />, preview: "bg-gradient-to-br from-slate-600/40 to-amber-500/40" },
          { value: "other", label: "Other", description: "Something else", icon: <Store size={14} />, preview: "bg-gradient-to-br from-slate-500/40 to-slate-700/40" },
        ],
      },
    },
    {
      id: "business_name",
      title: "What's the business name?",
      description: "We'll use this as the brand name across the site.",
      icon: <Wand2 size={16} />,
      field: { type: "text", key: "business_name", placeholder: "e.g., Bright Smile Dental" },
    },
    {
      id: "industry",
      title: "What industry or niche?",
      description: "The more specific, the sharper the copy.",
      icon: <Target size={16} />,
      field: { type: "text", key: "industry", placeholder: "e.g., cosmetic dentistry for families" },
      aiHelper: {
        label: "Suggest from business type",
        onClick: async (d) => {
          const t = String(d.business_type || "");
          const suggestions: Record<string, string> = {
            local_service: "local service business serving homeowners",
            ecommerce: "direct-to-consumer e-commerce brand",
            saas: "B2B SaaS product",
            portfolio: "freelance creative portfolio",
            coach: "online coaching & courses",
            blog: "niche blog & newsletter",
            agency: "marketing agency",
            restaurant: "restaurant & hospitality",
            real_estate: "real estate agent",
          };
          return { industry: suggestions[t] || "small business" };
        },
      },
    },
    {
      id: "target_audience",
      title: "Who visits this site?",
      description: "Who is the ideal customer? What do they care about?",
      icon: <Users size={16} />,
      field: { type: "textarea", key: "target_audience", placeholder: "e.g., busy parents in my city looking for reliable family dentistry, 30-50, values trust and convenience" },
    },
    {
      id: "value_prop",
      title: "What makes you different?",
      description: "1-2 sentences. This becomes your hero subheadline.",
      icon: <Sparkles size={16} />,
      field: { type: "textarea", key: "value_prop", placeholder: "e.g., Same-day appointments, insurance-accepted, family-friendly vibe" },
      aiHelper: {
        label: "AI suggest based on my answers",
        onClick: aiSuggestValueProp,
      },
    },
    {
      id: "style_vibe",
      title: "Pick a style & vibe",
      description: "This changes colors, typography and overall feel.",
      icon: <Palette size={16} />,
      field: {
        type: "choice-cards",
        key: "style_vibe",
        options: [
          { value: "bold-vibrant", label: "Bold & Vibrant", description: "MrBeast, high-energy", preview: "bg-gradient-to-br from-red-500 via-orange-500 to-yellow-500" },
          { value: "minimal-clean", label: "Minimal & Clean", description: "MKBHD / Apple", preview: "bg-gradient-to-br from-slate-100 to-slate-300" },
          { value: "luxury-gold", label: "Luxury & Gold", description: "High-end real estate", preview: "bg-gradient-to-br from-amber-400 via-yellow-600 to-black" },
          { value: "playful-fun", label: "Playful & Fun", description: "Gen Z brands", preview: "bg-gradient-to-br from-pink-400 via-yellow-300 to-purple-400" },
          { value: "dark-cinematic", label: "Dark & Cinematic", description: "Tech / gaming", preview: "bg-gradient-to-br from-slate-900 via-purple-900 to-black" },
          { value: "pastel-soft", label: "Pastel & Soft", description: "Wellness / beauty", preview: "bg-gradient-to-br from-pink-200 via-rose-200 to-sky-200" },
          { value: "corporate-pro", label: "Corporate Pro", description: "B2B / legal", preview: "bg-gradient-to-br from-blue-900 via-slate-800 to-blue-700" },
          { value: "editorial", label: "Editorial Magazine", description: "Blog / content", preview: "bg-gradient-to-br from-stone-200 via-stone-300 to-stone-500" },
        ],
      },
    },
    {
      id: "hero_style",
      title: "Pick the hero layout",
      description: "The first thing visitors see.",
      icon: <Layout size={16} />,
      field: {
        type: "choice-cards",
        key: "hero_style",
        options: [
          { value: "big-headline-image", label: "Big headline + image", description: "Classic high-converting", emoji: "🖼️" },
          { value: "video-bg", label: "Video background", description: "Looping hero video", emoji: "🎬" },
          { value: "3d-spline", label: "3D / Spline animation", description: "Interactive 3D scene", emoji: "🧊" },
          { value: "split-screen", label: "Split screen", description: "Copy left / visual right", emoji: "⬛⬜" },
          { value: "fullscreen-photo", label: "Fullscreen photo", description: "Immersive full-bleed", emoji: "📸" },
          { value: "interactive-gradient", label: "Interactive gradient", description: "Animated mesh gradient", emoji: "🌈" },
        ],
      },
    },
    {
      id: "cta_goal",
      title: "What should visitors do?",
      description: "We'll repeat this CTA 3+ times across the page.",
      icon: <Megaphone size={16} />,
      field: {
        type: "choice-cards",
        key: "cta_goal",
        options: [
          { value: "book-call", label: "Book a call", description: "Calendly / calendar", emoji: "📅" },
          { value: "buy-product", label: "Buy product", description: "E-commerce checkout", emoji: "🛒" },
          { value: "join-waitlist", label: "Join waitlist", description: "Email capture pre-launch", emoji: "⏳" },
          { value: "download", label: "Download", description: "Lead magnet / app", emoji: "⬇️" },
          { value: "contact", label: "Contact us", description: "Contact form / email", emoji: "✉️" },
          { value: "schedule-demo", label: "Schedule demo", description: "SaaS demo request", emoji: "🎯" },
        ],
      },
    },
    {
      id: "sections",
      title: "Which sections to include?",
      description: "Hero, CTA block and footer are always included.",
      icon: <Layout size={16} />,
      field: {
        type: "chip-select",
        key: "sections",
        options: [
          { value: "about", label: "About", emoji: "📖" },
          { value: "features", label: "Features", emoji: "✨" },
          { value: "services", label: "Services", emoji: "🛠️" },
          { value: "pricing", label: "Pricing", emoji: "💰" },
          { value: "testimonials", label: "Testimonials", emoji: "⭐" },
          { value: "faq", label: "FAQ", emoji: "❓" },
          { value: "blog-preview", label: "Blog preview", emoji: "📰" },
          { value: "gallery", label: "Gallery", emoji: "🖼️" },
          { value: "team", label: "Team", emoji: "👥" },
          { value: "contact", label: "Contact", emoji: "📬" },
        ],
      },
    },
    {
      id: "brand_primary",
      title: "Primary brand color",
      description: "Used for the main CTA button and hero accents.",
      icon: <Palette size={16} />,
      field: { type: "color-picker", key: "brand_primary" },
      aiHelper: {
        label: "AI pick based on industry",
        onClick: aiSuggestColors,
      },
    },
    {
      id: "brand_accent",
      title: "Accent color",
      description: "Used for secondary accents and backgrounds.",
      icon: <Palette size={16} />,
      field: { type: "color-picker", key: "brand_accent" },
    },
    {
      id: "visuals",
      title: "How should we handle visuals?",
      description: "Images and imagery throughout the site.",
      icon: <Camera size={16} />,
      field: {
        type: "choice-cards",
        key: "visuals",
        options: [
          { value: "ai-generated", label: "AI-generated images", description: "We'll call it out in the prompt", emoji: "🤖" },
          { value: "stock-photos", label: "Stock photos", description: "Unsplash / Pexels references", emoji: "📷" },
          { value: "upload-own", label: "I'll upload my own", description: "Replace placeholders later", emoji: "📤" },
          { value: "mixed", label: "Mixed", description: "AI + stock + uploads", emoji: "🎨" },
        ],
      },
    },
    {
      id: "domain_strategy",
      title: "Domain strategy",
      description: "You can change this later. Free subdomain is fastest.",
      icon: <Link2 size={16} />,
      field: {
        type: "choice-cards",
        key: "domain_strategy",
        options: [
          { value: "subdomain", label: "Use a free subdomain", description: "my-site.shortstack.work", emoji: "🆓" },
          { value: "buy-new", label: "Buy a new domain", description: "$12-35/yr via GoDaddy", emoji: "🌐" },
          { value: "connect-existing", label: "Connect existing domain", description: "You already own one", emoji: "🔗" },
        ],
      },
    },
  ];

  /* ───────────────────────────────────── Generate & deploy ────────────────────────────────── */

  async function handleWizardComplete(data: Record<string, unknown>) {
    toast.loading("Claude is designing your site…", { id: "gen" });
    try {
      const res = await fetch("/api/websites/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: data }),
      });
      const out = await res.json();
      toast.dismiss("gen");
      if (out.success) {
        toast.success("Website generated!");
        await loadData();
        const { data: row } = await supabase
          .from("website_projects")
          .select("*")
          .eq("id", out.project_id)
          .single();
        if (row) setActive(row as WebsiteProject);
        setWizardOpen(false);
      } else {
        toast.error(out.error || "Generation failed");
      }
    } catch {
      toast.dismiss("gen");
      toast.error("Generation failed");
    }
  }

  async function regenerate(project: WebsiteProject) {
    setRegenerating(true);
    toast.loading("Regenerating with Claude…", { id: "regen" });
    try {
      const res = await fetch("/api/websites/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          answers: project.wizard_answers || {},
          client_id: project.client_id,
        }),
      });
      const out = await res.json();
      toast.dismiss("regen");
      if (out.success) {
        toast.success("Regenerated!");
        const { data: row } = await supabase.from("website_projects").select("*").eq("id", project.id).single();
        if (row) setActive(row as WebsiteProject);
        loadData();
      } else {
        toast.error(out.error || "Regenerate failed");
      }
    } catch {
      toast.dismiss("regen");
      toast.error("Regenerate failed");
    }
    setRegenerating(false);
  }

  async function deploy(project: WebsiteProject) {
    setDeploying(true);
    toast.loading("Deploying to Vercel…", { id: "dep" });
    try {
      const res = await fetch("/api/websites/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: project.id }),
      });
      const out = await res.json();
      toast.dismiss("dep");
      if (out.success) {
        toast.success(out.simulated ? "Preview deployment (simulated)" : "Deployed to Vercel!");
        const { data: row } = await supabase.from("website_projects").select("*").eq("id", project.id).single();
        if (row) setActive(row as WebsiteProject);
        loadData();
      } else {
        toast.error(out.error || "Deploy failed");
      }
    } catch {
      toast.dismiss("dep");
      toast.error("Deploy failed");
    }
    setDeploying(false);
  }

  async function deleteProject(id: string) {
    if (!confirm("Delete this website project?")) return;
    await supabase.from("website_projects").delete().eq("id", id);
    if (active?.id === id) setActive(null);
    toast.success("Deleted");
    loadData();
  }

  /* ───────────────────────────────────── Render ────────────────────────────────── */

  const indexHtml = active?.generated_files?.["index.html"] || "";

  return (
    <div className="fade-in space-y-5">
      <PageHero
        icon={<Globe size={28} />}
        title="Website Builder"
        subtitle="Claude designs high-converting one-pagers. Deploy to Vercel. Buy a domain via GoDaddy."
        gradient="sunset"
        actions={
          <>
            <div className="flex items-center gap-1.5 text-[10px] text-white/80 bg-white/10 border border-white/20 px-2 py-1 rounded-lg">
              <VercelIcon size={12} /> Vercel
              <span className="opacity-40">·</span>
              <GoDaddyIcon size={12} /> GoDaddy
            </div>
            <button
              onClick={() => setWizardOpen(true)}
              className="text-xs px-4 py-2 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 text-black font-bold hover:shadow-lg hover:shadow-amber-400/30 flex items-center gap-1.5"
            >
              <Plus size={14} /> Start New Website
            </button>
          </>
        }
      />

      {/* Wizard */}
      <CreationWizard
        open={wizardOpen}
        title="Website Builder"
        subtitle="Answer a few questions — Claude will design a high-converting one-pager."
        icon={<Globe size={18} />}
        submitLabel="Generate with Claude"
        initialData={{
          brand_primary: "#C9A84C",
          brand_accent: "#0F172A",
          sections: ["about", "features", "testimonials", "faq"],
          visuals: "ai-generated",
          domain_strategy: "subdomain",
        }}
        steps={steps}
        onClose={() => setWizardOpen(false)}
        onComplete={handleWizardComplete}
      />

      {/* Active project result */}
      {active && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-sm font-semibold truncate">{active.name}</h2>
              <span className={`text-[9px] px-2 py-0.5 rounded-full border ${STATUS_BADGE[active.status] || STATUS_BADGE.draft}`}>
                {active.status}
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => regenerate(active)}
                disabled={regenerating}
                className="text-[10px] px-3 py-1.5 rounded-lg border border-border text-muted hover:text-foreground flex items-center gap-1 disabled:opacity-50"
              >
                {regenerating ? <Loader size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                Regenerate
              </button>
              <button
                onClick={() => deploy(active)}
                disabled={deploying || !indexHtml}
                className="text-[10px] px-3 py-1.5 rounded-lg bg-black text-white hover:bg-black/80 flex items-center gap-1 disabled:opacity-50"
              >
                {deploying ? <Loader size={10} className="animate-spin" /> : <VercelIcon size={10} />}
                Deploy to Vercel
              </button>
              <a
                href="/dashboard/domains"
                className="text-[10px] px-3 py-1.5 rounded-lg bg-[#1BDBDB]/20 border border-[#1BDBDB]/30 text-[#1BDBDB] hover:bg-[#1BDBDB]/30 flex items-center gap-1"
              >
                <GoDaddyIcon size={10} /> Buy domain
              </a>
              {active.vercel_url && (
                <a href={active.vercel_url} target="_blank" rel="noopener" className="text-[10px] px-3 py-1.5 rounded-lg border border-border text-muted hover:text-foreground flex items-center gap-1">
                  <ExternalLink size={10} /> Live
                </a>
              )}
            </div>
          </div>

          {active.vercel_url && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-surface-light border border-border">
              <a href={active.vercel_url} target="_blank" rel="noopener" className="text-[11px] text-gold hover:text-gold-light truncate">
                {active.vercel_url}
              </a>
              <button onClick={() => { navigator.clipboard.writeText(active.vercel_url!); toast.success("Copied"); }}>
                <Copy size={11} className="text-muted hover:text-foreground" />
              </button>
            </div>
          )}

          {indexHtml ? (
            <div className="rounded-xl border border-border overflow-hidden bg-[#1a1c23]" style={{ height: 600 }}>
              <iframe srcDoc={indexHtml} className="w-full h-full" title="Website preview" sandbox="allow-scripts" />
            </div>
          ) : (
            <div className="py-10 text-center text-xs text-muted">
              <Loader size={18} className="animate-spin mx-auto mb-2" />
              Generating...
            </div>
          )}
        </div>
      )}

      {/* Projects list */}
      <div className="card">
        <h2 className="section-header flex items-center gap-2">
          <Layout size={13} className="text-gold" /> Your websites ({projects.length})
        </h2>
        {loading ? (
          <div className="py-8 text-center text-muted text-xs">Loading...</div>
        ) : projects.length === 0 ? (
          <div className="py-10 text-center">
            <Globe size={24} className="mx-auto mb-2 text-muted/30" />
            <p className="text-xs text-muted mb-3">No websites yet. Launch the wizard to build your first one.</p>
            <button
              onClick={() => setWizardOpen(true)}
              className="text-xs px-4 py-2 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 text-black font-bold inline-flex items-center gap-1.5"
            >
              <Sparkles size={12} /> Start with Claude
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {projects.map(p => {
              const html = p.generated_files?.["index.html"] || "";
              const clientName = clients.find(c => c.id === p.client_id)?.business_name;
              return (
                <div key={p.id} className="card-hover p-0 overflow-hidden">
                  {/* Thumbnail */}
                  <div className="relative h-36 bg-slate-900 border-b border-border overflow-hidden">
                    {html ? (
                      <iframe
                        srcDoc={html}
                        className="w-[200%] h-[200%] origin-top-left scale-50 pointer-events-none"
                        title={`${p.name} preview`}
                        sandbox=""
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted">
                        <Globe size={24} className="opacity-30" />
                      </div>
                    )}
                    <span className={`absolute top-2 right-2 text-[9px] px-2 py-0.5 rounded-full border backdrop-blur ${STATUS_BADGE[p.status] || STATUS_BADGE.draft}`}>
                      {p.status}
                    </span>
                  </div>

                  <div className="p-3 space-y-2">
                    <div>
                      <p className="text-xs font-semibold truncate">{p.name}</p>
                      <p className="text-[9px] text-muted truncate">
                        {clientName ? `${clientName} · ` : ""}
                        {p.industry || p.template_style || "uncategorized"}
                      </p>
                    </div>

                    {(p.vercel_url || p.custom_domain) && (
                      <a
                        href={`https://${p.custom_domain || p.vercel_url?.replace(/^https?:\/\//, "")}`}
                        target="_blank"
                        rel="noopener"
                        className="text-[10px] text-gold hover:text-gold-light truncate block"
                      >
                        {p.custom_domain || p.vercel_url}
                      </a>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setActive(p)} className="text-[10px] px-2 py-1 rounded-md bg-gold/10 text-gold hover:bg-gold/20 flex items-center gap-1">
                          <Eye size={10} /> Open
                        </button>
                        {p.vercel_url && (
                          <a href={p.vercel_url} target="_blank" rel="noopener" className="text-[10px] px-2 py-1 rounded-md border border-border text-muted hover:text-foreground flex items-center gap-1">
                            <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                      <button onClick={() => deleteProject(p.id)} className="p-1 rounded-md hover:bg-red-500/10 text-muted hover:text-red-400">
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="card border-gold/10">
          <h3 className="section-header flex items-center gap-2">
            <Sparkles size={12} className="text-gold" /> 1. Describe
          </h3>
          <p className="text-[10px] text-muted">12 quick questions about your business, audience, style and goal. AI suggests colors and copy.</p>
        </div>
        <div className="card border-gold/10">
          <h3 className="section-header flex items-center gap-2">
            <Wand2 size={12} className="text-gold" /> 2. Claude designs
          </h3>
          <p className="text-[10px] text-muted">Claude Sonnet generates a conversion-optimized one-pager: hero animations, social proof, CTAs, FAQ, footer.</p>
        </div>
        <div className="card border-gold/10">
          <h3 className="section-header flex items-center gap-2">
            <Zap size={12} className="text-gold" /> 3. Deploy & own
          </h3>
          <p className="text-[10px] text-muted">One-click deploy to Vercel. Buy a domain via GoDaddy — you own it, access DNS in <a href="/dashboard/domains" className="text-gold">Domains</a>.</p>
        </div>
      </div>

      <div className="card border-gold/10">
        <h3 className="text-[11px] font-semibold flex items-center gap-1.5 mb-2">
          <ShieldCheck size={11} className="text-gold" /> Conversion best-practices built in
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] text-muted">
          <div className="flex items-start gap-1.5"><CheckCircle size={10} className="text-success mt-0.5 shrink-0" /> Bold hero headline + subheader</div>
          <div className="flex items-start gap-1.5"><CheckCircle size={10} className="text-success mt-0.5 shrink-0" /> Social proof above the fold</div>
          <div className="flex items-start gap-1.5"><CheckCircle size={10} className="text-success mt-0.5 shrink-0" /> CTA repeated 3+ times</div>
          <div className="flex items-start gap-1.5"><CheckCircle size={10} className="text-success mt-0.5 shrink-0" /> Benefit-driven copy</div>
          <div className="flex items-start gap-1.5"><CheckCircle size={10} className="text-success mt-0.5 shrink-0" /> Animated 3D / gradient hero</div>
          <div className="flex items-start gap-1.5"><CheckCircle size={10} className="text-success mt-0.5 shrink-0" /> Trust badges & guarantees</div>
          <div className="flex items-start gap-1.5"><CheckCircle size={10} className="text-success mt-0.5 shrink-0" /> Mobile-first Tailwind</div>
          <div className="flex items-start gap-1.5"><CheckCircle size={10} className="text-success mt-0.5 shrink-0" /> Scroll-reveal animations</div>
        </div>
      </div>
    </div>
  );
}
