"use client";

import { useState, useEffect } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  Target,
  AlertCircle,
  Users,
  Palette,
  Globe,
  Zap,
  Camera,
  Play,
  Plus,
  X,
  Star,
  Clock,
  DollarSign,
  MapPin,
  ShoppingBag,
  Layers,
  Store,
  TrendingUp,
  MessageSquare,
  Mail,
  FileText,
  Video,
  Image,
  BarChart3,
  Tag,
  ExternalLink,
  ChevronRight,
  AtSign,
  Hash,
} from "lucide-react";

/* ══════════════════════════════════════════════════════════════════
   TYPES
   ══════════════════════════════════════════════════════════════════ */

interface OnboardingData {
  // Step 2
  business_type: string;
  years_in_business: string;
  team_size: string;
  revenue_range: string;
  num_locations: number;
  service_area: string;
  // Step 3
  top_goals: string[];
  timeline: string;
  // Step 4
  challenges: string[];
  biggest_frustration: string;
  tried_before: string[];
  // Step 5
  customer_type: string;
  age_ranges: string[];
  gender_focus: string;
  income_level: string;
  discovery_channels: string[];
  // Step 6
  brand_personality: string[];
  content_types: string[];
  posting_frequency: string;
  content_topics: string[];
  // Step 7
  website_url: string;
  has_google_business: boolean;
  google_business_name: string;
  social_accounts: Record<string, string>;
  review_platforms: string[];
  google_rating: number | null;
  review_count: number | null;
  // Step 8
  connected_accounts: string[];
  // Step 9
  competitors: string[];
  competitor_urls: string[];
  competitor_strengths: string;
  our_usp: string;
  // Step 10
  ai_autopilot_enabled: boolean;
  ai_autopilot_daily: boolean;
}

interface Props {
  clientId: string;
  clientName: string;
  industry: string;
  onComplete: (data: OnboardingData) => void;
}

const TOTAL_STEPS = 10;

const EMPTY_DATA: OnboardingData = {
  business_type: "",
  years_in_business: "",
  team_size: "",
  revenue_range: "",
  num_locations: 1,
  service_area: "",
  top_goals: [],
  timeline: "",
  challenges: [],
  biggest_frustration: "",
  tried_before: [],
  customer_type: "",
  age_ranges: [],
  gender_focus: "",
  income_level: "",
  discovery_channels: [],
  brand_personality: [],
  content_types: [],
  posting_frequency: "",
  content_topics: [],
  website_url: "",
  has_google_business: false,
  google_business_name: "",
  social_accounts: {},
  review_platforms: [],
  google_rating: null,
  review_count: null,
  connected_accounts: [],
  competitors: ["", "", ""],
  competitor_urls: ["", "", ""],
  competitor_strengths: "",
  our_usp: "",
  ai_autopilot_enabled: true,
  ai_autopilot_daily: true,
};

/* ══════════════════════════════════════════════════════════════════
   SMALL HELPERS
   ══════════════════════════════════════════════════════════════════ */

function toggle<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item];
}

