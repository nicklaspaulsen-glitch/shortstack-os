/**
 * plan-display.ts — CLIENT-SAFE display helpers for plan tiers.
 *
 * Single source of truth for any UI that renders pricing/features:
 *   - `formatLimit(n)` — human-friendly number ("∞", "100K", "5M", "25,000")
 *   - `getTierFeatures(tier)` — human-readable feature bullets DERIVED from
 *     `LIMITS_BY_TIER` + `PLAN_TIERS`. Do NOT hardcode feature copy elsewhere.
 *
 * All callers should `import` from here instead of hand-rolling their own
 * formatters. This prevents drift between `pricing`, `upgrade`, `billing`,
 * `usage` and the Stripe product descriptions.
 */
import { LIMITS_BY_TIER, type TierLimits } from "@/lib/plan-limits";
import { PLAN_TIERS, formatBytes, type PlanTier } from "@/lib/plan-config";

/**
 * Format a numeric limit for display.
 *   - `Infinity` → "∞" (or "Unlimited" if `long=true`)
 *   - `n >= 1_000_000` → "5M" (one decimal if not a whole M)
 *   - `n >= 1_000`     → "100K"
 *   - else             → "500"
 * Optional `suffix` is appended (e.g. " min"). `long` returns the word
 * "Unlimited" instead of the ∞ glyph.
 */
export function formatLimit(
  n: number,
  opts?: { suffix?: string; long?: boolean },
): string {
  const { suffix, long } = opts || {};
  if (!Number.isFinite(n)) return long ? "Unlimited" : "∞";
  const s = suffix ? ` ${suffix}` : "";
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1)}M${s}`;
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return `${Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1)}K${s}`;
  }
  return `${n.toLocaleString()}${s}`;
}

/**
 * Human-readable feature bullets for a tier, DERIVED from numeric limits.
 * Use this on the pricing + upgrade pages instead of hand-rolling copy —
 * ensures the user-facing claim always matches what `checkLimit` enforces.
 */
export function getTierFeatures(tier: PlanTier): string[] {
  const limits: TierLimits = LIMITS_BY_TIER[tier] ?? LIMITS_BY_TIER.Starter;
  const config = PLAN_TIERS[tier];

  const clients =
    Number.isFinite(limits.clients)
      ? `Up to ${limits.clients.toLocaleString()} clients`
      : "Unlimited clients";
  const tokens =
    Number.isFinite(limits.tokens)
      ? `${formatLimit(limits.tokens)} AI tokens / month`
      : "Unlimited AI tokens";
  const emails =
    Number.isFinite(limits.emails)
      ? `${formatLimit(limits.emails)} emails / month`
      : "Unlimited emails";
  const sms =
    Number.isFinite(limits.sms)
      ? `${formatLimit(limits.sms)} SMS / month`
      : "Unlimited SMS";
  const callMinutes =
    Number.isFinite(limits.call_minutes)
      ? `${formatLimit(limits.call_minutes)} AI Caller minutes / month`
      : "Unlimited AI Caller minutes";
  const phones =
    Number.isFinite(limits.phone_numbers)
      ? `${limits.phone_numbers.toLocaleString()} phone number${limits.phone_numbers === 1 ? "" : "s"}`
      : "Unlimited phone numbers";
  const upload = `Upload limit: ${formatBytes(config.max_storage_upload)} / file`;
  const team =
    config.team_members === -1
      ? "Unlimited team members"
      : `${config.team_members.toLocaleString()} team member${config.team_members === 1 ? "" : "s"}`;

  // Tier-specific copy on top of the derived numbers so the feature card
  // still reads like a marketing list, not a spec sheet.
  switch (tier) {
    case "Starter":
      return [
        clients,
        tokens,
        emails,
        sms,
        "Lead Finder + CRM",
        `Social Manager (${config.social_platforms} platforms)`,
        "AI Script Lab",
        "Client Portal",
        upload,
        "Email support",
      ];
    case "Growth":
      return [
        "Everything in Starter",
        clients,
        tokens,
        emails,
        sms,
        callMinutes,
        "AI Agents + Agent HQ",
        "Workflows & Automations",
        "Social Manager (all platforms)",
        "Design Studio + Video Editor",
        upload,
        "Priority support",
      ];
    case "Pro":
      return [
        "Everything in Growth",
        clients,
        tokens,
        emails,
        sms,
        callMinutes,
        team,
        phones,
        "API access + Webhooks",
        upload,
        "Advanced analytics",
        "Priority support",
      ];
    case "Business":
      return [
        "Everything in Pro",
        clients,
        tokens,
        emails,
        sms,
        callMinutes,
        team,
        phones,
        "White-label branding",
        "Custom AI model tuning",
        upload,
        "Dedicated success manager",
      ];
    case "Unlimited":
      return [
        "Everything in Business",
        "Unlimited clients",
        "Unlimited AI tokens",
        "Unlimited emails + SMS",
        "Unlimited AI Caller",
        "Unlimited team members",
        "Unlimited uploads",
        "99.9% uptime SLA",
        "Dedicated Slack channel",
        "Custom integrations",
      ];
    case "Founder":
      // Internal/dev tier — same shape as Unlimited for any debug surface.
      return ["Internal founder tier — unlimited everything"];
  }
}

/**
 * Short one-line description of what a tier costs per month, used in billing
 * hero + sub-copy. Includes "cancel anytime" language. Separate from feature
 * bullets because the price string varies by billing cycle.
 */
export function formatMonthlyPrice(tier: PlanTier, billingCycle: "monthly" | "yearly" = "monthly"): string {
  const base = PLAN_TIERS[tier]?.price_monthly ?? 0;
  const effective = billingCycle === "yearly" ? Math.round(base * 0.8) : base;
  return `$${effective.toLocaleString()}/mo`;
}

/**
 * Short tier-name formatter used by the Stripe product description helper.
 * Returns something like:
 *   "5 clients, 250K emails/mo, 250K tokens, 100 SMS, 60 call-min."
 *
 * This is what the `setup-stripe-prices` script should use for the product
 * description — generated from `LIMITS_BY_TIER`, so Stripe's public
 * description can never drift from the platform's enforcement layer.
 */
export function stripeProductDescription(tier: PlanTier): string {
  const limits = LIMITS_BY_TIER[tier] ?? LIMITS_BY_TIER.Starter;
  if (!Number.isFinite(limits.clients)) {
    return "Unlimited clients, emails, tokens, SMS, and call-minutes. For agencies going huge.";
  }
  const parts = [
    `${limits.clients} clients`,
    `${formatLimit(limits.emails)} emails/mo`,
    `${formatLimit(limits.tokens)} tokens`,
    `${formatLimit(limits.sms)} SMS`,
    `${formatLimit(limits.call_minutes)} call-min`,
  ];
  const tagline: Record<string, string> = {
    Starter: "Perfect for solo operators.",
    Growth: "For growing agencies.",
    Pro: "For serious agencies.",
    Business: "For scaling teams.",
  };
  const extra = tagline[tier] ? ` ${tagline[tier]}` : "";
  return `${parts.join(", ")}.${extra}`;
}
