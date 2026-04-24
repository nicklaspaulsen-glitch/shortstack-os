"use client";

import { useState, useCallback, useEffect } from "react";
import {
  PhoneCall, Mail, MessageSquare, Send, Settings,
  Sparkles, Loader2, Copy, Check, Save,
  ChevronDown, ChevronUp, Plus, Trash2, X,
  Globe, Smartphone, Clock, Target, Zap,
  ToggleLeft, ToggleRight, Hash, AlertCircle, Eye,
  Play, Pause, BarChart3, Star,
  Megaphone, ListChecks, Users,
  UtensilsCrossed, Heart, Home, Scale, Car, Wrench,
  Dumbbell, Scissors, HardHat, Shield, Calculator,
  Monitor, Briefcase, Factory, ShoppingCart, Package,
  GraduationCap, Store, Layers,
  CircleDot, Activity, FileText
} from "lucide-react";
import {
  InstagramIcon, FacebookIcon, LinkedInIcon, TikTokIcon,
} from "@/components/ui/platform-icons";
import toast from "react-hot-toast";
import PageAI from "@/components/page-ai";
import PageHero from "@/components/ui/page-hero";
import { EmptyState } from "@/components/ui/empty-state-illustration";
import { useQuotaWall } from "@/components/billing/quota-wall";
import ErrorBoundary from "@/components/error-boundary";

/* ── Types ── */
type MainTab = "campaigns" | "sequences" | "templates" | "analytics" | "settings";
type TemplateSubTab = "calls" | "sms" | "email" | "dms";
type TargetMode = "b2b" | "b2c";
type CampaignStatus = "active" | "paused" | "completed";

interface Template {
  id: string;
  name: string;
  content: string;
  variables: string[];
  enabled: boolean;
}

interface Campaign {
  id: string;
  name: string;
  targetMode: TargetMode;
  industries: string[];
  channels: { email: boolean; sms: boolean; calls: boolean; dms: boolean };
  dailyTargets: { email: number; sms: number; calls: number; dms: number };
  sequenceId: string;
  status: CampaignStatus;
  stats: { leads: number; contacted: number; replied: number; booked: number; converted: number };
  todayProgress: { email: number; sms: number; calls: number; dms: number };
  createdAt: string;
}

interface SequenceStep {
  id: string;
  day: number;
  channel: "email" | "sms" | "call" | "dm";
  action: string;
  templateRef: string;
  condition: "always" | "no_reply" | "replied" | "opened";
}

interface OutreachSequence {
  id: string;
  name: string;
  description: string;
  targetMode: TargetMode | "both";
  steps: SequenceStep[];
}

/* ── AI Enhance Button Component ── */
function AIEnhanceButton({ value, onResult, context }: { value: string; onResult: (v: string) => void; context: string }) {
  const [loading, setLoading] = useState(false);
  const { fetchWithWall } = useQuotaWall();

  async function enhance() {
    if (!value.trim()) { toast.error("Type something first"); return; }
    setLoading(true);
    try {
      // fetchWithWall surfaces QuotaWall modal on 402 token-limit responses.
      const res = await fetchWithWall("/api/copywriter/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "custom",
          topic: `Improve this ${context}: "${value}"`,
          tone: "professional",
          audience: "business owners",
          keywords: "",
          wordCount: Math.max(value.split(" ").length * 2, 50),
        }),
      });
      if (res.status === 402) {
        toast.error("You hit your token limit — click to upgrade", { duration: 5000 });
        setLoading(false);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        const improved = data.content || data.text || "";
        if (improved) { onResult(improved); toast.success("Enhanced with AI"); }
        else toast.error("No result returned");
      } else {
        toast.error("AI generation failed");
      }
    } catch { toast.error("Error connecting to AI"); }
    setLoading(false);
  }

  return (
    <button onClick={enhance} disabled={loading || !value.trim()}
      className="text-[9px] px-2.5 py-1 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 disabled:opacity-30 flex items-center gap-1 transition-all border border-gold/10 hover:border-gold/20">
      {loading ? <Loader2 size={9} className="animate-spin" /> : <Sparkles size={9} />}
      {loading ? "Enhancing..." : "AI Enhance"}
    </button>
  );
}

