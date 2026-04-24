"use client";

/**
 * BillingSettings — current plan, cancel subscription, agency Stripe Connect,
 * monthly usage widget, and payment method management. Lazy-loaded so users
 * who never visit the billing tab don't ship this chunk.
 */

import { Zap, ExternalLink, Shield, AlertTriangle, CreditCard, Plus, Loader2, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import { getPlanConfig } from "@/lib/plan-config";
import AgencyStripeConnect from "@/components/settings/agency-stripe-connect";

interface PlanUsage {
  plan_tier: string;
  usage: Record<string, number>;
  limits: Record<string, number | "unlimited">;
  remaining: Record<string, number | "unlimited">;
}

interface PaymentMethod {
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
}

interface Props {
  profile: { plan_tier?: string | null } | null;
  planUsage: PlanUsage | null;
  planUsageLoaded: boolean;
  paymentMethod: PaymentMethod | null;
  paymentLoading: boolean;
  portalLoading: boolean;
  openBillingPortal: () => Promise<void>;
}

/** Inline usage widget — shows quota bars for the current billing period. */
function PlanUsageWidget({ planUsage }: { planUsage: PlanUsage | null }) {
  if (!planUsage) return <p className="text-xs text-muted text-center py-4">No usage data available.</p>;
  const entries = Object.entries(planUsage.usage);
  if (entries.length === 0) return <p className="text-xs text-muted text-center py-4">No usage this period.</p>;
  return (
    <div className="space-y-3">
      {entries.map(([key, used]) => {
        const limit = planUsage.limits[key];
        const pct = limit === "unlimited" ? 0 : Math.min(100, Math.round((used / (limit as number)) * 100));
        const label = key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        return (
          <div key={key}>
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="text-foreground">{label}</span>
              <span className="text-muted">{used} / {limit === "unlimited" ? "∞" : limit}</span>
            </div>
            {limit !== "unlimited" && (
              <div className="h-1.5 rounded-full bg-surface">
                <div className={`h-1.5 rounded-full ${pct >= 90 ? "bg-danger" : pct >= 70 ? "bg-gold" : "bg-success"}`}
                  style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function BillingSettings({ profile, planUsage, planUsageLoaded, paymentMethod, paymentLoading, portalLoading, openBillingPortal }: Props) {
  return (
    <div className="space-y-4">
      <div className="card">
        <h3 className="section-header">Current Plan</h3>
        <div className="flex items-center justify-between p-4 bg-gold/5 border border-gold/20 rounded-xl flex-wrap gap-3">
          <div>
            <p className="text-lg font-bold" style={{ color: getPlanConfig(profile?.plan_tier).color }}>{getPlanConfig(profile?.plan_tier).badge_label}</p>
            <p className="text-xs text-muted">${getPlanConfig(profile?.plan_tier).price_monthly}/month</p>
          </div>
          <div className="flex items-center gap-2">
            <a href="/dashboard/pricing" className="btn-primary text-xs flex items-center gap-1">
              <Zap size={11} /> Change Plan
            </a>
            <button onClick={openBillingPortal} disabled={portalLoading} className="btn-secondary text-xs flex items-center gap-1">
              {portalLoading ? <Loader2 size={11} className="animate-spin" /> : <ExternalLink size={11} />}
              Manage in Stripe
            </button>
          </div>
        </div>
        <p className="text-[10px] text-muted mt-2 flex items-center gap-1">
          <Shield size={9} /> Use &quot;Change Plan&quot; for upgrades/downgrades. &quot;Manage in Stripe&quot; to view invoices, update card, or cancel.
        </p>
      </div>

      {/* Cancel Subscription */}
      <div className="card border-red-500/20 bg-red-500/[0.02]">
        <div className="flex items-start gap-3">
          <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-400">Cancel Subscription</h3>
            <p className="text-[10px] text-muted mt-0.5">
              Stop billing at the end of the current period. You keep access until then.
            </p>
          </div>
          <button onClick={openBillingPortal} disabled={portalLoading} className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 flex items-center gap-1.5">
            {portalLoading ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />}
            Cancel via Stripe
          </button>
        </div>
      </div>

      {/* Agency Stripe Connect */}
      <AgencyStripeConnect />

      {/* Monthly Usage */}
      <div className="card">
        <h3 className="section-header">Usage This Month</h3>
        {!planUsageLoaded ? (
          <div className="flex items-center gap-2 text-xs text-muted py-6 justify-center">
            <Loader2 size={12} className="animate-spin" /> Loading usage...
          </div>
        ) : (
          <PlanUsageWidget planUsage={planUsage} />
        )}
      </div>

      {/* Payment Method */}
      <div className="card">
        <h3 className="section-header">Payment Method</h3>
        {paymentLoading ? (
          <div className="flex items-center gap-3 p-3 bg-surface-light/50 rounded-lg border border-border animate-pulse">
            <div className="w-5 h-5 bg-white/10 rounded" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-32 bg-white/10 rounded" />
              <div className="h-2 w-20 bg-white/10 rounded" />
            </div>
          </div>
        ) : paymentMethod ? (
          <div className="flex items-center gap-3 p-3 bg-surface-light/50 rounded-lg border border-border">
            <CreditCard size={20} className="text-gold" />
            <div>
              <p className="text-sm font-medium capitalize">{paymentMethod.brand} ending in {paymentMethod.last4}</p>
              <p className="text-xs text-muted">Expires {String(paymentMethod.exp_month).padStart(2, "0")}/{paymentMethod.exp_year}</p>
            </div>
            <button onClick={openBillingPortal} disabled={portalLoading}
              className="ml-auto text-xs text-gold hover:underline flex items-center gap-1 disabled:opacity-50">
              {portalLoading ? <Loader2 size={10} className="animate-spin" /> : <ExternalLink size={10} />}
              Update
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3 bg-surface-light/50 rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <CreditCard size={20} className="text-muted" />
              <p className="text-sm text-muted">No payment method on file</p>
            </div>
            <button onClick={openBillingPortal} disabled={portalLoading}
              className="text-xs bg-gold/10 text-gold border border-gold/20 px-3 py-1.5 rounded-lg hover:bg-gold/20 transition flex items-center gap-1 disabled:opacity-50">
              {portalLoading ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
              Add Payment Method
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
