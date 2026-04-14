"use client";

import { useState } from "react";
import {
  UserPlus, ArrowRight, ArrowLeft, Check, Sparkles,
  Play, ListChecks, Compass, Upload, Link2,
  Layout, Trophy, Clock, Mail, Shield,
  Globe, Zap, BookOpen, Star, ChevronDown, ChevronUp,
  Settings, Eye, Gift, Target, FileText, CheckCircle2,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────
type OnboardTab = "wizard" | "checklist" | "tour" | "integrations" | "achievements";

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  category: "setup" | "branding" | "team" | "content";
}

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  connected: boolean;
  category: "social" | "payment" | "email" | "analytics" | "crm";
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  earned: boolean;
  earnedDate?: string;
  points: number;
  icon: "star" | "trophy" | "zap" | "target" | "shield" | "gift";
}

interface TourStep {
  id: string;
  title: string;
  description: string;
  section: string;
  completed: boolean;
  duration: string;
}

interface TeamInvite {
  email: string;
  role: "admin" | "manager" | "member" | "viewer";
  status: "pending" | "sent" | "accepted";
}

// ── Mock Data ──────────────────────────────────────────────
const SERVICES = [
  "Social Media Management", "Content Marketing", "Video Production",
  "SEO & Content Strategy", "Email Marketing", "Paid Ads (Meta)",
  "Paid Ads (Google)", "Paid Ads (TikTok)", "Website Design & Development",
  "Branding & Creative Design", "AI Receptionist", "AI Chatbot",
  "Automation Workflows", "Lead Generation", "Community Management",
];

const PACKAGES = [
  { name: "Starter", price: "997", description: "Perfect for small businesses getting started", features: ["1 platform", "10 posts/mo", "Basic ads", "Monthly report"], color: "text-blue-400" },
  { name: "Growth", price: "2,497", description: "For businesses ready to scale", features: ["3 platforms", "30 posts/mo", "Advanced ads", "Weekly reports", "SEO", "Email marketing"], color: "text-gold" },
  { name: "Enterprise", price: "4,997", description: "Full-service agency partnership", features: ["All platforms", "Unlimited content", "Full ad management", "Daily reports", "AI systems", "Dedicated team", "Website included"], color: "text-purple-400" },
];

const TEMPLATES = [
  { id: "agency", name: "Agency Default", description: "Standard agency setup with all essentials", icon: "briefcase" },
  { id: "ecomm", name: "E-Commerce", description: "Optimized for online stores and product marketing", icon: "cart" },
  { id: "local", name: "Local Business", description: "For brick-and-mortar businesses wanting local reach", icon: "map" },
  { id: "saas", name: "SaaS Startup", description: "Tech-focused with growth metrics and product marketing", icon: "code" },
  { id: "creator", name: "Content Creator", description: "Personal brand with social-first approach", icon: "video" },
  { id: "restaurant", name: "Restaurant/F&B", description: "Menu showcase, reservations, and local SEO", icon: "food" },
];

const BRAND_COLORS = [
  { name: "Ocean Blue", primary: "#2563eb", secondary: "#60a5fa" },
  { name: "Forest Green", primary: "#16a34a", secondary: "#4ade80" },
  { name: "Royal Purple", primary: "#7c3aed", secondary: "#a78bfa" },
  { name: "Sunset Orange", primary: "#ea580c", secondary: "#fb923c" },
  { name: "Rose Pink", primary: "#e11d48", secondary: "#fb7185" },
  { name: "Slate Gray", primary: "#475569", secondary: "#94a3b8" },
];

const INITIAL_CHECKLIST: ChecklistItem[] = [
  { id: "c1", label: "Set up business profile", description: "Add your logo, name, and contact details", completed: true, category: "setup" },
  { id: "c2", label: "Choose a package plan", description: "Select the right tier for your client", completed: true, category: "setup" },
  { id: "c3", label: "Connect social accounts", description: "Link Facebook, Instagram, TikTok, or LinkedIn", completed: false, category: "setup" },
  { id: "c4", label: "Upload brand assets", description: "Add logos, fonts, and brand guidelines", completed: false, category: "branding" },
  { id: "c5", label: "Set brand colors", description: "Define primary and secondary brand colors", completed: false, category: "branding" },
  { id: "c6", label: "Choose a dashboard template", description: "Pick a starting layout for the client portal", completed: false, category: "branding" },
  { id: "c7", label: "Invite team members", description: "Add collaborators to this client workspace", completed: false, category: "team" },
  { id: "c8", label: "Assign roles & permissions", description: "Set who can edit, approve, or view content", completed: false, category: "team" },
  { id: "c9", label: "Create first content piece", description: "Draft a post, email, or blog to get started", completed: false, category: "content" },
  { id: "c10", label: "Schedule first week of posts", description: "Plan content for the first 7 days", completed: false, category: "content" },
  { id: "c11", label: "Set up reporting", description: "Configure weekly or monthly client reports", completed: false, category: "content" },
  { id: "c12", label: "Send welcome email", description: "Notify the client that everything is ready", completed: false, category: "setup" },
];

const INITIAL_INTEGRATIONS: Integration[] = [
  { id: "ig", name: "Instagram", description: "Post and schedule content to Instagram", icon: "IG", connected: true, category: "social" },
  { id: "fb", name: "Facebook", description: "Manage pages and run ad campaigns", icon: "FB", connected: true, category: "social" },
  { id: "tt", name: "TikTok", description: "Short-form video publishing", icon: "TT", connected: false, category: "social" },
  { id: "li", name: "LinkedIn", description: "Professional network content & ads", icon: "LI", connected: false, category: "social" },
  { id: "stripe", name: "Stripe", description: "Payment processing and invoicing", icon: "$$", connected: true, category: "payment" },
  { id: "paypal", name: "PayPal", description: "Alternative payment method", icon: "PP", connected: false, category: "payment" },
  { id: "mailchimp", name: "Mailchimp", description: "Email marketing campaigns", icon: "MC", connected: false, category: "email" },
  { id: "sendgrid", name: "SendGrid", description: "Transactional and marketing emails", icon: "SG", connected: true, category: "email" },
  { id: "ga4", name: "Google Analytics", description: "Website traffic and conversion tracking", icon: "GA", connected: false, category: "analytics" },
  { id: "gtm", name: "Google Tag Manager", description: "Tag management for tracking", icon: "TM", connected: false, category: "analytics" },
  { id: "hubspot", name: "HubSpot", description: "CRM and marketing automation", icon: "HS", connected: false, category: "crm" },
  { id: "salesforce", name: "Salesforce", description: "Enterprise CRM integration", icon: "SF", connected: false, category: "crm" },
];

