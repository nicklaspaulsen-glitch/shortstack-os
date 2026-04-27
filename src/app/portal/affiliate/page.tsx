"use client";

/**
 * Affiliate-side portal — the affiliate's own home for stats, ref link, and
 * Stripe Connect setup. Lighter aesthetic than the agency dashboard since
 * portal pages serve external users.
 *
 * On first visit we POST /api/affiliate/me/claim to link this user to any
 * pending invites that match their email. Subsequent visits just hit /me.
 */

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Award,
  Copy,
  CheckCircle2,
  ExternalLink,
  Loader2,
  DollarSign,
  Share2,
} from "lucide-react";

interface AffiliateRow {
  id: string;
  program_id: string;
  email: string;
  name: string;
  ref_code: string;
  stripe_account_id: string | null;
  status: "pending" | "approved" | "suspended" | "rejected";
  total_earned_cents: number;
  pending_cents: number;
  paid_cents: number;
  joined_at: string;
  approved_at: string | null;
  affiliate_programs?: {
    id: string;
    name: string;
    description: string | null;
    commission_type: "flat" | "percentage";
    commission_value: number;
    cookie_days: number;
    payout_threshold_cents: number;
    payout_schedule: string;
    status: string;
  } | null;
}

interface ReferralLite {
  id: string;
  affiliate_id: string;
  referred_email: string | null;
  status: "clicked" | "signed_up" | "subscribed" | "cancelled" | "refunded";
  conversion_at: string | null;
  created_at: string;
}

interface CommissionLite {
  id: string;
  affiliate_id: string;
  amount_cents: number;
  currency: string;
  status: "pending" | "approved" | "paid" | "rejected" | "refunded";
  paid_at: string | null;
  created_at: string;
}

function fmtCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function commissionLabel(p: { commission_type: "flat" | "percentage"; commission_value: number }): string {
  return p.commission_type === "flat"
    ? `${fmtCents(Math.round(p.commission_value))} flat per sale`
    : `${p.commission_value}% recurring`;
}

