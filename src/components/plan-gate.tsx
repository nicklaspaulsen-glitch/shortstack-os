"use client";

import { ReactNode } from "react";
import { ArrowUpCircle } from "lucide-react";

// ── Plan hierarchy ──
// Starter < Growth < Enterprise
// Matches TIER_LIMITS from /api/billing/usage

const PLAN_RANK: Record<string, number> = {
  Starter: 0,
  Growth: 1,
  Enterprise: 2,
};

function meetsRequiredPlan(currentPlan: string | null | undefined, requiredPlan: string): boolean {
  const current = PLAN_RANK[currentPlan || "Starter"] ?? 0;
  const required = PLAN_RANK[requiredPlan] ?? 0;
  return current >= required;
}

interface PlanGateProps {
  /** The minimum plan required to access this feature */
  requiredPlan: "Starter" | "Growth" | "Enterprise";
  /** The client's current package_tier (from the clients table) */
  clientPlan?: string | null;
  /** Content to render if the plan is sufficient */
  children: ReactNode;
  /** Optional feature name shown in the upgrade prompt */
  featureName?: string;
}

/**
 * Wraps features that require a specific plan tier.
 * If the client's plan meets the requirement, children are rendered.
 * Otherwise, a styled upgrade card is shown.
 *
 * Usage:
 *   <PlanGate requiredPlan="Growth" clientPlan={client.package_tier}>
 *     <ExpensiveFeature />
 *   </PlanGate>
 */
export default function PlanGate({ requiredPlan, clientPlan, children, featureName }: PlanGateProps) {
  if (meetsRequiredPlan(clientPlan, requiredPlan)) {
    return <>{children}</>;
  }

  return (
    <div className="rounded-xl border border-gold/20 bg-gold/[0.04] p-6 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gold/10">
        <ArrowUpCircle size={20} className="text-gold" />
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1">
        {featureName ? `${featureName} requires` : "Upgrade to"} {requiredPlan}
      </h3>
      <p className="text-xs text-muted mb-4 max-w-xs mx-auto">
        {clientPlan || "Starter"} plan doesn&apos;t include this feature.
        Upgrade to <span className="text-gold font-medium">{requiredPlan}</span> to unlock it.
      </p>
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-gold/30 bg-gold/10 px-4 py-1.5 text-xs font-medium text-gold">
        <ArrowUpCircle size={12} />
        Upgrade to {requiredPlan}
      </span>
    </div>
  );
}

export { meetsRequiredPlan, PLAN_RANK };
