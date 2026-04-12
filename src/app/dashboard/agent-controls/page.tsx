"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Search, Send, Sparkles, Shield, Heart, CreditCard, Activity,
  Clock, Save, Loader, RotateCcw, Zap
} from "lucide-react";
import toast from "react-hot-toast";

const PLATFORMS_SCRAPE = [
  { id: "google_maps", name: "Google Maps" },
  { id: "linkedin", name: "LinkedIn" },
  { id: "facebook", name: "Facebook" },
  { id: "instagram", name: "Instagram" },
  { id: "yelp", name: "Yelp" },
  { id: "tiktok", name: "TikTok" },
];

const REQUIRED_FIELDS = [
  { id: "email", name: "Email" },
  { id: "phone", name: "Phone Number" },
  { id: "website", name: "Website" },
  { id: "social_media", name: "Social Media" },
  { id: "decision_maker", name: "Decision Maker Name" },
  { id: "address", name: "Physical Address" },
];

const INDUSTRIES = [
  "Dentist", "Lawyer", "HVAC", "Gym", "Restaurant", "Salon", "Plumber",
  "Electrician", "Roofer", "Chiropractor", "Real Estate", "Med Spa",
  "Accountant", "Auto Repair", "Photographer", "Therapist",
];

const SOCIAL_PLATFORMS = [
  { id: "instagram", name: "Instagram" },
  { id: "tiktok", name: "TikTok" },
  { id: "linkedin", name: "LinkedIn" },
  { id: "facebook", name: "Facebook" },
  { id: "youtube", name: "YouTube" },
];

const DAYS = [
  { id: "mon", name: "Mon" }, { id: "tue", name: "Tue" }, { id: "wed", name: "Wed" },
  { id: "thu", name: "Thu" }, { id: "fri", name: "Fri" }, { id: "sat", name: "Sat" }, { id: "sun", name: "Sun" },
];

const TONES = ["friendly", "professional", "bold", "casual", "educational"];

interface AgentSettings {
  lead_engine: {
    enabled: boolean; schedule: string; leads_per_run: number;
    platforms: string[]; required_fields: string[];
    target_industries: string[]; target_locations: string[];
  };
  outreach: {
    enabled: boolean; schedule: string; emails_per_day: number;
    sms_per_day: number; calls_per_day: number;
    ig_dms_per_day: number; fb_dms_per_day: number;
    active_days: string[]; message_style: string;
    goal_mode: boolean; weekly_reply_goal: number; weekly_booking_goal: number;
  };
  content: {
    enabled: boolean; schedule: string; schedule_day: string;
    posts_per_client: number; platforms: string[]; tone: string;
  };
  retention: { enabled: boolean; schedule: string; health_threshold: number; inactive_days: number };
  invoice: { enabled: boolean; schedule: string; chase_after_days: number };
  health_check: { enabled: boolean; interval_minutes: number };
  daily_brief: { enabled: boolean; schedule: string };
}

