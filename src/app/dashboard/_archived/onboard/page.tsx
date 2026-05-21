"use client";

import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  UserPlus, ArrowRight, ArrowLeft, Check, Sparkles,
  Upload, Palette, Briefcase, ShieldCheck, Eye,
  Rocket, ChevronDown, ChevronUp, Crown,
  Image, Type, Layers, Globe, Mail, Phone,
  Building2, Target, Users, Plus, X,
  CheckCircle2, Layout, Zap, BookOpen, Loader2,
  Video, Home, GraduationCap, ShoppingBag,
  type LucideIcon,
} from "lucide-react";
import { PLAN_TIERS, type PlanTier } from "@/lib/plan-config";
import SoloOnboardingWizard from "@/components/onboarding/solo-onboarding-wizard";
import { USER_TYPES, UserType } from "@/lib/user-types";
import toast from "react-hot-toast";
import ChoiceCards, { type ChoiceCardItem } from "@/components/ui/choice-cards";
import { MotionPage } from "@/components/motion/motion-page";

/* ================================================================== */
/*  Icon lookup for user-type cards                                    */
/* ================================================================== */
// Typed as LucideIcon (not React.ElementType) so the union with `|| Sparkles`
// fallback below doesn't collapse JSX prop inference to `never` — TS was
// rejecting `<Icon size={18} />` with "number is not assignable to never"
// when the union was heterogeneous.
const USER_TYPE_ICONS: Record<string, LucideIcon> = {
  Building2, Video, Home, GraduationCap, ShoppingBag, Rocket, Briefcase, Sparkles,
};

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

interface BrandAsset {
  id: string;
  name: string;
  type: "logo" | "icon" | "font" | "guideline";
  uploaded: boolean;
}

interface ServiceOption {
  id: string;
  name: string;
  category: string;
  description: string;
  included: boolean;
}

interface AccessUser {
  email: string;
  role: "admin" | "manager" | "editor" | "viewer";
  status: "pending" | "invited" | "active";
}

interface OnboardTemplate {
  id: string;
  name: string;
  description: string;
  steps: number;
  industry: string;
  popular: boolean;
}

/* ================================================================== */
/*  Mock Data                                                          */
/* ================================================================== */

const INDUSTRIES = [
  "Restaurant / F&B", "Dental / Medical", "Real Estate", "Legal Services",
  "Fitness / Gym", "E-Commerce", "SaaS / Tech", "Home Services",
  "Beauty / Salon", "Automotive", "Education", "Non-Profit",
];

const BRAND_COLORS = [
  { name: "Ocean Blue", primary: "#2563EB", secondary: "#93C5FD" },
  { name: "Forest Green", primary: "#16a34a", secondary: "#86efac" },
  { name: "Royal Purple", primary: "#7c3aed", secondary: "#c4b5fd" },
  { name: "Sunset Orange", primary: "#ea580c", secondary: "#fdba74" },
  { name: "Rose Pink", primary: "#e11d48", secondary: "#fda4af" },
  { name: "Slate Pro", primary: "#475569", secondary: "#cbd5e1" },
];

const FONT_OPTIONS = [
  "Inter", "Plus Jakarta Sans", "DM Sans", "Poppins",
  "Montserrat", "Lato", "Open Sans", "Roboto",
];

const INITIAL_ASSETS: BrandAsset[] = [
  { id: "a1", name: "Primary Logo", type: "logo", uploaded: false },
  { id: "a2", name: "Logo Mark / Icon", type: "icon", uploaded: false },
  { id: "a3", name: "Brand Guidelines PDF", type: "guideline", uploaded: false },
  { id: "a4", name: "Custom Font Files", type: "font", uploaded: false },
];

const SERVICE_OPTIONS: ServiceOption[] = [
  { id: "s1", name: "Social Media Management", category: "Content", description: "Daily posting across platforms", included: false },
  { id: "s2", name: "Content Marketing", category: "Content", description: "Blog posts, articles, newsletters", included: false },
  { id: "s3", name: "Video Production", category: "Content", description: "Short-form and long-form video", included: false },
  { id: "s4", name: "SEO & Content Strategy", category: "Growth", description: "Keyword research and optimization", included: false },
  { id: "s5", name: "Email Marketing", category: "Growth", description: "Campaign creation and automation", included: false },
  { id: "s6", name: "Paid Ads (Meta)", category: "Ads", description: "Facebook and Instagram advertising", included: false },
  { id: "s7", name: "Paid Ads (Google)", category: "Ads", description: "Search, display, and YouTube ads", included: false },
  { id: "s8", name: "Paid Ads (TikTok)", category: "Ads", description: "TikTok advertising campaigns", included: false },
  { id: "s9", name: "Website Design", category: "Design", description: "Custom website build and maintenance", included: false },
  { id: "s10", name: "Branding & Identity", category: "Design", description: "Logo, brand kit, and guidelines", included: false },
  { id: "s11", name: "AI Receptionist", category: "AI", description: "24/7 AI phone answering", included: false },
  { id: "s12", name: "AI Chatbot", category: "AI", description: "Website chat automation", included: false },
  { id: "s13", name: "Automation Workflows", category: "AI", description: "Lead nurture and task automation", included: false },
  { id: "s14", name: "Lead Generation", category: "Growth", description: "Outbound prospecting and funnels", included: false },
  { id: "s15", name: "Community Management", category: "Content", description: "Engage and grow online communities", included: false },
];

/** Feature descriptions for each plan tier (excluding Founder) */
const PLAN_FEATURES: Record<string, string[]> = {
  Starter:   ["Up to 5 clients", "1 team member", "250K AI tokens", "Basic tools"],
  Growth:    ["Up to 15 clients", "3 team members", "1M AI tokens", "AI agents & workflows", "Design & video studio"],
  Pro:       ["Up to 50 clients", "10 team members", "5M AI tokens", "API access", "All creative tools"],
  Business:  ["Up to 150 clients", "25 team members", "20M AI tokens", "White label", "Custom AI", "Dedicated support"],
  Unlimited: ["Unlimited clients", "Unlimited team", "Unlimited tokens", "Everything included", "Priority SLA"],
};

const PACKAGES = (Object.keys(PLAN_TIERS) as PlanTier[])
  .filter((key) => key !== "Founder")
  .map((key) => {
    const tier = PLAN_TIERS[key];
    return {
      name: key,
      price: `$${tier.price_monthly.toLocaleString()}`,
      color: tier.color,
      features: PLAN_FEATURES[key] ?? [],
    };
  });

const ONBOARD_TEMPLATES: OnboardTemplate[] = [
  { id: "t1", name: "Agency Standard", description: "Full-service agency onboarding with all steps included", steps: 6, industry: "General", popular: true },
  { id: "t2", name: "E-Commerce Quick Start", description: "Fast setup for product-based businesses with Shopify integration", steps: 4, industry: "E-Commerce", popular: true },
  { id: "t3", name: "Local Business", description: "Google Business, local SEO, and review management focus", steps: 5, industry: "Local", popular: false },
  { id: "t4", name: "SaaS Startup", description: "Product marketing, content strategy, and growth metrics", steps: 5, industry: "SaaS / Tech", popular: true },
  { id: "t5", name: "Restaurant & F&B", description: "Menu showcase, reservations, local SEO, and social content", steps: 4, industry: "Restaurant / F&B", popular: false },
  { id: "t6", name: "Healthcare / Dental", description: "HIPAA-aware setup with patient acquisition workflows", steps: 5, industry: "Dental / Medical", popular: false },
  { id: "t7", name: "Content Creator", description: "Personal brand with social-first approach and monetization", steps: 4, industry: "Creator", popular: false },
  { id: "t8", name: "Real Estate Agent", description: "Listing showcase, lead capture, and nurture sequences", steps: 5, industry: "Real Estate", popular: false },
];

