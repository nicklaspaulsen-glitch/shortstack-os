/**
 * Agency self-checkout — creates a Stripe Checkout Session so users can
 * subscribe to a ShortStack plan (Starter / Pro / Business / Unlimited).
 *
 * Request body (preferred):
 *   { plan_tier: "starter"|"pro"|"business"|"unlimited", billing_cycle: "monthly"|"yearly" }
 *
 * Request body (legacy — still accepted for backward compat with existing callers):
 *   { plan: "starter"|..., billing: "monthly"|"annual" }
 *
 * Returns: { url: string, checkout_url: string }  (checkout_url kept for legacy)
 *
 * Stripe Price IDs are looked up from env vars with the pattern
 *   STRIPE_PRICE_<TIER>_<CYCLE>      e.g. STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_BUSINESS_ANNUAL
 *
 * Currently configured (as of 2026-04-19) — Annual prices are live:
 *   STRIPE_PRICE_STARTER_ANNUAL, STRIPE_PRICE_PRO_ANNUAL,
 *   STRIPE_PRICE_BUSINESS_ANNUAL, STRIPE_PRICE_UNLIMITED_ANNUAL, STRIPE_PRICE_GROWTH_ANNUAL
 *
 * TODO (user action required): create monthly Prices in Stripe Dashboard
 * and add to Vercel as:
 *   STRIPE_PRICE_STARTER_MONTHLY
 *   STRIPE_PRICE_PRO_MONTHLY
 *   STRIPE_PRICE_BUSINESS_MONTHLY
 *   STRIPE_PRICE_UNLIMITED_MONTHLY
 *   STRIPE_PRICE_GROWTH_MONTHLY   (optional — Growth tier is still in PLAN_TIERS)
 *
 * If the env var for the requested cycle is missing, the endpoint returns a
 * clear 400 error telling the user which variable to configure. It will NOT
 * auto-create ad-hoc Prices (that made testing flaky and leaked test Prices
 * into the dashboard).
 *
 * The Founder tier is INTERNAL ONLY and will always be rejected here.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { PLAN_TIERS, PlanTier } from "@/lib/plan-config";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

// Plan tiers that are valid for self-checkout (Founder is internal-only,
// Growth is still supported as a legacy tier).
const CHECKOUT_TIERS = ["starter", "growth", "pro", "business", "unlimited"] as const;
type CheckoutTier = typeof CHECKOUT_TIERS[number];

function normalizeTier(raw: unknown): CheckoutTier | null {
  if (typeof raw !== "string") return null;
  const lower = raw.toLowerCase().trim();
  return (CHECKOUT_TIERS as readonly string[]).includes(lower) ? (lower as CheckoutTier) : null;
}

function normalizeCycle(raw: unknown): "monthly" | "yearly" | null {
  if (typeof raw !== "string") return null;
  const lower = raw.toLowerCase().trim();
  if (lower === "monthly" || lower === "month") return "monthly";
  if (lower === "yearly" || lower === "annual" || lower === "year") return "yearly";
  return null;
}

/** Env var names to check, in priority order, for a given tier + cycle.
 *  Backward-compat: original setup used STRIPE_PRICE_<TIER> (no suffix) for
 *  monthly + STRIPE_PRICE_<TIER>_ANNUAL for yearly. Newer convention adds
 *  STRIPE_PRICE_<TIER>_MONTHLY. Try the new name first, then the legacy. */
