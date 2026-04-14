"use client";

import { useState } from "react";
import {
  Send, Camera, MessageCircle, Briefcase, Music, Play, Pause,
  Settings, CheckCircle, Zap, Copy, Clock,
  AlertTriangle, BarChart3, GitBranch, Ban, Target,
  TrendingUp, Filter, Plus, Trash2, ArrowRight, ShieldAlert
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Mock Data & Constants                                              */
/* ------------------------------------------------------------------ */

const PLATFORMS = [
  { id: "instagram", name: "Instagram", icon: Camera, color: "text-pink-400", bg: "bg-pink-400/10 border-pink-400/20" },
  { id: "facebook", name: "Facebook", icon: MessageCircle, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
  { id: "linkedin", name: "LinkedIn", icon: Briefcase, color: "text-blue-300", bg: "bg-blue-300/10 border-blue-300/20" },
  { id: "tiktok", name: "TikTok", icon: Music, color: "text-white", bg: "bg-white/5 border-white/15" },
];

const DM_TEMPLATES = [
  { id: 1, name: "Friendly Intro", message: "Hey! I came across {business_name} and love what you guys are doing. We help {industry} businesses get more clients through social media. Would you be open to a quick chat?", category: "intro" },
  { id: 2, name: "Value First", message: "Hey {name}! I noticed a few things on your page that could easily double your reach. We specialize in {industry} marketing. Mind if I share a couple quick ideas?", category: "intro" },
  { id: 3, name: "Social Proof", message: "Hey! We just helped another {industry} business go from 500 to 5000 followers in 30 days. Saw {business_name} and thought we could do the same. Interested?", category: "intro" },
  { id: 4, name: "Direct Pitch", message: "Hey {name}! We run an agency that helps {industry} businesses fill their calendar with new clients every month. Can I send you a quick case study?", category: "intro" },
  { id: 5, name: "Loom Offer", message: "Hey! I just recorded a quick 2-min video breaking down how {business_name} could get more clients from social media. Want me to send it over?", category: "intro" },
  { id: 6, name: "Compliment First", message: "Love your recent post about {topic}! Your content is really engaging. Have you thought about scaling it with a content strategy?", category: "intro" },
  { id: 7, name: "ROI Hook", message: "Quick question: Would an extra 20-30 clients per month make a difference for {business_name}? We've been helping {industry} businesses hit those numbers.", category: "intro" },
  { id: 8, name: "Mutual Connection", message: "Hey {name}! I was chatting with {mutual_connection} and they mentioned you might be looking for marketing help. I'd love to connect!", category: "warm" },
  { id: 9, name: "Follow-Up #1", message: "Hey {name}, just following up on my last message. I know you're busy - would a quick 10-min call work better? I promise it'll be worth your time.", category: "followup" },
  { id: 10, name: "Follow-Up #2", message: "Hi {name}! One more try - I put together a free audit of your social presence. Want me to send it over? No strings attached.", category: "followup" },
  { id: 11, name: "Follow-Up #3", message: "Last message, I promise! We just published a case study that's super relevant to {industry}. Thought you might find value in it.", category: "followup" },
  { id: 12, name: "Re-Engage", message: "Hey {name}! It's been a while. We just launched some new packages that might be a better fit for {business_name}. Worth a chat?", category: "followup" },
  { id: 13, name: "Event Invite", message: "Hey! We're hosting a free webinar on '{topic}' next week. Thought it'd be perfect for {business_name}. Want me to save you a spot?", category: "special" },
  { id: 14, name: "Holiday Special", message: "Happy {holiday}! We're running a limited-time offer on our marketing packages. Thought of {business_name}. Interested?", category: "special" },
  { id: 15, name: "Partnership", message: "Hey {name}! I've been following {business_name} and think there could be a great partnership opportunity. Can we chat?", category: "special" },
  { id: 16, name: "Content Collab", message: "Love your content! We're looking for business owners to feature in our series. Would {business_name} be interested?", category: "special" },
  { id: 17, name: "Question Hook", message: "Quick question: If you could change ONE thing about your marketing right now, what would it be?", category: "engagement" },
  { id: 18, name: "Poll DM", message: "We're doing a quick survey - what's your biggest challenge: getting leads, closing deals, or retaining clients?", category: "engagement" },
  { id: 19, name: "Urgency", message: "Hey {name}! We only take on 3 new {industry} clients per month and have 1 spot left. If you're interested, now's the time!", category: "closing" },
  { id: 20, name: "Testimonial Share", message: "Hey! One of our {industry} clients just left this review: '{testimonial}'. We'd love to get similar results for {business_name}.", category: "closing" },
];

const NICHES = [
  "Dentist", "Lawyer", "Gym", "Plumber", "Electrician", "Roofer",
  "Chiropractor", "Real Estate", "Restaurant", "Salon", "HVAC",
  "Accountant", "Photographer", "Auto Repair", "Med Spa",
];

const SERVICES = [
  "Social Media Management", "Paid Ads", "SEO", "Web Design",
  "Content Creation", "Branding", "Email Marketing", "AI Receptionist",
];

const AUTO_REPLY_RULES = [
  { id: "ar1", trigger: "price", response: "Great question! Our packages start at $1,200/mo. Want me to send details?", enabled: true },
  { id: "ar2", trigger: "interested", response: "Awesome! Let me grab a time for us to chat: [calendar_link]", enabled: true },
  { id: "ar3", trigger: "not interested", response: "No worries at all! If things change, we're always here. Best of luck!", enabled: true },
  { id: "ar4", trigger: "yes", response: "Perfect! Here's my calendar link to book a quick call: [calendar_link]", enabled: false },
];

const KEYWORD_TRIGGERS = [
  { keyword: "pricing", action: "Send pricing template", active: true },
  { keyword: "schedule", action: "Send calendar link", active: true },
  { keyword: "not interested", action: "Move to nurture sequence", active: true },
  { keyword: "unsubscribe", action: "Add to blacklist", active: false },
  { keyword: "referral", action: "Send referral program info", active: false },
];

const BLACKLIST = [
  { name: "Spam Account 1", platform: "instagram", reason: "Reported our messages", date: "2026-04-01" },
  { name: "competitor_agency", platform: "linkedin", reason: "Competitor", date: "2026-03-28" },
  { name: "BotFarm LLC", platform: "facebook", reason: "Fake account", date: "2026-03-15" },
];

const FOLLOWUP_SEQUENCES = [
  { id: "fs1", name: "Standard 3-Touch", steps: ["Day 0: Initial DM", "Day 3: Follow-up #1", "Day 7: Follow-up #2"], active: true },
  { id: "fs2", name: "Aggressive 5-Touch", steps: ["Day 0: Initial DM", "Day 2: Follow-up #1", "Day 4: Follow-up #2", "Day 7: Value offer", "Day 14: Last try"], active: false },
  { id: "fs3", name: "Soft Touch", steps: ["Day 0: Initial DM", "Day 7: Content share", "Day 21: Re-engage"], active: false },
];

const AB_TESTS = [
  { id: "ab1", name: "Intro Style", variantA: "Friendly Intro", variantB: "Value First", sent: 200, replyA: 12, replyB: 18, winner: "B" },
  { id: "ab2", name: "CTA Type", variantA: "Call booking", variantB: "Case study offer", sent: 150, replyA: 15, replyB: 11, winner: "A" },
  { id: "ab3", name: "Message Length", variantA: "Short (< 30 words)", variantB: "Long (50+ words)", sent: 180, replyA: 20, replyB: 14, winner: "A" },
];

const DM_ANALYTICS = {
  totalSent: 1245, responseRate: 8.4, conversionRate: 2.1, avgResponseTime: "4.2h",
  byPlatform: [
    { platform: "Instagram", sent: 520, responses: 52, rate: 10.0 },
    { platform: "Facebook", sent: 380, responses: 27, rate: 7.1 },
    { platform: "LinkedIn", sent: 220, responses: 22, rate: 10.0 },
    { platform: "TikTok", sent: 125, responses: 4, rate: 3.2 },
  ],
};

const COMPLIANCE_WARNINGS = [
  { id: "cw1", type: "warning", message: "Instagram daily DM limit approaching (18/20)", platform: "Instagram" },
  { id: "cw2", type: "info", message: "LinkedIn connection request limit resets in 6 hours", platform: "LinkedIn" },
  { id: "cw3", type: "success", message: "All platforms within safe sending limits", platform: "All" },
];

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function DMControllerPage() {
  const [activeTab, setActiveTab] = useState<"setup" | "templates" | "automation" | "analytics" | "blacklist">("setup");
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [templateFilter, setTemplateFilter] = useState("all");
  const [selectedSequence, setSelectedSequence] = useState("fs1");

  const [config, setConfig] = useState({
    platforms: ["instagram"] as string[],
    dmsPerPlatform: 20,
    niches: ["Dentist"] as string[],
    services: ["Social Media Management"] as string[],
    messageStyle: "friendly",
    delayBetween: 45,
    customMessage: "",
  });

  const togglePlatform = (id: string) => {
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

  const totalDMs = config.platforms.length * config.dmsPerPlatform;
  const estimatedTime = Math.round((totalDMs * config.delayBetween) / 60);

  function startDMRun() {
    if (config.platforms.length === 0 || config.niches.length === 0) return;
    setRunning(true);
    setCompleted(0);
    const interval = setInterval(() => {
      setCompleted(prev => {
        if (prev >= totalDMs) { clearInterval(interval); setRunning(false); return prev; }
        return prev + 1;
      });
    }, 200);
  }

  const tabs = [
    { id: "setup" as const, label: "Setup", icon: Settings },
    { id: "templates" as const, label: "Templates (20)", icon: Copy },
    { id: "automation" as const, label: "Automation", icon: Zap },
    { id: "analytics" as const, label: "Analytics", icon: BarChart3 },
    { id: "blacklist" as const, label: "Blacklist", icon: Ban },
  ];

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Send size={18} className="text-gold" /> DM Controller
          </h1>
          <p className="text-xs text-muted mt-0.5">Browser-based cold DMs with automation and analytics</p>
        </div>
        {running && (
          <div className="flex items-center gap-1.5 text-[10px] bg-green-400/10 text-green-400 px-2.5 py-1 rounded-md border border-green-400/15 animate-pulse">
            <Clock size={10} className="animate-spin" />
            <span>Running... {completed}/{totalDMs}</span>
          </div>
        )}
      </div>

      {/* Compliance Warnings */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {COMPLIANCE_WARNINGS.map(cw => (
          <div key={cw.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] whitespace-nowrap shrink-0 ${
            cw.type === "warning" ? "bg-yellow-400/5 border-yellow-400/15 text-yellow-400" :
            cw.type === "success" ? "bg-green-400/5 border-green-400/15 text-green-400" :
            "bg-blue-400/5 border-blue-400/15 text-blue-400"
          }`}>
            {cw.type === "warning" ? <AlertTriangle size={10} /> : cw.type === "success" ? <CheckCircle size={10} /> : <ShieldAlert size={10} />}
            {cw.message}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all border ${
              activeTab === t.id ? "bg-gold/10 border-gold/20 text-gold font-medium" : "border-border text-muted hover:text-foreground"
            }`}>
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </div>

      {/* ---- TAB: Setup ---- */}
      {activeTab === "setup" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {/* Platform Selector */}
            <div className="card p-4">
              <h2 className="text-xs font-semibold mb-2">Platform Selector</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {PLATFORMS.map(p => (
                  <button key={p.id} onClick={() => togglePlatform(p.id)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all ${
                      config.platforms.includes(p.id) ? p.bg : "border-border opacity-50"
                    }`}>
                    <p.icon size={18} className={config.platforms.includes(p.id) ? p.color : "text-muted"} />
                    <div>
                      <p className="text-xs font-semibold">{p.name}</p>
                      {config.platforms.includes(p.id) && <p className="text-[9px] text-green-400">Active</p>}
                    </div>
                  </button>
                ))}
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
                <div className="flex gap-1.5">
                  {["friendly", "professional", "bold", "casual"].map(s => (
                    <button key={s} onClick={() => setConfig({ ...config, messageStyle: s })}
                      className={`text-[10px] px-3 py-1 rounded-lg border transition-all capitalize ${
                        config.messageStyle === s ? "border-gold/30 bg-gold/[0.05] text-gold" : "border-border text-muted"
                      }`}>{s}</button>
                  ))}
                </div>
              </div>
              {/* Response Scheduling */}
              <div className="mt-3">
                <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Send Window</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[8px] text-muted">Start time</label>
                    <input type="time" defaultValue="09:00" className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground" />
                  </div>
                  <div>
                    <label className="text-[8px] text-muted">End time</label>
                    <input type="time" defaultValue="17:00" className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground" />
                  </div>
                </div>
              </div>
            </div>

            {/* Target niches */}
            <div className="card p-4">
              <h2 className="text-xs font-semibold mb-2">Target Niches</h2>
              <div className="flex flex-wrap gap-1.5">
                {NICHES.map(n => (
                  <button key={n} onClick={() => toggleNiche(n)}
                    className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
                      config.niches.includes(n) ? "border-gold/30 bg-gold/[0.05] text-gold" : "border-border text-muted"
                    }`}>{n}</button>
                ))}
              </div>
            </div>

            {/* Services */}
            <div className="card p-4">
              <h2 className="text-xs font-semibold mb-2">Services to Pitch</h2>
              <div className="flex flex-wrap gap-1.5">
                {SERVICES.map(s => (
                  <button key={s} onClick={() => toggleService(s)}
                    className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
                      config.services.includes(s) ? "border-gold/30 bg-gold/[0.05] text-gold" : "border-border text-muted"
                    }`}>{s}</button>
                ))}
              </div>
            </div>

            {/* Quick Message */}
            <div className="card p-4">
              <h2 className="text-xs font-semibold mb-2">Custom Message</h2>
              <textarea value={config.customMessage} onChange={e => setConfig({ ...config, customMessage: e.target.value })}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground h-16"
                placeholder="Edit template or write your own. Variables: {business_name}, {industry}, {name}" />
            </div>
          </div>

          {/* Launch panel */}
          <div className="space-y-4">
            <div className="card p-4 border-gold/10 relative overflow-hidden">
              <div className="text-center py-4">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 ${running ? "bg-green-400/10 animate-pulse" : "bg-gold/10"}`}>
                  {running ? <Clock size={28} className="text-green-400 animate-spin" /> : <Send size={28} className="text-gold" />}
                </div>
                <h3 className="text-sm font-bold mb-1">{running ? "Sending DMs..." : "Ready to Launch"}</h3>
                <div className="space-y-1 text-[10px] text-muted mb-4">
                  <p>Platforms: {config.platforms.length}</p>
                  <p>DMs per platform: {config.dmsPerPlatform}</p>
                  <p>Total DMs: {totalDMs}</p>
                  <p>Est. time: ~{estimatedTime} min</p>
                </div>
                {running && (
                  <div className="w-full bg-white/5 rounded-full h-2 mb-3 overflow-hidden">
                    <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${(completed / totalDMs) * 100}%` }} />
                  </div>
                )}
                <button onClick={running ? () => setRunning(false) : startDMRun}
                  disabled={config.platforms.length === 0}
                  className={`w-full text-xs py-2.5 flex items-center justify-center gap-2 rounded-xl font-semibold transition-all ${
                    running ? "bg-red-500 text-white hover:bg-red-400" : "bg-gold text-black disabled:opacity-50"
                  }`}>
                  {running ? <><Pause size={14} /> Stop</> : <><Play size={14} /> Start DM Run</>}
                </button>
              </div>
            </div>

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

      {/* ---- TAB: Templates Library ---- */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <div className="flex gap-1.5 mb-2">
            {["all", "intro", "followup", "special", "engagement", "closing"].map(f => (
              <button key={f} onClick={() => setTemplateFilter(f)}
                className={`text-[10px] px-2.5 py-1 rounded-lg border capitalize transition-all ${
                  templateFilter === f ? "border-gold/30 bg-gold/[0.05] text-gold" : "border-border text-muted"
                }`}>{f === "all" ? `All (${DM_TEMPLATES.length})` : f}</button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {DM_TEMPLATES.filter(t => templateFilter === "all" || t.category === templateFilter).map(t => (
              <div key={t.id} className="card p-3 cursor-pointer hover:border-gold/20 transition-all"
                onClick={() => setConfig({ ...config, customMessage: t.message })}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold">{t.name}</p>
                  <span className="text-[8px] bg-gold/10 text-gold px-1.5 py-0.5 rounded">{t.category}</span>
                </div>
                <p className="text-[10px] text-muted line-clamp-2">{t.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- TAB: Automation ---- */}
      {activeTab === "automation" && (
        <div className="space-y-4">
          {/* Auto-Reply Rules */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Zap size={12} className="text-gold" /> Auto-Reply Rules</h3>
            <div className="space-y-2">
              {AUTO_REPLY_RULES.map(rule => (
                <div key={rule.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  <div className={`w-2 h-2 rounded-full ${rule.enabled ? "bg-green-400" : "bg-white/20"}`} />
                  <div className="flex-1">
                    <p className="text-xs"><span className="text-gold font-mono">&quot;{rule.trigger}&quot;</span> <ArrowRight size={10} className="inline text-muted mx-1" /></p>
                    <p className="text-[10px] text-muted">{rule.response}</p>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded ${rule.enabled ? "bg-green-400/10 text-green-400" : "bg-white/5 text-muted"}`}>
                    {rule.enabled ? "Active" : "Disabled"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Keyword Triggers */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Target size={12} className="text-gold" /> Keyword Triggers</h3>
            <div className="space-y-2">
              {KEYWORD_TRIGGERS.map((kt, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg border border-border">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono bg-gold/10 text-gold px-2 py-0.5 rounded">{kt.keyword}</span>
                    <ArrowRight size={10} className="text-muted" />
                    <span className="text-[10px] text-muted">{kt.action}</span>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${kt.active ? "bg-green-400" : "bg-white/20"}`} />
                </div>
              ))}
            </div>
          </div>

          {/* Follow-Up Sequences */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><GitBranch size={12} className="text-gold" /> Follow-Up Sequences</h3>
            <div className="space-y-2">
              {FOLLOWUP_SEQUENCES.map(seq => (
                <div key={seq.id} className={`p-3 rounded-lg border transition-all cursor-pointer ${
                  selectedSequence === seq.id ? "border-gold/30 bg-gold/[0.03]" : "border-border"
                }`} onClick={() => setSelectedSequence(seq.id)}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold">{seq.name}</p>
                    <span className={`text-[9px] px-2 py-0.5 rounded ${seq.active ? "bg-green-400/10 text-green-400" : "bg-white/5 text-muted"}`}>
                      {seq.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  {selectedSequence === seq.id && (
                    <div className="space-y-1">
                      {seq.steps.map((step, i) => (
                        <div key={i} className="flex items-center gap-2 text-[10px] text-muted">
                          <div className="w-4 h-4 rounded-full bg-gold/10 text-gold text-[8px] flex items-center justify-center font-bold">{i + 1}</div>
                          {step}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* A/B Testing */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Filter size={12} className="text-gold" /> A/B Message Testing</h3>
            <div className="space-y-2">
              {AB_TESTS.map(test => (
                <div key={test.id} className="p-3 rounded-lg border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold">{test.name}</p>
                    <span className="text-[9px] text-muted">{test.sent} sent</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className={`p-2 rounded-lg border ${test.winner === "A" ? "border-green-400/20 bg-green-400/5" : "border-border"}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium">A: {test.variantA}</span>
                        {test.winner === "A" && <CheckCircle size={10} className="text-green-400" />}
                      </div>
                      <p className="text-xs font-mono mt-1">{test.replyA} replies ({((test.replyA / (test.sent / 2)) * 100).toFixed(1)}%)</p>
                    </div>
                    <div className={`p-2 rounded-lg border ${test.winner === "B" ? "border-green-400/20 bg-green-400/5" : "border-border"}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium">B: {test.variantB}</span>
                        {test.winner === "B" && <CheckCircle size={10} className="text-green-400" />}
                      </div>
                      <p className="text-xs font-mono mt-1">{test.replyB} replies ({((test.replyB / (test.sent / 2)) * 100).toFixed(1)}%)</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---- TAB: Analytics ---- */}
      {activeTab === "analytics" && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="card p-3 text-center">
              <p className="text-2xl font-bold font-mono">{DM_ANALYTICS.totalSent.toLocaleString()}</p>
              <p className="text-[10px] text-muted">Total Sent</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-2xl font-bold font-mono text-green-400">{DM_ANALYTICS.responseRate}%</p>
              <p className="text-[10px] text-muted">Response Rate</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-2xl font-bold font-mono text-gold">{DM_ANALYTICS.conversionRate}%</p>
              <p className="text-[10px] text-muted">Conversion Rate</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-2xl font-bold font-mono">{DM_ANALYTICS.avgResponseTime}</p>
              <p className="text-[10px] text-muted">Avg Response Time</p>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><TrendingUp size={12} className="text-gold" /> Performance by Platform</h3>
            <div className="space-y-3">
              {DM_ANALYTICS.byPlatform.map(p => (
                <div key={p.platform}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{p.platform}</span>
                    <span className="text-xs text-muted">{p.sent} sent &middot; {p.responses} replies ({p.rate}%)</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                    <div className="h-full rounded-full bg-gold/40" style={{ width: `${p.rate * 10}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---- TAB: Blacklist ---- */}
      {activeTab === "blacklist" && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold flex items-center gap-2"><Ban size={12} className="text-red-400" /> Blacklist Management</h3>
              <button className="px-3 py-1.5 rounded-lg bg-gold text-black text-[10px] font-semibold flex items-center gap-1"><Plus size={10} /> Add Entry</button>
            </div>
            <div className="space-y-2">
              {BLACKLIST.map((b, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    <Ban size={14} className="text-red-400" />
                    <div>
                      <p className="text-xs font-medium">{b.name}</p>
                      <p className="text-[10px] text-muted">{b.platform} &middot; {b.reason}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-muted">{b.date}</span>
                    <button className="text-muted hover:text-red-400"><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
