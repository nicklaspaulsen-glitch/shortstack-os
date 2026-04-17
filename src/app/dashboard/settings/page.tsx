"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Client } from "@/lib/types";
import StatusBadge from "@/components/ui/status-badge";
import Modal from "@/components/ui/modal";
import { Settings, Bot, Zap, Globe, Bell, Save, Volume2, VolumeX, Info, Palette, Monitor, User, Camera, CreditCard, ExternalLink, Key, Shield, Mail, Download, Upload, Trash2, AlertTriangle, Eye, Lock, Database, RotateCcw, CheckCircle2, Loader2, Server, ChevronDown, ChevronUp, Send, ToggleLeft, ToggleRight, Cloud, XCircle, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import toast from "react-hot-toast";
import { applyTheme } from "@/components/theme-provider";
import { getPlanConfig } from "@/lib/plan-config";

type Tab = "general" | "agents" | "integrations" | "automation" | "notifications" | "billing" | "api_keys" | "white_label" | "smtp" | "security" | "data" | "danger";

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

  // API Keys
  // TODO: fetch from API
  const [apiKeys, setApiKeys] = useState<Array<{ id: string; name: string; key: string; created: string; last_used: string; status: string }>>([]);
  const [newKeyName, setNewKeyName] = useState("");

  // White-label
  const [whiteLabel, setWhiteLabel] = useState({
    company_name: "", logo_url: "", primary_color: "#C9A84C", accent_color: "#B8942F",
    favicon_url: "", login_text: "", show_powered_by: true, domain: "", support_email: "",
  });
  const [wlSaving, setWlSaving] = useState(false);
  const [wlLoaded, setWlLoaded] = useState(false);

  // SMTP
  const [smtp, setSmtp] = useState({ host: "", port: "587", username: "", password: "", from_name: "", from_email: "", use_tls: true, provider: "" as string });
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpLoaded, setSmtpLoaded] = useState(false);
  const [smtpVerified, setSmtpVerified] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; message: string; hint?: string } | null>(null);
  const [smtpProviderOpen, setSmtpProviderOpen] = useState(false);

  // Security
  const [twoFA, setTwoFA] = useState(false);
  // TODO: fetch from API
  const [sessions] = useState<Array<{ device: string; ip: string; last_active: string; current: boolean }>>([]);

  // Timezone
  const [timezone, setTimezone] = useState("Europe/Copenhagen");
  const [language, setLanguage] = useState("en");

  // Social connections
  const [socialAccounts, setSocialAccounts] = useState<Array<{
    id: string; platform: string; account_name: string; account_id: string | null;
    is_active: boolean; created_at: string; token_expires_at: string | null;
    status: "active" | "expired" | "revoked"; metadata: Record<string, unknown> | null;
  }>>([]);
  const [disconnectingSocial, setDisconnectingSocial] = useState<string | null>(null);
  const [socialLoading, setSocialLoading] = useState(false);

  // Spam Guard
  const [spamGuardEnabled, setSpamGuardEnabled] = useState(true);

  // Payment method
  const [paymentMethod, setPaymentMethod] = useState<{
    brand: string; last4: string; exp_month: number; exp_year: number;
  } | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  // Danger zone
  const [deleteConfirm, setDeleteConfirm] = useState("");

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); fetchSocialAccounts(); }, []);
  useEffect(() => { if (profile?.nickname) setNickname(profile.nickname); }, [profile]);

  // Fetch spam guard setting on mount
  useEffect(() => {
    fetch("/api/settings/spam-guard")
      .then(r => r.json())
      .then(d => setSpamGuardEnabled(d.enabled !== false))
      .catch(() => {});
  }, []);

  // Fetch payment method when billing tab opens
  useEffect(() => {
    if (tab !== "billing") return;
    setPaymentLoading(true);
    fetch("/api/billing/payment-method")
      .then(r => r.json())
      .then(d => { if (d.payment_method) setPaymentMethod(d.payment_method); })
      .catch(() => {})
      .finally(() => setPaymentLoading(false));
  }, [tab]);

  async function openBillingPortal() {
    setPortalLoading(true);
    try {
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
    } catch {
      toast.error("Failed to open billing portal");
    } finally {
      setPortalLoading(false);
    }
  }

  // Fetch white-label config when the tab opens
  useEffect(() => {
    if (tab !== "white_label" || wlLoaded) return;
    (async () => {
      try {
        const res = await fetch(`/api/white-label?t=${Date.now()}`);
        if (res.ok) {
          const json = await res.json();
          if (json.config) {
            setWhiteLabel({
              company_name: json.config.company_name || "",
              logo_url: json.config.logo_url || "",
              primary_color: json.config.primary_color || "#C9A84C",
              accent_color: json.config.accent_color || "#B8942F",
              favicon_url: json.config.favicon_url || "",
              login_text: json.config.login_text || "",
              show_powered_by: json.config.show_powered_by ?? true,
              domain: json.config.domain || "",
              support_email: json.config.support_email || "",
            });
          }
        }
      } catch { /* keep defaults */ }
      setWlLoaded(true);
    })();
  }, [tab, wlLoaded]);

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

  async function fetchSocialAccounts() {
    setSocialLoading(true);
    try {
      // Get first active client to fetch social accounts
      const { data: firstClient } = await supabase
        .from("clients")
        .select("id")
        .eq("is_active", true)
        .limit(1)
        .single();

      if (firstClient) {
        const res = await fetch(`/api/social/connect?client_id=${firstClient.id}&zernio=true`);
        const data = await res.json();
        setSocialAccounts(data.accounts || []);
      }
    } catch {
      console.error("[Settings] Failed to fetch social accounts");
    }
    setSocialLoading(false);
  }

  async function disconnectSocialAccount(account: { id: string; account_id: string | null; platform: string }) {
    setDisconnectingSocial(account.id);
    try {
      const { data: firstClient } = await supabase
        .from("clients")
        .select("id")
        .eq("is_active", true)
        .limit(1)
        .single();

      const res = await fetch("/api/social/connect", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: account.id,
          client_id: firstClient?.id,
          zernio_account_id: account.account_id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${account.platform} disconnected`);
        fetchSocialAccounts();
      } else {
        toast.error("Failed to disconnect");
      }
    } catch {
      toast.error("Error disconnecting account");
    }
    setDisconnectingSocial(null);
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

  // SMTP providers
  const smtpProviders = [
    { name: "Gmail", host: "smtp.gmail.com", port: "587", use_tls: true, icon: "G", color: "#EA4335", hint: "Use an App Password (Settings > Security > 2-Step Verification > App Passwords)" },
    { name: "Outlook / Microsoft 365", host: "smtp.office365.com", port: "587", use_tls: true, icon: "O", color: "#0078D4", hint: "Use your Microsoft account credentials" },
    { name: "SendGrid", host: "smtp.sendgrid.net", port: "587", use_tls: true, icon: "SG", color: "#1A82E2", hint: "Username is 'apikey', password is your SendGrid API key" },
    { name: "Mailgun", host: "smtp.mailgun.org", port: "587", use_tls: true, icon: "MG", color: "#F06B54", hint: "Find credentials under Sending > Domain settings > SMTP" },
    { name: "AWS SES", host: "email-smtp.us-east-1.amazonaws.com", port: "587", use_tls: true, icon: "SES", color: "#FF9900", hint: "Use SMTP credentials from the SES console (not IAM keys)" },
  ];

  // Load SMTP config from API
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (tab === "smtp" && !smtpLoaded) {
      (async () => {
        try {
          const res = await fetch("/api/smtp");
          if (res.ok) {
            const { config } = await res.json();
            if (config) {
              setSmtp({
                host: config.host || "",
                port: String(config.port || "587"),
                username: config.username || "",
                password: config.password_encrypted || "",
                from_name: config.from_name || "",
                from_email: config.from_email || "",
                use_tls: config.use_tls ?? true,
                provider: config.provider || "",
              });
              setSmtpVerified(config.verified || false);
            }
          }
        } catch { /* ignore fetch errors */ }
        setSmtpLoaded(true);
      })();
    }
  }, [tab, smtpLoaded]);

  async function saveSmtp() {
    setSmtpSaving(true);
    setSmtpTestResult(null);
    try {
      const res = await fetch("/api/smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: smtp.host,
          port: smtp.port,
          username: smtp.username,
          password: smtp.password,
          from_email: smtp.from_email,
          from_name: smtp.from_name,
          use_tls: smtp.use_tls,
          provider: smtp.provider || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("SMTP settings saved");
        setSmtpVerified(false); // Needs re-verification after changes
      } else {
        toast.error(data.error || "Failed to save SMTP settings");
      }
    } catch {
      toast.error("Network error — could not save");
    }
    setSmtpSaving(false);
  }

  async function testSmtp() {
    setSmtpTesting(true);
    setSmtpTestResult(null);
    try {
      const res = await fetch("/api/smtp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: smtp.host,
          port: smtp.port,
          username: smtp.username,
          password: smtp.password,
          from_email: smtp.from_email,
          from_name: smtp.from_name,
          use_tls: smtp.use_tls,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSmtpTestResult({ success: true, message: data.message });
        setSmtpVerified(true);
        toast.success("Test email sent successfully!");
      } else {
        setSmtpTestResult({ success: false, message: data.error, hint: data.hint });
        toast.error("SMTP test failed");
      }
    } catch {
      setSmtpTestResult({ success: false, message: "Network error — could not reach the server" });
      toast.error("Network error");
    }
    setSmtpTesting(false);
  }

  function applySmtpProvider(provider: typeof smtpProviders[number]) {
    setSmtp(prev => ({
      ...prev,
      host: provider.host,
      port: provider.port,
      use_tls: provider.use_tls,
      provider: provider.name,
    }));
    setSmtpProviderOpen(false);
    setSmtpVerified(false);
    setSmtpTestResult(null);
    toast.success(`${provider.name} template applied`);
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "general", label: "General", icon: <Settings size={16} /> },
    { key: "agents", label: "AI Agents", icon: <Bot size={16} /> },
    { key: "integrations", label: "Integrations", icon: <Globe size={16} /> },
    { key: "automation", label: "Automation", icon: <Zap size={16} /> },
    { key: "notifications", label: "Notifications", icon: <Bell size={16} /> },
    { key: "billing", label: "Billing", icon: <CreditCard size={16} /> },
    { key: "api_keys", label: "API Keys", icon: <Key size={16} /> },
    { key: "white_label", label: "White Label", icon: <Palette size={16} /> },
    { key: "smtp", label: "SMTP", icon: <Mail size={16} /> },
    { key: "security", label: "Security", icon: <Shield size={16} /> },
    { key: "data", label: "Import/Export", icon: <Database size={16} /> },
    { key: "danger", label: "Danger Zone", icon: <AlertTriangle size={16} /> },
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

              {/* Dark Mode */}
              <div className="flex items-center justify-between p-3 bg-surface-light rounded-lg border border-border">
                <div>
                  <p className="text-xs font-medium">Dark Mode</p>
                  <p className="text-[10px] text-muted">Switch between light and dark appearance</p>
                </div>
                <button onClick={() => {
                  const currentTheme = safeGet("ss-theme") || "nordic";
                  const isCurrentlyLight = currentTheme === "nordic" || currentTheme === "light";
                  const newTheme = isCurrentlyLight ? "midnight" : "nordic";
                  safeSet("ss-theme", newTheme);
                  applyTheme(newTheme);
                  rerender();
                  toast.success(isCurrentlyLight ? "Dark mode enabled" : "Light mode enabled");
                }}
                  className={`w-10 h-5 rounded-full transition-all ${(() => { const t = safeGet("ss-theme") || "nordic"; return t !== "nordic" && t !== "light"; })() ? "bg-gold" : "bg-surface-light border border-border"}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${(() => { const t = safeGet("ss-theme") || "nordic"; return t !== "nordic" && t !== "light"; })() ? "translate-x-5" : "translate-x-0.5"}`} />
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
          {/* Connected Social Accounts via Zernio */}
          <div>
            <h3 className="text-xs text-muted uppercase tracking-wider mb-2">Connected Social Accounts</h3>
            {socialLoading ? (
              <div className="card p-6 text-center">
                <Loader2 size={16} className="animate-spin mx-auto text-muted" />
              </div>
            ) : socialAccounts.filter(a => a.is_active).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {socialAccounts.filter(a => a.is_active).map(account => (
                  <div key={account.id} className="card-hover p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-2 h-2 rounded-full ${
                          account.status === "active" ? "bg-emerald-400" :
                          account.status === "expired" ? "bg-red-400" : "bg-zinc-500"
                        }`} />
                        <div>
                          <p className="font-medium text-sm capitalize flex items-center gap-1.5">
                            {account.platform}
                            {account.status === "expired" && (
                              <span className="text-[9px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-full font-normal">expired</span>
                            )}
                          </p>
                          <p className="text-xs text-muted">{account.account_name || "Connected"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={account.status === "active" ? "active" : account.status === "expired" ? "error" : "inactive"} />
                        <button
                          onClick={() => disconnectSocialAccount(account)}
                          disabled={disconnectingSocial === account.id}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded hover:bg-red-500/10 disabled:opacity-50"
                          title="Disconnect account">
                          {disconnectingSocial === account.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <XCircle size={14} />
                          )}
                        </button>
                      </div>
                    </div>
                    {account.token_expires_at && (
                      <p className="text-[10px] text-muted mt-2">
                        Token expires: {new Date(account.token_expires_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="card p-6 text-center">
                <Globe size={20} className="mx-auto mb-2 text-muted/30" />
                <p className="text-xs text-muted mb-2">No social accounts connected</p>
                <p className="text-[10px] text-muted/70 mb-3">Go to Social Manager to connect accounts via Zernio</p>
                <a href="/dashboard/social-manager" className="text-xs text-gold hover:underline">
                  Open Social Manager
                </a>
              </div>
            )}
          </div>

          {/* Service Integrations */}
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
            <h3 className="section-header flex items-center gap-2">
              <Shield size={16} className="text-gold" /> Sender Spam Protection
            </h3>
            <p className="text-xs text-muted mb-4">
              Enforces industry-standard sending limits to prevent your phone numbers and emails from being flagged as spam.
              Includes hourly rate caps, warmup enforcement, minimum delays between sends, and auto-pause on high bounce/complaint rates.
            </p>
            <div className="flex items-center justify-between py-3 border-b border-border0">
              <div>
                <p className="text-sm font-medium">Spam Guard</p>
                <p className="text-xs text-muted">Hard caps on daily/hourly sends per sender warmup stage</p>
              </div>
              <button
                onClick={async () => {
                  const next = !spamGuardEnabled;
                  setSpamGuardEnabled(next);
                  try {
                    await fetch("/api/settings/spam-guard", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ enabled: next }),
                    });
                    toast.success(next ? "Spam protection enabled" : "Spam protection disabled — send at your own risk");
                  } catch { toast.error("Failed to save"); }
                }}
                className="flex items-center gap-2"
              >
                {spamGuardEnabled
                  ? <ToggleRight size={28} className="text-green-400" />
                  : <ToggleLeft size={28} className="text-muted" />
                }
              </button>
            </div>
            {!spamGuardEnabled && (
              <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <AlertTriangle size={14} />
                <span>Spam protection is OFF. Your senders may get flagged by carriers and ISPs. Only disable this if you know what you&apos;re doing.</span>
              </div>
            )}
            <div className="mt-4 space-y-2">
              <p className="text-[10px] text-muted uppercase font-semibold tracking-wider">When enabled, enforces:</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { label: "New sender (0-3 days)", email: "20/day, 5/hr", phone: "25/day, 5/hr" },
                  { label: "Warming (3-7 days)", email: "50/day, 10/hr", phone: "75/day, 15/hr" },
                  { label: "Ramping (7-14 days)", email: "150/day, 25/hr", phone: "150/day, 30/hr" },
                  { label: "Full (14+ days)", email: "500/day, 75/hr", phone: "300/day, 50/hr" },
                ].map((tier, i) => (
                  <div key={i} className="p-2 rounded-lg bg-surface-light border border-border text-[10px]">
                    <p className="font-medium text-foreground">{tier.label}</p>
                    <p className="text-muted">Email: {tier.email}</p>
                    <p className="text-muted">Phone: {tier.phone}</p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted mt-2">Plus: bounce rate auto-pause (&gt;5%), complaint auto-pause (&gt;0.1%), minimum delay between sends</p>
            </div>
          </div>

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

      {/* Billing Tab */}
      {tab === "billing" && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="section-header">Current Plan</h3>
            <div className="flex items-center justify-between p-4 bg-gold/5 border border-gold/20 rounded-xl">
              <div>
                <p className="text-lg font-bold" style={{ color: getPlanConfig(profile?.plan_tier).color }}>{getPlanConfig(profile?.plan_tier).badge_label}</p>
                <p className="text-xs text-muted">${getPlanConfig(profile?.plan_tier).price_monthly}/month</p>
              </div>
              <button className="btn-primary text-xs">Upgrade Plan</button>
            </div>
          </div>
          <div className="card">
            <h3 className="section-header">Usage This Month</h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "AI Requests", used: "1,247", limit: getPlanConfig(profile?.plan_tier).ai_requests_per_min === -1 ? "Unlimited" : `${getPlanConfig(profile?.plan_tier).ai_requests_per_min}/min` },
                { label: "Clients", used: String(clients.length), limit: getPlanConfig(profile?.plan_tier).max_clients === -1 ? "Unlimited" : String(getPlanConfig(profile?.plan_tier).max_clients) },
                { label: "AI Tokens", used: "124K", limit: getPlanConfig(profile?.plan_tier).tokens_label },
              ].map(u => (
                <div key={u.label} className="p-3 bg-surface-light/50 rounded-lg border border-border text-center">
                  <p className="text-sm font-bold text-gold">{u.used}</p>
                  <p className="text-[10px] text-muted">{u.label}</p>
                  <p className="text-[9px] text-muted">Limit: {u.limit}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h3 className="section-header">Payment Method</h3>
            {paymentLoading ? (
              <div className="flex items-center gap-3 p-3 bg-surface-light/50 rounded-lg border border-border animate-pulse">
                <div className="w-5 h-5 bg-white/10 rounded" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-32 bg-white/10 rounded" />
                  <div className="h-2 w-20 bg-white/10 rounded" />
                </div>
              </div>
            ) : paymentMethod ? (
              <div className="flex items-center gap-3 p-3 bg-surface-light/50 rounded-lg border border-border">
                <CreditCard size={20} className="text-gold" />
                <div>
                  <p className="text-sm font-medium capitalize">{paymentMethod.brand} ending in {paymentMethod.last4}</p>
                  <p className="text-xs text-muted">Expires {String(paymentMethod.exp_month).padStart(2, "0")}/{paymentMethod.exp_year}</p>
                </div>
                <button
                  onClick={openBillingPortal}
                  disabled={portalLoading}
                  className="ml-auto text-xs text-gold hover:underline flex items-center gap-1 disabled:opacity-50"
                >
                  {portalLoading ? <Loader2 size={10} className="animate-spin" /> : <ExternalLink size={10} />}
                  Update
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-surface-light/50 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <CreditCard size={20} className="text-muted" />
                  <p className="text-sm text-muted">No payment method on file</p>
                </div>
                <button
                  onClick={openBillingPortal}
                  disabled={portalLoading}
                  className="text-xs bg-gold/10 text-gold border border-gold/20 px-3 py-1.5 rounded-lg hover:bg-gold/20 transition flex items-center gap-1 disabled:opacity-50"
                >
                  {portalLoading ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                  Add Payment Method
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* API Keys Tab */}
      {tab === "api_keys" && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="section-header">API Keys</h3>
            <p className="text-xs text-muted mb-4">Manage your API keys for external integrations. Keep these secret.</p>
            <div className="space-y-2 mb-4">
              {apiKeys.length === 0 ? (
                <div className="text-center py-8 text-muted">
                  <Key size={24} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No API keys yet</p>
                </div>
              ) : apiKeys.map(k => (
                <div key={k.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{k.name}</p>
                    <p className="text-xs font-mono text-muted">{k.key}</p>
                    <p className="text-[10px] text-muted">Created: {k.created} | Last used: {k.last_used}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={k.status} />
                    <button onClick={() => { setApiKeys(prev => prev.filter(x => x.id !== k.id)); toast.success("Key revoked"); }} className="text-xs text-danger hover:underline">Revoke</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="Key name..." className="input flex-1 text-sm" />
              <button onClick={() => { if (!newKeyName) { toast.error("Enter a name"); return; } setApiKeys(prev => [...prev, { id: `ak_${Date.now()}`, name: newKeyName, key: `ss_live_${Math.random().toString(36).slice(2, 14)}`, created: "2026-04-14", last_used: "Never", status: "active" }]); setNewKeyName(""); toast.success("Key generated"); }} className="btn-primary text-xs">Generate Key</button>
            </div>
          </div>
        </div>
      )}

      {/* White Label Tab */}
      {tab === "white_label" && (<WhiteLabelTabContent whiteLabel={whiteLabel} setWhiteLabel={setWhiteLabel} wlSaving={wlSaving} setWlSaving={setWlSaving} />)}

      {/* SMTP Tab */}
      {tab === "smtp" && (
        <div className="space-y-4 max-w-3xl">
          {/* Status banner */}
          {smtpVerified && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-success/10 border border-success/20">
              <CheckCircle2 size={16} className="text-success" />
              <span className="text-sm text-success font-medium">SMTP verified and ready to send</span>
            </div>
          )}

          {/* Quick-start provider templates */}
          <div className="card">
            <button
              onClick={() => setSmtpProviderOpen(!smtpProviderOpen)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Cloud size={16} className="text-gold" />
                <h3 className="section-header mb-0">Quick Setup &mdash; Provider Templates</h3>
              </div>
              {smtpProviderOpen ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
            </button>
            {smtpProviderOpen && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {smtpProviders.map(p => (
                  <button
                    key={p.name}
                    onClick={() => applySmtpProvider(p)}
                    className={`group p-3 rounded-lg border text-left transition-all hover:border-gold/40 hover:bg-gold/5 ${
                      smtp.provider === p.name ? "border-gold/50 bg-gold/5" : "border-border"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <span
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                        style={{ backgroundColor: p.color }}
                      >
                        {p.icon}
                      </span>
                      <span className="font-medium text-sm">{p.name}</span>
                      {smtp.provider === p.name && <CheckCircle2 size={14} className="text-gold ml-auto" />}
                    </div>
                    <p className="text-[10px] text-muted leading-relaxed">{p.hint}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* SMTP Configuration Form */}
          <div className="card">
            <div className="flex items-center gap-2 mb-1">
              <Server size={16} className="text-gold" />
              <h3 className="section-header mb-0">SMTP Server Configuration</h3>
            </div>
            <p className="text-xs text-muted mb-4">Configure your SMTP server to send emails from your own domain. All credentials are stored encrypted.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted mb-1">SMTP Host <span className="text-gold">*</span></label>
                <input
                  value={smtp.host}
                  onChange={e => { setSmtp({ ...smtp, host: e.target.value }); setSmtpVerified(false); }}
                  placeholder="smtp.gmail.com"
                  className="input w-full text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Port <span className="text-gold">*</span></label>
                <div className="flex gap-2">
                  <input
                    value={smtp.port}
                    onChange={e => { setSmtp({ ...smtp, port: e.target.value }); setSmtpVerified(false); }}
                    placeholder="587"
                    className="input w-full text-sm"
                  />
                  <div className="flex gap-1">
                    {["587", "465", "25"].map(portOption => (
                      <button
                        key={portOption}
                        onClick={() => { setSmtp({ ...smtp, port: portOption }); setSmtpVerified(false); }}
                        className={`px-2 py-1 text-[10px] rounded border transition-all ${
                          smtp.port === portOption ? "border-gold/50 bg-gold/10 text-gold" : "border-border text-muted hover:border-gold/30"
                        }`}
                      >
                        {portOption}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Username <span className="text-gold">*</span></label>
                <input
                  value={smtp.username}
                  onChange={e => { setSmtp({ ...smtp, username: e.target.value }); setSmtpVerified(false); }}
                  placeholder="you@example.com"
                  className="input w-full text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Password <span className="text-gold">*</span></label>
                <input
                  type="password"
                  value={smtp.password}
                  onChange={e => { setSmtp({ ...smtp, password: e.target.value }); setSmtpVerified(false); }}
                  placeholder="App password or API key"
                  className="input w-full text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">From Email <span className="text-gold">*</span></label>
                <input
                  value={smtp.from_email}
                  onChange={e => { setSmtp({ ...smtp, from_email: e.target.value }); setSmtpVerified(false); }}
                  placeholder="noreply@youragency.com"
                  className="input w-full text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">From Name</label>
                <input
                  value={smtp.from_name}
                  onChange={e => setSmtp({ ...smtp, from_name: e.target.value })}
                  placeholder="Your Agency Name"
                  className="input w-full text-sm"
                />
              </div>
            </div>

            {/* TLS toggle */}
            <div className="flex items-center justify-between mt-4 p-3 bg-surface-light/50 rounded-lg border border-border">
              <div>
                <p className="text-sm font-medium">TLS / SSL Encryption</p>
                <p className="text-[10px] text-muted">Required by most providers. Port 465 uses implicit SSL; ports 587/25 use STARTTLS.</p>
              </div>
              <button
                onClick={() => { setSmtp({ ...smtp, use_tls: !smtp.use_tls }); setSmtpVerified(false); }}
                className="flex items-center gap-1.5 transition-all"
              >
                {smtp.use_tls
                  ? <ToggleRight size={28} className="text-gold" />
                  : <ToggleLeft size={28} className="text-muted" />
                }
                <span className={`text-xs font-medium ${smtp.use_tls ? "text-gold" : "text-muted"}`}>
                  {smtp.use_tls ? "Enabled" : "Disabled"}
                </span>
              </button>
            </div>

            {/* Test result banner */}
            {smtpTestResult && (
              <div className={`mt-4 p-3 rounded-lg border ${
                smtpTestResult.success
                  ? "bg-success/10 border-success/20"
                  : "bg-danger/10 border-danger/20"
              }`}>
                <div className="flex items-start gap-2">
                  {smtpTestResult.success
                    ? <CheckCircle2 size={16} className="text-success mt-0.5 shrink-0" />
                    : <XCircle size={16} className="text-danger mt-0.5 shrink-0" />
                  }
                  <div>
                    <p className={`text-sm font-medium ${smtpTestResult.success ? "text-success" : "text-danger"}`}>
                      {smtpTestResult.success ? "Connection Successful" : "Connection Failed"}
                    </p>
                    <p className="text-xs text-muted mt-0.5">{smtpTestResult.message}</p>
                    {smtpTestResult.hint && (
                      <p className="text-xs text-muted/70 mt-1 italic">{smtpTestResult.hint}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3 mt-5">
              <button
                onClick={saveSmtp}
                disabled={smtpSaving || !smtp.host || !smtp.port || !smtp.username || !smtp.from_email}
                className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {smtpSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {smtpSaving ? "Saving..." : "Save Configuration"}
              </button>
              <button
                onClick={testSmtp}
                disabled={smtpTesting || !smtp.host || !smtp.port || !smtp.username || !smtp.from_email}
                className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {smtpTesting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {smtpTesting ? "Sending Test..." : "Test Connection"}
              </button>
            </div>
          </div>

          {/* Help section */}
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <Info size={16} className="text-gold" />
              <h3 className="section-header mb-0">Setup Guide</h3>
            </div>
            <div className="space-y-2 text-xs text-muted">
              <div className="flex items-start gap-2 p-2 bg-surface-light/30 rounded">
                <span className="text-gold font-bold mt-px">1.</span>
                <p>Select a provider template above or enter your SMTP server details manually.</p>
              </div>
              <div className="flex items-start gap-2 p-2 bg-surface-light/30 rounded">
                <span className="text-gold font-bold mt-px">2.</span>
                <p>Enter your credentials. For Gmail, enable 2-Step Verification and create an App Password at <span className="text-gold">myaccount.google.com/apppasswords</span>.</p>
              </div>
              <div className="flex items-start gap-2 p-2 bg-surface-light/30 rounded">
                <span className="text-gold font-bold mt-px">3.</span>
                <p>Click <strong className="text-foreground">Save Configuration</strong>, then <strong className="text-foreground">Test Connection</strong> to verify everything works. A test email will be sent to your account.</p>
              </div>
              <div className="flex items-start gap-2 p-2 bg-surface-light/30 rounded">
                <span className="text-gold font-bold mt-px">4.</span>
                <p>Common ports: <strong className="text-foreground">587</strong> (STARTTLS, recommended), <strong className="text-foreground">465</strong> (implicit SSL), <strong className="text-foreground">25</strong> (unencrypted, not recommended).</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {tab === "security" && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="section-header">Two-Factor Authentication</h3>
            <div className="flex items-center justify-between p-4 bg-surface-light/50 rounded-lg border border-border">
              <div><p className="text-sm font-medium">2FA via Authenticator App</p><p className="text-xs text-muted">{twoFA ? "Enabled and protecting your account" : "Not enabled - we recommend enabling 2FA"}</p></div>
              <button onClick={() => { setTwoFA(!twoFA); toast.success(twoFA ? "2FA disabled" : "2FA enabled"); }} className={`px-3 py-1.5 rounded text-xs ${twoFA ? "bg-danger/10 text-danger border border-danger/20" : "bg-success/10 text-success border border-success/20"}`}>{twoFA ? "Disable" : "Enable"}</button>
            </div>
          </div>
          <div className="card">
            <h3 className="section-header">Active Sessions</h3>
            <div className="space-y-2">
              {sessions.length === 0 ? (
                <div className="text-center py-8 text-muted">
                  <Shield size={24} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No active sessions yet</p>
                </div>
              ) : sessions.map((s, i) => (
                <div key={i} className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div><p className="text-sm font-medium">{s.device} {s.current && <span className="text-[9px] bg-success/10 text-success px-1.5 py-0.5 rounded-full ml-1">Current</span>}</p><p className="text-xs text-muted">IP: {s.ip} | Last active: {new Date(s.last_active).toLocaleString()}</p></div>
                  {!s.current && <button className="text-xs text-danger hover:underline">Revoke</button>}
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h3 className="section-header">Password</h3>
            <button onClick={() => toast.success("Password reset email sent")} className="btn-secondary text-xs flex items-center gap-2"><Lock size={14} /> Change Password</button>
          </div>
        </div>
      )}

      {/* Import/Export Tab */}
      {tab === "data" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="card">
              <h3 className="section-header flex items-center gap-2"><Download size={16} /> Export Data</h3>
              <p className="text-xs text-muted mb-3">Download your data as CSV or JSON.</p>
              <div className="space-y-2">
                {["Clients", "Leads", "Invoices", "Content Scripts", "Outreach Log", "All Data"].map(item => (
                  <button key={item} onClick={() => toast.success(`Exporting ${item}...`)} className="w-full text-left p-2.5 border border-border rounded-lg text-xs hover:border-gold/30 transition-all flex items-center justify-between">
                    <span>{item}</span><Download size={12} className="text-gold" />
                  </button>
                ))}
              </div>
            </div>
            <div className="card">
              <h3 className="section-header flex items-center gap-2"><Upload size={16} /> Import Data</h3>
              <p className="text-xs text-muted mb-3">Import data from CSV files.</p>
              <div className="space-y-2">
                {["Clients (CSV)", "Leads (CSV)", "Contacts (CSV)"].map(item => (
                  <button key={item} onClick={() => toast.success(`Import ${item} - coming soon`)} className="w-full text-left p-2.5 border border-border rounded-lg text-xs hover:border-gold/30 transition-all flex items-center justify-between">
                    <span>{item}</span><Upload size={12} className="text-gold" />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="card">
            <h3 className="section-header">Timezone & Language</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs text-muted mb-1">Timezone</label><select value={timezone} onChange={e => setTimezone(e.target.value)} className="input w-full text-sm"><option value="Europe/Copenhagen">Europe/Copenhagen (CET)</option><option value="America/New_York">America/New York (EST)</option><option value="America/Los_Angeles">America/Los Angeles (PST)</option><option value="UTC">UTC</option></select></div>
              <div><label className="block text-xs text-muted mb-1">Language</label><select value={language} onChange={e => setLanguage(e.target.value)} className="input w-full text-sm"><option value="en">English</option><option value="da">Danish</option><option value="es">Spanish</option><option value="de">German</option></select></div>
            </div>
          </div>
        </div>
      )}

      {/* Danger Zone Tab */}
      {tab === "danger" && (
        <div className="space-y-4">
          <div className="p-4 bg-danger/5 border border-danger/20 rounded-xl">
            <h3 className="text-sm font-medium text-danger flex items-center gap-2"><AlertTriangle size={14} /> Danger Zone</h3>
            <p className="text-xs text-muted mt-1">These actions are irreversible. Proceed with extreme caution.</p>
          </div>
          <div className="card border-danger/20">
            <h3 className="section-header text-danger">Delete Account</h3>
            <p className="text-xs text-muted mb-3">Permanently delete your account and all associated data. This cannot be undone.</p>
            <div className="flex gap-2">
              <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="Type DELETE to confirm" className="input flex-1 text-sm" />
              <button disabled={deleteConfirm !== "DELETE"} onClick={() => toast.error("Account deletion is disabled in demo")} className="px-4 py-2 bg-danger text-white rounded-lg text-xs disabled:opacity-30"><Trash2 size={14} /></button>
            </div>
          </div>
          <div className="card border-warning/20">
            <h3 className="section-header text-warning">Reset All Data</h3>
            <p className="text-xs text-muted mb-2">Reset all clients, leads, and content to a fresh state. Your account settings will be preserved.</p>
            <button onClick={() => toast.error("Data reset is disabled in demo")} className="btn-secondary text-xs text-warning border-warning/20">Reset Data</button>
          </div>
          <div className="card">
            <h3 className="section-header">Audit Log</h3>
            <p className="text-xs text-muted mb-2">View a complete history of all actions taken on your account.</p>
            <a href="/dashboard/audit" className="text-xs text-gold hover:underline flex items-center gap-1"><Eye size={12} /> View Audit Log</a>
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

/* ─── White Label Tab (extracted component) ──────────────────────────── */
type WLState = { company_name: string; logo_url: string; primary_color: string; accent_color: string; favicon_url: string; login_text: string; show_powered_by: boolean; domain: string; support_email: string };

function WhiteLabelTabContent({
  whiteLabel,
  setWhiteLabel,
  wlSaving,
  setWlSaving,
}: {
  whiteLabel: WLState;
  setWhiteLabel: React.Dispatch<React.SetStateAction<WLState>>;
  wlSaving: boolean;
  setWlSaving: (v: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left column — Config form */}
      <div className="lg:col-span-2 space-y-4">
        <div className="card">
          <h3 className="section-header flex items-center gap-2">
            <Palette size={14} className="text-gold" /> Branding
          </h3>
          <p className="text-xs text-muted mb-4">Rebrand ShortStack as your own platform. Changes apply across the sidebar, login page, and client portal.</p>

          <div className="space-y-4">
            {/* Company Name */}
            <div>
              <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Company Name</label>
              <input value={whiteLabel.company_name} onChange={e => setWhiteLabel({ ...whiteLabel, company_name: e.target.value })} placeholder="Your Agency Name (replaces ShortStack)" className="input w-full text-sm" />
              <p className="text-[9px] text-muted mt-1">Displayed in the sidebar, page titles, and client-facing UI</p>
            </div>

            {/* Logo Upload */}
            <div>
              <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Logo URL</label>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg border border-border bg-surface-light flex items-center justify-center overflow-hidden shrink-0">
                  {whiteLabel.logo_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={whiteLabel.logo_url} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <Palette size={16} className="text-muted" />
                  )}
                </div>
                <input value={whiteLabel.logo_url} onChange={e => setWhiteLabel({ ...whiteLabel, logo_url: e.target.value })} placeholder="https://yourdomain.com/logo.png" className="input flex-1 text-sm" />
              </div>
              <p className="text-[9px] text-muted mt-1">Square image recommended (PNG/SVG, at least 128x128px)</p>
            </div>

            {/* Colors */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Primary Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={whiteLabel.primary_color} onChange={e => setWhiteLabel({ ...whiteLabel, primary_color: e.target.value })} className="w-10 h-10 rounded-lg border border-border cursor-pointer" style={{ padding: 2 }} />
                  <input value={whiteLabel.primary_color} onChange={e => setWhiteLabel({ ...whiteLabel, primary_color: e.target.value })} className="input flex-1 text-sm font-mono" placeholder="#C9A84C" />
                </div>
                <p className="text-[9px] text-muted mt-1">Replaces gold (#C9A84C) across buttons, links, active states</p>
              </div>
              <div>
                <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Accent Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={whiteLabel.accent_color} onChange={e => setWhiteLabel({ ...whiteLabel, accent_color: e.target.value })} className="w-10 h-10 rounded-lg border border-border cursor-pointer" style={{ padding: 2 }} />
                  <input value={whiteLabel.accent_color} onChange={e => setWhiteLabel({ ...whiteLabel, accent_color: e.target.value })} className="input flex-1 text-sm font-mono" placeholder="#B8942F" />
                </div>
                <p className="text-[9px] text-muted mt-1">Secondary accent for hover states and highlights</p>
              </div>
            </div>

            {/* Favicon */}
            <div>
              <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Favicon URL</label>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded border border-border bg-surface-light flex items-center justify-center overflow-hidden shrink-0">
                  {whiteLabel.favicon_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={whiteLabel.favicon_url} alt="Favicon" className="w-full h-full object-contain" />
                  ) : (
                    <Globe size={12} className="text-muted" />
                  )}
                </div>
                <input value={whiteLabel.favicon_url} onChange={e => setWhiteLabel({ ...whiteLabel, favicon_url: e.target.value })} placeholder="https://yourdomain.com/favicon.ico" className="input flex-1 text-sm" />
              </div>
            </div>

            {/* Login Page Text */}
            <div>
              <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Custom Login Page Text</label>
              <textarea
                value={whiteLabel.login_text}
                onChange={e => setWhiteLabel({ ...whiteLabel, login_text: e.target.value })}
                placeholder="Welcome to your agency dashboard. Sign in to manage your campaigns, analytics, and more."
                rows={3}
                className="input w-full text-sm resize-none"
              />
              <p className="text-[9px] text-muted mt-1">Shown on the login page below your logo</p>
            </div>

            {/* Powered By toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface-light border border-border">
              <div>
                <p className="text-xs font-medium">Show &quot;Powered by ShortStack&quot;</p>
                <p className="text-[10px] text-muted">Display attribution footer in sidebar and client portal</p>
              </div>
              <button onClick={() => setWhiteLabel({ ...whiteLabel, show_powered_by: !whiteLabel.show_powered_by })}
                className={`w-10 h-5 rounded-full transition-colors ${whiteLabel.show_powered_by ? "bg-gold" : "bg-surface-light border border-border"}`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${whiteLabel.show_powered_by ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-5 pt-4 border-t border-border">
            <button
              disabled={wlSaving}
              onClick={async () => {
                setWlSaving(true);
                try {
                  const res = await fetch("/api/white-label", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      company_name: whiteLabel.company_name || null,
                      logo_url: whiteLabel.logo_url || null,
                      primary_color: whiteLabel.primary_color || null,
                      accent_color: whiteLabel.accent_color || null,
                      favicon_url: whiteLabel.favicon_url || null,
                      login_text: whiteLabel.login_text || null,
                      show_powered_by: whiteLabel.show_powered_by,
                    }),
                  });
                  if (res.ok) {
                    if (whiteLabel.primary_color && whiteLabel.primary_color !== "#C9A84C") {
                      document.documentElement.style.setProperty("--color-accent", whiteLabel.primary_color);
                      document.documentElement.style.setProperty("--wl-primary", whiteLabel.primary_color);
                    } else {
                      document.documentElement.style.removeProperty("--wl-primary");
                    }
                    if (whiteLabel.accent_color && whiteLabel.accent_color !== "#B8942F") {
                      document.documentElement.style.setProperty("--wl-accent", whiteLabel.accent_color);
                    } else {
                      document.documentElement.style.removeProperty("--wl-accent");
                    }
                    localStorage.setItem("ss_white_label", JSON.stringify(whiteLabel));
                    window.dispatchEvent(new Event("white-label-update"));
                    toast.success("White label branding saved");
                  } else {
                    toast.error("Failed to save — try again");
                  }
                } catch {
                  toast.error("Connection error");
                }
                setWlSaving(false);
              }}
              className="btn-primary text-xs flex items-center gap-2"
            >
              <Save size={12} /> {wlSaving ? "Saving..." : "Save White Label"}
            </button>
            <button
              onClick={() => {
                setWhiteLabel({ company_name: "", logo_url: "", primary_color: "#C9A84C", accent_color: "#B8942F", favicon_url: "", login_text: "", show_powered_by: true, domain: "", support_email: "" });
                toast.success("Reset to defaults — click Save to apply");
              }}
              className="btn-secondary text-xs flex items-center gap-2"
            >
              <RotateCcw size={12} /> Reset to Defaults
            </button>
          </div>
        </div>
      </div>

      {/* Right column — Live Preview */}
      <div className="space-y-4">
        <div className="card-static">
          <h3 className="section-header flex items-center gap-2">
            <Eye size={14} className="text-gold" /> Live Preview
          </h3>
          <p className="text-[9px] text-muted mb-3">How your branding will appear</p>

          {/* Sidebar preview */}
          <div className="rounded-xl border border-border overflow-hidden bg-surface-light">
            <div className="p-3 border-b border-border flex items-center gap-2" style={{ background: "var(--color-surface)" }}>
              {whiteLabel.logo_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={whiteLabel.logo_url} alt="" className="w-6 h-6 rounded object-contain" />
              ) : (
                <div className="w-6 h-6 rounded bg-gold/10 flex items-center justify-center">
                  <Palette size={10} style={{ color: whiteLabel.primary_color || "#C9A84C" }} />
                </div>
              )}
              <span className="text-xs font-bold truncate" style={{ color: "var(--color-foreground)" }}>
                {whiteLabel.company_name || "ShortStack"}
              </span>
            </div>
            <div className="p-2 space-y-0.5">
              {["Dashboard", "Analytics", "CRM", "Clients"].map((item, i) => (
                <div key={item}
                  className="px-2.5 py-1.5 rounded-lg text-[10px] flex items-center gap-2"
                  style={i === 0 ? {
                    color: whiteLabel.primary_color || "#C9A84C",
                    background: `${whiteLabel.primary_color || "#C9A84C"}10`,
                    fontWeight: 600,
                  } : { color: "var(--color-muted)" }}
                >
                  <div className="w-3 h-3 rounded" style={i === 0 ? { background: `${whiteLabel.primary_color || "#C9A84C"}20` } : { background: "var(--color-border)" }} />
                  {item}
                </div>
              ))}
            </div>
            {whiteLabel.show_powered_by && (
              <div className="px-3 py-2 border-t border-border text-center">
                <span className="text-[8px] text-muted">Powered by ShortStack</span>
              </div>
            )}
          </div>

          {/* Button preview */}
          <div className="mt-4 space-y-2">
            <p className="text-[9px] text-muted uppercase tracking-wider font-medium">Buttons</p>
            <div className="flex gap-2">
              <span className="text-[10px] font-semibold px-3 py-1.5 rounded-lg text-white inline-block" style={{ background: whiteLabel.primary_color || "#C9A84C" }}>
                Primary
              </span>
              <span className="text-[10px] font-medium px-3 py-1.5 rounded-lg border inline-block" style={{ borderColor: `${whiteLabel.primary_color || "#C9A84C"}40`, color: whiteLabel.primary_color || "#C9A84C" }}>
                Secondary
              </span>
            </div>
          </div>

          {/* Color swatch preview */}
          <div className="mt-4 space-y-2">
            <p className="text-[9px] text-muted uppercase tracking-wider font-medium">Accents</p>
            <div className="flex gap-2 items-center">
              <div className="w-4 h-4 rounded-full" style={{ background: whiteLabel.primary_color || "#C9A84C" }} />
              <span className="text-[10px] font-mono" style={{ color: whiteLabel.primary_color || "#C9A84C" }}>{whiteLabel.primary_color || "#C9A84C"}</span>
            </div>
            <div className="flex gap-2 items-center">
              <div className="w-4 h-4 rounded-full" style={{ background: whiteLabel.accent_color || "#B8942F" }} />
              <span className="text-[10px] font-mono" style={{ color: whiteLabel.accent_color || "#B8942F" }}>{whiteLabel.accent_color || "#B8942F"}</span>
            </div>
          </div>

          {/* Login preview */}
          {whiteLabel.login_text && (
            <div className="mt-4 space-y-2">
              <p className="text-[9px] text-muted uppercase tracking-wider font-medium">Login Page</p>
              <div className="p-3 rounded-lg border border-border bg-surface text-center">
                {whiteLabel.logo_url && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={whiteLabel.logo_url} alt="" className="w-8 h-8 rounded mx-auto mb-2 object-contain" />
                )}
                <p className="text-[10px] text-muted leading-relaxed">{whiteLabel.login_text}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