export default function AffiliatePortalPage() {
  const [affiliates, setAffiliates] = useState<AffiliateRow[]>([]);
  const [recentReferrals, setRecentReferrals] = useState<ReferralLite[]>([]);
  const [recentCommissions, setRecentCommissions] = useState<CommissionLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingStripe, setConnectingStripe] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      // Best-effort claim — pulls in any pending invites by email match.
      // Failure is fine; the /me call below still surfaces existing rows.
      try {
        await fetch("/api/affiliate/me/claim", { method: "POST" });
      } catch {
        /* ignore */
      }

      const res = await fetch("/api/affiliate/me", { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401) {
          toast.error("Please sign in to view your affiliate portal");
        }
        return;
      }
      const data = (await res.json()) as {
        affiliates: AffiliateRow[];
        recent_referrals: ReferralLite[];
        recent_commissions: CommissionLite[];
      };
      setAffiliates(data.affiliates ?? []);
      setRecentReferrals(data.recent_referrals ?? []);
      setRecentCommissions(data.recent_commissions ?? []);
    } catch (err) {
      console.error("[affiliate portal] load failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const connectStripe = useCallback(async () => {
    setConnectingStripe(true);
    try {
      const res = await fetch("/api/integrations/stripe-connect/onboard", {
        method: "POST",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { url: string };
      window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Stripe Connect failed");
    } finally {
      setConnectingStripe(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted">
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  if (affiliates.length === 0) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-6 text-center space-y-4">
        <Award size={40} className="mx-auto text-gold/60" />
        <h1 className="text-2xl font-semibold">Affiliate portal</h1>
        <p className="text-muted">
          You're not enrolled in any affiliate program yet. If you've been invited
          via email, sign in with that email to link your account.
        </p>
      </div>
    );
  }

  // Total earnings across all affiliate memberships.
  const totalEarned = affiliates.reduce((s, a) => s + (a.total_earned_cents ?? 0), 0);
  const totalPending = affiliates.reduce((s, a) => s + (a.pending_cents ?? 0), 0);
  const totalPaid = affiliates.reduce((s, a) => s + (a.paid_cents ?? 0), 0);

  // The Stripe-connected status is shared across affiliate memberships for
  // the same user. We check whether ANY membership has a stripe_account_id;
  // if any does, we treat the user as connected (the onboarding flow writes
  // to agency_stripe_accounts and the affiliate row populates lazily).
  const stripeConnected = affiliates.some((a) => !!a.stripe_account_id);

  return (
    <div className="max-w-5xl mx-auto py-10 px-6 space-y-8">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-gold/10 border border-gold/30">
          <Award size={24} className="text-gold" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Your affiliate portal</h1>
          <p className="text-sm text-muted">Track referrals, earnings, and payouts</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border bg-card/40 p-5">
          <div className="text-xs uppercase text-muted">Total earned</div>
          <div className="text-2xl font-bold text-gold mt-1">{fmtCents(totalEarned)}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card/40 p-5">
          <div className="text-xs uppercase text-muted">Pending</div>
          <div className="text-2xl font-bold mt-1">{fmtCents(totalPending)}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card/40 p-5">
          <div className="text-xs uppercase text-muted">Paid out</div>
          <div className="text-2xl font-bold text-success mt-1">{fmtCents(totalPaid)}</div>
        </div>
      </div>

      {!stripeConnected && (
        <div className="rounded-2xl border border-warning/40 bg-warning/5 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h3 className="font-semibold">Connect Stripe to receive payouts</h3>
            <p className="text-sm text-muted">
              Once connected, your commissions are paid to your Stripe account
              automatically as soon as they cross the program threshold.
            </p>
          </div>
          <button
            onClick={connectStripe}
            disabled={connectingStripe}
            className="flex items-center gap-2 px-4 py-2 bg-gold text-dark text-sm font-semibold rounded-lg disabled:opacity-60"
          >
            <ExternalLink size={14} />
            {connectingStripe ? "Opening…" : "Connect Stripe"}
          </button>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Your programs</h2>
        {affiliates.map((a) => (
          <AffiliateProgramBlock key={a.id} affiliate={a} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card/40 p-5 space-y-3">
          <h3 className="font-semibold">Recent referrals</h3>
          {recentReferrals.length === 0 ? (
            <p className="text-xs text-muted">No referrals yet — share your link!</p>
          ) : (
            <div className="space-y-2 max-h-[360px] overflow-y-auto">
              {recentReferrals.map((r) => (
                <div
                  key={r.id}
                  className="flex justify-between gap-3 text-xs border-b border-border last:border-0 py-2"
                >
                  <span className="truncate">
                    {r.referred_email ?? "(anonymous click)"}
                  </span>
                  <span className="text-muted whitespace-nowrap">{fmtDate(r.created_at)}</span>
                  <span
                    className={`font-semibold capitalize ${
                      r.status === "subscribed"
                        ? "text-success"
                        : r.status === "signed_up"
                        ? "text-blue-400"
                        : "text-muted"
                    }`}
                  >
                    {r.status.replace("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-card/40 p-5 space-y-3">
          <h3 className="font-semibold">Recent payouts</h3>
          {recentCommissions.length === 0 ? (
            <p className="text-xs text-muted">No commissions yet.</p>
          ) : (
            <div className="space-y-2 max-h-[360px] overflow-y-auto">
              {recentCommissions.map((c) => (
                <div
                  key={c.id}
                  className="flex justify-between gap-3 text-xs border-b border-border last:border-0 py-2"
                >
                  <span className="font-mono">
                    {fmtCents(c.amount_cents, c.currency)}
                  </span>
                  <span className="text-muted">{fmtDate(c.created_at)}</span>
                  <span
                    className={`font-semibold capitalize ${
                      c.status === "paid"
                        ? "text-success"
                        : c.status === "pending"
                        ? "text-warning"
                        : "text-muted"
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AffiliateProgramBlock({ affiliate }: { affiliate: AffiliateRow }) {
  const program = affiliate.affiliate_programs;
  const refLink = `${typeof window !== "undefined" ? window.location.origin : "https://app.shortstack.work"}/go/${affiliate.ref_code}`;

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(refLink);
    toast.success("Link copied");
  }, [refLink]);

  const share = useCallback(async () => {
    if (!navigator.share) {
      await navigator.clipboard.writeText(refLink);
      toast.success("Link copied (sharing not supported)");
      return;
    }
    try {
      await navigator.share({
        title: program?.name ?? "Affiliate link",
        text: "Try this — sign up through my link:",
        url: refLink,
      });
    } catch {
      // user cancelled — ignore
    }
  }, [refLink, program?.name]);

  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-semibold">{program?.name ?? "Program"}</h3>
          {program?.description && (
            <p className="text-xs text-muted">{program.description}</p>
          )}
          {program && (
            <p className="text-xs text-gold mt-1">
              {commissionLabel(program)} · {program.cookie_days}d cookie · payout threshold{" "}
              {fmtCents(program.payout_threshold_cents)}
            </p>
          )}
        </div>
        <span
          className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${
            affiliate.status === "approved"
              ? "bg-success/15 text-success"
              : affiliate.status === "pending"
              ? "bg-warning/15 text-warning"
              : "bg-danger/15 text-danger"
          }`}
        >
          {affiliate.status}
        </span>
      </div>

      <div className="flex gap-2 items-center">
        <input
          value={refLink}
          readOnly
          className="flex-1 rounded-lg bg-muted/10 border border-border px-3 py-2 text-sm font-mono"
        />
        <button
          onClick={copy}
          className="px-3 py-2 bg-gold text-dark rounded-lg text-sm font-semibold flex items-center gap-2"
        >
          <Copy size={14} /> Copy
        </button>
        <button
          onClick={share}
          className="px-3 py-2 border border-border rounded-lg text-sm flex items-center gap-2"
        >
          <Share2 size={14} /> Share
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg bg-muted/10 p-2">
          <div className="text-muted">Earned</div>
          <div className="font-semibold text-gold">{fmtCents(affiliate.total_earned_cents)}</div>
        </div>
        <div className="rounded-lg bg-muted/10 p-2">
          <div className="text-muted">Pending</div>
          <div className="font-semibold">{fmtCents(affiliate.pending_cents)}</div>
        </div>
        <div className="rounded-lg bg-muted/10 p-2">
          <div className="text-muted">Paid</div>
          <div className="font-semibold text-success">{fmtCents(affiliate.paid_cents)}</div>
        </div>
      </div>
    </div>
  );
}