const INITIAL_ACHIEVEMENTS: Achievement[] = [
  { id: "a1", title: "First Steps", description: "Complete the onboarding wizard", earned: true, earnedDate: "2025-03-01", points: 50, icon: "star" },
  { id: "a2", title: "Connected", description: "Link your first social account", earned: true, earnedDate: "2025-03-01", points: 25, icon: "zap" },
  { id: "a3", title: "Brand Builder", description: "Upload brand assets and set colors", earned: false, points: 50, icon: "target" },
  { id: "a4", title: "Team Player", description: "Invite 3+ team members", earned: false, points: 75, icon: "shield" },
  { id: "a5", title: "Content Machine", description: "Schedule 10 posts in one session", earned: false, points: 100, icon: "trophy" },
  { id: "a6", title: "Integration Pro", description: "Connect 5+ integrations", earned: false, points: 75, icon: "zap" },
  { id: "a7", title: "Full Setup", description: "Complete all checklist items", earned: false, points: 200, icon: "trophy" },
  { id: "a8", title: "Welcome Gift", description: "Send the welcome email to your client", earned: false, points: 25, icon: "gift" },
];

const TOUR_STEPS: TourStep[] = [
  { id: "t1", title: "Dashboard Overview", description: "Learn how to navigate the main dashboard and key metrics", section: "Dashboard", completed: true, duration: "2 min" },
  { id: "t2", title: "Client Management", description: "Add, edit, and manage client profiles and settings", section: "Clients", completed: true, duration: "3 min" },
  { id: "t3", title: "Content Calendar", description: "Plan, schedule, and publish content across platforms", section: "Calendar", completed: false, duration: "4 min" },
  { id: "t4", title: "Production Pipeline", description: "Track content from creation to client approval", section: "Production", completed: false, duration: "3 min" },
  { id: "t5", title: "Analytics & Reports", description: "View performance data and generate client reports", section: "Analytics", completed: false, duration: "3 min" },
  { id: "t6", title: "Team Collaboration", description: "Assign tasks, manage roles, and communicate", section: "Team", completed: false, duration: "2 min" },
  { id: "t7", title: "Billing & Invoices", description: "Set up recurring billing and track payments", section: "Billing", completed: false, duration: "3 min" },
  { id: "t8", title: "AI Tools", description: "Use AI to generate content, analyze data, and automate", section: "AI", completed: false, duration: "4 min" },
];

