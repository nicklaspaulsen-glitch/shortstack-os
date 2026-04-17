"use client";

import { useState } from "react";
import {
  Gift, Copy, Users, DollarSign, Share2, Plus, X, Clock,
  CheckCircle, UserPlus, TrendingUp, Award, Mail, BarChart3,
  ExternalLink, Globe, Calculator, Star, Send
} from "lucide-react";
import EmptyState from "@/components/empty-state";
import PageHero from "@/components/ui/page-hero";

/* ------------------------------------------------------------------ */
/*  Mock Data                                                          */
/* ------------------------------------------------------------------ */

interface Referral {
  id: string;
  referred_name: string;
  referred_email: string;
  status: string;
  commission_earned: number;
  created_at: string;
  source: string;
}

const MOCK_REFERRALS: Referral[] = [];

const TOP_REFERRERS: { name: string; referrals: number; earned: number; tier: string }[] = [];

const EMAIL_TEMPLATES = [
  { id: "et1", name: "Personal Introduction", subject: "I thought you might be interested in this", preview: "Hey {name}, I've been working with an amazing marketing team and thought of you..." },
  { id: "et2", name: "Results-Based", subject: "How we grew our business by 40%", preview: "Hi {name}, I wanted to share something that's been a game-changer for my business..." },
  { id: "et3", name: "Simple Referral", subject: "Quick recommendation", preview: "Hey {name}, ShortStack Digital has been killing it for us. Thought you should check them out..." },
  { id: "et4", name: "Holiday Special", subject: "Exclusive offer for you!", preview: "Hi {name}, my marketing agency is running a special deal right now and I get a referral bonus..." },
];

const REFERRAL_ANALYTICS = {
  totalClicks: 0,
  uniqueVisitors: 0,
  signups: 0,
  conversions: 0,
  conversionRate: "0%",
  avgDaysToConvert: 0,
  topSource: "—",
  monthlyTrend: [] as number[],
};

