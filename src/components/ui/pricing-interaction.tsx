"use client";

/**
 * PricingInteraction — hover-animated pricing plan cards.
 * Cards lift, the featured/recommended card has a shine border ring,
 * and each card shows a hover state with a glowing accent.
 * Adapted from 21st.dev/r/serafimcloud/pricing-interaction for ShortStack light theme.
 *
 * Usage:
 *   <PricingInteraction plans={PLANS} onSelect={(planId) => handleUpgrade(planId)} />
 */

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { ShineBorder } from "@/components/ui/shine-border";

export interface PricingPlan {
  id: string;
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  cta: string;
  featured?: boolean;
  badge?: string;
  priceNote?: string;
}

interface PricingInteractionProps {
  plans: PricingPlan[];
  currentPlanId?: string;
  onSelect?: (planId: string) => void;
  className?: string;
  /** Toggle between monthly and annual */
  billingPeriod?: "monthly" | "annual";
}

const SPRING = { type: "spring" as const, stiffness: 300, damping: 24 };

function PlanCard({
  plan,
  isCurrent,
  onSelect,
}: {
  plan: PricingPlan;
  isCurrent: boolean;
  onSelect?: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const reducedMotion = useReducedMotion();

  const card = (
    <motion.div
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      animate={
        reducedMotion
          ? undefined
          : hovered
          ? { y: -4, boxShadow: "0 16px 48px rgba(37,99,235,0.16)" }
          : { y: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }
      }
      transition={SPRING}
      className={cn(
        "relative flex flex-col rounded-2xl p-6 bg-white",
        "border",
        plan.featured
          ? "border-[rgba(37,99,235,0.30)]"
          : "border-[rgba(0,0,0,0.08)]"
      )}
      style={{
        boxShadow: plan.featured
          ? "0 4px 24px rgba(37,99,235,0.12)"
          : "0 2px 8px rgba(0,0,0,0.06)",
      }}
    >
      {/* Featured badge */}
      {plan.badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#2563EB] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white shadow-[0_2px_8px_rgba(37,99,235,0.35)]">
          {plan.badge}
        </span>
      )}

      {/* Header */}
      <div className="mb-5">
        <h3 className="text-base font-semibold text-text-primary">{plan.name}</h3>
        <p className="mt-1 text-xs text-text-muted">{plan.description}</p>
      </div>

      {/* Price */}
      <div className="mb-6">
        <div className="flex items-baseline gap-1">
          <span className="font-display text-4xl font-bold tracking-tight text-text-primary">
            {plan.price}
          </span>
          {plan.period && (
            <span className="text-sm text-text-muted">/{plan.period}</span>
          )}
        </div>
        {plan.priceNote && (
          <p className="mt-1 text-xs text-text-muted">{plan.priceNote}</p>
        )}
      </div>

      {/* Features */}
      <ul className="mb-6 flex flex-col gap-2.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <span
              className={cn(
                "mt-0.5 flex h-4.5 w-4.5 flex-shrink-0 items-center justify-center rounded-full",
                plan.featured ? "bg-blue-100 text-[#2563EB]" : "bg-[rgba(0,0,0,0.06)] text-text-secondary"
              )}
            >
              <Check className="h-3 w-3" strokeWidth={2.5} />
            </span>
            <span className="text-xs text-text-secondary">{f}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <div className="mt-auto">
        <motion.button
          onClick={() => onSelect?.(plan.id)}
          disabled={isCurrent}
          whileHover={reducedMotion || isCurrent ? undefined : { scale: 1.02 }}
          whileTap={reducedMotion || isCurrent ? undefined : { scale: 0.97 }}
          transition={SPRING}
          className={cn(
            "w-full rounded-xl py-2.5 text-sm font-semibold transition-all duration-200",
            "flex items-center justify-center gap-2",
            isCurrent
              ? "bg-[rgba(0,0,0,0.05)] text-text-muted cursor-not-allowed"
              : plan.featured
              ? "bg-[#2563EB] text-white shadow-[0_2px_8px_rgba(37,99,235,0.28)] hover:bg-[#1D4ED8] hover:shadow-[0_4px_16px_rgba(37,99,235,0.40)]"
              : "bg-[rgba(0,0,0,0.05)] text-text-primary hover:bg-[rgba(37,99,235,0.08)] hover:text-[#2563EB]"
          )}
        >
          {plan.featured && !isCurrent && <Zap className="h-4 w-4" />}
          {isCurrent ? "Current plan" : plan.cta}
        </motion.button>
      </div>
    </motion.div>
  );

  if (plan.featured && !isCurrent) {
    return (
      <ShineBorder
        color={["#2563EB", "#93C5FD", "#DBEAFE", "#818CF8", "#2563EB"]}
        borderWidth={2}
        borderRadius="16px"
        background="transparent"
      >
        {card}
      </ShineBorder>
    );
  }

  return card;
}

export function PricingInteraction({
  plans,
  currentPlanId,
  onSelect,
  className,
}: PricingInteractionProps) {
  return (
    <div
      className={cn(
        "grid gap-4",
        plans.length === 2 && "grid-cols-1 sm:grid-cols-2",
        plans.length === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        plans.length >= 4 && "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
        className
      )}
    >
      {plans.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          isCurrent={plan.id === currentPlanId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

export default PricingInteraction;
