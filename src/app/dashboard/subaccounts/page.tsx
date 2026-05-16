"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Building2, Plus, X, Loader2, Mail, Pause, Play, Trash2,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { MotionPage } from "@/components/motion/motion-page";

interface Subaccount {
  id: string;
  email: string;
  name: string;
  status: "pending" | "active" | "suspended" | "cancelled";
  plan_tier: string;
  monthly_amount_cents: number;
  invited_at: string;
  activated_at: string | null;
  cancelled_at: string | null;
  client_id: string | null;
  stripe_subscription_id: string | null;
}

interface Stats {
  total: number;
  active: number;
  mrr_cents: number;
}

const PLAN_TIERS = [
  { value: "starter", label: "Starter -- $99/mo" },
  { value: "growth", label: "Growth -- $299/mo" },
  { value: "pro", label: "Pro -- $599/mo" },
  { value: "custom", label: "Custom" },
];

const STATUS_BADGE: Record<Subaccount["status"], string> = {
  pending: "bg-[rgba(59,130,246,0.10)] text-brand-accent",
  active: "bg-emerald-500/20 text-emerald-700",
  suspended: "bg-orange-500/20 text-orange-600",
  cancelled: "bg-black/8 text-black/40",
};

function formatMrr(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function SubaccountsPage() {
  const [subs, setSubs] = useState<Subaccount[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, mrr_cents: 0 });
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [form, setForm] = useState({
    email: "",
    name: "",
    plan_tier: "starter",
    monthly_amount_cents: 9900,
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/subaccounts");
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      setSubs(json.subaccounts ?? []);
      setStats(json.stats ?? { total: 0, active: 0, mrr_cents: 0 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Load failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleInvite = async () => {
    if (!form.email || !form.name) {
      toast.error("Name and email required");
      return;
    }
    setInviting(true);
    try {
      const res = await fetch("/api/subaccounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Invite failed");
      toast.success(`Invited ${form.name}`);
      setShowInvite(false);
      setForm({ email: "", name: "", plan_tier: "starter", monthly_amount_cents: 9900 });
      refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invite failed";
      toast.error(msg);
    } finally {
      setInviting(false);
    }
  };

  const updateStatus = async (id: string, status: Subaccount["status"]) => {
    try {
      const res = await fetch(`/api/subaccounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Update failed");
      toast.success(`Status: ${status}`);
      refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Update failed";
      toast.error(msg);
    }
  };

  const cancel = async (id: string) => {
    if (!confirm("Cancel this subaccount? They will lose access at end of billing period.")) return;
    try {
      const res = await fetch(`/api/subaccounts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Cancel failed");
      toast.success("Subaccount cancelled");
      refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Cancel failed";
      toast.error(msg);
    }
  };

  return (
    <MotionPage className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto">{/* -- Subaccounts command strip -- */}
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">SUB-ACCOUNTS</p>
        <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">Subaccounts</h1>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
                  onClick={() => setShowInvite(true)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold bg-brand-accent hover:bg-[#d4b55d] text-black transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Invite Subaccount
                </button>
      </div>
    </div><div className="grid grid-cols-2 lg:grid-cols-[4fr_2fr_2fr] gap-3 mb-4">
              {/* Focal tile — MRR */}
              <motion.div
                className="flex items-start gap-3 bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04, duration: 0.3 }}
              >
                <div className="w-1 self-stretch rounded-full bg-gradient-to-b from-[#2563EB] to-[#3B82F6] shrink-0" />
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Monthly Recurring Revenue</p>
                  <p className="font-display text-3xl font-bold tracking-[-0.03em] text-text-primary tabular-nums">{formatMrr(stats.mrr_cents)}</p>
                </div>
              </motion.div>
              {/* Support — Total Subaccounts */}
              <motion.div
                className="bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.10, duration: 0.3 }}
              >
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Total Subaccounts</p>
                <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">{stats.total}</p>
              </motion.div>
              {/* Support — Active */}
              <motion.div
                className="bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.14, duration: 0.3 }}
              >
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Active</p>
                <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">{stats.active}</p>
              </motion.div>
            </div>{loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-brand-accent" />
              </div>
            ) : subs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-black/10 p-10 text-center">
                <Building2 className="w-10 h-10 text-black/20 mx-auto mb-3" />
                <p className="text-black/60 text-sm">No subaccounts yet.</p>
                <p className="text-black/40 text-xs mt-1">
                  Invite your first client to get started -- they sign up under your brand and you keep the markup.
                </p>
                <button
                  onClick={() => setShowInvite(true)}
                  className="mt-5 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold bg-brand-accent hover:bg-[#d4b55d] text-black transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Invite First Subaccount
                </button>
              </div>
            ) : (
              <div className="glass rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-black/3 text-xs uppercase tracking-widest text-black/40">
                    <tr>
                      <th className="text-left px-4 py-3">Subaccount</th>
                      <th className="text-left px-4 py-3">Plan</th>
                      <th className="text-left px-4 py-3">MRR</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-right px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subs.map((sub, i) => (
                      <motion.tr
                        key={sub.id}
                        className="border-t border-black/5 hover:bg-black/3 transition-all"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                      >
                        <td className="px-4 py-3">
                          <p className="text-text-primary font-medium">{sub.name}</p>
                          <p className="text-xs text-black/40 flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3" />
                            {sub.email}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-black/65 capitalize">{sub.plan_tier}</td>
                        <td className="px-4 py-3 text-text-primary">{formatMrr(sub.monthly_amount_cents)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold capitalize ${STATUS_BADGE[sub.status]}`}>
                            {sub.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center gap-2 justify-end">
                            {sub.status === "active" && (
                              <button onClick={() => updateStatus(sub.id, "suspended")} className="p-1.5 rounded hover:bg-black/8 text-black/60" title="Suspend">
                                <Pause className="w-4 h-4" />
                              </button>
                            )}
                            {(sub.status === "suspended" || sub.status === "pending") && (
                              <button onClick={() => updateStatus(sub.id, "active")} className="p-1.5 rounded hover:bg-black/8 text-emerald-600" title="Activate">
                                <Play className="w-4 h-4" />
                              </button>
                            )}
                            {sub.status !== "cancelled" && (
                              <button onClick={() => cancel(sub.id)} className="p-1.5 rounded hover:bg-red-500/20 text-red-400" title="Cancel">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}{showInvite && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                <div className="relative w-full max-w-md  border border-black/10 bg-white p-6 shadow-2xl">
                  <button onClick={() => setShowInvite(false)} className="absolute top-4 right-4 p-1.5 rounded hover:bg-black/8 text-black/60">
                    <X className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="w-5 h-5 text-brand-accent" />
                    <h2 className="text-lg font-bold text-text-primary">Invite Subaccount</h2>
                  </div>
                  <p className="text-xs text-black/50 mb-5">
                    They will receive an email invite under your brand. Once they sign up, billing flows through your Stripe Connect account.
                  </p>
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="text-xs text-black/60 mb-1 block">Name</label>
                      <input
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Client Name"
                        className="w-full px-3 py-2 rounded-lg bg-black/5 border border-black/10 text-text-primary text-sm focus:outline-none focus:border-[#1D4ED8]/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-black/60 mb-1 block">Email</label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="client@theircompany.com"
                        className="w-full px-3 py-2 rounded-lg bg-black/5 border border-black/10 text-text-primary text-sm focus:outline-none focus:border-[#1D4ED8]/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-black/60 mb-1 block">Plan</label>
                      <select
                        value={form.plan_tier}
                        onChange={(e) => setForm({ ...form, plan_tier: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-black/5 border border-black/10 text-text-primary text-sm focus:outline-none focus:border-[#1D4ED8]/50"
                      >
                        {PLAN_TIERS.map((t) => (
                          <option key={t.value} value={t.value} className="bg-white">
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-black/60 mb-1 block">Monthly amount (USD cents)</label>
                      <input
                        type="number"
                        min={0}
                        value={form.monthly_amount_cents}
                        onChange={(e) => setForm({ ...form, monthly_amount_cents: Number(e.target.value) || 0 })}
                        className="w-full px-3 py-2 rounded-lg bg-black/5 border border-black/10 text-text-primary text-sm focus:outline-none focus:border-[#1D4ED8]/50"
                      />
                      <p className="text-xs text-black/40 mt-1">
                        e.g. 9900 = $99.00. This is what you charge the client. ShortStack base fee is deducted via Stripe Connect.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-5">
                    <button onClick={() => setShowInvite(false)} className="flex-1 px-3 py-2 rounded-lg bg-black/5 hover:bg-black/8 text-text-primary text-sm font-medium">
                      Cancel
                    </button>
                    <button onClick={handleInvite} disabled={inviting} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-brand-accent hover:bg-[#d4b55d] text-black text-sm font-semibold disabled:opacity-60">
                      {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                      Send Invite
                    </button>
                  </div>
                  <p className="mt-4 text-xs text-black/40 flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    Email delivery for invites is deferred to v2 -- see PR notes.
                  </p>
                </div>
              </div>
            )}</MotionPage>
  );
}
