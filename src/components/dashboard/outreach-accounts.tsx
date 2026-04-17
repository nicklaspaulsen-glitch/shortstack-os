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
}

interface SocialAccount {
  id: string;
  platform: string;
  account_name: string;
  is_active?: boolean;
  status?: string;
}

const SOCIAL_ICON: Record<string, React.ReactNode> = {
  instagram: <InstagramIcon size={14} />,
  facebook: <FacebookIcon size={14} />,
  tiktok: <TikTokIcon size={14} />,
  linkedin: <LinkedInIcon size={14} />,
  twitter: <XTwitterIcon size={14} />,
  x: <XTwitterIcon size={14} />,
};

/* ── Component ───────────────────────────────────────────────────────── */

export default function OutreachAccounts() {
  const [emails, setEmails] = useState<EmailSender[]>([]);
  const [phones, setPhones] = useState<PhoneSender[]>([]);
  const [socials, setSocials] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"email" | "phone" | "social">("email");

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
        </div>
        <div className="flex items-center gap-1">
          <button onClick={loadAll} className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-light transition-colors">
            <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          </button>
          <Link href="/dashboard/phone-email" className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-light transition-colors">
            <Settings size={11} />
          </Link>
        </div>
      </div>

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
                    <p className="text-[11px] font-medium truncate">{acc.account_name}</p>
                    <p className="text-[9px] text-muted capitalize">
                      {acc.platform}
                      {acc.status && acc.status !== "active" && <span className="ml-1 text-red-400">· {acc.status}</span>}
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