/* ── Editable Template Card ── */
function TemplateCard({ template, onChange, onDelete, context }: {
  template: Template;
  onChange: (t: Template) => void;
  onDelete: () => void;
  context: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  function copyContent() {
    navigator.clipboard.writeText(template.content);
    setCopied(true);
    toast.success("Copied");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={`rounded-xl border transition-all ${template.enabled ? "border-border bg-surface-light" : "border-border/50 bg-surface-light/50 opacity-60"}`}>
      <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <button onClick={e => { e.stopPropagation(); onChange({ ...template, enabled: !template.enabled }); }}
          className={`flex-shrink-0 ${template.enabled ? "text-gold" : "text-muted"}`}>
          {template.enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
        </button>
        <div className="flex-1 min-w-0">
          <input value={template.name} onClick={e => e.stopPropagation()}
            onChange={e => onChange({ ...template, name: e.target.value })}
            className="text-xs font-semibold bg-transparent border-none outline-none w-full" />
          <p className="text-[9px] text-muted truncate mt-0.5">{template.content.substring(0, 80)}...</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {template.variables.length > 0 && (
            <span className="text-[8px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">{template.variables.length} vars</span>
          )}
          <button onClick={e => { e.stopPropagation(); copyContent(); }} className="p-1 hover:bg-white/5 rounded" aria-label="Copy template">
            {copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} className="text-muted" />}
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }} className="p-1 hover:bg-red-500/10 rounded" aria-label="Delete template">
            <Trash2 size={10} className="text-muted hover:text-red-400" />
          </button>
          {expanded ? <ChevronUp size={12} className="text-muted" /> : <ChevronDown size={12} className="text-muted" />}
        </div>
      </div>
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/50 pt-3">
          <textarea value={template.content}
            onChange={e => onChange({ ...template, content: e.target.value })}
            rows={6}
            className="input w-full text-[11px] leading-relaxed font-mono resize-y" />
          <div className="flex items-center justify-between">
            <div className="flex gap-1 flex-wrap">
              {template.variables.map(v => (
                <span key={v} className="text-[8px] px-1.5 py-0.5 rounded bg-gold/10 text-gold font-mono">{`{{${v}}}`}</span>
              ))}
            </div>
            <AIEnhanceButton value={template.content} context={context}
              onResult={v => onChange({ ...template, content: v })} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Default Templates ── */
const DEFAULT_CALL_TEMPLATES: Template[] = [
  {
    id: "call-intro",
    name: "Cold Call — Intro Script",
    content: `You are Alex, a friendly sales representative from ShortStack, a digital marketing agency.

CONTEXT:
- Calling {{business_name}}, a {{industry}} business
- Goal: Book a 10-minute discovery call
- Be conversational, warm, genuine — NOT robotic

SCRIPT FLOW:
1. "Hi, this is Alex from ShortStack. Am I speaking with the owner of {{business_name}}?"
2. If yes: "Great! I noticed {{business_name}} online and we've been helping similar {{industry}} businesses get 40-60% more clients. Would you be open to a quick 10-minute call?"
3. If interested: "Awesome! What day works best this week?"
4. If hesitant: "No pressure! We could send you a case study. Would that help?"
5. If no: "No worries! Thanks for your time. Have a great day!"

RULES:
- Keep under 2 minutes
- Never be pushy
- Pricing: "Starts around $500/month. Discovery call is free."`,
    variables: ["business_name", "industry"],
    enabled: true,
  },
  {
    id: "call-followup",
    name: "Follow-up Call Script",
    content: `You are Alex from ShortStack following up on a previous conversation.

"Hi, this is Alex from ShortStack again. We spoke {{days_ago}} about helping {{business_name}} with digital marketing. I wanted to check in — did you get a chance to look at the info we sent over?"

If yes and interested: "Great! Would you like to schedule that discovery call? I have openings this week."
If no: "No problem! Want me to resend it? I can also include a quick video walkthrough."
If not interested: "Totally understand. If anything changes, we're here. Have a great day!"`,
    variables: ["business_name", "days_ago"],
    enabled: true,
  },
  {
    id: "call-voicemail",
    name: "Voicemail Script",
    content: `"Hi, this is Alex from ShortStack. I'm reaching out to the owner of {{business_name}}. We help {{industry}} businesses get more clients through digital marketing, and I thought you'd be a great fit. Give me a call back at {{callback_number}} or I'll try you again soon. Have a great day!"`,
    variables: ["business_name", "industry", "callback_number"],
    enabled: true,
  },
];

const DEFAULT_SMS_TEMPLATES: Template[] = [
  {
    id: "sms-intro",
    name: "Initial Outreach",
    content: `Hi {{name}}! This is Alex from ShortStack. I came across {{business_name}} and love what you're doing in {{industry}}. We help businesses like yours get 40-60% more clients through digital marketing. Would you be open to a quick chat? No pressure at all!`,
    variables: ["name", "business_name", "industry"],
    enabled: true,
  },
  {
    id: "sms-followup-2d",
    name: "2-Day Follow-up",
    content: `Hey {{name}}, just following up on my message about helping {{business_name}} grow online. We recently helped a similar {{industry}} business double their leads in 60 days. Want to see the case study?`,
    variables: ["name", "business_name", "industry"],
    enabled: true,
  },
  {
    id: "sms-followup-5d",
    name: "5-Day Follow-up",
    content: `Hi {{name}}! Last message from me — wanted to share a free strategy idea for {{business_name}}: [specific tip based on their industry]. If you ever want help implementing this, we're here. Best of luck!`,
    variables: ["name", "business_name"],
    enabled: true,
  },
  {
    id: "sms-reply-interested",
    name: "Auto-Reply: Interested",
    content: `That's great to hear, {{name}}! I'd love to walk you through what we can do for {{business_name}}. Would you prefer a quick 10-min call or should I send over some info first?`,
    variables: ["name", "business_name"],
    enabled: true,
  },
  {
    id: "sms-reply-booked",
    name: "Booking Confirmation",
    content: `Awesome, you're all set! Looking forward to chatting with you about {{business_name}}. I'll send a calendar invite shortly. Talk soon!`,
    variables: ["business_name"],
    enabled: true,
  },
];

const DEFAULT_EMAIL_TEMPLATES: Template[] = [
  {
    id: "email-cold",
    name: "Cold Outreach Email",
    content: `Subject: Quick question about {{business_name}}

Hi {{name}},

I came across {{business_name}} and noticed you're doing great work in the {{industry}} space{{rating_mention}}.

At ShortStack, we help businesses like yours get more clients through digital marketing — social media, ads, SEO, and content.

Would you be open to a quick 15-minute call to see if we can help? No pressure at all.

Best,
The ShortStack Team`,
    variables: ["name", "business_name", "industry", "rating_mention"],
    enabled: true,
  },
  {
    id: "email-followup",
    name: "Follow-up Email (No Reply)",
    content: `Subject: Re: Quick question about {{business_name}}

Hi {{name}},

Just following up on my previous email. We have some specific ideas for how we could help {{business_name}} grow online.

Would a quick call this week work? I promise to keep it under 15 minutes.

Best,
The ShortStack Team`,
    variables: ["name", "business_name"],
    enabled: true,
  },
  {
    id: "email-value",
    name: "Value-First Email",
    content: `Subject: Free strategy idea for {{business_name}}

Hi {{name}},

I've been looking at {{business_name}}'s online presence and had a quick idea:

[SPECIFIC SUGGESTION BASED ON THEIR INDUSTRY]

This alone could help drive 20-30% more inquiries. Happy to explain more if you're interested.

Best,
The ShortStack Team`,
    variables: ["name", "business_name"],
    enabled: true,
  },
];

const DEFAULT_DM_TEMPLATES: Template[] = [
  {
    id: "dm-ig-intro",
    name: "Instagram — Initial DM",
    content: `Hey {{name}}! Love what you're doing with {{business_name}}. We help {{industry}} businesses grow their online presence and get more clients. Would you be open to a quick chat about some ideas we have for you?`,
    variables: ["name", "business_name", "industry"],
    enabled: true,
  },
  {
    id: "dm-fb-intro",
    name: "Facebook — Initial DM",
    content: `Hi {{name}}! I came across {{business_name}} and was really impressed. We specialize in helping {{industry}} businesses get more clients through digital marketing. Would love to share some ideas — are you open to a quick chat?`,
    variables: ["name", "business_name", "industry"],
    enabled: true,
  },
  {
    id: "dm-li-intro",
    name: "LinkedIn — Initial DM",
    content: `Hi {{name}}, I noticed your work with {{business_name}} in {{industry}}. At ShortStack, we've been helping similar businesses increase their client base by 40-60% through targeted digital strategies. Would you be interested in a brief conversation about what we could do for you?`,
    variables: ["name", "business_name", "industry"],
    enabled: true,
  },
  {
    id: "dm-followup",
    name: "Follow-up DM (All Platforms)",
    content: `Hey {{name}}, just circling back! We put together a quick strategy idea for {{business_name}} that I think could really help. Want me to send it over?`,
    variables: ["name", "business_name"],
    enabled: true,
  },
];

/* ── Industry Definitions ── */
const B2B_INDUSTRIES = [
  { id: "restaurants", label: "Restaurants & Food", icon: UtensilsCrossed },
  { id: "dental", label: "Dental & Medical", icon: Heart },
  { id: "realestate", label: "Real Estate", icon: Home },
  { id: "legal", label: "Legal Services", icon: Scale },
  { id: "auto", label: "Auto Dealers", icon: Car },
  { id: "homeservices", label: "Home Services", icon: Wrench },
  { id: "fitness", label: "Fitness & Gyms", icon: Dumbbell },
  { id: "salons", label: "Salons & Spas", icon: Scissors },
  { id: "construction", label: "Construction", icon: HardHat },
  { id: "insurance", label: "Insurance", icon: Shield },
  { id: "accounting", label: "Accounting & Finance", icon: Calculator },
  { id: "it", label: "IT Services", icon: Monitor },
  { id: "marketing", label: "Marketing Agencies", icon: Megaphone },
  { id: "manufacturing", label: "Manufacturing", icon: Factory },
  { id: "wholesale", label: "Wholesale/Distribution", icon: Package },
  { id: "saas", label: "SaaS/Tech", icon: Layers },
  { id: "ecommerce", label: "E-commerce", icon: ShoppingCart },
  { id: "education", label: "Education", icon: GraduationCap },
  { id: "professional", label: "Professional Services", icon: Briefcase },
  { id: "retail", label: "Retail Stores", icon: Store },
];

/* ── Campaign Presets ── */
const CAMPAIGN_PRESETS = [
  { name: "Local Restaurant Blitz", description: "High-volume outreach to restaurants needing digital presence", targetMode: "b2b" as TargetMode, industries: ["restaurants"], channels: { email: true, sms: true, calls: true, dms: false }, dailyTargets: { email: 30, sms: 20, calls: 15, dms: 0 } },
  { name: "Dental Practice Outreach", description: "Targeted campaign for dental offices seeking more patients", targetMode: "b2b" as TargetMode, industries: ["dental"], channels: { email: true, sms: true, calls: true, dms: true }, dailyTargets: { email: 20, sms: 15, calls: 10, dms: 5 } },
  { name: "Real Estate Agent Prospecting", description: "Connect with agents looking to grow their online brand", targetMode: "b2b" as TargetMode, industries: ["realestate"], channels: { email: true, sms: false, calls: true, dms: true }, dailyTargets: { email: 25, sms: 0, calls: 10, dms: 15 } },
  { name: "E-commerce Store Growth", description: "Reach online store owners needing marketing help", targetMode: "b2b" as TargetMode, industries: ["ecommerce"], channels: { email: true, sms: false, calls: false, dms: true }, dailyTargets: { email: 40, sms: 0, calls: 0, dms: 20 } },
  { name: "SaaS Demo Campaign", description: "Book demos with SaaS companies needing agency support", targetMode: "b2b" as TargetMode, industries: ["saas"], channels: { email: true, sms: false, calls: true, dms: true }, dailyTargets: { email: 30, sms: 0, calls: 8, dms: 10 } },
  { name: "Fitness Studio Launch", description: "Help gyms and studios fill memberships", targetMode: "b2b" as TargetMode, industries: ["fitness"], channels: { email: true, sms: true, calls: true, dms: true }, dailyTargets: { email: 20, sms: 15, calls: 10, dms: 10 } },
  { name: "Auto Dealer Leads", description: "Multi-channel outreach to auto dealerships", targetMode: "b2b" as TargetMode, industries: ["auto"], channels: { email: true, sms: true, calls: true, dms: false }, dailyTargets: { email: 15, sms: 10, calls: 12, dms: 0 } },
  { name: "Home Services Push", description: "Target plumbers, HVAC, roofers and more", targetMode: "b2b" as TargetMode, industries: ["homeservices", "construction"], channels: { email: true, sms: true, calls: true, dms: false }, dailyTargets: { email: 25, sms: 20, calls: 15, dms: 0 } },
];

/* ── Pre-built Sequences ── */
const DEFAULT_SEQUENCES: OutreachSequence[] = [
  {
    id: "seq-gentle", name: "The Gentle Approach", description: "Spaced-out, low-pressure multi-channel sequence ideal for professional services", targetMode: "b2b",
    steps: [
      { id: "s1", day: 1, channel: "email", action: "Send cold outreach email", templateRef: "email-cold", condition: "always" },
      { id: "s2", day: 3, channel: "sms", action: "Send intro SMS", templateRef: "sms-intro", condition: "no_reply" },
      { id: "s3", day: 7, channel: "call", action: "Cold call with intro script", templateRef: "call-intro", condition: "no_reply" },
      { id: "s4", day: 10, channel: "dm", action: "LinkedIn DM outreach", templateRef: "dm-li-intro", condition: "no_reply" },
    ],
  },
  {
    id: "seq-blitz", name: "The Blitz", description: "Fast-paced multi-channel approach for maximum touchpoints quickly", targetMode: "b2b",
    steps: [
      { id: "s1", day: 1, channel: "email", action: "Send cold email + SMS same day", templateRef: "email-cold", condition: "always" },
      { id: "s2", day: 1, channel: "sms", action: "Send intro SMS", templateRef: "sms-intro", condition: "always" },
      { id: "s3", day: 2, channel: "call", action: "Cold call follow-up", templateRef: "call-intro", condition: "no_reply" },
      { id: "s4", day: 3, channel: "email", action: "Follow-up email", templateRef: "email-followup", condition: "no_reply" },
      { id: "s5", day: 5, channel: "dm", action: "Social DM outreach", templateRef: "dm-ig-intro", condition: "no_reply" },
    ],
  },
  {
    id: "seq-social", name: "Social First", description: "Start with social DMs before moving to direct channels", targetMode: "b2c",
    steps: [
      { id: "s1", day: 1, channel: "dm", action: "Instagram DM introduction", templateRef: "dm-ig-intro", condition: "always" },
      { id: "s2", day: 3, channel: "dm", action: "Facebook message", templateRef: "dm-fb-intro", condition: "no_reply" },
      { id: "s3", day: 5, channel: "email", action: "Email outreach", templateRef: "email-cold", condition: "no_reply" },
      { id: "s4", day: 7, channel: "sms", action: "SMS follow-up", templateRef: "sms-followup-2d", condition: "no_reply" },
    ],
  },
  {
    id: "seq-phone", name: "Phone-Heavy", description: "Call-focused campaign with voicemail drops and email support", targetMode: "b2b",
    steps: [
      { id: "s1", day: 1, channel: "call", action: "Initial cold call", templateRef: "call-intro", condition: "always" },
      { id: "s2", day: 2, channel: "call", action: "Voicemail if missed", templateRef: "call-voicemail", condition: "no_reply" },
      { id: "s3", day: 4, channel: "email", action: "Follow-up email", templateRef: "email-followup", condition: "no_reply" },
      { id: "s4", day: 7, channel: "call", action: "Second call attempt", templateRef: "call-followup", condition: "no_reply" },
    ],
  },
  {
    id: "seq-nurture", name: "Email Nurture", description: "Slow-drip email sequence building trust through value", targetMode: "both",
    steps: [
      { id: "s1", day: 1, channel: "email", action: "Cold outreach email", templateRef: "email-cold", condition: "always" },
      { id: "s2", day: 3, channel: "email", action: "Value-first email", templateRef: "email-value", condition: "no_reply" },
      { id: "s3", day: 7, channel: "email", action: "Case study / social proof", templateRef: "email-followup", condition: "no_reply" },
      { id: "s4", day: 14, channel: "email", action: "Final CTA email", templateRef: "email-followup", condition: "no_reply" },
    ],
  },
  {
    id: "seq-local", name: "Local Business", description: "Review-focused approach for local businesses found on Google Maps", targetMode: "b2b",
    steps: [
      { id: "s1", day: 1, channel: "email", action: "Review-based intro email", templateRef: "email-cold", condition: "always" },
      { id: "s2", day: 2, channel: "email", action: "Value add email", templateRef: "email-value", condition: "always" },
      { id: "s3", day: 5, channel: "sms", action: "SMS follow-up", templateRef: "sms-followup-2d", condition: "no_reply" },
      { id: "s4", day: 8, channel: "call", action: "Phone call", templateRef: "call-intro", condition: "no_reply" },
    ],
  },
];

/* ── Channel icon helper ── */
function channelIcon(ch: string, size: number = 12) {
  switch (ch) {
    case "email": return <Mail size={size} />;
    case "sms": return <Smartphone size={size} />;
    case "call": return <PhoneCall size={size} />;
    case "dm": return <MessageSquare size={size} />;
    default: return <Send size={size} />;
  }
}

function channelColor(ch: string) {
  switch (ch) {
    case "email": return "text-gold";
    case "sms": return "text-green-400";
    case "call": return "text-emerald-400";
    case "dm": return "text-blue-400";
    default: return "text-muted";
  }
}

function conditionLabel(c: string) {
  switch (c) {
    case "always": return "Always";
    case "no_reply": return "If no reply";
    case "replied": return "If replied";
    case "opened": return "If opened";
    default: return c;
  }
}

/* ════════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                             */
/* ════════════════════════════════════════════════════════════ */
export default function OutreachHubPage() {
  const [tab, setTab] = useState<MainTab>("campaigns");
  const [templateSubTab, setTemplateSubTab] = useState<TemplateSubTab>("calls");
  const [saving, setSaving] = useState(false);

  /* ── Explainer collapse (persists per-browser; collapsed by default) ── */
  const [explainerOpen, setExplainerOpen] = useState<boolean>(false);
  useEffect(() => {
    try {
      const stored = localStorage.getItem("outreach_explainer_open");
      if (stored === "1") setExplainerOpen(true);
    } catch {}
  }, []);
  function toggleExplainer() {
    setExplainerOpen(v => {
      const next = !v;
      try { localStorage.setItem("outreach_explainer_open", next ? "1" : "0"); } catch {}
      return next;
    });
  }

  /* ── Campaign State ── */
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showCampaignBuilder, setShowCampaignBuilder] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    targetMode: "b2b" as TargetMode,
    industries: [] as string[],
    channels: { email: true, sms: true, calls: true, dms: false },
    dailyTargets: { email: 25, sms: 15, calls: 10, dms: 5 },
    sequenceId: "seq-gentle",
  });

  /* ── Sequence State ── */
  const [sequences, setSequences] = useState<OutreachSequence[]>(DEFAULT_SEQUENCES);
  const [activeSequence, setActiveSequence] = useState<string>("seq-gentle");
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [customSteps, setCustomSteps] = useState<SequenceStep[]>([]);
  const [customSeqName, setCustomSeqName] = useState("");

  /* ── Templates State ── */
  const [callTemplates, setCallTemplates] = useState<Template[]>(DEFAULT_CALL_TEMPLATES);
  const [smsTemplates, setSmsTemplates] = useState<Template[]>(DEFAULT_SMS_TEMPLATES);
  const [emailTemplates, setEmailTemplates] = useState<Template[]>(DEFAULT_EMAIL_TEMPLATES);
  const [dmTemplates, setDmTemplates] = useState<Template[]>(DEFAULT_DM_TEMPLATES);
  const [templateFilter, setTemplateFilter] = useState<"all" | "b2b" | "b2c">("all");

  /* ── Settings State ── */
  const [callSettings, setCallSettings] = useState({
    agentName: "Alex",
    voiceId: "default",
    maxDuration: 120,
    firstMessage: 'Hi! This is Alex from ShortStack. Am I speaking with the owner of {{business_name}}?',
    language: "en",
    enableVoicemail: true,
    voicemailDetection: true,
  });
  const [smsSettings, setSmsSettings] = useState({
    aiPersonalize: true,
    maxLength: 160,
    sendWindow: { start: "09:00", end: "18:00" },
    timezone: "America/New_York",
    autoReply: true,
    followupDays: [2, 5],
    maxFollowups: 3,
  });
  const [emailSettings, setEmailSettings] = useState({
    aiPersonalize: true,
    fromName: "The ShortStack Team",
    signature: "Best,\nThe ShortStack Team",
    sendDelay: 300,
    trackOpens: true,
    maxPerDay: 50,
  });
  const [dmSettings, setDmSettings] = useState({
    aiPersonalize: true,
    platforms: { instagram: true, facebook: true, linkedin: true, tiktok: false },
    sendWindow: { start: "10:00", end: "20:00" },
    maxPerDay: 20,
    autoFollowup: true,
    followupDays: 3,
  });
  const [globalSettings, setGlobalSettings] = useState({
    tone: "friendly",
    aggressiveness: "soft",
    brandVoice: "We're ShortStack, a digital marketing agency that helps local businesses get more clients. We're genuine, helpful, and never pushy.",
    customInstructions: "",
  });
  const [dailyLimits, setDailyLimits] = useState({ email: 50, sms: 30, calls: 20, dms: 25 });
  const [compliance, setCompliance] = useState({ optOut: true, dncList: true, tcpa: true, canSpam: true });
  const [defaultTargetMode, setDefaultTargetMode] = useState<TargetMode>("b2b");
  const [timezone, setTimezone] = useState("America/New_York");
  const [workingHours, setWorkingHours] = useState({ start: "09:00", end: "17:00" });

  /* ── Preview ── */
  const [previewVars, setPreviewVars] = useState<Record<string, string>>({});
  const [, setConfigLoaded] = useState(false);

  /* ── Load saved config on mount ── */
  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/api/outreach/configure");
        if (!res.ok) return;
        const { config } = await res.json();
        if (!config) return;

        // Restore saved state
        if (config.campaigns?.length) setCampaigns(config.campaigns);
        if (config.call_templates?.length) setCallTemplates(config.call_templates);
        if (config.sms_templates?.length) setSmsTemplates(config.sms_templates);
        if (config.email_templates?.length) setEmailTemplates(config.email_templates);
        if (config.dm_templates?.length) setDmTemplates(config.dm_templates);
        if (config.call_settings) setCallSettings(prev => ({ ...prev, ...config.call_settings }));
        if (config.sms_settings) setSmsSettings(prev => ({ ...prev, ...config.sms_settings }));
        if (config.email_settings) setEmailSettings(prev => ({ ...prev, ...config.email_settings }));
        if (config.dm_settings) setDmSettings(prev => ({ ...prev, ...config.dm_settings }));
        if (config.global_settings) setGlobalSettings(prev => ({ ...prev, ...config.global_settings }));
        if (config.daily_limits) setDailyLimits(prev => ({ ...prev, ...config.daily_limits }));
        if (config.compliance) setCompliance(prev => ({ ...prev, ...config.compliance }));
        if (config.sequences?.length) setSequences(config.sequences);
      } catch {
        // Silently fail — use defaults
      } finally {
        setConfigLoaded(true);
      }
    }
    loadConfig();
  }, []);

  /* ── Template CRUD ── */
  function addTemplate(channel: TemplateSubTab) {
    const newTemplate: Template = {
      id: `${channel}-${Date.now()}`,
      name: "New Template",
      content: "",
      variables: [],
      enabled: true,
    };
    const setters = { calls: setCallTemplates, sms: setSmsTemplates, email: setEmailTemplates, dms: setDmTemplates };
    setters[channel](prev => [...prev, newTemplate]);
  }

  function updateTemplate(channel: TemplateSubTab, id: string, updated: Template) {
    const matches = updated.content.match(/\{\{(\w+)\}\}/g) || [];
    const vars = Array.from(new Set(matches.map(v => v.replace(/\{|\}/g, ""))));
    updated.variables = vars;
    const setters = { calls: setCallTemplates, sms: setSmsTemplates, email: setEmailTemplates, dms: setDmTemplates };
    setters[channel](prev => prev.map(t => t.id === id ? updated : t));
  }

  function deleteTemplate(channel: TemplateSubTab, id: string) {
    const setters = { calls: setCallTemplates, sms: setSmsTemplates, email: setEmailTemplates, dms: setDmTemplates };
    setters[channel](prev => prev.filter(t => t.id !== id));
  }

  function renderPreview(template: Template) {
    let text = template.content;
    template.variables.forEach(v => {
      text = text.replace(new RegExp(`\\{\\{${v}\\}\\}`, "g"), previewVars[v] || `[${v}]`);
    });
    return text;
  }

  /* ── Campaign CRUD ── */
  function createCampaign() {
    if (!newCampaign.name.trim()) { toast.error("Campaign name is required"); return; }
    const campaign: Campaign = {
      id: `camp-${Date.now()}`,
      name: newCampaign.name,
      targetMode: newCampaign.targetMode,
      industries: newCampaign.industries,
      channels: { ...newCampaign.channels },
      dailyTargets: { ...newCampaign.dailyTargets },
      sequenceId: newCampaign.sequenceId,
      status: "paused",
      stats: { leads: 0, contacted: 0, replied: 0, booked: 0, converted: 0 },
      todayProgress: { email: 0, sms: 0, calls: 0, dms: 0 },
      createdAt: new Date().toISOString(),
    };
    setCampaigns(prev => [...prev, campaign]);
    setShowCampaignBuilder(false);
    setNewCampaign({ name: "", targetMode: "b2b", industries: [], channels: { email: true, sms: true, calls: true, dms: false }, dailyTargets: { email: 25, sms: 15, calls: 10, dms: 5 }, sequenceId: "seq-gentle" });
    toast.success("Campaign created");
  }

  function toggleCampaignStatus(id: string) {
    setCampaigns(prev => prev.map(c => {
      if (c.id !== id) return c;
      const next = c.status === "active" ? "paused" : "active";
      return { ...c, status: next };
    }));
  }

  function deleteCampaign(id: string) {
    setCampaigns(prev => prev.filter(c => c.id !== id));
    toast.success("Campaign deleted");
  }

  /* ── Custom Sequence ── */
  function addCustomStep() {
    setCustomSteps(prev => [...prev, {
      id: `cs-${Date.now()}`,
      day: prev.length > 0 ? (prev[prev.length - 1].day + 2) : 1,
      channel: "email",
      action: "",
      templateRef: "",
      condition: "always",
    }]);
  }

  function saveCustomSequence() {
    if (!customSeqName.trim() || customSteps.length === 0) {
      toast.error("Name and at least one step required");
      return;
    }
    const seq: OutreachSequence = {
      id: `seq-custom-${Date.now()}`,
      name: customSeqName,
      description: "Custom sequence",
      targetMode: "both",
      steps: customSteps,
    };
    setSequences(prev => [...prev, seq]);
    setShowCustomBuilder(false);
    setCustomSeqName("");
    setCustomSteps([]);
    toast.success("Sequence saved");
  }

  /* ── Toggle arrays ── */
  function toggleArray(arr: string[], item: string): string[] {
    return arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];
  }

  /* ── Save All ── */
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await fetch("/api/outreach/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaigns,
          call_templates: callTemplates,
          sms_templates: smsTemplates,
          email_templates: emailTemplates,
          dm_templates: dmTemplates,
          call_settings: callSettings,
          sms_settings: smsSettings,
          email_settings: emailSettings,
          dm_settings: dmSettings,
          global_settings: globalSettings,
          daily_limits: dailyLimits,
          compliance,
          sequences,
        }),
      });
      toast.success("All settings saved");
    } catch { toast.error("Failed to save"); }
    setSaving(false);
  }, [campaigns, callTemplates, smsTemplates, emailTemplates, dmTemplates, callSettings, smsSettings, emailSettings, dmSettings, globalSettings, dailyLimits, compliance, sequences]);

  /* ── Tab definitions ── */
  const TABS: { key: MainTab; label: string; icon: React.ReactNode }[] = [
    { key: "campaigns", label: "Campaigns", icon: <Megaphone size={14} /> },
    { key: "sequences", label: "Sequences", icon: <ListChecks size={14} /> },
    { key: "templates", label: "Templates", icon: <FileText size={14} /> },
    { key: "analytics", label: "Analytics", icon: <BarChart3 size={14} /> },
    { key: "settings", label: "Settings", icon: <Settings size={14} /> },
  ];

  return (
    <div className="fade-in space-y-4">
      <ErrorBoundary section="Outreach Hub">
      {/* ── Hero Header ── */}
      <PageHero
        icon={<Send size={22} />}
        title="Outreach Hub"
        subtitle="Build targeted outreach campaigns across email, SMS, calls & DMs — target B2B or B2C leads by industry, niche, and location."
        gradient="blue"
        actions={
          <button onClick={handleSave} disabled={saving}
            className="text-xs flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/15 border border-white/20 text-white font-medium hover:bg-white/25 transition-all disabled:opacity-40">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Save All
          </button>
        }
      />

      {/* ── How Outreach Works (collapsible explainer) ── */}
      <div className="card border-blue-400/20 bg-gradient-to-br from-blue-500/5 via-surface to-surface">
        <button
          onClick={toggleExplainer}
          className="w-full flex items-center justify-between text-left"
          aria-expanded={explainerOpen}
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-400/25 flex items-center justify-center text-blue-300">
              <Target size={14} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">How Outreach Works</h3>
              <p className="text-[10px] text-muted">Campaign-first workflow — from creation to replies, in 4 steps.</p>
            </div>
          </div>
          {explainerOpen
            ? <ChevronUp size={14} className="text-muted" />
            : <ChevronDown size={14} className="text-muted" />}
        </button>

        {explainerOpen && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3 relative">
            {[
              {
                n: 1,
                title: "Create a Campaign",
                desc: "Define your goal, audience, channels, and script templates — right here.",
                icon: <Megaphone size={14} />,
                href: "#campaigns",
                cta: "Show me",
                ctaOnClick: () => setTab("campaigns"),
                color: "text-blue-400 bg-blue-400/10 border-blue-400/25",
              },
              {
                n: 2,
                title: "Pick leads in Lead Finder",
                desc: "Scrape prospects and assign them to this campaign in one click.",
                icon: <Users size={14} />,
                href: "/dashboard/scraper",
                cta: "Open Lead Finder",
                color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/25",
              },
              {
                n: 3,
                title: "Schedule & launch",
                desc: "Pick timing (once, daily, weekdays, every other day), assign a team member, go live.",
                icon: <Clock size={14} />,
                href: "#sequences",
                cta: "Show me",
                ctaOnClick: () => setTab("sequences"),
                color: "text-amber-400 bg-amber-400/10 border-amber-400/25",
              },
              {
                n: 4,
                title: "Track in Outreach Logs",
                desc: "See replies, AI analysis, and follow-ups — all in one place.",
                icon: <BarChart3 size={14} />,
                href: "/dashboard/outreach-logs",
                cta: "Open Logs",
                color: "text-purple-400 bg-purple-400/10 border-purple-400/25",
              },
            ].map((step, idx, arr) => (
              <div key={step.n} className="relative">
                <div className="p-3 rounded-xl border border-border bg-surface-light/50 h-full flex flex-col">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-7 h-7 rounded-full border flex items-center justify-center text-[11px] font-bold ${step.color}`}>
                      {step.n}
                    </div>
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${step.color}`}>
                      {step.icon}
                    </div>
                  </div>
                  <p className="text-[12px] font-semibold text-foreground mb-1">{step.title}</p>
                  <p className="text-[10px] text-muted flex-1 leading-relaxed mb-2">{step.desc}</p>
                  {step.ctaOnClick ? (
                    <button
                      type="button"
                      onClick={step.ctaOnClick}
                      className="text-[10px] text-gold hover:underline flex items-center gap-1 w-fit"
                    >
                      {step.cta} <ChevronDown size={10} className="rotate-[-90deg]" />
                    </button>
                  ) : (
                    <a
                      href={step.href}
                      className="text-[10px] text-gold hover:underline flex items-center gap-1 w-fit"
                    >
                      {step.cta} <ChevronDown size={10} className="rotate-[-90deg]" />
                    </a>
                  )}
                </div>
                {/* Arrow between steps (desktop) */}
                {idx < arr.length - 1 && (
                  <div className="hidden md:flex absolute top-1/2 -right-2 -translate-y-1/2 w-4 h-4 rounded-full bg-surface border border-border items-center justify-center z-10 text-muted">
                    <ChevronDown size={10} className="rotate-[-90deg]" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Tabs (sticky) ── */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur flex gap-1 bg-surface rounded-xl p-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-xs rounded-lg flex items-center gap-2 transition-all whitespace-nowrap ${
              tab === t.key ? "bg-gold text-black font-medium" : "text-muted hover:text-foreground"
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  TAB 1: CAMPAIGNS                                          */}
      {/* ════════════════════════════════════════════════════════════ */}
      {tab === "campaigns" && (
        <div className="space-y-4">
          {/* Top row: Create button + Presets */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Megaphone size={14} className="text-gold" /> Active Campaigns
              {campaigns.length > 0 && <span className="text-[9px] px-2 py-0.5 rounded-full bg-gold/10 text-gold">{campaigns.length}</span>}
            </h2>
            <button onClick={() => setShowCampaignBuilder(!showCampaignBuilder)}
              className="btn-primary text-xs flex items-center gap-1.5">
              {showCampaignBuilder ? <X size={12} /> : <Plus size={12} />}
              {showCampaignBuilder ? "Cancel" : "Create Campaign"}
            </button>
          </div>

          {/* ── Campaign Builder ── */}
          {showCampaignBuilder && (
            <div className="card space-y-5">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Zap size={14} className="text-gold" /> New Campaign
              </h3>

              {/* Presets */}
              <div>
                <label className="text-[10px] text-muted block mb-2">Quick Start Presets</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {CAMPAIGN_PRESETS.map(preset => (
                    <button key={preset.name} onClick={() => {
                      setNewCampaign(prev => ({
                        ...prev,
                        name: preset.name,
                        targetMode: preset.targetMode,
                        industries: preset.industries,
                        channels: { ...preset.channels },
                        dailyTargets: { ...preset.dailyTargets },
                      }));
                      toast.success(`Loaded: ${preset.name}`);
                    }}
                      className="text-left p-2.5 rounded-xl border border-border/50 hover:border-gold/20 hover:bg-gold/5 transition-all group">
                      <p className="text-[10px] font-semibold group-hover:text-gold">{preset.name}</p>
                      <p className="text-[9px] text-muted mt-0.5">{preset.description}</p>
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-surface-light text-muted mt-1 inline-block">{preset.targetMode.toUpperCase()}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="text-[10px] text-muted block mb-1">Campaign Name</label>
                <input value={newCampaign.name} onChange={e => setNewCampaign(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g., Q2 Restaurant Push"
                  className="input w-full text-xs" />
              </div>

              {/* B2B / B2C toggle */}
              <div>
                <label className="text-[10px] text-muted block mb-2">Target Mode</label>
                <div className="flex gap-2">
                  {(["b2b", "b2c"] as TargetMode[]).map(m => (
                    <button key={m} onClick={() => setNewCampaign(p => ({ ...p, targetMode: m }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${
                        newCampaign.targetMode === m ? "bg-gold/10 text-gold border-gold/20" : "text-muted border-border/50 hover:border-border"
                      }`}>{m.toUpperCase()}</button>
                  ))}
                </div>
              </div>

              {/* Industry multi-select */}
              <div>
                <label className="text-[10px] text-muted block mb-2">Target Industries</label>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-1.5">
                  {B2B_INDUSTRIES.map(ind => {
                    const Icon = ind.icon;
                    const selected = newCampaign.industries.includes(ind.id);
                    return (
                      <button key={ind.id} onClick={() => setNewCampaign(p => ({ ...p, industries: toggleArray(p.industries, ind.id) }))}
                        className={`flex items-center gap-1.5 p-2 rounded-lg text-[10px] border transition-all ${
                          selected ? "bg-gold/10 text-gold border-gold/20" : "text-muted border-border/30 hover:border-border"
                        }`}>
                        <Icon size={12} /> {ind.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Channels */}
              <div>
                <label className="text-[10px] text-muted block mb-2">Channels</label>
                <div className="flex gap-3">
                  {([
                    { key: "email" as const, label: "Email", icon: <Mail size={14} /> },
                    { key: "sms" as const, label: "SMS", icon: <Smartphone size={14} /> },
                    { key: "calls" as const, label: "Calls", icon: <PhoneCall size={14} /> },
                    { key: "dms" as const, label: "DMs", icon: <MessageSquare size={14} /> },
                  ]).map(ch => (
                    <button key={ch.key} onClick={() => setNewCampaign(p => ({ ...p, channels: { ...p.channels, [ch.key]: !p.channels[ch.key] } }))}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border transition-all ${
                        newCampaign.channels[ch.key] ? "bg-gold/10 text-gold border-gold/20" : "text-muted border-border/50"
                      }`}>
                      {ch.icon} {ch.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Daily targets per channel */}
              <div>
                <label className="text-[10px] text-muted block mb-2">Daily Targets per Channel</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(["email", "sms", "calls", "dms"] as const).map(ch => (
                    <div key={ch} className={`space-y-1 ${!newCampaign.channels[ch] ? "opacity-30 pointer-events-none" : ""}`}>
                      <label className="text-[9px] text-muted capitalize">{ch}</label>
                      <input type="number" min={0} max={100}
                        value={newCampaign.dailyTargets[ch]}
                        onChange={e => setNewCampaign(p => ({ ...p, dailyTargets: { ...p.dailyTargets, [ch]: Number(e.target.value) } }))}
                        className="input w-full text-xs" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Sequence picker */}
              <div>
                <label className="text-[10px] text-muted block mb-2">Outreach Sequence</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {sequences.map(seq => (
                    <button key={seq.id} onClick={() => setNewCampaign(p => ({ ...p, sequenceId: seq.id }))}
                      className={`text-left p-2.5 rounded-xl border transition-all ${
                        newCampaign.sequenceId === seq.id ? "bg-gold/10 border-gold/20" : "border-border/50 hover:border-border"
                      }`}>
                      <p className={`text-[10px] font-semibold ${newCampaign.sequenceId === seq.id ? "text-gold" : ""}`}>{seq.name}</p>
                      <p className="text-[9px] text-muted mt-0.5">{seq.steps.length} steps</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Create button */}
              <div className="flex justify-end">
                <button onClick={createCampaign} className="btn-primary text-xs flex items-center gap-1.5">
                  <Plus size={12} /> Create Campaign
                </button>
              </div>
            </div>
          )}

          {/* ── Campaign List ── */}
          {campaigns.length === 0 && !showCampaignBuilder && (
            <div className="card">
              <EmptyState
                type="no-campaigns"
                title="No campaigns yet"
                description="Create your first outreach campaign to start reaching leads across email, SMS, calls, and social DMs."
                action={
                  <button onClick={() => setShowCampaignBuilder(true)}
                    className="btn-primary text-xs flex items-center gap-1.5">
                    <Plus size={12} /> Create Your First Campaign
                  </button>
                }
              />
            </div>
          )}

          {campaigns.map(campaign => (
            <div key={campaign.id} className="card space-y-3">
              {/* Campaign header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    campaign.status === "active" ? "bg-green-500/10" : campaign.status === "paused" ? "bg-yellow-500/10" : "bg-surface-light"
                  }`}>
                    <Megaphone size={14} className={
                      campaign.status === "active" ? "text-green-400" : campaign.status === "paused" ? "text-yellow-400" : "text-muted"
                    } />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold">{campaign.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[9px] px-2 py-0.5 rounded-full ${
                        campaign.status === "active" ? "bg-green-500/10 text-green-400" : campaign.status === "paused" ? "bg-yellow-500/10 text-yellow-400" : "bg-surface-light text-muted"
                      }`}>{campaign.status}</span>
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-surface-light text-muted">{campaign.targetMode.toUpperCase()}</span>
                      {campaign.industries.map(ind => (
                        <span key={ind} className="text-[8px] text-muted">{B2B_INDUSTRIES.find(i => i.id === ind)?.label || ind}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleCampaignStatus(campaign.id)}
                    className={`text-[10px] px-3 py-1.5 rounded-lg flex items-center gap-1 border ${
                      campaign.status === "active"
                        ? "border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/10"
                        : "border-green-500/20 text-green-400 hover:bg-green-500/10"
                    }`}>
                    {campaign.status === "active" ? <><Pause size={10} /> Pause</> : <><Play size={10} /> Start</>}
                  </button>
                  <button onClick={() => deleteCampaign(campaign.id)}
                    aria-label={`Delete campaign: ${campaign.name}`}
                    className="text-[10px] px-2 py-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10">
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>

              {/* Daily progress bars */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(["email", "sms", "calls", "dms"] as const).map(ch => {
                  if (!campaign.channels[ch]) return null;
                  const progress = campaign.dailyTargets[ch] > 0 ? (campaign.todayProgress[ch] / campaign.dailyTargets[ch]) * 100 : 0;
                  return (
                    <div key={ch} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-muted capitalize flex items-center gap-1">{channelIcon(ch === "calls" ? "call" : ch, 10)} {ch}</span>
                        <span className="text-[9px] font-mono">{campaign.todayProgress[ch]}/{campaign.dailyTargets[ch]}</span>
                      </div>
                      <div className="h-1.5 bg-surface-light rounded-full overflow-hidden">
                        <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Stats row */}
              <div className="flex gap-4 pt-2 border-t border-border/20">
                {([
                  { label: "Leads", value: campaign.stats.leads },
                  { label: "Contacted", value: campaign.stats.contacted },
                  { label: "Replied", value: campaign.stats.replied },
                  { label: "Booked", value: campaign.stats.booked },
                  { label: "Converted", value: campaign.stats.converted },
                ]).map(s => (
                  <div key={s.label} className="text-center">
                    <p className="text-sm font-semibold">{s.value}</p>
                    <p className="text-[9px] text-muted">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  TAB 2: SEQUENCES                                          */}
      {/* ════════════════════════════════════════════════════════════ */}
      {tab === "sequences" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <ListChecks size={14} className="text-gold" /> Outreach Sequences
            </h2>
            <button onClick={() => setShowCustomBuilder(!showCustomBuilder)}
              className="text-[10px] px-3 py-1.5 rounded-lg border border-dashed border-border text-muted hover:text-gold hover:border-gold/20 flex items-center gap-1">
              {showCustomBuilder ? <><X size={10} /> Cancel</> : <><Plus size={10} /> Build Custom Sequence</>}
            </button>
          </div>

          {/* Pre-built sequences */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sequences.map(seq => (
              <button key={seq.id} onClick={() => setActiveSequence(seq.id)}
                className={`text-left p-4 rounded-xl border transition-all ${
                  activeSequence === seq.id ? "bg-gold/10 border-gold/20" : "border-border/50 hover:border-border bg-surface-light/30"
                }`}>
                <div className="flex items-center justify-between mb-1">
                  <h3 className={`text-xs font-semibold ${activeSequence === seq.id ? "text-gold" : ""}`}>{seq.name}</h3>
                  {activeSequence === seq.id && <CircleDot size={12} className="text-gold" />}
                </div>
                <p className="text-[9px] text-muted mb-2">{seq.description}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-surface-light text-muted">{seq.targetMode === "both" ? "B2B & B2C" : seq.targetMode.toUpperCase()}</span>
                  <span className="text-[8px] text-muted">{seq.steps.length} steps</span>
                  <div className="flex items-center gap-0.5 ml-auto">
                    {Array.from(new Set(seq.steps.map(s => s.channel))).map(ch => (
                      <span key={ch} className={channelColor(ch)}>{channelIcon(ch, 10)}</span>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Active Sequence Timeline */}
          {activeSequence && (
            <div className="card space-y-4">
              <h3 className="text-xs font-semibold flex items-center gap-2">
                <Activity size={12} className="text-gold" /> Sequence Timeline: {sequences.find(s => s.id === activeSequence)?.name}
              </h3>
              <div className="relative pl-6">
                {/* Vertical line */}
                <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border/50" />
                {sequences.find(s => s.id === activeSequence)?.steps.map((step, idx) => (
                  <div key={step.id} className="relative flex items-start gap-4 mb-4 last:mb-0">
                    {/* Dot */}
                    <div className={`absolute left-[-17px] top-1 w-5 h-5 rounded-full border-2 flex items-center justify-center bg-surface ${
                      idx === 0 ? "border-gold" : "border-border/50"
                    }`}>
                      <span className={`text-[8px] font-bold ${idx === 0 ? "text-gold" : "text-muted"}`}>{step.day}</span>
                    </div>
                    {/* Content */}
                    <div className="flex-1 bg-surface-light/50 rounded-lg p-3 border border-border/20">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`${channelColor(step.channel)}`}>{channelIcon(step.channel, 12)}</span>
                        <span className="text-[10px] font-semibold capitalize">{step.channel}</span>
                        <span className="text-[8px] px-1.5 py-0.5 rounded bg-surface-light text-muted">Day {step.day}</span>
                        <span className="text-[8px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 ml-auto">{conditionLabel(step.condition)}</span>
                      </div>
                      <p className="text-[10px] text-muted">{step.action}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom Sequence Builder */}
          {showCustomBuilder && (
            <div className="card space-y-4">
              <h3 className="text-xs font-semibold flex items-center gap-2">
                <Zap size={12} className="text-gold" /> Build Custom Sequence
              </h3>
              <div>
                <label className="text-[10px] text-muted block mb-1">Sequence Name</label>
                <input value={customSeqName} onChange={e => setCustomSeqName(e.target.value)}
                  placeholder="e.g., My Custom Flow" className="input w-full text-xs" />
              </div>

              {/* Steps */}
              {customSteps.map((step, idx) => (
                <div key={step.id} className="flex items-center gap-2 bg-surface-light/50 rounded-lg p-3 border border-border/20">
                  <span className="text-[10px] font-bold text-gold w-6">#{idx + 1}</span>
                  <div>
                    <label className="text-[9px] text-muted">Day</label>
                    <input type="number" min={1} max={30} value={step.day}
                      onChange={e => setCustomSteps(prev => prev.map((s, i) => i === idx ? { ...s, day: Number(e.target.value) } : s))}
                      className="input text-xs w-14" />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted">Channel</label>
                    <select value={step.channel}
                      onChange={e => setCustomSteps(prev => prev.map((s, i) => i === idx ? { ...s, channel: e.target.value as SequenceStep["channel"] } : s))}
                      className="input text-xs">
                      <option value="email">Email</option>
                      <option value="sms">SMS</option>
                      <option value="call">Call</option>
                      <option value="dm">DM</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-[9px] text-muted">Action</label>
                    <input value={step.action} placeholder="Describe the action..."
                      onChange={e => setCustomSteps(prev => prev.map((s, i) => i === idx ? { ...s, action: e.target.value } : s))}
                      className="input w-full text-xs" />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted">Condition</label>
                    <select value={step.condition}
                      onChange={e => setCustomSteps(prev => prev.map((s, i) => i === idx ? { ...s, condition: e.target.value as SequenceStep["condition"] } : s))}
                      className="input text-xs">
                      <option value="always">Always</option>
                      <option value="no_reply">If no reply</option>
                      <option value="replied">If replied</option>
                      <option value="opened">If opened</option>
                    </select>
                  </div>
                  <button onClick={() => setCustomSteps(prev => prev.filter((_, i) => i !== idx))}
                    aria-label="Remove this step"
                    className="p-1 hover:bg-red-500/10 rounded mt-3">
                    <Trash2 size={12} className="text-muted hover:text-red-400" />
                  </button>
                </div>
              ))}

              <div className="flex items-center gap-2">
                <button onClick={addCustomStep}
                  className="text-[10px] px-3 py-1.5 rounded-lg border border-dashed border-border text-muted hover:text-gold hover:border-gold/20 flex items-center gap-1">
                  <Plus size={10} /> Add Step
                </button>
                <button onClick={saveCustomSequence}
                  className="btn-primary text-xs flex items-center gap-1.5 ml-auto">
                  <Save size={12} /> Save Sequence
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  TAB 3: TEMPLATES                                          */}
      {/* ════════════════════════════════════════════════════════════ */}
      {tab === "templates" && (
        <div className="space-y-4">
          {/* Template sub-tabs */}
          <div className="flex items-center gap-4">
            <div className="flex gap-1 bg-surface rounded-xl p-1">
              {([
                { key: "calls" as TemplateSubTab, label: "Calls", icon: <PhoneCall size={12} />, count: callTemplates.length },
                { key: "sms" as TemplateSubTab, label: "SMS", icon: <Smartphone size={12} />, count: smsTemplates.length },
                { key: "email" as TemplateSubTab, label: "Email", icon: <Mail size={12} />, count: emailTemplates.length },
                { key: "dms" as TemplateSubTab, label: "DMs", icon: <MessageSquare size={12} />, count: dmTemplates.length },
              ]).map(t => (
                <button key={t.key} onClick={() => setTemplateSubTab(t.key)}
                  className={`px-3 py-2 text-[11px] rounded-lg flex items-center gap-1.5 transition-all ${
                    templateSubTab === t.key ? "bg-gold text-black font-medium" : "text-muted hover:text-foreground"
                  }`}>
                  {t.icon} {t.label}
                  <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${templateSubTab === t.key ? "bg-black/20" : "bg-white/5"}`}>{t.count}</span>
                </button>
              ))}
            </div>
            <div className="ml-auto flex gap-1">
              {(["all", "b2b", "b2c"] as const).map(f => (
                <button key={f} onClick={() => setTemplateFilter(f)}
                  className={`text-[9px] px-2.5 py-1 rounded-lg border transition-all uppercase ${
                    templateFilter === f ? "bg-gold/10 text-gold border-gold/20" : "text-muted border-border/30"
                  }`}>{f}</button>
              ))}
            </div>
          </div>

          {/* ── Calls Templates ── */}
          {templateSubTab === "calls" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <PhoneCall size={14} className="text-emerald-400" /> Call Scripts &amp; Prompts
                  </h2>
                  <button onClick={() => addTemplate("calls")} className="text-[10px] px-3 py-1.5 rounded-lg border border-dashed border-border text-muted hover:text-gold hover:border-gold/20 flex items-center gap-1">
                    <Plus size={10} /> Add Script
                  </button>
                </div>
                <p className="text-[10px] text-muted">These scripts are sent as system prompts to the ElevenLabs AI agent. Edit them to change how the AI speaks on calls.</p>
                {callTemplates.map(t => (
                  <TemplateCard key={t.id} template={t} context="AI cold call script"
                    onChange={u => updateTemplate("calls", t.id, u)}
                    onDelete={() => deleteTemplate("calls", t.id)} />
                ))}
              </div>
              <div className="space-y-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Settings size={14} className="text-muted" /> Call Settings
                </h2>
                <div className="card space-y-4">
                  <div>
                    <label className="text-[10px] text-muted block mb-1">Agent Name</label>
                    <input value={callSettings.agentName} onChange={e => setCallSettings(p => ({ ...p, agentName: e.target.value }))}
                      className="input w-full text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block mb-1">First Message</label>
                    <textarea value={callSettings.firstMessage} onChange={e => setCallSettings(p => ({ ...p, firstMessage: e.target.value }))}
                      rows={3} className="input w-full text-xs resize-y" />
                    <div className="flex justify-end mt-1">
                      <AIEnhanceButton value={callSettings.firstMessage} context="AI call opening message"
                        onResult={v => setCallSettings(p => ({ ...p, firstMessage: v }))} />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block mb-1">Max Call Duration</label>
                    <div className="flex items-center gap-2">
                      <input type="range" min={30} max={300} step={30} value={callSettings.maxDuration}
                        onChange={e => setCallSettings(p => ({ ...p, maxDuration: Number(e.target.value) }))}
                        className="flex-1 accent-gold" />
                      <span className="text-xs font-mono w-12 text-right">{callSettings.maxDuration}s</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs">Voicemail Detection</span>
                    <button onClick={() => setCallSettings(p => ({ ...p, voicemailDetection: !p.voicemailDetection }))}
                      className={`${callSettings.voicemailDetection ? "text-gold" : "text-muted"}`}>
                      {callSettings.voicemailDetection ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs">Leave Voicemail</span>
                    <button onClick={() => setCallSettings(p => ({ ...p, enableVoicemail: !p.enableVoicemail }))}
                      className={`${callSettings.enableVoicemail ? "text-gold" : "text-muted"}`}>
                      {callSettings.enableVoicemail ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    </button>
                  </div>
                </div>
                {/* Preview */}
                <div className="card space-y-3">
                  <h3 className="text-xs font-semibold flex items-center gap-2"><Eye size={12} /> Live Preview</h3>
                  <div className="space-y-2">
                    <input placeholder="Business name..." value={previewVars.business_name || ""}
                      onChange={e => setPreviewVars(p => ({ ...p, business_name: e.target.value }))}
                      className="input w-full text-[10px]" />
                    <input placeholder="Industry..." value={previewVars.industry || ""}
                      onChange={e => setPreviewVars(p => ({ ...p, industry: e.target.value }))}
                      className="input w-full text-[10px]" />
                  </div>
                  {callTemplates[0] && (
                    <div className="bg-surface-light rounded-lg p-2.5 text-[10px] whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto">
                      {renderPreview(callTemplates[0])}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── SMS Templates ── */}
          {templateSubTab === "sms" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Smartphone size={14} className="text-green-400" /> SMS Templates
                  </h2>
                  <button onClick={() => addTemplate("sms")} className="text-[10px] px-3 py-1.5 rounded-lg border border-dashed border-border text-muted hover:text-gold hover:border-gold/20 flex items-center gap-1">
                    <Plus size={10} /> Add Template
                  </button>
                </div>
                <p className="text-[10px] text-muted">Templates are auto-sent based on triggers. Variables like {`{{name}}`} are replaced with lead data. AI personalization rewrites each message to feel unique.</p>
                {smsTemplates.map(t => (
                  <TemplateCard key={t.id} template={t} context="SMS outreach message"
                    onChange={u => updateTemplate("sms", t.id, u)}
                    onDelete={() => deleteTemplate("sms", t.id)} />
                ))}
              </div>
              <div className="space-y-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Settings size={14} className="text-muted" /> SMS Settings
                </h2>
                <div className="card space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs">AI Personalization</span>
                    <button onClick={() => setSmsSettings(p => ({ ...p, aiPersonalize: !p.aiPersonalize }))}
                      className={`${smsSettings.aiPersonalize ? "text-gold" : "text-muted"}`}>
                      {smsSettings.aiPersonalize ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs">Auto-Reply on Response</span>
                    <button onClick={() => setSmsSettings(p => ({ ...p, autoReply: !p.autoReply }))}
                      className={`${smsSettings.autoReply ? "text-gold" : "text-muted"}`}>
                      {smsSettings.autoReply ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    </button>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block mb-1">Max Characters</label>
                    <input type="number" value={smsSettings.maxLength} min={50} max={320}
                      onChange={e => setSmsSettings(p => ({ ...p, maxLength: Number(e.target.value) }))}
                      className="input w-full text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block mb-1">Send Window</label>
                    <div className="flex items-center gap-2">
                      <input type="time" value={smsSettings.sendWindow.start}
                        onChange={e => setSmsSettings(p => ({ ...p, sendWindow: { ...p.sendWindow, start: e.target.value } }))}
                        className="input text-xs flex-1" />
                      <span className="text-[10px] text-muted">to</span>
                      <input type="time" value={smsSettings.sendWindow.end}
                        onChange={e => setSmsSettings(p => ({ ...p, sendWindow: { ...p.sendWindow, end: e.target.value } }))}
                        className="input text-xs flex-1" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block mb-1">Max Follow-ups</label>
                    <input type="number" value={smsSettings.maxFollowups} min={0} max={10}
                      onChange={e => setSmsSettings(p => ({ ...p, maxFollowups: Number(e.target.value) }))}
                      className="input w-full text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block mb-1">Follow-up Days</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 5, 7, 14].map(d => (
                        <button key={d} onClick={() => {
                          setSmsSettings(p => ({
                            ...p,
                            followupDays: p.followupDays.includes(d)
                              ? p.followupDays.filter(x => x !== d)
                              : [...p.followupDays, d].sort((a, b) => a - b),
                          }));
                        }} className={`text-[9px] px-2 py-1 rounded-lg border ${
                          smsSettings.followupDays.includes(d) ? "bg-gold/10 text-gold border-gold/20" : "text-muted border-white/[0.06]"
                        }`}>Day {d}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Email Templates ── */}
          {templateSubTab === "email" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Mail size={14} className="text-gold" /> Email Templates
                  </h2>
                  <button onClick={() => addTemplate("email")} className="text-[10px] px-3 py-1.5 rounded-lg border border-dashed border-border text-muted hover:text-gold hover:border-gold/20 flex items-center gap-1">
                    <Plus size={10} /> Add Template
                  </button>
                </div>
                <p className="text-[10px] text-muted">Email templates support AI personalization. Claude generates unique emails for each lead based on these templates. Include the Subject: line at the top.</p>
                {emailTemplates.map(t => (
                  <TemplateCard key={t.id} template={t} context="cold outreach email"
                    onChange={u => updateTemplate("email", t.id, u)}
                    onDelete={() => deleteTemplate("email", t.id)} />
                ))}
              </div>
              <div className="space-y-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Settings size={14} className="text-muted" /> Email Settings
                </h2>
                <div className="card space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs">AI Personalization</span>
                    <button onClick={() => setEmailSettings(p => ({ ...p, aiPersonalize: !p.aiPersonalize }))}
                      className={`${emailSettings.aiPersonalize ? "text-gold" : "text-muted"}`}>
                      {emailSettings.aiPersonalize ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    </button>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block mb-1">From Name</label>
                    <input value={emailSettings.fromName} onChange={e => setEmailSettings(p => ({ ...p, fromName: e.target.value }))}
                      className="input w-full text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block mb-1">Email Signature</label>
                    <textarea value={emailSettings.signature} onChange={e => setEmailSettings(p => ({ ...p, signature: e.target.value }))}
                      rows={3} className="input w-full text-xs resize-y" />
                    <div className="flex justify-end mt-1">
                      <AIEnhanceButton value={emailSettings.signature} context="email signature"
                        onResult={v => setEmailSettings(p => ({ ...p, signature: v }))} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs">Track Opens</span>
                    <button onClick={() => setEmailSettings(p => ({ ...p, trackOpens: !p.trackOpens }))}
                      className={`${emailSettings.trackOpens ? "text-gold" : "text-muted"}`}>
                      {emailSettings.trackOpens ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    </button>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block mb-1">Max Emails / Day</label>
                    <input type="number" value={emailSettings.maxPerDay} min={1} max={500}
                      onChange={e => setEmailSettings(p => ({ ...p, maxPerDay: Number(e.target.value) }))}
                      className="input w-full text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block mb-1">Delay Between Sends</label>
                    <div className="flex items-center gap-2">
                      <input type="range" min={0} max={600} step={30} value={emailSettings.sendDelay}
                        onChange={e => setEmailSettings(p => ({ ...p, sendDelay: Number(e.target.value) }))}
                        className="flex-1 accent-gold" />
                      <span className="text-xs font-mono w-12 text-right">{emailSettings.sendDelay}ms</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── DM Templates ── */}
          {templateSubTab === "dms" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <MessageSquare size={14} className="text-blue-400" /> Social DM Templates
                  </h2>
                  <button onClick={() => addTemplate("dms")} className="text-[10px] px-3 py-1.5 rounded-lg border border-dashed border-border text-muted hover:text-gold hover:border-gold/20 flex items-center gap-1">
                    <Plus size={10} /> Add Template
                  </button>
                </div>
                <p className="text-[10px] text-muted">DM templates per platform. Each template can be toggled on/off and customized. AI will personalize based on the lead&apos;s profile.</p>
                <div className="flex gap-1">
                  {[
                    { id: "all", label: "All", icon: <Globe size={11} /> },
                    { id: "instagram", label: "Instagram", icon: <InstagramIcon size={12} /> },
                    { id: "facebook", label: "Facebook", icon: <FacebookIcon size={12} /> },
                    { id: "linkedin", label: "LinkedIn", icon: <LinkedInIcon size={12} /> },
                    { id: "tiktok", label: "TikTok", icon: <TikTokIcon size={12} /> },
                  ].map(p => (
                    <button key={p.id} className="text-[10px] px-2.5 py-1.5 rounded-lg flex items-center gap-1 text-muted border border-white/[0.06] hover:border-white/10">
                      {p.icon} {p.label}
                    </button>
                  ))}
                </div>
                {dmTemplates.map(t => (
                  <TemplateCard key={t.id} template={t} context="social media DM outreach message"
                    onChange={u => updateTemplate("dms", t.id, u)}
                    onDelete={() => deleteTemplate("dms", t.id)} />
                ))}
              </div>
              <div className="space-y-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Settings size={14} className="text-muted" /> DM Settings
                </h2>
                <div className="card space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs">AI Personalization</span>
                    <button onClick={() => setDmSettings(p => ({ ...p, aiPersonalize: !p.aiPersonalize }))}
                      className={`${dmSettings.aiPersonalize ? "text-gold" : "text-muted"}`}>
                      {dmSettings.aiPersonalize ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs">Auto Follow-up</span>
                    <button onClick={() => setDmSettings(p => ({ ...p, autoFollowup: !p.autoFollowup }))}
                      className={`${dmSettings.autoFollowup ? "text-gold" : "text-muted"}`}>
                      {dmSettings.autoFollowup ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    </button>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block mb-2">Active Platforms</label>
                    <div className="space-y-2">
                      {([
                        { key: "instagram" as const, label: "Instagram", icon: <InstagramIcon size={14} /> },
                        { key: "facebook" as const, label: "Facebook", icon: <FacebookIcon size={14} /> },
                        { key: "linkedin" as const, label: "LinkedIn", icon: <LinkedInIcon size={14} /> },
                        { key: "tiktok" as const, label: "TikTok", icon: <TikTokIcon size={14} /> },
                      ]).map(p => (
                        <div key={p.key} className="flex items-center gap-2 p-2 rounded-lg bg-surface-light">
                          <button onClick={() => setDmSettings(prev => ({
                            ...prev,
                            platforms: { ...prev.platforms, [p.key]: !prev.platforms[p.key] }
                          }))} className={`${dmSettings.platforms[p.key] ? "text-gold" : "text-muted"}`}>
                            {dmSettings.platforms[p.key] ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                          </button>
                          {p.icon}
                          <span className="text-xs">{p.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block mb-1">Max DMs / Day</label>
                    <input type="number" value={dmSettings.maxPerDay} min={1} max={100}
                      onChange={e => setDmSettings(p => ({ ...p, maxPerDay: Number(e.target.value) }))}
                      className="input w-full text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block mb-1">Send Window</label>
                    <div className="flex items-center gap-2">
                      <input type="time" value={dmSettings.sendWindow.start}
                        onChange={e => setDmSettings(p => ({ ...p, sendWindow: { ...p.sendWindow, start: e.target.value } }))}
                        className="input text-xs flex-1" />
                      <span className="text-[10px] text-muted">to</span>
                      <input type="time" value={dmSettings.sendWindow.end}
                        onChange={e => setDmSettings(p => ({ ...p, sendWindow: { ...p.sendWindow, end: e.target.value } }))}
                        className="input text-xs flex-1" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  TAB 4: ANALYTICS                                          */}
      {/* ════════════════════════════════════════════════════════════ */}
      {tab === "analytics" && (
        <div className="space-y-4">
          {/* Stats cards row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Total Leads", value: 0, change: "0%" },
              { label: "Contacted", value: 0, change: "0%" },
              { label: "Replied", value: 0, change: "0%" },
              { label: "Booked", value: 0, change: "0%" },
              { label: "Converted", value: 0, change: "0%" },
            ].map(stat => (
              <div key={stat.label} className="card p-4">
                <p className="text-[10px] text-muted mb-1">{stat.label}</p>
                <p className="text-xl font-bold">{stat.value}</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-surface-light text-muted">{stat.change}</span>
                  <span className="text-[9px] text-muted">vs last period</span>
                </div>
              </div>
            ))}
          </div>

          {/* Channel Performance */}
          <div className="card space-y-4">
            <h3 className="text-xs font-semibold flex items-center gap-2">
              <BarChart3 size={12} className="text-gold" /> Channel Performance
            </h3>
            <div className="space-y-3">
              {[
                { channel: "Email", icon: <Mail size={14} />, color: "bg-gold", sent: 0, opened: 0, replied: 0 },
                { channel: "SMS", icon: <Smartphone size={14} />, color: "bg-green-400", sent: 0, opened: 0, replied: 0 },
                { channel: "Calls", icon: <PhoneCall size={14} />, color: "bg-emerald-400", sent: 0, opened: 0, replied: 0 },
                { channel: "DMs", icon: <MessageSquare size={14} />, color: "bg-blue-400", sent: 0, opened: 0, replied: 0 },
              ].map(ch => (
                <div key={ch.channel} className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    {ch.icon}
                    <span className="font-medium w-16">{ch.channel}</span>
                    <span className="text-[9px] text-muted">Sent: {ch.sent}</span>
                    <span className="text-[9px] text-muted ml-3">Opened: {ch.opened}</span>
                    <span className="text-[9px] text-muted ml-3">Replied: {ch.replied}</span>
                  </div>
                  <div className="flex gap-1 h-2">
                    <div className={`${ch.color} rounded-full`} style={{ width: "0%" }} />
                    <div className={`${ch.color}/50 rounded-full`} style={{ width: "0%" }} />
                    <div className={`${ch.color}/25 rounded-full`} style={{ width: "0%" }} />
                    <div className="flex-1 bg-surface-light rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Response Rate Heatmap */}
            <div className="card space-y-3">
              <h3 className="text-xs font-semibold flex items-center gap-2">
                <Clock size={12} className="text-muted" /> Response Rate by Day
              </h3>
              <div className="space-y-1">
                <div className="flex gap-1 items-center mb-2">
                  <span className="text-[9px] text-muted w-12"></span>
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                    <span key={d} className="text-[8px] text-muted flex-1 text-center">{d}</span>
                  ))}
                </div>
                {["Email", "SMS", "Call", "DM"].map(ch => (
                  <div key={ch} className="flex gap-1 items-center">
                    <span className="text-[9px] text-muted w-12">{ch}</span>
                    {Array.from({ length: 7 }).map((_, i) => (
                      <div key={i} className="flex-1 h-6 rounded bg-surface-light/50 border border-border/20" />
                    ))}
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-muted text-center">No data yet</p>
            </div>

            {/* Conversion Funnel */}
            <div className="card space-y-3">
              <h3 className="text-xs font-semibold flex items-center gap-2">
                <Target size={12} className="text-gold" /> Conversion Funnel
              </h3>
              <div className="space-y-2">
                {[
                  { stage: "Leads Found", value: 0, width: "100%" },
                  { stage: "Contacted", value: 0, width: "80%" },
                  { stage: "Replied", value: 0, width: "60%" },
                  { stage: "Booked", value: 0, width: "40%" },
                  { stage: "Converted", value: 0, width: "20%" },
                ].map(s => (
                  <div key={s.stage} className="flex items-center gap-3">
                    <span className="text-[10px] text-muted w-20">{s.stage}</span>
                    <div className="flex-1 h-6 bg-surface-light rounded-lg overflow-hidden flex items-center" style={{ maxWidth: s.width }}>
                      <div className="h-full bg-gold/20 w-0 rounded-lg" />
                      <span className="text-[10px] font-mono ml-2">{s.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Best Performing */}
          <div className="card p-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center mx-auto mb-3">
              <Star size={20} className="text-gold" />
            </div>
            <h3 className="text-sm font-semibold mb-1">Best Performing</h3>
            <p className="text-[11px] text-muted">No data yet — launch your first campaign to see which channels and sequences perform best.</p>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  TAB 5: SETTINGS                                           */}
      {/* ════════════════════════════════════════════════════════════ */}
      {tab === "settings" && (
        <div className="max-w-2xl space-y-4">
          {/* Global AI Settings */}
          <div className="card space-y-5">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles size={14} className="text-gold" /> Global AI Settings
            </h2>
            <p className="text-[10px] text-muted">These settings apply across all outreach channels. They control how the AI generates and personalizes messages.</p>

            <div>
              <label className="text-xs font-medium block mb-2">Communication Tone</label>
              <div className="flex gap-2 flex-wrap">
                {["friendly", "professional", "casual", "bold", "empathetic", "authoritative"].map(t => (
                  <button key={t} onClick={() => setGlobalSettings(p => ({ ...p, tone: t }))}
                    className={`text-[10px] px-3 py-1.5 rounded-lg capitalize border ${
                      globalSettings.tone === t ? "bg-gold/10 text-gold border-gold/20" : "text-muted border-white/[0.06] hover:border-white/10"
                    }`}>{t}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium block mb-2">Sales Aggressiveness</label>
              <div className="flex gap-2">
                {[
                  { key: "soft", label: "Soft Sell", desc: "Helpful, no pressure" },
                  { key: "medium", label: "Medium", desc: "Clear CTA, light urgency" },
                  { key: "aggressive", label: "Hard Sell", desc: "Strong push, urgency" },
                ].map(a => (
                  <button key={a.key} onClick={() => setGlobalSettings(p => ({ ...p, aggressiveness: a.key }))}
                    className={`flex-1 text-left p-2.5 rounded-xl border transition-all ${
                      globalSettings.aggressiveness === a.key ? "bg-gold/10 border-gold/20" : "border-white/[0.06] hover:border-white/10"
                    }`}>
                    <p className={`text-xs font-semibold ${globalSettings.aggressiveness === a.key ? "text-gold" : ""}`}>{a.label}</p>
                    <p className="text-[9px] text-muted">{a.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium block mb-1">Brand Voice</label>
              <p className="text-[9px] text-muted mb-2">Describe your agency&apos;s voice and personality. This is used as context for all AI-generated messages.</p>
              <textarea value={globalSettings.brandVoice}
                onChange={e => setGlobalSettings(p => ({ ...p, brandVoice: e.target.value }))}
                rows={4} className="input w-full text-xs resize-y" />
              <div className="flex justify-end mt-1">
                <AIEnhanceButton value={globalSettings.brandVoice} context="brand voice description for an agency"
                  onResult={v => setGlobalSettings(p => ({ ...p, brandVoice: v }))} />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium block mb-1">Custom AI Instructions</label>
              <p className="text-[9px] text-muted mb-2">Additional instructions for the AI across all channels. E.g., &quot;Always mention our free consultation&quot; or &quot;Never use the word &apos;cheap&apos;&quot;.</p>
              <textarea value={globalSettings.customInstructions}
                onChange={e => setGlobalSettings(p => ({ ...p, customInstructions: e.target.value }))}
                rows={4} className="input w-full text-xs resize-y"
                placeholder="Add any custom rules or instructions for the AI..." />
              <div className="flex justify-end mt-1">
                <AIEnhanceButton value={globalSettings.customInstructions || "custom AI instructions for outreach"} context="AI behavior instructions"
                  onResult={v => setGlobalSettings(p => ({ ...p, customInstructions: v }))} />
              </div>
            </div>
          </div>

          {/* Daily Limits */}
          <div className="card space-y-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <AlertCircle size={14} className="text-gold" /> Daily Limits
            </h2>
            <p className="text-[10px] text-muted">Maximum number of outreach actions per day across all campaigns.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] text-muted block mb-1 flex items-center gap-1"><Mail size={10} /> Max Emails</label>
                <input type="number" value={dailyLimits.email} min={1} max={500}
                  onChange={e => setDailyLimits(p => ({ ...p, email: Number(e.target.value) }))}
                  className="input w-full text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-muted block mb-1 flex items-center gap-1"><Smartphone size={10} /> Max SMS</label>
                <input type="number" value={dailyLimits.sms} min={1} max={500}
                  onChange={e => setDailyLimits(p => ({ ...p, sms: Number(e.target.value) }))}
                  className="input w-full text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-muted block mb-1 flex items-center gap-1"><PhoneCall size={10} /> Max Calls</label>
                <input type="number" value={dailyLimits.calls} min={1} max={200}
                  onChange={e => setDailyLimits(p => ({ ...p, calls: Number(e.target.value) }))}
                  className="input w-full text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-muted block mb-1 flex items-center gap-1"><MessageSquare size={10} /> Max DMs</label>
                <input type="number" value={dailyLimits.dms} min={1} max={200}
                  onChange={e => setDailyLimits(p => ({ ...p, dms: Number(e.target.value) }))}
                  className="input w-full text-xs" />
              </div>
            </div>
          </div>

          {/* Compliance */}
          <div className="card space-y-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Shield size={14} className="text-gold" /> Compliance
            </h2>
            <p className="text-[10px] text-muted">Ensure your outreach complies with regulations.</p>
            <div className="space-y-3">
              {[
                { key: "optOut" as const, label: "Opt-Out Handling", desc: "Automatically stop contacting leads who opt out" },
                { key: "dncList" as const, label: "DNC List", desc: "Respect Do Not Call registry" },
                { key: "tcpa" as const, label: "TCPA Compliance", desc: "Follow Telephone Consumer Protection Act rules" },
                { key: "canSpam" as const, label: "CAN-SPAM Compliance", desc: "Follow CAN-SPAM Act for email marketing" },
              ].map(c => (
                <div key={c.key} className="flex items-center justify-between p-2.5 rounded-lg bg-surface-light">
                  <div>
                    <p className="text-xs font-medium">{c.label}</p>
                    <p className="text-[9px] text-muted">{c.desc}</p>
                  </div>
                  <button onClick={() => setCompliance(p => ({ ...p, [c.key]: !p[c.key] }))}
                    className={`${compliance[c.key] ? "text-gold" : "text-muted"}`}>
                    {compliance[c.key] ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Default Target Mode + Timezone + Working Hours */}
          <div className="card space-y-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Settings size={14} className="text-gold" /> General
            </h2>

            <div>
              <label className="text-xs font-medium block mb-2">Default Target Mode</label>
              <div className="flex gap-2">
                {(["b2b", "b2c"] as TargetMode[]).map(m => (
                  <button key={m} onClick={() => setDefaultTargetMode(m)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${
                      defaultTargetMode === m ? "bg-gold/10 text-gold border-gold/20" : "text-muted border-border/50"
                    }`}>{m.toUpperCase()}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium block mb-1">Timezone</label>
              <select value={timezone} onChange={e => setTimezone(e.target.value)} className="input w-full text-xs">
                {["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Phoenix", "Pacific/Honolulu", "America/Anchorage", "Europe/London", "Europe/Paris", "Asia/Tokyo"].map(tz => (
                  <option key={tz} value={tz}>{tz.replace("_", " ")}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium block mb-1">Working Hours</label>
              <p className="text-[9px] text-muted mb-2">Outreach will only be sent during these hours.</p>
              <div className="flex items-center gap-2">
                <input type="time" value={workingHours.start}
                  onChange={e => setWorkingHours(p => ({ ...p, start: e.target.value }))}
                  className="input text-xs flex-1" />
                <span className="text-[10px] text-muted">to</span>
                <input type="time" value={workingHours.end}
                  onChange={e => setWorkingHours(p => ({ ...p, end: e.target.value }))}
                  className="input text-xs flex-1" />
              </div>
            </div>
          </div>

          {/* Variable reference */}
          <div className="card space-y-3">
            <h3 className="text-xs font-semibold flex items-center gap-2">
              <Hash size={12} className="text-muted" /> Available Variables
            </h3>
            <p className="text-[9px] text-muted">Use these in any template. They&apos;re replaced with real lead data at send time.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {[
                { var: "name", desc: "Lead/owner name" },
                { var: "business_name", desc: "Business name" },
                { var: "industry", desc: "Business industry" },
                { var: "city", desc: "City location" },
                { var: "phone", desc: "Phone number" },
                { var: "email", desc: "Email address" },
                { var: "website", desc: "Website URL" },
                { var: "rating", desc: "Google rating" },
                { var: "review_count", desc: "Number of reviews" },
                { var: "days_ago", desc: "Days since last contact" },
                { var: "callback_number", desc: "Your callback number" },
                { var: "rating_mention", desc: "Rating praise snippet" },
              ].map(v => (
                <div key={v.var} className="flex items-center gap-2 p-2 rounded-lg bg-surface-light text-[10px]">
                  <code className="text-gold font-mono text-[9px]">{`{{${v.var}}}`}</code>
                  <span className="text-muted">{v.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <PageAI pageName="Outreach Hub" context="outreach campaigns, lead finder, B2B/B2C targeting, sequence builder, cold call scripts, SMS templates, email templates, social DM templates, AI settings, analytics, campaign management, industry targeting"
        suggestions={["Help me create a restaurant outreach campaign", "What sequence works best for B2B?", "Generate 5 SMS follow-up variations", "What tone works best for LinkedIn DMs?"]} />
      </ErrorBoundary>
    </div>
  );
}
