"use client";

/**
 * Per-affiliate detail page — agency-side.
 *
 * Surfaces the affiliate row + their referrals + commissions feed plus
 * approve / suspend controls. Linked from the affiliates table on the main
 * dashboard.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Award,
  Copy,
  CheckCircle2,
  Loader2,
  DollarSign,
  Mail,
} from "lucide-react";

import PageHero from "@/components/ui/page-hero";
import StatCard from "@/components/ui/stat-card";

interface AffiliateDetail {
  id: string;
  program_id: string;
  user_id: string | null;
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
}

interface ReferralRow {
  id: string;
  referred_email: string | null;
  click_id: string | null;
  source: string | null;
  status: "clicked" | "signed_up" | "subscribed" | "cancelled" | "refunded";
  conversion_at: string | null;
  created_at: string;
}

interface CommissionRow {
  id: string;
  referral_id: string | null;
  amount_cents: number;
  currency: string;
  status: "pending" | "approved" | "paid" | "rejected" | "refunded";
  stripe_transfer_id: string | null;
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

export default function AffiliateDetailPage() {
  const params = useParams<{ id: string }>();
  const affiliateId = params.id;

  const [affiliate, setAffiliate] = useState<AffiliateDetail | null>(null);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [stats, setStats] = useState<{
    total_referrals: number;
    subscribed: number;
    conversion_rate: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!affiliateId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/affiliate/affiliates/${affiliateId}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        affiliate: AffiliateDetail;
        referrals: ReferralRow[];
        commissions: CommissionRow[];
        stats: {
          total_referrals: number;
          subscribed: number;
          conversion_rate: number;
        };
      };
      setAffiliate(data.affiliate);
      setReferrals(data.referrals ?? []);
      setCommissions(data.commissions ?? []);
      setStats(data.stats ?? null);
    } catch (err) {
      console.error("[affiliate detail] load failed:", err);
      toast.error("Failed to load affiliate");
    } finally {
      setLoading(false);
    }
  }, [affiliateId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setStatus = useCallback(
    async (status: AffiliateDetail["status"]) => {
      if (!affiliate) return;
      setBusy(true);
      try {
        const res = await fetch(`/api/affiliate/affiliates/${affiliate.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast.success(`Status: ${status}`);
        refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update");
      } finally {
        setBusy(false);
      }
    },
    [affiliate, refresh],
  );

  const copyRefLink = useCallback(async () => {
    if (!affiliate) return;
    const url = `${window.location.origin}/go/${affiliate.ref_code}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  }, [affiliate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20 text-muted">
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  if (!affiliate) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center">
        <p className="text-sm text-muted">Affiliate not found.</p>
        <Link href="/dashboard/affiliates" className="text-gold underline">
          Back to affiliates
        </Link>
      </div>
    );
  }

  const refLink = `${typeof window !== "undefined" ? window.location.origin : "https://app.shortstack.work"}/go/${affiliate.ref_code}`;

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/affiliates"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft size={14} /> All affiliates
      </Link>

      <PageHero
        title={affiliate.name}
        subtitle={affiliate.email}
        icon={<Award size={28} />}
        gradient="purple"
        eyebrow={`Ref code: ${affiliate.ref_code}`}
        actions={
          <div className="flex gap-2">
            {affiliate.status === "pending" && (
              <button
                onClick={() => setStatus("approved")}
                disabled={busy}
                className="px-3 py-1.5 text-xs bg-success/20 text-success rounded-lg"
              >
                Approve
              </button>
            )}
            {affiliate.status === "approved" && (
              <button
                onClick={() => setStatus("suspended")}
                disabled={busy}
                className="px-3 py-1.5 text-xs bg-warning/20 text-warning rounded-lg"
              >
                Suspend
              </button>
            )}
            {affiliate.status === "suspended" && (
              <button
                onClick={() => setStatus("approved")}
                disabled={busy}
                className="px-3 py-1.5 text-xs bg-success/20 text-success rounded-lg"
              >
                Reinstate
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total earned"
          value={fmtCents(affiliate.total_earned_cents)}
          icon={<DollarSign size={14} />}
          premium
        />
        <StatCard
          label="Pending"
          value={fmtCents(affiliate.pending_cents)}
          icon={<DollarSign size={14} />}
        />
        <StatCard
          label="Paid"
          value={fmtCents(affiliate.paid_cents)}
          icon={<CheckCircle2 size={14} />}
        />
        <StatCard
          label="Conversion"
          value={
            stats ? `${(stats.conversion_rate * 100).toFixed(1)}%` : "—"
          }
          change={stats ? `${stats.subscribed}/${stats.total_referrals}` : undefined}
          icon={<Award size={14} />}
        />
      </div>

      <div className="rounded-2xl border border-border bg-card/40 p-5 space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Referral link
        </h3>
        <div className="flex gap-2 items-center">
          <input
            value={refLink}
            readOnly
            className="flex-1 rounded-lg bg-muted/10 border border-border px-3 py-2 text-sm font-mono"
          />
          <button
            onClick={copyRefLink}
            className="px-3 py-2 bg-gold text-dark rounded-lg text-sm font-semibold flex items-center gap-2"
          >
            <Copy size={14} /> Copy
          </button>
        </div>
        <div className="text-xs text-muted">
          Share this link. Clicks are attributed for the program's cookie window;
          a signup that follows credits this affiliate. Stripe-paid subscriptions
          create pending commissions automatically.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card/40 p-5 space-y-3">
          <h3 className="font-semibold">Recent referrals</h3>
          {referrals.length === 0 ? (
            <p className="text-xs text-muted">No referrals yet.</p>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {referrals.map((r) => (
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
          <h3 className="font-semibold">Commissions</h3>
          {commissions.length === 0 ? (
            <p className="text-xs text-muted">No commissions yet.</p>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {commissions.map((c) => (
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
