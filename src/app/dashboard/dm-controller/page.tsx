"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  Send, Play, Pause, Settings, CheckCircle, Zap, Copy, Clock,
  AlertTriangle, BarChart3, GitBranch, Ban, Target,
  TrendingUp, Plus, Trash2, ArrowRight, ShieldAlert, Sparkles,
  Inbox, MessageSquare, Activity, Users, Eye, Edit3, MoreVertical,
  Flame, Shield, Timer, RefreshCw, ThumbsUp, ThumbsDown, MinusCircle,
  PauseCircle, Wand2, CircleDot, UserCheck, Calendar,
  Loader2, X, ChevronRight, FileText, Lightbulb, Star, Flag,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import PageHero from "@/components/ui/page-hero";
import {
  InstagramIcon, FacebookIcon, LinkedInIcon, TikTokIcon,
} from "@/components/ui/platform-icons";
import CreationWizard, { WizardStep } from "@/components/creation-wizard";

/* ------------------------------------------------------------------ */
/*  Platforms & Constants                                              */
/* ------------------------------------------------------------------ */

type PlatformId = "instagram" | "facebook" | "linkedin" | "tiktok";

const PLATFORMS: { id: PlatformId; name: string; icon: (s: number) => React.ReactNode; accent: string }[] = [
  { id: "instagram", name: "Instagram", icon: (s) => <InstagramIcon size={s} />, accent: "#E1306C" },
  { id: "facebook",  name: "Facebook",  icon: (s) => <FacebookIcon size={s} />,  accent: "#1877F2" },
  { id: "linkedin",  name: "LinkedIn",  icon: (s) => <LinkedInIcon size={s} />,  accent: "#0A66C2" },
  { id: "tiktok",    name: "TikTok",    icon: (s) => <TikTokIcon size={s} />,    accent: "#25F4EE" },
];

const platformName = (id: string) => PLATFORMS.find(p => p.id === id)?.name ?? id;
const platformIcon = (id: string, size = 14) => {
  const p = PLATFORMS.find(x => x.id === id);
  return p ? p.icon(size) : null;
};

const NICHES = [
  "Dentist", "Lawyer", "Gym", "Plumber", "Electrician", "Roofer",
  "Chiropractor", "Real Estate", "Restaurant", "Salon", "HVAC",
  "Accountant", "Photographer", "Auto Repair", "Med Spa",
];

const SERVICES = [
  "Social Media Management", "Paid Ads", "SEO", "Web Design",
  "Content Creation", "Branding", "Email Marketing", "AI Receptionist",
];

const TEMPLATE_GOALS = [
  { id: "cold_intro",    label: "Cold Intro",     icon: Send,      color: "text-blue-400"   },
  { id: "followup",      label: "Follow-Up",      icon: RefreshCw, color: "text-amber-400"  },
  { id: "promo",         label: "Promo",          icon: Flame,     color: "text-orange-400" },
  { id: "event",         label: "Event Invite",   icon: Calendar,  color: "text-purple-400" },
  { id: "reengage",      label: "Re-engagement",  icon: Sparkles,  color: "text-pink-400"   },
] as const;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type CampaignStatus = "running" | "paused" | "draft" | "done";
interface Campaign {
  id: string;
  name: string;
  platform: PlatformId;
  status: CampaignStatus;
  leads: number;
  sent: number;
  replied: number;
  booked: number;
  lastActivity: string;
  template: string;
}

interface DMTemplate {
  id: string;
  name: string;
  goal: typeof TEMPLATE_GOALS[number]["id"];
  subject: string;
  opener: string;
  value: string;
  cta: string;
  social_proof: string;
  custom?: boolean;
}

interface InboxReply {
  id: string;
  platform: PlatformId;
  from: string;
  preview: string;
  full: string;
  timestamp: string;
  sentiment: "positive" | "neutral" | "negative" | "question";
  campaignId: string;
  status: "new" | "closed" | "handed_off" | "needs_human";
  original: string;
}

interface AutomationRule {
  id: string;
  type: "auto_reply" | "auto_followup" | "auto_tag" | "auto_handoff";
  label: string;
  config: string;
  enabled: boolean;
}

interface LiveEvent {
  id: string;
  at: string;
  platform: PlatformId;
  kind: "open" | "typing" | "sent" | "reply" | "skip";
  handle: string;
  note?: string;
}

interface AIReply { tone: string; text: string; cta: string }

/* ------------------------------------------------------------------ */
/*  Demo Data (empty so the page looks clean + shows empty states)     */
/* ------------------------------------------------------------------ */

const INITIAL_CAMPAIGNS: Campaign[] = [
  { id: "c1", name: "Dentists NYC · Social Mgmt", platform: "instagram", status: "running", leads: 320, sent: 148, replied: 19, booked: 4, lastActivity: "2m ago", template: "cold_intro" },
  { id: "c2", name: "HVAC Operators · Paid Ads",  platform: "facebook",  status: "paused",  leads: 210, sent: 80,  replied: 7,  booked: 1, lastActivity: "1h ago", template: "cold_intro" },
  { id: "c3", name: "Founders Club LinkedIn",     platform: "linkedin",  status: "running", leads: 96,  sent: 62,  replied: 14, booked: 3, lastActivity: "5m ago", template: "cold_intro" },
  { id: "c4", name: "Gyms TikTok DMs",            platform: "tiktok",    status: "draft",   leads: 0,   sent: 0,   replied: 0,  booked: 0, lastActivity: "-",      template: "promo"     },
];

const INITIAL_TEMPLATES: DMTemplate[] = [
  {
    id: "t1", name: "Warm Cold Intro",                 goal: "cold_intro",
    subject: "quick idea for {business_name}",
    opener:  "Hey {name}, noticed {business_name} is killing it in {city}.",
    value:   "I help {industry} operators book 10-20 qualified calls a month without cold calling.",
    cta:     "Worth a 10 min chat Thursday?",
    social_proof: "Just helped a {industry} in Austin add $28k MRR last quarter.",
  },
  {
    id: "t2", name: "Soft Follow-Up",                  goal: "followup",
    subject: "circling back · {business_name}",
    opener:  "Hey {name}, bumping my last note in case it got buried.",
    value:   "Still happy to share the framework we used with 3 other {industry} clients.",
    cta:     "Should I send the breakdown or is this a bad time?",
    social_proof: "No pressure — just figured I'd shoot it over.",
  },
  {
    id: "t3", name: "Limited Promo",                   goal: "promo",
    subject: "{industry} deal this week",
    opener:  "Hey {name}, running a {service} audit for 5 {industry} owners this week — free.",
    value:   "45 min · custom growth plan · no pitch. Just walk you through what I'd do.",
    cta:     "Want one of the spots?",
    social_proof: "Last round booked out in 3 hours.",
  },
  {
    id: "t4", name: "Event / Webinar Invite",          goal: "event",
    subject: "invite · {event_name}",
    opener:  "Hey {name}, putting on a small workshop for {industry} owners Thursday.",
    value:   "20 min live, 20 min Q&A, walkthrough of my exact {service} playbook.",
    cta:     "Want me to save you a seat?",
    social_proof: "Last one had 140+ {industry} owners on it.",
  },
  {
    id: "t5", name: "Re-engagement",                   goal: "reengage",
    subject: "still room for {business_name}",
    opener:  "Hey {name}, it's been a minute.",
    value:   "We opened 2 new onboarding slots for {industry} this month and your name popped up.",
    cta:     "Still on the table if you're curious — want the details?",
    social_proof: "",
  },
];

const INITIAL_INBOX: InboxReply[] = [
  { id: "i1", platform: "instagram", from: "@brightsmile_dental",   preview: "Sure, what kind of results?",            full: "Sure, what kind of results? We've tried a few agencies and nothing stuck.", timestamp: "3m ago", sentiment: "question",  campaignId: "c1", status: "new", original: "quick idea for Bright Smile Dental..." },
  { id: "i2", platform: "linkedin",  from: "Daniel R. · Roofing Co", preview: "Interesting. Send me the breakdown.",   full: "Interesting. Send me the breakdown when you get a chance. Ideally with a case study.", timestamp: "14m ago", sentiment: "positive",  campaignId: "c3", status: "new", original: "quick idea for Roofing Co..." },
  { id: "i3", platform: "facebook",  from: "Lisa @ Miami HVAC",      preview: "Not interested, thanks.",                full: "Not interested, thanks. We already have an agency.", timestamp: "1h ago", sentiment: "negative",  campaignId: "c2", status: "closed", original: "quick idea for Miami HVAC..." },
  { id: "i4", platform: "instagram", from: "@iron_gym_chi",          preview: "What does this cost?",                   full: "What does this cost? I want to understand the pricing before a call.", timestamp: "2h ago", sentiment: "question",  campaignId: "c1", status: "needs_human", original: "quick idea for Iron Gym..." },
  { id: "i5", platform: "linkedin",  from: "Sarah P. · Legal",       preview: "Love the angle. Send Thursday times.",   full: "Love the angle. Send Thursday times — afternoon works best.", timestamp: "5h ago", sentiment: "positive",  campaignId: "c3", status: "handed_off", original: "quick idea for Legal..." },
];