function priceEnvNames(tier: CheckoutTier, cycle: "monthly" | "yearly"): string[] {
  const upper = tier.toUpperCase();
  if (cycle === "yearly") {
    return [`STRIPE_PRICE_${upper}_ANNUAL`, `STRIPE_PRICE_${upper}_YEARLY`];
  }
  // Monthly: try _MONTHLY first, then legacy no-suffix name.
  return [`STRIPE_PRICE_${upper}_MONTHLY`, `STRIPE_PRICE_${upper}`];
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Accept both new spec names (plan_tier/billing_cycle) and legacy (plan/billing).
  const tier = normalizeTier(body.plan_tier ?? body.plan);
  const cycle = normalizeCycle(body.billing_cycle ?? body.billing);

  if (!tier) {
    return NextResponse.json(
      { error: `Invalid plan_tier. Must be one of: ${CHECKOUT_TIERS.join(", ")}` },
      { status: 400 },
    );
  }
  if (!cycle) {
    return NextResponse.json(
      { error: "Invalid billing_cycle. Must be 'monthly' or 'yearly'" },
      { status: 400 },
    );
  }

  // Proper-cased key for PLAN_TIERS lookup (e.g. "Pro")
  const tierKey = (tier.charAt(0).toUpperCase() + tier.slice(1)) as PlanTier;
  if (!PLAN_TIERS[tierKey]) {
    return NextResponse.json({ error: "Unknown plan tier" }, { status: 400 });
  }

  // Look up Stripe Price ID from env — try new + legacy names in order.
  const envCandidates = priceEnvNames(tier, cycle);
  let priceId: string | undefined;
  let resolvedFrom: string | undefined;
  for (const name of envCandidates) {
    const v = process.env[name];
    if (v && v.trim()) {
      priceId = v.trim();
      resolvedFrom = name;
      break;
    }
  }
  if (!priceId) {
    return NextResponse.json(
      {
        error: `Pricing not configured for ${tierKey} (${cycle}). Set one of ${envCandidates.join(" or ")} in Vercel env to enable this plan/cycle combination.`,
        missing_env_var: envCandidates[0],
        tried: envCandidates,
      },
      { status: 400 },
    );
  }
  console.log(`[billing/checkout] using ${resolvedFrom} for ${tierKey} ${cycle}`);

  // Resolve baseUrl safely. Stripe rejects success_url/cancel_url with
  // "Not a valid URL" if the URL doesn't start with http(s):// and have a
  // proper hostname. Try env → request origin → default, and validate
  // every fallback so we never hand Stripe something broken.
  let baseUrl = "";
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    (() => {
      try { return new URL(request.url).origin; } catch { return null; }
    })(),
    "https://app.shortstack.work",
    "https://shortstack-os.vercel.app",
  ];
  for (const c of candidates) {
    if (!c) continue;
    try {
      const u = new URL(c.startsWith("http") ? c : `https://${c}`);
      if (u.protocol === "http:" || u.protocol === "https:") {
        baseUrl = u.origin;
        break;
      }
    } catch { /* next */ }
  }
  if (!baseUrl) {
    return NextResponse.json(
      { error: "Server couldn't resolve a valid base URL for Stripe redirects. Set NEXT_PUBLIC_APP_URL in Vercel env." },
      { status: 500 },
    );
  }

  try {
    // Get or create Stripe customer for this agency owner
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, stripe_customer_id")
      .eq("id", user.id)
      .single();

    let customerId = profile?.stripe_customer_id as string | null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: profile?.full_name || undefined,
        metadata: { shortstack_user_id: user.id },
      });
      customerId = customer.id;
      // Persist so subsequent checkouts don't create duplicate Stripe
      // customers. Log the failure if it happens — the user can still
      // check out this time, but we want to catch the dupe-generation path.
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
      if (updateErr) {
        console.error("[billing/checkout] Failed to persist stripe_customer_id", {
          user_id: user.id,
          customer_id: customerId,
          error: updateErr.message,
        });
      }
    }

    // Stripe Tax is optional — only enable if explicitly turned on via env.
    // (If the account hasn't completed Stripe Tax onboarding, enabling this
    //  causes the session creation to fail.)
    const enableAutomaticTax = process.env.STRIPE_AUTOMATIC_TAX === "true";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        type: "agency_subscription",
        user_id: user.id,
        plan_tier: tierKey,
        billing_cycle: cycle,
      },
      subscription_data: {
        metadata: {
          type: "agency_subscription",
          user_id: user.id,
          plan_tier: tierKey,
          billing_cycle: cycle,
        },
      },
      success_url: `${baseUrl}/dashboard?subscribed=${tier}`,
      cancel_url: `${baseUrl}/pricing?cancelled=true`,
      allow_promotion_codes: true,
      ...(enableAutomaticTax ? { automatic_tax: { enabled: true } } : {}),
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL" }, { status: 500 });
    }

    // Return `url` per spec, and `checkout_url` for legacy callers.
    return NextResponse.json({ url: session.url, checkout_url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    const message = err instanceof Error ? err.message : "Failed to create checkout session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