const PAYOUT_HISTORY: { id: string; date: string; amount: number; method: string; status: string }[] = [];

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function ReferralsPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "leaderboard" | "invite" | "analytics" | "payouts" | "landing">("overview");
  const [referrals] = useState(MOCK_REFERRALS);
  const [showForm, setShowForm] = useState(false);
  const [calcMRR, setCalcMRR] = useState(2000);
  const [calcReferrals, setCalcReferrals] = useState(5);

  const referralCode = "ALEX-SS-2026";
  const referralLink = `https://shortstack-os.vercel.app/book?ref=${referralCode}`;

  const stats = {
    total: referrals.length,
    pending: referrals.filter(r => r.status === "pending").length,
    signed_up: referrals.filter(r => r.status === "signed_up").length,
    converted: referrals.filter(r => r.status === "converted").length,
    total_earned: referrals.reduce((s, r) => s + r.commission_earned, 0),
  };

  const tierInfo = stats.total >= 10
    ? { label: "Elite", rate: "20% forever", color: "#c8a855" }
    : stats.total >= 6
    ? { label: "Gold", rate: "20% for 12mo", color: "#c8a855" }
    : stats.total >= 3
    ? { label: "Silver", rate: "15% for 12mo", color: "#9ca3af" }
    : { label: "Bronze", rate: "10% for 12mo", color: "#cd7f32" };

  const statusIcon = (status: string) => {
    if (status === "converted") return <CheckCircle size={12} className="text-green-400" />;
    if (status === "signed_up") return <UserPlus size={12} className="text-blue-400" />;
    return <Clock size={12} className="text-muted" />;
  };

  const commissionRate = stats.total >= 10 ? 0.20 : stats.total >= 6 ? 0.20 : stats.total >= 3 ? 0.15 : 0.10;
  const calculatedEarnings = calcMRR * commissionRate * calcReferrals * 12;

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: Gift },
    { id: "leaderboard" as const, label: "Leaderboard", icon: Award },
    { id: "invite" as const, label: "Invite", icon: Mail },
    { id: "analytics" as const, label: "Analytics", icon: BarChart3 },
    { id: "payouts" as const, label: "Payouts", icon: DollarSign },
    { id: "landing" as const, label: "Landing Page", icon: Globe },
  ];

  return (
    <div className="fade-in space-y-5 max-w-3xl">
      <PageHero
        icon={<Gift size={28} />}
        title="Referral Program"
        subtitle="Earn rewards for every client you refer."
        gradient="green"
        actions={
          <button onClick={() => setShowForm(true)} className="px-3 py-1.5 rounded-lg bg-white/15 border border-white/25 text-white text-xs font-semibold hover:bg-white/25 transition-all flex items-center gap-1.5">
            <Plus size={12} /> Submit Referral
          </button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all border ${
              activeTab === t.id ? "bg-gold/10 border-gold/20 text-gold font-medium" : "border-border text-muted hover:text-foreground"
            }`}>
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </div>

      {/* ---- TAB: Overview ---- */}
      {activeTab === "overview" && (
        <>
          {/* How it works */}
          <div className="card p-4 border-gold/10">
            <h2 className="text-xs font-semibold mb-3">How It Works</h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { step: "1", title: "Share Your Link", desc: "Send your unique referral link to business owners", icon: Share2 },
                { step: "2", title: "They Sign Up", desc: "When they book a call and become a client", icon: Users },
                { step: "3", title: "You Get Paid", desc: "Earn commission on their monthly fee", icon: DollarSign },
              ].map(s => (
                <div key={s.step} className="text-center">
                  <div className="w-12 h-12 rounded-xl mx-auto mb-2 flex items-center justify-center bg-gold/10">
                    <s.icon size={20} className="text-gold" />
                  </div>
                  <p className="text-xs font-bold mb-0.5">{s.title}</p>
                  <p className="text-[10px] text-muted">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Referral link */}
          <div className="card p-4">
            <h2 className="text-xs font-semibold mb-2">Your Referral Link</h2>
            <div className="flex gap-2">
              <code className="flex-1 text-xs font-mono p-3 rounded-lg truncate bg-white/[0.02] border border-border">{referralLink}</code>
              <button onClick={() => navigator.clipboard.writeText(referralLink)}
                className="px-4 py-2 rounded-lg bg-gold text-black text-xs font-semibold flex items-center gap-1.5 shrink-0">
                <Copy size={12} /> Copy
              </button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-[9px] text-muted">Code: <span className="text-gold font-mono">{referralCode}</span></p>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${tierInfo.color}15`, color: tierInfo.color }}>
                  {tierInfo.label} Tier
                </span>
                <span className="text-[9px] text-muted">{tierInfo.rate}</span>
              </div>
            </div>
            {/* Social share buttons */}
            <div className="flex gap-2 mt-3">
              <button className="flex-1 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-[10px] font-medium flex items-center justify-center gap-1">
                <ExternalLink size={10} /> Twitter
              </button>
              <button className="flex-1 px-3 py-1.5 rounded-lg bg-blue-600/10 text-blue-300 text-[10px] font-medium flex items-center justify-center gap-1">
                <ExternalLink size={10} /> LinkedIn
              </button>
              <button className="flex-1 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-[10px] font-medium flex items-center justify-center gap-1">
                <ExternalLink size={10} /> WhatsApp
              </button>
              <button className="flex-1 px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 text-[10px] font-medium flex items-center justify-center gap-1">
                <Mail size={10} /> Email
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted">Total Referrals</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted">Pending</p>
              <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted">Converted</p>
              <p className="text-2xl font-bold text-green-400">{stats.converted}</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted">Earnings</p>
              <p className="text-2xl font-bold text-gold">${stats.total_earned}</p>
            </div>
          </div>

          {/* Referral history */}
          <div className="card p-4">
            <h2 className="text-xs font-semibold mb-3 flex items-center gap-1.5"><TrendingUp size={12} /> Referral History</h2>
            {referrals.length === 0 ? (
              <EmptyState
                icon={<Gift size={24} />}
                title="No Referrals Yet"
                description="Share your unique referral link with business owners and earn commission on every client that signs up."
                actionLabel="Set Up Referral Program"
                onAction={() => setActiveTab("invite")}
              />
            ) : (
              <div className="space-y-1.5">
                {referrals.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div className="flex items-center gap-3 min-w-0">
                      {statusIcon(r.status)}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{r.referred_name}</p>
                        <p className="text-[10px] text-muted truncate">{r.referred_email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[8px] bg-white/5 text-muted px-1.5 py-0.5 rounded">{r.source}</span>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full ${
                        r.status === "converted" ? "bg-green-400/10 text-green-400" :
                        r.status === "signed_up" ? "bg-blue-400/10 text-blue-400" :
                        "bg-white/5 text-muted"
                      }`}>{r.status}</span>
                      {r.commission_earned > 0 && <span className="text-xs text-gold font-mono">${r.commission_earned}</span>}
                      <span className="text-[9px] text-muted">{new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reward tiers */}
          <div className="card p-4">
            <h2 className="text-xs font-semibold mb-3">Reward Tiers</h2>
            <div className="space-y-2">
              {[
                { refs: "1-2", reward: "10% commission for 12 months", bonus: "", tier: "Bronze", active: stats.total >= 1 && stats.total < 3 },
                { refs: "3-5", reward: "15% commission for 12 months", bonus: "$500 bonus", tier: "Silver", active: stats.total >= 3 && stats.total < 6 },
                { refs: "6-10", reward: "20% commission for 12 months", bonus: "$1,000 bonus", tier: "Gold", active: stats.total >= 6 && stats.total < 10 },
                { refs: "10+", reward: "20% commission forever", bonus: "Free ShortStack account", tier: "Elite", active: stats.total >= 10 },
              ].map(tier => (
                <div key={tier.refs} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                  tier.active ? "bg-gold/[0.04] border-gold/15" : "border-border"
                }`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold">{tier.refs} referrals</p>
                      {tier.active && <span className="text-[8px] bg-gold/10 text-gold px-1.5 py-0.5 rounded-full font-bold uppercase">Current</span>}
                    </div>
                    <p className="text-[10px] text-muted">{tier.reward}</p>
                  </div>
                  {tier.bonus && <span className="text-[9px] px-2 py-1 rounded-full bg-gold/10 text-gold">+ {tier.bonus}</span>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ---- TAB: Leaderboard ---- */}
      {activeTab === "leaderboard" && (
        <div className="card p-4">
          <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Award size={12} className="text-gold" /> Top Referrers</h3>
          {TOP_REFERRERS.length === 0 ? (
            <div className="text-center py-8"><Award size={24} className="mx-auto mb-2 text-muted/30" /><p className="text-xs text-muted">No referrers yet</p></div>
          ) : (
            <div className="space-y-2">
              {TOP_REFERRERS.map((r, i) => (
                <div key={r.name} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    i === 0 ? "bg-gold/20 text-gold" : i === 1 ? "bg-gray-300/20 text-gray-300" : i === 2 ? "bg-orange-400/20 text-orange-400" : "bg-white/5 text-muted"
                  }`}>{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-xs font-medium">{r.name}</p>
                    <p className="text-[10px] text-muted">{r.tier} tier</p>
                  </div>
                  <span className="text-xs text-muted">{r.referrals} referrals</span>
                  <span className="text-xs font-bold text-gold">${r.earned.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---- TAB: Invite ---- */}
      {activeTab === "invite" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Mail size={12} className="text-gold" /> Email Invite Templates</h3>
            <div className="space-y-2">
              {EMAIL_TEMPLATES.map(t => (
                <div key={t.id} className="p-3 rounded-lg border border-border hover:border-gold/20 transition-all cursor-pointer">
                  <p className="text-xs font-medium">{t.name}</p>
                  <p className="text-[10px] text-gold mt-0.5">Subject: {t.subject}</p>
                  <p className="text-[10px] text-muted mt-0.5">{t.preview}</p>
                  <button className="mt-2 text-[10px] px-2 py-1 rounded bg-gold text-black font-medium flex items-center gap-1"><Send size={8} /> Use Template</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---- TAB: Analytics ---- */}
      {activeTab === "analytics" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-3 text-center">
              <p className="text-2xl font-bold font-mono">{REFERRAL_ANALYTICS.totalClicks}</p>
              <p className="text-[10px] text-muted">Link Clicks</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-2xl font-bold font-mono text-green-400">{REFERRAL_ANALYTICS.signups}</p>
              <p className="text-[10px] text-muted">Sign-ups</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-2xl font-bold font-mono text-gold">{REFERRAL_ANALYTICS.conversionRate}</p>
              <p className="text-[10px] text-muted">Conversion Rate</p>
            </div>
          </div>

          {/* Trend chart */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3">Referrals Over Time</h3>
            {REFERRAL_ANALYTICS.monthlyTrend.length === 0 ? (
              <div className="text-center py-8"><BarChart3 size={24} className="mx-auto mb-2 text-muted/30" /><p className="text-xs text-muted">No trend data yet</p></div>
            ) : (
              <div className="flex items-end gap-2 h-24">
                {REFERRAL_ANALYTICS.monthlyTrend.map((v, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[8px] text-muted">{v}</span>
                    <div className="w-full rounded-t bg-gold/30" style={{ height: `${(v / Math.max(...REFERRAL_ANALYTICS.monthlyTrend, 1)) * 100}%` }} />
                    <span className="text-[8px] text-muted">{["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"][i]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Commission Calculator */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Calculator size={12} className="text-gold" /> Commission Calculator</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[10px] text-muted mb-1">Avg Client MRR ($)</label>
                <input type="number" value={calcMRR} onChange={e => setCalcMRR(Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground" />
              </div>
              <div>
                <label className="block text-[10px] text-muted mb-1">Number of Referrals</label>
                <input type="number" value={calcReferrals} onChange={e => setCalcReferrals(Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground" />
              </div>
            </div>
            <div className="p-3 rounded-lg border border-gold/20 bg-gold/[0.03] text-center">
              <p className="text-[10px] text-muted mb-1">Estimated Annual Earnings ({(commissionRate * 100).toFixed(0)}% rate)</p>
              <p className="text-2xl font-bold text-gold">${calculatedEarnings.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* ---- TAB: Payouts ---- */}
      {activeTab === "payouts" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-3 text-center">
              <p className="text-2xl font-bold text-gold">${stats.total_earned}</p>
              <p className="text-[10px] text-muted">Total Earned</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-2xl font-bold text-green-400">${PAYOUT_HISTORY.reduce((s, p) => s + p.amount, 0)}</p>
              <p className="text-[10px] text-muted">Total Paid Out</p>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><DollarSign size={12} className="text-gold" /> Payout History</h3>
            {PAYOUT_HISTORY.length === 0 ? (
              <div className="text-center py-8"><DollarSign size={24} className="mx-auto mb-2 text-muted/30" /><p className="text-xs text-muted">No payouts yet</p></div>
            ) : (
              <div className="space-y-2">
                {PAYOUT_HISTORY.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div>
                      <p className="text-xs font-medium">${p.amount.toLocaleString()}</p>
                      <p className="text-[10px] text-muted">{p.method} &middot; {p.date}</p>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded bg-green-400/10 text-green-400">{p.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3">Payout Settings</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-muted mb-1">Payout Method</label>
                <select className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground">
                  <option>Bank Transfer (ACH)</option>
                  <option>PayPal</option>
                  <option>Check</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-muted mb-1">Minimum Payout</label>
                <select className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground">
                  <option>$50</option>
                  <option>$100</option>
                  <option>$250</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---- TAB: Landing Page ---- */}
      {activeTab === "landing" && (
        <div className="card p-4">
          <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Globe size={12} className="text-gold" /> Referral Landing Page Builder</h3>
          <p className="text-[10px] text-muted mb-4">Customize the page your referrals see when they click your link.</p>
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="p-6 text-center bg-gold/[0.03]">
              <h2 className="text-lg font-bold">Grow Your Business with ShortStack</h2>
              <p className="text-xs text-muted mt-1">Referred by {referralCode}</p>
              <p className="text-sm text-muted mt-3">Join 100+ businesses that trust ShortStack Digital for their marketing needs.</p>
              <button className="mt-4 px-6 py-2 rounded-lg bg-gold text-black text-sm font-semibold">Book a Free Strategy Call</button>
            </div>
            <div className="p-4 grid grid-cols-3 gap-4 border-t border-border">
              <div className="text-center">
                <p className="text-lg font-bold text-gold">40%</p>
                <p className="text-[10px] text-muted">Avg Lead Increase</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gold">4.8<Star size={10} className="inline text-yellow-400 ml-0.5" /></p>
                <p className="text-[10px] text-muted">Client Rating</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gold">100+</p>
                <p className="text-[10px] text-muted">Happy Clients</p>
              </div>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted">Customize</button>
            <button className="px-3 py-1.5 rounded-lg bg-gold text-black text-xs font-semibold flex items-center gap-1"><Copy size={10} /> Copy Page URL</button>
          </div>
        </div>
      )}

      {/* Submit Referral Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-surface rounded-2xl border border-border w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2"><Gift size={14} className="text-gold" /> Submit a Referral</h3>
              <button onClick={() => setShowForm(false)} className="text-muted hover:text-foreground"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider">Business / Contact Name *</label>
                <input className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground" placeholder="John's Plumbing" />
              </div>
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider">Email *</label>
                <input type="email" className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground" placeholder="john@example.com" />
              </div>
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider">Phone (optional)</label>
                <input className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground" placeholder="+1 555-1234" />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setShowForm(false)} className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted">Cancel</button>
                <button className="px-3 py-1.5 rounded-lg bg-gold text-black text-xs font-semibold flex items-center gap-1.5"><Plus size={12} /> Submit</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