/* ================================================================== */
/*  Wizard Step Labels (Agency full wizard)                            */
/* ================================================================== */

const STEP_META = [
  { label: "Welcome", icon: Sparkles, description: "Get started" },
  { label: "Business Info", icon: Building2, description: "Company details" },
  { label: "Brand Assets", icon: Palette, description: "Logo, colors, fonts" },
  { label: "Services", icon: Briefcase, description: "Select services" },
  { label: "Access Setup", icon: ShieldCheck, description: "Team & portal" },
  { label: "Personalize", icon: Sparkles, description: "AI-tailored Qs" },
  { label: "Review & Launch", icon: Rocket, description: "Final review" },
];

interface PersonalizeQuestion {
  id: string;
  question: string;
  placeholder: string;
  help_text: string;
}

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */

export default function OnboardPage() {
  const router = useRouter();
  // ── User-type gate (first screen) ──
  const [userType, setUserType] = useState<UserType | null>(null);

  // ── Legacy agency mode state ──
  const [mode, setMode] = useState<"full" | "quick">("full");
  const [step, setStep] = useState(0);
  const [wizardComplete, setWizardComplete] = useState(false);
  const [launchedClientId, setLaunchedClientId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState("");

  // Quick-add form state
  const [quickForm, setQuickForm] = useState({
    business_name: "",
    contact_name: "",
    email: "",
    phone: "",
    package_tier: "Growth",
  });
  const [quickSubmitted, setQuickSubmitted] = useState(false);
  const [quickLaunchedId, setQuickLaunchedId] = useState<string | null>(null);
  const updateQuick = (key: string, value: string) =>
    setQuickForm(prev => ({ ...prev, [key]: value }));

  // Form state
  const [form, setForm] = useState({
    business_name: "",
    contact_name: "",
    email: "",
    phone: "",
    website: "",
    industry: "",
    target_audience: "",
    goals: "",
    brand_voice: "",
    package_tier: "Growth",
    notes: "",
  });

  // Brand state
  const [assets, setAssets] = useState<BrandAsset[]>(INITIAL_ASSETS);
  const [selectedColorPreset, setSelectedColorPreset] = useState<string | null>(null);
  const [customPrimary, setCustomPrimary] = useState("#c8a855");
  const [customSecondary, setCustomSecondary] = useState("#f0d68a");
  const [selectedFont, setSelectedFont] = useState("Inter");

  // Services state
  const [services, setServices] = useState<ServiceOption[]>(SERVICE_OPTIONS);
  const [serviceFilter, setServiceFilter] = useState("All");

  // Access state
  const [accessUsers, setAccessUsers] = useState<AccessUser[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<AccessUser["role"]>("editor");
  const [portalEnabled, setPortalEnabled] = useState(true);
  const [sendWelcome, setSendWelcome] = useState(true);
  const [autoInvoice, setAutoInvoice] = useState(true);

  // FAQ state
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  // AI Personalize step state
  const [personalizeQuestions, setPersonalizeQuestions] = useState<PersonalizeQuestion[]>([]);
  const [personalizeAnswers, setPersonalizeAnswers] = useState<Record<string, string>>({});
  const [personalizeLoading, setPersonalizeLoading] = useState(false);
  const [personalizeFetched, setPersonalizeFetched] = useState(false);

  // Solo wizard finish state
  const [soloComplete, setSoloComplete] = useState(false);
  const [soloSummary, setSoloSummary] = useState<{ name: string; label: string; count: number } | null>(null);

  // ── Helpers ─────────────────────────────────────────────
  const updateForm = (key: string, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const toggleAsset = (id: string) =>
    setAssets(prev => prev.map(a => a.id === id ? { ...a, uploaded: !a.uploaded } : a));

  const toggleService = (id: string) =>
    setServices(prev => prev.map(s => s.id === id ? { ...s, included: !s.included } : s));

  const addAccessUser = () => {
    if (!newEmail.trim()) return;
    setAccessUsers(prev => [...prev, { email: newEmail.trim(), role: newRole, status: "pending" }]);
    setNewEmail("");
  };

  const removeAccessUser = (email: string) =>
    setAccessUsers(prev => prev.filter(u => u.email !== email));

  const selectedServices = services.filter(s => s.included);
  const uploadedAssets = assets.filter(a => a.uploaded).length;
  const categories = ["All", ...Array.from(new Set(services.map(s => s.category)))];
  const filteredServices = serviceFilter === "All" ? services : services.filter(s => s.category === serviceFilter);

  // Auto-fetch AI personalization questions when the user lands on Step 5
  useEffect(() => {
    if (step !== 5 || personalizeFetched) return;
    setPersonalizeFetched(true);
    setPersonalizeLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/onboarding/personalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            business_name: form.business_name,
            industry: form.industry,
            target_audience: form.target_audience,
            goals: form.goals,
            brand_voice: form.brand_voice,
            user_type: "agency",
          }),
        });
        const data = await res.json();
        if (Array.isArray(data.questions)) {
          setPersonalizeQuestions(data.questions as PersonalizeQuestion[]);
        }
      } catch (err) {
        console.error("[onboard] personalize fetch failed:", err);
      } finally {
        setPersonalizeLoading(false);
      }
    })();
  }, [step, personalizeFetched, form.business_name, form.industry, form.target_audience, form.goals, form.brand_voice]);

  async function savePersonalization() {
    // Only save if we have anything meaningful
    const hasAnswers = Object.values(personalizeAnswers).some((v) => v && v.trim().length > 0);
    if (!hasAnswers && personalizeQuestions.length === 0) return;
    try {
      await fetch("/api/user/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          onboarding_personalization: {
            questions: personalizeQuestions,
            answers: personalizeAnswers,
            completed_at: new Date().toISOString(),
          },
        }),
      });
    } catch (err) {
      console.error("[onboard] personalization save failed:", err);
    }
  }

  async function launchClient() {
    // Email is optional in the wizard, but if the user typed something, it
    // has to be a real-looking address. Otherwise portal invites and invoice
    // sends will silently fail downstream.
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setLaunchError("Enter a valid email address or leave it blank.");
      return;
    }
    setLaunching(true);
    setLaunchError("");
    // Fire-and-forget the personalization save
    void savePersonalization();
    try {
      const res = await fetch("/api/clients/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: form.business_name,
          contact_name: form.contact_name,
          email: form.email,
          phone: form.phone,
          website: form.website,
          industry: form.industry,
          package_tier: form.package_tier,
          mrr: 0,
          services: selectedServices.map(s => s.name),
          create_portal: portalEnabled,
          password: null, // Portal will use magic link
          create_invoice: autoInvoice,
          notes: form.notes,
          setup_zernio: false,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setLaunchedClientId(data.client_id || data.clientId || null);
        setWizardComplete(true);
      } else {
        setLaunchError(data.error || "Failed to create client");
      }
    } catch {
      setLaunchError("Network error — please try again");
    }
    setLaunching(false);
  }

  const canProceed = (): boolean => {
    // Every field in onboarding is optional — the user can breeze through
    // without filling anything in. Required fields block the "can I just
    // see the product" flow which is the worst UX gate in a SaaS.
    return true;
  };

  const progressPercent = Math.round(((step + 1) / STEP_META.length) * 100);

  /* ═══════════════════════════════════════════════════════════════════
     Solo wizard finish — persist user type + sidebar prefs + profile
     ═══════════════════════════════════════════════════════════════════ */
  async function persistSoloFinish(soloState: {
    user_type: UserType | null;
    business_name: string;
    handle: string;
    website_url: string;
    niche: string;
    pain_answers: Record<string, unknown>;
    goal_answers: Record<string, unknown>;
    enabled_sidebar: string[];
    personalize_answers?: Record<string, string>;
    personalize_questions?: PersonalizeQuestion[];
  }) {
    try {
      // 1. Save user_type + onboarding_preferences to profile
      await fetch("/api/user/sidebar-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled_items: soloState.enabled_sidebar,
          business_type: soloState.user_type,
        }),
      });

      // 2. Persist user_type + onboarding_preferences via profile patch
      await fetch("/api/user/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_type: soloState.user_type,
          onboarding_preferences: {
            business_name: soloState.business_name,
            handle: soloState.handle,
            website_url: soloState.website_url,
            niche: soloState.niche,
            pain_answers: soloState.pain_answers,
            goal_answers: soloState.goal_answers,
            completed_at: new Date().toISOString(),
          },
          onboarding_personalization: {
            questions: soloState.personalize_questions || [],
            answers: soloState.personalize_answers || {},
            completed_at: new Date().toISOString(),
          },
        }),
      });

      const typeLabel = USER_TYPES.find((u) => u.id === soloState.user_type)?.label || "creator";
      setSoloSummary({
        name: soloState.business_name || "your business",
        label: typeLabel,
        count: soloState.enabled_sidebar.length,
      });
      setSoloComplete(true);
      toast.success("You're all set! Welcome to Trinity.");
    } catch (err) {
      console.error("[onboard] persist failed:", err);
      toast.error("Couldn't save your preferences — please try again.");
    }
  }

  // ── Derived state ───────────────────────────────────────
  const selectedTypeMeta = useMemo(
    () => USER_TYPES.find((u) => u.id === userType) || null,
    [userType]
  );
  const isAgencyPath = userType === "agency";

  // ── Render ──────────────────────────────────────────────

  // Step 0: User type selector (shown first for everyone)
  if (!userType) {
    return (
      <MotionPage className="space-y-6">{/* -- Welcome to Trinity command strip -- */}
      <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
        <div className="min-w-0">
          <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">WELCOME TO TRINITY</p>
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">Welcome to Trinity</h1>
        </div>
      </div><div className="glass rounded-xl p-6">
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold mb-1">What best describes you?</h2>
                    <p className="text-sm text-text-muted">Pick one — you can change it later in Settings.</p>
                  </div>
                  <ChoiceCards
                    columns={4}
                    size="md"
                    value={null}
                    onChange={(id) => setUserType(id as UserType)}
                    ariaLabel="What best describes you?"
                    items={USER_TYPES.map((t): ChoiceCardItem => {
                      const Icon = USER_TYPE_ICONS[t.iconKey] || Sparkles;
                      return {
                        id: t.id,
                        title: t.label,
                        description: t.description,
                        icon: <Icon size={18} />,
                      };
                    })}
                  />
                </div></MotionPage>
    );
  }

  // Solo path: anything non-agency
  if (!isAgencyPath) {
    if (soloComplete && soloSummary) {
      return (
        <div className="space-y-6">
          {/* -- You're all set! command strip -- */}
          <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
            <div className="min-w-0">
              <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">YOU'RE ALL SET!</p>
              <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">You're all set!</h1>
            </div>
          </div>
          <div className="glass rounded-xl p-10 text-center space-y-5">
            <div className="w-20 h-20 mx-auto bg-[rgba(59,130,246,0.08)] rounded-full flex items-center justify-center">
              <CheckCircle2 size={40} className="text-brand-accent" />
            </div>
            <h2 className="text-2xl font-bold text-brand-accent">Welcome aboard!</h2>
            <p className="text-sm text-text-muted max-w-lg mx-auto">
              <span className="font-semibold text-text-primary">{soloSummary.name}</span> is set up with{" "}
              <span className="font-semibold text-text-primary">{soloSummary.count}</span> sidebar tools tuned to your{" "}
              <span className="font-semibold text-text-primary">{soloSummary.label}</span> business.
            </p>
            <div className="flex items-center justify-center gap-3">
              <a
                href="/dashboard"
                className="px-5 py-2.5 bg-brand-accent text-white rounded-lg text-sm font-semibold hover:bg-brand-accent/80 inline-flex items-center gap-1.5"
              >
                <Rocket size={14} /> Go to Dashboard
              </a>
              <button
                onClick={() => { setUserType(null); setSoloComplete(false); setSoloSummary(null); }}
                className="px-5 py-2.5 rounded-lg border border-[var(--color-border)] text-sm text-text-muted hover:text-text-primary transition-colors"
              >
                Start Over
              </button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-6">
        {/* -- Onboard command strip -- */}
        <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
          <div className="min-w-0">
            <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">GETTING STARTED</p>
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">{`Let's set up your ${selectedTypeMeta?.label || "workspace"}`}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setUserType(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border-subtle bg-black/5 text-text-primary hover:bg-black/10 transition-all"
            >
              <ArrowLeft size={12} /> Change type
            </button>
          </div>
        </div>
        <SoloOnboardingWizard
          initialUserType={userType}
          onComplete={persistSoloFinish}
          onCancel={() => setUserType(null)}
        />
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // Agency path (preserved original behavior)
  // ══════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6">
      {/* -- Client Onboarding Wizard command strip -- */}
      <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
        <div className="min-w-0">
          <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">CLIENT ONBOARDING WIZARD</p>
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">Client Onboarding Wizard</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <>
            <button
              onClick={() => setUserType(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border-subtle bg-black/5 text-text-primary hover:bg-black/10 transition-all"
            >
              <ArrowLeft size={12} /> Change type
            </button>
            <button onClick={() => setShowTemplates(!showTemplates)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border-subtle bg-black/5 text-text-primary hover:bg-black/10 transition-all">
              <Layout size={12} /> Templates
            </button>
            {selectedTemplate && (
              <span className="text-[9px] px-2 py-0.5 bg-black/10 border border-border-subtle text-text-primary rounded-full">
                Using: {ONBOARD_TEMPLATES.find(t => t.id === selectedTemplate)?.name}
              </span>
            )}
          </>
        </div>
      </div>

      {/* Mode Toggle: Full Wizard vs Quick Add */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-[rgba(0,0,0,0.04)] border border-[var(--color-border)] w-fit">
        <button
          onClick={() => setMode("full")}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            mode === "full" ? "bg-brand-accent text-white" : "text-text-muted hover:text-text-primary"
          }`}>
          Full Wizard
        </button>
        <button
          onClick={() => setMode("quick")}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            mode === "quick" ? "bg-brand-accent text-white" : "text-text-muted hover:text-text-primary"
          }`}>
          Quick Add
        </button>
      </div>

      {/* ── Quick Add Mode ─────────────────────────────────── */}
      {mode === "quick" && (
        quickSubmitted ? (
          <div className="glass rounded-xl p-10 text-center space-y-5">
            <div className="w-20 h-20 mx-auto bg-[rgba(59,130,246,0.08)] rounded-full flex items-center justify-center">
              <CheckCircle2 size={40} className="text-brand-accent" />
            </div>
            <h2 className="text-2xl font-bold text-brand-accent">Client Created!</h2>
            <p className="text-sm text-text-muted max-w-lg mx-auto">
              <span className="font-semibold text-text-primary">{quickForm.business_name}</span> has been added on the{" "}
              <span className="text-brand-accent font-semibold">{quickForm.package_tier}</span> plan.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => {
                  setQuickSubmitted(false);
                  setQuickLaunchedId(null);
                  setQuickForm({ business_name: "", contact_name: "", email: "", phone: "", package_tier: "Growth" });
                }}
                className="px-5 py-2.5 rounded-lg border border-[var(--color-border)] text-sm text-text-muted hover:text-text-primary transition-colors">
                Add Another
              </button>
              <button
                onClick={() => {
                  if (quickLaunchedId) router.push(`/dashboard/clients/${quickLaunchedId}`);
                  else router.push("/dashboard/clients");
                }}
                className="px-5 py-2.5 bg-brand-accent text-white rounded-lg text-sm font-semibold hover:bg-brand-accent/80 flex items-center gap-1.5">
                <Eye size={14} /> View Client Profile
              </button>
            </div>
          </div>
        ) : (
          <div className="glass rounded-xl p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Zap size={18} className="text-brand-accent" /> Quick Add Client
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Rapidly add a client without the full onboarding wizard
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Business Name */}
              <div>
                <label className="block text-[10px] text-text-muted mb-1 font-medium">Business Name *</label>
                <div className="relative">
                  <Building2 size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted/40" />
                  <input value={quickForm.business_name} onChange={e => updateQuick("business_name", e.target.value)}
                    placeholder="Acme Corp"
                    className="w-full pl-8 pr-3 py-2.5 bg-[rgba(0,0,0,0.04)] border border-[var(--color-border)] rounded-lg text-text-primary text-sm focus:outline-none focus:border-brand-accent transition-colors" />
                </div>
              </div>

              {/* Contact Name */}
              <div>
                <label className="block text-[10px] text-text-muted mb-1 font-medium">Contact Name *</label>
                <div className="relative">
                  <Users size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted/40" />
                  <input value={quickForm.contact_name} onChange={e => updateQuick("contact_name", e.target.value)}
                    placeholder="John Smith"
                    className="w-full pl-8 pr-3 py-2.5 bg-[rgba(0,0,0,0.04)] border border-[var(--color-border)] rounded-lg text-text-primary text-sm focus:outline-none focus:border-brand-accent transition-colors" />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-[10px] text-text-muted mb-1 font-medium">Email *</label>
                <div className="relative">
                  <Mail size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted/40" />
                  <input value={quickForm.email} onChange={e => updateQuick("email", e.target.value)}
                    placeholder="john@acme.com" type="email"
                    className="w-full pl-8 pr-3 py-2.5 bg-[rgba(0,0,0,0.04)] border border-[var(--color-border)] rounded-lg text-text-primary text-sm focus:outline-none focus:border-brand-accent transition-colors" />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-[10px] text-text-muted mb-1 font-medium">Phone</label>
                <div className="relative">
                  <Phone size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted/40" />
                  <input value={quickForm.phone} onChange={e => updateQuick("phone", e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className="w-full pl-8 pr-3 py-2.5 bg-[rgba(0,0,0,0.04)] border border-[var(--color-border)] rounded-lg text-text-primary text-sm focus:outline-none focus:border-brand-accent transition-colors" />
                </div>
              </div>

              {/* Package Dropdown */}
              <div className="md:col-span-2">
                <label className="block text-[10px] text-text-muted mb-1 font-medium">Package</label>
                <select value={quickForm.package_tier} onChange={e => updateQuick("package_tier", e.target.value)}
                  className="w-full px-3 py-2.5 bg-[rgba(0,0,0,0.04)] border border-[var(--color-border)] rounded-lg text-text-primary text-sm focus:outline-none focus:border-brand-accent transition-colors">
                  {PACKAGES.map(pkg => (
                    <option key={pkg.name} value={pkg.name}>{pkg.name} ({pkg.price}/mo)</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button onClick={() => setMode("full")}
                className="px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-text-muted hover:text-text-primary transition-colors">
                Switch to Full Wizard
              </button>
              <button
                onClick={async () => {
                  const bizName = quickForm.business_name.trim();
                  const contact = quickForm.contact_name.trim();
                  const email = quickForm.email.trim();
                  if (!bizName || !contact || !email) {
                    toast.error("Business, contact and email are required");
                    return;
                  }
                  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    toast.error("Enter a valid email address");
                    return;
                  }
                  try {
                    const res = await fetch("/api/clients/onboard", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        business_name: bizName,
                        contact_name: contact,
                        email,
                        phone: quickForm.phone,
                        package_tier: quickForm.package_tier,
                        mrr: 0,
                        services: [],
                        create_portal: true,
                        password: null,
                        create_invoice: false,
                        notes: "",
                        setup_zernio: false,
                      }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      setQuickLaunchedId(data.client_id || data.clientId || null);
                      setQuickSubmitted(true);
                    } else {
                      toast.error(data.error || "Failed to create client");
                    }
                  } catch {
                    toast.error("Network error — please try again");
                  }
                }}
                disabled={!quickForm.business_name.trim() || !quickForm.contact_name.trim() || !quickForm.email.trim()}
                className="flex items-center gap-2 px-6 py-2.5 bg-brand-accent text-white rounded-lg text-sm font-bold hover:bg-brand-accent/80 disabled:opacity-40 transition-all">
                <UserPlus size={14} /> Create Client
              </button>
            </div>
          </div>
        )
      )}

      {/* Template Gallery */}
      {mode === "full" && showTemplates && (
        <div className="glass rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold flex items-center gap-2"><Layers size={14} className="text-brand-accent" /> Onboarding Templates</h2>
              <p className="text-[10px] text-text-muted mt-0.5">Pre-built flows for different client types</p>
            </div>
            <button onClick={() => setShowTemplates(false)} className="text-text-muted hover:text-text-primary"><X size={16} /></button>
          </div>
          <ChoiceCards
            columns={4}
            size="md"
            value={selectedTemplate}
            onChange={(id) => { setSelectedTemplate(id as string); setShowTemplates(false); }}
            ariaLabel="Onboarding Templates"
            items={ONBOARD_TEMPLATES.map((tpl): ChoiceCardItem => ({
              id: tpl.id,
              title: tpl.name,
              description: `${tpl.description} · ${tpl.steps} steps · ${tpl.industry}`,
              badge: tpl.popular ? "Popular" : undefined,
            }))}
          />
        </div>
      )}

      {/* ── Full Wizard Mode ────────────────────────────── */}
      {mode === "full" && (
      wizardComplete ? (
        <div className="glass rounded-xl p-10 text-center space-y-5">
          <div className="w-20 h-20 mx-auto bg-[rgba(59,130,246,0.08)] rounded-full flex items-center justify-center">
            <CheckCircle2 size={40} className="text-brand-accent" />
          </div>
          <h2 className="text-2xl font-bold text-brand-accent">Client Launched Successfully!</h2>
          <p className="text-sm text-text-muted max-w-lg mx-auto">
            <span className="font-semibold text-text-primary">{form.business_name || "New Client"}</span> has been onboarded.
            Their workspace is being configured with {selectedServices.length} services and {accessUsers.length} team member{accessUsers.length !== 1 ? "s" : ""}.
          </p>
          <div className="max-w-xl mx-auto">
            <div className="grid grid-cols-2 lg:grid-cols-[4fr_2fr_2fr_2fr] gap-3 mb-4">
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-start gap-3 bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">PACKAGE</p>
                  <p className="font-display text-3xl font-bold tracking-[-0.03em] text-brand-accent tabular-nums">{form.package_tier}</p>
                  <p className="text-[11px] text-text-muted mt-1.5">selected plan</p>
                </div>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.10, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                className="bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">SERVICES</p>
                <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">{selectedServices.length} active</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                className="bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">TEAM</p>
                <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">{accessUsers.length} members</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                className="bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">ASSETS</p>
                <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">{uploadedAssets} uploaded</p>
              </motion.div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => { setWizardComplete(false); setLaunchedClientId(null); setStep(0); setForm({ business_name: "", contact_name: "", email: "", phone: "", website: "", industry: "", target_audience: "", goals: "", brand_voice: "", package_tier: "Growth", notes: "" }); }}
              className="px-5 py-2.5 rounded-lg border border-[var(--color-border)] text-sm text-text-muted hover:text-text-primary transition-colors">
              Onboard Another Client
            </button>
            <button
              onClick={() => {
                if (launchedClientId) router.push(`/dashboard/clients/${launchedClientId}`);
                else router.push("/dashboard/clients");
              }}
              className="px-5 py-2.5 bg-brand-accent text-white rounded-lg text-sm font-semibold hover:bg-brand-accent/80 flex items-center gap-1.5">
              <Eye size={14} /> View Client Profile
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Progress Bar */}
          <div className="glass rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-text-muted">Step {step + 1} of {STEP_META.length}</p>
              <p className="text-xs font-semibold text-brand-accent">{progressPercent}% complete</p>
            </div>
            <div className="w-full h-2 bg-[rgba(0,0,0,0.04)] rounded-full overflow-hidden mb-4">
              <div className="h-full bg-brand-accent rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="flex gap-1">
              {STEP_META.map((s, i) => {
                const Icon = s.icon;
                const isActive = i === step;
                const isDone = i < step;
                return (
                  <button key={i} onClick={() => i <= step && setStep(i)}
                    className={`flex-1 flex items-center gap-2 p-2.5 rounded-lg text-left transition-all ${
                      isActive ? "bg-[rgba(59,130,246,0.08)] border border-[rgba(59,130,246,0.2)]" :
                      isDone ? "bg-emerald-500/5 border border-emerald-500/10 cursor-pointer" :
                      "border border-transparent opacity-50"
                    }`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      isDone ? "bg-emerald-500 text-black" :
                      isActive ? "bg-[rgba(59,130,246,0.12)] text-brand-accent" :
                      "bg-[rgba(0,0,0,0.04)] text-text-muted"
                    }`}>
                      {isDone ? <Check size={12} /> : <Icon size={12} />}
                    </div>
                    <div className="hidden lg:block min-w-0">
                      <p className={`text-[10px] font-semibold truncate ${isActive ? "text-brand-accent" : isDone ? "text-emerald-400" : "text-text-muted"}`}>{s.label}</p>
                      <p className="text-[8px] text-text-muted truncate">{s.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step Content Card */}
          <div className="glass rounded-xl p-6">

            {/* ── Step 0: Welcome ──────────────────────────────── */}
            {step === 0 && (
              <div className="space-y-6">
                <div className="text-center space-y-3 py-4">
                  <div className="w-16 h-16 mx-auto bg-[rgba(59,130,246,0.08)]  flex items-center justify-center">
                    <Sparkles size={28} className="text-brand-accent" />
                  </div>
                  <h2 className="text-xl font-bold">Welcome to Client Onboarding</h2>
                  <p className="text-sm text-text-muted max-w-md mx-auto">
                    This wizard will guide you through setting up a new client in Trinity.
                    Everything from business details to brand assets and service configuration.
                  </p>
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: Building2, label: "Business Profile", desc: "Company details & goals" },
                    { icon: Palette, label: "Brand Identity", desc: "Logo, colors, and fonts" },
                    { icon: Rocket, label: "Launch & Go", desc: "Portal access & automation" },
                  ].map((item, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.4 }} className="glass rounded-xl overflow-hidden">
                      <div className="p-4 text-center">
                        <item.icon size={20} className="mx-auto mb-2 text-brand-accent" />
                        <p className="text-xs font-semibold">{item.label}</p>
                        <p className="text-[9px] text-text-muted mt-0.5">{item.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Select package to start */}
                <div>
                  <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Crown size={14} className="text-brand-accent" /> Choose a Package</p>
                  <ChoiceCards
                    columns={3}
                    size="md"
                    value={form.package_tier}
                    onChange={(id) => updateForm("package_tier", id as string)}
                    ariaLabel="Choose a Package"
                    items={PACKAGES.map((pkg): ChoiceCardItem => ({
                      id: pkg.name,
                      title: pkg.name,
                      description: `${pkg.price}/mo · ${pkg.features[0]}`,
                    }))}
                  />
                </div>

                {/* FAQ */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold flex items-center gap-2"><BookOpen size={14} className="text-brand-accent" /> Quick FAQ</p>
                  {[
                    { id: "faq1", q: "How long does onboarding take?", a: "Typically 5-10 minutes. You can save progress and come back anytime." },
                    { id: "faq2", q: "Can I change things after launching?", a: "Yes, everything can be edited from the client profile and settings after launch." },
                    { id: "faq3", q: "What happens after I click Launch?", a: "The system creates the workspace, sends welcome emails, sets up publishing, and generates onboarding tasks." },
                  ].map(faq => (
                    <div key={faq.id} className="rounded-lg border border-[var(--color-border)] overflow-hidden">
                      <button onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                        className="w-full flex items-center justify-between p-3 text-left hover:bg-[rgba(0,0,0,0.03)] transition-colors">
                        <span className="text-xs">{faq.q}</span>
                        {expandedFaq === faq.id ? <ChevronUp size={12} className="text-text-muted" /> : <ChevronDown size={12} className="text-text-muted" />}
                      </button>
                      {expandedFaq === faq.id && (
                        <div className="px-3 pb-3 text-[10px] text-text-muted border-t border-[var(--color-border)] pt-2">{faq.a}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Step 1: Business Info ────────────────────────── */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2"><Building2 size={18} className="text-brand-accent" /> Business Information</h2>
                  <p className="text-xs text-text-muted mt-0.5">Core details about the new client</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: "business_name", label: "Business Name", placeholder: "Acme Corp (optional)", icon: Building2 },
                    { key: "contact_name", label: "Contact Name", placeholder: "John Smith (optional)", icon: Users },
                    { key: "email", label: "Email", placeholder: "john@acme.com (optional)", icon: Mail },
                    { key: "phone", label: "Phone", placeholder: "+1 (555) 123-4567", icon: Phone },
                    { key: "website", label: "Website", placeholder: "https://acme.com", icon: Globe },
                  ].map(field => (
                    <div key={field.key}>
                      <label className="block text-[10px] text-text-muted mb-1 font-medium">{field.label}</label>
                      <div className="relative">
                        <field.icon size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted/40" />
                        <input
                          value={form[field.key as keyof typeof form]}
                          onChange={e => updateForm(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="w-full pl-8 pr-3 py-2.5 bg-[rgba(0,0,0,0.04)] border border-[var(--color-border)] rounded-lg text-text-primary text-sm focus:outline-none focus:border-brand-accent transition-colors"
                        />
                      </div>
                    </div>
                  ))}
                  <div>
                    <label className="block text-[10px] text-text-muted mb-1 font-medium">Industry</label>
                    <select
                      value={form.industry}
                      onChange={e => updateForm("industry", e.target.value)}
                      className="w-full px-3 py-2.5 bg-[rgba(0,0,0,0.04)] border border-[var(--color-border)] rounded-lg text-text-primary text-sm focus:outline-none focus:border-brand-accent transition-colors">
                      <option value="">Select industry...</option>
                      {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                    </select>
                  </div>
                </div>

                <div className="border-t border-[var(--color-border)] pt-4">
                  <p className="text-xs text-brand-accent font-semibold mb-3 flex items-center gap-1.5"><Zap size={12} /> AI Context (improves content generation)</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-text-muted mb-1">Target Audience</label>
                      <input value={form.target_audience} onChange={e => updateForm("target_audience", e.target.value)}
                        placeholder="e.g., Women 25-45 in urban areas"
                        className="w-full px-3 py-2.5 bg-[rgba(0,0,0,0.04)] border border-[var(--color-border)] rounded-lg text-text-primary text-sm focus:outline-none focus:border-brand-accent transition-colors" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-text-muted mb-1">Brand Voice</label>
                      <select value={form.brand_voice} onChange={e => updateForm("brand_voice", e.target.value)}
                        className="w-full px-3 py-2.5 bg-[rgba(0,0,0,0.04)] border border-[var(--color-border)] rounded-lg text-text-primary text-sm focus:outline-none focus:border-brand-accent transition-colors">
                        <option value="">Select tone...</option>
                        <option value="professional">Professional & Trustworthy</option>
                        <option value="friendly">Friendly & Approachable</option>
                        <option value="bold">Bold & Edgy</option>
                        <option value="luxury">Premium & Luxury</option>
                        <option value="casual">Casual & Fun</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[10px] text-text-muted mb-1">Main Goals</label>
                      <textarea value={form.goals} onChange={e => updateForm("goals", e.target.value)}
                        placeholder="What does this client want to achieve? e.g., Increase bookings by 50%, grow Instagram to 10k followers..."
                        className="w-full px-3 py-2.5 bg-[rgba(0,0,0,0.04)] border border-[var(--color-border)] rounded-lg text-text-primary text-sm focus:outline-none focus:border-brand-accent transition-colors h-20 resize-none" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 2: Brand Assets ─────────────────────────── */}
            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2"><Palette size={18} className="text-brand-accent" /> Brand Assets</h2>
                  <p className="text-xs text-text-muted mt-0.5">Upload logos, set brand colors, and choose fonts</p>
                </div>

                {/* File uploads */}
                <div>
                  <p className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Image size={12} className="text-brand-accent" /> Logos & Files</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {assets.map(asset => (
                      <button key={asset.id} onClick={() => toggleAsset(asset.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                          asset.uploaded ? "border-emerald-500/20 bg-emerald-500/5" : "border-[var(--color-border)] hover:border-[rgba(59,130,246,0.25)]"
                        }`}>
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                          asset.uploaded ? "bg-emerald-500/10 text-emerald-400" : "bg-[rgba(0,0,0,0.04)] text-text-muted"
                        }`}>
                          {asset.uploaded ? <Check size={16} /> : <Upload size={16} />}
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-medium">{asset.name}</p>
                          <p className="text-[9px] text-text-muted">{asset.uploaded ? "Uploaded" : "Click to upload (mock)"}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color presets */}
                <div>
                  <p className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Palette size={12} className="text-brand-accent" /> Brand Colors</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
                    {BRAND_COLORS.map(c => (
                      <button key={c.name}
                        onClick={() => { setSelectedColorPreset(c.name); setCustomPrimary(c.primary); setCustomSecondary(c.secondary); }}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all ${
                          selectedColorPreset === c.name ? "border-brand-accent bg-[rgba(59,130,246,0.05)]" : "border-[var(--color-border)] hover:border-[rgba(59,130,246,0.25)]"
                        }`}>
                        <div className="flex gap-1">
                          <div className="w-6 h-6 rounded-full border border-[rgba(0,0,0,0.08)]" style={{ backgroundColor: c.primary }} />
                          <div className="w-6 h-6 rounded-full border border-[rgba(0,0,0,0.08)]" style={{ backgroundColor: c.secondary }} />
                        </div>
                        <span className="text-xs">{c.name}</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-6">
                    <div>
                      <label className="block text-[9px] text-text-muted mb-1">Primary</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={customPrimary} onChange={e => setCustomPrimary(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
                        <span className="text-xs text-text-muted font-mono">{customPrimary}</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9px] text-text-muted mb-1">Secondary</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={customSecondary} onChange={e => setCustomSecondary(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
                        <span className="text-xs text-text-muted font-mono">{customSecondary}</span>
                      </div>
                    </div>
                    {/* Live preview */}
                    <div className="flex-1">
                      <label className="block text-[9px] text-text-muted mb-1">Preview</label>
                      <div className="flex items-center gap-2 p-2 rounded-lg border border-[var(--color-border)]">
                        <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: customPrimary }} />
                        <div className="flex-1 space-y-1">
                          <div className="h-1.5 rounded-full" style={{ backgroundColor: customPrimary, width: "70%" }} />
                          <div className="h-1.5 rounded-full" style={{ backgroundColor: customSecondary, width: "45%" }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Font selection */}
                <div>
                  <p className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Type size={12} className="text-brand-accent" /> Brand Font</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {FONT_OPTIONS.map(font => (
                      <button key={font} onClick={() => setSelectedFont(font)}
                        className={`p-3 rounded-xl border text-center transition-all ${
                          selectedFont === font ? "border-brand-accent bg-[rgba(59,130,246,0.05)]" : "border-[var(--color-border)] hover:border-[rgba(59,130,246,0.25)]"
                        }`}>
                        <p className="text-sm font-semibold" style={{ fontFamily: font }}>{font}</p>
                        <p className="text-[8px] text-text-muted mt-0.5" style={{ fontFamily: font }}>The quick brown fox</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 3: Service Selection ────────────────────── */}
            {step === 3 && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold flex items-center gap-2"><Briefcase size={18} className="text-brand-accent" /> Service Selection</h2>
                    <p className="text-xs text-text-muted mt-0.5">{selectedServices.length} services selected for {form.package_tier} package</p>
                  </div>
                  <span className="text-sm font-bold text-brand-accent">{selectedServices.length} active</span>
                </div>

                {/* Category filter */}
                <div className="flex gap-1 flex-wrap">
                  {categories.map(cat => (
                    <button key={cat} onClick={() => setServiceFilter(cat)}
                      className={`px-3 py-1.5 text-[10px] rounded-lg font-medium transition-all ${
                        serviceFilter === cat ? "bg-[rgba(59,130,246,0.08)] text-brand-accent" : "text-text-muted hover:text-text-primary"
                      }`}>
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Service grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {filteredServices.map(svc => (
                    <button key={svc.id} onClick={() => toggleService(svc.id)}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        svc.included ? "border-brand-accent bg-[rgba(59,130,246,0.05)]" : "border-[var(--color-border)] hover:border-[rgba(59,130,246,0.25)]"
                      }`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs font-semibold">{svc.name}</p>
                          <p className="text-[9px] text-text-muted mt-0.5">{svc.description}</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ml-2 ${
                          svc.included ? "border-brand-accent bg-brand-accent" : "border-[var(--color-border)]"
                        }`}>
                          {svc.included && <Check size={10} className="text-white" />}
                        </div>
                      </div>
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-[rgba(0,0,0,0.04)] text-text-muted mt-2 inline-block">{svc.category}</span>
                    </button>
                  ))}
                </div>

                {/* Selected summary */}
                {selectedServices.length > 0 && (
                  <div className="p-3 rounded-xl bg-[rgba(59,130,246,0.05)] border border-[rgba(59,130,246,0.1)]">
                    <p className="text-[10px] text-brand-accent font-semibold mb-1">Selected Services:</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedServices.map(s => (
                        <span key={s.id} className="text-[9px] px-2 py-0.5 bg-[rgba(59,130,246,0.08)] text-brand-accent rounded-full">{s.name}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Step 4: Access Setup ─────────────────────────── */}
            {step === 4 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2"><ShieldCheck size={18} className="text-brand-accent" /> Access Setup</h2>
                  <p className="text-xs text-text-muted mt-0.5">Configure portal access and team assignments</p>
                </div>

                {/* Toggle cards */}
                <div className="space-y-2">
                  {[
                    { label: "Client Portal Access", desc: "Client can log in to view tasks, invoices, and content", checked: portalEnabled, onChange: () => setPortalEnabled(!portalEnabled) },
                    { label: "Send Welcome Email", desc: "Automated welcome email with login details and next steps", checked: sendWelcome, onChange: () => setSendWelcome(!sendWelcome) },
                    { label: "Auto-Create First Invoice", desc: "Generate and send first invoice via Stripe", checked: autoInvoice, onChange: () => setAutoInvoice(!autoInvoice) },
                  ].map((toggle, i) => (
                    <label key={i} className="flex items-center gap-3 p-3.5 rounded-xl border border-[var(--color-border)] cursor-pointer hover:border-[rgba(59,130,246,0.2)] transition-all">
                      <div className={`relative w-10 h-5 rounded-full shrink-0 transition-colors ${toggle.checked ? "bg-brand-accent" : "bg-[rgba(0,0,0,0.06)]"}`}
                        onClick={toggle.onChange}>
                        <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                          style={{ left: toggle.checked ? "22px" : "2px" }} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold">{toggle.label}</p>
                        <p className="text-[9px] text-text-muted">{toggle.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Team members */}
                <div>
                  <p className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Users size={12} className="text-brand-accent" /> Team Members</p>
                  <div className="flex gap-2 mb-3">
                    <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="team@agency.com"
                      className="flex-1 px-3 py-2 bg-[rgba(0,0,0,0.04)] border border-[var(--color-border)] rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand-accent transition-colors" />
                    <select value={newRole} onChange={e => setNewRole(e.target.value as AccessUser["role"])}
                      className="px-3 py-2 bg-[rgba(0,0,0,0.04)] border border-[var(--color-border)] rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand-accent transition-colors">
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button onClick={addAccessUser} className="px-4 py-2 bg-brand-accent text-white rounded-lg text-sm font-semibold hover:bg-brand-accent/80 flex items-center gap-1">
                      <Plus size={14} /> Add
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {accessUsers.map((user, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-[var(--color-border)] bg-[rgba(0,0,0,0.04)]">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[rgba(59,130,246,0.08)] flex items-center justify-center">
                            <Mail size={12} className="text-brand-accent" />
                          </div>
                          <div>
                            <p className="text-xs font-medium">{user.email}</p>
                            <p className="text-[9px] text-text-muted capitalize">{user.role}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${
                            user.status === "active" ? "bg-emerald-500/10 text-emerald-400" :
                            user.status === "invited" ? "bg-[rgba(59,130,246,0.08)] text-brand-accent" :
                            "bg-yellow-500/10 text-yellow-400"
                          }`}>{user.status}</span>
                          <button onClick={() => removeAccessUser(user.email)} className="text-text-muted hover:text-red-400 transition-colors"><X size={12} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-[10px] text-text-muted mb-1">Internal Notes</label>
                  <textarea value={form.notes} onChange={e => updateForm("notes", e.target.value)}
                    placeholder="Anything to note about this client setup..."
                    className="w-full px-3 py-2.5 bg-[rgba(0,0,0,0.04)] border border-[var(--color-border)] rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand-accent h-20 resize-none transition-colors" />
                </div>
              </div>
            )}

            {/* ── Step 5: AI Personalize ───────────────────────── */}
            {step === 5 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2 text-brand-accent">
                    <Sparkles size={18} className="text-brand-accent" /> Personalized for you
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    A few optional follow-up questions — your answers help us tune content generation and your AI copilot.
                  </p>
                </div>

                {personalizeLoading && (
                  <div className="flex flex-col items-center gap-2 py-12 rounded-xl border border-[rgba(59,130,246,0.2)] bg-gradient-to-b from-[rgba(59,130,246,0.05)] to-transparent">
                    <Loader2 size={22} className="animate-spin text-brand-accent" />
                    <p className="text-xs text-text-muted">Our AI is getting to know you...</p>
                  </div>
                )}

                {!personalizeLoading && personalizeQuestions.length === 0 && (
                  <div className="rounded-xl border border-[var(--color-border)] p-6 text-center text-xs text-text-muted">
                    No custom questions right now — click Continue to skip this step.
                  </div>
                )}

                {!personalizeLoading && personalizeQuestions.length > 0 && (
                  <div className="space-y-4">
                    {personalizeQuestions.map((q) => (
                      <div key={q.id} className="rounded-xl border border-[var(--color-border)] p-4 bg-[rgba(0,0,0,0.04)]">
                        <label className="block text-xs font-semibold text-text-primary mb-1.5 flex items-start gap-1.5">
                          <Sparkles size={11} className="text-brand-accent mt-0.5 shrink-0" />
                          <span>{q.question}</span>
                        </label>
                        {q.help_text && (
                          <p className="text-[10px] text-text-muted mb-2 ml-5">{q.help_text}</p>
                        )}
                        <textarea
                          value={personalizeAnswers[q.id] || ""}
                          onChange={(e) =>
                            setPersonalizeAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                          }
                          placeholder={q.placeholder}
                          rows={2}
                          className="w-full px-3 py-2.5 bg-[rgba(0,0,0,0.04)] border border-[var(--color-border)] rounded-lg text-text-primary text-sm focus:outline-none focus:border-brand-accent transition-colors resize-none"
                        />
                      </div>
                    ))}
                    <p className="text-[10px] text-text-muted text-center">
                      All questions are optional. Click Skip or Continue when done.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Step 6: Review & Launch ──────────────────────── */}
            {step === 6 && (
              <div className="space-y-5">
                <div className="text-center space-y-2">
                  <h2 className="text-lg font-bold flex items-center justify-center gap-2"><Eye size={18} className="text-brand-accent" /> Review & Launch</h2>
                  <p className="text-xs text-text-muted">Verify everything looks correct, then hit Launch Client.</p>
                </div>

                {/* Summary grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Business info */}
                  <div className="rounded-xl border border-[var(--color-border)] p-4 space-y-2">
                    <p className="text-xs font-semibold text-brand-accent flex items-center gap-1.5"><Building2 size={12} /> Business Info</p>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between"><span className="text-text-muted">Business</span><span className="font-medium">{form.business_name || "---"}</span></div>
                      <div className="flex justify-between"><span className="text-text-muted">Contact</span><span>{form.contact_name || "---"}</span></div>
                      <div className="flex justify-between"><span className="text-text-muted">Email</span><span>{form.email || "---"}</span></div>
                      <div className="flex justify-between"><span className="text-text-muted">Phone</span><span>{form.phone || "---"}</span></div>
                      <div className="flex justify-between"><span className="text-text-muted">Industry</span><span>{form.industry || "---"}</span></div>
                      <div className="flex justify-between"><span className="text-text-muted">Package</span><span className="text-brand-accent font-bold">{form.package_tier}</span></div>
                    </div>
                  </div>

                  {/* Brand */}
                  <div className="rounded-xl border border-[var(--color-border)] p-4 space-y-2">
                    <p className="text-xs font-semibold text-brand-accent flex items-center gap-1.5"><Palette size={12} /> Brand Assets</p>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-text-muted">Colors</span>
                        <div className="flex gap-1">
                          <div className="w-5 h-5 rounded-full border border-[rgba(0,0,0,0.08)]" style={{ backgroundColor: customPrimary }} />
                          <div className="w-5 h-5 rounded-full border border-[rgba(0,0,0,0.08)]" style={{ backgroundColor: customSecondary }} />
                        </div>
                      </div>
                      <div className="flex justify-between"><span className="text-text-muted">Font</span><span>{selectedFont}</span></div>
                      <div className="flex justify-between"><span className="text-text-muted">Assets Uploaded</span><span>{uploadedAssets}/{assets.length}</span></div>
                      {form.brand_voice && <div className="flex justify-between"><span className="text-text-muted">Brand Voice</span><span className="capitalize">{form.brand_voice}</span></div>}
                    </div>
                  </div>

                  {/* Services */}
                  <div className="rounded-xl border border-[var(--color-border)] p-4 space-y-2">
                    <p className="text-xs font-semibold text-brand-accent flex items-center gap-1.5"><Briefcase size={12} /> Services ({selectedServices.length})</p>
                    {selectedServices.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {selectedServices.map(s => (
                          <span key={s.id} className="text-[9px] px-2 py-0.5 bg-[rgba(59,130,246,0.08)] text-brand-accent rounded-full">{s.name}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-text-muted">No services selected</p>
                    )}
                  </div>

                  {/* Access */}
                  <div className="rounded-xl border border-[var(--color-border)] p-4 space-y-2">
                    <p className="text-xs font-semibold text-brand-accent flex items-center gap-1.5"><ShieldCheck size={12} /> Access & Setup</p>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        {portalEnabled ? <Check size={12} className="text-emerald-400" /> : <X size={12} className="text-text-muted" />}
                        <span className={portalEnabled ? "" : "text-text-muted"}>Portal access</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {sendWelcome ? <Check size={12} className="text-emerald-400" /> : <X size={12} className="text-text-muted" />}
                        <span className={sendWelcome ? "" : "text-text-muted"}>Welcome email</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {autoInvoice ? <Check size={12} className="text-emerald-400" /> : <X size={12} className="text-text-muted" />}
                        <span className={autoInvoice ? "" : "text-text-muted"}>Auto invoice</span>
                      </div>
                      <div className="flex justify-between"><span className="text-text-muted">Team members</span><span>{accessUsers.length}</span></div>
                    </div>
                  </div>
                </div>

                {/* Goals & notes */}
                {(form.goals || form.notes) && (
                  <div className="rounded-xl border border-[var(--color-border)] p-4 space-y-2">
                    <p className="text-xs font-semibold text-brand-accent flex items-center gap-1.5"><Target size={12} /> Goals & Notes</p>
                    {form.goals && <p className="text-xs text-text-muted"><span className="text-text-primary font-medium">Goals:</span> {form.goals}</p>}
                    {form.target_audience && <p className="text-xs text-text-muted"><span className="text-text-primary font-medium">Target:</span> {form.target_audience}</p>}
                    {form.notes && <p className="text-xs text-text-muted"><span className="text-text-primary font-medium">Notes:</span> {form.notes}</p>}
                  </div>
                )}

                {/* Launch confirmation */}
                <div className="p-4 rounded-xl bg-[rgba(59,130,246,0.05)] border border-brand-accent/15 text-center">
                  <p className="text-xs text-brand-accent font-semibold mb-1">Ready to launch?</p>
                  <p className="text-[10px] text-text-muted">This will create the client workspace, configure services, and send invitations.</p>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between">
            <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
              className="flex items-center gap-2 px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors">
              <ArrowLeft size={14} /> Back
            </button>

            <div className="flex items-center gap-2">
              {/* Per-step skip — jump past THIS step without filling it in.
                  Hidden on welcome (step 0) and on the final review step. */}
              {step > 0 && step < STEP_META.length - 1 && (
                <button
                  onClick={() => setStep(step + 1)}
                  className="text-[11px] text-text-muted hover:text-text-primary transition-colors px-3 py-2 font-medium"
                  title="Skip this step — come back later from Settings"
                >
                  Skip this step
                </button>
              )}
              {/* Jump straight to the final review from any mid-step. */}
              {step > 0 && step < STEP_META.length - 2 && (
                <button onClick={() => setStep(STEP_META.length - 1)}
                  className="text-[10px] text-text-muted hover:text-text-primary transition-colors px-3 py-2">
                  Skip to end
                </button>
              )}

              {step < STEP_META.length - 1 ? (
                <button onClick={() => canProceed() && setStep(step + 1)} disabled={!canProceed()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-brand-accent text-white rounded-lg text-sm font-semibold hover:bg-brand-accent/80 disabled:opacity-40 transition-all">
                  Next <ArrowRight size={14} />
                </button>
              ) : (
                <div className="flex flex-col items-end gap-1">
                  <button onClick={launchClient} disabled={launching}
                    className="flex items-center gap-2 px-6 py-2.5 bg-brand-accent text-white rounded-lg text-sm font-bold hover:bg-brand-accent/80 transition-all disabled:opacity-50">
                    {launching ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
                    {launching ? "Launching..." : "Launch Client"}
                  </button>
                  {launchError && (
                    <p className="text-xs text-red-400 text-center mt-2">{launchError}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )
      )}
    </div>
  );
}