const INITIAL_RULES: AutomationRule[] = [
  { id: "r1", type: "auto_reply",    label: "Auto-reply 'price' → pricing doc",        config: "Triggers on: price, cost, pricing, rate",                   enabled: true  },
  { id: "r2", type: "auto_followup", label: "Follow up after 4 days of no reply",      config: "4 days · uses Soft Follow-Up template",                     enabled: true  },
  { id: "r3", type: "auto_tag",      label: "Tag positive replies as 'hot'",           config: "Sentiment ≥ positive → tag hot · move to CRM",              enabled: true  },
  { id: "r4", type: "auto_handoff",  label: "Hand off to human on qualify signal",     config: "Keywords: call, meeting, book, when, Calendly, Zoom",       enabled: false },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function cn(...a: (string | false | null | undefined)[]) { return a.filter(Boolean).join(" "); }

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/* Safety-score math (deterministic, on the client — same rules as AI route fallback) */
function calcSafetyScore(opts: { dmsPerPlatform: number; delaySec: number; platformCount: number; messageLength: number; warmup: boolean }) {
  const total = opts.dmsPerPlatform * opts.platformCount;
  // Delay score (higher delay = safer)
  const delayScore = Math.min(100, (opts.delaySec / 90) * 100);
  // Volume score (lower daily volume = safer)
  const volumeScore = total <= 30 ? 100 : total <= 60 ? 80 : total <= 100 ? 60 : total <= 150 ? 35 : 15;
  // Message quality (sweet spot 140-320 chars)
  const msg = opts.messageLength;
  const msgScore =
    msg === 0 ? 30 :
    msg < 60 ? 40 :
    msg <= 320 ? 95 :
    msg <= 500 ? 70 : 45;
  const warmupBoost = opts.warmup ? 10 : 0;
  const raw = Math.round(delayScore * 0.3 + volumeScore * 0.4 + msgScore * 0.3 + warmupBoost);
  const score = Math.max(5, Math.min(100, raw));
  const rating: "green" | "amber" | "red" = score >= 75 ? "green" : score >= 50 ? "amber" : "red";
  return { score, rating, delayScore, volumeScore, msgScore };
}

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

type TabId =
  | "setup" | "campaigns" | "templates" | "inbox"
  | "analytics" | "automation" | "compliance" | "live";

export default function DMControllerPage() {
  /* ---- Persisted / Primary State ---- */
  const [activeTab, setActiveTab] = useState<TabId>("setup");
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [templateFilter, setTemplateFilter] = useState<string>("all");

  /* ---- Setup config (preserved keys) ---- */
  const [config, setConfig] = useState({
    platforms: ["instagram"] as PlatformId[],
    dmsPerPlatform: 20,
    niches: ["Dentist"] as string[],
    services: ["Social Media Management"] as string[],
    messageStyle: "friendly",
    delayBetween: 45,
    customMessage: "Hey {name}, I help {industry} owners in {city} book more qualified calls without cold calling. Worth a quick 10 min chat?",
    sendWindowStart: "09:00",
    sendWindowEnd:   "17:00",
    warmup: true,
    brandVoice: "warm, confident, low-pressure",
  });

  /* ---- Campaigns ---- */
  const [campaigns, setCampaigns] = useState<Campaign[]>(INITIAL_CAMPAIGNS);
  const [wizardOpen, setWizardOpen] = useState(false);

  /* ---- Templates ---- */
  const [templates, setTemplates] = useState<DMTemplate[]>(INITIAL_TEMPLATES);
  const [optimizing, setOptimizing] = useState<string | null>(null);
  const [optimizeResult, setOptimizeResult] = useState<{ id: string; result: { optimized_template?: string; predicted_reply_lift_pct?: number; safety_score?: number; improvements?: string[]; alternate_hooks?: string[] } } | null>(null);

  /* ---- Inbox / Conversation ---- */
  const [inbox, setInbox] = useState<InboxReply[]>(INITIAL_INBOX);
  const [openReplyId, setOpenReplyId] = useState<string | null>(null);
  const [aiReplies, setAiReplies] = useState<AIReply[] | null>(null);
  const [aiReplyLoading, setAiReplyLoading] = useState(false);
  const [aiReplyError, setAiReplyError] = useState<string | null>(null);

  /* ---- Automation rules ---- */
  const [rules, setRules] = useState<AutomationRule[]>(INITIAL_RULES);

  /* ---- Compliance / Blacklist ---- */
  const [blacklist, setBlacklist] = useState<{ name: string; platform: PlatformId; reason: string; date: string }[]>([]);
  const [blacklistInput, setBlacklistInput] = useState("");
  const [keywordBlacklist, setKeywordBlacklist] = useState<string[]>(["crypto", "forex signals"]);
  const [keywordInput, setKeywordInput] = useState("");

  /* ---- Live activity ---- */
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const liveRef = useRef<HTMLDivElement | null>(null);

  /* ---- Variable autocomplete for custom message ---- */
  const VARIABLES = ["{name}", "{business_name}", "{industry}", "{city}", "{service}", "{event_name}"];
  const [showVars, setShowVars] = useState(false);

  /* ---- Derived ---- */
  const totalDMs = config.platforms.length * config.dmsPerPlatform;
  const estimatedTime = Math.round((totalDMs * config.delayBetween) / 60);
  const safety = useMemo(() => calcSafetyScore({
    dmsPerPlatform: config.dmsPerPlatform,
    delaySec: config.delayBetween,
    platformCount: config.platforms.length,
    messageLength: config.customMessage.length,
    warmup: config.warmup,
  }), [config]);

  const totalSent   = campaigns.reduce((s, c) => s + c.sent, 0);
  const totalReplied = campaigns.reduce((s, c) => s + c.replied, 0);
  const totalBooked = campaigns.reduce((s, c) => s + c.booked, 0);
  const replyRate = totalSent ? ((totalReplied / totalSent) * 100).toFixed(1) : "0.0";
  const positiveReplies = inbox.filter(i => i.sentiment === "positive").length;
  const positiveReplyRate = totalReplied ? ((positiveReplies / totalReplied) * 100).toFixed(1) : "0.0";

  /* ---- Handlers ---- */
  const togglePlatform = (id: PlatformId) => {
    setConfig(prev => ({
      ...prev,
      platforms: prev.platforms.includes(id) ? prev.platforms.filter(p => p !== id) : [...prev.platforms, id],
    }));
  };
  const toggleNiche = (n: string) => {
    setConfig(prev => ({
      ...prev,
      niches: prev.niches.includes(n) ? prev.niches.filter(x => x !== n) : [...prev.niches, n],
    }));
  };
  const toggleService = (s: string) => {
    setConfig(prev => ({
      ...prev,
      services: prev.services.includes(s) ? prev.services.filter(x => x !== s) : [...prev.services, s],
    }));
  };
  const insertVariable = (v: string) => {
    setConfig(prev => ({ ...prev, customMessage: prev.customMessage + " " + v }));
    setShowVars(false);
  };

  function startDMRun() {
    if (config.platforms.length === 0 || config.niches.length === 0) return;
    setRunning(true);
    setCompleted(0);
    // Seed a few live events immediately
    setLiveEvents(prev => [
      { id: Math.random().toString(36).slice(2), at: formatTime(new Date()), platform: config.platforms[0], kind: "open" as const, handle: "campaign-start" },
      ...prev,
    ].slice(0, 200));
    const interval = setInterval(() => {
      setCompleted(prev => {
        if (prev >= totalDMs) { clearInterval(interval); setRunning(false); return prev; }
        return prev + 1;
      });
    }, 200);
  }

  /* Live-activity heartbeat when running */
  useEffect(() => {
    if (!running) return;
    const handles = ["@brightsmile_dental", "@iron_gym_chi", "@bluewaters_hvac", "@miami_legal", "@cubs_plumbing", "@salonco"];
    const kinds: LiveEvent["kind"][] = ["open", "typing", "sent", "reply", "skip"];
    const id = setInterval(() => {
      const p = config.platforms[Math.floor(Math.random() * Math.max(1, config.platforms.length))];
      const kind = kinds[Math.floor(Math.random() * kinds.length)];
      const handle = handles[Math.floor(Math.random() * handles.length)];
      setLiveEvents(prev => [
        { id: Math.random().toString(36).slice(2), at: formatTime(new Date()), platform: p, kind, handle },
        ...prev,
      ].slice(0, 200));
    }, 1500);
    return () => clearInterval(id);
  }, [running, config.platforms]);

  /* Auto-scroll live events to top */
  useEffect(() => { if (liveRef.current) liveRef.current.scrollTop = 0; }, [liveEvents]);

  /* ---- Campaign actions ---- */
  const toggleCampaign = (id: string) =>
    setCampaigns(cs => cs.map(c => c.id === id ? { ...c, status: c.status === "running" ? "paused" : "running" } : c));
  const deleteCampaign = (id: string) =>
    setCampaigns(cs => cs.filter(c => c.id !== id));

  /* ---- AI Reply Drafter ---- */
  async function generateAIReplies(reply: InboxReply) {
    setAiReplyLoading(true);
    setAiReplyError(null);
    setAiReplies(null);
    try {
      const res = await fetch("/api/dm-controller/ai-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inbound_message: reply.full,
          platform: reply.platform,
          prospect_handle: reply.from,
          business_name: reply.from,
          original_message: reply.original,
          brand_voice: config.brandVoice,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setAiReplies(data.replies || []);
    } catch (e) {
      setAiReplyError(e instanceof Error ? e.message : "Failed");
    } finally {
      setAiReplyLoading(false);
    }
  }

  /* ---- AI Template Optimizer ---- */
  async function optimizeTemplate(t: DMTemplate) {
    setOptimizing(t.id);
    setOptimizeResult(null);
    try {
      const template = [t.opener, t.value, t.cta, t.social_proof].filter(Boolean).join(" ");
      const res = await fetch("/api/dm-controller/ai-optimize-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template,
          niche: config.niches[0] || "general",
          service: config.services[0] || "",
          tone: config.messageStyle,
          brand_voice: config.brandVoice,
          platform: config.platforms[0] || "instagram",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setOptimizeResult({ id: t.id, result: data });
    } catch (e) {
      setOptimizeResult({ id: t.id, result: { improvements: [e instanceof Error ? e.message : "Failed"] } });
    } finally {
      setOptimizing(null);
    }
  }

  /* ---- Preview rendering ---- */
  const previewText = useMemo(() => {
    return (config.customMessage || "")
      .replaceAll("{name}", "Alex")
      .replaceAll("{business_name}", "Bright Smile Dental")
      .replaceAll("{industry}", config.niches[0] || "dentist")
      .replaceAll("{city}", "NYC")
      .replaceAll("{service}", config.services[0] || "Social Media")
      .replaceAll("{event_name}", "Growth Workshop");
  }, [config.customMessage, config.niches, config.services]);

  /* ---- Tabs ---- */
  const tabs: { id: TabId; label: string; icon: LucideIcon }[] = [
    { id: "setup",       label: "Setup",      icon: Settings     },
    { id: "campaigns",   label: `Campaigns (${campaigns.length})`, icon: Target },
    { id: "templates",   label: `Templates (${templates.length})`, icon: Copy   },
    { id: "inbox",       label: `Inbox (${inbox.filter(i => i.status === "new").length})`, icon: Inbox },
    { id: "analytics",   label: "Analytics",  icon: BarChart3    },
    { id: "automation",  label: "Automation", icon: Zap          },
    { id: "compliance",  label: "Compliance", icon: Shield       },
    { id: "live",        label: "Live",       icon: Activity     },
  ];

  /* ---- Wizard steps ---- */
  const wizardSteps: WizardStep[] = [
    {
      id: "name",
      title: "Name your campaign",
      description: "Give it a memorable name so you can find it later.",
      field: { type: "text", key: "name", placeholder: "e.g. Dentists NYC · Social Mgmt" },
    },
    {
      id: "platform",
      title: "Pick a platform",
      description: "One platform per campaign keeps analytics clean.",
      field: {
        type: "choice-cards",
        key: "platform",
        options: PLATFORMS.map(p => ({ value: p.id, label: p.name, description: "Cold DMs via extension" })),
      },
    },
    {
      id: "niche",
      title: "Target niche",
      field: {
        type: "dropdown",
        key: "niche",
        options: NICHES.map(n => ({ value: n, label: n })),
      },
    },
    {
      id: "service",
      title: "Service to pitch",
      field: {
        type: "dropdown",
        key: "service",
        options: SERVICES.map(s => ({ value: s, label: s })),
      },
    },
    {
      id: "volume",
      title: "Daily DM volume",
      description: "Start low and ramp up with warm-up mode.",
      field: { type: "slider", key: "volume", min: 5, max: 100, step: 5 },
    },
    {
      id: "template",
      title: "Starting template",
      field: {
        type: "dropdown",
        key: "template",
        options: templates.map(t => ({ value: t.id, label: t.name })),
      },
    },
  ];

  const createCampaign = async (data: Record<string, unknown>) => {
    const name = (data.name as string) || `Untitled · ${new Date().toLocaleDateString()}`;
    const platform = (data.platform as PlatformId) || "instagram";
    const volume = Number(data.volume ?? 20);
    const template = (data.template as string) || templates[0]?.id || "cold_intro";
    const newCamp: Campaign = {
      id: `c${Date.now()}`,
      name, platform,
      status: "draft",
      leads: volume * 10,
      sent: 0, replied: 0, booked: 0,
      lastActivity: "-",
      template,
    };
    setCampaigns(cs => [newCamp, ...cs]);
    setWizardOpen(false);
  };

  /* ---- Current reply (inbox thread view) ---- */
  const openReply = inbox.find(i => i.id === openReplyId);

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <div className="fade-in space-y-5">
      <PageHero
        icon={<Send size={28} />}
        title="DM Controller"
        subtitle="Multi-platform cold DM command center · AI-assisted · Compliance-safe."
        gradient="gold"
        eyebrow={<><CircleDot size={9} className={cn("inline mr-1.5", running ? "text-green-400 animate-pulse" : "text-muted")} />{running ? "Running" : "Idle"}</>}
        actions={
          <div className="flex items-center gap-2">
            <div className={cn(
              "flex items-center gap-1.5 text-[10px] border px-2.5 py-1 rounded-md",
              running ? "bg-green-400/10 border-green-400/30 text-green-400" :
                       "bg-white/10 border-white/20 text-white/70"
            )}>
              <span className={cn("w-1.5 h-1.5 rounded-full", running ? "bg-green-400 animate-pulse" : "bg-white/30")} />
              {running ? `Running · ${completed}/${totalDMs}` : "Paused"}
            </div>
            {running && (
              <button onClick={() => setRunning(false)} className="text-[10px] bg-red-500/20 border border-red-500/40 text-red-200 px-2.5 py-1 rounded-md hover:bg-red-500/30 transition-all flex items-center gap-1">
                <Pause size={10} /> Pause all
              </button>
            )}
          </div>
        }
      />

      {/* Stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
        <StatTile label="Total Sent"           value={totalSent.toLocaleString()}    icon={<Send size={12} />}           tone="gold"  />
        <StatTile label="Reply Rate"           value={`${replyRate}%`}               icon={<MessageSquare size={12} />}  tone="green" />
        <StatTile label="Positive Replies"     value={`${positiveReplyRate}%`}       icon={<ThumbsUp size={12} />}       tone="blue"  />
        <StatTile label="Booked Calls"         value={totalBooked.toLocaleString()}  icon={<UserCheck size={12} />}      tone="purple"/>
        <StatTile label="Active Campaigns"     value={campaigns.filter(c => c.status === "running").length} icon={<Target size={12} />} tone="pink" />
      </div>

      {/* Compliance stripe */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Pill tone="ok"    icon={<CheckCircle size={10} />}>No compliance flags · {config.platforms.length} platform{config.platforms.length === 1 ? "" : "s"} active</Pill>
        {config.warmup && <Pill tone="info" icon={<Flame size={10} />}>Warm-up mode ON · ramping 7 days</Pill>}
        <Pill tone={safety.rating === "green" ? "ok" : safety.rating === "amber" ? "warn" : "bad"} icon={<Shield size={10} />}>
          Safety score: {safety.score}/100
        </Pill>
        <Pill tone="info" icon={<Timer size={10} />}>
          Send window: {config.sendWindowStart}–{config.sendWindowEnd}
        </Pill>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all border",
              activeTab === t.id
                ? "bg-gold/10 border-gold/30 text-gold font-medium"
                : "border-border text-muted hover:text-foreground"
            )}
          >
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </div>

      {/* =============================================================
         TAB 1 · SETUP
         ============================================================= */}
      {activeTab === "setup" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {/* Platform Selector w/ real brand icons */}
            <div className="card p-4">
              <h2 className="text-xs font-semibold mb-2">Platforms</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {PLATFORMS.map(p => {
                  const active = config.platforms.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => togglePlatform(p.id)}
                      className={cn(
                        "flex items-center gap-2.5 p-3 rounded-xl border transition-all",
                        active ? "border-white/25 bg-white/[0.04]" : "border-border opacity-60 hover:opacity-90"
                      )}
                    >
                      {p.icon(22)}
                      <div className="text-left">
                        <p className="text-xs font-semibold">{p.name}</p>
                        <p className={cn("text-[9px]", active ? "text-green-400" : "text-muted")}>
                          {active ? "Active" : "Disabled"}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Settings */}
            <div className="card p-4">
              <h2 className="text-xs font-semibold mb-2 flex items-center gap-2"><Settings size={13} className="text-gold" /> Settings</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">DMs per platform</label>
                  <input type="number" min={1} max={100} value={config.dmsPerPlatform}
                    onChange={e => setConfig({ ...config, dmsPerPlatform: parseInt(e.target.value) || 20 })}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground" />
                </div>
                <div>
                  <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Delay between DMs (sec)</label>
                  <input type="number" min={15} max={120} value={config.delayBetween}
                    onChange={e => setConfig({ ...config, delayBetween: parseInt(e.target.value) || 45 })}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground" />
                </div>
              </div>
              <div className="mt-3">
                <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Message Style</label>
                <div className="flex flex-wrap gap-1.5">
                  {["friendly", "professional", "bold", "casual"].map(s => (
                    <button key={s} onClick={() => setConfig({ ...config, messageStyle: s })}
                      className={cn(
                        "text-[10px] px-3 py-1 rounded-lg border transition-all capitalize",
                        config.messageStyle === s ? "border-gold/30 bg-gold/[0.05] text-gold" : "border-border text-muted"
                      )}>{s}</button>
                  ))}
                </div>
              </div>
              <div className="mt-3">
                <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Send Window</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[8px] text-muted">Start</label>
                    <input type="time" value={config.sendWindowStart} onChange={e => setConfig({ ...config, sendWindowStart: e.target.value })} className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground" />
                  </div>
                  <div>
                    <label className="text-[8px] text-muted">End</label>
                    <input type="time" value={config.sendWindowEnd} onChange={e => setConfig({ ...config, sendWindowEnd: e.target.value })} className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground" />
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between p-3 rounded-lg border border-border">
                <div className="flex items-center gap-2">
                  <Flame size={14} className="text-orange-400" />
                  <div>
                    <p className="text-xs font-semibold">Warm-up mode</p>
                    <p className="text-[10px] text-muted">Ramps DM volume over 7 days to avoid spam filters.</p>
                  </div>
                </div>
                <button onClick={() => setConfig({ ...config, warmup: !config.warmup })}
                  className={cn(
                    "relative w-11 h-6 rounded-full transition-all",
                    config.warmup ? "bg-orange-400" : "bg-white/10"
                  )}>
                  <span className={cn(
                    "absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all",
                    config.warmup ? "left-5" : "left-0.5"
                  )} />
                </button>
              </div>
            </div>

            {/* Target Niches */}
            <div className="card p-4">
              <h2 className="text-xs font-semibold mb-2">Target Niches</h2>
              <div className="flex flex-wrap gap-1.5">
                {NICHES.map(n => (
                  <button key={n} onClick={() => toggleNiche(n)}
                    className={cn(
                      "text-[10px] px-2.5 py-1 rounded-lg border transition-all",
                      config.niches.includes(n) ? "border-gold/30 bg-gold/[0.05] text-gold" : "border-border text-muted"
                    )}>{n}</button>
                ))}
              </div>
            </div>

            {/* Services */}
            <div className="card p-4">
              <h2 className="text-xs font-semibold mb-2">Services to Pitch</h2>
              <div className="flex flex-wrap gap-1.5">
                {SERVICES.map(s => (
                  <button key={s} onClick={() => toggleService(s)}
                    className={cn(
                      "text-[10px] px-2.5 py-1 rounded-lg border transition-all",
                      config.services.includes(s) ? "border-gold/30 bg-gold/[0.05] text-gold" : "border-border text-muted"
                    )}>{s}</button>
                ))}
              </div>
            </div>

            {/* Custom Message + variable autocomplete */}
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-semibold">Custom Message</h2>
                <div className="relative">
                  <button onClick={() => setShowVars(v => !v)} className="text-[10px] px-2.5 py-1 rounded-lg border border-border text-muted hover:text-foreground flex items-center gap-1">
                    <Plus size={10} /> Variable
                  </button>
                  {showVars && (
                    <div className="absolute right-0 top-full mt-1 z-30 w-48 card p-1 shadow-xl">
                      {VARIABLES.map(v => (
                        <button key={v} onClick={() => insertVariable(v)} className="w-full text-left text-[10px] font-mono px-2 py-1.5 rounded hover:bg-white/5 text-foreground">
                          {v}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <textarea
                value={config.customMessage}
                onChange={e => setConfig({ ...config, customMessage: e.target.value })}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground h-24"
                placeholder="Use variables: {name}, {business_name}, {industry}, {city}, {service}"
              />
              <div className="mt-1.5 text-[9px] text-muted flex items-center justify-between">
                <span>{config.customMessage.length} chars</span>
                <span>{VARIABLES.filter(v => config.customMessage.includes(v)).length}/{VARIABLES.length} variables used</span>
              </div>
            </div>
          </div>

          {/* ---- Right-side panel: Preview, Safety, Launch ---- */}
          <div className="space-y-4">
            {/* DM Preview */}
            <div className="card p-4">
              <h3 className="text-xs font-semibold mb-2 flex items-center gap-2">
                <Eye size={12} className="text-gold" /> Live Preview
              </h3>
              <div className="rounded-xl border border-border bg-black/30 overflow-hidden">
                <div className="px-3 py-2 border-b border-border flex items-center gap-2 bg-white/[0.02]">
                  {platformIcon(config.platforms[0] || "instagram", 16)}
                  <span className="text-[10px] font-semibold">{platformName(config.platforms[0] || "instagram")}</span>
                  <span className="text-[9px] text-muted ml-auto">@{(config.niches[0] || "prospect").toLowerCase().replace(/\s+/g, "_")}_co</span>
                </div>
                <div className="p-3 space-y-2">
                  <div className="text-[9px] text-muted flex items-center gap-1"><Clock size={8} /> just now</div>
                  <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-bl-sm bg-white/[0.06] border border-white/10 text-[11px] leading-relaxed">
                    {previewText || <span className="text-muted italic">Your message will appear here…</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Safety meter */}
            <div className="card p-4">
              <h3 className="text-xs font-semibold mb-2 flex items-center gap-2">
                <Shield size={12} className={cn(
                  safety.rating === "green" ? "text-green-400" :
                  safety.rating === "amber" ? "text-amber-400" : "text-red-400"
                )} /> Safety Score
              </h3>
              <div className="flex items-end gap-3 mb-2">
                <span className={cn(
                  "text-3xl font-bold font-mono",
                  safety.rating === "green" ? "text-green-400" :
                  safety.rating === "amber" ? "text-amber-400" : "text-red-400"
                )}>{safety.score}</span>
                <span className="text-[10px] text-muted pb-1 uppercase tracking-wider">{safety.rating}</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-2 mb-3 overflow-hidden">
                <div className={cn(
                  "h-full rounded-full transition-all",
                  safety.rating === "green" ? "bg-green-400" :
                  safety.rating === "amber" ? "bg-amber-400" : "bg-red-400"
                )} style={{ width: `${safety.score}%` }} />
              </div>
              <div className="space-y-1 text-[9px]">
                <Meter label="Delay"   value={safety.delayScore} />
                <Meter label="Volume"  value={safety.volumeScore} />
                <Meter label="Quality" value={safety.msgScore} />
              </div>
            </div>

            {/* Launch */}
            <div className="card p-4 border-gold/10 relative overflow-hidden">
              <div className="text-center py-3">
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3",
                  running ? "bg-green-400/10 animate-pulse" : "bg-gold/10"
                )}>
                  {running
                    ? <Clock size={24} className="text-green-400 animate-spin" />
                    : <Send size={24} className="text-gold" />}
                </div>
                <h3 className="text-sm font-bold mb-1">
                  {running ? "Sending DMs…" : totalDMs === 0 ? "No targets" : "Ready to Launch"}
                </h3>
                <div className="space-y-0.5 text-[10px] text-muted mb-3">
                  <p>Platforms: {config.platforms.length}</p>
                  <p>Total DMs: {totalDMs}</p>
                  <p>Est. time: {totalDMs === 0 ? "—" : `~${estimatedTime} min`}</p>
                </div>
                {running && (
                  <div className="w-full bg-white/5 rounded-full h-2 mb-3 overflow-hidden">
                    <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${(completed / Math.max(totalDMs, 1)) * 100}%` }} />
                  </div>
                )}
                <button
                  onClick={running ? () => setRunning(false) : startDMRun}
                  disabled={!running && config.platforms.length === 0}
                  className={cn(
                    "w-full text-xs py-2.5 flex items-center justify-center gap-2 rounded-xl font-semibold transition-all",
                    running ? "bg-red-500 text-white hover:bg-red-400" : "bg-gold text-black disabled:opacity-50"
                  )}
                >
                  {running ? <><Pause size={14} /> Stop</> : <><Play size={14} /> Start DM Run</>}
                </button>
              </div>
            </div>

            {/* Requirements */}
            <div className="card p-4">
              <h3 className="text-xs font-semibold mb-2 flex items-center gap-2"><Zap size={12} className="text-yellow-400" /> Requirements</h3>
              <div className="space-y-1.5 text-[10px] text-muted">
                <p>1. Chrome open with extension</p>
                <p>2. Logged into social accounts</p>
                <p>3. Keep Chrome in foreground</p>
                <p>4. Do not touch the mouse</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =============================================================
         TAB 2 · CAMPAIGNS
         ============================================================= */}
      {activeTab === "campaigns" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Active Campaigns</h2>
              <p className="text-[10px] text-muted">Run multiple DM campaigns in parallel — each with its own template & volume.</p>
            </div>
            <button onClick={() => setWizardOpen(true)} className="px-3 py-1.5 rounded-lg bg-gold text-black text-[11px] font-semibold flex items-center gap-1.5 hover:scale-[1.02] transition-transform">
              <Plus size={12} /> New Campaign
            </button>
          </div>
          {campaigns.length === 0 ? (
            <div className="card p-10 text-center">
              <EmptyIllustration icon={<Target size={40} />} />
              <h3 className="text-sm font-semibold mt-3">No campaigns yet</h3>
              <p className="text-[11px] text-muted mt-1">Spin up your first campaign in under 60 seconds.</p>
              <button onClick={() => setWizardOpen(true)} className="mt-4 px-4 py-2 rounded-lg bg-gold text-black text-[11px] font-semibold inline-flex items-center gap-1.5">
                <Plus size={12} /> Create campaign
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {campaigns.map(c => {
                const platform = PLATFORMS.find(p => p.id === c.platform);
                const replyRate = c.sent ? ((c.replied / c.sent) * 100).toFixed(1) : "0.0";
                const progressPct = c.leads ? Math.round((c.sent / c.leads) * 100) : 0;
                return (
                  <div key={c.id} className="card p-4 hover:border-gold/20 transition-all">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-white/[0.04] border border-white/10">
                        {platform?.icon(22)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-semibold truncate">{c.name}</p>
                          <StatusBadge status={c.status} />
                        </div>
                        <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted flex-wrap">
                          <span className="flex items-center gap-1"><Users size={9} /> {c.leads} leads</span>
                          <span className="flex items-center gap-1"><Send size={9} /> {c.sent} sent</span>
                          <span className="flex items-center gap-1 text-green-400"><MessageSquare size={9} /> {c.replied} replies · {replyRate}%</span>
                          <span className="flex items-center gap-1 text-gold"><UserCheck size={9} /> {c.booked} booked</span>
                          <span className="flex items-center gap-1"><Clock size={9} /> {c.lastActivity}</span>
                        </div>
                        {/* Progress bar */}
                        <div className="mt-2 w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                          <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                        </div>
                      </div>
                      {/* Mini dashboard */}
                      <div className="hidden md:flex items-center gap-3 pr-1">
                        <MiniStat label="Sent"    value={c.sent}    />
                        <MiniStat label="Replies" value={c.replied} tone="green" />
                        <MiniStat label="Booked"  value={c.booked}  tone="gold"  />
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => toggleCampaign(c.id)} title={c.status === "running" ? "Pause" : "Play"}
                          className="p-2 rounded-lg border border-border hover:border-gold/30 transition-all">
                          {c.status === "running" ? <Pause size={12} /> : <Play size={12} />}
                        </button>
                        <button onClick={() => setActiveTab("analytics")} title="Analytics"
                          className="p-2 rounded-lg border border-border hover:border-gold/30 transition-all">
                          <BarChart3 size={12} />
                        </button>
                        <button onClick={() => setActiveTab("setup")} title="Edit"
                          className="p-2 rounded-lg border border-border hover:border-gold/30 transition-all">
                          <Edit3 size={12} />
                        </button>
                        <button onClick={() => deleteCampaign(c.id)} title="Delete"
                          className="p-2 rounded-lg border border-border hover:border-red-400/40 hover:text-red-400 transition-all">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =============================================================
         TAB 3 · TEMPLATES
         ============================================================= */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <button onClick={() => setTemplateFilter("all")}
              className={cn("text-[10px] px-2.5 py-1 rounded-lg border transition-all",
                templateFilter === "all" ? "border-gold/30 bg-gold/[0.05] text-gold" : "border-border text-muted"
              )}>All ({templates.length})</button>
            {TEMPLATE_GOALS.map(g => (
              <button key={g.id} onClick={() => setTemplateFilter(g.id)}
                className={cn("text-[10px] px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1",
                  templateFilter === g.id ? "border-gold/30 bg-gold/[0.05] text-gold" : "border-border text-muted"
                )}><g.icon size={9} className={g.color} /> {g.label}</button>
            ))}
            <div className="ml-auto">
              <button onClick={() => {
                const t: DMTemplate = {
                  id: `t${Date.now()}`,
                  name: "Custom Template",
                  goal: "cold_intro",
                  subject: "{business_name}",
                  opener: "Hey {name}, noticed you run {business_name}.",
                  value: "Quick idea that might be worth your time.",
                  cta: "Worth a 10 min chat this week?",
                  social_proof: "",
                  custom: true,
                };
                setTemplates(ts => [t, ...ts]);
              }} className="px-3 py-1.5 rounded-lg border border-gold/30 bg-gold/[0.05] text-gold text-[10px] font-semibold flex items-center gap-1.5">
                <Plus size={10} /> New Template
              </button>
            </div>
          </div>

          {templates.filter(t => templateFilter === "all" || t.goal === templateFilter).length === 0 ? (
            <div className="card p-10 text-center">
              <EmptyIllustration icon={<Copy size={40} />} />
              <h3 className="text-sm font-semibold mt-3">No templates in this category</h3>
              <p className="text-[11px] text-muted mt-1">Try another filter or create a new one.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {templates.filter(t => templateFilter === "all" || t.goal === templateFilter).map(t => {
                const goal = TEMPLATE_GOALS.find(g => g.id === t.goal);
                const isOptimizing = optimizing === t.id;
                const isOptimized = optimizeResult?.id === t.id;
                return (
                  <div key={t.id} className="card p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {goal && <goal.icon size={11} className={goal.color} />}
                          <p className="text-xs font-semibold truncate">{t.name}</p>
                          {t.custom && <span className="text-[8px] bg-gold/10 text-gold px-1.5 py-0.5 rounded">Custom</span>}
                        </div>
                        <p className="text-[9px] text-muted uppercase tracking-wider mt-0.5">{goal?.label}</p>
                      </div>
                      <button onClick={() => setTemplates(ts => ts.filter(x => x.id !== t.id))} className="text-muted hover:text-red-400 p-1">
                        <Trash2 size={11} />
                      </button>
                    </div>

                    <div className="space-y-1.5 pt-1 border-t border-border">
                      <TemplateField label="Subject"     value={t.subject}      onChange={v => setTemplates(ts => ts.map(x => x.id === t.id ? { ...x, subject: v } : x))}     />
                      <TemplateField label="Opener"      value={t.opener}       onChange={v => setTemplates(ts => ts.map(x => x.id === t.id ? { ...x, opener: v } : x))}      />
                      <TemplateField label="Value prop"  value={t.value}        onChange={v => setTemplates(ts => ts.map(x => x.id === t.id ? { ...x, value: v } : x))}       />
                      <TemplateField label="CTA"         value={t.cta}          onChange={v => setTemplates(ts => ts.map(x => x.id === t.id ? { ...x, cta: v } : x))}         />
                      <TemplateField label="Social proof" value={t.social_proof} onChange={v => setTemplates(ts => ts.map(x => x.id === t.id ? { ...x, social_proof: v } : x))} />
                    </div>

                    {isOptimized && optimizeResult?.result && (
                      <div className="p-2.5 rounded-lg border border-purple-400/30 bg-purple-400/[0.04] text-[10px] space-y-1.5">
                        <div className="flex items-center gap-1.5 text-purple-300 font-semibold"><Wand2 size={10} /> AI Optimized</div>
                        {optimizeResult.result.optimized_template && (
                          <p className="text-foreground leading-relaxed">&quot;{optimizeResult.result.optimized_template}&quot;</p>
                        )}
                        <div className="flex items-center gap-3">
                          {typeof optimizeResult.result.predicted_reply_lift_pct === "number" && (
                            <span className="text-green-400">+{optimizeResult.result.predicted_reply_lift_pct}% predicted lift</span>
                          )}
                          {typeof optimizeResult.result.safety_score === "number" && (
                            <span className="text-muted">Safety: {optimizeResult.result.safety_score}/100</span>
                          )}
                        </div>
                        {optimizeResult.result.improvements && optimizeResult.result.improvements.length > 0 && (
                          <ul className="space-y-0.5 text-muted">
                            {optimizeResult.result.improvements.slice(0, 3).map((it, i) => (
                              <li key={i} className="flex gap-1"><ChevronRight size={9} className="shrink-0 mt-0.5" /> {it}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        onClick={() => optimizeTemplate(t)}
                        disabled={isOptimizing}
                        className="flex-1 text-[10px] px-2 py-1.5 rounded-lg border border-purple-400/30 bg-purple-400/[0.04] text-purple-300 hover:bg-purple-400/10 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {isOptimizing ? <Loader2 size={10} className="animate-spin" /> : <Wand2 size={10} />}
                        {isOptimizing ? "Optimizing…" : "AI Rewrite in brand voice"}
                      </button>
                      <button
                        onClick={() => {
                          const msg = [t.opener, t.value, t.cta, t.social_proof].filter(Boolean).join(" ");
                          setConfig(prev => ({ ...prev, customMessage: msg }));
                          setActiveTab("setup");
                        }}
                        className="text-[10px] px-2 py-1.5 rounded-lg border border-gold/30 bg-gold/[0.05] text-gold hover:bg-gold/10 transition-all flex items-center gap-1.5"
                      >
                        <ArrowRight size={10} /> Clone to campaign
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =============================================================
         TAB 4 · INBOX
         ============================================================= */}
      {activeTab === "inbox" && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2 space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {inbox.length === 0 ? (
              <div className="card p-8 text-center">
                <EmptyIllustration icon={<Inbox size={36} />} />
                <p className="text-xs text-muted mt-2">No replies yet. Start a campaign to see inbound DMs.</p>
              </div>
            ) : inbox.map(r => (
              <button
                key={r.id}
                onClick={() => { setOpenReplyId(r.id); setAiReplies(null); setAiReplyError(null); }}
                className={cn(
                  "w-full text-left card p-3 transition-all",
                  openReplyId === r.id ? "border-gold/40 bg-gold/[0.04]" : "hover:border-white/20"
                )}
              >
                <div className="flex items-start gap-2">
                  <div className="shrink-0">{platformIcon(r.platform, 20)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-semibold truncate">{r.from}</p>
                      <SentimentBadge sentiment={r.sentiment} />
                      {r.status !== "new" && <StatusChip status={r.status} />}
                    </div>
                    <p className="text-[10px] text-muted line-clamp-2 mt-0.5">{r.preview}</p>
                    <p className="text-[9px] text-muted mt-1">{r.timestamp}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="lg:col-span-3">
            {openReply ? (
              <div className="card p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-border">
                  <div className="flex items-center gap-2 min-w-0">
                    {platformIcon(openReply.platform, 22)}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{openReply.from}</p>
                      <p className="text-[10px] text-muted">{platformName(openReply.platform)} · {openReply.timestamp}</p>
                    </div>
                  </div>
                  <SentimentBadge sentiment={openReply.sentiment} />
                </div>

                {/* Conversation thread */}
                <div className="space-y-2">
                  <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-bl-sm bg-white/[0.04] border border-white/10 text-[11px]">
                    <p className="text-[9px] text-muted mb-1">You</p>
                    {openReply.original}
                  </div>
                  <div className="max-w-[85%] ml-auto px-3 py-2 rounded-2xl rounded-br-sm bg-gold/10 border border-gold/30 text-[11px]">
                    <p className="text-[9px] text-gold mb-1">{openReply.from}</p>
                    {openReply.full}
                  </div>
                </div>

                {/* AI Replies */}
                <div className="pt-2 border-t border-border">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold flex items-center gap-1.5"><Sparkles size={11} className="text-purple-400" /> AI Reply Drafts</h4>
                    <button
                      onClick={() => generateAIReplies(openReply)}
                      disabled={aiReplyLoading}
                      className="text-[10px] px-2.5 py-1 rounded-lg border border-purple-400/30 bg-purple-400/[0.04] text-purple-300 hover:bg-purple-400/10 flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {aiReplyLoading ? <Loader2 size={10} className="animate-spin" /> : <Wand2 size={10} />}
                      {aiReplyLoading ? "Drafting…" : aiReplies ? "Regenerate" : "Suggest Reply"}
                    </button>
                  </div>
                  {aiReplyError && <p className="text-[10px] text-red-400">{aiReplyError}</p>}
                  {aiReplies && aiReplies.length > 0 ? (
                    <div className="space-y-2">
                      {aiReplies.map((r, i) => (
                        <div key={i} className="p-3 rounded-lg border border-border bg-black/20 space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] uppercase tracking-wider text-purple-300 font-semibold">{r.tone}</span>
                          </div>
                          <p className="text-[11px] leading-relaxed">{r.text}</p>
                          {r.cta && <p className="text-[9px] text-muted italic">CTA: {r.cta}</p>}
                          <div className="flex items-center gap-1.5 pt-1">
                            <button onClick={() => navigator.clipboard?.writeText(r.text)} className="text-[9px] px-2 py-0.5 rounded border border-border text-muted hover:text-foreground">Copy</button>
                            <button className="text-[9px] px-2 py-0.5 rounded border border-gold/30 bg-gold/[0.05] text-gold">Use this</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : !aiReplyLoading && !aiReplyError ? (
                    <p className="text-[10px] text-muted italic">Click &quot;Suggest Reply&quot; to get 3 AI-drafted responses.</p>
                  ) : null}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 pt-2 border-t border-border">
                  <button
                    onClick={() => setInbox(ibx => ibx.map(x => x.id === openReply.id ? { ...x, status: "closed" } : x))}
                    className="flex-1 text-[10px] px-2 py-1.5 rounded-lg border border-border hover:border-white/20 text-muted hover:text-foreground flex items-center justify-center gap-1.5">
                    <CheckCircle size={10} /> Close
                  </button>
                  <button
                    onClick={() => setInbox(ibx => ibx.map(x => x.id === openReply.id ? { ...x, status: "handed_off" } : x))}
                    className="flex-1 text-[10px] px-2 py-1.5 rounded-lg border border-border hover:border-blue-400/30 text-muted hover:text-blue-400 flex items-center justify-center gap-1.5">
                    <UserCheck size={10} /> Hand off
                  </button>
                  <button
                    onClick={() => setInbox(ibx => ibx.map(x => x.id === openReply.id ? { ...x, status: "needs_human" } : x))}
                    className="flex-1 text-[10px] px-2 py-1.5 rounded-lg border border-border hover:border-amber-400/30 text-muted hover:text-amber-400 flex items-center justify-center gap-1.5">
                    <Flag size={10} /> Needs human
                  </button>
                </div>
              </div>
            ) : (
              <div className="card p-10 text-center h-full flex items-center justify-center">
                <div>
                  <EmptyIllustration icon={<MessageSquare size={40} />} />
                  <h3 className="text-sm font-semibold mt-3">Select a reply</h3>
                  <p className="text-[11px] text-muted mt-1">Pick a conversation from the left to view & respond.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =============================================================
         TAB 5 · ANALYTICS
         ============================================================= */}
      {activeTab === "analytics" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="card p-3 text-center">
              <p className="text-2xl font-bold font-mono">{totalSent}</p>
              <p className="text-[10px] text-muted">Sent today</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-2xl font-bold font-mono text-green-400">{replyRate}%</p>
              <p className="text-[10px] text-muted">Reply Rate</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-2xl font-bold font-mono text-blue-400">{positiveReplyRate}%</p>
              <p className="text-[10px] text-muted">Positive Reply Rate</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-2xl font-bold font-mono text-gold">{totalBooked}</p>
              <p className="text-[10px] text-muted">Booked Calls</p>
            </div>
          </div>

          {/* Per-platform breakdown */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><TrendingUp size={12} className="text-gold" /> By Platform</h3>
            <div className="space-y-3">
              {PLATFORMS.map(p => {
                const rows = campaigns.filter(c => c.platform === p.id);
                const sent = rows.reduce((s, r) => s + r.sent, 0);
                const replied = rows.reduce((s, r) => s + r.replied, 0);
                const rate = sent ? ((replied / sent) * 100) : 0;
                return (
                  <div key={p.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium flex items-center gap-2">{p.icon(14)} {p.name}</span>
                      <span className="text-xs text-muted">{sent} sent · {replied} replies · {rate.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                      <div className="h-full rounded-full bg-gold/60 transition-all" style={{ width: `${Math.min(100, rate * 5)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Per-campaign leaderboard */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Star size={12} className="text-gold" /> Campaign Leaderboard</h3>
            {campaigns.length === 0 ? (
              <p className="text-[10px] text-muted">No campaigns yet.</p>
            ) : (
              <div className="space-y-2">
                {[...campaigns].sort((a, b) => (b.replied / Math.max(b.sent, 1)) - (a.replied / Math.max(a.sent, 1))).slice(0, 6).map((c, i) => {
                  const rate = c.sent ? ((c.replied / c.sent) * 100).toFixed(1) : "0.0";
                  return (
                    <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg border border-border">
                      <div className="w-6 h-6 rounded-lg bg-gold/10 text-gold text-[10px] font-bold flex items-center justify-center">{i + 1}</div>
                      <div className="shrink-0">{platformIcon(c.platform, 14)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs truncate">{c.name}</p>
                        <p className="text-[10px] text-muted">{c.sent} sent · {c.replied} replies</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold font-mono text-green-400">{rate}%</p>
                        <p className="text-[9px] text-muted">reply rate</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* AI Insights + heatmap */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="card p-4">
              <h3 className="text-xs font-semibold mb-2 flex items-center gap-2"><Lightbulb size={12} className="text-purple-400" /> AI Insights</h3>
              <div className="space-y-2">
                <InsightBubble tone="positive">
                  <strong>LinkedIn is 3× more effective</strong> for your niche this week — 22.6% reply rate vs 7.8% across other platforms.
                </InsightBubble>
                <InsightBubble tone="warning">
                  <strong>Instagram reply rate dropped 18%</strong> — try shortening opener to under 90 chars.
                </InsightBubble>
                <InsightBubble tone="info">
                  <strong>Best time to send</strong>: Tue/Thu 10–11am local. Avoid Mondays before noon.
                </InsightBubble>
                <InsightBubble tone="positive">
                  <strong>Warm-up paying off</strong> — zero shadow-ban flags this week.
                </InsightBubble>
              </div>
            </div>
            <div className="card p-4">
              <h3 className="text-xs font-semibold mb-2 flex items-center gap-2"><Calendar size={12} className="text-gold" /> Best Time Heatmap</h3>
              <Heatmap />
              <p className="text-[9px] text-muted mt-2">Darker = higher reply rate · based on the last 30 days of campaign data.</p>
            </div>
          </div>
        </div>
      )}

      {/* =============================================================
         TAB 6 · AUTOMATION
         ============================================================= */}
      {activeTab === "automation" && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold flex items-center gap-2"><Zap size={12} className="text-gold" /> Automation Rules</h3>
              <button
                onClick={() => setRules(rs => [{
                  id: `r${Date.now()}`,
                  type: "auto_reply",
                  label: "New rule",
                  config: "Customize me",
                  enabled: false,
                }, ...rs])}
                className="px-2.5 py-1 rounded-lg bg-gold text-black text-[10px] font-semibold flex items-center gap-1">
                <Plus size={10} /> Add rule
              </button>
            </div>
            {rules.length === 0 ? (
              <p className="text-[10px] text-muted py-4 text-center">No automation rules configured.</p>
            ) : (
              <div className="space-y-2">
                {rules.map(r => (
                  <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                    <div className="shrink-0 w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
                      {r.type === "auto_reply"    && <MessageSquare size={14} className="text-gold" />}
                      {r.type === "auto_followup" && <RefreshCw size={14} className="text-gold" />}
                      {r.type === "auto_tag"      && <Sparkles size={14} className="text-gold" />}
                      {r.type === "auto_handoff"  && <UserCheck size={14} className="text-gold" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold">{r.label}</p>
                      <p className="text-[10px] text-muted">{r.config}</p>
                    </div>
                    <button
                      onClick={() => setRules(rs => rs.map(x => x.id === r.id ? { ...x, enabled: !x.enabled } : x))}
                      className={cn(
                        "relative w-10 h-5 rounded-full transition-all",
                        r.enabled ? "bg-gold" : "bg-white/10"
                      )}>
                      <span className={cn(
                        "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all",
                        r.enabled ? "left-[22px]" : "left-0.5"
                      )} />
                    </button>
                    <button className="p-1.5 rounded-lg border border-border text-muted hover:text-foreground"><Edit3 size={11} /></button>
                    <button onClick={() => setRules(rs => rs.filter(x => x.id !== r.id))} className="p-1.5 rounded-lg border border-border text-muted hover:text-red-400"><Trash2 size={11} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><GitBranch size={12} className="text-gold" /> Available Automation Types</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <TypeCard title="Auto-reply to keywords"  desc="Match inbound keywords → fire template response instantly" icon={<MessageSquare size={14} />} />
              <TypeCard title="Auto-follow-up after X days"  desc="Send a scheduled follow-up if no reply within N days" icon={<RefreshCw size={14} />} />
              <TypeCard title="Auto-tag by sentiment"  desc="Tag replies hot / warm / cold based on detected sentiment" icon={<Sparkles size={14} />} />
              <TypeCard title="Auto-hand-off when qualified" desc="Pause bot & ping a human when qualify signals detected" icon={<UserCheck size={14} />} />
            </div>
          </div>
        </div>
      )}

      {/* =============================================================
         TAB 7 · COMPLIANCE
         ============================================================= */}
      {activeTab === "compliance" && (
        <div className="space-y-4">
          {/* Rate-limit status */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Shield size={12} className="text-gold" /> Rate Limit Status · per platform</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {PLATFORMS.map(p => {
                const usage = Math.floor(Math.random() * 80);
                return (
                  <div key={p.id} className="p-3 rounded-lg border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      {p.icon(16)}
                      <span className="text-xs font-semibold">{p.name}</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-1.5 mb-1 overflow-hidden">
                      <div className={cn(
                        "h-full rounded-full",
                        usage > 70 ? "bg-red-400" : usage > 40 ? "bg-amber-400" : "bg-green-400"
                      )} style={{ width: `${usage}%` }} />
                    </div>
                    <p className="text-[9px] text-muted">{usage}% of daily quota</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Warm-up progress per account */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Flame size={12} className="text-orange-400" /> Warm-Up Progress</h3>
            <div className="space-y-2">
              {PLATFORMS.map((p, idx) => {
                const day = Math.min(7, idx + 2);
                const pct = (day / 7) * 100;
                return (
                  <div key={p.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium flex items-center gap-2">{p.icon(14)} {p.name}</span>
                      <span className="text-[10px] text-muted">Day {day} / 7</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full rounded-full bg-orange-400" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Blacklist · usernames */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold flex items-center gap-2"><Ban size={12} className="text-red-400" /> Username Blacklist</h3>
              <span className="text-[10px] text-muted">{blacklist.length} entries</span>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <input
                value={blacklistInput}
                onChange={e => setBlacklistInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && blacklistInput.trim()) {
                    setBlacklist(bl => [...bl, { name: blacklistInput.trim(), platform: "instagram", reason: "Manual", date: new Date().toLocaleDateString() }]);
                    setBlacklistInput("");
                  }
                }}
                placeholder="@username or handle · Enter to add"
                className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground"
              />
              <button
                onClick={() => {
                  if (blacklistInput.trim()) {
                    setBlacklist(bl => [...bl, { name: blacklistInput.trim(), platform: "instagram", reason: "Manual", date: new Date().toLocaleDateString() }]);
                    setBlacklistInput("");
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-gold text-black text-[10px] font-semibold flex items-center gap-1">
                <Plus size={10} /> Add
              </button>
            </div>
            {blacklist.length === 0 ? (
              <p className="text-[10px] text-muted text-center py-4">No blacklisted accounts.</p>
            ) : (
              <div className="space-y-1.5">
                {blacklist.map((b, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg border border-border">
                    <div className="flex items-center gap-2.5">
                      <Ban size={12} className="text-red-400" />
                      <div>
                        <p className="text-xs">{b.name}</p>
                        <p className="text-[9px] text-muted">{b.platform} · {b.reason} · {b.date}</p>
                      </div>
                    </div>
                    <button onClick={() => setBlacklist(bl => bl.filter((_, idx) => idx !== i))} className="text-muted hover:text-red-400">
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Keyword blacklist */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold flex items-center gap-2"><AlertTriangle size={12} className="text-amber-400" /> Keyword Blocklist</h3>
              <span className="text-[10px] text-muted">{keywordBlacklist.length} entries</span>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <input
                value={keywordInput}
                onChange={e => setKeywordInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && keywordInput.trim()) {
                    setKeywordBlacklist(kw => [...kw, keywordInput.trim()]);
                    setKeywordInput("");
                  }
                }}
                placeholder="Keyword · Enter to add"
                className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {keywordBlacklist.map((kw, i) => (
                <span key={i} className="text-[10px] px-2.5 py-1 rounded-lg border border-red-400/30 bg-red-400/[0.04] text-red-300 flex items-center gap-1.5">
                  {kw}
                  <button onClick={() => setKeywordBlacklist(list => list.filter((_, idx) => idx !== i))} className="hover:text-red-400">
                    <X size={10} />
                  </button>
                </span>
              ))}
              {keywordBlacklist.length === 0 && <p className="text-[10px] text-muted">No keywords blocked.</p>}
            </div>
          </div>

          {/* Opt-out / DNC */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="card p-4">
              <h3 className="text-xs font-semibold mb-2 flex items-center gap-2"><MinusCircle size={12} className="text-amber-400" /> Opt-out list</h3>
              <p className="text-[10px] text-muted mb-2">Accounts that asked to be removed. Auto-enforced across platforms.</p>
              <div className="text-[10px] text-muted text-center py-2">
                0 opt-outs recorded.
              </div>
            </div>
            <div className="card p-4">
              <h3 className="text-xs font-semibold mb-2 flex items-center gap-2"><ShieldAlert size={12} className="text-red-400" /> Do-not-contact</h3>
              <p className="text-[10px] text-muted mb-2">Legally-mandated exclusions. Sync with your CRM.</p>
              <div className="text-[10px] text-muted text-center py-2">
                0 DNC records.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =============================================================
         TAB 8 · LIVE ACTIVITY
         ============================================================= */}
      {activeTab === "live" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {PLATFORMS.map(p => {
              const sessionsActive = running && config.platforms.includes(p.id);
              return (
                <div key={p.id} className={cn(
                  "card p-3 flex items-center gap-2.5",
                  sessionsActive && "border-green-400/40 bg-green-400/[0.03]"
                )}>
                  {p.icon(20)}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold">{p.name}</p>
                    <p className="text-[9px] text-muted">{sessionsActive ? "Active session" : "Idle"}</p>
                  </div>
                  {sessionsActive && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
                </div>
              );
            })}
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold flex items-center gap-2">
                <Activity size={12} className={cn(running ? "text-green-400" : "text-muted")} />
                Real-time Activity
              </h3>
              <div className="flex items-center gap-2">
                <button onClick={() => setLiveEvents([])} className="text-[10px] px-2.5 py-1 rounded-lg border border-border text-muted hover:text-foreground">Clear</button>
                {running && (
                  <button onClick={() => setRunning(false)} className="text-[10px] px-2.5 py-1 rounded-lg bg-red-500 text-white flex items-center gap-1.5">
                    <PauseCircle size={10} /> Pause all
                  </button>
                )}
              </div>
            </div>
            <div ref={liveRef} className="max-h-[50vh] overflow-y-auto space-y-1">
              {liveEvents.length === 0 ? (
                <div className="text-center py-10">
                  <EmptyIllustration icon={<Activity size={36} />} />
                  <p className="text-xs text-muted mt-2">No activity. {running ? "Events will stream in real-time." : "Start a campaign to see live events."}</p>
                </div>
              ) : liveEvents.map(ev => (
                <div key={ev.id} className="flex items-center gap-2.5 p-2 rounded-lg border border-border bg-black/10">
                  <span className="text-[9px] font-mono text-muted shrink-0 w-16">{ev.at}</span>
                  <div className="shrink-0">{platformIcon(ev.platform, 12)}</div>
                  <LiveIcon kind={ev.kind} />
                  <p className="text-[10px] flex-1 truncate">
                    <LiveLabel kind={ev.kind} /> <span className="text-gold font-mono">{ev.handle}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =============================================================
         Creation Wizard (campaigns)
         ============================================================= */}
      <CreationWizard
        open={wizardOpen}
        title="New DM Campaign"
        subtitle="Set up a campaign in under 60 seconds"
        icon={<Target size={18} />}
        steps={wizardSteps}
        initialData={{
          platform: "instagram",
          volume: 20,
          niche: NICHES[0],
          service: SERVICES[0],
          template: templates[0]?.id,
        }}
        onClose={() => setWizardOpen(false)}
        onComplete={createCampaign}
        submitLabel="Create Campaign"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StatTile({ label, value, icon, tone }: { label: string; value: string | number; icon?: React.ReactNode; tone?: "gold" | "green" | "blue" | "purple" | "pink" }) {
  const toneClass = {
    gold:   "text-gold",
    green:  "text-green-400",
    blue:   "text-blue-400",
    purple: "text-purple-400",
    pink:   "text-pink-400",
  }[tone || "gold"];
  return (
    <div className="card p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] text-muted uppercase tracking-wider">{label}</span>
        {icon && <span className={cn("opacity-70", toneClass)}>{icon}</span>}
      </div>
      <p className={cn("text-xl font-bold font-mono", toneClass)}>{value}</p>
    </div>
  );
}

function Pill({ tone, icon, children }: { tone: "ok" | "warn" | "bad" | "info"; icon?: React.ReactNode; children: React.ReactNode }) {
  const cls = {
    ok:   "bg-green-400/5 border-green-400/20 text-green-400",
    warn: "bg-amber-400/5 border-amber-400/20 text-amber-400",
    bad:  "bg-red-400/5 border-red-400/20 text-red-400",
    info: "bg-blue-400/5 border-blue-400/20 text-blue-400",
  }[tone];
  return (
    <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] whitespace-nowrap shrink-0", cls)}>
      {icon}
      {children}
    </div>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  const rating = value >= 75 ? "green" : value >= 50 ? "amber" : "red";
  const bar = rating === "green" ? "bg-green-400" : rating === "amber" ? "bg-amber-400" : "bg-red-400";
  return (
    <div>
      <div className="flex items-center justify-between text-[9px] text-muted mb-0.5">
        <span>{label}</span>
        <span className="font-mono">{Math.round(value)}</span>
      </div>
      <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", bar)} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: CampaignStatus }) {
  const cfg = {
    running: { cls: "bg-green-400/10 text-green-400 border-green-400/30", label: "Running" },
    paused:  { cls: "bg-amber-400/10 text-amber-400 border-amber-400/30", label: "Paused" },
    draft:   { cls: "bg-white/5 text-muted border-white/10",              label: "Draft" },
    done:    { cls: "bg-blue-400/10 text-blue-400 border-blue-400/30",    label: "Done" },
  }[status];
  return <span className={cn("text-[9px] px-2 py-0.5 rounded border", cfg.cls)}>{cfg.label}</span>;
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone?: "gold" | "green" }) {
  const c = tone === "gold" ? "text-gold" : tone === "green" ? "text-green-400" : "text-foreground";
  return (
    <div className="text-right">
      <p className={cn("text-xs font-bold font-mono", c)}>{value}</p>
      <p className="text-[9px] text-muted">{label}</p>
    </div>
  );
}

function SentimentBadge({ sentiment }: { sentiment: InboxReply["sentiment"] }) {
  const cfg = {
    positive: { cls: "bg-green-400/10 text-green-400 border-green-400/30",  label: "Positive", icon: ThumbsUp    },
    negative: { cls: "bg-red-400/10 text-red-400 border-red-400/30",        label: "Negative", icon: ThumbsDown  },
    question: { cls: "bg-blue-400/10 text-blue-400 border-blue-400/30",     label: "Question", icon: MessageSquare},
    neutral:  { cls: "bg-white/5 text-muted border-white/10",               label: "Neutral",  icon: MinusCircle },
  }[sentiment];
  const Icon = cfg.icon;
  return <span className={cn("text-[9px] px-1.5 py-0.5 rounded border flex items-center gap-1", cfg.cls)}><Icon size={8} /> {cfg.label}</span>;
}

function StatusChip({ status }: { status: InboxReply["status"] }) {
  const cfg = {
    new:          { cls: "bg-gold/10 text-gold border-gold/30",            label: "New" },
    closed:       { cls: "bg-white/5 text-muted border-white/10",          label: "Closed" },
    handed_off:   { cls: "bg-blue-400/10 text-blue-400 border-blue-400/30",label: "Handed off" },
    needs_human:  { cls: "bg-amber-400/10 text-amber-400 border-amber-400/30", label: "Needs human" },
  }[status];
  return <span className={cn("text-[8px] px-1.5 py-0.5 rounded border", cfg.cls)}>{cfg.label}</span>;
}

function EmptyIllustration({ icon }: { icon: React.ReactNode }) {
  return (
    <div className="relative inline-flex items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-gold/10 blur-xl scale-150" />
      <div className="relative w-16 h-16 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold">
        {icon}
      </div>
    </div>
  );
}

function TemplateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[8px] uppercase tracking-wider text-muted mb-0.5">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded border border-border bg-surface px-2 py-1 text-[11px] text-foreground"
      />
    </div>
  );
}

function TypeCard({ title, desc, icon }: { title: string; desc: string; icon: React.ReactNode }) {
  return (
    <div className="p-3 rounded-lg border border-border hover:border-gold/20 transition-all">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-gold">{icon}</span>
        <p className="text-xs font-semibold">{title}</p>
      </div>
      <p className="text-[10px] text-muted">{desc}</p>
    </div>
  );
}

function InsightBubble({ tone, children }: { tone: "positive" | "warning" | "info"; children: React.ReactNode }) {
  const cls = {
    positive: "border-green-400/20 bg-green-400/[0.03] text-foreground",
    warning:  "border-amber-400/20 bg-amber-400/[0.03] text-foreground",
    info:     "border-blue-400/20 bg-blue-400/[0.03] text-foreground",
  }[tone];
  const icon = tone === "positive" ? <TrendingUp size={11} className="text-green-400" /> :
               tone === "warning"  ? <AlertTriangle size={11} className="text-amber-400" /> :
                                     <FileText size={11} className="text-blue-400" />;
  return (
    <div className={cn("p-2.5 rounded-lg border text-[11px] leading-relaxed flex items-start gap-2", cls)}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>{children}</div>
    </div>
  );
}

function Heatmap() {
  // deterministic "heat" values so rerenders don't shimmer
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const heat = (d: number, h: number) => {
    // Seed by day+hour to get stable values
    const v = Math.abs(Math.sin(d * 7 + h * 1.3)) * 100;
    return Math.round(v);
  };
  return (
    <div>
      <div className="grid grid-cols-[auto_repeat(11,minmax(0,1fr))] gap-0.5">
        <div />
        {hours.map(h => (
          <div key={h} className="text-[8px] text-muted text-center font-mono">{h}</div>
        ))}
        {days.map((d, dIdx) => (
          <>
            <div key={`d${dIdx}`} className="text-[8px] text-muted pr-1 text-right font-mono">{d}</div>
            {hours.map(h => {
              const v = heat(dIdx, h);
              return (
                <div
                  key={`${dIdx}-${h}`}
                  className="aspect-square rounded-sm"
                  style={{ background: `rgba(201,168,76,${0.08 + (v / 100) * 0.7})` }}
                  title={`${d} ${h}:00 — ${v}% reply rate`}
                />
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}

function LiveIcon({ kind }: { kind: LiveEvent["kind"] }) {
  if (kind === "open")   return <Eye size={11} className="text-blue-400 shrink-0" />;
  if (kind === "typing") return <MoreVertical size={11} className="text-amber-400 shrink-0" />;
  if (kind === "sent")   return <Send size={11} className="text-green-400 shrink-0" />;
  if (kind === "reply")  return <MessageSquare size={11} className="text-gold shrink-0" />;
  return <AlertTriangle size={11} className="text-muted shrink-0" />;
}

function LiveLabel({ kind }: { kind: LiveEvent["kind"] }) {
  const map: Record<LiveEvent["kind"], string> = {
    open:   "Opening profile",
    typing: "Typing message for",
    sent:   "Sent DM to",
    reply:  "Reply received from",
    skip:   "Skipped (blacklist)",
  };
  return <span className="text-muted">{map[kind]}</span>;
}
