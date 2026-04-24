"use client";

/**
 * AccountSettings — Profile (nickname, avatar), subscription info, desktop
 * app settings, display options, sound effects, widget visibility, color theme,
 * and layout density. Loaded eagerly (it's the default/first tab).
 */

import { Camera, Save, Settings, CreditCard, Monitor, Palette, Bot, Volume2, VolumeX, CheckCircle2, Zap, ExternalLink, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { getPlanConfig } from "@/lib/plan-config";
import { applyTheme } from "@/components/theme-provider";

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key);
}

function safeSet(key: string, value: string) {
  if (typeof window !== "undefined") localStorage.setItem(key, value);
}

interface Profile {
  avatar_url?: string | null;
  nickname?: string | null;
  full_name?: string | null;
  role?: string | null;
  plan_tier?: string | null;
}

interface Props {
  profile: Profile | null;
  nickname: string;
  setNickname: (v: string) => void;
  savingProfile: boolean;
  setSavingProfile: (v: boolean) => void;
  refreshProfile: () => Promise<void>;
  sfxEnabled: boolean;
  toggleSfx: () => void;
  forceRerender: () => void;
}

export default function AccountSettings({
  profile,
  nickname,
  setNickname,
  savingProfile,
  setSavingProfile,
  refreshProfile,
  sfxEnabled,
  toggleSfx,
  forceRerender,
}: Props) {
  return (
    <div className="space-y-4 max-w-2xl">
      {/* Profile — Nickname & Avatar */}
      <div className="card" id="profile-section">
        <h2 className="section-header flex items-center gap-2">
          <Settings size={14} className="text-gold" /> Profile
        </h2>
        <p className="text-[10px] text-muted mb-3">Customize how you appear in the sidebar and across the app</p>
        <div className="flex items-start gap-4">
          <div className="relative group">
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
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
              <p className="text-[9px] text-muted/70 mt-1 flex items-center gap-1">
                <CheckCircle2 size={8} /> Auto-saves as you type
              </p>
            </div>
            <div className="pt-2 border-t border-border/30 flex items-center gap-2">
              <span className="text-[9px] text-muted/60">or save manually</span>
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
                className="btn-secondary text-[10px] px-3 py-1 flex items-center gap-1"
              >
                <Save size={10} /> {savingProfile ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Subscription — agency plan management */}
      {profile?.role === "admin" && (
        <div className="card">
          <h2 className="section-header flex items-center gap-2">
            <CreditCard size={14} className="text-gold" /> Subscription
          </h2>
          <p className="text-[10px] text-muted mb-3">Manage your Trinity plan</p>
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
                    if (plan.price_monthly === 0) {
                      toast.success("Founder plan is free — nothing to manage. Browse paid plans instead.");
                      window.location.href = "/dashboard/pricing";
                      return;
                    }
                    const res = await fetch("/api/billing/portal", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ self: true }),
                    });
                    const data = await res.json();
                    if (data.portal_url) {
                      window.open(data.portal_url, "_blank");
                    } else if (res.status === 404) {
                      toast("No active subscription yet — pick a plan to get started.", { icon: "ℹ" });
                      window.location.href = "/dashboard/pricing";
                    } else {
                      toast.error(data.error || "Could not open billing portal");
                    }
                  }}
                  className="btn-secondary text-[10px] px-3 py-1.5 flex items-center gap-1"
                >
                  {plan.price_monthly === 0 ? "Change Plan" : "Manage"} <ExternalLink size={9} />
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
          <p className="text-[10px] text-muted mb-3">Settings for the Trinity desktop application</p>
          <div className="space-y-2">
            {[
              { key: "ss_auto_startup", label: "Auto-Start on Login", desc: "Launch Trinity when your computer starts" },
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
          <div>
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="text-xs font-medium">Interface Zoom</p>
                <p className="text-[10px] text-muted">Make everything smaller or larger</p>
              </div>
              <span className="text-xs font-mono text-gold">{typeof window !== "undefined" ? Math.round((parseFloat(document.documentElement.style.zoom || "1")) * 100) : 100}%</span>
            </div>
            <div className="flex items-center gap-2">
              {["0.75", "0.85", "0.9", "1", "1.1"].map((zoom) => {
                const label = Math.round(parseFloat(zoom) * 100) + "%";
                return (
                  <button key={zoom} onClick={() => { document.documentElement.style.zoom = zoom; safeSet("ss-zoom", zoom); forceRerender(); toast.success(`Zoom: ${label}`); }}
                    className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${safeGet("ss-zoom") === zoom || (!safeGet("ss-zoom") && zoom === "1") ? "border-gold/30 bg-gold/10 text-gold" : "border-border text-muted hover:text-foreground"}`}>{label}</button>
                );
              })}
            </div>
          </div>

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
              forceRerender();
              toast.success(isCurrentlyLight ? "Dark mode enabled" : "Light mode enabled");
            }}
              className={`w-10 h-5 rounded-full transition-all ${(() => { const t = safeGet("ss-theme") || "nordic"; return t !== "nordic" && t !== "light"; })() ? "bg-gold" : "bg-surface-light border border-border"}`}>
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${(() => { const t = safeGet("ss-theme") || "nordic"; return t !== "nordic" && t !== "light"; })() ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>

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

      {/* Color Theme */}
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
                forceRerender();
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
          <Settings size={14} className="text-gold" /> Layout &amp; Density
        </h2>
        <p className="text-[10px] text-muted mb-3">Customize how compact or spacious the interface feels</p>
        <div className="space-y-4">
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
                    forceRerender();
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
                    forceRerender();
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
        </div>
      </div>
    </div>
  );
}
