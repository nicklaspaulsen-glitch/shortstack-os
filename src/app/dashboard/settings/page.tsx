"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

import { createClient } from "@/lib/supabase/client";
import { Client } from "@/lib/types";
import StatusBadge from "@/components/ui/status-badge";
import Modal from "@/components/ui/modal";
import { Settings, Bot, Zap, Globe, Bell, Save, Volume2, VolumeX, Info, Palette, Monitor, User, Camera, CreditCard, ExternalLink, Key, Shield, Mail, Download, Upload, Trash2, AlertTriangle, Eye, Lock, Database, RotateCcw, CheckCircle2, Loader2, Server, ChevronDown, ChevronUp, Send, ToggleLeft, ToggleRight, Cloud, XCircle, Plus, Sparkles, PanelLeft, Sliders, Building2, ShieldCheck, Keyboard, HardDrive, Gauge, Link2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import toast from "react-hot-toast";
import { applyTheme } from "@/components/theme-provider";
import { getPlanConfig } from "@/lib/plan-config";
import PageHero from "@/components/ui/page-hero";
import { useAutoSave } from "@/lib/use-auto-save";
import AutoSaveIndicator from "@/components/ui/auto-save-indicator";
import SidebarCustomizerFull from "@/components/settings/sidebar-customizer-full";
import InlineSocialConnect from "@/components/inline-social-connect";
import AgencyStripeConnect from "@/components/settings/agency-stripe-connect";
import ErrorBoundary from "@/components/error-boundary";

// ── Lazy-loaded settings section components ──────────────────────────────
// Account (general) tab is eagerly imported — it's the default landing tab.
import AccountSettings from "@/components/settings/AccountSettings";

function SettingsTabSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="card">
          <div className="h-4 w-32 bg-surface-light rounded animate-pulse mb-3" />
          <div className="space-y-2">
            <div className="h-8 bg-surface-light rounded animate-pulse" />
            <div className="h-8 bg-surface-light rounded animate-pulse w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

const BillingSettings = dynamic(
  () => import("@/components/settings/BillingSettings"),
  { ssr: false, loading: () => <SettingsTabSkeleton /> },
);
const IntegrationsSettings = dynamic(
  () => import("@/components/settings/IntegrationsSettings"),
  { ssr: false, loading: () => <SettingsTabSkeleton /> },
);
const NotificationSettings = dynamic(
  () => import("@/components/settings/NotificationSettings"),
  { ssr: false, loading: () => <SettingsTabSkeleton /> },
);
const WhiteLabelSettings = dynamic(
  () => import("@/components/settings/WhiteLabelSettings"),
  { ssr: false, loading: () => <SettingsTabSkeleton /> },
);
const AgentSettings = dynamic(
  () => import("@/components/settings/AgentSettings"),
  { ssr: false, loading: () => <SettingsTabSkeleton /> },
);
const SecuritySettings = dynamic(
  () => import("@/components/settings/SecuritySettings"),
  { ssr: false, loading: () => <SettingsTabSkeleton /> },
);

type Tab =
  | "general" | "agents" | "integrations" | "automation" | "notifications"
  | "billing" | "api_keys" | "white_label" | "smtp" | "security" | "data" | "danger"
  // New tabs
  | "sidebar" | "appearance" | "ai_prefs" | "workspace" | "privacy"
  | "shortcuts" | "backups" | "usage_limits" | "connected_apps";

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

  // API Keys — loaded from /api/settings/api-keys on mount; POST/DELETE write
  // through to the api_keys table via the same route.
  const [apiKeys, setApiKeys] = useState<Array<{ id: string; name: string; key: string; created: string; last_used: string; status: string }>>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [justCreatedKey, setJustCreatedKey] = useState<string | null>(null);

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

  // ─── New-tab state: Appearance ─────────────────────────────
  const [appearance, setAppearance] = useState(() => {
    if (typeof window === "undefined") return {
      theme: "system", density: "comfortable", animations: true, reduce_motion: false,
      font_size: 14, sidebar_position: "left" as "left" | "right",
    };
    try {
      const saved = safeGet("ss-appearance");
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      theme: "system", density: "comfortable", animations: true, reduce_motion: false,
      font_size: 14, sidebar_position: "left" as "left" | "right",
    };
  });

  // ─── AI Preferences ──────────────────────────────────────
  const [aiPrefs, setAiPrefs] = useState(() => {
    if (typeof window === "undefined") return {
      default_model: "claude-sonnet-4-6", response_style: "detailed", language: "en",
      temperature: 0.7, experimental: false,
    };
    try { const s = safeGet("ss-ai-prefs"); if (s) return JSON.parse(s); } catch {}
    return {
      default_model: "claude-sonnet-4-6", response_style: "detailed", language: "en",
      temperature: 0.7, experimental: false,
    };
  });

  // ─── Workspace ────────────────────────────────────────────
  const [workspace, setWorkspace] = useState(() => {
    if (typeof window === "undefined") return {
      workspace_name: "", timezone: "Europe/Copenhagen", week_start: "monday",
      date_format: "YYYY-MM-DD", currency: "USD", measurement: "metric",
    };
    try { const s = safeGet("ss-workspace"); if (s) return JSON.parse(s); } catch {}
    return {
      workspace_name: "", timezone: "Europe/Copenhagen", week_start: "monday",
      date_format: "YYYY-MM-DD", currency: "USD", measurement: "metric",
    };
  });

  // ─── Privacy ─────────────────────────────────────────────
  const [privacy, setPrivacy] = useState(() => {
    if (typeof window === "undefined") return {
      public_profile: false, analytics_opt_out: false,
      cookies: { essential: true, analytics: true, marketing: false },
      data_visibility: "team" as "private" | "team" | "public",
    };
    try { const s = safeGet("ss-privacy"); if (s) return JSON.parse(s); } catch {}
    return {
      public_profile: false, analytics_opt_out: false,
      cookies: { essential: true, analytics: true, marketing: false },
      data_visibility: "team" as "private" | "team" | "public",
    };
  });

  // ─── Backups ─────────────────────────────────────────────
  const [backup, setBackup] = useState(() => {
    if (typeof window === "undefined") return {
      auto_backup_enabled: false, frequency: "weekly", last_backup: null as string | null,
    };
    try { const s = safeGet("ss-backup"); if (s) return JSON.parse(s); } catch {}
    return { auto_backup_enabled: false, frequency: "weekly", last_backup: null as string | null };
  });
  const [restorePreview, setRestorePreview] = useState<Record<string, number> | null>(null);
  const [restorePayload, setRestorePayload] = useState<Record<string, unknown> | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);

  // ─── Usage Limits ────────────────────────────────────────
  const [usageLimits, setUsageLimits] = useState({
    max_tokens_per_day: 0, max_videos_per_day: 0, max_thumbnails_per_day: 0,
    max_emails_per_day: 0, warn_at_percent: 85, warning_enabled: true,
  });
  const [usageLimitsLoaded, setUsageLimitsLoaded] = useState(false);

  // ─── Plan-tier monthly usage (from /api/usage/current) ───
  const [planUsage, setPlanUsage] = useState<{
    plan_tier: string;
    usage: Record<string, number>;
    limits: Record<string, number | "unlimited">;
    remaining: Record<string, number | "unlimited">;
  } | null>(null);
  const [planUsageLoaded, setPlanUsageLoaded] = useState(false);

  // ─── Connected Apps ──────────────────────────────────────
  const [connectedApps, setConnectedApps] = useState<Array<{
    id: string; platform: string; account_name: string | null; created_at: string;
    last_used?: string | null; is_active?: boolean;
  }>>([]);
  const [connectedAppsLoading, setConnectedAppsLoading] = useState(false);

  // Persist new tab state to localStorage
  useEffect(() => { if (typeof window !== "undefined") safeSet("ss-appearance", JSON.stringify(appearance)); }, [appearance]);
  useEffect(() => { if (typeof window !== "undefined") safeSet("ss-ai-prefs", JSON.stringify(aiPrefs)); }, [aiPrefs]);
  useEffect(() => { if (typeof window !== "undefined") safeSet("ss-workspace", JSON.stringify(workspace)); }, [workspace]);
  useEffect(() => { if (typeof window !== "undefined") safeSet("ss-privacy", JSON.stringify(privacy)); }, [privacy]);
  useEffect(() => { if (typeof window !== "undefined") safeSet("ss-backup", JSON.stringify(backup)); }, [backup]);

  // Load API keys when that tab opens — hits /api/settings/api-keys which
  // reads the api_keys table (hashed keys, never returns the raw secret
  // after creation).
  useEffect(() => {
    if (tab !== "api_keys") return;
    setApiKeysLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/settings/api-keys");
        if (res.ok) {
          const data = await res.json();
          setApiKeys(data.keys || []);
        }
      } finally {
        setApiKeysLoading(false);
      }
    })();
  }, [tab]);

  // Load usage limits when that tab opens
  useEffect(() => {
    if (tab !== "usage_limits" || usageLimitsLoaded) return;
    (async () => {
      try {
        const res = await fetch("/api/user/usage-limits");
        if (res.ok) {
          const data = await res.json();
          if (data?.limits) setUsageLimits(data.limits);
        }
      } catch {}
      setUsageLimitsLoaded(true);
    })();
  }, [tab, usageLimitsLoaded]);

  // Load plan-tier monthly usage when billing tab opens
  useEffect(() => {
    if (tab !== "billing" || planUsageLoaded) return;
    (async () => {
      try {
        const res = await fetch("/api/usage/current");
        if (res.ok) {
          const data = await res.json();
          setPlanUsage(data);
        }
      } catch {}
      setPlanUsageLoaded(true);
    })();
  }, [tab, planUsageLoaded]);

  // Load connected apps when that tab opens
  useEffect(() => {
    if (tab !== "connected_apps") return;
    setConnectedAppsLoading(true);
    (async () => {
      try {
        // Try oauth_connections first; fall back to social_accounts.
        // Use maybeSingle() instead of single() so a missing client row doesn't throw.
        const { data: firstClient } = await supabase
          .from("clients").select("id").eq("is_active", true).limit(1).maybeSingle();
        if (firstClient) {
          const r = await fetch(`/api/social/connect?client_id=${firstClient.id}&zernio=true`);
          if (r.ok) {
            const j = await r.json();
            const rows = (j?.accounts || []) as Array<{
              id: string; platform: string; account_name: string; created_at?: string;
              is_active?: boolean; token_expires_at?: string | null;
            }>;
            // Filter out any inactive rows that lingered from the old is_active-flip
            // revoke flow; users reported "bubbles that don't save" where the revoked
            // tile kept reappearing. Revoke now deletes the row outright, but this
            // guard keeps existing soft-deleted rows from polluting the list.
            setConnectedApps(rows.filter(r => r.is_active !== false).map(r => ({
              id: r.id,
              platform: r.platform,
              account_name: r.account_name || null,
              created_at: r.created_at || new Date().toISOString(),
              last_used: r.token_expires_at || null,
              is_active: r.is_active,
            })));
          }
        }
      } catch {
        // ignore
      }
      setConnectedAppsLoading(false);
    })();
  }, [tab, supabase]);

  // ─── AutoSave for workspace name + nickname + timezone + language ─
  // Auto-save state for profile (nickname + timezone + language)
  // Timezone and language persist to localStorage (no API backing yet)
  const autoSaveValue = useMemo(() => ({ nickname, timezone, language }), [nickname, timezone, language]);
  const autoSave = useCallback(async (v: { nickname: string; timezone: string; language: string }) => {
    // Persist local prefs
    if (typeof window !== "undefined") {
      safeSet("ss-timezone", v.timezone);
      safeSet("ss-language", v.language);
    }
    // Only hit API for nickname when it changed vs profile
    if (profile && v.nickname !== (profile.nickname || "")) {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: v.nickname }),
      });
      if (!res.ok) throw new Error("Failed to save profile");
      await refreshProfile();
    }
  }, [profile, refreshProfile]);
  const { status: autoSaveStatus, lastSavedAt: autoSaveAt, error: autoSaveError } = useAutoSave({
    value: autoSaveValue,
    save: autoSave,
    delay: 900,
    skip: (v) => !profile || (v.nickname === (profile?.nickname || "") && v.timezone === (safeGet("ss-timezone") || "Europe/Copenhagen") && v.language === (safeGet("ss-language") || "en")),
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); fetchSocialAccounts(); }, []);
  useEffect(() => { if (profile?.nickname) setNickname(profile.nickname); }, [profile]);

  // Load persisted timezone/language on mount
  useEffect(() => {
    const tz = safeGet("ss-timezone");
    const lang = safeGet("ss-language");
    if (tz) setTimezone(tz);
    if (lang) setLanguage(lang);
  }, []);

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
    { name: "Resend", host: "smtp.resend.com", port: "587", use_tls: true, icon: "R", color: "#000000", hint: "Username is 'resend', password is your Resend API key (starts with re_)" },
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

  // ── Save helpers for new tabs ─────────────────────────────────
  const saveUsageLimits = useCallback(async (patch: Partial<typeof usageLimits>) => {
    const next = { ...usageLimits, ...patch };
    setUsageLimits(next);
    try {
      const res = await fetch("/api/user/usage-limits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error("save failed");
    } catch {
      toast.error("Failed to save usage limits");
    }
  }, [usageLimits]);

  const downloadBackup = useCallback(async () => {
    try {
      const res = await fetch("/api/user/backup", { cache: "no-store" });
      if (!res.ok) throw new Error("export failed");
      const blob = await res.blob();
      const date = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `shortstack-backup-${date}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setBackup((b: typeof backup) => ({ ...b, last_backup: new Date().toISOString() }));
      toast.success("Backup downloaded");
    } catch {
      toast.error("Couldn't export backup");
    }
  }, []);

  const previewRestore = useCallback(async (file: File) => {
    setRestoreLoading(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Record<string, unknown>;
      setRestorePayload(parsed);
      const res = await fetch("/api/user/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "restore failed");
      setRestorePreview(j.counts || {});
      toast.success("Backup validated — click Apply to commit");
    } catch (err) {
      console.error(err);
      toast.error("Invalid backup file");
      setRestorePayload(null);
      setRestorePreview(null);
    }
    setRestoreLoading(false);
  }, []);

  const applyRestore = useCallback(async () => {
    if (!restorePayload) return;
    setRestoreLoading(true);
    try {
      const res = await fetch("/api/user/backup/restore?apply=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(restorePayload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "restore failed");
      setRestorePreview(j.counts || {});
      setRestorePayload(null);
      toast.success("Backup applied");
    } catch {
      toast.error("Couldn't apply backup");
    }
    setRestoreLoading(false);
  }, [restorePayload]);

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "general", label: "General", icon: <Settings size={16} /> },
    { key: "sidebar", label: "Sidebar", icon: <PanelLeft size={16} /> },
    { key: "appearance", label: "Appearance", icon: <Palette size={16} /> },
    { key: "ai_prefs", label: "AI Preferences", icon: <Sparkles size={16} /> },
    { key: "workspace", label: "Workspace", icon: <Building2 size={16} /> },
    { key: "agents", label: "AI Agents", icon: <Bot size={16} /> },
    { key: "integrations", label: "Integrations", icon: <Globe size={16} /> },
    { key: "connected_apps", label: "Connected Apps", icon: <Link2 size={16} /> },
    { key: "automation", label: "Automation", icon: <Zap size={16} /> },
    { key: "notifications", label: "Notifications", icon: <Bell size={16} /> },
    { key: "billing", label: "Billing", icon: <CreditCard size={16} /> },
    { key: "usage_limits", label: "Usage Limits", icon: <Gauge size={16} /> },
    { key: "api_keys", label: "API Keys", icon: <Key size={16} /> },
    { key: "white_label", label: "White Label", icon: <Palette size={16} /> },
    { key: "smtp", label: "SMTP", icon: <Mail size={16} /> },
    { key: "privacy", label: "Privacy", icon: <ShieldCheck size={16} /> },
    { key: "security", label: "Security", icon: <Shield size={16} /> },
    { key: "shortcuts", label: "Shortcuts", icon: <Keyboard size={16} /> },
    { key: "backups", label: "Backups", icon: <HardDrive size={16} /> },
    { key: "data", label: "Import/Export", icon: <Database size={16} /> },
    { key: "danger", label: "Danger Zone", icon: <AlertTriangle size={16} /> },
  ];

  return (
    <div className="fade-in space-y-6">
      <ErrorBoundary section="Settings">
      <AutoSaveIndicator status={autoSaveStatus} lastSavedAt={autoSaveAt} error={autoSaveError} />
      <PageHero
        icon={<Settings size={28} />}
        title="Settings"
        subtitle="Configure agents, integrations & automation."
        gradient="blue"
      />

      <div className="flex flex-wrap gap-1 bg-surface rounded-lg p-1">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-xs rounded-md flex items-center gap-1.5 transition-all ${tab === t.key ? "bg-gold text-black font-medium" : "text-muted hover:text-foreground"}`}
          >{t.icon} {t.label}</button>
        ))}
      </div>

      {/* General Tab — AccountSettings is eagerly loaded (default tab) */}
      {tab === "general" && (
        <AccountSettings
          profile={profile}
          nickname={nickname}
          setNickname={setNickname}
          savingProfile={savingProfile}
          setSavingProfile={setSavingProfile}
          refreshProfile={refreshProfile}
          sfxEnabled={sfxEnabled}
          toggleSfx={toggleSfx}
          forceRerender={rerender}
        />
      )}

      {/* AI Agents Tab — lazy */}
      {tab === "agents" && (
        <AgentSettings
          agentConfigs={agentConfigs}
          editingAgent={editingAgent}
          setEditingAgent={setEditingAgent}
          saveAgentConfig={saveAgentConfig}
        />
      )}

      {/* Integrations Tab — lazy */}
      {tab === "integrations" && (
        <IntegrationsSettings
          socialAccounts={socialAccounts}
          socialLoading={socialLoading}
          disconnectingSocial={disconnectingSocial}
          healthData={healthData}
          disconnectSocialAccount={disconnectSocialAccount}
        />
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

      {/* Notifications Tab — lazy */}
      {tab === "notifications" && <NotificationSettings />}

      {/* Billing Tab — lazy */}
      {tab === "billing" && (
        <BillingSettings
          profile={profile}
          planUsage={planUsage}
          planUsageLoaded={planUsageLoaded}
          paymentMethod={paymentMethod}
          paymentLoading={paymentLoading}
          portalLoading={portalLoading}
          openBillingPortal={openBillingPortal}
        />
      )}

      {/* API Keys Tab */}
      {tab === "api_keys" && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="section-header">API Keys</h3>
            <p className="text-xs text-muted mb-4">Manage your API keys for external integrations. The full secret is shown ONCE at creation — copy it immediately.</p>

            {justCreatedKey && (
              <div className="mb-4 p-3 border border-gold/40 bg-gold/10 rounded-lg">
                <p className="text-xs font-semibold text-gold mb-1">Your new API key — copy it now:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono p-2 bg-surface rounded overflow-x-auto">{justCreatedKey}</code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(justCreatedKey); toast.success("Copied"); }}
                    className="btn-secondary text-xs"
                  >Copy</button>
                  <button
                    onClick={() => setJustCreatedKey(null)}
                    className="text-xs text-muted hover:underline"
                  >Dismiss</button>
                </div>
                <p className="text-[10px] text-muted mt-1">This key won&apos;t be shown again.</p>
              </div>
            )}

            <div className="space-y-2 mb-4">
              {apiKeysLoading ? (
                <div className="text-center py-8 text-muted text-sm">Loading keys…</div>
              ) : apiKeys.length === 0 ? (
                <div className="text-center py-8 text-muted">
                  <Key size={24} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No API keys yet</p>
                </div>
              ) : apiKeys.map(k => (
                <div key={k.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{k.name}</p>
                    <p className="text-xs font-mono text-muted">{k.key}</p>
                    <p className="text-[10px] text-muted">Created: {new Date(k.created).toLocaleDateString()} | Last used: {k.last_used === "Never" ? "Never" : new Date(k.last_used).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={k.status} />
                    <button
                      onClick={async () => {
                        if (!confirm("Revoke this key? Any integration using it will stop working immediately.")) return;
                        const res = await fetch(`/api/settings/api-keys?id=${encodeURIComponent(k.id)}`, { method: "DELETE" });
                        if (res.ok) {
                          setApiKeys(prev => prev.filter(x => x.id !== k.id));
                          toast.success("Key revoked");
                        } else {
                          const data = await res.json().catch(() => ({}));
                          toast.error(data.error || "Failed to revoke");
                        }
                      }}
                      className="text-xs text-danger hover:underline"
                    >Revoke</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="Key name..." className="input flex-1 text-sm" />
              <button
                disabled={generatingKey}
                onClick={async () => {
                  if (!newKeyName.trim()) { toast.error("Enter a name"); return; }
                  setGeneratingKey(true);
                  try {
                    const res = await fetch("/api/settings/api-keys", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: newKeyName.trim() }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      setJustCreatedKey(data.key);
                      // Keep UI masked key in the list (never store the raw key in state)
                      setApiKeys(prev => [
                        { id: data.id, name: data.name, key: `${data.key_prefix}${"•".repeat(20)}`, created: data.created, last_used: "Never", status: "active" },
                        ...prev,
                      ]);
                      setNewKeyName("");
                      toast.success("Key generated");
                    } else {
                      toast.error(data.error || "Failed to generate");
                    }
                  } finally {
                    setGeneratingKey(false);
                  }
                }}
                className="btn-primary text-xs disabled:opacity-50"
              >{generatingKey ? "Generating..." : "Generate Key"}</button>
            </div>
          </div>
        </div>
      )}

      {/* White Label Tab — lazy */}
      {tab === "white_label" && (<WhiteLabelSettings whiteLabel={whiteLabel} setWhiteLabel={setWhiteLabel} wlSaving={wlSaving} setWlSaving={setWlSaving} />)}

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

      {/* Security Tab — lazy */}
      {tab === "security" && (
        <SecuritySettings
          twoFA={twoFA}
          setTwoFA={setTwoFA}
          sessions={sessions}
        />
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

      {/* ══════════════════════════════════════════════════════════ */}
      {/* Sidebar Tab — full customizer                                */}
      {/* ══════════════════════════════════════════════════════════ */}
      {tab === "sidebar" && (
        <div className="space-y-3">
          <div className="card">
            <h2 className="section-header flex items-center gap-2">
              <PanelLeft size={14} className="text-gold" /> Sidebar Customization
            </h2>
            <p className="text-[11px] text-muted mb-0">
              Fully control which items show in your sidebar, how they&apos;re grouped, and what they look like.
              Changes take effect after you click <span className="text-gold">Save Changes</span>.
            </p>
          </div>
          <SidebarCustomizerFull businessType={(profile as Record<string, unknown> | null)?.user_type as string | undefined} />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* Appearance Tab                                              */}
      {/* ══════════════════════════════════════════════════════════ */}
      {tab === "appearance" && (
        <div className="space-y-4 max-w-2xl">
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Palette size={14} className="text-gold" /> Theme</h2>
            <p className="text-[10px] text-muted mb-3">Switch between light, dark, or follow system setting.</p>
            <div className="grid grid-cols-3 gap-2">
              {(["light", "dark", "system"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setAppearance({ ...appearance, theme: t }); applyTheme(t); }}
                  className={`p-3 rounded-lg border text-xs font-medium capitalize transition-all ${
                    appearance.theme === t ? "border-gold bg-gold/10 text-gold" : "border-border bg-surface-light/30 text-muted hover:text-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Monitor size={14} className="text-gold" /> Density</h2>
            <p className="text-[10px] text-muted mb-3">How spacious your interface feels.</p>
            <div className="grid grid-cols-3 gap-2">
              {(["compact", "comfortable", "spacious"] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setAppearance({ ...appearance, density: d })}
                  className={`p-3 rounded-lg border text-xs font-medium capitalize transition-all ${
                    appearance.density === d ? "border-gold bg-gold/10 text-gold" : "border-border bg-surface-light/30 text-muted hover:text-foreground"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Sliders size={14} className="text-gold" /> Font Size</h2>
            <p className="text-[10px] text-muted mb-3">Adjust the base font size across the dashboard.</p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={12}
                max={18}
                step={1}
                value={appearance.font_size}
                onChange={e => setAppearance({ ...appearance, font_size: Number(e.target.value) })}
                className="flex-1 accent-gold"
              />
              <span className="text-gold font-bold text-sm w-10 text-center">{appearance.font_size}px</span>
            </div>
          </div>

          <div className="card space-y-3">
            <h2 className="section-header flex items-center gap-2"><Zap size={14} className="text-gold" /> Motion & Animations</h2>
            <ToggleRow
              label="Animations"
              hint="Subtle transitions and fade-ins."
              checked={appearance.animations}
              onChange={(v) => setAppearance({ ...appearance, animations: v })}
            />
            <ToggleRow
              label="Reduce motion"
              hint="Disable non-essential motion (respects your OS setting)."
              checked={appearance.reduce_motion}
              onChange={(v) => setAppearance({ ...appearance, reduce_motion: v })}
            />
          </div>

          <div className="card">
            <h2 className="section-header flex items-center gap-2"><PanelLeft size={14} className="text-gold" /> Sidebar Position</h2>
            <p className="text-[10px] text-muted mb-3">Place the main navigation on the left or right side.</p>
            <div className="grid grid-cols-2 gap-2">
              {(["left", "right"] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setAppearance({ ...appearance, sidebar_position: p })}
                  className={`p-3 rounded-lg border text-xs font-medium capitalize transition-all ${
                    appearance.sidebar_position === p ? "border-gold bg-gold/10 text-gold" : "border-border bg-surface-light/30 text-muted hover:text-foreground"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* AI Preferences Tab                                          */}
      {/* ══════════════════════════════════════════════════════════ */}
      {tab === "ai_prefs" && (
        <div className="space-y-4 max-w-2xl">
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Sparkles size={14} className="text-gold" /> Default Model</h2>
            <p className="text-[10px] text-muted mb-3">Used by default when you generate content.</p>
            <select
              value={aiPrefs.default_model}
              onChange={e => setAiPrefs({ ...aiPrefs, default_model: e.target.value })}
              className="input w-full text-xs"
            >
              <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (Fastest, cheapest)</option>
              <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (Balanced)</option>
              <option value="claude-opus-4-7">Claude Opus 4.7 (Best reasoning)</option>
            </select>
          </div>

          <div className="card">
            <h2 className="section-header">Response Style</h2>
            <p className="text-[10px] text-muted mb-3">How verbose you want AI responses to be.</p>
            <div className="grid grid-cols-3 gap-2">
              {(["short", "detailed", "casual"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setAiPrefs({ ...aiPrefs, response_style: s })}
                  className={`p-2.5 rounded-lg border text-xs font-medium capitalize transition-all ${
                    aiPrefs.response_style === s ? "border-gold bg-gold/10 text-gold" : "border-border bg-surface-light/30 text-muted hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="section-header">Language</h2>
            <select
              value={aiPrefs.language}
              onChange={e => setAiPrefs({ ...aiPrefs, language: e.target.value })}
              className="input w-full text-xs"
            >
              <option value="en">English</option>
              <option value="da">Danish</option>
              <option value="es">Spanish</option>
              <option value="de">German</option>
              <option value="fr">French</option>
              <option value="pt">Portuguese</option>
              <option value="it">Italian</option>
            </select>
          </div>

          <div className="card">
            <h2 className="section-header">Creativity (Temperature)</h2>
            <p className="text-[10px] text-muted mb-3">Lower = more deterministic. Higher = more creative.</p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={aiPrefs.temperature}
                onChange={e => setAiPrefs({ ...aiPrefs, temperature: Number(e.target.value) })}
                className="flex-1 accent-gold"
              />
              <span className="text-gold font-bold text-sm w-12 text-center">{aiPrefs.temperature.toFixed(2)}</span>
            </div>
          </div>

          <div className="card">
            <ToggleRow
              label="Enable experimental features"
              hint="New AI capabilities that may be unstable. Opt-in early access."
              checked={aiPrefs.experimental}
              onChange={(v) => setAiPrefs({ ...aiPrefs, experimental: v })}
            />
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* Workspace Tab                                               */}
      {/* ══════════════════════════════════════════════════════════ */}
      {tab === "workspace" && (
        <WorkspaceTab workspace={workspace} setWorkspace={setWorkspace} />
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* Privacy Tab                                                 */}
      {/* ══════════════════════════════════════════════════════════ */}
      {tab === "privacy" && (
        <div className="space-y-4 max-w-2xl">
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Eye size={14} className="text-gold" /> Public Profile</h2>
            <ToggleRow
              label="Make profile public"
              hint="Allow other users on the platform to see your name and avatar."
              checked={privacy.public_profile}
              onChange={(v) => setPrivacy({ ...privacy, public_profile: v })}
            />
          </div>
          <div className="card">
            <h2 className="section-header">Analytics</h2>
            <ToggleRow
              label="Opt out of analytics"
              hint="We won't collect anonymized usage stats from your account."
              checked={privacy.analytics_opt_out}
              onChange={(v) => setPrivacy({ ...privacy, analytics_opt_out: v })}
            />
          </div>
          <div className="card">
            <h2 className="section-header">Cookie Preferences</h2>
            <div className="space-y-2">
              <ToggleRow
                label="Essential (required)"
                hint="Needed for login and core features."
                checked={true}
                onChange={() => {}}
                disabled
              />
              <ToggleRow
                label="Analytics cookies"
                hint="Help us understand how the app is used."
                checked={privacy.cookies.analytics}
                onChange={(v) => setPrivacy({ ...privacy, cookies: { ...privacy.cookies, analytics: v } })}
              />
              <ToggleRow
                label="Marketing cookies"
                hint="Used for personalized ads and campaigns."
                checked={privacy.cookies.marketing}
                onChange={(v) => setPrivacy({ ...privacy, cookies: { ...privacy.cookies, marketing: v } })}
              />
            </div>
          </div>
          <div className="card">
            <h2 className="section-header">Who can see your data</h2>
            <div className="grid grid-cols-3 gap-2">
              {(["private", "team", "public"] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setPrivacy({ ...privacy, data_visibility: v })}
                  className={`p-2.5 rounded-lg border text-xs font-medium capitalize transition-all ${
                    privacy.data_visibility === v ? "border-gold bg-gold/10 text-gold" : "border-border bg-surface-light/30 text-muted hover:text-foreground"
                  }`}
                >
                  {v === "private" ? "Only me" : v === "team" ? "My team" : "Everyone"}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* Shortcuts Tab                                               */}
      {/* ══════════════════════════════════════════════════════════ */}
      {tab === "shortcuts" && (
        <div className="space-y-4 max-w-3xl">
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Keyboard size={14} className="text-gold" /> Keyboard Shortcuts</h2>
            <p className="text-[10px] text-muted mb-3">Use these shortcuts to move around faster. Some are customizable.</p>
            <div className="divide-y divide-border/40">
              {[
                { keys: ["⌘", "K"], label: "Open command palette" },
                { keys: ["⌘", "/"], label: "Global search" },
                { keys: ["⌘", "N"], label: "Quick add" },
                { keys: ["⌘", "B"], label: "Toggle sidebar" },
                { keys: ["G", "D"], label: "Go to Dashboard" },
                { keys: ["G", "I"], label: "Go to Inbox" },
                { keys: ["G", "C"], label: "Go to CRM" },
                { keys: ["?", ""], label: "Show all shortcuts" },
              ].map((s) => (
                <div key={s.label} className="flex items-center py-2 text-xs">
                  <span className="flex-1 text-foreground">{s.label}</span>
                  <div className="flex items-center gap-1">
                    {s.keys.filter(Boolean).map((k, i) => (
                      <kbd key={i} className="px-2 py-0.5 rounded bg-surface-light border border-border text-[10px] font-mono">{k}</kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted mt-3 pt-3 border-t border-border/30">
              More customization for chord shortcuts is coming soon.
            </p>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* Backups Tab                                                 */}
      {/* ══════════════════════════════════════════════════════════ */}
      {tab === "backups" && (
        <div className="space-y-4 max-w-2xl">
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><HardDrive size={14} className="text-gold" /> Manual Backup</h2>
            <p className="text-[10px] text-muted mb-3">Export all your data as a JSON file.</p>
            <button
              onClick={downloadBackup}
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              <Download size={12} /> Export All Data
            </button>
            {backup.last_backup && (
              <p className="text-[10px] text-muted mt-2">
                Last export: {new Date(backup.last_backup).toLocaleString()}
              </p>
            )}
          </div>

          <div className="card">
            <h2 className="section-header">Scheduled Auto-Backup</h2>
            <ToggleRow
              label="Enable auto-backup"
              hint="We'll remind you to export regularly. (Automatic server-side backups coming soon.)"
              checked={backup.auto_backup_enabled}
              onChange={(v: boolean) => setBackup({ ...backup, auto_backup_enabled: v })}
            />
            {backup.auto_backup_enabled && (
              <div className="mt-3">
                <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">Frequency</label>
                <select
                  value={backup.frequency}
                  onChange={e => setBackup({ ...backup, frequency: e.target.value })}
                  className="input w-full text-xs"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="section-header">Restore from Backup</h2>
            <p className="text-[10px] text-muted mb-3">Upload a JSON backup file. We&apos;ll show you what will be restored before applying.</p>
            <div className="space-y-2">
              <label className="btn-secondary text-xs inline-flex items-center gap-1.5 cursor-pointer">
                <Upload size={12} /> Choose backup file...
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) previewRestore(file);
                  }}
                />
              </label>
              {restoreLoading && <p className="text-[10px] text-muted flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Working...</p>}
              {restorePreview && (
                <div className="mt-3 p-3 rounded-lg border border-gold/30 bg-gold/[0.04]">
                  <p className="text-xs font-medium mb-2">Preview — will restore:</p>
                  <ul className="text-[11px] text-muted space-y-0.5">
                    {Object.entries(restorePreview).map(([k, v]) => (
                      <li key={k}><span className="text-foreground">{v}</span>× {k.replace(/_/g, " ")}</li>
                    ))}
                  </ul>
                  {restorePayload && (
                    <div className="flex gap-2 mt-3">
                      <button onClick={applyRestore} disabled={restoreLoading} className="btn-primary text-xs flex items-center gap-1">
                        <CheckCircle2 size={12} /> Apply Restore
                      </button>
                      <button onClick={() => { setRestorePreview(null); setRestorePayload(null); }} className="btn-secondary text-xs">Cancel</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* Usage Limits Tab                                            */}
      {/* ══════════════════════════════════════════════════════════ */}
      {tab === "usage_limits" && (
        <div className="space-y-4 max-w-2xl">
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Gauge size={14} className="text-gold" /> Daily Caps</h2>
            <p className="text-[10px] text-muted mb-4">
              Set your own ceilings to avoid runaway usage. Set to <span className="text-gold">0</span> to
              use your plan&apos;s default.
            </p>
            <div className="space-y-4">
              <UsageSlider
                label="Tokens per day"
                value={usageLimits.max_tokens_per_day}
                min={0}
                max={5_000_000}
                step={10_000}
                format={(v) => v === 0 ? "No override" : `${v.toLocaleString()} tokens`}
                onChange={(v) => saveUsageLimits({ max_tokens_per_day: v })}
              />
              <UsageSlider
                label="Videos per day"
                value={usageLimits.max_videos_per_day}
                min={0}
                max={500}
                step={1}
                format={(v) => v === 0 ? "No override" : `${v} videos`}
                onChange={(v) => saveUsageLimits({ max_videos_per_day: v })}
              />
              <UsageSlider
                label="Thumbnails per day"
                value={usageLimits.max_thumbnails_per_day}
                min={0}
                max={1000}
                step={5}
                format={(v) => v === 0 ? "No override" : `${v} thumbs`}
                onChange={(v) => saveUsageLimits({ max_thumbnails_per_day: v })}
              />
              <UsageSlider
                label="Emails per day"
                value={usageLimits.max_emails_per_day}
                min={0}
                max={10_000}
                step={10}
                format={(v) => v === 0 ? "No override" : `${v} emails`}
                onChange={(v) => saveUsageLimits({ max_emails_per_day: v })}
              />
            </div>
          </div>

          <div className="card">
            <h2 className="section-header">Warnings</h2>
            <ToggleRow
              label="Warn me when approaching my cap"
              hint="Send a notification when usage crosses your warning threshold."
              checked={usageLimits.warning_enabled}
              onChange={(v) => saveUsageLimits({ warning_enabled: v })}
            />
            {usageLimits.warning_enabled && (
              <div className="mt-3">
                <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">Warn at</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={50}
                    max={99}
                    step={1}
                    value={usageLimits.warn_at_percent}
                    onChange={e => saveUsageLimits({ warn_at_percent: Number(e.target.value) })}
                    className="flex-1 accent-gold"
                  />
                  <span className="text-gold font-bold text-sm w-12 text-center">{usageLimits.warn_at_percent}%</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* Connected Apps Tab                                          */}
      {/* ══════════════════════════════════════════════════════════ */}
      {tab === "connected_apps" && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Link2 size={14} className="text-gold" /> Connected Apps</h2>
            <p className="text-[10px] text-muted mb-3">Third-party services you&apos;ve linked to your Trinity account.</p>
            {connectedAppsLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted py-6 justify-center">
                <Loader2 size={12} className="animate-spin" /> Loading connections...
              </div>
            ) : connectedApps.length === 0 ? (
              <div className="text-[11px] text-muted text-center py-8 border border-dashed border-border/50 rounded-xl">
                No apps connected yet. Visit the <a href="/dashboard/integrations" className="text-gold hover:underline">Integrations</a> page to connect one.
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {connectedApps.map(app => (
                  <div key={app.id} className="flex items-center gap-3 py-3">
                    <div className="w-8 h-8 rounded-lg bg-surface-light flex items-center justify-center shrink-0">
                      <ConnectedAppIcon platform={app.platform} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium capitalize">{app.platform.replace(/_/g, " ")}</p>
                      <p className="text-[10px] text-muted truncate">
                        {app.account_name || "Connected"}
                        {" · "}
                        Since {new Date(app.created_at).toLocaleDateString()}
                        {app.last_used ? ` · Expires ${new Date(app.last_used).toLocaleDateString()}` : ""}
                      </p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${app.is_active ? "bg-emerald-500/10 text-emerald-400" : "bg-danger/10 text-danger"}`}>
                      {app.is_active ? "Active" : "Inactive"}
                    </span>
                    <button
                      onClick={async () => {
                        if (!confirm(`Revoke ${app.platform}?`)) return;
                        try {
                          const { data: firstClient } = await supabase
                            .from("clients").select("id").eq("is_active", true).limit(1).maybeSingle();
                          const res = await fetch("/api/social/connect", {
                            method: "DELETE",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ account_id: app.id, client_id: firstClient?.id }),
                          });
                          if (res.ok) {
                            setConnectedApps(apps => apps.filter(a => a.id !== app.id));
                            toast.success(`${app.platform} revoked`);
                          } else {
                            const j = await res.json().catch(() => ({}));
                            toast.error(j?.error || "Couldn't revoke");
                          }
                        } catch {
                          toast.error("Revoke failed");
                        }
                      }}
                      className="btn-secondary text-[10px] px-2 py-1 flex items-center gap-1 text-danger"
                    >
                      <XCircle size={10} /> Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}
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

      </ErrorBoundary>
    </div>
  );
}

/* ─── Shared tiny toggle row used by Appearance / Privacy / Backups ──── */
function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-center gap-3 cursor-pointer ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground">{label}</p>
        {hint && <p className="text-[10px] text-muted leading-snug">{hint}</p>}
      </div>
      <button
        type="button"
        onClick={() => { if (!disabled) onChange(!checked); }}
        disabled={disabled}
        className={`shrink-0 w-9 h-5 rounded-full transition-colors ${checked ? "bg-gold" : "bg-border"} ${disabled ? "pointer-events-none" : ""}`}
        aria-pressed={checked}
      >
        <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${checked ? "translate-x-[18px]" : "translate-x-0.5"} mt-0.5`} />
      </button>
    </label>
  );
}

/* ─── Usage slider row (for Usage Limits tab) ────────────────────────── */
function UsageSlider({
  label, value, min, max, step, format, onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[11px] text-foreground font-medium">{label}</label>
        <span className="text-[10px] text-gold font-semibold">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-gold"
      />
      <div className="flex items-center justify-between text-[9px] text-muted mt-0.5">
        <span>0</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}

/* ─── Workspace Tab content ──────────────────────────────────────────── */
function WorkspaceTab({
  workspace, setWorkspace,
}: {
  workspace: {
    workspace_name: string; timezone: string; week_start: string;
    date_format: string; currency: string; measurement: string;
  };
  setWorkspace: (w: typeof workspace) => void;
}) {
  // Auto-save the workspace name
  const { status: st, lastSavedAt, error: err } = useAutoSave({
    value: workspace,
    save: async (v) => {
      if (typeof window !== "undefined") safeSet("ss-workspace", JSON.stringify(v));
    },
    delay: 900,
  });

  return (
    <div className="space-y-4 max-w-2xl">
      <AutoSaveIndicator status={st} lastSavedAt={lastSavedAt} error={err} />
      <div className="card">
        <h2 className="section-header flex items-center gap-2"><Building2 size={14} className="text-gold" /> Workspace</h2>
        <p className="text-[10px] text-muted mb-3">Name your workspace and set its formatting defaults.</p>
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">Workspace Name</label>
            <input
              value={workspace.workspace_name}
              onChange={e => setWorkspace({ ...workspace, workspace_name: e.target.value })}
              placeholder="My Workspace"
              className="input w-full text-xs"
            />
            <p className="text-[9px] text-muted mt-1 flex items-center gap-1"><CheckCircle2 size={8} /> Auto-saves as you type</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">Timezone</label>
              <select
                value={workspace.timezone}
                onChange={e => setWorkspace({ ...workspace, timezone: e.target.value })}
                className="input w-full text-xs"
              >
                <option value="Europe/Copenhagen">Europe/Copenhagen (CET)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
                <option value="America/New_York">America/New York (EST)</option>
                <option value="America/Los_Angeles">America/Los Angeles (PST)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">Week starts on</label>
              <select
                value={workspace.week_start}
                onChange={e => setWorkspace({ ...workspace, week_start: e.target.value })}
                className="input w-full text-xs"
              >
                <option value="sunday">Sunday</option>
                <option value="monday">Monday</option>
                <option value="saturday">Saturday</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">Date format</label>
              <select
                value={workspace.date_format}
                onChange={e => setWorkspace({ ...workspace, date_format: e.target.value })}
                className="input w-full text-xs"
              >
                <option value="YYYY-MM-DD">2026-04-18 (ISO)</option>
                <option value="MM/DD/YYYY">04/18/2026 (US)</option>
                <option value="DD/MM/YYYY">18/04/2026 (EU)</option>
                <option value="DD.MM.YYYY">18.04.2026 (German)</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">Currency</label>
              <select
                value={workspace.currency}
                onChange={e => setWorkspace({ ...workspace, currency: e.target.value })}
                className="input w-full text-xs"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="DKK">DKK (kr)</option>
                <option value="JPY">JPY (¥)</option>
                <option value="CAD">CAD (C$)</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">Measurement Units</label>
              <select
                value={workspace.measurement}
                onChange={e => setWorkspace({ ...workspace, measurement: e.target.value })}
                className="input w-full text-xs"
              >
                <option value="metric">Metric (km, kg, °C)</option>
                <option value="imperial">Imperial (mi, lb, °F)</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Connected Apps icon resolver ───────────────────────────────────── */
function ConnectedAppIcon({ platform }: { platform: string }) {
  // Dynamically load platform icon component.
  const p = platform.toLowerCase();
  // Use lazy import via require guarded by typeof window check.
  // Falls back to a small colored box with first letter.
  let icon: React.ReactNode = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@/components/ui/platform-icons");
    if (mod && typeof mod.getPlatformIcon === "function") {
      icon = mod.getPlatformIcon(p, 16);
    }
  } catch {
    icon = null;
  }
  if (icon) return <>{icon}</>;
  return (
    <span className="w-4 h-4 rounded bg-gold/20 text-gold text-[9px] font-bold flex items-center justify-center">
      {p[0]?.toUpperCase() || "?"}
    </span>
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
              <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Logo</label>

              <LogoDropZone
                logoUrl={whiteLabel.logo_url}
                onUploaded={(url) => setWhiteLabel({ ...whiteLabel, logo_url: url })}
                onRemove={() => setWhiteLabel({ ...whiteLabel, logo_url: "" })}
              />

              <label className="block text-[9px] text-muted uppercase tracking-wider mt-3 mb-1">Or paste a logo URL</label>
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
              <p className="text-[9px] text-muted mt-1">Square image recommended (PNG/JPEG/SVG, at least 128x128px, max 2 MB)</p>
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

/* ─── Logo Drop Zone for white-label upload ──────────────────────────── */
const LOGO_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/svg+xml"];
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

function LogoDropZone({
  logoUrl,
  onUploaded,
  onRemove,
}: {
  logoUrl: string;
  onUploaded: (url: string) => void;
  onRemove: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [warn, setWarn] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function validate(file: File): string | null {
    if (!LOGO_ALLOWED_TYPES.includes(file.type)) {
      return `Unsupported file type "${file.type || "unknown"}". Allowed: PNG, JPEG, SVG.`;
    }
    if (file.size > LOGO_MAX_BYTES) {
      return `File too large (${(file.size / 1024 / 1024).toFixed(2)} MB). Max 2 MB.`;
    }
    if (file.size === 0) return "File is empty.";
    return null;
  }

  async function upload(file: File) {
    const v = validate(file);
    if (v) {
      setWarn(v);
      toast.error(v);
      return;
    }
    setWarn(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const res = await fetch("/api/white-label/logo-upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error || "Upload failed";
        setWarn(msg);
        toast.error(msg);
      } else if (data.logo_url) {
        onUploaded(data.logo_url);
        toast.success("Logo uploaded");
      } else {
        toast.error("Upload returned no URL");
      }
    } catch {
      toast.error("Upload network error");
      setWarn("Network error during upload");
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  }

  function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void upload(file);
    // Reset input value so re-uploading the same file works
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
        className={`relative flex items-center gap-4 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
          dragOver
            ? "border-gold bg-gold/[0.08]"
            : "border-border hover:border-gold/40 bg-surface-light/40"
        } ${uploading ? "opacity-60 pointer-events-none" : ""}`}
      >
        <div className="w-14 h-14 rounded-lg border border-border bg-surface flex items-center justify-center overflow-hidden shrink-0">
          {logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={logoUrl} alt="Logo preview" className="w-full h-full object-contain" />
          ) : (
            <Upload size={18} className="text-muted" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium">
            {uploading ? "Uploading..." : logoUrl ? "Replace logo" : "Drop a logo here, or click to upload"}
          </p>
          <p className="text-[10px] text-muted mt-0.5">PNG, JPEG or SVG · max 2 MB</p>
          {warn && (
            <p className="text-[10px] text-danger mt-1 flex items-center gap-1">
              <AlertTriangle size={10} /> {warn}
            </p>
          )}
        </div>
        {uploading && (
          <Loader2 size={16} className="text-gold animate-spin shrink-0" />
        )}
        {logoUrl && !uploading && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setWarn(null); onRemove(); }}
            className="text-[10px] flex items-center gap-1 px-2 py-1 rounded-md border border-border hover:border-danger/40 hover:text-danger text-muted shrink-0"
            title="Remove the current logo"
          >
            <Trash2 size={10} /> Remove logo
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={LOGO_ALLOWED_TYPES.join(",")}
          onChange={onSelect}
          className="hidden"
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Plan-tier monthly usage widget (emails, tokens, clients, SMS, call minutes)
// Data from /api/usage/current. Progress bars coloured by % used.
// ─────────────────────────────────────────────────────────────────────────────
function PlanUsageWidget({
  planUsage,
}: {
  planUsage: {
    plan_tier: string;
    usage: Record<string, number>;
    limits: Record<string, number | "unlimited">;
    remaining: Record<string, number | "unlimited">;
  } | null;
}) {
  if (!planUsage) {
    return <p className="text-xs text-muted text-center py-4">No usage data available.</p>;
  }
  const rows: Array<{ key: string; label: string; fmt?: (n: number) => string }> = [
    { key: "emails", label: "Emails" },
    { key: "tokens", label: "AI Tokens", fmt: (n) => n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}K` : String(n) },
    { key: "clients", label: "Active Clients" },
    { key: "phone_numbers", label: "Phone Numbers" },
    { key: "sms", label: "SMS" },
    { key: "call_minutes", label: "Call Minutes" },
  ];
  const anyOverLimit = rows.some(r => {
    const l = planUsage.limits[r.key];
    const u = planUsage.usage[r.key] || 0;
    return typeof l === "number" && u >= l;
  });
  return (
    <div className="space-y-3">
      <p className="text-[10px] text-muted">
        Plan: <span className="text-gold font-semibold">{planUsage.plan_tier}</span>
        {anyOverLimit && (
          <span className="ml-2 text-red-400">· Over limit on one or more resources — <a href="/dashboard/pricing" className="underline">upgrade</a></span>
        )}
      </p>
      {rows.map(r => {
        const used = planUsage.usage[r.key] || 0;
        const limit = planUsage.limits[r.key];
        const isUnlimited = limit === "unlimited";
        const limitNum = typeof limit === "number" ? limit : 0;
        const pct = isUnlimited || limitNum === 0 ? 0 : Math.min(100, (used / limitNum) * 100);
        const over = !isUnlimited && used >= limitNum;
        const warn = !isUnlimited && !over && pct >= 80;
        const barColor = over ? "bg-red-500" : warn ? "bg-amber-400" : "bg-gold";
        const textColor = over ? "text-red-400" : warn ? "text-amber-400" : "text-gold";
        const fmt = r.fmt || ((n: number) => n.toLocaleString());
        return (
          <div key={r.key}>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-muted">{r.label}</span>
              <span className={textColor}>
                {fmt(used)} {isUnlimited ? "· Unlimited" : `/ ${fmt(limitNum)}`}
              </span>
            </div>
            <div className="h-1.5 bg-surface-light/50 rounded-full overflow-hidden">
              <div
                className={`h-full ${barColor} transition-all`}
                style={{ width: isUnlimited ? "6%" : `${Math.max(2, pct)}%` }}
              />
            </div>
            {over && (
              <p className="text-[9px] text-red-400 mt-0.5">
                Limit reached — <a href="/dashboard/pricing" className="underline">upgrade your plan</a> to continue.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
