"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Client } from "@/lib/types";
import StatusBadge from "@/components/ui/status-badge";
import Modal from "@/components/ui/modal";
import { Settings, Bot, Zap, Globe, Bell, Save, Volume2, VolumeX, Info, Palette, Monitor, User, Camera, CreditCard, ExternalLink } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import toast from "react-hot-toast";
import { applyTheme } from "@/components/theme-provider";
import { getPlanConfig } from "@/lib/plan-config";

type Tab = "agents" | "integrations" | "automation" | "notifications" | "general";

interface AgentConfig {
  id: string;
  client_id: string;
  client_name: string;
  outreach_enabled: boolean;
  cold_calling_enabled: boolean;
  content_generation_enabled: boolean;
  auto_publish_enabled: boolean;
  blog_generation_enabled: boolean;
  ai_model: string;
  outreach_platforms: string[];
  daily_dm_limit: number;
  daily_call_limit: number;
  brand_voice: string;
  target_industries: string[];
  custom_instructions: string;
}

const INTEGRATIONS = [
  { name: "Supabase", key: "NEXT_PUBLIC_SUPABASE_URL", category: "Core" },
  { name: "Claude AI (Anthropic)", key: "ANTHROPIC_API_KEY", category: "AI" },
  { name: "GoHighLevel", key: "GHL_API_KEY", category: "CRM" },
  { name: "Telegram", key: "TELEGRAM_BOT_TOKEN", category: "Communication" },
  { name: "Slack", key: "SLACK_BOT_TOKEN", category: "Communication" },
  { name: "Stripe", key: "STRIPE_SECRET_KEY", category: "Payments" },
  { name: "Google Cloud", key: "GOOGLE_PLACES_API_KEY", category: "APIs" },
  { name: "Meta/Facebook", key: "META_APP_ID", category: "Social" },
  { name: "TikTok", key: "TIKTOK_CLIENT_KEY", category: "Social" },
  { name: "GoDaddy", key: "GODADDY_API_KEY", category: "Domains" },
  { name: "Retell AI", key: "RETELL_API_KEY", category: "Voice AI" },
  { name: "Make.com", key: "MAKE_API_KEY", category: "Automation" },
  { name: "Zernio", key: "ZERNIO_API_KEY", category: "Publishing" },
];

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key);
}

function safeSet(key: string, value: string) {
  if (typeof window !== "undefined") localStorage.setItem(key, value);
}

