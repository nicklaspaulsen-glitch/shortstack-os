"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Globe, Sparkles, Loader, ExternalLink, Copy, Eye, Plus,
  Palette, Layout, Trash2, Wand2, Briefcase, Users, Store,
  MonitorSmartphone, UtensilsCrossed, Home, Building2, Target,
  Camera, GraduationCap, Newspaper, RefreshCw, CheckCircle,
  Link2, ShoppingBag, ShieldCheck, Megaphone, Clock,
  Crown, X, Share2, DollarSign, BarChart3, FlaskConical,
  EyeOff, Check, Rocket, Calendar, Monitor, Tablet, Smartphone,
  TrendingUp, ArrowRight,
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
  demo_expires_at: string | null;
  demo_deployed_at: string | null;
  watermark_enabled: boolean | null;
  pricing_tier: string | null;
  monthly_price: number | null;
  yearly_price: number | null;
  pricing_breakdown: Array<{ item: string; price: number }> | null;
  addons: string[] | null;
}

interface PriceQuote {
  tier: "starter" | "pro" | "business" | "premium";
  monthly_price: number;
  yearly_price: number;
  breakdown: Array<{ item: string; price: number }>;
  addons_active: string[];
  addons_available: Array<{ key: string; label: string; price: number }>;
}

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-slate-500/10 text-slate-400 border-slate-500/30",
  generating: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  preview: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  deploying: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  live: "bg-green-500/10 text-green-400 border-green-500/30",
  failed: "bg-red-500/10 text-red-400 border-red-500/30",
  archived: "bg-slate-500/10 text-slate-400 border-slate-500/30",
  expired: "bg-orange-500/10 text-orange-400 border-orange-500/30",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  generating: "Generating",
  preview: "Demo",
  deploying: "Deploying",
  live: "Live",
  failed: "Failed",
  archived: "Archived",
  expired: "Expired",
};

const TIER_COLOR: Record<string, string> = {
  starter: "from-sky-500 to-cyan-500",
  pro: "from-violet-500 to-fuchsia-500",
  business: "from-amber-400 to-orange-500",
  premium: "from-rose-500 to-purple-600",
};

const ALL_ADDONS = [
  { key: "custom_domain", label: "Custom domain", price: 5, icon: <Link2 size={11} /> },
  { key: "priority_support", label: "Priority support", price: 25, icon: <Crown size={11} /> },
  { key: "advanced_analytics", label: "Advanced analytics", price: 10, icon: <BarChart3 size={11} /> },
  { key: "ab_testing", label: "A/B testing", price: 15, icon: <FlaskConical size={11} /> },
  { key: "white_label", label: "White-label (no watermark)", price: 20, icon: <EyeOff size={11} /> },
];

/* ─────────────────────────── Niche template gallery ───────────────────────────
   Each template preselects wizard answers so the user skips the generic opener.
   Images are Unsplash CDN with stable photo ids + cropping params (600x400).
*/
interface NicheTemplate {
  id: string;
  niche: string;
  name: string;
  tagline: string;
  cvr: string;
  avgLaunch: string;
  image: string;
  accent: string;
  preset: {
    business_type: string;
    style_vibe: string;
    hero_style: string;
    cta_goal: string;
    brand_primary: string;
    brand_accent: string;
    sections: string[];
  };
}

