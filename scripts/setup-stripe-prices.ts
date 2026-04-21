/**
 * setup-stripe-prices.ts
 *
 * One-shot script that creates all 5 ShortStack plan tiers in Stripe and prints
 * the env vars ready to paste into Vercel.
 *
 * Usage (PowerShell):
 *   $env:STRIPE_SECRET_KEY="sk_live_..."; npx tsx scripts/setup-stripe-prices.ts
 *
 * Usage (bash/mac):
 *   STRIPE_SECRET_KEY=sk_live_... npx tsx scripts/setup-stripe-prices.ts
 *
 * Safe to re-run: if a product named "ShortStack — <Tier>" already exists, we
 * reuse it instead of creating duplicates.
 */

import Stripe from "stripe";
import { PLAN_TIERS, type PlanTier } from "../src/lib/plan-config";
import { stripeProductDescription } from "../src/lib/plan-display";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("❌ STRIPE_SECRET_KEY missing. Put it in .env.local or export it in your shell.");
  process.exit(1);
}

const stripe = new Stripe(key);

/**
 * Plan definitions derived from PLAN_TIERS + LIMITS_BY_TIER so the Stripe
 * product description cannot drift from the platform's enforcement layer.
 *
 * NOTE: the actual USD prices here are the monthly prices from PLAN_TIERS.
 * If you need to change pricing, update `src/lib/plan-config.ts` so every
 * pricing surface — dashboard cards, billing page, Stripe product — stays
 * aligned in one commit. Annual price is monthly * 12 * 0.8 (20% off).
 */
const TIER_KEYS: Array<{ key: PlanTier; envTier: "STARTER" | "GROWTH" | "PRO" | "BUSINESS" | "UNLIMITED" }> = [
  { key: "Starter", envTier: "STARTER" },
  { key: "Growth", envTier: "GROWTH" },
  { key: "Pro", envTier: "PRO" },
  { key: "Business", envTier: "BUSINESS" },
  { key: "Unlimited", envTier: "UNLIMITED" },
];

const PLANS: Array<{
  tier: "STARTER" | "GROWTH" | "PRO" | "BUSINESS" | "UNLIMITED";
  name: string;
  description: string;
  monthlyUsd: number;
  annualUsd: number;
}> = TIER_KEYS.map(({ key, envTier }) => {
  const monthly = PLAN_TIERS[key].price_monthly;
  return {
    tier: envTier,
    name: `ShortStack — ${PLAN_TIERS[key].badge_label}`,
    description: stripeProductDescription(key),
    monthlyUsd: monthly,
    // 20% annual discount, rounded to nearest dollar (matches dashboard/upgrade).
    annualUsd: Math.round(monthly * 12 * 0.8),
  };
});

async function findOrCreateProduct(name: string, description: string): Promise<string> {
  // Search existing products by name to avoid duplicates on re-run.
  const existing = await stripe.products.search({
    query: `name:"${name}"`,
    limit: 1,
  });
  if (existing.data.length > 0) {
    console.log(`   → Reusing existing product: ${existing.data[0].id}`);
    return existing.data[0].id;
  }
  const created = await stripe.products.create({
    name,
    description,
  });
  console.log(`   → Created product: ${created.id}`);
  return created.id;
}

async function findOrCreatePrice(
  productId: string,
  unitAmount: number,
  interval: "month" | "year",
  lookupKey: string,
): Promise<string> {
  // Search by lookup_key (our own unique handle) so we can find + reuse.
  const existing = await stripe.prices.list({
    product: productId,
    active: true,
    limit: 100,
  });
  const match = existing.data.find(
    (p) =>
      p.unit_amount === unitAmount &&
      p.recurring?.interval === interval &&
      p.currency === "usd",
  );
  if (match) {
    console.log(`   → Reusing existing ${interval}ly price: ${match.id}`);
    return match.id;
  }
  const created = await stripe.prices.create({
    product: productId,
    unit_amount: unitAmount,
    currency: "usd",
    recurring: { interval },
    lookup_key: lookupKey,
    nickname: `${interval}ly`,
  });
  console.log(`   → Created ${interval}ly price: ${created.id}`);
  return created.id;
}

async function main() {
  console.log("🚀 Setting up Stripe products + prices for ShortStack\n");

  const results: Array<{
    tier: string;
    monthlyPriceId: string;
    annualPriceId: string;
  }> = [];

  for (const plan of PLANS) {
    console.log(`\n📦 ${plan.name}`);
    const productId = await findOrCreateProduct(plan.name, plan.description);

    const monthlyPriceId = await findOrCreatePrice(
      productId,
      plan.monthlyUsd * 100,
      "month",
      `shortstack_${plan.tier.toLowerCase()}_monthly`,
    );
    const annualPriceId = await findOrCreatePrice(
      productId,
      plan.annualUsd * 100,
      "year",
      `shortstack_${plan.tier.toLowerCase()}_annual`,
    );

    results.push({ tier: plan.tier, monthlyPriceId, annualPriceId });
  }

  // Output the env var block
  console.log("\n\n════════════════════════════════════════════════════════════");
  console.log("✅ All 5 products + 10 prices are live in Stripe.\n");
  console.log("📋 Copy this block into Vercel → Settings → Environment Variables");
  console.log("   (Production + Preview only; Development is locked for sensitive keys)\n");
  console.log("────────────────────────────────────────────────────────────\n");

  for (const r of results) {
    console.log(`STRIPE_PRICE_${r.tier}_MONTHLY=${r.monthlyPriceId}`);
  }
  console.log("");
  for (const r of results) {
    console.log(`STRIPE_PRICE_${r.tier}_ANNUAL=${r.annualPriceId}`);
  }

  console.log("\n────────────────────────────────────────────────────────────");
  console.log("\n💡 Vercel tip: you can paste the entire block at once —");
  console.log('   click "Paste .env" on the env-vars page.\n');
  console.log("🔗 Stripe dashboard:");
  console.log("   https://dashboard.stripe.com/products\n");
}

main().catch((err) => {
  console.error("\n❌ Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