export default function SettingsPage() {
  const { profile, refreshProfile } = useAuth();
  const [tab, setTab] = useState<Tab>("general");
  const [nickname, setNickname] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [clients, setClients] = useState<Client[]>([]);
  const [agentConfigs, setAgentConfigs] = useState<AgentConfig[]>([]);
  const [editingAgent, setEditingAgent] = useState<AgentConfig | null>(null);
  const [healthData, setHealthData] = useState<Array<{ integration_name: string; status: string }>>([]);
  const [, forceRender] = useState(0);
  const rerender = () => forceRender(n => n + 1);
  const supabase = createClient();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, []);
  useEffect(() => { if (profile?.nickname) setNickname(profile.nickname); }, [profile]);

  async function fetchData() {
    try {
    const [{ data: c }, { data: h }] = await Promise.all([
      supabase.from("clients").select("*").eq("is_active", true).order("business_name"),
      supabase.from("system_health").select("integration_name, status").order("integration_name"),
    ]);
    setClients(c || []);
    setHealthData(h || []);

    // Load agent configs from local storage (or DB in production)
    const saved = safeGet("agent_configs");
    if (saved) {
      setAgentConfigs(JSON.parse(saved));
    } else {
      // Default config per client
      const defaults = (c || []).map((cl: Client) => ({
        id: cl.id,
        client_id: cl.id,
        client_name: cl.business_name,
        outreach_enabled: true,
        cold_calling_enabled: true,
        content_generation_enabled: true,
        auto_publish_enabled: true,
        blog_generation_enabled: true,
        ai_model: "claude-sonnet-4-6",
        outreach_platforms: ["instagram", "linkedin", "facebook", "tiktok"],
        daily_dm_limit: 20,
        daily_call_limit: 10,
        brand_voice: "professional and friendly",
        target_industries: [],
        custom_instructions: "",
      }));
      setAgentConfigs(defaults);
    }
    } catch (err) {
      console.error("[Settings] fetchData error:", err);
    }
  }

  function saveAgentConfig(config: AgentConfig) {
    const updated = agentConfigs.map(a => a.client_id === config.client_id ? config : a);
    setAgentConfigs(updated);
    safeSet("agent_configs", JSON.stringify(updated));
    toast.success(`Agent config saved for ${config.client_name}`);
    setEditingAgent(null);
  }

  const [sfxEnabled, setSfxEnabled] = useState(true);

  useEffect(() => {
    const saved = safeGet("sfx_enabled");
    if (saved === "false") setSfxEnabled(false);
  }, []);

  function toggleSfx() {
    const next = !sfxEnabled;
    setSfxEnabled(next);
    safeSet("sfx_enabled", String(next));
    toast.success(next ? "Sound effects enabled" : "Sound effects muted");
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "general", label: "General", icon: <Settings size={16} /> },
    { key: "agents", label: "AI Agents", icon: <Bot size={16} /> },
    { key: "integrations", label: "Integrations", icon: <Globe size={16} /> },
    { key: "automation", label: "Automation", icon: <Zap size={16} /> },
    { key: "notifications", label: "Notifications", icon: <Bell size={16} /> },
  ];

  return (
    <div className="fade-in space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
          <Settings size={24} className="text-gold" />
        </div>
        <div>
          <h1 className="page-header mb-0">Settings</h1>
          <p className="text-muted text-sm">Configure AI agents, integrations, and automation</p>
        </div>
      </div>

      <div className="flex gap-1 bg-surface rounded-lg p-1 w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm rounded-md flex items-center gap-2 transition-all ${tab === t.key ? "bg-gold text-black font-medium" : "text-muted hover:text-foreground"}`}
          >{t.icon} {t.label}</button>
        ))}
      </div>

      {/* General Tab */}
      {tab === "general" && (
        <div className="space-y-4 max-w-2xl">
          {/* Profile — Nickname & Avatar */}
          <div className="card" id="profile-section">
            <h2 className="section-header flex items-center gap-2">
              <User size={14} className="text-gold" /> Profile
            </h2>
            <p className="text-[10px] text-muted mb-3">Customize how you appear in the sidebar and across the app</p>
            <div className="flex items-start gap-4">
              <div className="relative group">
                {profile?.avatar_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={profile.avatar_url} alt="" className="w-16 h-16 rounded-xl object-cover border border-border" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-gold/10 border border-border flex items-center justify-center">
                    <span className="text-gold text-xl font-bold">{(profile?.nickname || profile?.full_name)?.charAt(0) || "?"}</span>
                  </div>
                )}
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                  <Camera size={16} className="text-white" />
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !profile) return;
                    if (file.size > 2 * 1024 * 1024) { toast.error("Image must be under 2 MB"); return; }
                    toast.loading("Uploading avatar...");
                    try {
                      const formData = new FormData();
                      formData.append("file", file);
                      const res = await fetch("/api/profile/avatar", { method: "POST", body: formData });
                      toast.dismiss();
                      if (!res.ok) {
                        const err = await res.json();
                        toast.error(err.error || "Upload failed");
                        return;
                      }
                      await refreshProfile();
                      toast.success("Avatar updated");
                    } catch (err) {
                      toast.dismiss();
                      console.error("Avatar upload exception:", err);
                      toast.error("Upload failed — try a smaller image");
                    }
                  }} />
                </label>
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Display Name</label>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder={profile?.full_name || "Your name"}
                    className="input w-full text-xs"
                  />
                </div>
                <button
                  disabled={savingProfile}
                  onClick={async () => {
                    if (!profile) return;
                    setSavingProfile(true);
                    try {
                      const res = await fetch("/api/profile", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ nickname }),
                      });
                      if (res.ok) {
                        await refreshProfile();
                        toast.success("Profile updated");
                      } else {
                        toast.error("Failed to save");
                      }
                    } catch {
                      toast.error("Connection error");
                    }
                    setSavingProfile(false);
                  }}
                  className="btn-primary text-[10px] px-3 py-1.5 flex items-center gap-1"
                >
                  <Save size={10} /> {savingProfile ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>

          {/* Subscription — agency plan management */}
          {profile?.role === "admin" && (
            <div className="card">
              <h2 className="section-header flex items-center gap-2">
                <CreditCard size={14} className="text-gold" /> Subscription
              </h2>
              <p className="text-[10px] text-muted mb-3">Manage your ShortStack OS plan</p>
              {(() => {
                const plan = getPlanConfig(profile?.plan_tier);
                return (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-surface-light border border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${plan.color}18` }}>
                        <Zap size={14} style={{ color: plan.color }} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold">{plan.badge_label} Plan</span>
                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                            style={{ background: `${plan.color}18`, color: plan.color, boxShadow: `0 0 6px ${plan.glow}` }}>
                            Active
                          </span>
                        </div>
                        <p className="text-[10px] text-muted mt-0.5">
                          ${plan.price_monthly.toLocaleString("en-US")}/mo
                          {plan.max_clients === -1 ? " — Unlimited clients" : ` — Up to ${plan.max_clients} clients`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        const res = await fetch("/api/billing/portal", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ self: true }),
                        });
                        const data = await res.json();
                        if (data.portal_url) {
                          window.open(data.portal_url, "_blank");
                        } else {
                          toast.error(data.error || "Could not open billing portal");
                        }
                      }}
                      className="btn-secondary text-[10px] px-3 py-1.5 flex items-center gap-1"
                    >
                      Manage <ExternalLink size={9} />
                    </button>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Desktop App Settings — only show in Electron */}
          {typeof window !== "undefined" && !!(window as unknown as { electronAPI?: unknown }).electronAPI && (
            <div className="card">
              <h2 className="section-header flex items-center gap-2">
                <Monitor size={14} className="text-gold" /> Desktop App
              </h2>
              <p className="text-[10px] text-muted mb-3">Settings for the ShortStack OS desktop application</p>
              <div className="space-y-2">
                {[
                  { key: "ss_auto_startup", label: "Auto-Start on Login", desc: "Launch ShortStack OS when your computer starts" },
                  { key: "ss_auto_update", label: "Auto-Update", desc: "Automatically check for and apply updates" },
                ].map(setting => {
                  const isEnabled = typeof window !== "undefined" && safeGet(setting.key) === "true";
                  return (
                    <div key={setting.key} className="flex items-center justify-between p-3 rounded-lg bg-surface-light border border-border">
                      <div>
                        <p className="text-xs font-medium">{setting.label}</p>
                        <p className="text-[10px] text-muted">{setting.desc}</p>
                      </div>
                      <button onClick={() => {
                        const next = !isEnabled;
                        safeSet(setting.key, next ? "true" : "false");
                        toast.success(`${setting.label} ${next ? "enabled" : "disabled"}`);
                      }}
                        className={`w-10 h-5 rounded-full transition-colors ${isEnabled ? "bg-gold" : "bg-surface-light border border-border"}`}>
                        <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${isEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Display & Zoom */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2">
              <Settings size={14} className="text-gold" /> Display
            </h2>
            <div className="space-y-3">
              {/* Zoom / FOV */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <p className="text-xs font-medium">Interface Zoom</p>
                    <p className="text-[10px] text-muted">Make everything smaller or larger</p>
                  </div>
                  <span className="text-xs font-mono text-gold">{typeof window !== "undefined" ? Math.round((parseFloat(document.documentElement.style.zoom || "1")) * 100) : 100}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { document.documentElement.style.zoom = "0.75"; safeSet("ss-zoom", "0.75"); rerender(); toast.success("Zoom: 75%"); }}
                    className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${safeGet("ss-zoom") === "0.75" ? "border-gold/30 bg-gold/10 text-gold" : "border-border text-muted hover:text-foreground"}`}>75%</button>
                  <button onClick={() => { document.documentElement.style.zoom = "0.85"; safeSet("ss-zoom", "0.85"); rerender(); toast.success("Zoom: 85%"); }}
                    className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${safeGet("ss-zoom") === "0.85" ? "border-gold/30 bg-gold/10 text-gold" : "border-border text-muted hover:text-foreground"}`}>85%</button>
                  <button onClick={() => { document.documentElement.style.zoom = "0.9"; safeSet("ss-zoom", "0.9"); rerender(); toast.success("Zoom: 90%"); }}
                    className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${safeGet("ss-zoom") === "0.9" ? "border-gold/30 bg-gold/10 text-gold" : "border-border text-muted hover:text-foreground"}`}>90%</button>
                  <button onClick={() => { document.documentElement.style.zoom = "1"; safeSet("ss-zoom", "1"); rerender(); toast.success("Zoom: 100%"); }}
                    className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${!safeGet("ss-zoom") || safeGet("ss-zoom") === "1" ? "border-gold/30 bg-gold/10 text-gold" : "border-border text-muted hover:text-foreground"}`}>100%</button>
                  <button onClick={() => { document.documentElement.style.zoom = "1.1"; safeSet("ss-zoom", "1.1"); rerender(); toast.success("Zoom: 110%"); }}
                    className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${safeGet("ss-zoom") === "1.1" ? "border-gold/30 bg-gold/10 text-gold" : "border-border text-muted hover:text-foreground"}`}>110%</button>
                </div>
              </div>

              {/* Sidebar compact */}
              <div className="flex items-center justify-between p-3 bg-surface-light rounded-lg border border-border">
                <div>
                  <p className="text-xs font-medium">Compact Sidebar</p>
                  <p className="text-[10px] text-muted">Collapse sidebar to icons only</p>
                </div>
                <button onClick={() => {
                  const current = safeGet("ss-sidebar-collapsed") === "true";
                  safeSet("ss-sidebar-collapsed", String(!current));
                  toast.success(current ? "Sidebar expanded" : "Sidebar collapsed");
                  window.dispatchEvent(new Event("storage"));
                }}
                  className={`w-10 h-5 rounded-full transition-all ${safeGet("ss-sidebar-collapsed") === "true" ? "bg-gold" : "bg-surface-light border border-border"}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${safeGet("ss-sidebar-collapsed") === "true" ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>

              {/* Animations */}
              <div className="flex items-center justify-between p-3 bg-surface-light rounded-lg border border-border">
                <div>
                  <p className="text-xs font-medium">Animations</p>
                  <p className="text-[10px] text-muted">Card hover effects, transitions, fades</p>
                </div>
                <button onClick={() => {
                  const current = safeGet("ss-animations") === "false";
                  safeSet("ss-animations", String(current));
                  if (!current) document.documentElement.classList.add("reduce-motion");
                  else document.documentElement.classList.remove("reduce-motion");
                  toast.success(current ? "Animations enabled" : "Animations disabled");
                }}
                  className={`w-10 h-5 rounded-full transition-all ${safeGet("ss-animations") !== "false" ? "bg-gold" : "bg-surface-light border border-border"}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${safeGet("ss-animations") !== "false" ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Sound Effects */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2">
              {sfxEnabled ? <Volume2 size={14} className="text-gold" /> : <VolumeX size={14} className="text-muted" />}
              Sound Effects
            </h2>
            <div className="flex items-center justify-between p-3 bg-surface-light rounded-lg border border-border">
              <div>
                <p className="text-xs font-medium">UI Sound Effects</p>
                <p className="text-[10px] text-muted">Click sounds, notifications, success/error tones</p>
              </div>
              <button onClick={toggleSfx}
                className={`w-10 h-5 rounded-full transition-all ${sfxEnabled ? "bg-gold" : "bg-surface-light border border-border"}`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${sfxEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
          </div>

          {/* Widget Visibility */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2">
              <Bot size={14} className="text-gold" /> Floating Widgets
            </h2>
            <p className="text-[10px] text-muted mb-3">Show or hide the floating assistant bubbles. You can also drag them to any position.</p>
            <div className="space-y-2">
              {[
                { key: "hide_voice_bubble", label: "Voice Assistant Bubble", desc: "The 'Hey Nicklas' gold bubble" },
                { key: "hide_chat_bubble", label: "Chat Widget Bubble", desc: "The chat icon in the corner" },
              ].map(widget => {
                const isHidden = typeof window !== "undefined" && localStorage.getItem(widget.key) === "true";
                return (
                  <div key={widget.key} className="flex items-center justify-between p-3 bg-surface-light rounded-lg border border-border">
                    <div>
                      <p className="text-xs font-medium">{widget.label}</p>
                      <p className="text-[10px] text-muted">{widget.desc}</p>
                    </div>
                    <button onClick={() => {
                      const next = !isHidden;
                      localStorage.setItem(widget.key, next ? "true" : "false");
                      toast.success(next ? `${widget.label} hidden — refresh to apply` : `${widget.label} visible — refresh to apply`);
                    }}
                      className={`w-10 h-5 rounded-full transition-all ${!isHidden ? "bg-gold" : "bg-surface-light border border-border"}`}>
                      <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${!isHidden ? "translate-x-5" : "translate-x-0.5"}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Theme — 10 presets */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2">
              <Palette size={14} className="text-gold" /> Color Theme
            </h2>
            <p className="text-[10px] text-muted mb-3">10 color schemes to match your style</p>
            <div className="grid grid-cols-5 gap-2">
              {[
                { id: "nordic", name: "Nordic", bg: "#FAFAF7", surface: "#FFFFFF", accent: "#C9A84C", text: "#374151", desc: "Default" },
                { id: "midnight", name: "Midnight", bg: "#08090e", surface: "#10121a", accent: "#C9A84C", text: "#e8eaed", desc: "Dark" },
                { id: "light", name: "Light", bg: "#f8fafc", surface: "#ffffff", accent: "#C9A84C", text: "#0f172a", desc: "Clean" },
                { id: "ocean", name: "Ocean", bg: "#0a1628", surface: "#0f1d32", accent: "#38bdf8", text: "#e2e8f0", desc: "Blue" },
                { id: "ember", name: "Ember", bg: "#120a08", surface: "#1a100c", accent: "#f97316", text: "#e2e8f0", desc: "Warm" },
                { id: "forest", name: "Forest", bg: "#071008", surface: "#0d1a10", accent: "#22c55e", text: "#e2e8f0", desc: "Green" },
                { id: "purple", name: "Purple", bg: "#0e0812", surface: "#16101e", accent: "#a855f7", text: "#e8e0f0", desc: "Violet" },
                { id: "rose", name: "Rose", bg: "#120810", surface: "#1c0e18", accent: "#f43f5e", text: "#f0e0e8", desc: "Pink" },
                { id: "arctic", name: "Arctic", bg: "#0a0f14", surface: "#10171e", accent: "#06b6d4", text: "#e0eaf0", desc: "Cyan" },
                { id: "noir", name: "Noir", bg: "#050505", surface: "#0e0e0e", accent: "#ffffff", text: "#d0d0d0", desc: "B&W" },
                { id: "sunset", name: "Sunset", bg: "#100808", surface: "#1a0e0e", accent: "#fb923c", text: "#f0e8e0", desc: "Orange" },
              ].map(theme => {
                const currentTheme = typeof window !== "undefined" ? safeGet("ss-theme") || "nordic" : "nordic";
                const isActive = currentTheme === theme.id;
                return (
                  <button key={theme.id} onClick={() => {
                    safeSet("ss-theme", theme.id);
                    applyTheme(theme.id);
                    rerender();
                    toast.success(`${theme.name} theme applied`);
                  }}
                    className={`p-2.5 rounded-lg border transition-all text-center ${
                      isActive ? "border-gold/40 ring-2 ring-gold/20 bg-surface-light" : "border-border hover:border-gold/30"
                    }`}
                  >
                    <div className="flex items-center justify-center gap-0.5 mb-1.5">
                      <div className="w-4 h-4 rounded-full border border-border" style={{ background: theme.bg }} />
                      <div className="w-4 h-4 rounded-full border border-border" style={{ background: theme.accent }} />
                    </div>
                    <p className="text-[9px] font-bold">{theme.name}</p>
                    {isActive && <p className="text-[7px] text-gold mt-0.5">Active</p>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Layout Options */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2">
              <Settings size={14} className="text-gold" /> Layout & Density
            </h2>
            <p className="text-[10px] text-muted mb-3">Customize how compact or spacious the interface feels</p>
            <div className="space-y-4">
              {/* Sidebar Style */}
              <div>
                <p className="text-xs font-medium mb-2">Sidebar Style</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "default", name: "Full", desc: "Icons + labels" },
                    { id: "compact", name: "Compact", desc: "Narrower sidebar" },
                    { id: "icons", name: "Icons Only", desc: "Collapsed view" },
                  ].map(style => {
                    const current = safeGet("ss-sidebar") || "default";
                    return (
                      <button key={style.id} onClick={() => {
                        safeSet("ss-sidebar", style.id);
                        rerender();
                        toast.success(`${style.name} sidebar applied`);
                      }}
                        className={`p-3 rounded-lg border text-center transition-all ${
                          current === style.id ? "border-gold/40 ring-2 ring-gold/20 bg-gold/10" : "border-border"
                        }`}>
                        <p className="text-[10px] font-bold">{style.name}</p>
                        <p className="text-[8px] text-muted">{style.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Font Size */}
              <div>
                <p className="text-xs font-medium mb-2">Font Size</p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: "small", name: "Small", size: "13px" },
                    { id: "default", name: "Default", size: "14px" },
                    { id: "large", name: "Large", size: "15px" },
                    { id: "xl", name: "Extra Large", size: "16px" },
                  ].map(fs => {
                    const current = safeGet("ss-fontsize") || "default";
                    return (
                      <button key={fs.id} onClick={() => {
                        safeSet("ss-fontsize", fs.id);
                        document.body.style.fontSize = fs.size;
                        rerender();
                        toast.success(`Font size: ${fs.name}`);
                      }}
                        className={`p-2.5 rounded-lg border text-center transition-all ${
                          current === fs.id ? "border-gold/40 ring-2 ring-gold/20 bg-gold/10" : "border-border"
                        }`}>
                        <p style={{ fontSize: fs.size }} className="font-bold">Aa</p>
                        <p className="text-[8px] text-muted">{fs.name}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Card Style */}
              <div>
                <p className="text-xs font-medium mb-2">Card Style</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "default", name: "Rounded", desc: "Soft corners" },
                    { id: "sharp", name: "Sharp", desc: "Square corners" },
                    { id: "bordered", name: "Bordered", desc: "Visible borders" },
                  ].map(cs => {
                    const current = safeGet("ss-cardstyle") || "default";
                    return (
                      <button key={cs.id} onClick={() => {
                        safeSet("ss-cardstyle", cs.id);
                        rerender();
                        toast.success(`${cs.name} cards applied`);
                      }}
                        className={`p-3 rounded-lg border text-center transition-all ${
                          current === cs.id ? "border-gold/40 ring-2 ring-gold/20 bg-gold/10" : "border-border"
                        }`}>
                        <p className="text-[10px] font-bold">{cs.name}</p>
                        <p className="text-[8px] text-muted">{cs.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Custom Domain */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2">
              <Globe size={14} className="text-gold" /> Custom Domain
            </h2>
            <p className="text-[10px] text-muted mb-3">Connect your own domain to ShortStack OS instead of shortstack-os.vercel.app</p>
            <div className="space-y-2 text-[11px]">
              <div className="p-3 rounded-lg bg-surface-light border border-border">
                <p className="font-semibold text-foreground mb-2">Setup Instructions:</p>
                <ol className="space-y-1.5 text-muted list-decimal list-inside">
                  <li>Go to <a href="https://vercel.com/growth-9598s-projects/shortstack-os/settings/domains" target="_blank" rel="noopener" className="text-gold hover:underline">Vercel Domain Settings</a></li>
                  <li>Click &ldquo;Add Domain&rdquo; and enter your domain (e.g. app.shortstack.work)</li>
                  <li>Go to your domain registrar (GoDaddy, Namecheap, Cloudflare)</li>
                  <li>Add a CNAME record: <code className="bg-white/5 px-1.5 py-0.5 rounded font-mono text-[10px]">app</code> pointing to <code className="bg-white/5 px-1.5 py-0.5 rounded font-mono text-[10px]">cname.vercel-dns.com</code></li>
                  <li>Wait 5-10 minutes for DNS to propagate</li>
                  <li>SSL certificate auto-configures</li>
                </ol>
              </div>
              <p className="text-[9px] text-muted/50">Current URL: shortstack-os.vercel.app</p>
            </div>
          </div>

          {/* Data & Cleanup */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2">
              <Zap size={14} className="text-gold" /> Data Management
            </h2>
            <p className="text-[10px] text-muted mb-3">Manage your data, exports, and automatic cleanup</p>
            <div className="space-y-2">
              {/* Auto-delete stale leads */}
              <div className="flex items-center justify-between p-3 bg-surface-light rounded-lg border border-border">
                <div>
                  <p className="text-xs font-medium">Auto-Delete Stale Leads</p>
                  <p className="text-[10px] text-muted">Remove leads not contacted within 2 days</p>
                </div>
                <button onClick={() => {
                  const current = safeGet("ss-auto-cleanup") !== "false";
                  safeSet("ss-auto-cleanup", String(!current));
                  rerender();
                  toast.success(!current ? "Auto-cleanup enabled" : "Auto-cleanup disabled");
                }}
                  className={`w-10 h-5 rounded-full transition-all ${safeGet("ss-auto-cleanup") !== "false" ? "bg-gold" : "bg-surface-light border border-border"}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${safeGet("ss-auto-cleanup") !== "false" ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
              {/* Default page size */}
              <div>
                <p className="text-xs font-medium mb-2">CRM Page Size</p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: "25", name: "25" },
                    { id: "50", name: "50" },
                    { id: "100", name: "100" },
                    { id: "200", name: "200" },
                  ].map(ps => {
                    const current = safeGet("ss-pagesize") || "50";
                    return (
                      <button key={ps.id} onClick={() => { safeSet("ss-pagesize", ps.id); rerender(); toast.success(`Page size: ${ps.name}`); }}
                        className={`p-2 rounded-lg border text-center transition-all ${current === ps.id ? "border-gold/40 ring-2 ring-gold/20 bg-gold/10" : "border-border"}`}>
                        <p className="text-[10px] font-bold">{ps.name}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Manual cleanup */}
              <button onClick={async () => {
                toast.loading("Cleaning up stale leads...");
                try {
                  const res = await fetch("/api/leads/cleanup", { method: "POST" });
                  const data = await res.json();
                  toast.dismiss();
                  toast.success(`Cleaned ${data.deleted || 0} stale leads`);
                } catch { toast.dismiss(); toast.error("Cleanup failed"); }
              }}
                className="w-full text-[10px] py-2 rounded-lg border border-danger/20 bg-danger/5 text-danger hover:bg-danger/10 transition-all">
                Run Manual Cleanup Now
              </button>
            </div>
          </div>

          {/* Keyboard Shortcuts */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2">
              <Settings size={14} className="text-gold" /> Keyboard Shortcuts
            </h2>
            <p className="text-[10px] text-muted mb-3">Navigate faster with these shortcuts</p>
            <div className="space-y-1">
              {[
                { keys: "Ctrl + K", desc: "Open command palette" },
                { keys: "Ctrl + /", desc: "Open AI assistant" },
                { keys: "Ctrl + B", desc: "Toggle sidebar" },
                { keys: "Ctrl + Scroll", desc: "Zoom in/out" },
                { keys: "Ctrl + Shift + N", desc: "Quick add (lead, client, task)" },
                { keys: "Esc", desc: "Close modals & menus" },
              ].map(s => (
                <div key={s.keys} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg hover:bg-surface-light transition-colors">
                  <span className="text-[10px] text-muted">{s.desc}</span>
                  <kbd className="text-[9px] font-mono px-2 py-0.5 rounded bg-surface-light border border-border text-foreground">{s.keys}</kbd>
                </div>
              ))}
            </div>
          </div>

          {/* Default AI Behavior */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2">
              <Bot size={14} className="text-gold" /> Default AI Behavior
            </h2>
            <p className="text-[10px] text-muted mb-3">Global defaults for how AI operates across the platform</p>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium mb-2">AI Response Tone</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "professional", name: "Professional", desc: "Formal & polished" },
                    { id: "friendly", name: "Friendly", desc: "Warm & approachable" },
                    { id: "direct", name: "Direct", desc: "Short & to the point" },
                  ].map(t => {
                    const current = safeGet("ss-ai-tone") || "professional";
                    return (
                      <button key={t.id} onClick={() => { safeSet("ss-ai-tone", t.id); rerender(); toast.success(`AI tone: ${t.name}`); }}
                        className={`p-2.5 rounded-lg border text-center transition-all ${current === t.id ? "border-gold/40 ring-2 ring-gold/20 bg-gold/10" : "border-border"}`}>
                        <p className="text-[10px] font-bold">{t.name}</p>
                        <p className="text-[8px] text-muted">{t.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-surface-light rounded-lg border border-border">
                <div>
                  <p className="text-xs font-medium">Auto-Draft Outreach</p>
                  <p className="text-[10px] text-muted">AI pre-writes emails/DMs for new leads</p>
                </div>
                <button onClick={() => {
                  const current = safeGet("ss-auto-draft") === "true";
                  safeSet("ss-auto-draft", String(!current));
                  rerender();
                  toast.success(!current ? "Auto-draft enabled" : "Auto-draft disabled");
                }}
                  className={`w-10 h-5 rounded-full transition-all ${safeGet("ss-auto-draft") === "true" ? "bg-gold" : "bg-surface-light border border-border"}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${safeGet("ss-auto-draft") === "true" ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-surface-light rounded-lg border border-border">
                <div>
                  <p className="text-xs font-medium">AI Suggestions</p>
                  <p className="text-[10px] text-muted">Show AI tips and recommendations across pages</p>
                </div>
                <button onClick={() => {
                  const current = safeGet("ss-ai-suggestions") !== "false";
                  safeSet("ss-ai-suggestions", String(!current));
                  rerender();
                  toast.success(!current ? "AI suggestions enabled" : "AI suggestions disabled");
                }}
                  className={`w-10 h-5 rounded-full transition-all ${safeGet("ss-ai-suggestions") !== "false" ? "bg-gold" : "bg-surface-light border border-border"}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${safeGet("ss-ai-suggestions") !== "false" ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Version Info */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2">
              <Info size={14} className="text-gold" /> About
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-xs text-muted">Version</span>
                <span className="text-xs font-mono text-gold">v1.2.0</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-xs text-muted">Build</span>
                <span className="text-xs font-mono text-muted">2026.04.06</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-xs text-muted">Platform</span>
                <span className="text-xs font-mono text-muted">Next.js + Supabase + Claude AI</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-xs text-muted">License</span>
                <span className="text-xs font-mono text-success">Enterprise</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-xs text-muted">Support</span>
                <span className="text-xs text-gold">growth@shortstack.work</span>
              </div>
            </div>
          </div>

          {/* White Label link */}
          <div className="card">
            <h2 className="section-header">Customization</h2>
            <a href="/dashboard/settings/white-label" className="flex items-center justify-between p-3 bg-surface-light rounded-lg border border-border hover:border-gold/15 transition-colors">
              <div>
                <p className="text-xs font-medium">White-Label Branding</p>
                <p className="text-[10px] text-muted">Customize logo, colors, and branding for clients</p>
              </div>
              <span className="text-gold text-xs">Configure</span>
            </a>
          </div>
        </div>
      )}

      {/* AI Agents Tab */}
      {tab === "agents" && (
        <div className="space-y-4">
          <div className="card bg-gold/5 border-gold/20">
            <p className="text-sm">Configure AI agents for each client. Control what the AI does automatically — outreach, cold calling, content, publishing.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agentConfigs.map(config => (
              <div key={config.client_id} className="card-hover">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">{config.client_name}</h3>
                  <button onClick={() => setEditingAgent(config)} className="text-gold text-xs hover:text-gold-light">Configure</button>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted">DM Outreach</span>
                    <StatusBadge status={config.outreach_enabled ? "active" : "paused"} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Cold Calling</span>
                    <StatusBadge status={config.cold_calling_enabled ? "active" : "paused"} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Content Gen</span>
                    <StatusBadge status={config.content_generation_enabled ? "active" : "paused"} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Auto Publish</span>
                    <StatusBadge status={config.auto_publish_enabled ? "active" : "paused"} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">AI Model</span>
                    <span className="text-gold">{config.ai_model.split("-").slice(-2).join(" ")}</span>
                  </div>
                </div>
              </div>
            ))}
            {agentConfigs.length === 0 && (
              <div className="col-span-full text-center py-8 text-muted">
                No clients yet. Add clients first, then configure their AI agents.
              </div>
            )}
          </div>

          {/* Global AI Settings */}
          <div className="card mt-6">
            <h3 className="section-header">Global AI Settings</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-muted mb-1">Default AI Model</label>
                <select className="input w-full text-sm">
                  <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (Best)</option>
                  <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (Fast)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Daily DM Target</label>
                <input type="number" defaultValue={80} className="input w-full text-sm" />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Daily Call Target</label>
                <input type="number" defaultValue={50} className="input w-full text-sm" />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Outreach Time (CET)</label>
                <input type="time" defaultValue="09:00" className="input w-full text-sm" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Integrations Tab */}
      {tab === "integrations" && (
        <div className="space-y-4">
          {["Core", "AI", "CRM", "Communication", "Payments", "Social", "APIs", "Domains", "Voice AI", "Automation", "Publishing"].map(category => {
            const items = INTEGRATIONS.filter(i => i.category === category);
            if (items.length === 0) return null;
            return (
              <div key={category}>
                <h3 className="text-xs text-muted uppercase tracking-wider mb-2">{category}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map(integration => {
                    const health = healthData.find(h => h.integration_name === integration.name);
                    return (
                      <div key={integration.name} className="card-hover p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{integration.name}</p>
                          <p className="text-xs text-muted">{integration.key}</p>
                        </div>
                        <StatusBadge status={health?.status || "unknown"} />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Automation Tab */}
      {tab === "automation" && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="section-header">Scheduled Jobs</h3>
            <div className="space-y-3">
              {[
                { name: "Lead Scraping", schedule: "Daily at 5:00 AM UTC (6:00 CET)", status: "active" },
                { name: "Daily Brief + Outreach + Cold Calls", schedule: "Daily at 8:00 AM UTC (9:00 CET)", status: "active" },
                { name: "Personal Brand Ideas", schedule: "Sundays at 8:00 AM UTC (9:00 CET)", status: "active" },
                { name: "Auto Follow-ups (Day 3 + Day 7)", schedule: "Runs with daily outreach", status: "active" },
                { name: "Health Check", schedule: "Runs with daily brief", status: "active" },
                { name: "Auto-publish via Zernio", schedule: "On approval from publish queue", status: "active" },
                { name: "GHL Cold Call Queue", schedule: "50 leads queued daily at 9:00 CET", status: "active" },
                { name: "Telegram Cleanup", schedule: "Before each new briefing", status: "active" },
              ].map((job, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-border0 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{job.name}</p>
                    <p className="text-xs text-muted">{job.schedule}</p>
                  </div>
                  <StatusBadge status={job.status} />
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 className="section-header">Automation Rules</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-border0">
                <span>Auto-import leads to GHL</span>
                <span className="text-success">Enabled</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border0">
                <span>Round-robin assign to cold callers</span>
                <span className="text-success">Enabled</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border0">
                <span>Auto-generate follow-up messages</span>
                <span className="text-success">Enabled</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border0">
                <span>Telegram notification on call booked</span>
                <span className="text-success">Enabled</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border0">
                <span>Auto briefing on admin login</span>
                <span className="text-success">Enabled</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span>Cleanup old Telegram messages (24h)</span>
                <span className="text-success">Enabled</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {tab === "notifications" && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="section-header">Telegram Notifications</h3>
            <div className="space-y-3 text-sm">
              {[
                { event: "Daily morning brief", enabled: true },
                { event: "Call booked from cold call", enabled: true },
                { event: "DM reply received", enabled: true },
                { event: "New deal closed", enabled: true },
                { event: "Content published", enabled: true },
                { event: "System integration down", enabled: true },
                { event: "New client onboarded", enabled: true },
                { event: "Invoice paid", enabled: true },
                { event: "Trinity action completed", enabled: true },
              ].map((n, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border0 last:border-0">
                  <span>{n.event}</span>
                  <span className={n.enabled ? "text-success" : "text-muted"}>{n.enabled ? "On" : "Off"}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 className="section-header">Slack Notifications</h3>
            <p className="text-sm text-muted">Same events sent to #shortstack-alerts channel in Slack</p>
          </div>
        </div>
      )}

      {/* Edit Agent Modal */}
      <Modal isOpen={!!editingAgent} onClose={() => setEditingAgent(null)} title={`Configure AI Agent — ${editingAgent?.client_name}`} size="xl">
        {editingAgent && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-muted mb-1">AI Model</label>
                <select value={editingAgent.ai_model} onChange={e => setEditingAgent({ ...editingAgent, ai_model: e.target.value })} className="input w-full">
                  <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (Best quality)</option>
                  <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (Fastest)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Brand Voice</label>
                <input value={editingAgent.brand_voice} onChange={e => setEditingAgent({ ...editingAgent, brand_voice: e.target.value })} className="input w-full" placeholder="e.g., professional, casual, energetic" />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editingAgent.outreach_enabled} onChange={e => setEditingAgent({ ...editingAgent, outreach_enabled: e.target.checked })} className="accent-gold" />
                <span className="text-sm">DM Outreach</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editingAgent.cold_calling_enabled} onChange={e => setEditingAgent({ ...editingAgent, cold_calling_enabled: e.target.checked })} className="accent-gold" />
                <span className="text-sm">Cold Calling</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editingAgent.content_generation_enabled} onChange={e => setEditingAgent({ ...editingAgent, content_generation_enabled: e.target.checked })} className="accent-gold" />
                <span className="text-sm">Content Gen</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editingAgent.auto_publish_enabled} onChange={e => setEditingAgent({ ...editingAgent, auto_publish_enabled: e.target.checked })} className="accent-gold" />
                <span className="text-sm">Auto Publish</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-muted mb-1">Daily DM Limit</label>
                <input type="number" value={editingAgent.daily_dm_limit} onChange={e => setEditingAgent({ ...editingAgent, daily_dm_limit: parseInt(e.target.value) })} className="input w-full" />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Daily Call Limit</label>
                <input type="number" value={editingAgent.daily_call_limit} onChange={e => setEditingAgent({ ...editingAgent, daily_call_limit: parseInt(e.target.value) })} className="input w-full" />
              </div>
            </div>

            <div>
              <label className="block text-sm text-muted mb-1">Outreach Platforms</label>
              <div className="flex gap-3">
                {["instagram", "linkedin", "facebook", "tiktok"].map(p => (
                  <label key={p} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={editingAgent.outreach_platforms.includes(p)} onChange={e => {
                      const platforms = e.target.checked
                        ? [...editingAgent.outreach_platforms, p]
                        : editingAgent.outreach_platforms.filter(x => x !== p);
                      setEditingAgent({ ...editingAgent, outreach_platforms: platforms });
                    }} className="accent-gold" />
                    <span className="text-sm capitalize">{p}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-muted mb-1">Custom Instructions for AI</label>
              <textarea value={editingAgent.custom_instructions} onChange={e => setEditingAgent({ ...editingAgent, custom_instructions: e.target.value })} className="input w-full h-24" placeholder="e.g., Always mention their Google reviews when reaching out. Focus on their weak social media presence." />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <button onClick={() => setEditingAgent(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => saveAgentConfig(editingAgent)} className="btn-primary flex items-center gap-2">
                <Save size={16} /> Save Configuration
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
