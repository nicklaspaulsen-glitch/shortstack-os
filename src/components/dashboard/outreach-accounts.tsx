"use client";

/**
 * OutreachAccounts — dashboard widget for quickly switching which emails,
 * phone numbers, and social accounts are active for outreach.
 *
 * Shows real-time health, allows toggling active/inactive per account,
 * and picking the primary account for each channel.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Mail, Phone, Plus, Check, Settings, Shield, CircleDot, RefreshCw, Zap,
  AlertCircle, Activity, Trash2,
} from "lucide-react";
import {
  FacebookIcon, InstagramIcon, LinkedInIcon, TikTokIcon, XTwitterIcon,
} from "@/components/ui/platform-icons";
import toast from "react-hot-toast";

/* ── Types ───────────────────────────────────────────────────────────── */

interface EmailSender {
  id: string;
  email: string;
  display_name?: string;
  label?: string;
  is_primary?: boolean;
  is_active?: boolean;
  health_score?: number;
  daily_limit?: number;
  sent_today?: number;
  bounce_rate?: number;
  status?: string;
  last_check?: string;
  last_error?: string;
}

interface PhoneSender {
  id: string;
  phone_number: string;
  label?: string;
  is_primary?: boolean;
  is_active?: boolean;
  sent_today?: number;
  daily_limit?: number;
  carrier?: string;
  status?: string;
  last_check?: string;
  last_error?: string;
}

interface SocialAccount {
  id: string;
  platform: string;
  account_name: string;
  is_active?: boolean;
  status?: string;
  token_expires_at?: string;
}

type LiveStatus = "operational" | "degraded" | "down" | "unknown";

const SOCIAL_ICON: Record<string, React.ReactNode> = {
  instagram: <InstagramIcon size={14} />,
  facebook: <FacebookIcon size={14} />,
  tiktok: <TikTokIcon size={14} />,
  linkedin: <LinkedInIcon size={14} />,
  twitter: <XTwitterIcon size={14} />,
  x: <XTwitterIcon size={14} />,
};

/* ── Component ───────────────────────────────────────────────────────── */

/* Map account status strings to a live-status tier */
function deriveLiveStatus(item: { status?: string; last_error?: string; token_expires_at?: string; is_active?: boolean }): LiveStatus {
  if (item.is_active === false) return "unknown";
  if (item.status === "error" || item.status === "down" || item.status === "expired" || item.status === "revoked") return "down";
  if (item.status === "degraded" || item.status === "warning") return "degraded";
  if (item.last_error) return "degraded";
  if (item.token_expires_at && new Date(item.token_expires_at) < new Date()) return "down";
  if (item.token_expires_at && new Date(item.token_expires_at).getTime() - Date.now() < 7 * 86400000) return "degraded";
  if (item.status === "active" || item.status === "operational") return "operational";
  if (!item.status) return "unknown";
  return "operational";
}