export default function AgentControlsPage() {
  useAuth();
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newLocation, setNewLocation] = useState("");

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const res = await fetch("/api/agents/settings");
      const data = await res.json();
      setSettings(data.settings);
    } catch { toast.error("Failed to load settings"); }
    setLoading(false);
  }

  async function saveSettings() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/agents/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) toast.success("Agent settings saved!");
      else toast.error("Failed to save");
    } catch { toast.error("Error saving"); }
    setSaving(false);
  }

  function toggle(arr: string[], item: string): string[] {
    return arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];
  }

  function update<K extends keyof AgentSettings>(agent: K, field: string, value: unknown) {
    if (!settings) return;
    setSettings({ ...settings, [agent]: { ...settings[agent], [field]: value } });
  }

  if (loading || !settings) {
    return <div className="flex items-center justify-center py-20"><Loader size={20} className="animate-spin text-gold" /></div>;
  }

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Zap size={18} className="text-gold" /> Agent Controls
          </h1>
          <p className="text-xs text-muted mt-0.5">Customize what each agent does, when it runs, and how much it sends</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadSettings} className="btn-secondary text-xs flex items-center gap-1.5">
            <RotateCcw size={12} /> Reset
          </button>
          <button onClick={saveSettings} disabled={saving} className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50">
            {saving ? <Loader size={12} className="animate-spin" /> : <Save size={12} />}
            {saving ? "Saving..." : "Save All"}
          </button>
        </div>
      </div>

      {/* ═══ LEAD ENGINE ═══ */}
      <div className="card-premium">
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)]" style={{ transform: "perspective(150px) rotateX(5deg)" }}>
                <div className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.2) 0%, transparent 55%)" }} />
                <Search size={18} className="text-white relative" />
              </div>
              <div>
                <h2 className="text-sm font-bold">Lead Engine (Scout)</h2>
                <p className="text-[10px] text-muted">Scrapes & qualifies leads automatically</p>
              </div>
            </div>
            <button onClick={() => update("lead_engine", "enabled", !settings.lead_engine.enabled)}
              className={`w-12 h-6 rounded-full transition-colors ${settings.lead_engine.enabled ? "bg-success" : "bg-surface-light"}`}>
              <div className={`w-5 h-5 rounded-full bg-white shadow transition-all mt-0.5 ${settings.lead_engine.enabled ? "ml-6" : "ml-0.5"}`} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[9px] text-muted uppercase tracking-wider mb-1.5 flex items-center gap-1"><Clock size={9} /> Run Time</label>
              <input type="time" value={settings.lead_engine.schedule} onChange={e => update("lead_engine", "schedule", e.target.value)} className="input w-full text-xs" />
            </div>
            <div>
              <label className="block text-[9px] text-muted uppercase tracking-wider mb-1.5">Leads Per Run</label>
              <input type="number" min={5} max={500} value={settings.lead_engine.leads_per_run} onChange={e => update("lead_engine", "leads_per_run", parseInt(e.target.value) || 50)} className="input w-full text-xs" />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-[9px] text-muted uppercase tracking-wider mb-1.5">Scrape From</label>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS_SCRAPE.map(p => (
                <button key={p.id} onClick={() => update("lead_engine", "platforms", toggle(settings.lead_engine.platforms, p.id))}
                  className={`text-[10px] px-3 py-1.5 rounded-lg border transition-all ${settings.lead_engine.platforms.includes(p.id) ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400" : "border-border text-muted"}`}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-[9px] text-muted uppercase tracking-wider mb-1.5">Must Have (Required Fields)</label>
            <div className="flex flex-wrap gap-1.5">
              {REQUIRED_FIELDS.map(f => (
                <button key={f.id} onClick={() => update("lead_engine", "required_fields", toggle(settings.lead_engine.required_fields, f.id))}
                  className={`text-[10px] px-3 py-1.5 rounded-lg border transition-all ${settings.lead_engine.required_fields.includes(f.id) ? "border-gold/30 bg-gold/10 text-gold" : "border-border text-muted"}`}>
                  {f.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-[9px] text-muted uppercase tracking-wider mb-1.5">Target Industries</label>
            <div className="flex flex-wrap gap-1.5">
              {INDUSTRIES.map(i => (
                <button key={i} onClick={() => update("lead_engine", "target_industries", toggle(settings.lead_engine.target_industries, i.toLowerCase()))}
                  className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${settings.lead_engine.target_industries.includes(i.toLowerCase()) ? "border-accent/30 bg-accent/10 text-accent" : "border-border text-muted"}`}>
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-[9px] text-muted uppercase tracking-wider mb-1.5">Target Locations</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {settings.lead_engine.target_locations.map((loc, i) => (
                <span key={i} className="text-[10px] px-2.5 py-1 rounded-lg bg-gold/10 text-gold border border-gold/20 flex items-center gap-1">
                  {loc}
                  <button onClick={() => update("lead_engine", "target_locations", settings.lead_engine.target_locations.filter((_, j) => j !== i))} className="text-gold/50 hover:text-gold">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newLocation} onChange={e => setNewLocation(e.target.value)} placeholder="Add city, e.g. Los Angeles, CA" className="input flex-1 text-xs"
                onKeyDown={e => { if (e.key === "Enter" && newLocation.trim()) { update("lead_engine", "target_locations", [...settings.lead_engine.target_locations, newLocation.trim()]); setNewLocation(""); } }} />
              <button onClick={() => { if (newLocation.trim()) { update("lead_engine", "target_locations", [...settings.lead_engine.target_locations, newLocation.trim()]); setNewLocation(""); } }}
                className="btn-secondary text-xs px-3">Add</button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ OUTREACH AGENT ═══ */}
      <div className="card-premium">
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.3)]" style={{ transform: "perspective(150px) rotateX(5deg)" }}>
                <div className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.2) 0%, transparent 55%)" }} />
                <Send size={18} className="text-white relative" />
              </div>
              <div>
                <h2 className="text-sm font-bold">Outreach Agent (Echo)</h2>
                <p className="text-[10px] text-muted">Cold emails, SMS, calls, and social DMs</p>
              </div>
            </div>
            <button onClick={() => update("outreach", "enabled", !settings.outreach.enabled)}
              className={`w-12 h-6 rounded-full transition-colors ${settings.outreach.enabled ? "bg-success" : "bg-surface-light"}`}>
              <div className={`w-5 h-5 rounded-full bg-white shadow transition-all mt-0.5 ${settings.outreach.enabled ? "ml-6" : "ml-0.5"}`} />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[9px] text-muted uppercase tracking-wider mb-1.5 flex items-center gap-1"><Clock size={9} /> Run Time</label>
              <input type="time" value={settings.outreach.schedule} onChange={e => update("outreach", "schedule", e.target.value)} className="input w-full text-xs" />
            </div>
            <div>
              <label className="block text-[9px] text-muted uppercase tracking-wider mb-1.5">Emails / Day</label>
              <input type="number" min={0} max={100} value={settings.outreach.emails_per_day} onChange={e => update("outreach", "emails_per_day", parseInt(e.target.value) || 0)} className="input w-full text-xs" />
            </div>
            <div>
              <label className="block text-[9px] text-muted uppercase tracking-wider mb-1.5">SMS / Day</label>
              <input type="number" min={0} max={100} value={settings.outreach.sms_per_day} onChange={e => update("outreach", "sms_per_day", parseInt(e.target.value) || 0)} className="input w-full text-xs" />
            </div>
            <div>
              <label className="block text-[9px] text-muted uppercase tracking-wider mb-1.5">Cold Calls / Day</label>
              <input type="number" min={0} max={500} value={settings.outreach.calls_per_day} onChange={e => update("outreach", "calls_per_day", parseInt(e.target.value) || 0)} className="input w-full text-xs" />
            </div>
            <div>
              <label className="block text-[9px] text-muted uppercase tracking-wider mb-1.5">IG DMs / Day</label>
              <input type="number" min={0} max={50} value={settings.outreach.ig_dms_per_day} onChange={e => update("outreach", "ig_dms_per_day", parseInt(e.target.value) || 0)} className="input w-full text-xs" />
            </div>
            <div>
              <label className="block text-[9px] text-muted uppercase tracking-wider mb-1.5">FB DMs / Day</label>
              <input type="number" min={0} max={50} value={settings.outreach.fb_dms_per_day} onChange={e => update("outreach", "fb_dms_per_day", parseInt(e.target.value) || 0)} className="input w-full text-xs" />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-[9px] text-muted uppercase tracking-wider mb-1.5">Active Days</label>
            <div className="flex gap-1.5">
              {DAYS.map(d => (
                <button key={d.id} onClick={() => update("outreach", "active_days", toggle(settings.outreach.active_days, d.id))}
                  className={`text-[10px] w-10 py-1.5 rounded-lg border text-center transition-all ${settings.outreach.active_days.includes(d.id) ? "border-blue-400/30 bg-blue-400/10 text-blue-400" : "border-border text-muted"}`}>
                  {d.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-[9px] text-muted uppercase tracking-wider mb-1.5">Message Style</label>
            <div className="flex gap-1.5">
              {TONES.map(t => (
                <button key={t} onClick={() => update("outreach", "message_style", t)}
                  className={`text-[10px] px-3 py-1.5 rounded-lg border capitalize transition-all ${settings.outreach.message_style === t ? "border-blue-400/30 bg-blue-400/10 text-blue-400" : "border-border text-muted"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Goal Mode */}
          <div className="mt-4 p-3 rounded-lg border border-amber-400/15 bg-amber-400/[0.03]">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-[10px] font-semibold text-amber-400">Goal Mode</p>
                <p className="text-[9px] text-muted">Auto-increase volume until weekly goals are hit</p>
              </div>
              <button onClick={() => update("outreach", "goal_mode", !settings.outreach.goal_mode)}
                className={`w-10 h-5 rounded-full transition-colors ${settings.outreach.goal_mode ? "bg-amber-400" : "bg-surface-light"}`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow transition-all mt-0.5 ${settings.outreach.goal_mode ? "ml-5" : "ml-0.5"}`} />
              </button>
            </div>
            {settings.outreach.goal_mode && (
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <label className="block text-[8px] text-muted uppercase mb-1">Replies / Week</label>
                  <input type="number" min={1} max={100} value={settings.outreach.weekly_reply_goal} onChange={e => update("outreach", "weekly_reply_goal", parseInt(e.target.value) || 10)} className="input w-full text-[10px]" />
                </div>
                <div>
                  <label className="block text-[8px] text-muted uppercase mb-1">Bookings / Week</label>
                  <input type="number" min={1} max={50} value={settings.outreach.weekly_booking_goal} onChange={e => update("outreach", "weekly_booking_goal", parseInt(e.target.value) || 5)} className="input w-full text-[10px]" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ CONTENT AGENT ═══ */}
      <div className="card-premium">
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.3)]" style={{ transform: "perspective(150px) rotateX(5deg)" }}>
                <Sparkles size={18} className="text-white relative" />
              </div>
              <div>
                <h2 className="text-sm font-bold">Content Agent (Pixel)</h2>
                <p className="text-[10px] text-muted">Auto-generates weekly social content for clients</p>
              </div>
            </div>
            <button onClick={() => update("content", "enabled", !settings.content.enabled)}
              className={`w-12 h-6 rounded-full transition-colors ${settings.content.enabled ? "bg-success" : "bg-surface-light"}`}>
              <div className={`w-5 h-5 rounded-full bg-white shadow transition-all mt-0.5 ${settings.content.enabled ? "ml-6" : "ml-0.5"}`} />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[9px] text-muted uppercase tracking-wider mb-1.5">Run Day</label>
              <select value={settings.content.schedule_day} onChange={e => update("content", "schedule_day", e.target.value)} className="input w-full text-xs">
                {["monday","tuesday","wednesday","thursday","friday","saturday","sunday"].map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase()+d.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[9px] text-muted uppercase tracking-wider mb-1.5 flex items-center gap-1"><Clock size={9} /> Run Time</label>
              <input type="time" value={settings.content.schedule} onChange={e => update("content", "schedule", e.target.value)} className="input w-full text-xs" />
            </div>
            <div>
              <label className="block text-[9px] text-muted uppercase tracking-wider mb-1.5">Posts Per Client</label>
              <input type="number" min={1} max={14} value={settings.content.posts_per_client} onChange={e => update("content", "posts_per_client", parseInt(e.target.value) || 5)} className="input w-full text-xs" />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-[9px] text-muted uppercase tracking-wider mb-1.5">Post To Platforms</label>
            <div className="flex flex-wrap gap-1.5">
              {SOCIAL_PLATFORMS.map(p => (
                <button key={p.id} onClick={() => update("content", "platforms", toggle(settings.content.platforms, p.id))}
                  className={`text-[10px] px-3 py-1.5 rounded-lg border transition-all ${settings.content.platforms.includes(p.id) ? "border-purple-400/30 bg-purple-400/10 text-purple-400" : "border-border text-muted"}`}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-[9px] text-muted uppercase tracking-wider mb-1.5">Content Tone</label>
            <div className="flex gap-1.5">
              {TONES.map(t => (
                <button key={t} onClick={() => update("content", "tone", t)}
                  className={`text-[10px] px-3 py-1.5 rounded-lg border capitalize transition-all ${settings.content.tone === t ? "border-purple-400/30 bg-purple-400/10 text-purple-400" : "border-border text-muted"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ RETENTION + INVOICE + HEALTH + BRIEF ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Retention */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-500 to-red-500 flex items-center justify-center"><Heart size={14} className="text-white" /></div>
              <div>
                <h3 className="text-xs font-bold">Retention Agent</h3>
                <p className="text-[9px] text-muted">Churn detection</p>
              </div>
            </div>
            <button onClick={() => update("retention", "enabled", !settings.retention.enabled)}
              className={`w-10 h-5 rounded-full transition-colors ${settings.retention.enabled ? "bg-success" : "bg-surface-light"}`}>
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-all mt-0.5 ${settings.retention.enabled ? "ml-5" : "ml-0.5"}`} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[8px] text-muted uppercase mb-1">Run Time</label>
              <input type="time" value={settings.retention.schedule} onChange={e => update("retention", "schedule", e.target.value)} className="input w-full text-[10px]" />
            </div>
            <div>
              <label className="block text-[8px] text-muted uppercase mb-1">Alert Below Score</label>
              <input type="number" min={10} max={90} value={settings.retention.health_threshold} onChange={e => update("retention", "health_threshold", parseInt(e.target.value) || 50)} className="input w-full text-[10px]" />
            </div>
          </div>
        </div>

        {/* Invoice */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center"><CreditCard size={14} className="text-white" /></div>
              <div>
                <h3 className="text-xs font-bold">Invoice Agent</h3>
                <p className="text-[9px] text-muted">Payment chasing</p>
              </div>
            </div>
            <button onClick={() => update("invoice", "enabled", !settings.invoice.enabled)}
              className={`w-10 h-5 rounded-full transition-colors ${settings.invoice.enabled ? "bg-success" : "bg-surface-light"}`}>
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-all mt-0.5 ${settings.invoice.enabled ? "ml-5" : "ml-0.5"}`} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[8px] text-muted uppercase mb-1">Run Time</label>
              <input type="time" value={settings.invoice.schedule} onChange={e => update("invoice", "schedule", e.target.value)} className="input w-full text-[10px]" />
            </div>
            <div>
              <label className="block text-[8px] text-muted uppercase mb-1">Chase After (days)</label>
              <input type="number" min={1} max={30} value={settings.invoice.chase_after_days} onChange={e => update("invoice", "chase_after_days", parseInt(e.target.value) || 1)} className="input w-full text-[10px]" />
            </div>
          </div>
        </div>

        {/* Health Check */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center"><Activity size={14} className="text-white" /></div>
              <div>
                <h3 className="text-xs font-bold">Health Monitor</h3>
                <p className="text-[9px] text-muted">System checks</p>
              </div>
            </div>
            <button onClick={() => update("health_check", "enabled", !settings.health_check.enabled)}
              className={`w-10 h-5 rounded-full transition-colors ${settings.health_check.enabled ? "bg-success" : "bg-surface-light"}`}>
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-all mt-0.5 ${settings.health_check.enabled ? "ml-5" : "ml-0.5"}`} />
            </button>
          </div>
          <div>
            <label className="block text-[8px] text-muted uppercase mb-1">Check Every (minutes)</label>
            <input type="number" min={5} max={120} value={settings.health_check.interval_minutes} onChange={e => update("health_check", "interval_minutes", parseInt(e.target.value) || 30)} className="input w-full text-[10px]" />
          </div>
        </div>

        {/* Daily Brief */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center"><Shield size={14} className="text-white" /></div>
              <div>
                <h3 className="text-xs font-bold">Daily Briefing</h3>
                <p className="text-[9px] text-muted">Morning report</p>
              </div>
            </div>
            <button onClick={() => update("daily_brief", "enabled", !settings.daily_brief.enabled)}
              className={`w-10 h-5 rounded-full transition-colors ${settings.daily_brief.enabled ? "bg-success" : "bg-surface-light"}`}>
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-all mt-0.5 ${settings.daily_brief.enabled ? "ml-5" : "ml-0.5"}`} />
            </button>
          </div>
          <div>
            <label className="block text-[8px] text-muted uppercase mb-1">Send At</label>
            <input type="time" value={settings.daily_brief.schedule} onChange={e => update("daily_brief", "schedule", e.target.value)} className="input w-full text-[10px]" />
          </div>
        </div>
      </div>

      {/* Save bar */}
      <div className="sticky bottom-4 z-30">
        <button onClick={saveSettings} disabled={saving}
          className="btn-primary btn-shine w-full text-xs py-3 flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-gold/20">
          {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? "Saving..." : "Save All Agent Settings"}
        </button>
      </div>
    </div>
  );
}
