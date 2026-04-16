"use client";

import { useState } from "react";
import {
  UserPlus, ArrowRight, ArrowLeft, Check, Sparkles,
  Upload, Palette, Briefcase, ShieldCheck, Eye,
  Rocket, ChevronDown, ChevronUp, Crown,
  Image, Type, Layers, Globe, Mail, Phone,
  Building2, Target, Users, Plus, X,
  CheckCircle2, Layout, Zap, BookOpen,
} from "lucide-react";
import { PLAN_TIERS, type PlanTier } from "@/lib/plan-config";

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
  { name: "Ocean Blue", primary: "#2563eb", secondary: "#93c5fd" },
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
/*  Wizard Step Labels                                                 */
/* ================================================================== */

const STEP_META = [
  { label: "Welcome", icon: Sparkles, description: "Get started" },
  { label: "Business Info", icon: Building2, description: "Company details" },
  { label: "Brand Assets", icon: Palette, description: "Logo, colors, fonts" },
  { label: "Services", icon: Briefcase, description: "Select services" },
  { label: "Access Setup", icon: ShieldCheck, description: "Team & portal" },
  { label: "Review & Launch", icon: Rocket, description: "Final review" },
];

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */

export default function OnboardPage() {
  const [mode, setMode] = useState<"full" | "quick">("full");
  const [step, setStep] = useState(0);
  const [wizardComplete, setWizardComplete] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Quick-add form state
  const [quickForm, setQuickForm] = useState({
    business_name: "",
    contact_name: "",
    email: "",
    phone: "",
    package_tier: "Growth",
  });
  const [quickSubmitted, setQuickSubmitted] = useState(false);
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

  const canProceed = (): boolean => {
    if (step === 1) return form.business_name.trim().length > 0 && form.email.trim().length > 0;
    return true;
  };

  const progressPercent = Math.round(((step + 1) / STEP_META.length) * 100);

  // ── Render ──────────────────────────────────────────────
  return (
    <div className="fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
            <UserPlus size={22} className="text-gold" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Client Onboarding Wizard</h1>
            <p className="text-xs text-muted">Step-by-step setup for new clients</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowTemplates(!showTemplates)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border text-muted hover:text-foreground hover:border-gold/30 transition-all">
            <Layout size={12} /> Templates
          </button>
          {selectedTemplate && (
            <span className="text-[9px] px-2 py-0.5 bg-gold/10 text-gold rounded-full">
              Using: {ONBOARD_TEMPLATES.find(t => t.id === selectedTemplate)?.name}
            </span>
          )}
        </div>
      </div>

      {/* Mode Toggle: Full Wizard vs Quick Add */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-[var(--color-border)] w-fit">
        <button
          onClick={() => setMode("full")}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            mode === "full" ? "bg-gold text-black" : "text-muted hover:text-foreground"
          }`}>
          Full Wizard
        </button>
        <button
          onClick={() => setMode("quick")}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            mode === "quick" ? "bg-gold text-black" : "text-muted hover:text-foreground"
          }`}>
          Quick Add
        </button>
      </div>

      {/* ── Quick Add Mode ─────────────────────────────────── */}
      {mode === "quick" && (
        quickSubmitted ? (
          <div className="rounded-2xl border border-gold/30 bg-[var(--color-surface)] p-10 text-center space-y-5">
            <div className="w-20 h-20 mx-auto bg-gold/10 rounded-full flex items-center justify-center">
              <CheckCircle2 size={40} className="text-gold" />
            </div>
            <h2 className="text-2xl font-bold text-gold">Client Created!</h2>
            <p className="text-sm text-muted max-w-lg mx-auto">
              <span className="font-semibold text-foreground">{quickForm.business_name}</span> has been added on the{" "}
              <span className="text-gold font-semibold">{quickForm.package_tier}</span> plan.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => {
                  setQuickSubmitted(false);
                  setQuickForm({ business_name: "", contact_name: "", email: "", phone: "", package_tier: "Growth" });
                }}
                className="px-5 py-2.5 rounded-lg border border-[var(--color-border)] text-sm text-muted hover:text-foreground transition-colors">
                Add Another
              </button>
              <button className="px-5 py-2.5 bg-gold text-black rounded-lg text-sm font-semibold hover:bg-gold/90 flex items-center gap-1.5">
                <Eye size={14} /> View Client Profile
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Zap size={18} className="text-gold" /> Quick Add Client
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Rapidly add a client without the full onboarding wizard
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Business Name */}
              <div>
                <label className="block text-[10px] text-muted mb-1 font-medium">Business Name *</label>
                <div className="relative">
                  <Building2 size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/40" />
                  <input value={quickForm.business_name} onChange={e => updateQuick("business_name", e.target.value)}
                    placeholder="Acme Corp"
                    className="w-full pl-8 pr-3 py-2.5 bg-white/[0.03] border border-[var(--color-border)] rounded-lg text-foreground text-sm focus:outline-none focus:border-gold transition-colors" />
                </div>
              </div>

              {/* Contact Name */}
              <div>
                <label className="block text-[10px] text-muted mb-1 font-medium">Contact Name *</label>
                <div className="relative">
                  <Users size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/40" />
                  <input value={quickForm.contact_name} onChange={e => updateQuick("contact_name", e.target.value)}
                    placeholder="John Smith"
                    className="w-full pl-8 pr-3 py-2.5 bg-white/[0.03] border border-[var(--color-border)] rounded-lg text-foreground text-sm focus:outline-none focus:border-gold transition-colors" />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-[10px] text-muted mb-1 font-medium">Email *</label>
                <div className="relative">
                  <Mail size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/40" />
                  <input value={quickForm.email} onChange={e => updateQuick("email", e.target.value)}
                    placeholder="john@acme.com" type="email"
                    className="w-full pl-8 pr-3 py-2.5 bg-white/[0.03] border border-[var(--color-border)] rounded-lg text-foreground text-sm focus:outline-none focus:border-gold transition-colors" />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-[10px] text-muted mb-1 font-medium">Phone</label>
                <div className="relative">
                  <Phone size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/40" />
                  <input value={quickForm.phone} onChange={e => updateQuick("phone", e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className="w-full pl-8 pr-3 py-2.5 bg-white/[0.03] border border-[var(--color-border)] rounded-lg text-foreground text-sm focus:outline-none focus:border-gold transition-colors" />
                </div>
              </div>

              {/* Package Dropdown */}
              <div className="md:col-span-2">
                <label className="block text-[10px] text-muted mb-1 font-medium">Package</label>
                <select value={quickForm.package_tier} onChange={e => updateQuick("package_tier", e.target.value)}
                  className="w-full px-3 py-2.5 bg-white/[0.03] border border-[var(--color-border)] rounded-lg text-foreground text-sm focus:outline-none focus:border-gold transition-colors">
                  {PACKAGES.map(pkg => (
                    <option key={pkg.name} value={pkg.name}>{pkg.name} ({pkg.price}/mo)</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button onClick={() => setMode("full")}
                className="px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-muted hover:text-foreground transition-colors">
                Switch to Full Wizard
              </button>
              <button
                onClick={() => {
                  if (quickForm.business_name.trim() && quickForm.contact_name.trim() && quickForm.email.trim()) {
                    setQuickSubmitted(true);
                  }
                }}
                disabled={!quickForm.business_name.trim() || !quickForm.contact_name.trim() || !quickForm.email.trim()}
                className="flex items-center gap-2 px-6 py-2.5 bg-gold text-black rounded-lg text-sm font-bold hover:bg-gold/90 disabled:opacity-40 transition-all">
                <UserPlus size={14} /> Create Client
              </button>
            </div>
          </div>
        )
      )}

      {/* Template Gallery */}
      {mode === "full" && showTemplates && (
        <div className="rounded-2xl border border-border bg-[var(--color-surface)] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold flex items-center gap-2"><Layers size={14} className="text-gold" /> Onboarding Templates</h2>
              <p className="text-[10px] text-muted mt-0.5">Pre-built flows for different client types</p>
            </div>
            <button onClick={() => setShowTemplates(false)} className="text-muted hover:text-foreground"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {ONBOARD_TEMPLATES.map(tpl => (
              <button key={tpl.id}
                onClick={() => { setSelectedTemplate(tpl.id); setShowTemplates(false); }}
                className={`p-4 rounded-xl border text-left transition-all hover:border-gold/30 ${
                  selectedTemplate === tpl.id ? "border-gold bg-gold/5" : "border-[var(--color-border)] bg-[var(--color-surface)]"
                }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold">{tpl.name}</span>
                  {tpl.popular && (
                    <span className="text-[7px] px-1.5 py-0.5 bg-gold/10 text-gold rounded-full font-semibold">Popular</span>
                  )}
                </div>
                <p className="text-[10px] text-muted mb-2">{tpl.description}</p>
                <div className="flex items-center justify-between text-[9px] text-muted">
                  <span>{tpl.steps} steps</span>
                  <span>{tpl.industry}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Full Wizard Mode ────────────────────────────── */}
      {mode === "full" && (
      wizardComplete ? (
        <div className="rounded-2xl border border-gold/30 bg-[var(--color-surface)] p-10 text-center space-y-5">
          <div className="w-20 h-20 mx-auto bg-gold/10 rounded-full flex items-center justify-center">
            <CheckCircle2 size={40} className="text-gold" />
          </div>
          <h2 className="text-2xl font-bold text-gold">Client Launched Successfully!</h2>
          <p className="text-sm text-muted max-w-lg mx-auto">
            <span className="font-semibold text-foreground">{form.business_name || "New Client"}</span> has been onboarded.
            Their workspace is being configured with {selectedServices.length} services and {accessUsers.length} team member{accessUsers.length !== 1 ? "s" : ""}.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-xl mx-auto">
            {[
              { label: "Package", value: form.package_tier },
              { label: "Services", value: `${selectedServices.length} active` },
              { label: "Team", value: `${accessUsers.length} members` },
              { label: "Assets", value: `${uploadedAssets} uploaded` },
            ].map((stat, i) => (
              <div key={i} className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
                <p className="text-[9px] text-muted">{stat.label}</p>
                <p className="text-sm font-bold text-gold">{stat.value}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => { setWizardComplete(false); setStep(0); setForm({ business_name: "", contact_name: "", email: "", phone: "", website: "", industry: "", target_audience: "", goals: "", brand_voice: "", package_tier: "Growth", notes: "" }); }}
              className="px-5 py-2.5 rounded-lg border border-[var(--color-border)] text-sm text-muted hover:text-foreground transition-colors">
              Onboard Another Client
            </button>
            <button className="px-5 py-2.5 bg-gold text-black rounded-lg text-sm font-semibold hover:bg-gold/90 flex items-center gap-1.5">
              <Eye size={14} /> View Client Profile
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Progress Bar */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted">Step {step + 1} of {STEP_META.length}</p>
              <p className="text-xs font-semibold text-gold">{progressPercent}% complete</p>
            </div>
            <div className="w-full h-2 bg-white/[0.04] rounded-full overflow-hidden mb-4">
              <div className="h-full bg-gold rounded-full transition-all duration-500 ease-out"
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
                      isActive ? "bg-gold/10 border border-gold/20" :
                      isDone ? "bg-emerald-500/5 border border-emerald-500/10 cursor-pointer" :
                      "border border-transparent opacity-50"
                    }`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      isDone ? "bg-emerald-500 text-black" :
                      isActive ? "bg-gold/20 text-gold" :
                      "bg-white/[0.04] text-muted"
                    }`}>
                      {isDone ? <Check size={12} /> : <Icon size={12} />}
                    </div>
                    <div className="hidden lg:block min-w-0">
                      <p className={`text-[10px] font-semibold truncate ${isActive ? "text-gold" : isDone ? "text-emerald-400" : "text-muted"}`}>{s.label}</p>
                      <p className="text-[8px] text-muted truncate">{s.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step Content Card */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">

            {/* ── Step 0: Welcome ──────────────────────────────── */}
            {step === 0 && (
              <div className="space-y-6">
                <div className="text-center space-y-3 py-4">
                  <div className="w-16 h-16 mx-auto bg-gold/10 rounded-2xl flex items-center justify-center">
                    <Sparkles size={28} className="text-gold" />
                  </div>
                  <h2 className="text-xl font-bold">Welcome to Client Onboarding</h2>
                  <p className="text-sm text-muted max-w-md mx-auto">
                    This wizard will guide you through setting up a new client in ShortStack OS.
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
                    <div key={i} className="p-4 rounded-xl border border-[var(--color-border)] bg-white/[0.01] text-center">
                      <item.icon size={20} className="mx-auto mb-2 text-gold" />
                      <p className="text-xs font-semibold">{item.label}</p>
                      <p className="text-[9px] text-muted mt-0.5">{item.desc}</p>
                    </div>
                  ))}
                </div>

                {/* Select package to start */}
                <div>
                  <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Crown size={14} className="text-gold" /> Choose a Package</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                    {PACKAGES.map(pkg => (
                      <button key={pkg.name}
                        onClick={() => updateForm("package_tier", pkg.name)}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          form.package_tier === pkg.name ? "border-gold bg-gold/5" : "border-[var(--color-border)] hover:border-gold/30"
                        }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-bold">{pkg.name}</span>
                          <span className="text-lg font-bold" style={{ color: pkg.color }}>{pkg.price}<span className="text-[9px] text-muted font-normal">/mo</span></span>
                        </div>
                        <ul className="space-y-1 mt-2">
                          {pkg.features.map((f, fi) => (
                            <li key={fi} className="text-[10px] text-muted flex items-center gap-1.5">
                              <Check size={8} className="text-gold shrink-0" /> {f}
                            </li>
                          ))}
                        </ul>
                      </button>
                    ))}
                  </div>
                </div>

                {/* FAQ */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold flex items-center gap-2"><BookOpen size={14} className="text-gold" /> Quick FAQ</p>
                  {[
                    { id: "faq1", q: "How long does onboarding take?", a: "Typically 5-10 minutes. You can save progress and come back anytime." },
                    { id: "faq2", q: "Can I change things after launching?", a: "Yes, everything can be edited from the client profile and settings after launch." },
                    { id: "faq3", q: "What happens after I click Launch?", a: "The system creates the workspace, sends welcome emails, sets up publishing, and generates onboarding tasks." },
                  ].map(faq => (
                    <div key={faq.id} className="rounded-lg border border-[var(--color-border)] overflow-hidden">
                      <button onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                        className="w-full flex items-center justify-between p-3 text-left hover:bg-white/[0.02] transition-colors">
                        <span className="text-xs">{faq.q}</span>
                        {expandedFaq === faq.id ? <ChevronUp size={12} className="text-muted" /> : <ChevronDown size={12} className="text-muted" />}
                      </button>
                      {expandedFaq === faq.id && (
                        <div className="px-3 pb-3 text-[10px] text-muted border-t border-[var(--color-border)] pt-2">{faq.a}</div>
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
                  <h2 className="text-lg font-bold flex items-center gap-2"><Building2 size={18} className="text-gold" /> Business Information</h2>
                  <p className="text-xs text-muted mt-0.5">Core details about the new client</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: "business_name", label: "Business Name *", placeholder: "Acme Corp", icon: Building2 },
                    { key: "contact_name", label: "Contact Name", placeholder: "John Smith", icon: Users },
                    { key: "email", label: "Email *", placeholder: "john@acme.com", icon: Mail },
                    { key: "phone", label: "Phone", placeholder: "+1 (555) 123-4567", icon: Phone },
                    { key: "website", label: "Website", placeholder: "https://acme.com", icon: Globe },
                  ].map(field => (
                    <div key={field.key}>
                      <label className="block text-[10px] text-muted mb-1 font-medium">{field.label}</label>
                      <div className="relative">
                        <field.icon size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/40" />
                        <input
                          value={form[field.key as keyof typeof form]}
                          onChange={e => updateForm(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="w-full pl-8 pr-3 py-2.5 bg-white/[0.03] border border-[var(--color-border)] rounded-lg text-foreground text-sm focus:outline-none focus:border-gold transition-colors"
                        />
                      </div>
                    </div>
                  ))}
                  <div>
                    <label className="block text-[10px] text-muted mb-1 font-medium">Industry</label>
                    <select
                      value={form.industry}
                      onChange={e => updateForm("industry", e.target.value)}
                      className="w-full px-3 py-2.5 bg-white/[0.03] border border-[var(--color-border)] rounded-lg text-foreground text-sm focus:outline-none focus:border-gold transition-colors">
                      <option value="">Select industry...</option>
                      {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                    </select>
                  </div>
                </div>

                <div className="border-t border-[var(--color-border)] pt-4">
                  <p className="text-xs text-gold font-semibold mb-3 flex items-center gap-1.5"><Zap size={12} /> AI Context (improves content generation)</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-muted mb-1">Target Audience</label>
                      <input value={form.target_audience} onChange={e => updateForm("target_audience", e.target.value)}
                        placeholder="e.g., Women 25-45 in urban areas"
                        className="w-full px-3 py-2.5 bg-white/[0.03] border border-[var(--color-border)] rounded-lg text-foreground text-sm focus:outline-none focus:border-gold transition-colors" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-muted mb-1">Brand Voice</label>
                      <select value={form.brand_voice} onChange={e => updateForm("brand_voice", e.target.value)}
                        className="w-full px-3 py-2.5 bg-white/[0.03] border border-[var(--color-border)] rounded-lg text-foreground text-sm focus:outline-none focus:border-gold transition-colors">
                        <option value="">Select tone...</option>
                        <option value="professional">Professional & Trustworthy</option>
                        <option value="friendly">Friendly & Approachable</option>
                        <option value="bold">Bold & Edgy</option>
                        <option value="luxury">Premium & Luxury</option>
                        <option value="casual">Casual & Fun</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[10px] text-muted mb-1">Main Goals</label>
                      <textarea value={form.goals} onChange={e => updateForm("goals", e.target.value)}
                        placeholder="What does this client want to achieve? e.g., Increase bookings by 50%, grow Instagram to 10k followers..."
                        className="w-full px-3 py-2.5 bg-white/[0.03] border border-[var(--color-border)] rounded-lg text-foreground text-sm focus:outline-none focus:border-gold transition-colors h-20 resize-none" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 2: Brand Assets ─────────────────────────── */}
            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2"><Palette size={18} className="text-gold" /> Brand Assets</h2>
                  <p className="text-xs text-muted mt-0.5">Upload logos, set brand colors, and choose fonts</p>
                </div>

                {/* File uploads */}
                <div>
                  <p className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Image size={12} className="text-gold" /> Logos & Files</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {assets.map(asset => (
                      <button key={asset.id} onClick={() => toggleAsset(asset.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                          asset.uploaded ? "border-emerald-500/20 bg-emerald-500/5" : "border-[var(--color-border)] hover:border-gold/30"
                        }`}>
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                          asset.uploaded ? "bg-emerald-500/10 text-emerald-400" : "bg-white/[0.03] text-muted"
                        }`}>
                          {asset.uploaded ? <Check size={16} /> : <Upload size={16} />}
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-medium">{asset.name}</p>
                          <p className="text-[9px] text-muted">{asset.uploaded ? "Uploaded" : "Click to upload (mock)"}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color presets */}
                <div>
                  <p className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Palette size={12} className="text-gold" /> Brand Colors</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
                    {BRAND_COLORS.map(c => (
                      <button key={c.name}
                        onClick={() => { setSelectedColorPreset(c.name); setCustomPrimary(c.primary); setCustomSecondary(c.secondary); }}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all ${
                          selectedColorPreset === c.name ? "border-gold bg-gold/5" : "border-[var(--color-border)] hover:border-gold/30"
                        }`}>
                        <div className="flex gap-1">
                          <div className="w-6 h-6 rounded-full border border-white/10" style={{ backgroundColor: c.primary }} />
                          <div className="w-6 h-6 rounded-full border border-white/10" style={{ backgroundColor: c.secondary }} />
                        </div>
                        <span className="text-xs">{c.name}</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-6">
                    <div>
                      <label className="block text-[9px] text-muted mb-1">Primary</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={customPrimary} onChange={e => setCustomPrimary(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
                        <span className="text-xs text-muted font-mono">{customPrimary}</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9px] text-muted mb-1">Secondary</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={customSecondary} onChange={e => setCustomSecondary(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
                        <span className="text-xs text-muted font-mono">{customSecondary}</span>
                      </div>
                    </div>
                    {/* Live preview */}
                    <div className="flex-1">
                      <label className="block text-[9px] text-muted mb-1">Preview</label>
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
                  <p className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Type size={12} className="text-gold" /> Brand Font</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {FONT_OPTIONS.map(font => (
                      <button key={font} onClick={() => setSelectedFont(font)}
                        className={`p-3 rounded-xl border text-center transition-all ${
                          selectedFont === font ? "border-gold bg-gold/5" : "border-[var(--color-border)] hover:border-gold/30"
                        }`}>
                        <p className="text-sm font-semibold" style={{ fontFamily: font }}>{font}</p>
                        <p className="text-[8px] text-muted mt-0.5" style={{ fontFamily: font }}>The quick brown fox</p>
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
                    <h2 className="text-lg font-bold flex items-center gap-2"><Briefcase size={18} className="text-gold" /> Service Selection</h2>
                    <p className="text-xs text-muted mt-0.5">{selectedServices.length} services selected for {form.package_tier} package</p>
                  </div>
                  <span className="text-sm font-bold text-gold">{selectedServices.length} active</span>
                </div>

                {/* Category filter */}
                <div className="flex gap-1 flex-wrap">
                  {categories.map(cat => (
                    <button key={cat} onClick={() => setServiceFilter(cat)}
                      className={`px-3 py-1.5 text-[10px] rounded-lg font-medium transition-all ${
                        serviceFilter === cat ? "bg-gold/10 text-gold" : "text-muted hover:text-foreground"
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
                        svc.included ? "border-gold bg-gold/5" : "border-[var(--color-border)] hover:border-gold/30"
                      }`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs font-semibold">{svc.name}</p>
                          <p className="text-[9px] text-muted mt-0.5">{svc.description}</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ml-2 ${
                          svc.included ? "border-gold bg-gold" : "border-[var(--color-border)]"
                        }`}>
                          {svc.included && <Check size={10} className="text-black" />}
                        </div>
                      </div>
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-white/[0.04] text-muted mt-2 inline-block">{svc.category}</span>
                    </button>
                  ))}
                </div>

                {/* Selected summary */}
                {selectedServices.length > 0 && (
                  <div className="p-3 rounded-xl bg-gold/5 border border-gold/10">
                    <p className="text-[10px] text-gold font-semibold mb-1">Selected Services:</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedServices.map(s => (
                        <span key={s.id} className="text-[9px] px-2 py-0.5 bg-gold/10 text-gold rounded-full">{s.name}</span>
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
                  <h2 className="text-lg font-bold flex items-center gap-2"><ShieldCheck size={18} className="text-gold" /> Access Setup</h2>
                  <p className="text-xs text-muted mt-0.5">Configure portal access and team assignments</p>
                </div>

                {/* Toggle cards */}
                <div className="space-y-2">
                  {[
                    { label: "Client Portal Access", desc: "Client can log in to view tasks, invoices, and content", checked: portalEnabled, onChange: () => setPortalEnabled(!portalEnabled) },
                    { label: "Send Welcome Email", desc: "Automated welcome email with login details and next steps", checked: sendWelcome, onChange: () => setSendWelcome(!sendWelcome) },
                    { label: "Auto-Create First Invoice", desc: "Generate and send first invoice via Stripe", checked: autoInvoice, onChange: () => setAutoInvoice(!autoInvoice) },
                  ].map((toggle, i) => (
                    <label key={i} className="flex items-center gap-3 p-3.5 rounded-xl border border-[var(--color-border)] cursor-pointer hover:border-gold/20 transition-all">
                      <div className={`relative w-10 h-5 rounded-full shrink-0 transition-colors ${toggle.checked ? "bg-gold" : "bg-white/[0.06]"}`}
                        onClick={toggle.onChange}>
                        <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                          style={{ left: toggle.checked ? "22px" : "2px" }} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold">{toggle.label}</p>
                        <p className="text-[9px] text-muted">{toggle.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Team members */}
                <div>
                  <p className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Users size={12} className="text-gold" /> Team Members</p>
                  <div className="flex gap-2 mb-3">
                    <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="team@agency.com"
                      className="flex-1 px-3 py-2 bg-white/[0.03] border border-[var(--color-border)] rounded-lg text-sm text-foreground focus:outline-none focus:border-gold transition-colors" />
                    <select value={newRole} onChange={e => setNewRole(e.target.value as AccessUser["role"])}
                      className="px-3 py-2 bg-white/[0.03] border border-[var(--color-border)] rounded-lg text-sm text-foreground focus:outline-none focus:border-gold transition-colors">
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button onClick={addAccessUser} className="px-4 py-2 bg-gold text-black rounded-lg text-sm font-semibold hover:bg-gold/90 flex items-center gap-1">
                      <Plus size={14} /> Add
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {accessUsers.map((user, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-[var(--color-border)] bg-white/[0.01]">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center">
                            <Mail size={12} className="text-gold" />
                          </div>
                          <div>
                            <p className="text-xs font-medium">{user.email}</p>
                            <p className="text-[9px] text-muted capitalize">{user.role}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${
                            user.status === "active" ? "bg-emerald-500/10 text-emerald-400" :
                            user.status === "invited" ? "bg-blue-500/10 text-blue-400" :
                            "bg-yellow-500/10 text-yellow-400"
                          }`}>{user.status}</span>
                          <button onClick={() => removeAccessUser(user.email)} className="text-muted hover:text-red-400 transition-colors"><X size={12} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-[10px] text-muted mb-1">Internal Notes</label>
                  <textarea value={form.notes} onChange={e => updateForm("notes", e.target.value)}
                    placeholder="Anything to note about this client setup..."
                    className="w-full px-3 py-2.5 bg-white/[0.03] border border-[var(--color-border)] rounded-lg text-sm text-foreground focus:outline-none focus:border-gold h-20 resize-none transition-colors" />
                </div>
              </div>
            )}

            {/* ── Step 5: Review & Launch ──────────────────────── */}
            {step === 5 && (
              <div className="space-y-5">
                <div className="text-center space-y-2">
                  <h2 className="text-lg font-bold flex items-center justify-center gap-2"><Eye size={18} className="text-gold" /> Review & Launch</h2>
                  <p className="text-xs text-muted">Verify everything looks correct, then hit Launch Client.</p>
                </div>

                {/* Summary grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Business info */}
                  <div className="rounded-xl border border-[var(--color-border)] p-4 space-y-2">
                    <p className="text-xs font-semibold text-gold flex items-center gap-1.5"><Building2 size={12} /> Business Info</p>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between"><span className="text-muted">Business</span><span className="font-medium">{form.business_name || "---"}</span></div>
                      <div className="flex justify-between"><span className="text-muted">Contact</span><span>{form.contact_name || "---"}</span></div>
                      <div className="flex justify-between"><span className="text-muted">Email</span><span>{form.email || "---"}</span></div>
                      <div className="flex justify-between"><span className="text-muted">Phone</span><span>{form.phone || "---"}</span></div>
                      <div className="flex justify-between"><span className="text-muted">Industry</span><span>{form.industry || "---"}</span></div>
                      <div className="flex justify-between"><span className="text-muted">Package</span><span className="text-gold font-bold">{form.package_tier}</span></div>
                    </div>
                  </div>

                  {/* Brand */}
                  <div className="rounded-xl border border-[var(--color-border)] p-4 space-y-2">
                    <p className="text-xs font-semibold text-gold flex items-center gap-1.5"><Palette size={12} /> Brand Assets</p>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-muted">Colors</span>
                        <div className="flex gap-1">
                          <div className="w-5 h-5 rounded-full border border-white/10" style={{ backgroundColor: customPrimary }} />
                          <div className="w-5 h-5 rounded-full border border-white/10" style={{ backgroundColor: customSecondary }} />
                        </div>
                      </div>
                      <div className="flex justify-between"><span className="text-muted">Font</span><span>{selectedFont}</span></div>
                      <div className="flex justify-between"><span className="text-muted">Assets Uploaded</span><span>{uploadedAssets}/{assets.length}</span></div>
                      {form.brand_voice && <div className="flex justify-between"><span className="text-muted">Brand Voice</span><span className="capitalize">{form.brand_voice}</span></div>}
                    </div>
                  </div>

                  {/* Services */}
                  <div className="rounded-xl border border-[var(--color-border)] p-4 space-y-2">
                    <p className="text-xs font-semibold text-gold flex items-center gap-1.5"><Briefcase size={12} /> Services ({selectedServices.length})</p>
                    {selectedServices.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {selectedServices.map(s => (
                          <span key={s.id} className="text-[9px] px-2 py-0.5 bg-gold/10 text-gold rounded-full">{s.name}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted">No services selected</p>
                    )}
                  </div>

                  {/* Access */}
                  <div className="rounded-xl border border-[var(--color-border)] p-4 space-y-2">
                    <p className="text-xs font-semibold text-gold flex items-center gap-1.5"><ShieldCheck size={12} /> Access & Setup</p>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        {portalEnabled ? <Check size={12} className="text-emerald-400" /> : <X size={12} className="text-muted" />}
                        <span className={portalEnabled ? "" : "text-muted"}>Portal access</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {sendWelcome ? <Check size={12} className="text-emerald-400" /> : <X size={12} className="text-muted" />}
                        <span className={sendWelcome ? "" : "text-muted"}>Welcome email</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {autoInvoice ? <Check size={12} className="text-emerald-400" /> : <X size={12} className="text-muted" />}
                        <span className={autoInvoice ? "" : "text-muted"}>Auto invoice</span>
                      </div>
                      <div className="flex justify-between"><span className="text-muted">Team members</span><span>{accessUsers.length}</span></div>
                    </div>
                  </div>
                </div>

                {/* Goals & notes */}
                {(form.goals || form.notes) && (
                  <div className="rounded-xl border border-[var(--color-border)] p-4 space-y-2">
                    <p className="text-xs font-semibold text-gold flex items-center gap-1.5"><Target size={12} /> Goals & Notes</p>
                    {form.goals && <p className="text-xs text-muted"><span className="text-foreground font-medium">Goals:</span> {form.goals}</p>}
                    {form.target_audience && <p className="text-xs text-muted"><span className="text-foreground font-medium">Target:</span> {form.target_audience}</p>}
                    {form.notes && <p className="text-xs text-muted"><span className="text-foreground font-medium">Notes:</span> {form.notes}</p>}
                  </div>
                )}

                {/* Launch confirmation */}
                <div className="p-4 rounded-xl bg-gold/5 border border-gold/15 text-center">
                  <p className="text-xs text-gold font-semibold mb-1">Ready to launch?</p>
                  <p className="text-[10px] text-muted">This will create the client workspace, configure services, and send invitations.</p>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between">
            <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
              className="flex items-center gap-2 px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-muted hover:text-foreground disabled:opacity-30 transition-colors">
              <ArrowLeft size={14} /> Back
            </button>

            <div className="flex items-center gap-2">
              {step > 0 && step < STEP_META.length - 1 && (
                <button onClick={() => setStep(STEP_META.length - 1)}
                  className="text-[10px] text-muted hover:text-foreground transition-colors px-3 py-2">
                  Skip to Review
                </button>
              )}

              {step < STEP_META.length - 1 ? (
                <button onClick={() => canProceed() && setStep(step + 1)} disabled={!canProceed()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gold text-black rounded-lg text-sm font-semibold hover:bg-gold/90 disabled:opacity-40 transition-all">
                  Save & Continue <ArrowRight size={14} />
                </button>
              ) : (
                <button onClick={() => setWizardComplete(true)}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gold text-black rounded-lg text-sm font-bold hover:bg-gold/90 transition-all">
                  <Rocket size={14} /> Launch Client
                </button>
              )}
            </div>
          </div>
        </>
      )
      )}
    </div>
  );
}
