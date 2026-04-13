"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Gift, Copy, Users, DollarSign, Share2,
  Loader, Plus, X, Clock, CheckCircle, UserPlus, TrendingUp
} from "lucide-react";
import toast from "react-hot-toast";

interface Referral {
  id: string;
  referred_name: string;
  referred_email: string;
  status: string;
  commission_earned: number;
  created_at: string;
}

interface ReferralStats {
  total: number;
  pending: number;
  signed_up: number;
  converted: number;
  total_earned: number;
}

export default function ReferralsPage() {
  useAuth();
  const [referralCode, setReferralCode] = useState("");
  const [stats, setStats] = useState<ReferralStats>({ total: 0, pending: 0, signed_up: 0, converted: 0, total_earned: 0 });
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadReferrals(); }, []);

  async function loadReferrals() {
    try {
      const res = await fetch("/api/referrals");
      if (res.ok) {
        const data = await res.json();
        setReferralCode(data.referral_code || "");
        setStats(data.stats);
        setReferrals(data.referrals || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function submitReferral(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const form = e.currentTarget;
    const fd = new FormData(form);

    try {
      const res = await fetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referred_name: fd.get("name"),
          referred_email: fd.get("email"),
          referred_phone: fd.get("phone"),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Referral submitted!");
        setShowForm(false);
        form.reset();
        loadReferrals();
      } else {
        toast.error(data.error || "Failed to submit");
      }
    } catch {
      toast.error("Network error");
    }
    setSubmitting(false);
  }

  const referralLink = referralCode
    ? `https://shortstack-os.vercel.app/book?ref=${referralCode}`
    : "";

  // Determine current tier
  const tierInfo = stats.total >= 10
    ? { label: "Elite", rate: "20% forever", color: "#c8a855" }
    : stats.total >= 6
    ? { label: "Gold", rate: "20% for 12mo", color: "#c8a855" }
    : stats.total >= 3
    ? { label: "Silver", rate: "15% for 12mo", color: "#9ca3af" }
    : { label: "Bronze", rate: "10% for 12mo", color: "#cd7f32" };

  const statusIcon = (status: string) => {
    switch (status) {
      case "converted": return <CheckCircle size={12} className="text-success" />;
      case "signed_up": return <UserPlus size={12} className="text-blue-400" />;
      default: return <Clock size={12} className="text-muted" />;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "converted": return "Converted";
      case "signed_up": return "Signed Up";
      case "expired": return "Expired";
      default: return "Pending";
    }
  };

  return (
    <div className="fade-in space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Gift size={18} className="text-gold" /> Referral Program
          </h1>
          <p className="text-xs text-muted mt-0.5">Earn rewards for every client you refer</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary text-xs flex items-center gap-1.5">
          <Plus size={12} /> Submit Referral
        </button>
      </div>

      {/* How it works */}
      <div className="card border-gold/10">
        <h2 className="section-header">How It Works</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { step: "1", title: "Share Your Link", desc: "Send your unique referral link to business owners", icon: <Share2 size={20} /> },
            { step: "2", title: "They Sign Up", desc: "When they book a call and become a client", icon: <Users size={20} /> },
            { step: "3", title: "You Get Paid", desc: "Earn commission on their monthly fee", icon: <DollarSign size={20} /> },
          ].map(s => (
            <div key={s.step} className="text-center">
              <div className="w-12 h-12 rounded-xl mx-auto mb-2 flex items-center justify-center" style={{ background: "rgba(200,168,85,0.08)" }}>
                <span className="text-gold">{s.icon}</span>
              </div>
              <p className="text-xs font-bold mb-0.5">{s.title}</p>
              <p className="text-[10px] text-muted">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader size={20} className="animate-spin text-gold" />
        </div>
      ) : (
        <>
          {/* Referral link */}
          <div className="card">
            <h2 className="section-header">Your Referral Link</h2>
            <div className="flex gap-2">
              <code className="flex-1 text-xs font-mono p-3 rounded-lg truncate bg-surface-light border border-border">
                {referralLink || "Loading..."}
              </code>
              <button
                onClick={() => {
                  if (referralLink) {
                    navigator.clipboard.writeText(referralLink);
                    toast.success("Referral link copied!");
                  }
                }}
                className="btn-primary text-xs px-4 flex items-center gap-1.5 shrink-0">
                <Copy size={12} /> Copy
              </button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-[9px] text-muted">Your code: <span className="text-gold font-mono">{referralCode}</span></p>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${tierInfo.color}15`, color: tierInfo.color }}>
                  {tierInfo.label} Tier
                </span>
                <span className="text-[9px] text-muted">{tierInfo.rate}</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="card text-center">
              <p className="text-[10px] text-muted">Total Referrals</p>
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            </div>
            <div className="card text-center">
              <p className="text-[10px] text-muted">Pending</p>
              <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
            </div>
            <div className="card text-center">
              <p className="text-[10px] text-muted">Converted</p>
              <p className="text-2xl font-bold text-success">{stats.converted}</p>
            </div>
            <div className="card text-center">
              <p className="text-[10px] text-muted">Earnings</p>
              <p className="text-2xl font-bold text-gold">${stats.total_earned.toFixed(0)}</p>
            </div>
          </div>

          {/* Referral history */}
          {referrals.length > 0 && (
            <div className="card">
              <h2 className="section-header flex items-center gap-1.5">
                <TrendingUp size={14} /> Referral History
              </h2>
              <div className="space-y-1.5">
                {referrals.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-light border border-border">
                    <div className="flex items-center gap-3 min-w-0">
                      {statusIcon(r.status)}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{r.referred_name}</p>
                        <p className="text-[10px] text-muted truncate">{r.referred_email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-[9px] px-2 py-0.5 rounded-full ${
                        r.status === "converted" ? "bg-success/10 text-success" :
                        r.status === "signed_up" ? "bg-blue-500/10 text-blue-400" :
                        "bg-surface-light text-muted"
                      }`}>
                        {statusLabel(r.status)}
                      </span>
                      {r.commission_earned > 0 && (
                        <span className="text-xs text-gold font-mono">${r.commission_earned.toFixed(0)}</span>
                      )}
                      <span className="text-[9px] text-muted">
                        {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {referrals.length === 0 && (
            <div className="card text-center py-8 border-dashed border-border">
              <Users size={28} className="mx-auto text-muted mb-2 opacity-40" />
              <p className="text-xs text-muted">No referrals yet. Share your link or submit a referral to get started!</p>
            </div>
          )}

          {/* Reward tiers */}
          <div className="card">
            <h2 className="section-header">Reward Tiers</h2>
            <div className="space-y-2">
              {[
                { refs: "1-2", reward: "10% commission for 12 months", bonus: "", tier: "Bronze", active: stats.total >= 1 && stats.total < 3 },
                { refs: "3-5", reward: "15% commission for 12 months", bonus: "$500 bonus", tier: "Silver", active: stats.total >= 3 && stats.total < 6 },
                { refs: "6-10", reward: "20% commission for 12 months", bonus: "$1,000 bonus", tier: "Gold", active: stats.total >= 6 && stats.total < 10 },
                { refs: "10+", reward: "20% commission forever", bonus: "Free ShortStack account", tier: "Elite", active: stats.total >= 10 },
              ].map((tier) => (
                <div key={tier.refs} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                  tier.active ? "bg-gold/[0.04] border-gold/15" : "bg-surface-light border-border"
                }`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold">{tier.refs} referrals</p>
                      {tier.active && <span className="text-[8px] bg-gold/10 text-gold px-1.5 py-0.5 rounded-full font-bold uppercase">Current</span>}
                    </div>
                    <p className="text-[10px] text-muted">{tier.reward}</p>
                  </div>
                  {tier.bonus && (
                    <span className="text-[9px] px-2 py-1 rounded-full" style={{ background: "rgba(200,168,85,0.08)", color: "#c8a855" }}>
                      + {tier.bonus}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Submit Referral Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-surface rounded-2xl border border-border w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2"><Gift size={14} className="text-gold" /> Submit a Referral</h3>
              <button onClick={() => setShowForm(false)} className="text-muted hover:text-foreground"><X size={16} /></button>
            </div>
            <p className="text-[10px] text-muted">Know someone who needs marketing help? Submit their info and we&apos;ll reach out.</p>
            <form onSubmit={submitReferral} className="space-y-3">
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider">Business / Contact Name *</label>
                <input name="name" required className="input w-full text-xs" placeholder="John's Plumbing" />
              </div>
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider">Email *</label>
                <input name="email" type="email" required className="input w-full text-xs" placeholder="john@example.com" />
              </div>
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider">Phone (optional)</label>
                <input name="phone" className="input w-full text-xs" placeholder="+1 555-1234" />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-xs">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary text-xs flex items-center gap-1.5">
                  {submitting ? <Loader size={12} className="animate-spin" /> : <Plus size={12} />}
                  {submitting ? "Submitting..." : "Submit Referral"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