// ── Component ──────────────────────────────────────────────
export default function OnboardPage() {
  const [activeTab, setActiveTab] = useState<OnboardTab>("wizard");

  // Wizard state
  const [step, setStep] = useState(0);
  const [wizardComplete, setWizardComplete] = useState(false);
  const [form, setForm] = useState({
    business_name: "", contact_name: "", email: "", phone: "", website: "",
    industry: "", target_audience: "", goals: "", biggest_challenge: "", brand_voice: "",
    competitors: "", package_tier: "Growth", mrr: "2497", services: [] as string[],
    password: "", create_portal: true, create_invoice: true, setup_zernio: true,
    send_welcome: true, notes: "",
  });

  // Checklist state
  const [checklist, setChecklist] = useState<ChecklistItem[]>(INITIAL_CHECKLIST);
  const [checklistFilter, setChecklistFilter] = useState<"all" | "setup" | "branding" | "team" | "content">("all");

  // Integration state
  const [integrations, setIntegrations] = useState<Integration[]>(INITIAL_INTEGRATIONS);
  const [integrationFilter, setIntegrationFilter] = useState<"all" | "social" | "payment" | "email" | "analytics" | "crm">("all");

  // Achievement state
  const [achievements, setAchievements] = useState<Achievement[]>(INITIAL_ACHIEVEMENTS);

  // Tour state
  const [tourSteps, setTourSteps] = useState<TourStep[]>(TOUR_STEPS);
  const [activeTourStep, setActiveTourStep] = useState<string | null>(null);

  // Team invite state
  const [teamInvites, setTeamInvites] = useState<TeamInvite[]>([
    { email: "sarah@agency.com", role: "admin", status: "accepted" },
    { email: "mike@agency.com", role: "manager", status: "sent" },
  ]);
  const [newInviteEmail, setNewInviteEmail] = useState("");
  const [newInviteRole, setNewInviteRole] = useState<"admin" | "manager" | "member" | "viewer">("member");

  // Brand color state
  const [selectedColorPreset, setSelectedColorPreset] = useState<string | null>(null);
  const [customPrimary, setCustomPrimary] = useState("#d4a843");
  const [customSecondary, setCustomSecondary] = useState("#f0d68a");

  // Template state
  const [selectedTemplate, setSelectedTemplate] = useState<string>("agency");

  // Welcome video state
  const [videoPlaying, setVideoPlaying] = useState(false);

  // Import data state
  const [importSource, setImportSource] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);

  // First client setup guide state
  const [guideExpanded, setGuideExpanded] = useState<string | null>(null);

  // ── Helpers ──────────────────────────────────────────────
  const updateForm = (key: string, value: unknown) => setForm(prev => ({ ...prev, [key]: value }));
  const toggleService = (s: string) => {
    const services = form.services.includes(s) ? form.services.filter(x => x !== s) : [...form.services, s];
    updateForm("services", services);
  };

  const toggleChecklist = (id: string) => {
    setChecklist(prev => prev.map(item =>
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const toggleIntegration = (id: string) => {
    setIntegrations(prev => prev.map(item =>
      item.id === id ? { ...item, connected: !item.connected } : item
    ));
  };

  const completeTourStep = (id: string) => {
    setTourSteps(prev => prev.map(s =>
      s.id === id ? { ...s, completed: true } : s
    ));
  };

  const addTeamInvite = () => {
    if (!newInviteEmail) return;
    setTeamInvites(prev => [...prev, { email: newInviteEmail, role: newInviteRole, status: "pending" }]);
    setNewInviteEmail("");
  };

  const sendInvite = (email: string) => {
    setTeamInvites(prev => prev.map(inv =>
      inv.email === email ? { ...inv, status: "sent" } : inv
    ));
  };

  const startImport = (source: string) => {
    setImportSource(source);
    setIsImporting(true);
    setImportProgress(0);
    // Simulate progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15 + 5;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setIsImporting(false);
      }
      setImportProgress(Math.min(100, Math.round(progress)));
    }, 300);
  };

  const earnAchievement = (id: string) => {
    setAchievements(prev => prev.map(a =>
      a.id === id ? { ...a, earned: true, earnedDate: "2025-04-14" } : a
    ));
  };

  const completedChecklist = checklist.filter(c => c.completed).length;
  const totalChecklist = checklist.length;
  const checklistPercent = Math.round((completedChecklist / totalChecklist) * 100);

  const completedTour = tourSteps.filter(t => t.completed).length;
  const totalTour = tourSteps.length;
  const tourPercent = Math.round((completedTour / totalTour) * 100);

  const earnedPoints = achievements.filter(a => a.earned).reduce((sum, a) => sum + a.points, 0);
  const totalPoints = achievements.reduce((sum, a) => sum + a.points, 0);

  const connectedIntegrations = integrations.filter(i => i.connected).length;

  const filteredChecklist = checklistFilter === "all" ? checklist : checklist.filter(c => c.category === checklistFilter);
  const filteredIntegrations = integrationFilter === "all" ? integrations : integrations.filter(i => i.category === integrationFilter);

  const achievementIcon = (icon: Achievement["icon"], size: number) => {
    switch (icon) {
      case "star": return <Star size={size} />;
      case "trophy": return <Trophy size={size} />;
      case "zap": return <Zap size={size} />;
      case "target": return <Target size={size} />;
      case "shield": return <Shield size={size} />;
      case "gift": return <Gift size={size} />;
    }
  };

  // ── Wizard Steps ────────────────────────────────────────
  const wizardSteps = [
    // Step 0: Client Info
    <div key="info" className="space-y-4">
      <h2 className="text-xl font-bold text-gold">Client Information</h2>
      <p className="text-sm text-muted">Basic details about the new client</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-muted mb-1">Business Name *</label>
          <input value={form.business_name} onChange={e => updateForm("business_name", e.target.value)} className="w-full px-3 py-2 bg-surface-light border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-gold" />
        </div>
        <div>
          <label className="block text-sm text-muted mb-1">Contact Name *</label>
          <input value={form.contact_name} onChange={e => updateForm("contact_name", e.target.value)} className="w-full px-3 py-2 bg-surface-light border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-gold" />
        </div>
        <div>
          <label className="block text-sm text-muted mb-1">Email *</label>
          <input type="email" value={form.email} onChange={e => updateForm("email", e.target.value)} className="w-full px-3 py-2 bg-surface-light border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-gold" />
        </div>
        <div>
          <label className="block text-sm text-muted mb-1">Phone</label>
          <input value={form.phone} onChange={e => updateForm("phone", e.target.value)} className="w-full px-3 py-2 bg-surface-light border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-gold" />
        </div>
        <div>
          <label className="block text-sm text-muted mb-1">Website</label>
          <input value={form.website} onChange={e => updateForm("website", e.target.value)} className="w-full px-3 py-2 bg-surface-light border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-gold" />
        </div>
        <div>
          <label className="block text-sm text-muted mb-1">Industry</label>
          <input value={form.industry} onChange={e => updateForm("industry", e.target.value)} className="w-full px-3 py-2 bg-surface-light border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-gold" placeholder="e.g., Dentist, Lawyer, Gym" />
        </div>
      </div>
      <div className="pt-2 border-t border-border">
        <p className="text-xs text-gold font-semibold mb-3">AI Context (helps us serve them better)</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted mb-1">Target Audience</label>
            <input value={form.target_audience} onChange={e => updateForm("target_audience", e.target.value)} className="w-full px-3 py-2 bg-surface-light border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-gold" placeholder="e.g., Women 25-45" />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Brand Voice</label>
            <select value={form.brand_voice} onChange={e => updateForm("brand_voice", e.target.value)} className="w-full px-3 py-2 bg-surface-light border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-gold">
              <option value="">Select tone...</option>
              <option value="professional">Professional & Trustworthy</option>
              <option value="friendly">Friendly & Approachable</option>
              <option value="bold">Bold & Edgy</option>
              <option value="luxury">Premium & Luxury</option>
              <option value="casual">Casual & Fun</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Main Goals</label>
            <input value={form.goals} onChange={e => updateForm("goals", e.target.value)} className="w-full px-3 py-2 bg-surface-light border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-gold" placeholder="e.g., Get more bookings" />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Biggest Challenge</label>
            <input value={form.biggest_challenge} onChange={e => updateForm("biggest_challenge", e.target.value)} className="w-full px-3 py-2 bg-surface-light border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-gold" placeholder="e.g., Low online visibility" />
          </div>
        </div>
        <div className="mt-3">
          <label className="block text-sm text-muted mb-1">Competitors (optional)</label>
          <input value={form.competitors} onChange={e => updateForm("competitors", e.target.value)} className="w-full px-3 py-2 bg-surface-light border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-gold" placeholder="e.g., Competitor names" />
        </div>
      </div>
    </div>,

    // Step 1: Package Selection
    <div key="package" className="space-y-4">
      <h2 className="text-xl font-bold text-gold">Select Package</h2>
      <p className="text-sm text-muted">Choose the right plan for this client</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PACKAGES.map(pkg => (
          <button key={pkg.name} onClick={() => { updateForm("package_tier", pkg.name); updateForm("mrr", pkg.price.replace(",", "")); }}
            className={`p-5 rounded-xl border text-left transition-all ${form.package_tier === pkg.name ? "border-gold bg-gold/10" : "border-border hover:border-gold/30"}`}>
            <p className="font-bold text-lg">{pkg.name}</p>
            <p className={`text-2xl font-bold mt-1 ${pkg.color}`}>${pkg.price}<span className="text-sm text-muted font-normal">/mo</span></p>
            <p className="text-xs text-muted mt-2">{pkg.description}</p>
            <ul className="mt-3 space-y-1">
              {pkg.features.map((f, i) => (
                <li key={i} className="text-xs flex items-center gap-1.5">
                  <Check size={10} className="text-gold shrink-0" /> {f}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>
      <div>
        <label className="block text-sm text-muted mb-1">Custom MRR (if different)</label>
        <input type="number" value={form.mrr} onChange={e => updateForm("mrr", e.target.value)} className="w-48 px-3 py-2 bg-surface-light border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-gold" />
      </div>
    </div>,

    // Step 2: Services
    <div key="services" className="space-y-4">
      <h2 className="text-xl font-bold text-gold">Select Services</h2>
      <p className="text-sm text-muted">What will we be doing for this client? ({form.services.length} selected)</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {SERVICES.map(s => (
          <button key={s} onClick={() => toggleService(s)}
            className={`p-3 rounded-lg border text-sm text-left transition-all ${form.services.includes(s) ? "border-gold bg-gold/10 text-gold" : "border-border text-muted hover:border-gold/30 hover:text-foreground"}`}>
            <span className="flex items-center gap-2">
              {form.services.includes(s) && <Check size={14} />}
              {s}
            </span>
          </button>
        ))}
      </div>
    </div>,

    // Step 3: Brand Colors & Template
    <div key="branding" className="space-y-4">
      <h2 className="text-xl font-bold text-gold">Brand Setup</h2>
      <p className="text-sm text-muted">Set client brand colors and choose a dashboard template</p>

      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">Color Presets</p>
        <div className="grid grid-cols-3 gap-2">
          {BRAND_COLORS.map(c => (
            <button key={c.name} onClick={() => { setSelectedColorPreset(c.name); setCustomPrimary(c.primary); setCustomSecondary(c.secondary); }}
              className={`p-3 rounded-lg border flex items-center gap-3 transition-all ${selectedColorPreset === c.name ? "border-gold bg-gold/5" : "border-border hover:border-gold/30"}`}>
              <div className="flex gap-1">
                <div className="w-6 h-6 rounded-full" style={{ backgroundColor: c.primary }} />
                <div className="w-6 h-6 rounded-full" style={{ backgroundColor: c.secondary }} />
              </div>
              <span className="text-xs">{c.name}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-4 mt-2">
          <div>
            <label className="block text-xs text-muted mb-1">Primary</label>
            <div className="flex items-center gap-2">
              <input type="color" value={customPrimary} onChange={e => setCustomPrimary(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
              <span className="text-xs text-muted font-mono">{customPrimary}</span>
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Secondary</label>
            <div className="flex items-center gap-2">
              <input type="color" value={customSecondary} onChange={e => setCustomSecondary(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
              <span className="text-xs text-muted font-mono">{customSecondary}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <p className="text-sm font-medium text-foreground mb-2">Dashboard Template</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {TEMPLATES.map(t => (
            <button key={t.id} onClick={() => setSelectedTemplate(t.id)}
              className={`p-3 rounded-lg border text-left transition-all ${selectedTemplate === t.id ? "border-gold bg-gold/10" : "border-border hover:border-gold/30"}`}>
              <div className="flex items-center gap-2 mb-1">
                <Layout size={14} className={selectedTemplate === t.id ? "text-gold" : "text-muted"} />
                <span className="text-sm font-medium">{t.name}</span>
              </div>
              <p className="text-xs text-muted">{t.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>,

    // Step 4: Invite Team
    <div key="team" className="space-y-4">
      <h2 className="text-xl font-bold text-gold">Invite Team</h2>
      <p className="text-sm text-muted">Add team members who will work on this client</p>

      <div className="flex gap-2">
        <input value={newInviteEmail} onChange={e => setNewInviteEmail(e.target.value)} placeholder="team@agency.com"
          className="flex-1 px-3 py-2 bg-surface-light border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-gold" />
        <select value={newInviteRole} onChange={e => setNewInviteRole(e.target.value as TeamInvite["role"])}
          className="px-3 py-2 bg-surface-light border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-gold">
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="member">Member</option>
          <option value="viewer">Viewer</option>
        </select>
        <button onClick={addTeamInvite} className="px-4 py-2 bg-gold text-black rounded-lg text-sm font-medium hover:bg-gold/90">
          Add
        </button>
      </div>

      <div className="space-y-2">
        {teamInvites.map((inv, i) => (
          <div key={i} className="flex items-center justify-between p-3 bg-surface-light rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center">
                <Mail size={14} className="text-gold" />
              </div>
              <div>
                <p className="text-sm font-medium">{inv.email}</p>
                <p className="text-xs text-muted capitalize">{inv.role}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {inv.status === "accepted" && <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-400 rounded-full">Joined</span>}
              {inv.status === "sent" && <span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-full">Invited</span>}
              {inv.status === "pending" && (
                <button onClick={() => sendInvite(inv.email)} className="text-xs px-3 py-1 bg-gold/10 text-gold rounded-lg hover:bg-gold/20">
                  Send Invite
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted">You can always invite more people later from Team settings.</p>
    </div>,

    // Step 5: Setup Options
    <div key="setup" className="space-y-4">
      <h2 className="text-xl font-bold text-gold">Setup Options</h2>
      <p className="text-sm text-muted">Configure what to set up automatically</p>
      <div className="space-y-3">
        <label className="flex items-center gap-3 p-3 bg-surface-light rounded-lg cursor-pointer border border-border">
          <input type="checkbox" checked={form.create_portal} onChange={e => updateForm("create_portal", e.target.checked)} className="accent-gold" />
          <div>
            <p className="text-sm font-medium">Create Client Portal Access</p>
            <p className="text-xs text-muted">Client can log in to view tasks, invoices, and content</p>
          </div>
        </label>
        {form.create_portal && (
          <div className="ml-8">
            <label className="block text-sm text-muted mb-1">Set client password</label>
            <input type="text" value={form.password} onChange={e => updateForm("password", e.target.value)} className="w-64 px-3 py-2 bg-surface-light border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-gold" placeholder="Their login password" />
          </div>
        )}
        <label className="flex items-center gap-3 p-3 bg-surface-light rounded-lg cursor-pointer border border-border">
          <input type="checkbox" checked={form.create_invoice} onChange={e => updateForm("create_invoice", e.target.checked)} className="accent-gold" />
          <div>
            <p className="text-sm font-medium">Create First Invoice</p>
            <p className="text-xs text-muted">Send invoice for first month via Stripe (7 day payment terms)</p>
          </div>
        </label>
        <label className="flex items-center gap-3 p-3 bg-surface-light rounded-lg cursor-pointer border border-border">
          <input type="checkbox" checked={form.setup_zernio} onChange={e => updateForm("setup_zernio", e.target.checked)} className="accent-gold" />
          <div>
            <p className="text-sm font-medium">Set Up Social Publishing (Zernio)</p>
            <p className="text-xs text-muted">Create a Zernio profile for auto-publishing</p>
          </div>
        </label>
        <label className="flex items-center gap-3 p-3 bg-surface-light rounded-lg cursor-pointer border border-border">
          <input type="checkbox" checked={form.send_welcome} onChange={e => updateForm("send_welcome", e.target.checked)} className="accent-gold" />
          <div>
            <p className="text-sm font-medium">Send Welcome Email</p>
            <p className="text-xs text-muted">Automated welcome email with login details and next steps</p>
          </div>
        </label>
      </div>
      <div>
        <label className="block text-sm text-muted mb-1">Notes</label>
        <textarea value={form.notes} onChange={e => updateForm("notes", e.target.value)} className="w-full h-20 px-3 py-2 bg-surface-light border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-gold resize-none" placeholder="Anything else to note..." />
      </div>
    </div>,

    // Step 6: Review & Launch
    <div key="review" className="space-y-4">
      <h2 className="text-xl font-bold text-gold">Review & Launch</h2>
      <p className="text-sm text-muted">Everything looks good? Hit launch to onboard this client.</p>
      <div className="bg-surface-light p-4 rounded-xl border border-border">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-muted">Business:</span> <span className="font-medium">{form.business_name || "---"}</span></div>
          <div><span className="text-muted">Contact:</span> <span className="font-medium">{form.contact_name || "---"}</span></div>
          <div><span className="text-muted">Email:</span> <span>{form.email || "---"}</span></div>
          <div><span className="text-muted">Package:</span> <span className="text-gold font-bold">{form.package_tier} — ${parseInt(form.mrr || "0").toLocaleString()}/mo</span></div>
          <div className="col-span-2"><span className="text-muted">Services:</span> <span>{form.services.join(", ") || "None selected"}</span></div>
          <div><span className="text-muted">Template:</span> <span className="capitalize">{selectedTemplate}</span></div>
          <div className="flex items-center gap-2">
            <span className="text-muted">Brand:</span>
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: customPrimary }} />
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: customSecondary }} />
          </div>
          {form.target_audience && <div><span className="text-muted">Audience:</span> <span>{form.target_audience}</span></div>}
          {form.goals && <div><span className="text-muted">Goals:</span> <span>{form.goals}</span></div>}
        </div>
      </div>
      <div className="space-y-2 text-sm">
        <p className="flex items-center gap-2">{form.create_portal ? <Check size={14} className="text-green-400" /> : <span className="text-muted">-</span>} Portal access {form.create_portal ? "will be created" : "skipped"}</p>
        <p className="flex items-center gap-2">{form.create_invoice ? <Check size={14} className="text-green-400" /> : <span className="text-muted">-</span>} First invoice {form.create_invoice ? "will be sent" : "skipped"}</p>
        <p className="flex items-center gap-2">{form.setup_zernio ? <Check size={14} className="text-green-400" /> : <span className="text-muted">-</span>} Zernio profile {form.setup_zernio ? "will be created" : "skipped"}</p>
        <p className="flex items-center gap-2">{form.send_welcome ? <Check size={14} className="text-green-400" /> : <span className="text-muted">-</span>} Welcome email {form.send_welcome ? "will be sent" : "skipped"}</p>
        <p className="flex items-center gap-2"><Check size={14} className="text-green-400" /> {teamInvites.length} team members assigned</p>
        <p className="flex items-center gap-2"><Check size={14} className="text-green-400" /> 8 onboarding tasks will be created</p>
      </div>
    </div>,
  ];

  // ── Tab Definitions ─────────────────────────────────────
  const tabs: { id: OnboardTab; label: string; icon: React.ReactNode }[] = [
    { id: "wizard", label: "Wizard", icon: <Sparkles size={14} /> },
    { id: "checklist", label: "Checklist", icon: <ListChecks size={14} /> },
    { id: "tour", label: "Platform Tour", icon: <Compass size={14} /> },
    { id: "integrations", label: "Integrations", icon: <Link2 size={14} /> },
    { id: "achievements", label: "Achievements", icon: <Trophy size={14} /> },
  ];

  return (
    <div className="fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
            <UserPlus size={24} className="text-gold" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Onboarding Center</h1>
            <p className="text-xs text-muted">Set up new clients and explore the platform</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted">
          <div className="flex items-center gap-1.5">
            <ListChecks size={12} className="text-gold" />
            <span>{completedChecklist}/{totalChecklist} tasks</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Trophy size={12} className="text-gold" />
            <span>{earnedPoints} pts</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Link2 size={12} className="text-gold" />
            <span>{connectedIntegrations} connected</span>
          </div>
        </div>
      </div>

      {/* Welcome Video Section */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Play size={16} className="text-gold" />
            <span className="text-sm font-semibold text-foreground">Welcome to ShortStack OS</span>
          </div>
          <span className="text-xs text-muted">3:42</span>
        </div>
        <div className={`relative rounded-lg overflow-hidden ${videoPlaying ? "bg-black" : "bg-surface-light"}`} style={{ aspectRatio: "16/6" }}>
          {!videoPlaying ? (
            <button onClick={() => setVideoPlaying(true)} className="absolute inset-0 flex flex-col items-center justify-center gap-2 hover:bg-gold/5 transition-colors">
              <div className="w-14 h-14 rounded-full bg-gold/20 flex items-center justify-center">
                <Play size={24} className="text-gold ml-1" />
              </div>
              <span className="text-sm text-muted">Watch the quick start guide</span>
            </button>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gold animate-pulse" />
                <span className="text-sm text-gold font-medium">Playing welcome video...</span>
              </div>
              <div className="w-64 h-1.5 bg-surface-light rounded-full overflow-hidden">
                <div className="h-full bg-gold rounded-full" style={{ width: "35%", transition: "width 0.5s" }} />
              </div>
              <button onClick={() => setVideoPlaying(false)} className="text-xs text-muted hover:text-foreground">Close</button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === t.id ? "border-gold text-gold" : "border-transparent text-muted hover:text-foreground"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── WIZARD TAB ──────────────────────────────────── */}
      {activeTab === "wizard" && (
        <div className="space-y-4">
          {wizardComplete ? (
            <div className="bg-surface rounded-xl border border-gold/30 p-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-gold/10 rounded-full flex items-center justify-center">
                <CheckCircle2 size={32} className="text-gold" />
              </div>
              <h2 className="text-xl font-bold text-gold">Onboarding Complete!</h2>
              <p className="text-sm text-muted max-w-md mx-auto">
                {form.business_name || "New client"} has been set up successfully. Check the Checklist tab to continue configuring their workspace.
              </p>
              <button onClick={() => { setWizardComplete(false); setStep(0); }} className="px-4 py-2 bg-gold/10 text-gold rounded-lg text-sm hover:bg-gold/20">
                Onboard Another Client
              </button>
            </div>
          ) : (
            <>
              {/* Progress */}
              <div className="flex gap-1">
                {wizardSteps.map((_, i) => (
                  <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${i <= step ? "bg-gold" : "bg-surface-light"}`} />
                ))}
              </div>
              <p className="text-xs text-muted text-right">Step {step + 1} of {wizardSteps.length}</p>

              {/* Step Content */}
              <div className="bg-surface rounded-xl border border-border p-6">
                {wizardSteps[step]}
              </div>

              {/* Navigation */}
              <div className="flex justify-between">
                <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
                  className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm text-muted hover:text-foreground disabled:opacity-30 transition-colors">
                  <ArrowLeft size={16} /> Back
                </button>
                {step < wizardSteps.length - 1 ? (
                  <button onClick={() => setStep(step + 1)} className="flex items-center gap-2 px-4 py-2 bg-gold text-black rounded-lg text-sm font-medium hover:bg-gold/90">
                    Next <ArrowRight size={16} />
                  </button>
                ) : (
                  <button onClick={() => setWizardComplete(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-gold text-black rounded-lg text-sm font-medium hover:bg-gold/90">
                    <Sparkles size={16} /> Launch Onboarding
                  </button>
                )}
              </div>
            </>
          )}

          {/* First Client Setup Guide */}
          <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-gold" />
              <span className="text-sm font-semibold text-foreground">First Client Setup Guide</span>
            </div>
            {[
              { id: "g1", title: "What information do I need from my client?", content: "At minimum, you need their business name, email, and preferred services. For best results, also gather target audience, brand guidelines, social media credentials, and past marketing performance data." },
              { id: "g2", title: "How do I choose the right package?", content: "Starter is for businesses with a single platform focus. Growth is for multi-channel marketing with analytics. Enterprise is for full-service agency partnerships with dedicated support and unlimited content." },
              { id: "g3", title: "Can I change the package later?", content: "Yes, you can upgrade or downgrade at any time from the client settings. Changes take effect at the next billing cycle. Prorated credits apply for upgrades." },
              { id: "g4", title: "What happens after onboarding?", content: "The system creates the client workspace, sets up social publishing, sends the welcome email, and generates 8 onboarding tasks. You can track progress from the Checklist tab." },
            ].map(g => (
              <div key={g.id} className="border border-border rounded-lg overflow-hidden">
                <button onClick={() => setGuideExpanded(guideExpanded === g.id ? null : g.id)}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-surface-light transition-colors">
                  <span className="text-sm text-foreground">{g.title}</span>
                  {guideExpanded === g.id ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
                </button>
                {guideExpanded === g.id && (
                  <div className="px-3 pb-3 text-xs text-muted leading-relaxed border-t border-border pt-2">
                    {g.content}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CHECKLIST TAB ───────────────────────────────── */}
      {activeTab === "checklist" && (
        <div className="space-y-4">
          {/* Progress Overview */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Setup Progress</p>
                <p className="text-xs text-muted">{completedChecklist} of {totalChecklist} tasks complete</p>
              </div>
              <span className="text-2xl font-bold text-gold">{checklistPercent}%</span>
            </div>
            <div className="w-full h-3 bg-surface-light rounded-full overflow-hidden">
              <div className="h-full bg-gold rounded-full transition-all duration-500" style={{ width: `${checklistPercent}%` }} />
            </div>
            <div className="flex gap-4 mt-3">
              {(["setup", "branding", "team", "content"] as const).map(cat => {
                const catItems = checklist.filter(c => c.category === cat);
                const catDone = catItems.filter(c => c.completed).length;
                return (
                  <div key={cat} className="flex items-center gap-1.5 text-xs">
                    <div className={`w-2 h-2 rounded-full ${catDone === catItems.length ? "bg-green-400" : "bg-surface-light"}`} />
                    <span className="capitalize text-muted">{cat}</span>
                    <span className="text-foreground font-medium">{catDone}/{catItems.length}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Filter */}
          <div className="flex gap-1">
            {(["all", "setup", "branding", "team", "content"] as const).map(f => (
              <button key={f} onClick={() => setChecklistFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${checklistFilter === f ? "bg-gold/10 text-gold" : "text-muted hover:text-foreground"}`}>
                {f}
              </button>
            ))}
          </div>

          {/* Checklist Items */}
          <div className="space-y-2">
            {filteredChecklist.map(item => (
              <button key={item.id} onClick={() => toggleChecklist(item.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${item.completed ? "border-green-500/20 bg-green-500/5" : "border-border bg-surface hover:border-gold/30"}`}>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${item.completed ? "border-green-400 bg-green-400" : "border-border"}`}>
                  {item.completed && <Check size={10} className="text-black" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${item.completed ? "line-through text-muted" : "text-foreground"}`}>{item.label}</p>
                  <p className="text-xs text-muted">{item.description}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                  item.category === "setup" ? "bg-blue-500/10 text-blue-400" :
                  item.category === "branding" ? "bg-purple-500/10 text-purple-400" :
                  item.category === "team" ? "bg-green-500/10 text-green-400" :
                  "bg-orange-500/10 text-orange-400"
                }`}>{item.category}</span>
              </button>
            ))}
          </div>

          {/* Import Existing Data */}
          <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Upload size={16} className="text-gold" />
              <span className="text-sm font-semibold text-foreground">Import Existing Data</span>
            </div>
            <p className="text-xs text-muted">Migrate data from another platform to get started faster</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {["CSV File", "HubSpot", "Mailchimp", "Google Sheets"].map(source => (
                <button key={source} onClick={() => startImport(source)}
                  disabled={isImporting}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    importSource === source && isImporting ? "border-gold bg-gold/5" : "border-border hover:border-gold/30"
                  } disabled:opacity-50`}>
                  <Upload size={16} className="mx-auto mb-1 text-muted" />
                  <span className="text-xs font-medium">{source}</span>
                </button>
              ))}
            </div>
            {isImporting && importSource && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">Importing from {importSource}...</span>
                  <span className="text-gold font-medium">{importProgress}%</span>
                </div>
                <div className="w-full h-2 bg-surface-light rounded-full overflow-hidden">
                  <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${importProgress}%` }} />
                </div>
              </div>
            )}
            {!isImporting && importProgress === 100 && importSource && (
              <div className="flex items-center gap-2 text-xs text-green-400">
                <Check size={14} /> Successfully imported data from {importSource}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TOUR TAB ────────────────────────────────────── */}
      {activeTab === "tour" && (
        <div className="space-y-4">
          {/* Tour Progress */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Platform Tour Progress</p>
                <p className="text-xs text-muted">Learn the key features of ShortStack OS</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gold">{tourPercent}%</p>
                <p className="text-xs text-muted">{completedTour}/{totalTour} modules</p>
              </div>
            </div>
            <div className="w-full h-3 bg-surface-light rounded-full overflow-hidden">
              <div className="h-full bg-gold rounded-full transition-all duration-500" style={{ width: `${tourPercent}%` }} />
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Clock size={12} className="text-muted" />
              <span className="text-xs text-muted">
                Est. {tourSteps.filter(t => !t.completed).reduce((sum, t) => sum + parseInt(t.duration), 0)} min remaining
              </span>
            </div>
          </div>

          {/* Tour Steps */}
          <div className="space-y-2">
            {tourSteps.map((ts, i) => (
              <div key={ts.id}
                className={`rounded-xl border transition-all ${
                  ts.completed ? "border-green-500/20 bg-green-500/5" :
                  activeTourStep === ts.id ? "border-gold bg-gold/5" : "border-border bg-surface"
                }`}>
                <button onClick={() => setActiveTourStep(activeTourStep === ts.id ? null : ts.id)}
                  className="w-full flex items-center gap-4 p-4 text-left">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
                    ts.completed ? "bg-green-400 text-black" : "bg-surface-light text-muted"
                  }`}>
                    {ts.completed ? <Check size={14} /> : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${ts.completed ? "text-muted line-through" : "text-foreground"}`}>{ts.title}</p>
                    <p className="text-xs text-muted">{ts.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted">{ts.duration}</span>
                    {activeTourStep === ts.id ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
                  </div>
                </button>
                {activeTourStep === ts.id && !ts.completed && (
                  <div className="px-4 pb-4 border-t border-border pt-3">
                    <div className="bg-surface-light rounded-lg p-4 text-center space-y-3">
                      <div className="w-12 h-12 mx-auto bg-gold/10 rounded-xl flex items-center justify-center">
                        <Compass size={24} className="text-gold" />
                      </div>
                      <p className="text-sm text-foreground">Ready to explore <span className="font-semibold">{ts.section}</span>?</p>
                      <p className="text-xs text-muted">This interactive walkthrough takes about {ts.duration}</p>
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => completeTourStep(ts.id)}
                          className="px-4 py-2 bg-gold text-black rounded-lg text-sm font-medium hover:bg-gold/90">
                          Start Tour
                        </button>
                        <button onClick={() => { completeTourStep(ts.id); setActiveTourStep(null); }}
                          className="px-4 py-2 border border-border rounded-lg text-sm text-muted hover:text-foreground">
                          Skip
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Quick Tips */}
          <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-gold" />
              <span className="text-sm font-semibold text-foreground">Quick Tips</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                { tip: "Use keyboard shortcut Cmd+K to quickly search anything", icon: <Settings size={14} /> },
                { tip: "Pin your most-used pages to the sidebar for quick access", icon: <Eye size={14} /> },
                { tip: "Set up notifications to stay on top of client activity", icon: <Globe size={14} /> },
                { tip: "Use templates to speed up content creation by 3x", icon: <FileText size={14} /> },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2 p-3 bg-surface-light rounded-lg">
                  <div className="text-gold mt-0.5 shrink-0">{item.icon}</div>
                  <span className="text-xs text-muted">{item.tip}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── INTEGRATIONS TAB ────────────────────────────── */}
      {activeTab === "integrations" && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Connected", value: connectedIntegrations, total: integrations.length },
              { label: "Social", value: integrations.filter(i => i.category === "social" && i.connected).length, total: integrations.filter(i => i.category === "social").length },
              { label: "Payment", value: integrations.filter(i => i.category === "payment" && i.connected).length, total: integrations.filter(i => i.category === "payment").length },
              { label: "Other", value: integrations.filter(i => !["social", "payment"].includes(i.category) && i.connected).length, total: integrations.filter(i => !["social", "payment"].includes(i.category)).length },
            ].map((stat, i) => (
              <div key={i} className="bg-surface rounded-xl border border-border p-3 text-center">
                <p className="text-xl font-bold text-gold">{stat.value}/{stat.total}</p>
                <p className="text-xs text-muted">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Filter */}
          <div className="flex gap-1">
            {(["all", "social", "payment", "email", "analytics", "crm"] as const).map(f => (
              <button key={f} onClick={() => setIntegrationFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${integrationFilter === f ? "bg-gold/10 text-gold" : "text-muted hover:text-foreground"}`}>
                {f}
              </button>
            ))}
          </div>

          {/* Integration Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredIntegrations.map(integ => (
              <div key={integ.id} className={`bg-surface rounded-xl border p-4 flex items-center justify-between transition-all ${integ.connected ? "border-green-500/20" : "border-border"}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold ${integ.connected ? "bg-green-500/10 text-green-400" : "bg-surface-light text-muted"}`}>
                    {integ.icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{integ.name}</p>
                    <p className="text-xs text-muted">{integ.description}</p>
                  </div>
                </div>
                <button onClick={() => toggleIntegration(integ.id)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${integ.connected ? "bg-green-500" : "bg-surface-light"}`}>
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${integ.connected ? "left-5.5" : "left-0.5"}`}
                    style={{ left: integ.connected ? "22px" : "2px" }} />
                </button>
              </div>
            ))}
          </div>

          {/* API Key Section */}
          <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-gold" />
              <span className="text-sm font-semibold text-foreground">API Configuration</span>
            </div>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-muted mb-1">API Key</label>
                <div className="flex gap-2">
                  <input type="password" value="sk-demo-xxxxxxxxxxxxxxxxxxxx" readOnly
                    className="flex-1 px-3 py-2 bg-surface-light border border-border rounded-lg text-foreground text-sm font-mono" />
                  <button className="px-3 py-2 border border-border rounded-lg text-xs text-muted hover:text-foreground">Copy</button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Webhook URL</label>
                <div className="flex gap-2">
                  <input type="text" value="https://api.shortstack.os/webhooks/abc123" readOnly
                    className="flex-1 px-3 py-2 bg-surface-light border border-border rounded-lg text-foreground text-sm font-mono" />
                  <button className="px-3 py-2 border border-border rounded-lg text-xs text-muted hover:text-foreground">Copy</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ACHIEVEMENTS TAB ────────────────────────────── */}
      {activeTab === "achievements" && (
        <div className="space-y-4">
          {/* Points Overview */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Achievement Points</p>
                <p className="text-xs text-muted">{achievements.filter(a => a.earned).length} of {achievements.length} badges earned</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gold">{earnedPoints}</p>
                <p className="text-xs text-muted">of {totalPoints} total</p>
              </div>
            </div>
            <div className="w-full h-3 bg-surface-light rounded-full overflow-hidden">
              <div className="h-full bg-gold rounded-full transition-all duration-500" style={{ width: `${Math.round((earnedPoints / totalPoints) * 100)}%` }} />
            </div>
            {/* Level indicator */}
            <div className="flex items-center gap-3 mt-3">
              <div className="flex items-center gap-1.5">
                <Star size={14} className="text-gold" />
                <span className="text-sm font-semibold text-gold">
                  {earnedPoints < 100 ? "Beginner" : earnedPoints < 250 ? "Explorer" : earnedPoints < 400 ? "Pro" : "Master"}
                </span>
              </div>
              <span className="text-xs text-muted">
                {earnedPoints < 100 ? `${100 - earnedPoints} pts to Explorer` :
                 earnedPoints < 250 ? `${250 - earnedPoints} pts to Pro` :
                 earnedPoints < 400 ? `${400 - earnedPoints} pts to Master` :
                 "Max level reached!"}
              </span>
            </div>
          </div>

          {/* Achievement Badges */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {achievements.map(ach => (
              <div key={ach.id} className={`bg-surface rounded-xl border p-4 transition-all ${ach.earned ? "border-gold/30" : "border-border opacity-70"}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${ach.earned ? "bg-gold/10 text-gold" : "bg-surface-light text-muted"}`}>
                    {achievementIcon(ach.icon, 24)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">{ach.title}</p>
                      <span className={`text-xs font-bold ${ach.earned ? "text-gold" : "text-muted"}`}>+{ach.points} pts</span>
                    </div>
                    <p className="text-xs text-muted mt-0.5">{ach.description}</p>
                    {ach.earned ? (
                      <div className="flex items-center gap-1.5 mt-2">
                        <Check size={12} className="text-green-400" />
                        <span className="text-xs text-green-400">Earned {ach.earnedDate}</span>
                      </div>
                    ) : (
                      <button onClick={() => earnAchievement(ach.id)}
                        className="mt-2 text-xs px-3 py-1 bg-gold/10 text-gold rounded-lg hover:bg-gold/20">
                        Claim (demo)
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Leaderboard */}
          <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Trophy size={16} className="text-gold" />
              <span className="text-sm font-semibold text-foreground">Team Leaderboard</span>
            </div>
            <div className="space-y-2">
              {[
                { name: "Sarah Chen", role: "Admin", points: 425, rank: 1 },
                { name: "You", role: "Owner", points: earnedPoints, rank: 2 },
                { name: "Mike Johnson", role: "Manager", points: 50, rank: 3 },
              ].sort((a, b) => b.points - a.points).map((member, i) => (
                <div key={member.name} className={`flex items-center gap-3 p-3 rounded-lg ${member.name === "You" ? "bg-gold/5 border border-gold/20" : "bg-surface-light"}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    i === 0 ? "bg-gold text-black" : i === 1 ? "bg-gray-400 text-black" : "bg-orange-600 text-white"
                  }`}>{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{member.name}</p>
                    <p className="text-xs text-muted">{member.role}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star size={12} className="text-gold" />
                    <span className="text-sm font-bold text-gold">{member.points}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Milestones */}
          <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-gold" />
              <span className="text-sm font-semibold text-foreground">Milestones</span>
            </div>
            <div className="flex items-center gap-2">
              {[
                { label: "100 pts", threshold: 100 },
                { label: "250 pts", threshold: 250 },
                { label: "400 pts", threshold: 400 },
                { label: "600 pts", threshold: 600 },
              ].map((m, i) => (
                <div key={i} className="flex-1 text-center">
                  <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center border-2 ${
                    earnedPoints >= m.threshold ? "border-gold bg-gold/10 text-gold" : "border-border text-muted"
                  }`}>
                    {earnedPoints >= m.threshold ? <Check size={14} /> : <span className="text-xs">{i + 1}</span>}
                  </div>
                  <p className="text-xs text-muted mt-1">{m.label}</p>
                </div>
              ))}
            </div>
            <div className="w-full h-1.5 bg-surface-light rounded-full overflow-hidden">
              <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${Math.min(100, (earnedPoints / 600) * 100)}%` }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
