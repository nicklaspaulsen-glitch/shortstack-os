"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  Send, Camera, MessageCircle, Briefcase, Music,
  Play, Pause, Settings, Loader, CheckCircle, Zap,
  Copy, RotateCcw, Inbox, Clock
} from "lucide-react";
import toast from "react-hot-toast";

const PLATFORMS = [
  { id: "instagram", name: "Instagram", icon: <Camera size={18} />, color: "text-pink-400", bg: "bg-pink-400/10 border-pink-400/20" },
  { id: "facebook", name: "Facebook", icon: <MessageCircle size={18} />, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
  { id: "linkedin", name: "LinkedIn", icon: <Briefcase size={18} />, color: "text-blue-300", bg: "bg-blue-300/10 border-blue-300/20" },
  { id: "tiktok", name: "TikTok", icon: <Music size={18} />, color: "text-white", bg: "bg-white/5 border-white/15" },
];

const MESSAGE_TEMPLATES = [
  { name: "Friendly Intro", message: "Hey! I came across {business_name} and love what you guys are doing. We help {industry} businesses get more clients through social media. Would you be open to a quick chat?" },
  { name: "Value First", message: "Hey {name}! I noticed a few things on your page that could easily double your reach. We specialize in {industry} marketing. Mind if I share a couple quick ideas?" },
  { name: "Social Proof", message: "Hey! We just helped another {industry} business go from 500 to 5000 followers in 30 days. Saw {business_name} and thought we could do the same for you. Interested?" },
  { name: "Direct Pitch", message: "Hey {name}! We run an agency that helps {industry} businesses fill their calendar with new clients every month. Can I send you a quick case study?" },
  { name: "Loom Offer", message: "Hey! I just recorded a quick 2-min video breaking down how {business_name} could get more clients from social media. Want me to send it over?" },
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

export default function DMControllerPage() {
  useAuth();
  const supabase = createClient();
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [logs, setLogs] = useState<Array<{ platform: string; target: string; status: string; time: string }>>([]);
  const [tab, setTab] = useState<"setup" | "queue">("setup");
  const [queuedDMs, setQueuedDMs] = useState<Array<{ id: string; platform: string; business_name: string; message_text: string; status: string; created_at: string }>>([]);
  const [queueLoading, setQueueLoading] = useState(false);

  useEffect(() => {
    fetchQueue();
  }, []);

  async function fetchQueue() {
    setQueueLoading(true);
    const { data } = await supabase
      .from("outreach_log")
      .select("id, platform, business_name, message_text, status, created_at")
      .eq("metadata->>source", "browser_dm")
      .order("created_at", { ascending: false })
      .limit(50);
    setQueuedDMs(data || []);
    setQueueLoading(false);
  }

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

  async function startDMRun() {
    if (config.platforms.length === 0) { toast.error("Select at least one platform"); return; }
    if (config.niches.length === 0) { toast.error("Select at least one niche"); return; }

    setRunning(true);
    setCompleted(0);
    setLogs([]);
    toast.success(`DM run started! ${totalDMs} DMs across ${config.platforms.length} platforms. ETA: ~${estimatedTime} min`);

    try {
      const res = await fetch("/api/dm/browser-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();

      if (data.success) {
        setCompleted(data.queued || data.sent || 0);
        setLogs(data.logs || []);
        toast.success(`Done! ${data.queued || data.sent} DMs queued.`);
        fetchQueue();
      } else {
        toast.error(data.error || "DM run failed");
      }
    } catch {
      toast.error("Connection error");
    }
    setRunning(false);
  }

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Send size={18} className="text-gold" /> DM Controller
          </h1>
          <p className="text-xs text-muted mt-0.5">Browser-based cold DMs — runs through your logged-in accounts</p>
        </div>
        <div className="flex items-center gap-2">
          {running && (
            <div className="flex items-center gap-1.5 text-[10px] bg-success/10 text-success px-2.5 py-1 rounded-md border border-success/15 animate-pulse">
              <Loader size={10} className="animate-spin" />
              <span>Running... {completed}/{totalDMs}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        <button onClick={() => setTab("setup")} className={`text-[10px] px-3 py-1.5 rounded-lg transition-all ${tab === "setup" ? "bg-gold/10 text-gold border border-gold/20" : "text-muted border border-border/20"}`}>
          <Settings size={10} className="inline mr-1" /> Setup
        </button>
        <button onClick={() => { setTab("queue"); fetchQueue(); }} className={`text-[10px] px-3 py-1.5 rounded-lg transition-all ${tab === "queue" ? "bg-gold/10 text-gold border border-gold/20" : "text-muted border border-border/20"}`}>
          <Inbox size={10} className="inline mr-1" /> Queue ({queuedDMs.length})
        </button>
      </div>

      {tab === "queue" && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-header mb-0 flex items-center gap-2"><Inbox size={14} className="text-gold" /> DM Queue</h2>
            <button onClick={fetchQueue} className="btn-ghost text-[10px] flex items-center gap-1"><RotateCcw size={10} /> Refresh</button>
          </div>
          {queueLoading ? (
            <div className="text-center py-8"><Loader size={16} className="animate-spin text-gold mx-auto" /></div>
          ) : queuedDMs.length === 0 ? (
            <p className="text-xs text-muted text-center py-8">No DMs in queue. Set up a run to get started.</p>
          ) : (
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
              {queuedDMs.map((dm) => (
                <div key={dm.id} className="flex items-center gap-3 py-2 px-2 rounded-lg border border-border/20 hover:bg-surface-light/30 transition-colors">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    dm.status === "sent" ? "bg-success/10 text-success" : dm.status === "failed" ? "bg-danger/10 text-danger" : "bg-gold/10 text-gold"
                  }`}>
                    {dm.status === "sent" ? <CheckCircle size={12} /> : dm.status === "failed" ? "!" : <Clock size={12} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{dm.business_name}</span>
                      <span className="text-[9px] text-muted capitalize">{dm.platform}</span>
                    </div>
                    <p className="text-[10px] text-muted truncate">{dm.message_text}</p>
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(dm.message_text); toast.success("Copied!"); }}
                    className="text-muted hover:text-white transition-colors p-1"><Copy size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "setup" && <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Config */}
        <div className="lg:col-span-2 space-y-4">
          {/* Platforms */}
          <div className="card">
            <h2 className="section-header">Platforms</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {PLATFORMS.map(p => (
                <button key={p.id} onClick={() => togglePlatform(p.id)}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all ${
                    config.platforms.includes(p.id) ? p.bg : "border-border/20 opacity-50"
                  }`}>
                  <span className={config.platforms.includes(p.id) ? p.color : "text-muted"}>{p.icon}</span>
                  <div>
                    <p className="text-xs font-semibold">{p.name}</p>
                    {config.platforms.includes(p.id) && <p className="text-[9px] text-success">Active</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* DMs per platform + delay */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Settings size={13} className="text-gold" /> Settings</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">DMs per platform</label>
                <input type="number" min={1} max={100} value={config.dmsPerPlatform}
                  onChange={e => setConfig({ ...config, dmsPerPlatform: parseInt(e.target.value) || 20 })}
                  className="input w-full text-xs" />
                <p className="text-[8px] text-muted mt-0.5">Recommended: 15-25 to avoid bans</p>
              </div>
              <div>
                <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Delay between DMs (seconds)</label>
                <input type="number" min={15} max={120} value={config.delayBetween}
                  onChange={e => setConfig({ ...config, delayBetween: parseInt(e.target.value) || 45 })}
                  className="input w-full text-xs" />
                <p className="text-[8px] text-muted mt-0.5">Recommended: 30-60s to look human</p>
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Message Style</label>
              <div className="flex gap-1.5">
                {["friendly", "professional", "bold", "casual"].map(s => (
                  <button key={s} onClick={() => setConfig({ ...config, messageStyle: s })}
                    className={`text-[10px] px-3 py-1 rounded-lg border transition-all capitalize ${
                      config.messageStyle === s ? "border-gold/30 bg-gold/[0.05] text-gold" : "border-border/20 text-muted"
                    }`}>{s}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Target niches */}
          <div className="card">
            <h2 className="section-header">Target Niches</h2>
            <div className="flex flex-wrap gap-1.5">
              {NICHES.map(n => (
                <button key={n} onClick={() => toggleNiche(n)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
                    config.niches.includes(n) ? "border-gold/30 bg-gold/[0.05] text-gold" : "border-border/20 text-muted"
                  }`}>{n}</button>
              ))}
            </div>
          </div>

          {/* Services to pitch */}
          <div className="card">
            <h2 className="section-header">Services to Pitch</h2>
            <div className="flex flex-wrap gap-1.5">
              {SERVICES.map(s => (
                <button key={s} onClick={() => toggleService(s)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
                    config.services.includes(s) ? "border-accent/30 bg-accent/[0.05] text-accent" : "border-border/20 text-muted"
                  }`}>{s}</button>
              ))}
            </div>
          </div>

          {/* Message Templates */}
          <div className="card">
            <h2 className="section-header">Message Template</h2>
            <div className="space-y-1.5 mb-3">
              {MESSAGE_TEMPLATES.map((t, i) => (
                <button key={i} onClick={() => setConfig({ ...config, customMessage: t.message })}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                    config.customMessage === t.message ? "border-gold/30 bg-gold/[0.05]" : "border-border/20 hover:border-border/40"
                  }`}>
                  <p className="text-[10px] font-semibold mb-0.5">{t.name}</p>
                  <p className="text-[9px] text-muted line-clamp-2">{t.message}</p>
                </button>
              ))}
              <button onClick={() => setConfig({ ...config, customMessage: "" })}
                className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                  !config.customMessage ? "border-accent/30 bg-accent/[0.05]" : "border-border/20 hover:border-border/40"
                }`}>
                <p className="text-[10px] font-semibold mb-0.5 text-accent">AI Generated</p>
                <p className="text-[9px] text-muted">Let AI write unique personalized messages for each lead</p>
              </button>
            </div>
            <textarea value={config.customMessage} onChange={e => setConfig({ ...config, customMessage: e.target.value })}
              className="input w-full h-16 text-xs"
              placeholder="Edit template or write your own. Variables: {business_name}, {industry}, {name}" />
          </div>
        </div>

        {/* Launch panel */}
        <div className="space-y-4">
          <div className="card border-gold/10 relative overflow-hidden">
            <div className="absolute inset-0 bg-mesh opacity-30" />
            <div className="relative text-center py-4">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 ${running ? "bg-success/10 animate-pulse" : "bg-gold/10"}`}>
                {running ? <Loader size={28} className="text-success animate-spin" /> : <Send size={28} className="text-gold" />}
              </div>
              <h3 className="text-sm font-bold mb-1">{running ? "Sending DMs..." : "Ready to Launch"}</h3>
              <div className="space-y-1 text-[10px] text-muted mb-4">
                <p>Platforms: {config.platforms.length}</p>
                <p>DMs per platform: {config.dmsPerPlatform}</p>
                <p>Total DMs: {totalDMs}</p>
                <p>Estimated time: ~{estimatedTime} min</p>
                <p>Niches: {config.niches.length}</p>
              </div>
              <button onClick={running ? () => setRunning(false) : startDMRun}
                disabled={config.platforms.length === 0}
                className={`w-full text-xs py-2.5 flex items-center justify-center gap-2 rounded-xl font-semibold transition-all ${
                  running
                    ? "bg-danger text-white hover:bg-danger/80"
                    : "btn-primary disabled:opacity-50"
                }`}>
                {running ? <><Pause size={14} /> Stop</> : <><Play size={14} /> Start DM Run</>}
              </button>
            </div>
          </div>

          {/* Requirements */}
          <div className="card">
            <h3 className="section-header flex items-center gap-2"><Zap size={12} className="text-warning" /> Requirements</h3>
            <div className="space-y-1.5 text-[10px] text-muted">
              <p>1. Chrome open with Claude extension</p>
              <p>2. Logged into your social accounts</p>
              <p>3. Keep Chrome in foreground</p>
              <p>4. Do not touch the mouse during run</p>
            </div>
          </div>

          {/* Live log */}
          {logs.length > 0 && (
            <div className="card">
              <h3 className="section-header">DM Log</h3>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {logs.map((log, i) => (
                  <div key={i} className="flex items-center gap-2 text-[9px] py-0.5">
                    <CheckCircle size={8} className="text-success shrink-0" />
                    <span className="text-muted">{log.platform}</span>
                    <span className="truncate">{log.target}</span>
                    <span className="text-muted/50 shrink-0">{log.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>}
    </div>
  );
}
