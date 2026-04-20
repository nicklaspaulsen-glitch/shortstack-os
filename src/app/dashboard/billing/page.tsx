"use client";

/**
 * Agency-owner billing hub. Shows:
 *   1. Current plan hero — tier, price, next renewal, "Manage subscription"
 *      (opens Stripe Customer Portal via /api/billing/portal)
 *   2. Usage this month — 5 resources (emails, tokens, clients, sms,
 *      call_minutes) from /api/billing/usage (agency owner view).
 *   3. Token top-up — 3 one-time packs → /api/billing/buy-tokens → Stripe
 *      Checkout.
 *   4. Recent invoices — from /api/billing/invoices.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  CreditCard,
  Mail,
  Bot,
  Users,
  Smartphone,
  Phone,
  ExternalLink,
  Plus,
  ArrowUpRight,
  Download,
  Sparkles,
  Loader2,
  Crown,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PLAN_TIERS, getPlanConfig, type PlanTier } from "@/lib/plan-config";
import PageHero from "@/components/ui/page-hero";

// ── Types ────────────────────────────────────────────────────────────────────
type UsageMap = Record<string, number>;
type LimitMap = Record<string, number | "unlimited">;

interface UsageResponse {
  plan_tier: string;
  usage: UsageMap;
  limits: LimitMap;
  remaining: LimitMap;
  notes: string[];
}

interface InvoiceRow {
  id: string;
  number: string | null;
  status: string;
  amount_paid: number;
  currency: string;
  created: number;
  period_start: number;
  period_end: number;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
}

// ── Resource UI metadata ─────────────────────────────────────────────────────
const RESOURCE_META: Array<{
  key: string;
  label: string;
  icon: React.ReactNode;
  accent: string;
  suffix?: string;
}> = [
  { key: "emails", label: "Emails", icon: <Mail size={14} />, accent: "#3b82f6" },
  { key: "tokens", label: "AI Tokens", icon: <Bot size={14} />, accent: "#a855f7" },
  { key: "clients", label: "Active Clients", icon: <Users size={14} />, accent: "#10b981" },
  { key: "sms", label: "SMS Sent", icon: <Smartphone size={14} />, accent: "#f59e0b" },
  { key: "call_minutes", label: "Call Minutes", icon: <Phone size={14} />, accent: "#ef4444", suffix: "min" },
];

// ── Token packs (ids match /api/billing/buy-tokens) ──────────────────────────
const TOKEN_PACKS = [
  { id: "1m", tokens: 1_000_000, price: 149, label: "1M Tokens", popular: false },
  { id: "5m", tokens: 5_000_000, price: 599, label: "5M Tokens", popular: true },
  { id: "500k", tokens: 500_000, price: 79, label: "500K Tokens", popular: false },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  } catch {
    return `$${(amount / 100).toFixed(2)}`;
  }
}

function formatDate(unixSeconds: number): string {
  try {
    return new Date(unixSeconds * 1000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

// ── Component ────────────────────────────────────────────────────────────────
export default function BillingPage() {
  const { profile } = useAuth();
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [topUpLoading, setTopUpLoading] = useState<string | null>(null);

  const loadUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/usage/current", { cache: "no-store" });
      if (!res.ok) throw new Error(`usage ${res.status}`);
      const data = (await res.json()) as UsageResponse;
      setUsage(data);
    } catch (err) {
      console.error("[billing] usage fetch failed:", err);
    } finally {
      setUsageLoading(false);
    }
  }, []);

  const loadInvoices = useCallback(async () => {
    try {
      const res = await fetch("/api/billing/invoices", { cache: "no-store" });
      if (!res.ok) throw new Error(`invoices ${res.status}`);
      const data = (await res.json()) as { invoices: InvoiceRow[] };
      setInvoices(data.invoices || []);
    } catch (err) {
      console.error("[billing] invoices fetch failed:", err);
    } finally {
      setInvoicesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsage();
    void loadInvoices();
  }, [loadUsage, loadInvoices]);

  // Surface top-up success from query params (Stripe redirect back)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const added = params.get("tokens_added");
    if (added) {
      toast.success(`${Number(added).toLocaleString()} tokens added to your account!`, {
        duration: 5000,
      });
      window.history.replaceState({}, "", "/dashboard/billing");
      void loadUsage();
    }
  }, [loadUsage]);

  async function handleManageSubscription() {
    if (portalLoading) return;
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ self: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not open billing portal");
        setPortalLoading(false);
        return;
      }
      if (data.portal_url) {
        window.location.href = data.portal_url as string;
      } else {
        toast.error("No portal URL returned");
        setPortalLoading(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
      setPortalLoading(false);
    }
  }

  async function handleTopUp(packId: string) {
    if (topUpLoading) return;
    setTopUpLoading(packId);
    try {
      const res = await fetch("/api/billing/buy-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack_id: packId }),
      });
      const data = await res.json();
      const redirectUrl = data.url || data.checkout_url;
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        toast.error(data.error || "Top-up failed");
        setTopUpLoading(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
      setTopUpLoading(null);
    }
  }

  const planTier = (usage?.plan_tier || profile?.plan_tier || "Starter") as string;
  const planConfig = getPlanConfig(planTier);
  const planKey: PlanTier = (planTier in PLAN_TIERS ? planTier : "Starter") as PlanTier;
  const monthlyPrice = PLAN_TIERS[planKey]?.price_monthly ?? 0;

  // Next renewal estimate: first day of next calendar month (Stripe is source
  // of truth, but this is a safe user-facing approximation).
  const now = new Date();
  const nextRenewal = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return (
    <div className="fade-in max-w-6xl mx-auto space-y-6">
      <PageHero
        icon={<CreditCard size={22} />}
        eyebrow="Billing"
        title="Billing & Usage"
        subtitle="Manage your subscription, top up tokens, and download invoices."
        gradient="gold"
        actions={
          <Link
            href="/dashboard/upgrade"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/20 border border-white/25 text-white text-xs font-medium hover:bg-white/30 transition-colors"
          >
            <ArrowUpRight size={12} />
            Upgrade plan
          </Link>
        }
      />

      {/* ─── Current plan hero ─────────────────────────────────────── */}
      <div
        className="rounded-2xl border p-5 flex items-center justify-between gap-4 flex-wrap"
        style={{
          background: `linear-gradient(135deg, ${planConfig.color}0A 0%, transparent 60%)`,
          borderColor: `${planConfig.color}30`,
        }}
      >
        <div className="flex items-center gap-4 min-w-0">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: `${planConfig.color}18`,
              border: `1px solid ${planConfig.color}40`,
              color: planConfig.color,
            }}
          >
            <Crown size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="text-base font-bold text-foreground truncate">
                {planConfig.badge_label} Plan
              </h2>
              <span
                className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                style={{ background: `${planConfig.color}20`, color: planConfig.color }}
              >
                Active
              </span>
            </div>
            <p className="text-xs text-muted">
              {monthlyPrice > 0 ? (
                <>
                  <span className="text-foreground font-semibold">${monthlyPrice.toLocaleString()}</span>
                  <span>/mo</span>
                  <span className="mx-1.5 text-muted/40">·</span>
                  <span>Renews {nextRenewal.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                </>
              ) : (
                "Internal/free tier"
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleManageSubscription}
            disabled={portalLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-light text-foreground text-xs font-medium border border-border hover:bg-gold/10 hover:text-gold transition-colors disabled:opacity-60"
          >
            {portalLoading ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
            Manage subscription
          </button>
          <Link
            href="/dashboard/upgrade"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gold text-white text-xs font-semibold hover:bg-gold/90 transition-colors"
          >
            <ArrowUpRight size={12} />
            Upgrade
          </Link>
        </div>
      </div>

      {/* ─── Usage this month ──────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground">Usage this month</h2>
          {usage?.notes && usage.notes.length > 0 && (
            <span className="text-[10px] text-muted italic">
              Some metrics may be approximate
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {RESOURCE_META.map((meta) => {
            const used = usage?.usage[meta.key] ?? 0;
            const limitRaw = usage?.limits[meta.key];
            const unlimited = limitRaw === "unlimited";
            const limit = typeof limitRaw === "number" ? limitRaw : 0;
            const pct = unlimited || limit <= 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
            const warning = pct >= 80 && pct < 100;
            const maxed = pct >= 100;
            const bar = maxed
              ? "from-red-500 to-orange-500"
              : warning
              ? "from-amber-500 to-orange-400"
              : "from-emerald-500 to-teal-400";

            return (
              <div
                key={meta.key}
                className={`rounded-2xl border p-4 bg-surface transition-all ${
                  maxed ? "border-red-500/30 shadow-[0_0_16px_rgba(239,68,68,0.12)]" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: `${meta.accent}15`, color: meta.accent }}
                    >
                      {meta.icon}
                    </div>
                    <span className="text-xs font-semibold text-foreground">{meta.label}</span>
                  </div>
                  {maxed && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400">
                      Maxed
                    </span>
                  )}
                  {warning && !maxed && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500">
                      Close
                    </span>
                  )}
                </div>

                {usageLoading ? (
                  <div className="h-8 animate-pulse rounded bg-surface-light" />
                ) : (
                  <>
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="text-xl font-bold text-foreground">
                        {used.toLocaleString()}
                      </span>
                      {meta.suffix && <span className="text-[10px] text-muted">{meta.suffix}</span>}
                      <span className="text-[11px] text-muted ml-1">
                        / {unlimited ? "Unlimited" : `${limit.toLocaleString()}${meta.suffix ? ` ${meta.suffix}` : ""}`}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-light overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${bar} transition-all`}
                        style={{ width: unlimited ? "100%" : `${pct}%`, opacity: unlimited ? 0.25 : 1 }}
                      />
                    </div>
                    <p className="text-[10px] text-muted mt-1.5">
                      {unlimited ? "Unlimited on your plan" : `${pct}% used`}
                    </p>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── Token top-up ──────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Sparkles size={14} className="text-gold" />
              Token top-up
            </h2>
            <p className="text-[11px] text-muted mt-0.5">
              Ran out of tokens this month? One-time purchase — no subscription change.
            </p>
          </div>
          <Link
            href="/dashboard/usage"
            className="text-[11px] text-muted hover:text-gold transition-colors"
          >
            View usage detail →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {TOKEN_PACKS.map((pack) => {
            const isLoading = topUpLoading === pack.id;
            return (
              <div
                key={pack.id}
                className={`relative rounded-2xl border p-4 bg-surface transition-all ${
                  pack.popular ? "border-gold/30 ring-1 ring-gold/15" : "border-border"
                }`}
              >
                {pack.popular && (
                  <div className="absolute -top-2 left-4 px-2 py-0.5 rounded-full bg-gold text-white text-[9px] font-bold uppercase tracking-wider">
                    Best value
                  </div>
                )}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-foreground">{pack.label}</span>
                  <span className="text-[10px] text-muted">${(pack.price / (pack.tokens / 1_000_000)).toFixed(0)}/M</span>
                </div>
                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-2xl font-bold text-foreground">${pack.price}</span>
                  <span className="text-[10px] text-muted">one-time</span>
                </div>
                <button
                  onClick={() => handleTopUp(pack.id)}
                  disabled={isLoading || topUpLoading !== null}
                  className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors disabled:opacity-60 ${
                    pack.popular
                      ? "bg-gold text-white hover:bg-gold/90 shadow-sm"
                      : "bg-surface-light text-foreground border border-border hover:bg-gold/10 hover:text-gold"
                  }`}
                >
                  {isLoading ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Plus size={12} />
                  )}
                  Buy {pack.label.replace(" Tokens", "")} tokens
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── Invoices ──────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground">Recent invoices</h2>
          <button
            onClick={handleManageSubscription}
            disabled={portalLoading}
            className="text-[11px] text-muted hover:text-gold transition-colors disabled:opacity-60"
          >
            View all in Stripe portal →
          </button>
        </div>

        <div className="rounded-2xl border border-border bg-surface overflow-hidden">
          {invoicesLoading ? (
            <div className="p-8 text-center">
              <Loader2 size={16} className="animate-spin text-gold mx-auto" />
              <p className="text-[11px] text-muted mt-2">Loading invoices…</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-8 text-center">
              <CreditCard size={20} className="text-muted/40 mx-auto mb-2" />
              <p className="text-xs text-foreground font-medium">No invoices yet</p>
              <p className="text-[11px] text-muted mt-1">
                Once you subscribe, invoices appear here automatically.
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-surface-light/30">
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-muted px-4 py-2.5">Date</th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-muted px-4 py-2.5">Invoice</th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-muted px-4 py-2.5">Status</th>
                  <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-muted px-4 py-2.5">Amount</th>
                  <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-muted px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const statusColor =
                    inv.status === "paid"
                      ? "text-emerald-400 bg-emerald-500/10"
                      : inv.status === "open" || inv.status === "draft"
                      ? "text-amber-500 bg-amber-500/10"
                      : inv.status === "void" || inv.status === "uncollectible"
                      ? "text-muted bg-surface-light"
                      : "text-foreground bg-surface-light";
                  return (
                    <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-surface-light/50 transition-colors">
                      <td className="px-4 py-3 text-xs text-foreground">{formatDate(inv.created)}</td>
                      <td className="px-4 py-3 text-xs text-muted font-mono">{inv.number || inv.id.slice(-8)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${statusColor}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-foreground font-medium text-right">
                        {formatAmount(inv.amount_paid, inv.currency)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {inv.hosted_invoice_url && (
                            <a
                              href={inv.hosted_invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded text-muted hover:text-gold hover:bg-gold/10 transition-colors"
                              title="View invoice"
                            >
                              <ExternalLink size={12} />
                            </a>
                          )}
                          {inv.invoice_pdf && (
                            <a
                              href={inv.invoice_pdf}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded text-muted hover:text-gold hover:bg-gold/10 transition-colors"
                              title="Download PDF"
                            >
                              <Download size={12} />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