const NICHE_TEMPLATES: NicheTemplate[] = [
  {
    id: "saas-launch",
    niche: "SaaS Landing",
    name: "Product Launch",
    tagline: "Hero + feature grid + pricing + demo CTA",
    cvr: "Avg 4.2% CVR",
    avgLaunch: "3 min to live",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=400&fit=crop",
    accent: "from-blue-600/70 to-indigo-500/70",
    preset: {
      business_type: "saas",
      style_vibe: "minimal-clean",
      hero_style: "split-screen",
      cta_goal: "schedule-demo",
      brand_primary: "#2563EB",
      brand_accent: "#0F172A",
      sections: ["features", "testimonials", "pricing", "faq"],
    },
  },
  {
    id: "agency-services",
    niche: "Agency Services",
    name: "Full-Service Agency",
    tagline: "Case studies + services grid + booking widget",
    cvr: "Avg 5.8% CVR",
    avgLaunch: "4 min to live",
    image: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&h=400&fit=crop",
    accent: "from-red-600/70 to-orange-500/70",
    preset: {
      business_type: "agency",
      style_vibe: "dark-cinematic",
      hero_style: "big-headline-image",
      cta_goal: "book-call",
      brand_primary: "#DC2626",
      brand_accent: "#1F2937",
      sections: ["services", "testimonials", "faq", "contact"],
    },
  },
  {
    id: "ecom-product",
    niche: "E-com Product",
    name: "DTC Storefront",
    tagline: "Fullscreen photo + reviews + buy-now strip",
    cvr: "Avg 3.1% CVR",
    avgLaunch: "3 min to live",
    image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&h=400&fit=crop",
    accent: "from-pink-500/70 to-rose-500/70",
    preset: {
      business_type: "ecommerce",
      style_vibe: "bold-vibrant",
      hero_style: "fullscreen-photo",
      cta_goal: "buy-product",
      brand_primary: "#EC4899",
      brand_accent: "#111827",
      sections: ["features", "testimonials", "gallery", "faq"],
    },
  },
  {
    id: "local-service",
    niche: "Local Service",
    name: "Local Pros",
    tagline: "Trust badges + service area + quick quote",
    cvr: "Avg 6.4% CVR",
    avgLaunch: "3 min to live",
    image: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600&h=400&fit=crop",
    accent: "from-sky-500/70 to-cyan-500/70",
    preset: {
      business_type: "local_service",
      style_vibe: "corporate-pro",
      hero_style: "big-headline-image",
      cta_goal: "contact",
      brand_primary: "#0EA5E9",
      brand_accent: "#0C4A6E",
      sections: ["services", "testimonials", "faq", "contact"],
    },
  },
  {
    id: "coach-course",
    niche: "Coach / Course",
    name: "Personal Brand",
    tagline: "Story-driven hero + results + waitlist",
    cvr: "Avg 4.9% CVR",
    avgLaunch: "4 min to live",
    image: "https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=600&h=400&fit=crop",
    accent: "from-violet-500/70 to-fuchsia-500/70",
    preset: {
      business_type: "coach",
      style_vibe: "minimal-clean",
      hero_style: "split-screen",
      cta_goal: "join-waitlist",
      brand_primary: "#7C3AED",
      brand_accent: "#1E1B4B",
      sections: ["about", "testimonials", "pricing", "faq"],
    },
  },
  {
    id: "restaurant-menu",
    niche: "Restaurant",
    name: "Neighborhood Restaurant",
    tagline: "Menu highlights + reservations + location",
    cvr: "Avg 7.2% CVR",
    avgLaunch: "3 min to live",
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&h=400&fit=crop",
    accent: "from-amber-500/70 to-red-500/70",
    preset: {
      business_type: "restaurant",
      style_vibe: "luxury-gold",
      hero_style: "fullscreen-photo",
      cta_goal: "book-call",
      brand_primary: "#B45309",
      brand_accent: "#78350F",
      sections: ["gallery", "testimonials", "contact"],
    },
  },
  {
    id: "real-estate",
    niche: "Real Estate",
    name: "Agent Brand",
    tagline: "Listing grid + bio + valuation CTA",
    cvr: "Avg 5.1% CVR",
    avgLaunch: "4 min to live",
    image: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&h=400&fit=crop",
    accent: "from-slate-700/70 to-amber-500/70",
    preset: {
      business_type: "real_estate",
      style_vibe: "luxury-gold",
      hero_style: "big-headline-image",
      cta_goal: "contact",
      brand_primary: "#C9A84C",
      brand_accent: "#1E293B",
      sections: ["gallery", "about", "testimonials", "contact"],
    },
  },
  {
    id: "portfolio",
    niche: "Portfolio",
    name: "Creative Showcase",
    tagline: "Full-bleed work + case study + contact",
    cvr: "Avg 3.8% CVR",
    avgLaunch: "3 min to live",
    image: "https://images.unsplash.com/photo-1522542550221-31fd19575a2d?w=600&h=400&fit=crop",
    accent: "from-orange-500/70 to-amber-500/70",
    preset: {
      business_type: "portfolio",
      style_vibe: "editorial",
      hero_style: "fullscreen-photo",
      cta_goal: "contact",
      brand_primary: "#F97316",
      brand_accent: "#18181B",
      sections: ["gallery", "about", "contact"],
    },
  },
  {
    id: "waitlist",
    niche: "Pre-launch",
    name: "Waitlist Page",
    tagline: "Countdown + email capture + social proof",
    cvr: "Avg 12.4% CVR",
    avgLaunch: "2 min to live",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&h=400&fit=crop",
    accent: "from-emerald-500/70 to-teal-500/70",
    preset: {
      business_type: "saas",
      style_vibe: "dark-cinematic",
      hero_style: "interactive-gradient",
      cta_goal: "join-waitlist",
      brand_primary: "#10B981",
      brand_accent: "#064E3B",
      sections: ["features", "testimonials"],
    },
  },
];

type ViewportMode = "desktop" | "tablet" | "mobile";

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

function effectiveStatus(p: WebsiteProject): string {
  if (p.status === "preview" && p.demo_expires_at && new Date(p.demo_expires_at).getTime() < Date.now()) {
    return "expired";
  }
  return p.status;
}