function ChoiceBtn({
  selected,
  onClick,
  children,
  className = "",
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200 ${
        selected
          ? "border-gold bg-gold/[0.08] text-foreground"
          : "border-border bg-surface-light text-muted hover:border-gold/40 hover:text-foreground"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function SelectCard({
  selected,
  onClick,
  children,
  className = "",
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative text-left rounded-2xl p-4 border transition-all duration-200 ${
        selected
          ? "border-gold bg-gold/[0.05] shadow-[0_0_0_1px_rgba(201,168,76,0.3)]"
          : "border-border bg-surface-light hover:border-gold/40"
      } ${className}`}
    >
      {selected && (
        <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-gold flex items-center justify-center">
          <Check size={11} className="text-white" />
        </span>
      )}
      {children}
    </button>
  );
}

function StepLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-gold mb-1">
      {children}
    </p>
  );
}

function StepTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-2xl font-bold text-foreground tracking-tight mb-1">
      {children}
    </h2>
  );
}

function StepSubtitle({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted mb-8">{children}</p>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-foreground mb-2.5 uppercase tracking-wider">
      {children}
    </p>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN WIZARD
   ══════════════════════════════════════════════════════════════════ */

export default function ClientOnboardingWizard({
  clientName,
  industry,
  onComplete,
}: Props) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>(EMPTY_DATA);
  const [topicInput, setTopicInput] = useState("");
  const [aiChecklistIndex, setAiChecklistIndex] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState<"forward" | "back">("forward");

  const progress = ((step - 1) / (TOTAL_STEPS - 1)) * 100;

  // Suggested topics from industry
  const TOPIC_SUGGESTIONS = [
    industry,
    "Tips & Tricks",
    "Behind the Scenes",
    "Customer Stories",
    "Promotions",
    "Industry News",
    "FAQ",
    "Team Spotlight",
    "Product Features",
    "How-To Guides",
  ].filter(Boolean);

  // AI checklist items that animate in on step 10
  const AI_CHECKLIST = [
    "Create a custom 30-day marketing strategy",
    "Write your first 5 social media posts",
    "Draft 3 blog article outlines",
    "Generate email newsletter templates",
    "Create ad copy variations",
    "Build a content calendar",
    "Analyze your competitors",
  ];

  useEffect(() => {
    if (step === 10) {
      setAiChecklistIndex(0);
      const interval = setInterval(() => {
        setAiChecklistIndex((prev) => {
          if (prev >= AI_CHECKLIST.length - 1) {
            clearInterval(interval);
            return prev;
          }
          return prev + 1;
        });
      }, 350);
      return () => clearInterval(interval);
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  function goTo(next: number) {
    if (animating) return;
    setDirection(next > step ? "forward" : "back");
    setAnimating(true);
    setTimeout(() => {
      setStep(next);
      setAnimating(false);
    }, 180);
  }

  function next() {
    if (step < TOTAL_STEPS) goTo(step + 1);
  }
  function back() {
    if (step > 1) goTo(step - 1);
  }

  function canProceed(): boolean {
    if (step === 2) return !!data.business_type;
    if (step === 3) return data.top_goals.length > 0 && !!data.timeline;
    return true;
  }

  function set<K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  /* ── Social account options ── */
  const SOCIAL_PLATFORMS = [
    { id: "instagram", label: "Instagram", icon: Camera },
    { id: "facebook", label: "Facebook", icon: AtSign },
    { id: "tiktok", label: "TikTok", icon: Play },
    { id: "linkedin", label: "LinkedIn", icon: Hash },
    { id: "youtube", label: "YouTube", icon: Video },
    { id: "twitter", label: "X / Twitter", icon: MessageSquare },
  ];

  const SOCIAL_STATUS_OPTIONS = [
    { value: "active", label: "Have it & active" },
    { value: "inactive", label: "Have it, inactive" },
    { value: "none", label: "Don't have it" },
  ];

  /* ── Integration cards ── */
  const INTEGRATIONS = [
    { id: "instagram", label: "Instagram", icon: Camera, color: "#E1306C", desc: "Posts, reels & insights" },
    { id: "facebook", label: "Facebook", icon: AtSign, color: "#1877F2", desc: "Page & ad account" },
    { id: "google_business", label: "Google Business", icon: Star, color: "#4285F4", desc: "Profile & reviews" },
    { id: "tiktok", label: "TikTok", icon: Play, color: "#010101", desc: "Videos & analytics" },
    { id: "google_analytics", label: "Google Analytics", icon: BarChart3, color: "#E37400", desc: "Traffic & conversions" },
    { id: "meta_ads", label: "Meta Ads", icon: Target, color: "#1877F2", desc: "Facebook & IG ads" },
    { id: "google_ads", label: "Google Ads", icon: TrendingUp, color: "#34A853", desc: "Search & display" },
  ];

  /* ── Content type icons ── */
  const CONTENT_TYPES = [
    { id: "social_posts", label: "Social media posts", icon: MessageSquare },
    { id: "blog_articles", label: "Blog articles", icon: FileText },
    { id: "video_content", label: "Video content", icon: Video },
    { id: "email_newsletters", label: "Email newsletters", icon: Mail },
    { id: "ad_creatives", label: "Ad creatives", icon: Image },
    { id: "website_copy", label: "Website copy", icon: Globe },
    { id: "review_responses", label: "Review responses", icon: Star },
    { id: "gbp_posts", label: "Google Business posts", icon: MapPin },
  ];

  /* ══════════════════════
     STEP RENDERERS
     ══════════════════════ */

  function renderStep() {
    switch (step) {
      /* ── STEP 1: WELCOME ── */
      case 1:
        return (
          <div className="flex flex-col items-center text-center py-8 px-4">
            <div className="relative mb-8">
              <div className="w-20 h-20 rounded-3xl bg-gold/10 border border-gold/20 flex items-center justify-center breathe">
                <Sparkles size={36} className="text-gold" />
              </div>
              <div className="absolute -inset-3 rounded-[2rem] bg-gold/[0.04] -z-10" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gold mb-3">
              Welcome to ShortStack OS
            </p>
            <h1 className="text-3xl font-bold text-foreground tracking-tight mb-4">
              Hey, {clientName}! 👋
            </h1>
            <p className="text-base text-muted max-w-md leading-relaxed mb-3">
              We&apos;ll ask a few questions to build your perfect marketing strategy — tailored specifically to{" "}
              <span className="text-foreground font-medium">your business</span>.
            </p>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface border border-border text-xs text-muted mb-10">
              <Clock size={13} className="text-gold" />
              Takes about 5 minutes
            </div>
            <button onClick={next} className="btn-primary flex items-center gap-2 text-base px-8 py-3">
              Let&apos;s Go
              <ArrowRight size={18} />
            </button>
          </div>
        );

      /* ── STEP 2: BUSINESS DEEP DIVE ── */
      case 2:
        return (
          <div>
            <StepLabel>Step 2 of 10</StepLabel>
            <StepTitle>Tell us about your business</StepTitle>
            <StepSubtitle>The more we know, the better we can tailor your strategy.</StepSubtitle>

            <div className="space-y-6">
              <div>
                <FieldLabel>Business type</FieldLabel>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "Service", icon: Layers, label: "Service" },
                    { id: "Product", icon: ShoppingBag, label: "Product" },
                    { id: "Hybrid", icon: Tag, label: "Hybrid" },
                    { id: "Marketplace", icon: Store, label: "Marketplace" },
                  ].map(({ id, icon: Icon, label }) => (
                    <SelectCard
                      key={id}
                      selected={data.business_type === id}
                      onClick={() => set("business_type", id)}
                      className="flex flex-col items-center gap-2 py-5"
                    >
                      <Icon size={22} className={data.business_type === id ? "text-gold" : "text-muted"} />
                      <span className="text-sm font-medium text-foreground">{label}</span>
                    </SelectCard>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>Years in business</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {["Just started", "1-2 years", "3-5 years", "5-10 years", "10+ years"].map((v) => (
                    <ChoiceBtn key={v} selected={data.years_in_business === v} onClick={() => set("years_in_business", v)}>
                      {v}
                    </ChoiceBtn>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>Team size</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {["Just me", "2-5", "6-15", "16-50", "50+"].map((v) => (
                    <ChoiceBtn key={v} selected={data.team_size === v} onClick={() => set("team_size", v)}>
                      <Users size={12} className="inline mr-1.5" />
                      {v}
                    </ChoiceBtn>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>Revenue range</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {["Pre-revenue", "Under $100K", "$100K–$500K", "$500K–$1M", "$1M–$5M", "$5M+"].map((v) => (
                    <ChoiceBtn key={v} selected={data.revenue_range === v} onClick={() => set("revenue_range", v)}>
                      <DollarSign size={12} className="inline mr-1" />
                      {v}
                    </ChoiceBtn>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Number of locations</FieldLabel>
                  <input
                    type="number"
                    min={1}
                    value={data.num_locations}
                    onChange={(e) => set("num_locations", parseInt(e.target.value) || 1)}
                    className="input w-full"
                  />
                </div>
                <div>
                  <FieldLabel>Service area</FieldLabel>
                  <input
                    type="text"
                    value={data.service_area}
                    onChange={(e) => set("service_area", e.target.value)}
                    placeholder="e.g. Miami-Dade County or Nationwide"
                    className="input w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      /* ── STEP 3: GOALS & PRIORITIES ── */
      case 3:
        return (
          <div>
            <StepLabel>Step 3 of 10</StepLabel>
            <StepTitle>Goals & priorities</StepTitle>
            <StepSubtitle>
              Select your top 3 goals.{" "}
              <span className={data.top_goals.length === 3 ? "text-gold font-medium" : ""}>
                {data.top_goals.length}/3 selected
              </span>
            </StepSubtitle>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
              {[
                "Get more clients",
                "Increase revenue",
                "Build brand awareness",
                "Launch new product/service",
                "Dominate local SEO",
                "Grow social media",
                "Reduce ad costs",
                "Improve online reputation",
                "Get more reviews",
                "Hire & recruit",
                "Enter new market",
                "Automate marketing",
              ].map((goal) => {
                const sel = data.top_goals.includes(goal);
                const maxed = data.top_goals.length >= 3;
                return (
                  <SelectCard
                    key={goal}
                    selected={sel}
                    onClick={() => {
                      if (!sel && maxed) return;
                      set("top_goals", toggle(data.top_goals, goal));
                    }}
                    className={`${!sel && maxed ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    <span className="text-sm font-medium text-foreground leading-snug block pr-5">{goal}</span>
                    {sel && (
                      <span className="mt-2 inline-block text-[10px] font-bold text-gold">
                        #{data.top_goals.indexOf(goal) + 1}
                      </span>
                    )}
                  </SelectCard>
                );
              })}
            </div>

            <div>
              <FieldLabel>Timeline to see results</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {["ASAP", "1-3 months", "3-6 months", "6-12 months"].map((v) => (
                  <ChoiceBtn key={v} selected={data.timeline === v} onClick={() => set("timeline", v)}>
                    {v}
                  </ChoiceBtn>
                ))}
              </div>
            </div>
          </div>
        );

      /* ── STEP 4: CHALLENGES ── */
      case 4:
        return (
          <div>
            <StepLabel>Step 4 of 10</StepLabel>
            <StepTitle>Challenges & pain points</StepTitle>
            <StepSubtitle>Honesty helps us fix the real problems.</StepSubtitle>

            <div className="space-y-6">
              <div>
                <FieldLabel>What&apos;s NOT working? (select all that apply)</FieldLabel>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    "Not enough leads",
                    "Low website traffic",
                    "Poor social engagement",
                    "Wasting money on ads",
                    "No online presence",
                    "Bad reviews hurting us",
                    "Can't keep up with content",
                    "Competitors outranking us",
                    "No time for marketing",
                    "Don't know what works",
                  ].map((c) => (
                    <SelectCard
                      key={c}
                      selected={data.challenges.includes(c)}
                      onClick={() => set("challenges", toggle(data.challenges, c))}
                    >
                      <AlertCircle
                        size={13}
                        className={`mb-1.5 ${data.challenges.includes(c) ? "text-gold" : "text-muted"}`}
                      />
                      <span className="text-sm text-foreground font-medium leading-snug block pr-5">{c}</span>
                    </SelectCard>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>Biggest single frustration (in your own words)</FieldLabel>
                <textarea
                  rows={3}
                  value={data.biggest_frustration}
                  onChange={(e) => set("biggest_frustration", e.target.value)}
                  placeholder='e.g. "We get clicks on our ads but nobody actually calls us..."'
                  className="input w-full resize-none"
                />
              </div>

              <div>
                <FieldLabel>What have you tried before?</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Facebook/IG Ads",
                    "Google Ads",
                    "SEO",
                    "Social media posting",
                    "Email marketing",
                    "Cold calling",
                    "Direct mail",
                    "Influencer marketing",
                    "PR / Media",
                    "Nothing yet",
                  ].map((v) => (
                    <ChoiceBtn
                      key={v}
                      selected={data.tried_before.includes(v)}
                      onClick={() => set("tried_before", toggle(data.tried_before, v))}
                    >
                      {v}
                    </ChoiceBtn>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      /* ── STEP 5: TARGET AUDIENCE ── */
      case 5:
        return (
          <div>
            <StepLabel>Step 5 of 10</StepLabel>
            <StepTitle>Your target audience</StepTitle>
            <StepSubtitle>Who are you trying to reach?</StepSubtitle>

            <div className="space-y-6">
              <div>
                <FieldLabel>Customer type</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {["B2C – Consumers", "B2B – Businesses", "Both"].map((v) => (
                    <ChoiceBtn key={v} selected={data.customer_type === v} onClick={() => set("customer_type", v)}>
                      {v}
                    </ChoiceBtn>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>Age range (select all that apply)</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {["18-24", "25-34", "35-44", "45-54", "55-64", "65+"].map((v) => (
                    <ChoiceBtn
                      key={v}
                      selected={data.age_ranges.includes(v)}
                      onClick={() => set("age_ranges", toggle(data.age_ranges, v))}
                    >
                      {v}
                    </ChoiceBtn>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>Gender focus</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {["Everyone", "Mostly Women", "Mostly Men"].map((v) => (
                    <ChoiceBtn key={v} selected={data.gender_focus === v} onClick={() => set("gender_focus", v)}>
                      {v}
                    </ChoiceBtn>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>Income level</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {["Budget-conscious", "Middle market", "Affluent", "Luxury"].map((v) => (
                    <ChoiceBtn key={v} selected={data.income_level === v} onClick={() => set("income_level", v)}>
                      {v}
                    </ChoiceBtn>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>Where do they find you?</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Google Search",
                    "Social Media",
                    "Word of Mouth",
                    "Driving By",
                    "Online Ads",
                    "Review Sites",
                    "Referrals",
                    "Events",
                  ].map((v) => (
                    <ChoiceBtn
                      key={v}
                      selected={data.discovery_channels.includes(v)}
                      onClick={() => set("discovery_channels", toggle(data.discovery_channels, v))}
                    >
                      {v}
                    </ChoiceBtn>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      /* ── STEP 6: BRAND & CONTENT ── */
      case 6:
        return (
          <div>
            <StepLabel>Step 6 of 10</StepLabel>
            <StepTitle>Brand & content preferences</StepTitle>
            <StepSubtitle>Shape how your brand looks and sounds online.</StepSubtitle>

            <div className="space-y-6">
              <div>
                <FieldLabel>
                  Brand personality — pick 3{" "}
                  <span className={data.brand_personality.length === 3 ? "text-gold" : "text-muted"}>
                    ({data.brand_personality.length}/3)
                  </span>
                </FieldLabel>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    "Professional",
                    "Friendly",
                    "Bold",
                    "Luxurious",
                    "Playful",
                    "Minimalist",
                    "Edgy",
                    "Warm",
                    "Authoritative",
                    "Creative",
                  ].map((p) => {
                    const sel = data.brand_personality.includes(p);
                    const maxed = data.brand_personality.length >= 3;
                    return (
                      <SelectCard
                        key={p}
                        selected={sel}
                        onClick={() => {
                          if (!sel && maxed) return;
                          set("brand_personality", toggle(data.brand_personality, p));
                        }}
                        className={`text-center py-4 ${!sel && maxed ? "opacity-40 cursor-not-allowed" : ""}`}
                      >
                        <Palette
                          size={16}
                          className={`mx-auto mb-2 ${sel ? "text-gold" : "text-muted"}`}
                        />
                        <span className="text-sm font-medium text-foreground">{p}</span>
                      </SelectCard>
                    );
                  })}
                </div>
              </div>

              <div>
                <FieldLabel>Content types you want</FieldLabel>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CONTENT_TYPES.map(({ id, label, icon: Icon }) => (
                    <SelectCard
                      key={id}
                      selected={data.content_types.includes(id)}
                      onClick={() => set("content_types", toggle(data.content_types, id))}
                      className="flex flex-col items-center gap-2 py-4"
                    >
                      <Icon size={18} className={data.content_types.includes(id) ? "text-gold" : "text-muted"} />
                      <span className="text-xs font-medium text-foreground text-center">{label}</span>
                    </SelectCard>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>Posting frequency</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Light – 3×/week",
                    "Standard – 5×/week",
                    "Heavy – daily",
                    "Aggressive – 2×/day",
                  ].map((v) => (
                    <ChoiceBtn key={v} selected={data.posting_frequency === v} onClick={() => set("posting_frequency", v)}>
                      {v}
                    </ChoiceBtn>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>Topics to cover</FieldLabel>
                <div className="flex flex-wrap gap-2 mb-3">
                  {data.content_topics.map((t) => (
                    <span
                      key={t}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gold/10 border border-gold/20 text-xs text-foreground font-medium"
                    >
                      {t}
                      <button
                        onClick={() => set("content_topics", data.content_topics.filter((x) => x !== t))}
                        className="text-muted hover:text-foreground"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={topicInput}
                    onChange={(e) => setTopicInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && topicInput.trim()) {
                        set("content_topics", [...data.content_topics, topicInput.trim()]);
                        setTopicInput("");
                      }
                    }}
                    placeholder="Type a topic and press Enter"
                    className="input flex-1"
                  />
                  <button
                    onClick={() => {
                      if (topicInput.trim()) {
                        set("content_topics", [...data.content_topics, topicInput.trim()]);
                        setTopicInput("");
                      }
                    }}
                    className="btn-secondary px-3"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {TOPIC_SUGGESTIONS.filter((t) => !data.content_topics.includes(t)).map((t) => (
                    <button
                      key={t}
                      onClick={() => set("content_topics", [...data.content_topics, t])}
                      className="text-[11px] text-muted border border-dashed border-border px-2.5 py-1 rounded-full hover:border-gold/40 hover:text-foreground transition-colors"
                    >
                      + {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      /* ── STEP 7: ONLINE PRESENCE ── */
      case 7:
        return (
          <div>
            <StepLabel>Step 7 of 10</StepLabel>
            <StepTitle>Online presence audit</StepTitle>
            <StepSubtitle>Tell us where you currently exist online.</StepSubtitle>

            <div className="space-y-6">
              <div>
                <FieldLabel>Website URL</FieldLabel>
                <input
                  type="url"
                  value={data.website_url}
                  onChange={(e) => set("website_url", e.target.value)}
                  placeholder="https://yourbusiness.com"
                  className="input w-full"
                />
              </div>

              <div>
                <FieldLabel>Google Business Profile</FieldLabel>
                <div className="flex items-center gap-4 mb-3">
                  <button
                    onClick={() => set("has_google_business", true)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                      data.has_google_business
                        ? "border-gold bg-gold/[0.08] text-foreground"
                        : "border-border bg-surface-light text-muted hover:border-gold/40"
                    }`}
                  >
                    <Check size={14} className={data.has_google_business ? "text-gold" : "text-muted"} />
                    Yes, I have one
                  </button>
                  <button
                    onClick={() => set("has_google_business", false)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                      !data.has_google_business
                        ? "border-gold bg-gold/[0.08] text-foreground"
                        : "border-border bg-surface-light text-muted hover:border-gold/40"
                    }`}
                  >
                    <X size={14} className={!data.has_google_business ? "text-gold" : "text-muted"} />
                    Not yet
                  </button>
                </div>
                {data.has_google_business && (
                  <input
                    type="text"
                    value={data.google_business_name}
                    onChange={(e) => set("google_business_name", e.target.value)}
                    placeholder="Business name as it appears on Google"
                    className="input w-full"
                  />
                )}
              </div>

              <div>
                <FieldLabel>Social media accounts</FieldLabel>
                <div className="space-y-2">
                  {SOCIAL_PLATFORMS.map(({ id, label, icon: Icon }) => (
                    <div key={id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-light border border-border">
                      <Icon size={16} className="text-muted shrink-0" />
                      <span className="text-sm font-medium text-foreground w-28 shrink-0">{label}</span>
                      <div className="flex gap-1.5 flex-wrap">
                        {SOCIAL_STATUS_OPTIONS.map(({ value, label: optLabel }) => (
                          <button
                            key={value}
                            onClick={() =>
                              set("social_accounts", { ...data.social_accounts, [id]: value })
                            }
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                              data.social_accounts[id] === value
                                ? "border-gold bg-gold/[0.08] text-foreground"
                                : "border-border text-muted hover:border-gold/30"
                            }`}
                          >
                            {optLabel}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>Review platforms you&apos;re on</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {["Google Reviews", "Yelp", "Facebook Reviews", "Trustpilot", "BBB", "Industry-specific"].map((v) => (
                    <ChoiceBtn
                      key={v}
                      selected={data.review_platforms.includes(v)}
                      onClick={() => set("review_platforms", toggle(data.review_platforms, v))}
                    >
                      {v}
                    </ChoiceBtn>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Current Google rating (optional)</FieldLabel>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    step={0.1}
                    value={data.google_rating ?? ""}
                    onChange={(e) =>
                      set("google_rating", e.target.value ? parseFloat(e.target.value) : null)
                    }
                    placeholder="e.g. 4.7"
                    className="input w-full"
                  />
                </div>
                <div>
                  <FieldLabel>Total review count (optional)</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    value={data.review_count ?? ""}
                    onChange={(e) =>
                      set("review_count", e.target.value ? parseInt(e.target.value) : null)
                    }
                    placeholder="e.g. 128"
                    className="input w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      /* ── STEP 8: CONNECT ACCOUNTS ── */
      case 8:
        return (
          <div>
            <StepLabel>Step 8 of 10</StepLabel>
            <StepTitle>Connect your accounts</StepTitle>
            <StepSubtitle>
              Link your platforms so we can manage everything for you.
            </StepSubtitle>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {INTEGRATIONS.map(({ id, label, icon: Icon, color, desc }) => {
                const connected = data.connected_accounts.includes(id);
                return (
                  <div
                    key={id}
                    className={`card flex items-center gap-4 transition-all ${
                      connected ? "border-gold/40 bg-gold/[0.02]" : ""
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${color}18`, border: `1px solid ${color}30` }}
                    >
                      <Icon size={18} style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{label}</p>
                      <p className="text-[11px] text-muted">{desc}</p>
                    </div>
                    {connected ? (
                      <span className="flex items-center gap-1.5 text-[11px] text-success font-medium shrink-0">
                        <Check size={13} />
                        Connected
                      </span>
                    ) : (
                      <a
                        href="/integrations"
                        className="flex items-center gap-1 text-[11px] font-medium text-gold hover:text-gold/80 shrink-0 transition-colors"
                        onClick={(e) => {
                          e.preventDefault();
                          set("connected_accounts", [...data.connected_accounts, id]);
                        }}
                      >
                        Connect
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="p-4 rounded-xl bg-surface border border-border/50">
              <p className="text-xs text-muted">
                <span className="text-foreground font-medium">Note:</span>{" "}
                Your agency team can help you connect these later. You can always come back to this step.
              </p>
            </div>
          </div>
        );

      /* ── STEP 9: COMPETITOR ANALYSIS ── */
      case 9:
        return (
          <div>
            <StepLabel>Step 9 of 10</StepLabel>
            <StepTitle>Know your competition</StepTitle>
            <StepSubtitle>We&apos;ll use this to build a competitive edge strategy.</StepSubtitle>

            <div className="space-y-6">
              <div>
                <FieldLabel>Top competitors</FieldLabel>
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted w-5 text-center">#{i + 1}</span>
                      <input
                        type="text"
                        value={data.competitors[i] ?? ""}
                        onChange={(e) => {
                          const next = [...data.competitors];
                          next[i] = e.target.value;
                          set("competitors", next);
                        }}
                        placeholder={`Competitor ${i + 1} name`}
                        className="input flex-1"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>Their websites (optional)</FieldLabel>
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <input
                      key={i}
                      type="url"
                      value={data.competitor_urls[i] ?? ""}
                      onChange={(e) => {
                        const next = [...data.competitor_urls];
                        next[i] = e.target.value;
                        set("competitor_urls", next);
                      }}
                      placeholder={`https://competitor${i + 1}.com`}
                      className="input w-full"
                    />
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>What do they do better than you?</FieldLabel>
                <textarea
                  rows={3}
                  value={data.competitor_strengths}
                  onChange={(e) => set("competitor_strengths", e.target.value)}
                  placeholder='e.g. "They rank higher on Google and have 500+ reviews..."'
                  className="input w-full resize-none"
                />
              </div>

              <div>
                <FieldLabel>What do YOU do better? (your USP)</FieldLabel>
                <textarea
                  rows={3}
                  value={data.our_usp}
                  onChange={(e) => set("our_usp", e.target.value)}
                  placeholder='e.g. "We offer same-day service and have 15 years of experience..."'
                  className="input w-full resize-none"
                />
              </div>
            </div>
          </div>
        );

      /* ── STEP 10: AI AUTO-PILOT ── */
      case 10:
        return (
          <div className="text-center">
            <div className="relative inline-flex mb-6">
              <div className="w-20 h-20 rounded-3xl bg-gold/10 border border-gold/20 flex items-center justify-center">
                <Zap size={36} className="text-gold" />
              </div>
              <div className="absolute -inset-4 rounded-[2.5rem] bg-gold/[0.03] -z-10 animate-pulse" />
            </div>

            <StepLabel>Step 10 of 10</StepLabel>
            <StepTitle>Ready to let AI take the wheel?</StepTitle>
            <p className="text-sm text-muted mb-8 max-w-lg mx-auto">
              Based on everything you&apos;ve told us, our AI can{" "}
              <span className="text-foreground font-medium">immediately</span> start:
            </p>

            <div className="max-w-sm mx-auto space-y-3 mb-8 text-left">
              {AI_CHECKLIST.map((item, i) => (
                <div
                  key={item}
                  className={`flex items-center gap-3 transition-all duration-500 ${
                    i <= aiChecklistIndex ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                      i <= aiChecklistIndex ? "bg-gold border-gold" : "bg-transparent border-border"
                    } border`}
                  >
                    {i <= aiChecklistIndex && <Check size={11} className="text-white" />}
                  </div>
                  <span className="text-sm text-foreground font-medium">{item}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-3 mb-6">
              <button
                onClick={() => {
                  set("ai_autopilot_enabled", true);
                  onComplete({ ...data, ai_autopilot_enabled: true });
                }}
                className="btn-primary flex items-center gap-2 text-base px-8 py-3"
              >
                <Zap size={18} />
                Yes, Launch AI Auto-Pilot!
              </button>
              <button
                onClick={() => {
                  set("ai_autopilot_enabled", false);
                  onComplete({ ...data, ai_autopilot_enabled: false });
                }}
                className="btn-secondary text-sm px-5 py-3"
              >
                No thanks, I&apos;ll do it manually
              </button>
            </div>

            <div className="inline-flex items-center gap-3 px-5 py-3 rounded-xl bg-surface border border-border">
              <span className="text-xs text-foreground font-medium">Keep AI Auto-Pilot running daily</span>
              <button
                onClick={() => set("ai_autopilot_daily", !data.ai_autopilot_daily)}
                className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${
                  data.ai_autopilot_daily ? "bg-gold" : "bg-border"
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                    data.ai_autopilot_daily ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  }

  const showSkip = step === 8 || step === 9;
  const isLastStep = step === 10;

  return (
    <div className="min-h-screen bg-background flex items-start justify-center py-10 px-4">
      <div className="w-full max-w-3xl">
        {/* ── Progress bar ── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted font-medium">
              Step {step} of {TOTAL_STEPS}
            </span>
            <span className="text-xs font-bold text-gold">{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 bg-surface-light rounded-full overflow-hidden border border-border/30">
            <div
              className="h-full bg-gold rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Step dots */}
          <div className="flex items-center justify-center gap-1.5 mt-4">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <button
                key={i}
                onClick={() => i + 1 < step && goTo(i + 1)}
                className={`rounded-full transition-all duration-300 ${
                  i + 1 === step
                    ? "w-6 h-2 bg-gold"
                    : i + 1 < step
                    ? "w-2 h-2 bg-gold/50 hover:bg-gold/70 cursor-pointer"
                    : "w-2 h-2 bg-border cursor-default"
                }`}
              />
            ))}
          </div>
        </div>

        {/* ── Step content ── */}
        <div
          className={`card p-8 transition-all duration-180 ${
            animating
              ? direction === "forward"
                ? "opacity-0 translate-y-2"
                : "opacity-0 -translate-y-2"
              : "opacity-100 translate-y-0"
          }`}
          style={{ minHeight: "520px" }}
        >
          {renderStep()}
        </div>

        {/* ── Navigation ── */}
        {!isLastStep && (
          <div className="flex items-center justify-between mt-5">
            <div>
              {step > 1 && (
                <button onClick={back} className="btn-secondary flex items-center gap-2 text-sm">
                  <ArrowLeft size={15} />
                  Back
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {showSkip && (
                <button onClick={next} className="text-sm text-muted hover:text-foreground transition-colors font-medium">
                  Skip for now
                  <ChevronRight size={14} className="inline ml-0.5" />
                </button>
              )}
              {step > 1 && (
                <button
                  onClick={next}
                  disabled={!canProceed()}
                  className={`btn-primary flex items-center gap-2 text-sm ${
                    !canProceed() ? "opacity-40 cursor-not-allowed" : ""
                  }`}
                >
                  Continue
                  <ArrowRight size={15} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
