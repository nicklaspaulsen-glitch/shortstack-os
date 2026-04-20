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

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("❌ STRIPE_SECRET_KEY missing. Put it in .env.local or export it in your shell.");
  process.exit(1);
}

const stripe = new Stripe(key);

// Plan definitions — adjust prices if you want different tiers.
// These match the limits in src/lib/usage-limits.ts LIMITS_BY_TIER.
const PLANS: Array<{
  tier: "STARTER" | "GROWTH" | "PRO" | "BUSINESS" | "UNLIMITED";
  name: string;
  description: string;
  monthlyUsd: number;
  annualUsd: number;
}> = [
  {
    tier: "STARTER",
    name: "ShortStack — Starter",
    description: "1 client, 5k emails/mo, 1M tokens, 500 SMS, 60 call-min. Perfect for solo operators.",
    monthlyUsd: 49,
    annualUsd: 470,
  },
  {
    tier: "GROWTH",
    name: "ShortStack — Growth",
    description: "5 clients, 20k emails, 5M tokens, 2k SMS, 300 call-min. For growing agencies.",
    monthlyUsd: 149,
    annualUsd: 1430,
  },
  {
    tier: "PRO",
    name: "ShortStack — Pro",
    description: "15 clients, 50k emails, 15M tokens, 6k SMS, 800 call-min. For serious agencies.",
    monthlyUsd: 299,
    annualUsd: 2870,
  },
  {
    tier: "BUSINESS",
    name: "ShortStack — Business",
    description: "40 clients, 200k emails, 50M tokens, 20k SMS, 2500 call-min. For scaling teams.",
    monthlyUsd: 599,
    annualUsd: 5750,
  },
  {
    tier: "UNLIMITED",
    name: "ShortStack — Unlimited",
    description: "Unlimited clients, emails, tokens, SMS, and call-minutes. For agencies going huge.",
    monthlyUsd: 1499,
    annualUsd: 14390,
  },
];

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