export default function WebsitesPage() {
  useAuth();
  const supabase = createClient();

  const [projects, setProjects] = useState<WebsiteProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Array<{ id: string; business_name: string; industry: string | null }>>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardPreset, setWizardPreset] = useState<Record<string, unknown>>({});

  // Active project for the result panel
  const [active, setActive] = useState<WebsiteProject | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [viewport, setViewport] = useState<ViewportMode>("desktop");

  // Pricing modal
  const [pricingFor, setPricingFor] = useState<WebsiteProject | null>(null);
  const [quote, setQuote] = useState<PriceQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [activeAddons, setActiveAddons] = useState<string[]>([]);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [subscribing, setSubscribing] = useState(false);

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

  /* ─────────────────────────────── Wizard steps ────────────────────────────── */

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
      description: "You can change this later. Free demo first, then upgrade.",
      icon: <Link2 size={16} />,
      field: {
        type: "choice-cards",
        key: "domain_strategy",
        options: [
          { value: "subdomain", label: "Use a free subdomain", description: "demo-mysite.shortstack.work", emoji: "🆓" },
          { value: "buy-new", label: "Buy a new domain", description: "$12-35/yr via GoDaddy", emoji: "🌐" },
          { value: "connect-existing", label: "Connect existing domain", description: "You already own one", emoji: "🔗" },
        ],
      },
    },
  ];

  /* ─────────────────────────── Template picker helpers ───────────────────────── */

  function pickTemplate(t: NicheTemplate): void {
    setWizardPreset({
      ...t.preset,
      visuals: "stock-photos",
      domain_strategy: "subdomain",
    });
    setWizardOpen(true);
  }

  function startBlank(): void {
    setWizardPreset({
      brand_primary: "#C9A84C",
      brand_accent: "#0F172A",
      sections: ["about", "features", "testimonials", "faq"],
      visuals: "stock-photos",
      domain_strategy: "subdomain",
    });
    setWizardOpen(true);
  }

  /* ─────────────────────────── Generate, deploy, demo ───────────────────────── */

  async function deployDemo(projectId: string): Promise<void> {
    try {
      const res = await fetch(`/api/websites/${projectId}/demo`, { method: "POST" });
      const out = await res.json();
      if (!out.success) {
        toast.error(out.error || "Demo deployment failed");
      }
    } catch {
      toast.error("Demo deployment failed");
    }
  }

  async function handleWizardComplete(data: Record<string, unknown>) {
    toast.loading("Designing your site\u2026", { id: "gen" });
    try {
      const res = await fetch("/api/websites/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: data }),
      });
      const out = await res.json();
      toast.dismiss("gen");
      if (!out.success) {
        toast.error(out.error || "Generation failed");
        return;
      }

      toast.success("Website generated! Deploying demo…");
      // Auto-deploy to free demo subdomain
      await deployDemo(out.project_id);
      await loadData();
      const { data: row } = await supabase
        .from("website_projects")
        .select("*")
        .eq("id", out.project_id)
        .single();
      if (row) {
        const wp = row as WebsiteProject;
        setActive(wp);
        setWizardOpen(false);
        // Let the user SEE the demo first — they open pricing when ready
        toast.success(
          "Your demo is live! Try it out — go live when you're ready.",
          { duration: 6000 },
        );
      }
    } catch {
      toast.dismiss("gen");
      toast.error("Generation failed");
    }
  }

  async function regenerate(project: WebsiteProject) {
    setRegenerating(true);
    toast.loading("Regenerating\u2026", { id: "regen" });
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
        toast.success("Regenerated — redeploying demo…");
        await deployDemo(project.id);
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

  async function shareDemo(p: WebsiteProject) {
    const url = p.preview_url || p.vercel_url;
    if (!url) {
      toast.error("Demo not deployed yet");
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Demo URL copied — share with your client!");
    } catch {
      toast.error("Failed to copy");
    }
  }

  async function extendDemo(p: WebsiteProject) {
    if (!confirm("Extend demo by 7 days for $2?")) return;
    toast.loading("Extending demo…", { id: "ext" });
    try {
      const res = await fetch(`/api/websites/${p.id}/extend-demo`, { method: "POST" });
      const out = await res.json();
      toast.dismiss("ext");
      if (out.success) {
        if (out.checkout_url && !out.simulated) {
          window.location.href = out.checkout_url;
        } else {
          toast.success(out.simulated ? "Demo extended 7 days (simulated)" : "Demo extended");
          loadData();
        }
      } else {
        toast.error(out.error || "Extend failed");
      }
    } catch {
      toast.dismiss("ext");
      toast.error("Extend failed");
    }
  }

  /* ─────────────────────────── Pricing modal ─────────────────────────── */

  async function openPricing(p: WebsiteProject) {
    setPricingFor(p);
    setActiveAddons(Array.isArray(p.addons) ? p.addons : []);
    setBillingCycle("monthly");
    await loadQuote(p, Array.isArray(p.addons) ? p.addons : []);
  }

  async function loadQuote(p: WebsiteProject, addons: string[]) {
    setQuoteLoading(true);
    try {
      const res = await fetch(`/api/websites/${p.id}/price-quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addons }),
      });
      const out = await res.json();
      if (out.success) setQuote(out.quote);
    } catch {
      // ignore
    }
    setQuoteLoading(false);
  }

  function toggleAddon(key: string) {
    if (!pricingFor) return;
    const next = activeAddons.includes(key)
      ? activeAddons.filter((a) => a !== key)
      : [...activeAddons, key];
    setActiveAddons(next);
    loadQuote(pricingFor, next);
  }

  async function subscribe() {
    if (!pricingFor || !quote) return;
    setSubscribing(true);
    try {
      const res = await fetch(`/api/websites/${pricingFor.id}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: quote.tier,
          monthly_price: quote.monthly_price,
          yearly_price: quote.yearly_price,
          billing_cycle: billingCycle,
          addons: activeAddons,
        }),
      });
      const out = await res.json();
      if (out.success) {
        if (out.checkout_url && !out.simulated) {
          window.location.href = out.checkout_url;
        } else {
          toast.success(out.simulated ? "Site is live (stub mode)" : "Subscribed!");
          setPricingFor(null);
          loadData();
        }
      } else {
        toast.error(out.error || "Subscribe failed");
      }
    } catch {
      toast.error("Subscribe failed");
    }
    setSubscribing(false);
  }

  /* ─────────────────────────── Render ─────────────────────────── */

  const indexHtml = active?.generated_files?.["index.html"] || "";

  return (
    <div className="fade-in space-y-5">
      <PageHero
        icon={<Globe size={28} />}
        title="Websites that convert"
        subtitle="Pick a niche. Get a high-converting client site live in 3 minutes &mdash; proven to convert at 4-6%."
        gradient="sunset"
        actions={
          <>
            <div className="flex items-center gap-1.5 text-[10px] text-white/80 bg-white/10 border border-white/20 px-2 py-1 rounded-lg">
              <VercelIcon size={12} /> Vercel
              <span className="opacity-40">&middot;</span>
              <GoDaddyIcon size={12} /> GoDaddy
            </div>
            <button
              onClick={startBlank}
              className="text-xs px-3 py-2 rounded-lg border border-white/25 text-white/90 hover:bg-white/10 hover:border-white/40 flex items-center gap-1.5"
            >
              <Plus size={13} /> Build from scratch
            </button>
          </>
        }
      />

      {/* Social proof strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl border border-border bg-gradient-to-r from-amber-500/[0.04] via-transparent to-emerald-500/[0.04]">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 text-[11px] text-foreground/90">
            <TrendingUp size={12} className="text-emerald-400" />
            <span className="font-semibold">1,240+ sites</span>
            <span className="text-muted">launched this month</span>
          </div>
          <span className="w-px h-4 bg-border" />
          <div className="flex items-center gap-1.5 text-[11px] text-foreground/90">
            <Target size={12} className="text-amber-400" />
            <span className="font-semibold">4.6% avg CVR</span>
            <span className="text-muted">across templates</span>
          </div>
          <span className="w-px h-4 bg-border hidden sm:block" />
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-foreground/90">
            <Clock size={12} className="text-sky-400" />
            <span className="font-semibold">3 min</span>
            <span className="text-muted">median time to live</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {["A", "M", "J", "K", "R"].map((l, i) => (
            <span
              key={i}
              className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400/30 to-orange-500/30 border border-border text-[9px] font-semibold flex items-center justify-center text-foreground/80"
              style={{ marginLeft: i === 0 ? 0 : -6 }}
            >
              {l}
            </span>
          ))}
          <span className="text-[10px] text-muted ml-2">Trusted by agencies & freelancers</span>
        </div>
      </div>

      {/* Wizard */}
      <CreationWizard
        open={wizardOpen}
        title="Website Builder"
        subtitle="A few quick questions &mdash; then a live demo URL you can share in minutes."
        icon={<Globe size={18} />}
        submitLabel="Generate my site"
        initialData={wizardPreset}
        steps={steps}
        onClose={() => setWizardOpen(false)}
        onComplete={handleWizardComplete}
      />

      {/* ──────────────────── Niche template gallery ──────────────────── */}
      <div className="space-y-3">
        <div className="flex items-end justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Layout size={14} className="text-gold" />
              Pick a niche. Ship in 30 seconds.
            </h2>
            <p className="text-[11px] text-muted mt-0.5">
              Battle-tested templates &mdash; every one is prewired for conversion.
            </p>
          </div>
          <button
            onClick={startBlank}
            className="text-[10px] px-3 py-1.5 rounded-lg border border-border text-muted hover:text-foreground hover:border-gold/30 flex items-center gap-1"
          >
            Start from a blank canvas <ArrowRight size={10} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 [perspective:1200px]">
          {NICHE_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => pickTemplate(t)}
              className="group relative text-left rounded-2xl overflow-hidden border border-border bg-surface-light shadow-xl shadow-black/30 transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/10 hover:-translate-y-1 hover:border-gold/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 [transform-style:preserve-3d] hover:[transform:rotateX(2deg)_rotateY(-2deg)]"
            >
              {/* Preview image */}
              <div className="relative aspect-[3/2] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={t.image}
                  alt={`${t.niche} template preview`}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.08]"
                />
                <div className={`absolute inset-0 bg-gradient-to-tr ${t.accent} mix-blend-multiply opacity-70`} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

                {/* Niche chip */}
                <span className="absolute top-2.5 left-2.5 text-[9px] px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-md text-white border border-white/20 font-medium tracking-wide uppercase">
                  {t.niche}
                </span>
                {/* CVR metric */}
                <span className="absolute top-2.5 right-2.5 text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/90 backdrop-blur-md text-black border border-white/30 font-semibold flex items-center gap-1">
                  <TrendingUp size={9} /> {t.cvr}
                </span>

                {/* Bottom overlay content */}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-[13px] font-bold text-white drop-shadow-sm">{t.name}</p>
                  <p className="text-[10px] text-white/80 mt-0.5 line-clamp-2">{t.tagline}</p>
                </div>
              </div>

              {/* Footer bar */}
              <div className="flex items-center justify-between px-3 py-2.5 bg-surface">
                <span className="text-[10px] text-muted flex items-center gap-1">
                  <Clock size={10} className="text-gold/70" /> {t.avgLaunch}
                </span>
                <span className="text-[10px] text-gold font-semibold flex items-center gap-1 transition-transform duration-200 group-hover:translate-x-0.5">
                  Use this <ArrowRight size={11} />
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Demo-ready banner — shown while demo is live and not yet subscribed */}
      {active && effectiveStatus(active) === "preview" && (
        <div className="card p-4 bg-gradient-to-br from-emerald-500/[0.06] to-transparent border-emerald-500/30 fade-in">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <Rocket size={18} className="text-emerald-400" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <p className="text-xs font-semibold text-emerald-400">Your demo is live &mdash; try it before you pay</p>
              <p className="text-[10px] text-muted">
                Free for {daysUntil(active.demo_expires_at) ?? 14} days. Go live anytime when you&apos;re ready &mdash; custom monthly price based on what&apos;s in your site.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {(active.preview_url || active.vercel_url) && (
                <a
                  href={active.preview_url || active.vercel_url || "#"}
                  target="_blank"
                  rel="noopener"
                  className="text-[10px] px-3 py-2 rounded-lg bg-white/5 border border-border text-foreground hover:bg-white/10 flex items-center gap-1"
                >
                  <ExternalLink size={11} /> View demo
                </a>
              )}
              <button
                onClick={() => openPricing(active)}
                className="text-[10px] px-3 py-2 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 text-black font-bold flex items-center gap-1 hover:shadow-lg hover:shadow-amber-400/30"
              >
                <Rocket size={11} /> See pricing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active project result */}
      {active && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-sm font-semibold truncate">{active.name}</h2>
              <span className={`text-[9px] px-2 py-0.5 rounded-full border ${STATUS_BADGE[effectiveStatus(active)] || STATUS_BADGE.draft}`}>
                {STATUS_LABEL[effectiveStatus(active)] || active.status}
              </span>
              {effectiveStatus(active) === "preview" && active.demo_expires_at && (
                <span className="text-[9px] px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 inline-flex items-center gap-1">
                  <Clock size={9} /> {daysUntil(active.demo_expires_at)} days left
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => regenerate(active)}
                disabled={regenerating}
                aria-label="Regenerate website"
                className="text-[10px] px-3 py-1.5 rounded-lg border border-border text-muted hover:text-foreground flex items-center gap-1 disabled:opacity-50"
              >
                {regenerating ? <Loader size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                Regenerate
              </button>
              <button
                onClick={() => shareDemo(active)}
                className="text-[10px] px-3 py-1.5 rounded-lg border border-border text-muted hover:text-foreground flex items-center gap-1"
              >
                <Share2 size={10} /> Share Demo
              </button>
              <button
                onClick={() => openPricing(active)}
                className="text-[10px] px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 text-black font-bold flex items-center gap-1"
              >
                <Rocket size={10} /> Go Live
              </button>
              <button
                onClick={() => deploy(active)}
                disabled={deploying || !indexHtml}
                className="text-[10px] px-3 py-1.5 rounded-lg bg-black text-white hover:bg-black/80 flex items-center gap-1 disabled:opacity-50"
              >
                {deploying ? <Loader size={10} className="animate-spin" /> : <VercelIcon size={10} />}
                Deploy
              </button>
              {active.vercel_url && (
                <a href={active.vercel_url} target="_blank" rel="noopener" className="text-[10px] px-3 py-1.5 rounded-lg border border-border text-muted hover:text-foreground flex items-center gap-1">
                  <ExternalLink size={10} /> Open
                </a>
              )}
            </div>
          </div>

          {(active.preview_url || active.vercel_url) && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-surface-light border border-border">
              <a href={active.preview_url || active.vercel_url || "#"} target="_blank" rel="noopener" className="text-[11px] text-gold hover:text-gold-light truncate">
                {active.preview_url || active.vercel_url}
              </a>
              <button onClick={() => { navigator.clipboard.writeText(active.preview_url || active.vercel_url || ""); toast.success("Copied"); }}>
                <Copy size={11} className="text-muted hover:text-foreground" />
              </button>
            </div>
          )}

          {/* Viewport toggle + open-in-new-tab */}
          {indexHtml && (
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center rounded-lg border border-border bg-surface-light p-0.5">
                {[
                  { id: "desktop" as const, label: "Desktop", Icon: Monitor },
                  { id: "tablet" as const, label: "Tablet", Icon: Tablet },
                  { id: "mobile" as const, label: "Mobile", Icon: Smartphone },
                ].map((v) => {
                  const on = viewport === v.id;
                  return (
                    <button
                      key={v.id}
                      onClick={() => setViewport(v.id)}
                      aria-label={v.label}
                      aria-pressed={on}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] transition ${
                        on ? "bg-gold text-black font-semibold" : "text-muted hover:text-foreground"
                      }`}
                    >
                      <v.Icon size={11} /> {v.label}
                    </button>
                  );
                })}
              </div>
              {(active.preview_url || active.vercel_url) && (
                <a
                  href={active.preview_url || active.vercel_url || "#"}
                  target="_blank"
                  rel="noopener"
                  className="text-[10px] px-3 py-1.5 rounded-lg border border-border text-muted hover:text-foreground hover:border-gold/30 flex items-center gap-1"
                >
                  <ExternalLink size={10} /> Open in new tab
                </a>
              )}
            </div>
          )}

          {indexHtml ? (
            <div className="rounded-xl border border-border overflow-hidden bg-[#1a1c23] flex items-center justify-center p-3" style={{ height: 640 }}>
              <div
                className="bg-white transition-all duration-300 shadow-2xl shadow-black/40 rounded-lg overflow-hidden"
                style={{
                  width: viewport === "desktop" ? "100%" : viewport === "tablet" ? 768 : 390,
                  maxWidth: "100%",
                  height: "100%",
                }}
              >
                <iframe srcDoc={indexHtml} className="w-full h-full border-0" title="Website preview" sandbox="allow-scripts" />
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-xs text-muted">
              <Loader size={18} className="animate-spin mx-auto mb-2" />
              Generating&hellip;
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
            <p className="text-xs text-muted mb-3">No websites yet. Pick a niche template above and you&apos;ll have a live demo URL in 3 minutes &mdash; no card required.</p>
            <button
              onClick={startBlank}
              className="text-xs px-4 py-2 rounded-lg border border-border text-muted hover:text-foreground hover:border-gold/30 inline-flex items-center gap-1.5"
            >
              <Plus size={12} /> Or build from scratch
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {projects.map((p) => {
              const html = p.generated_files?.["index.html"] || "";
              const clientName = clients.find((c) => c.id === p.client_id)?.business_name;
              const status = effectiveStatus(p);
              const days = daysUntil(p.demo_expires_at);
              return (
                <div key={p.id} className="card-hover p-0 overflow-hidden shadow-lg shadow-black/20 transition-transform duration-300 hover:-translate-y-0.5">
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
                    <span className={`absolute top-2 right-2 text-[9px] px-2 py-0.5 rounded-full border backdrop-blur ${STATUS_BADGE[status] || STATUS_BADGE.draft}`}>
                      {STATUS_LABEL[status] || p.status}
                    </span>
                    {status === "preview" && days !== null && (
                      <span className="absolute top-2 left-2 text-[9px] px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-200 backdrop-blur inline-flex items-center gap-1">
                        <Clock size={9} /> {days}d
                      </span>
                    )}
                    {status === "live" && p.pricing_tier && (
                      <span className={`absolute top-2 left-2 text-[9px] px-2 py-0.5 rounded-full text-white bg-gradient-to-r ${TIER_COLOR[p.pricing_tier] || TIER_COLOR.starter}`}>
                        {p.pricing_tier}
                      </span>
                    )}
                  </div>

                  <div className="p-3 space-y-2">
                    <div>
                      <p className="text-xs font-semibold truncate">{p.name}</p>
                      <p className="text-[9px] text-muted truncate">
                        {clientName ? `${clientName} · ` : ""}
                        {p.industry || p.template_style || "uncategorized"}
                      </p>
                    </div>

                    {(p.preview_url || p.vercel_url || p.custom_domain) && (
                      <a
                        href={p.custom_domain ? `https://${p.custom_domain}` : (p.preview_url || p.vercel_url || "#")}
                        target="_blank"
                        rel="noopener"
                        className="text-[10px] text-gold hover:text-gold-light truncate block"
                      >
                        {p.custom_domain || p.preview_url || p.vercel_url}
                      </a>
                    )}

                    <div className="flex items-center justify-between pt-1 gap-1">
                      <div className="flex items-center gap-1 flex-wrap">
                        <button onClick={() => setActive(p)} className="text-[10px] px-2 py-1 rounded-md bg-gold/10 text-gold hover:bg-gold/20 flex items-center gap-1">
                          <Eye size={10} /> Open
                        </button>
                        {status === "preview" && (
                          <>
                            <button onClick={() => openPricing(p)} className="text-[10px] px-2 py-1 rounded-md bg-gradient-to-r from-amber-400 to-orange-500 text-black font-semibold flex items-center gap-1">
                              <Rocket size={10} /> Go Live
                            </button>
                            <button onClick={() => shareDemo(p)} className="text-[10px] px-2 py-1 rounded-md border border-border text-muted hover:text-foreground flex items-center gap-1">
                              <Share2 size={10} />
                            </button>
                          </>
                        )}
                        {status === "expired" && (
                          <button onClick={() => extendDemo(p)} className="text-[10px] px-2 py-1 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-300 flex items-center gap-1">
                            <Calendar size={10} /> Extend
                          </button>
                        )}
                        {status === "live" && p.monthly_price && (
                          <span className="text-[10px] px-2 py-1 rounded-md bg-green-500/10 text-green-400 border border-green-500/30 inline-flex items-center gap-1">
                            <DollarSign size={10} />{p.monthly_price}/mo
                          </span>
                        )}
                      </div>
                      <button onClick={() => deleteProject(p.id)} aria-label={`Delete ${p.name}`} className="p-1 rounded-md hover:bg-red-500/10 text-muted hover:text-red-400">
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
            <Layout size={12} className="text-gold" /> 1. Pick a niche
          </h3>
          <p className="text-[10px] text-muted">Nine battle-tested templates, each one prewired for the conversion pattern that niche responds to.</p>
        </div>
        <div className="card border-gold/10">
          <h3 className="section-header flex items-center gap-2">
            <Rocket size={12} className="text-gold" /> 2. Share the demo
          </h3>
          <p className="text-[10px] text-muted">Auto-deployed to a live URL in under 3 minutes. Send it to your client &mdash; free for 14 days, no card.</p>
        </div>
        <div className="card border-gold/10">
          <h3 className="section-header flex items-center gap-2">
            <DollarSign size={12} className="text-gold" /> 3. Go live, get paid
          </h3>
          <p className="text-[10px] text-muted">Connect a domain and subscribe. Transparent monthly pricing based on what&apos;s actually in the site.</p>
        </div>
      </div>

      <div className="card border-gold/10">
        <h3 className="text-[11px] font-semibold flex items-center gap-1.5 mb-2">
          <ShieldCheck size={11} className="text-gold" /> Every template ships with
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] text-muted">
          <div className="flex items-start gap-1.5"><CheckCircle size={10} className="text-success mt-0.5 shrink-0" /> Bold hero headline + subheader</div>
          <div className="flex items-start gap-1.5"><CheckCircle size={10} className="text-success mt-0.5 shrink-0" /> Social proof above the fold</div>
          <div className="flex items-start gap-1.5"><CheckCircle size={10} className="text-success mt-0.5 shrink-0" /> CTA repeated 3+ times</div>
          <div className="flex items-start gap-1.5"><CheckCircle size={10} className="text-success mt-0.5 shrink-0" /> Benefit-driven copy</div>
          <div className="flex items-start gap-1.5"><CheckCircle size={10} className="text-success mt-0.5 shrink-0" /> Mobile-first responsive</div>
          <div className="flex items-start gap-1.5"><CheckCircle size={10} className="text-success mt-0.5 shrink-0" /> Trust badges & guarantees</div>
          <div className="flex items-start gap-1.5"><CheckCircle size={10} className="text-success mt-0.5 shrink-0" /> Lighthouse 90+ scores</div>
          <div className="flex items-start gap-1.5"><CheckCircle size={10} className="text-success mt-0.5 shrink-0" /> Scroll-reveal animations</div>
        </div>
      </div>

      {/* Pricing modal */}
      {pricingFor && (
        <PricingModal
          project={pricingFor}
          quote={quote}
          quoteLoading={quoteLoading}
          activeAddons={activeAddons}
          billingCycle={billingCycle}
          subscribing={subscribing}
          onClose={() => setPricingFor(null)}
          onToggleAddon={toggleAddon}
          onCycleChange={setBillingCycle}
          onSubscribe={subscribe}
        />
      )}
    </div>
  );
}

/* ────────────────────────── Pricing modal component ────────────────────────── */

function PricingModal({
  project,
  quote,
  quoteLoading,
  activeAddons,
  billingCycle,
  subscribing,
  onClose,
  onToggleAddon,
  onCycleChange,
  onSubscribe,
}: {
  project: WebsiteProject;
  quote: PriceQuote | null;
  quoteLoading: boolean;
  activeAddons: string[];
  billingCycle: "monthly" | "yearly";
  subscribing: boolean;
  onClose: () => void;
  onToggleAddon: (k: string) => void;
  onCycleChange: (c: "monthly" | "yearly") => void;
  onSubscribe: () => void;
}) {
  const indexHtml = project.generated_files?.["index.html"] || "";
  const display = billingCycle === "yearly" ? quote?.yearly_price : quote?.monthly_price;
  const cyclePer = billingCycle === "yearly" ? "/yr" : "/mo";
  const tier = quote?.tier || "starter";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm fade-in" onClick={onClose}>
      <div
        className="card max-w-5xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold flex items-center gap-2">
              <Rocket size={16} className="text-gold" /> Your Website is Ready!
            </h2>
            <p className="text-[11px] text-muted">{project.name} — pick a plan to go live.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5"><X size={14} /></button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Live preview */}
          <div className="rounded-xl border border-border overflow-hidden bg-[#1a1c23]" style={{ height: 480 }}>
            {indexHtml ? (
              <iframe srcDoc={indexHtml} className="w-full h-full" title="Live preview" sandbox="allow-scripts" />
            ) : (
              <div className="h-full flex items-center justify-center text-muted text-xs">
                <Loader size={16} className="animate-spin" />
              </div>
            )}
          </div>

          {/* Pricing details */}
          <div className="space-y-3">
            {/* Tier badge + price */}
            <div className={`rounded-xl p-4 text-white bg-gradient-to-br ${TIER_COLOR[tier]}`}>
              <p className="text-[10px] uppercase tracking-wider opacity-80">Recommended tier</p>
              <p className="text-lg font-bold capitalize">{tier}</p>
              <div className="flex items-baseline gap-1 mt-2">
                {quoteLoading ? (
                  <Loader size={20} className="animate-spin" />
                ) : (
                  <>
                    <span className="text-3xl font-bold">${display ?? "—"}</span>
                    <span className="text-xs opacity-90">{cyclePer}</span>
                  </>
                )}
              </div>
              {billingCycle === "yearly" && quote && (
                <p className="text-[10px] opacity-90 mt-1">
                  Save 17% — equiv ${(quote.yearly_price / 12).toFixed(2)}/mo
                </p>
              )}
            </div>

            {/* Billing cycle toggle */}
            <div className="flex items-center bg-surface-light border border-border rounded-lg p-0.5">
              <button
                className={`flex-1 text-[10px] py-1.5 rounded-md transition ${billingCycle === "monthly" ? "bg-gold text-black font-semibold" : "text-muted"}`}
                onClick={() => onCycleChange("monthly")}
              >
                Monthly
              </button>
              <button
                className={`flex-1 text-[10px] py-1.5 rounded-md transition ${billingCycle === "yearly" ? "bg-gold text-black font-semibold" : "text-muted"}`}
                onClick={() => onCycleChange("yearly")}
              >
                Yearly <span className="text-[9px] opacity-80">(-17%)</span>
              </button>
            </div>

            {/* Breakdown */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-2">Price breakdown</p>
              <div className="space-y-1">
                {quote?.breakdown.map((b, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] py-1 border-b border-border/40">
                    <span className="text-foreground">{b.item}</span>
                    <span className="text-muted">${b.price}</span>
                  </div>
                ))}
                {!quote?.breakdown?.length && !quoteLoading && (
                  <p className="text-[11px] text-muted">Calculating…</p>
                )}
              </div>
            </div>

            {/* Addons */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-2">Customize your plan</p>
              <div className="space-y-1.5">
                {ALL_ADDONS.map((a) => {
                  const active = activeAddons.includes(a.key);
                  return (
                    <button
                      key={a.key}
                      onClick={() => onToggleAddon(a.key)}
                      className={`w-full flex items-center justify-between p-2 rounded-lg border text-left transition ${active ? "border-gold bg-gold/10" : "border-border hover:border-gold/30"}`}
                    >
                      <span className="flex items-center gap-2 text-[11px]">
                        <span className={active ? "text-gold" : "text-muted"}>{a.icon}</span>
                        {a.label}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-[10px] text-muted">+${a.price}/mo</span>
                        <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${active ? "bg-gold border-gold" : "border-border"}`}>
                          {active && <Check size={10} className="text-black" />}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CTA */}
            <div className="space-y-2 pt-2">
              <button
                onClick={onSubscribe}
                disabled={subscribing || quoteLoading || !quote}
                className="w-full text-xs px-4 py-3 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 text-black font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {subscribing ? <Loader size={12} className="animate-spin" /> : <Rocket size={12} />}
                Go Live — ${display}{cyclePer}
              </button>
              <button
                onClick={onClose}
                className="w-full text-[11px] px-4 py-2 rounded-lg border border-border text-muted hover:text-foreground"
              >
                Continue Demo (14 days free)
              </button>
            </div>
          </div>
        </div>

        {/* Comparison */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="card border-border">
            <h3 className="text-[11px] font-semibold mb-2 flex items-center gap-1.5">
              <Eye size={11} className="text-muted" /> Free Demo
            </h3>
            <ul className="text-[10px] text-muted space-y-1">
              <li className="flex items-center gap-1"><Check size={9} className="text-success" /> Shareable demo URL</li>
              <li className="flex items-center gap-1"><Check size={9} className="text-success" /> 14-day access</li>
              <li className="flex items-center gap-1"><Check size={9} className="text-success" /> Vercel preview hosting</li>
              <li className="flex items-center gap-1 text-muted/60"><X size={9} /> ShortStack watermark</li>
              <li className="flex items-center gap-1 text-muted/60"><X size={9} /> No custom domain</li>
              <li className="flex items-center gap-1 text-muted/60"><X size={9} /> No analytics</li>
            </ul>
          </div>
          <div className="card border-gold/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
            <h3 className="text-[11px] font-semibold mb-2 flex items-center gap-1.5">
              <Crown size={11} className="text-gold" /> Paid Plan
            </h3>
            <ul className="text-[10px] text-muted space-y-1">
              <li className="flex items-center gap-1"><Check size={9} className="text-success" /> Everything in demo</li>
              <li className="flex items-center gap-1"><Check size={9} className="text-success" /> No watermark</li>
              <li className="flex items-center gap-1"><Check size={9} className="text-success" /> Custom domain support</li>
              <li className="flex items-center gap-1"><Check size={9} className="text-success" /> Production hosting</li>
              <li className="flex items-center gap-1"><Check size={9} className="text-success" /> Analytics + uptime</li>
              <li className="flex items-center gap-1"><Check size={9} className="text-success" /> Cancel anytime</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
