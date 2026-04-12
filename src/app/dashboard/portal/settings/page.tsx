"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Settings, Shield, MessageSquare, Bot, Eye, Bell, Save, Loader } from "lucide-react";
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
      const res = await fetch("/api/clients/privacy");
      const data = await res.json();
      if (data.settings && Object.keys(data.settings).length > 0) {
        setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
      }
    } catch { /* settings will use defaults */ }
    setLoading(false);
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
              <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <MessageSquare size={14} className="text-accent" />
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
    </div>
  );
}
