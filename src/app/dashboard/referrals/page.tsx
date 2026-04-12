"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Gift, Copy, Users, DollarSign, Share2
} from "lucide-react";
import toast from "react-hot-toast";

export default function ReferralsPage() {
  useAuth();
  const [referralCode] = useState(() => `SS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`);
  const referralLink = `https://shortstack-os.vercel.app/book?ref=${referralCode}`;

  return (
    <div className="fade-in space-y-5 max-w-3xl">
      <div>
        <h1 className="page-header mb-0 flex items-center gap-2">
          <Gift size={18} className="text-gold" /> Referral Program
        </h1>
        <p className="text-xs text-muted mt-0.5">Earn rewards for every client you refer</p>
      </div>

      {/* How it works */}
      <div className="card border-gold/10">
        <h2 className="section-header">How It Works</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { step: "1", title: "Share Your Link", desc: "Send your unique referral link to business owners", icon: <Share2 size={20} /> },
            { step: "2", title: "They Sign Up", desc: "When they book a call and become a client", icon: <Users size={20} /> },
            { step: "3", title: "You Get Paid", desc: "Earn 10% of their monthly fee for 12 months", icon: <DollarSign size={20} /> },
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

      {/* Referral link */}
      <div className="card">
        <h2 className="section-header">Your Referral Link</h2>
        <div className="flex gap-2">
          <code className="flex-1 text-xs font-mono p-3 rounded-lg truncate bg-surface-light border border-border">
            {referralLink}
          </code>
          <button onClick={() => { navigator.clipboard.writeText(referralLink); toast.success("Referral link copied!"); }}
            className="btn-primary text-xs px-4 flex items-center gap-1.5 shrink-0">
            <Copy size={12} /> Copy
          </button>
        </div>
        <p className="text-[9px] text-muted mt-2">Your code: <span className="text-gold font-mono">{referralCode}</span></p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center">
          <p className="text-[10px] text-muted">Referrals Sent</p>
          <p className="text-2xl font-bold text-foreground">0</p>
        </div>
        <div className="card text-center">
          <p className="text-[10px] text-muted">Converted</p>
          <p className="text-2xl font-bold text-success">0</p>
        </div>
        <div className="card text-center">
          <p className="text-[10px] text-muted">Earnings</p>
          <p className="text-2xl font-bold text-gold">$0</p>
        </div>
      </div>

      {/* Rewards table */}
      <div className="card">
        <h2 className="section-header">Reward Tiers</h2>
        <div className="space-y-2">
          {[
            { refs: "1-2", reward: "10% commission for 12 months", bonus: "" },
            { refs: "3-5", reward: "15% commission for 12 months", bonus: "$500 bonus" },
            { refs: "6-10", reward: "20% commission for 12 months", bonus: "$1,000 bonus" },
            { refs: "10+", reward: "20% commission forever", bonus: "Free ShortStack account" },
          ].map((tier, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-surface-light border border-border">
              <div>
                <p className="text-xs font-semibold">{tier.refs} referrals</p>
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
    </div>
  );
}
