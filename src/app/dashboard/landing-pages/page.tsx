"use client";

import { useState, useCallback, useRef } from "react";
import {
  Globe, Sparkles, Layout, Eye, Pencil, Trash2, Copy, Rocket,
  ChevronUp, ChevronDown, EyeOff, RotateCcw, Plus, X, Check,
  ArrowRight, Monitor, Shield, Clock, BarChart3, Users,
  Timer, TrendingUp, Search,
  Building2, UtensilsCrossed, Home, Dumbbell, ShoppingBag,
  Briefcase, CalendarDays, GripVertical,
  Mail, FileText, Upload, Target, Megaphone,
  Image as ImageIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import PageHero from "@/components/ui/page-hero";
import { LayoutTemplate } from "lucide-react";
import PageAI from "@/components/page-ai";
import { Wizard, AdvancedToggle, useAdvancedMode, type WizardStepDef } from "@/components/ui/wizard";
import AIEnhanceButton from "@/components/ui/ai-enhance-button";

/* ══════════════════════════════════════════════════════════════════
   TYPES
   ══════════════════════════════════════════════════════════════════ */

interface Feature { icon: string; title: string; description: string }
interface Testimonial { name: string; company: string; quote: string; role: string; avatar?: string }
interface PricingTier { name: string; price: string; period: string; features: string[]; highlighted: boolean }
interface FAQItem { question: string; answer: string }
interface ContactInfo { heading: string; subheading: string; email: string; phone: string }
interface FooterLink { label: string; url: string }
interface SocialLink { platform: string; url: string }

interface HeroSection { headline: string; subheadline: string; cta_text: string; cta_url: string }
interface FooterSection { copyright: string; links: FooterLink[]; social: SocialLink[] }

interface LandingPageContent {
  hero: HeroSection;
  features: Feature[];
  testimonials: Testimonial[];
  pricing: PricingTier[];
  faq: FAQItem[];
  contact: ContactInfo;
  footer: FooterSection;
}

type SectionKey = "hero" | "features" | "testimonials" | "pricing" | "faq" | "contact" | "footer";

interface SectionState {
  key: SectionKey;
  label: string;
  visible: boolean;
  editing: boolean;
}

interface GeneratedPage {
  id: string;
  name: string;
  template: string;
  created: string;
  status: "Draft" | "Published" | "Archived";
  views: number;
  conversions: number;
  url?: string;
}

interface Deployment {
  id: string;
  timestamp: string;
  status: "Success" | "Failed" | "Building";
  url: string;
  commit: string;
}

interface BusinessInfo {
  name: string;
  industry: string;
  tagline: string;
  description: string;
  targetAudience: string;
  benefits: string[];
  ctaText: string;
  ctaUrl: string;
  colorScheme: string;
}

/* ══════════════════════════════════════════════════════════════════
   CONSTANTS
   ══════════════════════════════════════════════════════════════════ */

const COLOR_SCHEMES = [
  { id: "modern-dark", name: "Modern Dark", bg: "#0f172a", primary: "#3b82f6", accent: "#60a5fa", text: "#f1f5f9" },
  { id: "clean-light", name: "Clean Light", bg: "#ffffff", primary: "#2563eb", accent: "#3b82f6", text: "#1e293b" },
  { id: "bold-gradient", name: "Bold Gradient", bg: "linear-gradient(135deg,#6366f1,#ec4899)", primary: "#8b5cf6", accent: "#f472b6", text: "#ffffff" },
  { id: "minimal", name: "Minimal", bg: "#fafafa", primary: "#18181b", accent: "#71717a", text: "#18181b" },
  { id: "luxury-gold", name: "Luxury Gold", bg: "#0a0a0a", primary: "#C9A84C", accent: "#d4af37", text: "#f5f5f5" },
];

const TEMPLATES = [
  { id: "saas", name: "SaaS Landing", desc: "Hero + features + pricing + testimonials", icon: Monitor, color: "#3b82f6", gradient: "from-blue-600 to-cyan-500" },
  { id: "agency", name: "Agency Portfolio", desc: "Hero + services + case studies + contact", icon: Building2, color: "#8b5cf6", gradient: "from-purple-600 to-pink-500" },
  { id: "restaurant", name: "Restaurant", desc: "Hero + menu highlights + location + reservations", icon: UtensilsCrossed, color: "#f59e0b", gradient: "from-amber-500 to-orange-500" },
  { id: "realestate", name: "Real Estate", desc: "Property showcase + search + agent contact", icon: Home, color: "#10b981", gradient: "from-emerald-500 to-teal-500" },
  { id: "fitness", name: "Fitness Studio", desc: "Classes + trainers + pricing + schedule", icon: Dumbbell, color: "#ef4444", gradient: "from-red-500 to-rose-500" },
  { id: "ecommerce", name: "E-commerce", desc: "Product hero + features + reviews + CTA", icon: ShoppingBag, color: "#f97316", gradient: "from-orange-500 to-yellow-500" },
  { id: "consultant", name: "Consultant", desc: "About + services + testimonials + booking", icon: Briefcase, color: "#6366f1", gradient: "from-indigo-500 to-purple-500" },
  { id: "event", name: "Event", desc: "Countdown + speakers + schedule + tickets", icon: CalendarDays, color: "#ec4899", gradient: "from-pink-500 to-rose-500" },
];

const MOCK_PAGES: GeneratedPage[] = [];

const MOCK_DEPLOYMENTS: Deployment[] = [];

const MOCK_ANALYTICS = {
  views: 0, uniqueVisitors: 0, bounceRate: 0, avgTime: "0m 0s",
  conversionRate: 0, formSubmissions: 0,
  sources: [] as { name: string; pct: number }[],
  dailyViews: [] as number[],
};

function defaultContent(): LandingPageContent {
  return {
    hero: {
      headline: "Transform Your Business with Next-Gen Solutions",
      subheadline: "Streamline operations, boost revenue, and delight customers with our all-in-one platform trusted by 10,000+ businesses.",
      cta_text: "Start Free Trial",
      cta_url: "#",
    },
    features: [
      { icon: "Zap", title: "Lightning Fast", description: "Optimized performance that loads in under 200ms. Your visitors never wait." },
      { icon: "Shield", title: "Enterprise Security", description: "Bank-level encryption and SOC 2 compliance to keep your data safe." },
      { icon: "BarChart3", title: "Advanced Analytics", description: "Real-time dashboards and insights to make data-driven decisions." },
      { icon: "Users", title: "Team Collaboration", description: "Built-in tools for seamless teamwork across departments and time zones." },
    ],
    testimonials: [
      { name: "Sarah Chen", company: "Innovate Labs", quote: "This platform transformed how we operate. Revenue is up 40% since switching.", role: "CEO" },
      { name: "Marcus Johnson", company: "GrowthStack", quote: "The best investment we made this year. The analytics alone paid for itself.", role: "Head of Marketing" },
      { name: "Elena Rodriguez", company: "PixelPerfect", quote: "Setup took 15 minutes. Support is incredible. Could not be happier.", role: "Founder" },
    ],
    pricing: [
      { name: "Starter", price: "$29", period: "/month", features: ["5 projects", "Basic analytics", "Email support", "1 team member"], highlighted: false },
      { name: "Professional", price: "$79", period: "/month", features: ["Unlimited projects", "Advanced analytics", "Priority support", "10 team members", "API access"], highlighted: true },
      { name: "Enterprise", price: "$199", period: "/month", features: ["Everything in Pro", "Custom integrations", "Dedicated manager", "Unlimited team", "SLA guarantee", "SSO"], highlighted: false },
    ],
    faq: [
      { question: "How long does setup take?", answer: "Most teams are fully set up in under 15 minutes. Our onboarding wizard guides you through every step." },
      { question: "Can I cancel anytime?", answer: "Absolutely. No contracts, no cancellation fees. You can cancel your subscription at any time from your dashboard." },
      { question: "Do you offer a free trial?", answer: "Yes! Every plan comes with a 14-day free trial. No credit card required to start." },
      { question: "Is my data secure?", answer: "We use AES-256 encryption at rest and TLS 1.3 in transit. We are SOC 2 Type II certified and GDPR compliant." },
      { question: "What integrations do you support?", answer: "We integrate with 200+ tools including Slack, Salesforce, HubSpot, Zapier, and more." },
    ],
    contact: {
      heading: "Get in Touch",
      subheading: "Have questions? Our team is here to help you get started.",
      email: "hello@example.com",
      phone: "(555) 123-4567",
    },
    footer: {
      copyright: "\u00a9 2026 Your Company. All rights reserved.",
      links: [
        { label: "Privacy Policy", url: "#" }, { label: "Terms of Service", url: "#" },
        { label: "Contact", url: "#" }, { label: "Blog", url: "#" },
      ],
      social: [
        { platform: "Twitter", url: "#" }, { platform: "LinkedIn", url: "#" },
        { platform: "GitHub", url: "#" },
      ],
    },
  };
}

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════ */

type MainTab = "create" | "pages" | "deploy" | "analytics";

export default function LandingPagesPage() {
  useAuth();

  /* ── navigation ── */
  const [mainTab, setMainTab] = useState<MainTab>("create");

  /* ── step 1: business info ── */
  const [bizInfo, setBizInfo] = useState<BusinessInfo>({
    name: "", industry: "", tagline: "", description: "",
    targetAudience: "", benefits: [], ctaText: "Get Started", ctaUrl: "#",
    colorScheme: "modern-dark",
  });
  const [benefitInput, setBenefitInput] = useState("");

  /* ── step tracking ── */
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  /* ── step 3: editor ── */
  const [content, setContent] = useState<LandingPageContent>(defaultContent());
  const [sections, setSections] = useState<SectionState[]>([
    { key: "hero", label: "Hero", visible: true, editing: false },
    { key: "features", label: "Features", visible: true, editing: false },
    { key: "testimonials", label: "Testimonials", visible: true, editing: false },
    { key: "pricing", label: "Pricing", visible: true, editing: false },
    { key: "faq", label: "FAQ", visible: true, editing: false },
    { key: "contact", label: "Contact", visible: true, editing: false },
    { key: "footer", label: "Footer", visible: true, editing: false },
  ]);
  const [generating, setGenerating] = useState(false);

  /* ── pages tab ── */
  const [pages, setPages] = useState<GeneratedPage[]>(MOCK_PAGES);
  const [pageSearch, setPageSearch] = useState("");

  /* ── deploy tab ── */
  const [customDomain, setCustomDomain] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [sslStatus] = useState<"active" | "pending" | "none">("active");

  /* ── analytics tab ── */
  const [analyticsPage, setAnalyticsPage] = useState<string>("p1");

  /* ── faq accordion ── */
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  /* ── Guided Mode ↔ Advanced Mode ── */
  const [advancedMode, setAdvancedMode] = useAdvancedMode("landing-pages");
  const [guidedStep, setGuidedStep] = useState(0);
  const [guidedOffer, setGuidedOffer] = useState("");
  const [guidedAudience, setGuidedAudience] = useState("");
  const [guidedTemplate, setGuidedTemplate] = useState<string>("saas");
  const [guidedHeadline, setGuidedHeadline] = useState("");
  const [guidedSubhead, setGuidedSubhead] = useState("");

  const previewRef = useRef<HTMLDivElement>(null);

  /* ── helpers ── */
  const addBenefit = useCallback(() => {
    const v = benefitInput.trim();
    if (!v) return;
    setBizInfo(p => ({ ...p, benefits: [...p.benefits, v] }));
    setBenefitInput("");
  }, [benefitInput]);

  const removeBenefit = (i: number) =>
    setBizInfo(p => ({ ...p, benefits: p.benefits.filter((_, idx) => idx !== i) }));

  const toggleSection = (key: SectionKey) =>
    setSections(s => s.map(sec => sec.key === key ? { ...sec, visible: !sec.visible } : sec));

  const toggleEdit = (key: SectionKey) =>
    setSections(s => s.map(sec => sec.key === key ? { ...sec, editing: !sec.editing } : sec));

  const moveSection = (idx: number, dir: "up" | "down") => {
    const next = [...sections];
    const swap = dir === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setSections(next);
  };

  const handleGenerate = async () => {
    if (!bizInfo.name || !bizInfo.industry) {
      toast.error("Please fill in business name and industry");
      return;
    }
    setGenerating(true);
    toast.loading("AI is generating your landing page...", { id: "gen" });

    try {
      const res = await fetch("/api/landing-pages/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_type: bizInfo.industry,
          product_or_service: bizInfo.description || bizInfo.tagline || bizInfo.name,
          target_audience: bizInfo.targetAudience || "small business owners",
          value_proposition: bizInfo.tagline || undefined,
          template_style: selectedTemplate || "saas",
          include_sections: ["features", "benefits", "testimonials", "faq", "pricing"],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Generation failed", { id: "gen" });
        setGenerating(false);
        return;
      }

      const c = defaultContent();
      c.hero.headline = data.headline || bizInfo.tagline || `${bizInfo.name} — ${bizInfo.industry} Solutions`;
      c.hero.subheadline = data.subheadline || bizInfo.description || c.hero.subheadline;
      c.hero.cta_text = data.hero_cta || bizInfo.ctaText || "Get Started";
      c.hero.cta_url = bizInfo.ctaUrl || "#";
      c.footer.copyright = `\u00a9 2026 ${bizInfo.name}. All rights reserved.`;

      // Map generated sections onto the editor shape
      interface ApiSection { type: string; heading?: string; content: unknown }
      const apiSections: ApiSection[] = Array.isArray(data.sections) ? data.sections : [];
      for (const sec of apiSections) {
        if (sec.type === "features" && Array.isArray(sec.content)) {
          c.features = (sec.content as Array<{ name?: string; title?: string; description?: string; icon?: string }>).slice(0, 6).map(f => ({
            icon: f.icon || "Zap",
            title: f.name || f.title || "Feature",
            description: f.description || "",
          }));
        }
        if (sec.type === "testimonials" && Array.isArray(sec.content)) {
          c.testimonials = (sec.content as Array<{ name?: string; company?: string; quote?: string; role?: string }>).slice(0, 6).map(t => ({
            name: t.name || "",
            company: t.company || "",
            quote: t.quote || "",
            role: t.role || "",
          }));
        }
        if (sec.type === "faq" && Array.isArray(sec.content)) {
          c.faq = (sec.content as Array<{ question?: string; answer?: string }>).slice(0, 8).map(f => ({
            question: f.question || "",
            answer: f.answer || "",
          }));
        }
        if (sec.type === "pricing") {
          const tiersRaw = Array.isArray(sec.content)
            ? (sec.content as Array<{ name?: string; price?: string; period?: string; features?: string[]; highlighted?: boolean }>)
            : Array.isArray((sec.content as { tiers?: unknown[] })?.tiers)
              ? ((sec.content as { tiers: Array<{ name?: string; price?: string; period?: string; features?: string[]; highlighted?: boolean }> }).tiers)
              : [];
          if (tiersRaw.length > 0) {
            c.pricing = tiersRaw.slice(0, 3).map((tier) => ({
              name: tier.name || "Plan",
              price: tier.price || "$0",
              period: tier.period || "/month",
              features: Array.isArray(tier.features) ? tier.features : [],
              highlighted: Boolean(tier.highlighted),
            }));
          }
        }
      }

      setContent(c);
      setGenerating(false);
      toast.success("Landing page generated!", { id: "gen" });
      setStep(3);
    } catch (err) {
      setGenerating(false);
      toast.error(err instanceof Error ? err.message : "Generation failed", { id: "gen" });
    }
  };

  const handleTemplateSelect = (id: string) => {
    setSelectedTemplate(id);
    const tpl = TEMPLATES.find(t => t.id === id);
    if (tpl) toast.success(`Template "${tpl.name}" selected`);
    setStep(3);
  };

  /* ─── Guided Mode: feed wizard state into bizInfo + call the same generate route ─── */
  async function handleGuidedGenerate() {
    const offer = guidedOffer.trim();
    if (!offer) {
      toast.error("Tell us what you're selling");
      return;
    }
    const tpl = TEMPLATES.find(t => t.id === guidedTemplate);
    setBizInfo(prev => ({
      ...prev,
      // Business name/industry defaults derive from the offer so the generate
      // API has enough to chew on. User can refine everything in Advanced.
      name: prev.name || offer.split(/[-.,–—:]/)[0].trim().slice(0, 60) || "Your Brand",
      industry: prev.industry || (tpl?.name || "SaaS"),
      description: prev.description || offer,
      tagline: guidedHeadline.trim() || prev.tagline || offer.slice(0, 80),
      targetAudience: guidedAudience.trim() || prev.targetAudience,
    }));
    setSelectedTemplate(guidedTemplate);
    setStep(3);

    setGenerating(true);
    toast.loading("AI is generating your landing page...", { id: "gen" });
    try {
      const res = await fetch("/api/landing-pages/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_type: tpl?.name || "SaaS",
          product_or_service: offer,
          target_audience: guidedAudience.trim() || "small business owners",
          value_proposition: guidedHeadline.trim() || undefined,
          template_style: guidedTemplate || "saas",
          include_sections: ["features", "benefits", "testimonials", "faq", "pricing"],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Generation failed", { id: "gen" });
        return;
      }
      const c = defaultContent();
      c.hero.headline = guidedHeadline.trim() || data.headline || offer;
      c.hero.subheadline = guidedSubhead.trim() || data.subheadline || c.hero.subheadline;
      c.hero.cta_text = data.hero_cta || "Get Started";
      c.hero.cta_url = "#";
      c.footer.copyright = `\u00a9 2026 ${guidedHeadline.trim() || offer}. All rights reserved.`;

      interface ApiSection { type: string; heading?: string; content: unknown }
      const apiSections: ApiSection[] = Array.isArray(data.sections) ? data.sections : [];
      for (const sec of apiSections) {
        if (sec.type === "features" && Array.isArray(sec.content)) {
          c.features = (sec.content as Array<{ name?: string; title?: string; description?: string; icon?: string }>).slice(0, 6).map(f => ({
            icon: f.icon || "Zap",
            title: f.name || f.title || "Feature",
            description: f.description || "",
          }));
        }
        if (sec.type === "testimonials" && Array.isArray(sec.content)) {
          c.testimonials = (sec.content as Array<{ name?: string; company?: string; quote?: string; role?: string }>).slice(0, 6).map(t => ({
            name: t.name || "", company: t.company || "", quote: t.quote || "", role: t.role || "",
          }));
        }
        if (sec.type === "faq" && Array.isArray(sec.content)) {
          c.faq = (sec.content as Array<{ question?: string; answer?: string }>).slice(0, 8).map(f => ({
            question: f.question || "", answer: f.answer || "",
          }));
        }
        if (sec.type === "pricing") {
          const tiersRaw = Array.isArray(sec.content)
            ? (sec.content as Array<{ name?: string; price?: string; period?: string; features?: string[]; highlighted?: boolean }>)
            : Array.isArray((sec.content as { tiers?: unknown[] })?.tiers)
              ? ((sec.content as { tiers: Array<{ name?: string; price?: string; period?: string; features?: string[]; highlighted?: boolean }> }).tiers)
              : [];
          if (tiersRaw.length > 0) {
            c.pricing = tiersRaw.slice(0, 3).map((tier) => ({
              name: tier.name || "Plan",
              price: tier.price || "$0",
              period: tier.period || "/month",
              features: Array.isArray(tier.features) ? tier.features : [],
              highlighted: Boolean(tier.highlighted),
            }));
          }
        }
      }
      setContent(c);
      toast.success("Landing page generated!", { id: "gen" });
      setAdvancedMode(true);
      setMainTab("create");
      setStep(3);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed", { id: "gen" });
    } finally {
      setGenerating(false);
    }
  }

  /* ─── Guided steps ─── */
  const guidedSteps: WizardStepDef[] = [
    {
      id: "offer",
      title: "What are you selling?",
      description: "One or two sentences — product, service, membership, even a newsletter signup.",
      icon: <Sparkles size={18} />,
      canProceed: guidedOffer.trim().length > 0,
      component: (
        <div className="space-y-3">
          <div className="flex justify-end">
            <AIEnhanceButton value={guidedOffer} onResult={setGuidedOffer} context="landing page section copy" variant="pill" />
          </div>
          <textarea
            value={guidedOffer}
            onChange={e => setGuidedOffer(e.target.value)}
            placeholder="e.g., A booking platform that cuts dental practice no-shows by 40% using text-message reminders"
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-surface-light border border-border text-sm focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20 transition-all resize-none"
            autoFocus
          />
          <div>
            <label className="block text-[10px] text-muted uppercase tracking-wider mb-1.5 font-semibold">
              Who&apos;s it for? <span className="text-muted/60 normal-case">(optional)</span>
            </label>
            <input
              type="text"
              value={guidedAudience}
              onChange={e => setGuidedAudience(e.target.value)}
              placeholder="e.g., Solo dental practice owners, independent yoga studios"
              className="w-full px-4 py-2.5 rounded-xl bg-surface-light border border-border text-sm focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20 transition-all"
            />
          </div>
        </div>
      ),
    },
    {
      id: "template",
      title: "Pick a template",
      description: "This sets the structure — sections and overall vibe. You can change colour & copy after.",
      icon: <Layout size={18} />,
      component: (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {TEMPLATES.map(tpl => {
            const sel = guidedTemplate === tpl.id;
            const Icon = tpl.icon;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => setGuidedTemplate(tpl.id)}
                className={`text-left p-3 rounded-xl border transition-all ${
                  sel
                    ? "border-gold bg-gold/10 shadow-lg shadow-gold/10"
                    : "border-border hover:border-gold/30 bg-surface-light"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4" style={{ color: tpl.color }} />
                  <p className="text-sm font-semibold">{tpl.name}</p>
                </div>
                <p className="text-[10px] text-muted leading-relaxed">{tpl.desc}</p>
              </button>
            );
          })}
        </div>
      ),
    },
    {
      id: "hero",
      title: "Headline + subheadline",
      description: "Leave blank and AI will write them. Fill them in if you want to lock the hook.",
      icon: <Pencil size={18} />,
      optional: true,
      component: (
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] text-muted uppercase tracking-wider mb-1.5 font-semibold">
              Headline
            </label>
            <input
              type="text"
              value={guidedHeadline}
              onChange={e => setGuidedHeadline(e.target.value)}
              placeholder="e.g., Book every chair. Stop losing 40% of appointments."
              className="w-full px-4 py-2.5 rounded-xl bg-surface-light border border-border text-sm focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20 transition-all"
            />
          </div>
          <div>
            <label className="block text-[10px] text-muted uppercase tracking-wider mb-1.5 font-semibold">
              Subheadline
            </label>
            <input
              type="text"
              value={guidedSubhead}
              onChange={e => setGuidedSubhead(e.target.value)}
              placeholder="e.g., Text reminders that actually get read. 14-day free trial, no card."
              className="w-full px-4 py-2.5 rounded-xl bg-surface-light border border-border text-sm focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20 transition-all"
            />
          </div>
        </div>
      ),
    },
    {
      id: "review",
      title: "Ready to generate?",
      description: "We'll write features, testimonials, FAQ, and pricing to match. You can edit every section in Advanced.",
      icon: <Rocket size={18} />,
      component: (
        <div className="card bg-gold/[0.04] border-gold/20 space-y-2">
          <p className="text-sm leading-relaxed">
            <span className="text-muted">Offer: </span>
            <span className="font-semibold">{guidedOffer || <span className="italic text-muted">(none)</span>}</span>
          </p>
          <p className="text-[11px] text-muted">
            Template: <span className="text-foreground">{TEMPLATES.find(t => t.id === guidedTemplate)?.name || "—"}</span>
          </p>
          {guidedAudience && (
            <p className="text-[11px] text-muted">
              For: <span className="text-foreground">{guidedAudience}</span>
            </p>
          )}
          {(guidedHeadline || guidedSubhead) && (
            <p className="text-[11px] text-muted">
              {guidedHeadline && <span className="block text-foreground font-semibold">{guidedHeadline}</span>}
              {guidedSubhead && <span className="block">{guidedSubhead}</span>}
            </p>
          )}
        </div>
      ),
    },
  ];

  const handleRegenSection = async (key: SectionKey) => {
    const sectionMap: Partial<Record<SectionKey, "features" | "testimonials" | "faq" | "pricing" | "about">> = {
      features: "features",
      testimonials: "testimonials",
      faq: "faq",
      pricing: "pricing",
    };
    const apiSection = sectionMap[key];
    if (!apiSection) {
      toast.error(`No AI regeneration for ${key}`);
      return;
    }
    toast.loading(`Regenerating ${key}...`, { id: `regen-${key}` });
    try {
      const res = await fetch("/api/landing-pages/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_type: bizInfo.industry || "business",
          product_or_service: bizInfo.description || bizInfo.tagline || bizInfo.name || "product",
          target_audience: bizInfo.targetAudience || "customers",
          value_proposition: bizInfo.tagline || undefined,
          template_style: selectedTemplate || "saas",
          regenerate_section: apiSection,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Regeneration failed", { id: `regen-${key}` });
        return;
      }
      interface ApiSection { type: string; content: unknown }
      const sec: ApiSection | undefined = (data.sections as ApiSection[])?.[0];
      if (!sec) {
        toast.error("No section returned", { id: `regen-${key}` });
        return;
      }
      setContent(c => {
        if (key === "features" && Array.isArray(sec.content)) {
          return { ...c, features: (sec.content as Array<{ name?: string; title?: string; description?: string; icon?: string }>).slice(0, 6).map(f => ({ icon: f.icon || "Zap", title: f.name || f.title || "Feature", description: f.description || "" })) };
        }
        if (key === "testimonials" && Array.isArray(sec.content)) {
          return { ...c, testimonials: (sec.content as Array<{ name?: string; company?: string; quote?: string; role?: string }>).slice(0, 6).map(t => ({ name: t.name || "", company: t.company || "", quote: t.quote || "", role: t.role || "" })) };
        }
        if (key === "faq" && Array.isArray(sec.content)) {
          return { ...c, faq: (sec.content as Array<{ question?: string; answer?: string }>).slice(0, 8).map(f => ({ question: f.question || "", answer: f.answer || "" })) };
        }
        if (key === "pricing") {
          const tiersRaw = Array.isArray(sec.content)
            ? (sec.content as Array<{ name?: string; price?: string; period?: string; features?: string[]; highlighted?: boolean }>)
            : Array.isArray((sec.content as { tiers?: unknown[] })?.tiers)
              ? ((sec.content as { tiers: Array<{ name?: string; price?: string; period?: string; features?: string[]; highlighted?: boolean }> }).tiers)
              : [];
          if (tiersRaw.length > 0) {
            return { ...c, pricing: tiersRaw.slice(0, 3).map(tier => ({ name: tier.name || "Plan", price: tier.price || "$0", period: tier.period || "/month", features: Array.isArray(tier.features) ? tier.features : [], highlighted: Boolean(tier.highlighted) })) };
          }
        }
        return c;
      });
      toast.success(`${key} regenerated!`, { id: `regen-${key}` });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Regeneration failed", { id: `regen-${key}` });
    }
  };

  const handleDeploy = async () => {
    setDeploying(true);
    toast.loading("Deploying to Vercel...", { id: "deploy" });
    await new Promise(r => setTimeout(r, 3000));
    setDeploying(false);
    toast.success("Deployed successfully!", { id: "deploy" });
  };

  const getScheme = () => COLOR_SCHEMES.find(c => c.id === bizInfo.colorScheme) || COLOR_SCHEMES[0];

  const filteredPages = pages.filter(p =>
    p.name.toLowerCase().includes(pageSearch.toLowerCase()) ||
    p.template.toLowerCase().includes(pageSearch.toLowerCase())
  );

  /* ══════════════════════════════════════════════════════════════════
     RENDER HELPERS
     ══════════════════════════════════════════════════════════════════ */

  /* ── Live Preview ── */
  const renderPreview = () => {
    const scheme = getScheme();
    const bgStyle = scheme.bg.startsWith("linear")
      ? { background: scheme.bg }
      : { backgroundColor: scheme.bg };

    return (
      <div className="rounded-xl border border-border overflow-hidden">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1a2e] border-b border-border">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <div className="flex-1 mx-4">
            <div className="bg-[#0d0d1a] rounded-md px-3 py-1 text-xs text-muted flex items-center gap-2">
              <Shield className="w-3 h-3 text-green-400" />
              {bizInfo.name ? `${bizInfo.name.toLowerCase().replace(/\s+/g, "")}.com` : "yoursite.com"}
            </div>
          </div>
        </div>

        {/* Page content */}
        <div
          ref={previewRef}
          className="overflow-y-auto max-h-[600px] text-sm"
          style={{ ...bgStyle, color: scheme.text }}
        >
          {sections.filter(s => s.visible).map(sec => {
            switch (sec.key) {
              case "hero": return (
                <div key="hero" className="px-8 py-16 text-center" style={{ background: scheme.bg.startsWith("linear") ? scheme.bg : `linear-gradient(180deg, ${scheme.bg} 0%, ${scheme.primary}15 100%)` }}>
                  <h1 className="text-2xl font-bold mb-3" style={{ color: scheme.text }}>{content.hero.headline}</h1>
                  <p className="text-sm opacity-75 max-w-md mx-auto mb-6" style={{ color: scheme.text }}>{content.hero.subheadline}</p>
                  <button className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: scheme.primary }}>{content.hero.cta_text}</button>
                </div>
              );
              case "features": return (
                <div key="features" className="px-8 py-12">
                  <h2 className="text-lg font-bold text-center mb-8" style={{ color: scheme.text }}>Why Choose Us</h2>
                  <div className="grid grid-cols-2 gap-4">
                    {content.features.map((f, i) => (
                      <div key={i} className="p-4 rounded-lg" style={{ backgroundColor: `${scheme.primary}10` }}>
                        <div className="w-8 h-8 rounded-md flex items-center justify-center mb-2 text-xs font-bold" style={{ backgroundColor: `${scheme.primary}20`, color: scheme.primary }}>
                          {f.icon.charAt(0)}
                        </div>
                        <h3 className="text-sm font-semibold mb-1" style={{ color: scheme.text }}>{f.title}</h3>
                        <p className="text-xs opacity-60" style={{ color: scheme.text }}>{f.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
              case "testimonials": return (
                <div key="testimonials" className="px-8 py-12" style={{ backgroundColor: `${scheme.primary}08` }}>
                  <h2 className="text-lg font-bold text-center mb-8" style={{ color: scheme.text }}>What Our Clients Say</h2>
                  <div className="grid grid-cols-3 gap-3">
                    {content.testimonials.map((t, i) => (
                      <div key={i} className="p-4 rounded-lg border" style={{ borderColor: `${scheme.primary}20`, backgroundColor: `${scheme.bg.startsWith("linear") ? "#ffffff" : scheme.bg}` }}>
                        <p className="text-xs italic opacity-70 mb-3" style={{ color: scheme.text }}>&ldquo;{t.quote}&rdquo;</p>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: scheme.primary }}>
                            {t.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-xs font-semibold" style={{ color: scheme.text }}>{t.name}</p>
                            <p className="text-[10px] opacity-50" style={{ color: scheme.text }}>{t.role}, {t.company}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
              case "pricing": return (
                <div key="pricing" className="px-8 py-12">
                  <h2 className="text-lg font-bold text-center mb-8" style={{ color: scheme.text }}>Pricing Plans</h2>
                  <div className="grid grid-cols-3 gap-3">
                    {content.pricing.map((tier, i) => (
                      <div
                        key={i}
                        className="p-4 rounded-lg border text-center"
                        style={{
                          borderColor: tier.highlighted ? scheme.primary : `${scheme.primary}20`,
                          backgroundColor: tier.highlighted ? `${scheme.primary}10` : "transparent",
                          transform: tier.highlighted ? "scale(1.03)" : "none",
                        }}
                      >
                        {tier.highlighted && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full mb-2 inline-block text-white" style={{ backgroundColor: scheme.primary }}>POPULAR</span>}
                        <h3 className="text-sm font-bold mb-1" style={{ color: scheme.text }}>{tier.name}</h3>
                        <p className="text-xl font-bold mb-3" style={{ color: scheme.primary }}>{tier.price}<span className="text-xs opacity-50" style={{ color: scheme.text }}>{tier.period}</span></p>
                        <ul className="text-xs space-y-1.5 text-left">
                          {tier.features.map((f, fi) => (
                            <li key={fi} className="flex items-center gap-1.5 opacity-70" style={{ color: scheme.text }}>
                              <Check className="w-3 h-3 flex-shrink-0" style={{ color: scheme.primary }} />{f}
                            </li>
                          ))}
                        </ul>
                        <button className="w-full mt-4 py-1.5 rounded-md text-xs font-semibold" style={{ backgroundColor: tier.highlighted ? scheme.primary : "transparent", color: tier.highlighted ? "#fff" : scheme.primary, border: `1px solid ${scheme.primary}` }}>
                          Choose Plan
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
              case "faq": return (
                <div key="faq" className="px-8 py-12" style={{ backgroundColor: `${scheme.primary}05` }}>
                  <h2 className="text-lg font-bold text-center mb-8" style={{ color: scheme.text }}>Frequently Asked Questions</h2>
                  <div className="max-w-md mx-auto space-y-2">
                    {content.faq.map((item, i) => (
                      <div key={i} className="rounded-lg border overflow-hidden" style={{ borderColor: `${scheme.primary}20` }}>
                        <button
                          onClick={() => setOpenFaq(openFaq === i ? null : i)}
                          className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-left"
                          style={{ color: scheme.text }}
                        >
                          {item.question}
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openFaq === i ? "rotate-180" : ""}`} style={{ color: scheme.primary }} />
                        </button>
                        {openFaq === i && (
                          <div className="px-4 pb-3 text-xs opacity-70" style={{ color: scheme.text }}>{item.answer}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
              case "contact": return (
                <div key="contact" className="px-8 py-12">
                  <h2 className="text-lg font-bold text-center mb-2" style={{ color: scheme.text }}>{content.contact.heading}</h2>
                  <p className="text-xs text-center opacity-60 mb-6" style={{ color: scheme.text }}>{content.contact.subheading}</p>
                  <div className="max-w-sm mx-auto space-y-2.5">
                    {["Your Name", "Email Address", "Phone Number"].map(ph => (
                      <input key={ph} placeholder={ph} className="w-full px-3 py-2 rounded-md text-xs border" style={{ borderColor: `${scheme.primary}30`, backgroundColor: `${scheme.primary}08`, color: scheme.text }} readOnly />
                    ))}
                    <textarea placeholder="Your Message" className="w-full px-3 py-2 rounded-md text-xs border h-16 resize-none" style={{ borderColor: `${scheme.primary}30`, backgroundColor: `${scheme.primary}08`, color: scheme.text }} readOnly />
                    <button className="w-full py-2 rounded-md text-xs font-semibold text-white" style={{ backgroundColor: scheme.primary }}>Send Message</button>
                  </div>
                </div>
              );
              case "footer": return (
                <div key="footer" className="px-8 py-6 border-t" style={{ borderColor: `${scheme.primary}20` }}>
                  <div className="flex items-center justify-between text-[10px] opacity-50" style={{ color: scheme.text }}>
                    <span>{content.footer.copyright}</span>
                    <div className="flex gap-3">
                      {content.footer.links.map((l, i) => (
                        <span key={i} className="hover:opacity-100 cursor-pointer">{l.label}</span>
                      ))}
                    </div>
                  </div>
                </div>
              );
              default: return null;
            }
          })}
        </div>
      </div>
    );
  };

  /* ── Section Editor Panel ── */
  const renderSectionEditor = (sec: SectionState, idx: number) => {
    const isEditing = sec.editing;
    return (
      <div key={sec.key} className="card mb-3">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-muted cursor-grab" />
            <span className="text-sm font-semibold text-white">{sec.label}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => moveSection(idx, "up")} className="p-1 hover:bg-surface-light rounded" title="Move up">
              <ChevronUp className="w-3.5 h-3.5 text-muted" />
            </button>
            <button onClick={() => moveSection(idx, "down")} className="p-1 hover:bg-surface-light rounded" title="Move down">
              <ChevronDown className="w-3.5 h-3.5 text-muted" />
            </button>
            <button onClick={() => toggleSection(sec.key)} className={`p-1 hover:bg-surface-light rounded ${!sec.visible ? "opacity-40" : ""}`} title={sec.visible ? "Hide" : "Show"}>
              {sec.visible ? <Eye className="w-3.5 h-3.5 text-muted" /> : <EyeOff className="w-3.5 h-3.5 text-muted" />}
            </button>
            <button onClick={() => toggleEdit(sec.key)} className={`p-1 hover:bg-surface-light rounded ${isEditing ? "bg-gold/10 text-gold" : ""}`} title="Edit">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => handleRegenSection(sec.key)} className="p-1 hover:bg-surface-light rounded" title="Regenerate with AI">
              <RotateCcw className="w-3.5 h-3.5 text-muted" />
            </button>
          </div>
        </div>

        {isEditing && sec.visible && (
          <div className="px-4 py-3 space-y-3">
            {sec.key === "hero" && (
              <>
                <div>
                  <label className="text-xs text-muted mb-1 block">Headline</label>
                  <input value={content.hero.headline} onChange={e => setContent(c => ({ ...c, hero: { ...c.hero, headline: e.target.value } }))} className="w-full bg-surface-light border border-border rounded px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-muted block">Subheadline</label>
                    <AIEnhanceButton value={content.hero.subheadline} onResult={next => setContent(c => ({ ...c, hero: { ...c.hero, subheadline: next } }))} context="landing page subheadline" variant="inline" />
                  </div>
                  <textarea value={content.hero.subheadline} onChange={e => setContent(c => ({ ...c, hero: { ...c.hero, subheadline: e.target.value } }))} className="w-full bg-surface-light border border-border rounded px-3 py-2 text-sm text-white h-20 resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted mb-1 block">CTA Text</label>
                    <input value={content.hero.cta_text} onChange={e => setContent(c => ({ ...c, hero: { ...c.hero, cta_text: e.target.value } }))} className="w-full bg-surface-light border border-border rounded px-3 py-2 text-sm text-white" />
                  </div>
                  <div>
                    <label className="text-xs text-muted mb-1 block">CTA URL</label>
                    <input value={content.hero.cta_url} onChange={e => setContent(c => ({ ...c, hero: { ...c.hero, cta_url: e.target.value } }))} className="w-full bg-surface-light border border-border rounded px-3 py-2 text-sm text-white" />
                  </div>
                </div>
                <div className="p-3 border border-dashed border-border rounded-lg flex items-center justify-center gap-2 text-muted text-xs cursor-pointer hover:border-gold hover:text-gold transition-colors">
                  <ImageIcon className="w-4 h-4" />
                  Upload Hero Image
                </div>
              </>
            )}
            {sec.key === "features" && (
              <div className="space-y-3">
                {content.features.map((f, fi) => (
                  <div key={fi} className="p-3 bg-surface-light rounded-lg border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted font-medium">Feature {fi + 1}</span>
                      <button onClick={() => setContent(c => ({ ...c, features: c.features.filter((_, i) => i !== fi) }))} className="text-red-400 hover:text-red-300"><X className="w-3.5 h-3.5" /></button>
                    </div>
                    <input value={f.title} onChange={e => { const nf = [...content.features]; nf[fi] = { ...nf[fi], title: e.target.value }; setContent(c => ({ ...c, features: nf })); }} placeholder="Title" className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs text-white" />
                    <input value={f.description} onChange={e => { const nf = [...content.features]; nf[fi] = { ...nf[fi], description: e.target.value }; setContent(c => ({ ...c, features: nf })); }} placeholder="Description" className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs text-white" />
                  </div>
                ))}
                {content.features.length < 6 && (
                  <button onClick={() => setContent(c => ({ ...c, features: [...c.features, { icon: "Star", title: "New Feature", description: "Describe this feature" }] }))} className="w-full py-2 border border-dashed border-border rounded-lg text-xs text-muted hover:text-gold hover:border-gold transition-colors flex items-center justify-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Add Feature
                  </button>
                )}
              </div>
            )}
            {sec.key === "testimonials" && (
              <div className="space-y-3">
                {content.testimonials.map((t, ti) => (
                  <div key={ti} className="p-3 bg-surface-light rounded-lg border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted font-medium">Testimonial {ti + 1}</span>
                      <button onClick={() => setContent(c => ({ ...c, testimonials: c.testimonials.filter((_, i) => i !== ti) }))} className="text-red-400 hover:text-red-300"><X className="w-3.5 h-3.5" /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={t.name} onChange={e => { const nt = [...content.testimonials]; nt[ti] = { ...nt[ti], name: e.target.value }; setContent(c => ({ ...c, testimonials: nt })); }} placeholder="Name" className="bg-surface border border-border rounded px-2 py-1.5 text-xs text-white" />
                      <input value={t.company} onChange={e => { const nt = [...content.testimonials]; nt[ti] = { ...nt[ti], company: e.target.value }; setContent(c => ({ ...c, testimonials: nt })); }} placeholder="Company" className="bg-surface border border-border rounded px-2 py-1.5 text-xs text-white" />
                    </div>
                    <input value={t.role} onChange={e => { const nt = [...content.testimonials]; nt[ti] = { ...nt[ti], role: e.target.value }; setContent(c => ({ ...c, testimonials: nt })); }} placeholder="Role" className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs text-white" />
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-muted uppercase tracking-wider">Quote</label>
                      <AIEnhanceButton value={t.quote} onResult={next => { const nt = [...content.testimonials]; nt[ti] = { ...nt[ti], quote: next }; setContent(c => ({ ...c, testimonials: nt })); }} context="landing page section copy" variant="inline" />
                    </div>
                    <textarea value={t.quote} onChange={e => { const nt = [...content.testimonials]; nt[ti] = { ...nt[ti], quote: e.target.value }; setContent(c => ({ ...c, testimonials: nt })); }} placeholder="Quote" className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs text-white h-16 resize-none" />
                  </div>
                ))}
              </div>
            )}
            {sec.key === "pricing" && (
              <div className="space-y-3">
                {content.pricing.map((tier, pi) => (
                  <div key={pi} className={`p-3 rounded-lg border space-y-2 ${tier.highlighted ? "border-gold bg-gold/5" : "bg-surface-light border-border"}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted font-medium">{tier.name}</span>
                      <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer">
                        <input type="checkbox" checked={tier.highlighted} onChange={() => { const np = [...content.pricing]; np[pi] = { ...np[pi], highlighted: !np[pi].highlighted }; setContent(c => ({ ...c, pricing: np })); }} className="accent-gold" />
                        Highlight
                      </label>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input value={tier.name} onChange={e => { const np = [...content.pricing]; np[pi] = { ...np[pi], name: e.target.value }; setContent(c => ({ ...c, pricing: np })); }} placeholder="Tier name" className="bg-surface border border-border rounded px-2 py-1.5 text-xs text-white" />
                      <input value={tier.price} onChange={e => { const np = [...content.pricing]; np[pi] = { ...np[pi], price: e.target.value }; setContent(c => ({ ...c, pricing: np })); }} placeholder="Price" className="bg-surface border border-border rounded px-2 py-1.5 text-xs text-white" />
                      <input value={tier.period} onChange={e => { const np = [...content.pricing]; np[pi] = { ...np[pi], period: e.target.value }; setContent(c => ({ ...c, pricing: np })); }} placeholder="/month" className="bg-surface border border-border rounded px-2 py-1.5 text-xs text-white" />
                    </div>
                    <div className="space-y-1">
                      {tier.features.map((feat, fi) => (
                        <div key={fi} className="flex items-center gap-1">
                          <input value={feat} onChange={e => { const np = [...content.pricing]; const nf = [...np[pi].features]; nf[fi] = e.target.value; np[pi] = { ...np[pi], features: nf }; setContent(c => ({ ...c, pricing: np })); }} className="flex-1 bg-surface border border-border rounded px-2 py-1 text-xs text-white" />
                          <button onClick={() => { const np = [...content.pricing]; np[pi] = { ...np[pi], features: np[pi].features.filter((_, i) => i !== fi) }; setContent(c => ({ ...c, pricing: np })); }} className="text-red-400 hover:text-red-300"><X className="w-3 h-3" /></button>
                        </div>
                      ))}
                      <button onClick={() => { const np = [...content.pricing]; np[pi] = { ...np[pi], features: [...np[pi].features, "New feature"] }; setContent(c => ({ ...c, pricing: np })); }} className="text-xs text-muted hover:text-gold flex items-center gap-1 mt-1"><Plus className="w-3 h-3" /> Add feature</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {sec.key === "faq" && (
              <div className="space-y-3">
                {content.faq.map((item, fi) => (
                  <div key={fi} className="p-3 bg-surface-light rounded-lg border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted font-medium">Q{fi + 1}</span>
                      <button onClick={() => setContent(c => ({ ...c, faq: c.faq.filter((_, i) => i !== fi) }))} className="text-red-400 hover:text-red-300"><X className="w-3.5 h-3.5" /></button>
                    </div>
                    <input value={item.question} onChange={e => { const nf = [...content.faq]; nf[fi] = { ...nf[fi], question: e.target.value }; setContent(c => ({ ...c, faq: nf })); }} placeholder="Question" className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs text-white" />
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-muted uppercase tracking-wider">Answer</label>
                      <AIEnhanceButton value={item.answer} onResult={next => { const nf = [...content.faq]; nf[fi] = { ...nf[fi], answer: next }; setContent(c => ({ ...c, faq: nf })); }} context="landing page section copy" variant="inline" />
                    </div>
                    <textarea value={item.answer} onChange={e => { const nf = [...content.faq]; nf[fi] = { ...nf[fi], answer: e.target.value }; setContent(c => ({ ...c, faq: nf })); }} placeholder="Answer" className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs text-white h-16 resize-none" />
                  </div>
                ))}
                {content.faq.length < 8 && (
                  <button onClick={() => setContent(c => ({ ...c, faq: [...c.faq, { question: "New Question?", answer: "Answer here." }] }))} className="w-full py-2 border border-dashed border-border rounded-lg text-xs text-muted hover:text-gold hover:border-gold transition-colors flex items-center justify-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Add FAQ
                  </button>
                )}
              </div>
            )}
            {sec.key === "contact" && (
              <div className="space-y-2">
                <input value={content.contact.heading} onChange={e => setContent(c => ({ ...c, contact: { ...c.contact, heading: e.target.value } }))} placeholder="Heading" className="w-full bg-surface-light border border-border rounded px-3 py-2 text-sm text-white" />
                <input value={content.contact.subheading} onChange={e => setContent(c => ({ ...c, contact: { ...c.contact, subheading: e.target.value } }))} placeholder="Subheading" className="w-full bg-surface-light border border-border rounded px-3 py-2 text-sm text-white" />
                <div className="grid grid-cols-2 gap-2">
                  <input value={content.contact.email} onChange={e => setContent(c => ({ ...c, contact: { ...c.contact, email: e.target.value } }))} placeholder="Email" className="bg-surface-light border border-border rounded px-3 py-2 text-sm text-white" />
                  <input value={content.contact.phone} onChange={e => setContent(c => ({ ...c, contact: { ...c.contact, phone: e.target.value } }))} placeholder="Phone" className="bg-surface-light border border-border rounded px-3 py-2 text-sm text-white" />
                </div>
              </div>
            )}
            {sec.key === "footer" && (
              <div className="space-y-2">
                <input value={content.footer.copyright} onChange={e => setContent(c => ({ ...c, footer: { ...c.footer, copyright: e.target.value } }))} placeholder="Copyright" className="w-full bg-surface-light border border-border rounded px-3 py-2 text-sm text-white" />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  /* ══════════════════════════════════════════════════════════════════
     MAIN RENDER
     ══════════════════════════════════════════════════════════════════ */

  return (
    <div className="fade-in min-h-screen p-6 max-w-[1400px] mx-auto space-y-6">
      <PageHero
        icon={<LayoutTemplate size={28} />}
        title="AI Landing Page Generator"
        subtitle="High-converting pages with AI-powered content."
        gradient="green"
        actions={
          <>
            <AdvancedToggle value={advancedMode} onChange={setAdvancedMode} />
            {advancedMode && (
              <button onClick={() => { setStep(1); setMainTab("create"); }} className="px-4 py-2 rounded-lg bg-white/15 border border-white/25 text-white text-sm font-semibold hover:bg-white/25 transition-colors flex items-center gap-2">
                <Plus className="w-4 h-4" /> New Page
              </button>
            )}
          </>
        }
      />

      {/* Guided Mode — 4-step AI landing page builder */}
      {!advancedMode && (
        <Wizard
          steps={guidedSteps}
          activeIdx={guidedStep}
          onStepChange={setGuidedStep}
          finishLabel={generating ? "Generating…" : "Generate landing page"}
          busy={generating}
          onFinish={handleGuidedGenerate}
          onCancel={() => setAdvancedMode(true)}
          cancelLabel="Advanced mode"
        />
      )}

      {advancedMode && (<>
      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 border border-border">
        {([
          { id: "create" as MainTab, label: "Create", icon: Sparkles },
          { id: "pages" as MainTab, label: "Generated Pages", icon: FileText },
          { id: "deploy" as MainTab, label: "Deployment", icon: Rocket },
          { id: "analytics" as MainTab, label: "Analytics", icon: BarChart3 },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setMainTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors ${mainTab === tab.id ? "bg-gold/10 text-gold" : "text-muted hover:text-white"}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ CREATE TAB ═══ */}
      {mainTab === "create" && (
        <>
          {/* Step indicators */}
          <div className="flex items-center gap-4">
            {[
              { n: 1, label: "Business Info" },
              { n: 2, label: "Template" },
              { n: 3, label: "Editor" },
            ].map(s => (
              <button
                key={s.n}
                onClick={() => setStep(s.n as 1 | 2 | 3)}
                className={`flex items-center gap-2 text-sm font-medium transition-colors ${step === s.n ? "text-gold" : step > s.n ? "text-green-400" : "text-muted"}`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${step === s.n ? "border-gold bg-gold/10 text-gold" : step > s.n ? "border-green-500 bg-green-500/10 text-green-400" : "border-border text-muted"}`}>
                  {step > s.n ? <Check className="w-3.5 h-3.5" /> : s.n}
                </div>
                {s.label}
                {s.n < 3 && <ArrowRight className="w-4 h-4 text-muted ml-2" />}
              </button>
            ))}
          </div>

          {/* ── Step 1: Business Info ── */}
          {step === 1 && (
            <div className="card p-6 space-y-6">
              <h2 className="section-header text-lg font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-gold" />
                Business Information
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted mb-1.5 block font-medium">Business Name *</label>
                  <input value={bizInfo.name} onChange={e => setBizInfo(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Acme Solutions" className="w-full bg-surface-light border border-border rounded-lg px-4 py-2.5 text-sm text-white focus:border-gold focus:outline-none transition-colors" />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1.5 block font-medium">Industry *</label>
                  <input value={bizInfo.industry} onChange={e => setBizInfo(p => ({ ...p, industry: e.target.value }))} placeholder="e.g. SaaS, Restaurant, Real Estate" className="w-full bg-surface-light border border-border rounded-lg px-4 py-2.5 text-sm text-white focus:border-gold focus:outline-none transition-colors" />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted mb-1.5 block font-medium">Tagline</label>
                <input value={bizInfo.tagline} onChange={e => setBizInfo(p => ({ ...p, tagline: e.target.value }))} placeholder="e.g. Build faster, scale smarter" className="w-full bg-surface-light border border-border rounded-lg px-4 py-2.5 text-sm text-white focus:border-gold focus:outline-none transition-colors" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-muted block font-medium">Business Description</label>
                  <AIEnhanceButton value={bizInfo.description} onResult={next => setBizInfo(p => ({ ...p, description: next }))} context="landing page section copy" variant="inline" />
                </div>
                <textarea value={bizInfo.description} onChange={e => setBizInfo(p => ({ ...p, description: e.target.value }))} placeholder="Describe what your business does, your main value proposition, and what makes you unique..." className="w-full bg-surface-light border border-border rounded-lg px-4 py-3 text-sm text-white h-24 resize-none focus:border-gold focus:outline-none transition-colors" />
              </div>

              <div>
                <label className="text-xs text-muted mb-1.5 block font-medium">Target Audience</label>
                <input value={bizInfo.targetAudience} onChange={e => setBizInfo(p => ({ ...p, targetAudience: e.target.value }))} placeholder="e.g. Small business owners, marketing teams, enterprise companies" className="w-full bg-surface-light border border-border rounded-lg px-4 py-2.5 text-sm text-white focus:border-gold focus:outline-none transition-colors" />
              </div>

              {/* Benefits */}
              <div>
                <label className="text-xs text-muted mb-1.5 block font-medium">Key Benefits</label>
                <div className="flex gap-2 mb-2">
                  <input value={benefitInput} onChange={e => setBenefitInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addBenefit()} placeholder="Add a benefit and press Enter" className="flex-1 bg-surface-light border border-border rounded-lg px-4 py-2.5 text-sm text-white focus:border-gold focus:outline-none transition-colors" />
                  <button onClick={addBenefit} className="px-3 py-2 bg-surface-light border border-border rounded-lg hover:border-gold transition-colors">
                    <Plus className="w-4 h-4 text-muted" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {bizInfo.benefits.map((b, i) => (
                    <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-gold/10 text-gold rounded-full text-xs font-medium">
                      {b}
                      <button onClick={() => removeBenefit(i)}><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted mb-1.5 block font-medium">CTA Button Text</label>
                  <input value={bizInfo.ctaText} onChange={e => setBizInfo(p => ({ ...p, ctaText: e.target.value }))} placeholder="Get Started" className="w-full bg-surface-light border border-border rounded-lg px-4 py-2.5 text-sm text-white focus:border-gold focus:outline-none transition-colors" />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1.5 block font-medium">CTA URL</label>
                  <input value={bizInfo.ctaUrl} onChange={e => setBizInfo(p => ({ ...p, ctaUrl: e.target.value }))} placeholder="https://..." className="w-full bg-surface-light border border-border rounded-lg px-4 py-2.5 text-sm text-white focus:border-gold focus:outline-none transition-colors" />
                </div>
              </div>

              {/* Color Scheme */}
              <div>
                <label className="text-xs text-muted mb-2 block font-medium">Color Scheme</label>
                <div className="grid grid-cols-5 gap-3">
                  {COLOR_SCHEMES.map(cs => (
                    <button
                      key={cs.id}
                      onClick={() => setBizInfo(p => ({ ...p, colorScheme: cs.id }))}
                      className={`p-3 rounded-lg border transition-all ${bizInfo.colorScheme === cs.id ? "border-gold ring-1 ring-gold/30" : "border-border hover:border-gold/30"}`}
                    >
                      <div className="h-10 rounded-md mb-2 flex items-center justify-center" style={{ background: cs.bg.startsWith("linear") ? cs.bg : cs.bg, border: cs.id === "clean-light" || cs.id === "minimal" ? "1px solid #333" : "none" }}>
                        <div className="w-6 h-2 rounded-full" style={{ backgroundColor: cs.primary }} />
                      </div>
                      <span className="text-xs font-medium text-white">{cs.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Logo Upload Placeholder */}
              <div>
                <label className="text-xs text-muted mb-1.5 block font-medium">Logo</label>
                <div className="border border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-gold hover:bg-gold/5 transition-colors">
                  <Upload className="w-6 h-6 text-muted" />
                  <span className="text-xs text-muted">Click to upload your logo (PNG, SVG)</span>
                  <span className="text-[10px] text-muted/50">Max 2MB</span>
                </div>
              </div>

              {/* Generate Button */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="px-6 py-3 bg-gold text-black rounded-lg text-sm font-bold hover:bg-gold/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {generating ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {generating ? "Generating..." : "Generate with AI"}
                </button>
                <button onClick={() => setStep(2)} className="px-6 py-3 bg-surface-light border border-border rounded-lg text-sm font-medium text-muted hover:text-white hover:border-gold/30 transition-colors">
                  Skip to Templates
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Template Selection ── */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="section-header text-lg font-bold text-white flex items-center gap-2">
                <Layout className="w-5 h-5 text-gold" />
                Choose a Template
              </h2>
              <div className="grid grid-cols-4 gap-4">
                {TEMPLATES.map(tpl => {
                  const Icon = tpl.icon;
                  return (
                    <div
                      key={tpl.id}
                      className={`card group cursor-pointer overflow-hidden transition-all hover:border-gold/30 ${selectedTemplate === tpl.id ? "border-gold ring-1 ring-gold/20" : ""}`}
                    >
                      {/* Preview thumbnail mockup */}
                      <div
                        className={`h-36 relative overflow-hidden bg-gradient-to-br ${tpl.gradient}`}
                        style={{ opacity: 0.9 }}
                      >
                        {/* Miniature page mockup */}
                        <div className="absolute inset-3 bg-white/10 backdrop-blur-sm rounded-lg p-3 flex flex-col">
                          <div className="flex gap-1 mb-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
                            <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
                            <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
                          </div>
                          <div className="flex-1 flex flex-col items-center justify-center gap-1.5">
                            <Icon className="w-6 h-6 text-white/70" />
                            <div className="w-16 h-1.5 bg-white/30 rounded-full" />
                            <div className="w-12 h-1 bg-white/20 rounded-full" />
                            <div className="w-10 h-3 bg-white/30 rounded-md mt-1" />
                          </div>
                          <div className="flex gap-1 mt-auto">
                            <div className="flex-1 h-4 bg-white/10 rounded" />
                            <div className="flex-1 h-4 bg-white/10 rounded" />
                            <div className="flex-1 h-4 bg-white/10 rounded" />
                          </div>
                        </div>
                      </div>

                      <div className="p-4">
                        <h3 className="text-sm font-bold text-white mb-1">{tpl.name}</h3>
                        <p className="text-xs text-muted mb-3">{tpl.desc}</p>
                        <button
                          onClick={() => handleTemplateSelect(tpl.id)}
                          className="w-full py-2 bg-surface-light border border-border rounded-lg text-xs font-semibold text-muted hover:text-gold hover:border-gold transition-colors group-hover:border-gold/30"
                        >
                          Use Template
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Step 3: Live Editor ── */}
          {step === 3 && (
            <div className="grid grid-cols-5 gap-6">
              {/* Left: Section Editor */}
              <div className="col-span-2 space-y-1">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="section-header text-lg font-bold text-white flex items-center gap-2">
                    <Pencil className="w-5 h-5 text-gold" />
                    Sections
                  </h2>
                  <span className="text-xs text-muted">{sections.filter(s => s.visible).length}/{sections.length} visible</span>
                </div>
                {sections.map((sec, idx) => renderSectionEditor(sec, idx))}
              </div>

              {/* Right: Live Preview */}
              <div className="col-span-3 sticky top-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="section-header text-lg font-bold text-white flex items-center gap-2">
                    <Monitor className="w-5 h-5 text-gold" />
                    Live Preview
                  </h2>
                  <div className="flex items-center gap-2">
                    <select
                      value={bizInfo.colorScheme}
                      onChange={e => setBizInfo(p => ({ ...p, colorScheme: e.target.value }))}
                      className="bg-surface-light border border-border rounded px-2 py-1 text-xs text-white"
                    >
                      {COLOR_SCHEMES.map(cs => <option key={cs.id} value={cs.id}>{cs.name}</option>)}
                    </select>
                    <button className="px-3 py-1.5 bg-gold text-black rounded text-xs font-semibold hover:bg-gold/90 transition-colors flex items-center gap-1">
                      <Rocket className="w-3 h-3" /> Publish
                    </button>
                  </div>
                </div>
                {renderPreview()}
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ GENERATED PAGES TAB ═══ */}
      {mainTab === "pages" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-header text-lg font-bold text-white">Generated Pages</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input value={pageSearch} onChange={e => setPageSearch(e.target.value)} placeholder="Search pages..." className="bg-surface-light border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-white w-64 focus:border-gold focus:outline-none" />
            </div>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Template</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Created</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Views</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Conversions</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredPages.map(page => (
                  <tr key={page.id} className="hover:bg-surface-light/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-gold" />
                        <span className="text-sm text-white font-medium">{page.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">{page.template}</td>
                    <td className="px-4 py-3 text-sm text-muted">{page.created}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        page.status === "Published" ? "bg-green-500/10 text-green-400" :
                        page.status === "Draft" ? "bg-yellow-500/10 text-yellow-400" :
                        "bg-zinc-500/10 text-zinc-400"
                      }`}>
                        {page.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted text-right">{page.views.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span className="text-gold font-medium">{page.conversions.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setMainTab("create"); setStep(3); toast.success("Editing page"); }} className="p-1.5 hover:bg-surface-light rounded-md transition-colors" title="Edit">
                          <Pencil className="w-3.5 h-3.5 text-muted hover:text-white" />
                        </button>
                        <button onClick={() => toast.success("Preview opened")} className="p-1.5 hover:bg-surface-light rounded-md transition-colors" title="Preview">
                          <Eye className="w-3.5 h-3.5 text-muted hover:text-white" />
                        </button>
                        <button onClick={() => {
                          setPages(ps => ps.map(p => p.id === page.id ? { ...p, status: "Published" as const } : p));
                          toast.success("Page published!");
                        }} className="p-1.5 hover:bg-surface-light rounded-md transition-colors" title="Publish">
                          <Rocket className="w-3.5 h-3.5 text-muted hover:text-green-400" />
                        </button>
                        <button onClick={() => {
                          const dup: GeneratedPage = { ...page, id: `dup-${Date.now()}`, name: `${page.name} (Copy)`, status: "Draft", views: 0, conversions: 0 };
                          setPages(ps => [...ps, dup]);
                          toast.success("Page duplicated");
                        }} className="p-1.5 hover:bg-surface-light rounded-md transition-colors" title="Duplicate">
                          <Copy className="w-3.5 h-3.5 text-muted hover:text-white" />
                        </button>
                        <button onClick={() => {
                          setPages(ps => ps.filter(p => p.id !== page.id));
                          toast.success("Page deleted");
                        }} className="p-1.5 hover:bg-surface-light rounded-md transition-colors" title="Delete">
                          <Trash2 className="w-3.5 h-3.5 text-muted hover:text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredPages.length === 0 && (
              <div className="text-center py-12 text-muted text-sm">No pages found matching your search.</div>
            )}
          </div>
        </div>
      )}

      {/* ═══ DEPLOYMENT TAB ═══ */}
      {mainTab === "deploy" && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {/* Deploy Action */}
            <div className="card p-6 col-span-1 space-y-4">
              <h3 className="section-header text-sm font-bold text-white flex items-center gap-2">
                <Rocket className="w-4 h-4 text-gold" />
                Deploy
              </h3>
              <button
                onClick={handleDeploy}
                disabled={deploying}
                className="w-full py-3 bg-gold text-black rounded-lg text-sm font-bold hover:bg-gold/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deploying ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                {deploying ? "Deploying..." : "Deploy to Vercel"}
              </button>
              <div>
                <label className="text-xs text-muted mb-1.5 block font-medium">Custom Domain</label>
                <input value={customDomain} onChange={e => setCustomDomain(e.target.value)} placeholder="yourdomain.com" className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm text-white focus:border-gold focus:outline-none" />
              </div>
              <div className="flex items-center justify-between p-3 bg-surface-light rounded-lg border border-border">
                <span className="text-xs text-muted">SSL Certificate</span>
                <span className={`flex items-center gap-1.5 text-xs font-semibold ${sslStatus === "active" ? "text-green-400" : sslStatus === "pending" ? "text-yellow-400" : "text-muted"}`}>
                  <Shield className="w-3.5 h-3.5" />
                  {sslStatus === "active" ? "Active" : sslStatus === "pending" ? "Pending" : "Not configured"}
                </span>
              </div>
            </div>

            {/* Deployment History */}
            <div className="card p-6 col-span-2 space-y-4">
              <h3 className="section-header text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-gold" />
                Deployment History
              </h3>
              <div className="space-y-2">
                {MOCK_DEPLOYMENTS.map(dep => (
                  <div key={dep.id} className="flex items-center justify-between p-3 bg-surface-light rounded-lg border border-border">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${dep.status === "Success" ? "bg-green-400" : dep.status === "Failed" ? "bg-red-400" : "bg-yellow-400 animate-pulse"}`} />
                      <div>
                        <p className="text-sm text-white font-medium">{dep.url}</p>
                        <p className="text-xs text-muted">Commit: {dep.commit}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-semibold ${dep.status === "Success" ? "text-green-400" : dep.status === "Failed" ? "text-red-400" : "text-yellow-400"}`}>{dep.status}</span>
                      <p className="text-xs text-muted">{dep.timestamp}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ANALYTICS TAB ═══ */}
      {mainTab === "analytics" && (
        <div className="space-y-6">
          {/* Page selector */}
          <div className="flex items-center gap-3">
            <label className="text-sm text-muted font-medium">Page:</label>
            <select
              value={analyticsPage}
              onChange={e => setAnalyticsPage(e.target.value)}
              className="bg-surface-light border border-border rounded-lg px-3 py-2 text-sm text-white focus:border-gold focus:outline-none"
            >
              {MOCK_PAGES.filter(p => p.status === "Published").map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-6 gap-3">
            {[
              { label: "Total Views", value: MOCK_ANALYTICS.views.toLocaleString(), icon: Eye, color: "text-blue-400" },
              { label: "Unique Visitors", value: MOCK_ANALYTICS.uniqueVisitors.toLocaleString(), icon: Users, color: "text-purple-400" },
              { label: "Bounce Rate", value: `${MOCK_ANALYTICS.bounceRate}%`, icon: TrendingUp, color: "text-orange-400" },
              { label: "Avg. Time", value: MOCK_ANALYTICS.avgTime, icon: Timer, color: "text-cyan-400" },
              { label: "Conversion Rate", value: `${MOCK_ANALYTICS.conversionRate}%`, icon: Target, color: "text-green-400" },
              { label: "Form Submissions", value: MOCK_ANALYTICS.formSubmissions.toLocaleString(), icon: Mail, color: "text-gold" },
            ].map(stat => (
              <div key={stat.label} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <p className="text-lg font-bold text-white">{stat.value}</p>
                <p className="text-xs text-muted mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* Views Chart (CSS) */}
            <div className="card p-6 col-span-2 space-y-4">
              <h3 className="section-header text-sm font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-gold" />
                Views (Last 7 Days)
              </h3>
              <div className="flex items-end gap-2 h-40">
                {MOCK_ANALYTICS.dailyViews.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-xs text-muted">No data yet</div>
                ) : MOCK_ANALYTICS.dailyViews.map((v, i) => {
                  const max = Math.max(...MOCK_ANALYTICS.dailyViews, 1);
                  const h = (v / max) * 100;
                  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] text-muted">{v.toLocaleString()}</span>
                      <div className="w-full rounded-t-md relative group" style={{ height: `${h}%`, background: `linear-gradient(180deg, #C9A84C 0%, #C9A84C40 100%)` }}>
                        <div className="absolute inset-0 bg-gold/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-md" />
                      </div>
                      <span className="text-[10px] text-muted">{days[i]}</span>
                    </div>
                  );
                })}
              </div>
              {/* Simple line overlay */}
              {MOCK_ANALYTICS.dailyViews.length > 0 && (
              <div className="relative h-1">
                <svg viewBox="0 0 700 100" className="absolute -top-40 left-0 w-full h-40 pointer-events-none" preserveAspectRatio="none">
                  <polyline
                    fill="none"
                    stroke="#C9A84C"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    points={MOCK_ANALYTICS.dailyViews.map((v, i) => {
                      const max = Math.max(...MOCK_ANALYTICS.dailyViews, 1);
                      const x = (i / (MOCK_ANALYTICS.dailyViews.length - 1 || 1)) * 680 + 10;
                      const y = 95 - (v / max) * 90;
                      return `${x},${y}`;
                    }).join(" ")}
                  />
                  {MOCK_ANALYTICS.dailyViews.map((v, i) => {
                    const max = Math.max(...MOCK_ANALYTICS.dailyViews, 1);
                    const x = (i / (MOCK_ANALYTICS.dailyViews.length - 1 || 1)) * 680 + 10;
                    const y = 95 - (v / max) * 90;
                    return <circle key={i} cx={x} cy={y} r="3" fill="#C9A84C" />;
                  })}
                </svg>
              </div>
              )}
            </div>

            {/* Traffic Sources */}
            <div className="card p-6 space-y-4">
              <h3 className="section-header text-sm font-bold text-white flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-gold" />
                Traffic Sources
              </h3>
              <div className="space-y-3">
                {MOCK_ANALYTICS.sources.map(src => (
                  <div key={src.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-white font-medium">{src.name}</span>
                      <span className="text-xs text-gold font-semibold">{src.pct}%</span>
                    </div>
                    <div className="w-full h-2 bg-surface-light rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${src.pct}%`, background: "linear-gradient(90deg, #C9A84C, #C9A84C80)" }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t border-border">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">Total Sessions</span>
                  <span className="text-white font-semibold">{MOCK_ANALYTICS.views.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </>)}

      {/* ═══ PAGE AI ASSISTANT ═══ */}
      <PageAI
        pageName="Landing Pages"
        context="AI landing page generator with template selection, live editor, deployment, and analytics. User can create landing pages from business info or templates."
        suggestions={[
          "How do I improve my landing page conversion rate?",
          "What makes a good hero section?",
          "Help me write better testimonials",
          "How should I structure my pricing tiers?",
        ]}
      />
    </div>
  );
}