function StatusDot({ status, showLabel }: { status: LiveStatus; showLabel?: boolean }) {
  const config = {
    operational: { color: "bg-emerald-400", ring: "ring-emerald-400/30", label: "Working", text: "text-emerald-400" },
    degraded:    { color: "bg-amber-400",   ring: "ring-amber-400/30",   label: "Issues",  text: "text-amber-400" },
    down:        { color: "bg-red-400",     ring: "ring-red-400/30",     label: "Down",    text: "text-red-400" },
    unknown:     { color: "bg-zinc-500",    ring: "ring-zinc-500/30",    label: "Unknown", text: "text-muted" },
  }[status];
  return (
    <div className="flex items-center gap-1">
      <span className={`relative flex h-2 w-2`}>
        {(status === "operational" || status === "degraded") && (
          <span className={`absolute inline-flex h-full w-full rounded-full ${config.color} opacity-40 animate-ping`} />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${config.color} ring-2 ${config.ring}`} />
      </span>
      {showLabel && <span className={`text-[9px] font-medium ${config.text}`}>{config.label}</span>}
    </div>
  );
}

export default function OutreachAccounts() {
  const [emails, setEmails] = useState<EmailSender[]>([]);
  const [phones, setPhones] = useState<PhoneSender[]>([]);
  const [socials, setSocials] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"email" | "phone" | "social">("email");
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const [emailsRes, phonesRes, socialsRes] = await Promise.all([
        fetch("/api/senders/emails").then(r => r.ok ? r.json() : { emails: [] }),
        fetch("/api/senders/phones").then(r => r.ok ? r.json() : { phones: [] }),
        fetch("/api/social/status").then(r => r.ok ? r.json() : { accounts: [] }),
      ]);
      setEmails(emailsRes.emails || []);
      setPhones(phonesRes.phones || []);
      setSocials(socialsRes.accounts || socialsRes.social_accounts || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  async function runHealthCheck() {
    setCheckingHealth(true);
    try {
      const res = await fetch("/api/senders/health-check");
      if (res.ok) {
        const data = await res.json();
        setLastCheck(data.checked_at);
        const { counts } = data;
        if (counts.down > 0) {
          toast.error(`${counts.down} account${counts.down > 1 ? "s" : ""} down, ${counts.operational} working`);
        } else if (counts.degraded > 0) {
          toast(`${counts.degraded} degraded, ${counts.operational} working`, { icon: "⚠️" });
        } else {
          toast.success(`All ${counts.operational} accounts working`);
        }
        await loadAll(); // Refresh to get updated statuses
      }
    } catch {
      toast.error("Health check failed");
    } finally {
      setCheckingHealth(false);
    }
  }

  async function runCleanup() {
    setCleaningUp(true);
    try {
      const res = await fetch("/api/senders/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days_old: 7 }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.total_deleted > 0) {
          toast.success(`Deleted ${data.total_deleted} stale accounts`);
          await loadAll();
        } else {
          toast("No stale accounts to clean up", { icon: "✨" });
        }
      } else {
        toast.error("Cleanup failed");
      }
    } catch {
      toast.error("Cleanup failed");
    } finally {
      setCleaningUp(false);
      setShowCleanupConfirm(false);
    }
  }

  /* Count stale accounts (down > 7 days old) for the cleanup badge */
  const staleCount =
    emails.filter(e => {
      if (!["error","expired","disabled"].includes(e.status || "")) return false;
      if (!e.last_check) return true;
      return new Date(e.last_check) < new Date(Date.now() - 7 * 86400000);
    }).length +
    phones.filter(p => {
      if (!["error","expired","disabled"].includes(p.status || "")) return false;
      if (!p.last_check) return true;
      return new Date(p.last_check) < new Date(Date.now() - 7 * 86400000);
    }).length +
    socials.filter(s => ["expired","revoked","error"].includes(s.status || "")).length;

  async function toggleEmailActive(id: string, next: boolean) {
    const prev = emails;
    setEmails(e => e.map(x => x.id === id ? { ...x, is_active: next } : x));
    const res = await fetch("/api/senders/emails", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_active: next }),
    });
    if (!res.ok) { setEmails(prev); toast.error("Failed to update"); }
    else toast.success(next ? "Email activated" : "Email deactivated");
  }

  async function setEmailPrimary(id: string) {
    const prev = emails;
    setEmails(e => e.map(x => ({ ...x, is_primary: x.id === id })));
    const res = await fetch("/api/senders/emails", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_primary: true }),
    });
    if (!res.ok) { setEmails(prev); toast.error("Failed"); }
    else toast.success("Primary email set");
  }

  async function togglePhoneActive(id: string, next: boolean) {
    const prev = phones;
    setPhones(p => p.map(x => x.id === id ? { ...x, is_active: next } : x));
    const res = await fetch("/api/senders/phones", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_active: next }),
    });
    if (!res.ok) { setPhones(prev); toast.error("Failed to update"); }
    else toast.success(next ? "Phone activated" : "Phone deactivated");
  }

  async function toggleSocialActive(id: string, next: boolean) {
    const prev = socials;
    setSocials(s => s.map(x => x.id === id ? { ...x, is_active: next } : x));
    const res = await fetch(`/api/social/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: next }),
    });
    if (!res.ok) { setSocials(prev); toast.error("Failed"); }
    else toast.success(next ? "Account activated" : "Account deactivated");
  }

  const activeEmails = emails.filter(e => e.is_active !== false).length;
  const activePhones = phones.filter(p => p.is_active !== false).length;
  const activeSocials = socials.filter(s => s.is_active !== false).length;

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-gold" />
          <h3 className="text-sm font-semibold">Outreach Accounts</h3>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gold/10 text-gold border border-gold/20">
            {activeEmails + activePhones + activeSocials} active
          </span>
          {lastCheck && (
            <span className="text-[9px] text-muted hidden md:inline" title={`Last checked: ${new Date(lastCheck).toLocaleString()}`}>
              · checked {new Date(lastCheck).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={runHealthCheck}
            disabled={checkingHealth}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors text-[10px] font-medium disabled:opacity-50"
            title="Run health check on all accounts"
          >
            <Activity size={10} className={checkingHealth ? "animate-pulse" : ""} />
            {checkingHealth ? "Checking..." : "Check Health"}
          </button>
          {staleCount > 0 && (
            <button
              onClick={() => setShowCleanupConfirm(true)}
              disabled={cleaningUp}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors text-[10px] font-medium disabled:opacity-50"
              title={`Delete ${staleCount} stale account${staleCount > 1 ? "s" : ""} older than 7 days`}
            >
              <Trash2 size={10} />
              {staleCount}
            </button>
          )}
          <button onClick={loadAll} className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-light transition-colors">
            <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          </button>
          <Link href="/dashboard/phone-email" className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-light transition-colors">
            <Settings size={11} />
          </Link>
        </div>
      </div>

      {/* Cleanup confirmation modal */}
      {showCleanupConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowCleanupConfirm(false)}>
          <div className="card max-w-sm w-full p-4 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-500/15 text-red-400 flex items-center justify-center">
                <Trash2 size={14} />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Delete stale accounts?</h3>
                <p className="text-[10px] text-muted">Older than 7 days, down/disconnected</p>
              </div>
            </div>
            <p className="text-[11px] text-muted">
              This will permanently delete <span className="text-foreground font-semibold">{staleCount}</span> {staleCount === 1 ? "account" : "accounts"} that have been disconnected or erroring for over a week.
              You can re-add them anytime.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowCleanupConfirm(false)} className="btn-secondary text-xs flex-1">Cancel</button>
              <button
                onClick={runCleanup}
                disabled={cleaningUp}
                className="flex-1 px-3 py-2 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {cleaningUp ? <RefreshCw size={11} className="animate-spin" /> : <Trash2 size={11} />}
                Delete {staleCount}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status summary bar */}
      <StatusSummaryBar emails={emails} phones={phones} socials={socials} />


      {/* Tabs */}
      <div className="flex gap-1 mb-3 bg-surface-light p-0.5 rounded-lg">
        <button
          onClick={() => setActiveTab("email")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[11px] font-medium transition-all ${
            activeTab === "email" ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
          }`}
        >
          <Mail size={11} /> Email <span className="text-[9px] text-muted">({emails.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("phone")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[11px] font-medium transition-all ${
            activeTab === "phone" ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
          }`}
        >
          <Phone size={11} /> Phone <span className="text-[9px] text-muted">({phones.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("social")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[11px] font-medium transition-all ${
            activeTab === "social" ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
          }`}
        >
          <Zap size={11} /> Social <span className="text-[9px] text-muted">({socials.length})</span>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-surface-light/50 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
          {activeTab === "email" && (
            <>
              {emails.length === 0 ? (
                <EmptyState icon={<Mail size={18} />} label="No email senders" linkText="Add email sender" link="/dashboard/phone-email" />
              ) : emails.map(sender => {
                const health = sender.health_score ?? (sender.bounce_rate !== undefined ? 100 - (sender.bounce_rate * 10) : null);
                const usagePct = sender.daily_limit ? Math.min(100, ((sender.sent_today || 0) / sender.daily_limit) * 100) : 0;
                return (
                  <div key={sender.id} className={`group flex items-center gap-2 p-2 rounded-lg border transition-all ${
                    sender.is_active !== false ? "border-border bg-surface-light/30 hover:bg-surface-light/60" : "border-border/50 bg-surface-light/10 opacity-60"
                  }`}>
                    <button
                      onClick={() => toggleEmailActive(sender.id, !(sender.is_active !== false))}
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                        sender.is_active !== false ? "bg-gold border-gold" : "border-white/20"
                      }`}
                    >
                      {sender.is_active !== false && <Check size={10} className="text-black" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <StatusDot status={deriveLiveStatus(sender)} />
                        <p className="text-[11px] font-medium truncate">{sender.email}</p>
                        {sender.is_primary && (
                          <span className="text-[8px] px-1 py-0.5 rounded bg-gold/15 text-gold">Primary</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {sender.daily_limit && (
                          <span className="text-[9px] text-muted">
                            {sender.sent_today || 0}/{sender.daily_limit} today
                          </span>
                        )}
                        {health !== null && (
                          <span className={`text-[9px] flex items-center gap-0.5 ${
                            health >= 80 ? "text-emerald-400" : health >= 50 ? "text-amber-400" : "text-red-400"
                          }`}>
                            <CircleDot size={6} /> {Math.round(health)}% health
                          </span>
                        )}
                        {sender.last_error && (
                          <span className="text-[9px] text-red-400 flex items-center gap-0.5 truncate" title={sender.last_error}>
                            <AlertCircle size={8} /> {sender.last_error.slice(0, 30)}
                          </span>
                        )}
                      </div>
                      {sender.daily_limit && usagePct > 0 && (
                        <div className="h-0.5 bg-surface-light rounded-full mt-1 overflow-hidden">
                          <div className={`h-full transition-all ${
                            usagePct > 90 ? "bg-red-400" : usagePct > 70 ? "bg-amber-400" : "bg-emerald-400"
                          }`} style={{ width: `${usagePct}%` }} />
                        </div>
                      )}
                    </div>

                    {!sender.is_primary && sender.is_active !== false && (
                      <button
                        onClick={() => setEmailPrimary(sender.id)}
                        className="opacity-0 group-hover:opacity-100 text-[9px] text-muted hover:text-gold transition-opacity"
                      >
                        Set primary
                      </button>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {activeTab === "phone" && (
            <>
              {phones.length === 0 ? (
                <EmptyState icon={<Phone size={18} />} label="No phone numbers" linkText="Add phone number" link="/dashboard/phone-email" />
              ) : phones.map(phone => {
                const usagePct = phone.daily_limit ? Math.min(100, ((phone.sent_today || 0) / phone.daily_limit) * 100) : 0;
                return (
                  <div key={phone.id} className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                    phone.is_active !== false ? "border-border bg-surface-light/30 hover:bg-surface-light/60" : "border-border/50 bg-surface-light/10 opacity-60"
                  }`}>
                    <button
                      onClick={() => togglePhoneActive(phone.id, !(phone.is_active !== false))}
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                        phone.is_active !== false ? "bg-gold border-gold" : "border-white/20"
                      }`}
                    >
                      {phone.is_active !== false && <Check size={10} className="text-black" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <StatusDot status={deriveLiveStatus(phone)} />
                        <p className="text-[11px] font-medium truncate font-mono">{phone.phone_number}</p>
                        {phone.label && <span className="text-[9px] text-muted">· {phone.label}</span>}
                      </div>
                      {phone.daily_limit && (
                        <>
                          <p className="text-[9px] text-muted">
                            {phone.sent_today || 0}/{phone.daily_limit} SMS today
                          </p>
                          <div className="h-0.5 bg-surface-light rounded-full mt-1 overflow-hidden">
                            <div className={`h-full transition-all ${usagePct > 90 ? "bg-red-400" : usagePct > 70 ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${usagePct}%` }} />
                          </div>
                        </>
                      )}
                      {phone.last_error && (
                        <p className="text-[9px] text-red-400 flex items-center gap-0.5 mt-1 truncate" title={phone.last_error}>
                          <AlertCircle size={8} /> {phone.last_error.slice(0, 40)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {activeTab === "social" && (
            <>
              {socials.length === 0 ? (
                <EmptyState icon={<Zap size={18} />} label="No social accounts" linkText="Connect social" link="/dashboard/social-manager" />
              ) : socials.map(acc => (
                <div key={acc.id} className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                  acc.is_active !== false ? "border-border bg-surface-light/30 hover:bg-surface-light/60" : "border-border/50 bg-surface-light/10 opacity-60"
                }`}>
                  <button
                    onClick={() => toggleSocialActive(acc.id, !(acc.is_active !== false))}
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                      acc.is_active !== false ? "bg-gold border-gold" : "border-white/20"
                    }`}
                  >
                    {acc.is_active !== false && <Check size={10} className="text-black" />}
                  </button>
                  <span className="shrink-0">{SOCIAL_ICON[acc.platform] || <Zap size={14} />}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <StatusDot status={deriveLiveStatus(acc)} />
                      <p className="text-[11px] font-medium truncate">{acc.account_name}</p>
                    </div>
                    <p className="text-[9px] text-muted capitalize">
                      {acc.platform}
                      {acc.status && acc.status !== "active" && <span className="ml-1 text-red-400">· {acc.status}</span>}
                      {acc.token_expires_at && new Date(acc.token_expires_at) < new Date() && (
                        <span className="ml-1 text-red-400">· token expired</span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-[10px] text-muted">
        <span>
          {activeTab === "email" && `${activeEmails}/${emails.length} emails active`}
          {activeTab === "phone" && `${activePhones}/${phones.length} phones active`}
          {activeTab === "social" && `${activeSocials}/${socials.length} socials active`}
        </span>
        <Link
          href={activeTab === "social" ? "/dashboard/social-manager" : "/dashboard/phone-email"}
          className="flex items-center gap-1 text-gold hover:text-amber-400 transition-colors"
        >
          <Plus size={10} /> Add new
        </Link>
      </div>
    </div>
  );
}

function EmptyState({ icon, label, linkText, link }: { icon: React.ReactNode; label: string; linkText: string; link: string }) {
  return (
    <div className="py-6 text-center">
      <div className="w-10 h-10 mx-auto rounded-xl bg-surface-light flex items-center justify-center text-muted mb-2">
        {icon}
      </div>
      <p className="text-[11px] text-muted mb-2">{label}</p>
      <Link href={link} className="inline-flex items-center gap-1 text-[10px] text-gold hover:underline">
        <Plus size={10} /> {linkText}
      </Link>
    </div>
  );
}

/* Summary bar showing counts across all channel types */
function StatusSummaryBar({ emails, phones, socials }: { emails: EmailSender[]; phones: PhoneSender[]; socials: SocialAccount[] }) {
  const all = [
    ...emails.map(e => deriveLiveStatus(e)),
    ...phones.map(p => deriveLiveStatus(p)),
    ...socials.map(s => deriveLiveStatus(s)),
  ];
  const total = all.length;
  if (total === 0) return null;

  const op = all.filter(s => s === "operational").length;
  const deg = all.filter(s => s === "degraded").length;
  const down = all.filter(s => s === "down").length;
  const unk = all.filter(s => s === "unknown").length;

  return (
    <div className="mb-3 p-2.5 rounded-lg bg-surface-light/40 border border-border">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-muted font-semibold uppercase tracking-wider">System Status</span>
        <span className={`text-[9px] font-semibold ${
          down > 0 ? "text-red-400" : deg > 0 ? "text-amber-400" : op > 0 ? "text-emerald-400" : "text-muted"
        }`}>
          {down > 0 ? `${down} Down` : deg > 0 ? `${deg} Issues` : op > 0 ? "All Working" : "No checks yet"}
        </span>
      </div>
      {/* Stacked bar */}
      <div className="flex h-1.5 rounded-full overflow-hidden bg-surface">
        {op > 0 && <div className="bg-emerald-400" style={{ width: `${(op / total) * 100}%` }} title={`${op} operational`} />}
        {deg > 0 && <div className="bg-amber-400" style={{ width: `${(deg / total) * 100}%` }} title={`${deg} degraded`} />}
        {down > 0 && <div className="bg-red-400" style={{ width: `${(down / total) * 100}%` }} title={`${down} down`} />}
        {unk > 0 && <div className="bg-zinc-500" style={{ width: `${(unk / total) * 100}%` }} title={`${unk} unknown`} />}
      </div>
      <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
        {op > 0 && <span className="flex items-center gap-1 text-[9px] text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{op} working</span>}
        {deg > 0 && <span className="flex items-center gap-1 text-[9px] text-amber-400"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{deg} degraded</span>}
        {down > 0 && <span className="flex items-center gap-1 text-[9px] text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />{down} down</span>}
        {unk > 0 && <span className="flex items-center gap-1 text-[9px] text-muted"><span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />{unk} unchecked</span>}
      </div>
    </div>
  );
}
