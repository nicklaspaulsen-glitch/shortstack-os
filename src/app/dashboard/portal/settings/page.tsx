"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Settings, Shield, MessageSquare, Bot, Eye, Bell, Save, Loader, AlertTriangle, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";

interface PrivacySettings {
  allow_dm_outreach: boolean;
  allow_ai_posting: boolean;
  allow_analytics_access: boolean;
  allow_ad_management: boolean;
  dm_outreach_platforms: string[];
  notification_preferences: {
    email_updates: boolean;
    dm_notifications: boolean;
    weekly_report: boolean;
  };
}

const DEFAULT_SETTINGS: PrivacySettings = {
  allow_dm_outreach: false,
  allow_ai_posting: false,
  allow_analytics_access: true,
  allow_ad_management: false,
  dm_outreach_platforms: [],
  notification_preferences: {
    email_updates: true,
    dm_notifications: true,
    weekly_report: true,
  },
};

export default function ClientSettingsPage() {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<PrivacySettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) fetchSettings();
  }, [profile]);

  async function fetchSettings() {
    try {
      setLoading(true);
      const res = await fetch("/api/clients/privacy");
      const data = await res.json();
      if (data.settings && Object.keys(data.settings).length > 0) {
        setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
      }
    } catch (err) {
      console.error("[ClientSettingsPage] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    try {
      const res = await fetch("/api/clients/privacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const data = await res.json();
      if (data.success) toast.success("Settings saved!");
      else toast.error("Failed to save");
    } catch {
      toast.error("Connection error");
    }
    setSaving(false);
  }

  const togglePlatform = (platform: string) => {
    setSettings(prev => ({
      ...prev,
      dm_outreach_platforms: prev.dm_outreach_platforms.includes(platform)
        ? prev.dm_outreach_platforms.filter(p => p !== platform)
        : [...prev.dm_outreach_platforms, platform],
    }));
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader size={20} className="animate-spin text-gold" />
    </div>
  );

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Settings size={18} className="text-gold" /> Account Settings
          </h1>
          <p className="text-xs text-muted mt-0.5">Control what our AI can do on your behalf</p>
        </div>
        <button onClick={saveSettings} disabled={saving} className="btn-primary text-xs flex items-center gap-1.5">
          {saving ? <Loader size={12} className="animate-spin" /> : <Save size={12} />}
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {/* AI Permissions */}
      <div className="card">
        <h2 className="section-header flex items-center gap-2">
          <Shield size={14} className="text-gold" /> AI Permissions
        </h2>
        <p className="text-[10px] text-muted mb-4">Choose what our AI assistant is allowed to do with your connected accounts</p>

        <div className="space-y-4">
          {/* DM Outreach */}
          <div className="flex items-start justify-between p-3 bg-surface-light rounded-lg border border-border">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-gold/10 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <MessageSquare size={14} className="text-gold" />
              </div>
              <div>
                <p className="text-xs font-semibold">DM Outreach</p>
                <p className="text-[10px] text-muted mt-0.5">Allow AI to send direct messages to potential leads on your social accounts. Messages are crafted by AI and reviewed before sending.</p>
                {settings.allow_dm_outreach && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {["instagram", "facebook", "linkedin", "tiktok"].map(p => (
                      <button key={p} onClick={() => togglePlatform(p)}
                        className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors capitalize ${
                          settings.dm_outreach_platforms.includes(p)
                            ? "bg-gold/10 text-gold border-gold/20"
                            : "bg-surface-light text-muted border-border hover:border-gold/20"
                        }`}>
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button onClick={() => setSettings({ ...settings, allow_dm_outreach: !settings.allow_dm_outreach })}
              className={`w-10 h-5 rounded-full transition-all shrink-0 ${settings.allow_dm_outreach ? "bg-gold" : "bg-surface-light border border-border"}`}>
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${settings.allow_dm_outreach ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>

          {/* AI Content Posting */}
          <div className="flex items-start justify-between p-3 bg-surface-light rounded-lg border border-border">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-success/10 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <Bot size={14} className="text-success" />
              </div>
              <div>
                <p className="text-xs font-semibold">AI Content Posting</p>
                <p className="text-[10px] text-muted mt-0.5">Allow AI to publish content directly to your social media accounts based on your content calendar.</p>
              </div>
            </div>
            <button onClick={() => setSettings({ ...settings, allow_ai_posting: !settings.allow_ai_posting })}
              className={`w-10 h-5 rounded-full transition-all shrink-0 ${settings.allow_ai_posting ? "bg-gold" : "bg-surface-light border border-border"}`}>
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${settings.allow_ai_posting ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>

          {/* Analytics Access */}
          <div className="flex items-start justify-between p-3 bg-surface-light rounded-lg border border-border">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-info/10 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <Eye size={14} className="text-info" />
              </div>
              <div>
                <p className="text-xs font-semibold">Analytics Access</p>
                <p className="text-[10px] text-muted mt-0.5">Allow the AI to read your social media analytics for reporting and optimization suggestions.</p>
              </div>
            </div>
            <button onClick={() => setSettings({ ...settings, allow_analytics_access: !settings.allow_analytics_access })}
              className={`w-10 h-5 rounded-full transition-all shrink-0 ${settings.allow_analytics_access ? "bg-gold" : "bg-surface-light border border-border"}`}>
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${settings.allow_analytics_access ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>

          {/* Ad Management */}
          <div className="flex items-start justify-between p-3 bg-surface-light rounded-lg border border-border">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-warning/10 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <Bot size={14} className="text-warning" />
              </div>
              <div>
                <p className="text-xs font-semibold">Ad Campaign Management</p>
                <p className="text-[10px] text-muted mt-0.5">Allow AI to create, modify, and optimize ad campaigns on your connected ad platforms.</p>
              </div>
            </div>
            <button onClick={() => setSettings({ ...settings, allow_ad_management: !settings.allow_ad_management })}
              className={`w-10 h-5 rounded-full transition-all shrink-0 ${settings.allow_ad_management ? "bg-gold" : "bg-surface-light border border-border"}`}>
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${settings.allow_ad_management ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="card">
        <h2 className="section-header flex items-center gap-2">
          <Bell size={14} className="text-gold" /> Notifications
        </h2>
        <div className="space-y-3">
          {[
            { key: "email_updates" as const, label: "Email Updates", desc: "Receive email notifications about your account activity" },
            { key: "dm_notifications" as const, label: "DM Notifications", desc: "Get notified when leads respond to AI-sent messages" },
            { key: "weekly_report" as const, label: "Weekly Report", desc: "Receive a weekly summary of your content and campaign performance" },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between py-2">
              <div>
                <p className="text-xs font-medium">{item.label}</p>
                <p className="text-[10px] text-muted">{item.desc}</p>
              </div>
              <button onClick={() => setSettings({
                ...settings,
                notification_preferences: {
                  ...settings.notification_preferences,
                  [item.key]: !settings.notification_preferences[item.key],
                },
              })}
                className={`w-10 h-5 rounded-full transition-all ${settings.notification_preferences[item.key] ? "bg-gold" : "bg-surface-light border border-border"}`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${settings.notification_preferences[item.key] ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="card border-border bg-surface-light">
        <div className="flex items-start gap-3">
          <Shield size={14} className="text-gold shrink-0 mt-0.5" />
          <p className="text-[10px] text-muted leading-relaxed">
            All permissions can be changed at any time. DM outreach is <strong className="text-foreground">off by default</strong> —
            you must explicitly enable it. Your account manager can also control these settings on your behalf.
            All AI actions are logged and can be reviewed in your Reports section.
          </p>
        </div>
      </div>

      {/* Danger Zone */}
      <DangerZone />
    </div>
  );
}

function DangerZone() {
  const [showCancel, setShowCancel] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [cancellation, setCancellation] = useState<{ cancelled_at: string | null; scheduled_deletion_at: string | null } | null>(null);

  useEffect(() => {
    fetch("/api/clients/me")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.client?.cancelled_at) {
          setCancellation({ cancelled_at: d.client.cancelled_at, scheduled_deletion_at: d.client.scheduled_deletion_at });
        }
      })
      .catch(() => {});
  }, []);

  async function handleCancel() {
    if (confirmText !== "DELETE") {
      toast.error("Type DELETE to confirm");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/portal/cancel-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "DELETE", reason }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Subscription cancelled. You have 30 days to change your mind.");
        setCancellation({ cancelled_at: new Date().toISOString(), scheduled_deletion_at: data.scheduled_for });
        setShowCancel(false);
        setConfirmText("");
      } else {
        toast.error(data.error || "Failed to cancel");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore() {
    setLoading(true);
    try {
      const res = await fetch("/api/portal/restore-subscription", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setCancellation(null);
      } else {
        toast.error(data.error || "Failed to restore");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  const daysRemaining = cancellation?.scheduled_deletion_at
    ? Math.max(0, Math.ceil((new Date(cancellation.scheduled_deletion_at).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <div className="card border-red-500/30 bg-red-500/[0.03]">
      <div className="flex items-start gap-3 mb-3">
        <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-red-400">Danger Zone</h3>
          <p className="text-[10px] text-muted">Cancel your subscription and request account deletion.</p>
        </div>
      </div>

      {cancellation ? (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-amber-400">Subscription Cancelled</p>
              <p className="text-[10px] text-muted mt-0.5">
                Your account and all data (videos, thumbnails, websites, content) will be permanently deleted in{" "}
                <span className="text-amber-400 font-semibold">{daysRemaining} {daysRemaining === 1 ? "day" : "days"}</span>.
              </p>
            </div>
          </div>
          <button onClick={handleRestore} disabled={loading} className="btn-primary text-xs w-full">
            {loading ? <Loader size={12} className="animate-spin inline mr-1" /> : null}
            Restore Subscription
          </button>
        </div>
      ) : (
        <>
          <p className="text-[10px] text-muted mb-3">
            Cancelling will stop billing and schedule your account for permanent deletion in 30 days.
            All your data including videos, thumbnails, websites, generated content, and client files will be deleted.
            This cannot be undone after 30 days.
          </p>
          <button onClick={() => setShowCancel(true)} className="text-xs px-3 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 flex items-center gap-2">
            <Trash2 size={12} /> Cancel Subscription
          </button>
        </>
      )}

      {showCancel && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowCancel(false)}>
          <div className="card max-w-md w-full p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2">
                <AlertTriangle size={14} /> Cancel Subscription
              </h3>
              <button onClick={() => setShowCancel(false)}><X size={16} /></button>
            </div>
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-[10px] text-muted">
              <p className="font-semibold text-red-400 mb-1">This will delete:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>All videos, thumbnails, and generated content</li>
                <li>Your websites and landing pages</li>
                <li>Client data, leads, and outreach history</li>
                <li>Uploaded files and assets</li>
                <li>Your account and profile</li>
              </ul>
              <p className="mt-2">You have 30 days to reverse this.</p>
            </div>
            <div>
              <label className="text-[10px] text-muted">Reason (optional)</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Why are you leaving?" className="input w-full text-xs mt-1" rows={2} />
            </div>
            <div>
              <label className="text-[10px] text-muted">Type <span className="text-red-400 font-mono">DELETE</span> to confirm</label>
              <input value={confirmText} onChange={e => setConfirmText(e.target.value)} className="input w-full text-xs mt-1" placeholder="DELETE" />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowCancel(false)} className="btn-secondary text-xs flex-1">Keep subscription</button>
              <button onClick={handleCancel} disabled={loading || confirmText !== "DELETE"}
                className="text-xs flex-1 px-3 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1">
                {loading ? <Loader size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Cancel Subscription
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
