"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Client } from "@/lib/types";
import StatusBadge from "@/components/ui/status-badge";
import Modal from "@/components/ui/modal";
import { Settings, Bot, Zap, Globe, Bell, Save, Volume2, VolumeX, Info, Palette } from "lucide-react";
import toast from "react-hot-toast";

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

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("general");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [clients, setClients] = useState<Client[]>([]);
  const [agentConfigs, setAgentConfigs] = useState<AgentConfig[]>([]);
  const [editingAgent, setEditingAgent] = useState<AgentConfig | null>(null);
  const [healthData, setHealthData] = useState<Array<{ integration_name: string; status: string }>>([]);
  const supabase = createClient();

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    const [{ data: c }, { data: h }] = await Promise.all([
      supabase.from("clients").select("*").eq("is_active", true).order("business_name"),
      supabase.from("system_health").select("integration_name, status").order("integration_name"),
    ]);
    setClients(c || []);
    setHealthData(h || []);

    // Load agent configs from local storage (or DB in production)
    const saved = localStorage.getItem("agent_configs");
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
  }

  function saveAgentConfig(config: AgentConfig) {
    const updated = agentConfigs.map(a => a.client_id === config.client_id ? config : a);
    setAgentConfigs(updated);
    localStorage.setItem("agent_configs", JSON.stringify(updated));
    toast.success(`Agent config saved for ${config.client_name}`);
    setEditingAgent(null);
  }

  const [sfxEnabled, setSfxEnabled] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("sfx_enabled");
    if (saved === "false") setSfxEnabled(false);
  }, []);

  function toggleSfx() {
    const next = !sfxEnabled;
    setSfxEnabled(next);
    localStorage.setItem("sfx_enabled", String(next));
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
            className={`px-4 py-2 text-sm rounded-md flex items-center gap-2 transition-all ${tab === t.key ? "bg-gold text-black font-medium" : "text-muted hover:text-white"}`}
          >{t.icon} {t.label}</button>
        ))}
      </div>

      {/* General Tab */}
      {tab === "general" && (
        <div className="space-y-4 max-w-2xl">
          {/* Sound Effects */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2">
              {sfxEnabled ? <Volume2 size={14} className="text-gold" /> : <VolumeX size={14} className="text-muted" />}
              Sound Effects
            </h2>
            <div className="flex items-center justify-between p-3 bg-surface-light/30 rounded-lg border border-border/20">
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

          {/* Theme */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2">
              <Palette size={14} className="text-gold" /> Theme
            </h2>
            <p className="text-[10px] text-muted mb-3">Choose your preferred color scheme</p>
            <div className="grid grid-cols-4 gap-2.5">
              {[
                { id: "midnight", name: "Midnight", bg: "#06080c", surface: "#0c1017", accent: "#C9A84C", text: "#e2e8f0", desc: "Default dark" },
                { id: "light", name: "Light", bg: "#f8fafc", surface: "#ffffff", accent: "#C9A84C", text: "#0f172a", desc: "Clean white" },
                { id: "ocean", name: "Ocean", bg: "#0a1628", surface: "#0f1d32", accent: "#38bdf8", text: "#e2e8f0", desc: "Deep blue" },
                { id: "ember", name: "Ember", bg: "#120a08", surface: "#1a100c", accent: "#f97316", text: "#e2e8f0", desc: "Warm dark" },
              ].map(theme => {
                const currentTheme = typeof window !== "undefined" ? localStorage.getItem("ss-theme") || "midnight" : "midnight";
                const isActive = currentTheme === theme.id;
                return (
                  <button key={theme.id} onClick={() => {
                    localStorage.setItem("ss-theme", theme.id);
                    // Apply theme CSS variables
                    document.documentElement.style.setProperty("--bg", theme.bg);
                    document.documentElement.style.setProperty("--surface", theme.surface);
                    document.documentElement.style.setProperty("--accent", theme.accent);
                    document.documentElement.style.setProperty("--text", theme.text);
                    document.body.style.background = theme.bg;
                    document.body.style.color = theme.text;
                    // Update all surface elements
                    document.querySelectorAll(".card, .stat-card").forEach(el => {
                      (el as HTMLElement).style.backgroundColor = theme.surface;
                    });
                    toast.success(`${theme.name} theme applied`);
                    // Full reload for complete theme switch
                    setTimeout(() => window.location.reload(), 500);
                  }}
                    className={`p-3 rounded-xl border transition-all text-center ${
                      isActive ? "border-gold/30 ring-2 ring-gold/20" : "border-border/30 hover:border-gold/15"
                    }`}
                  >
                    {/* Preview circles */}
                    <div className="flex items-center justify-center gap-1 mb-2">
                      <div className="w-5 h-5 rounded-full border border-white/10" style={{ background: theme.bg }} />
                      <div className="w-5 h-5 rounded-full border border-white/10" style={{ background: theme.surface }} />
                      <div className="w-5 h-5 rounded-full border border-white/10" style={{ background: theme.accent }} />
                    </div>
                    <p className="text-[10px] font-semibold">{theme.name}</p>
                    <p className="text-[8px] text-muted">{theme.desc}</p>
                    {isActive && <p className="text-[8px] text-gold mt-0.5">Active</p>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Version Info */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2">
              <Info size={14} className="text-gold" /> About
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-border/15">
                <span className="text-xs text-muted">Version</span>
                <span className="text-xs font-mono text-gold">v1.2.0</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/15">
                <span className="text-xs text-muted">Build</span>
                <span className="text-xs font-mono text-muted">2026.04.06</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/15">
                <span className="text-xs text-muted">Platform</span>
                <span className="text-xs font-mono text-muted">Next.js + Supabase + Claude AI</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/15">
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
            <a href="/dashboard/settings/white-label" className="flex items-center justify-between p-3 bg-surface-light/30 rounded-lg border border-border/20 hover:border-gold/15 transition-colors">
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
                <div key={i} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
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
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span>Auto-import leads to GHL</span>
                <span className="text-success">Enabled</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span>Round-robin assign to cold callers</span>
                <span className="text-success">Enabled</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span>Auto-generate follow-up messages</span>
                <span className="text-success">Enabled</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span>Telegram notification on call booked</span>
                <span className="text-success">Enabled</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
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
                <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
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
