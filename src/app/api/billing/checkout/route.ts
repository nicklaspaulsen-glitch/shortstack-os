import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { PLAN_TIERS, PlanTier } from "@/lib/plan-config";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

// Map plan names to Stripe Price IDs (create these in Stripe Dashboard)
// If not set, ad-hoc prices are created automatically
const PRICE_IDS: Record<string, string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER,
  growth: process.env.STRIPE_PRICE_GROWTH,
  pro: process.env.STRIPE_PRICE_PRO,
  business: process.env.STRIPE_PRICE_BUSINESS,
  unlimited: process.env.STRIPE_PRICE_UNLIMITED,
  starter_annual: process.env.STRIPE_PRICE_STARTER_ANNUAL,
  growth_annual: process.env.STRIPE_PRICE_GROWTH_ANNUAL,
  pro_annual: process.env.STRIPE_PRICE_PRO_ANNUAL,
  business_annual: process.env.STRIPE_PRICE_BUSINESS_ANNUAL,
  unlimited_annual: process.env.STRIPE_PRICE_UNLIMITED_ANNUAL,
};

// Agency self-checkout — creates a Stripe Checkout Session for the agency's own plan
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { plan, billing } = await request.json();
  const tierKey = (plan || "").charAt(0).toUpperCase() + (plan || "").slice(1).toLowerCase() as PlanTier;
  const isAnnual = billing === "annual";

  if (!PLAN_TIERS[tierKey]) {
    return NextResponse.json({ error: "Invalid plan tier" }, { status: 400 });
  }

  const tier = PLAN_TIERS[tierKey];
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app";

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
      await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    // Use pre-configured Stripe Price ID or create ad-hoc
    // Annual pricing has env vars like STRIPE_PRICE_GROWTH_ANNUAL
    const annualKey = `${plan.toLowerCase()}_annual`;
    let priceId = isAnnual
      ? (PRICE_IDS[annualKey] || null)
      : PRICE_IDS[plan.toLowerCase()];

    if (!priceId) {
      const monthlyAmount = tier.price_monthly * 100;
      const unitAmount = isAnnual ? Math.round(monthlyAmount * 12 * 0.8) : monthlyAmount;
      const price = await stripe.prices.create({
        unit_amount: unitAmount,
        currency: "usd",
        recurring: { interval: isAnnual ? "year" : "month" },
        product_data: {
          name: `ShortStack OS — ${tierKey} Plan (${isAnnual ? "Annual" : "Monthly"})`,
          metadata: { plan_tier: tierKey },
        },
      });
      priceId = price.id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        user_id: user.id,
        plan_tier: tierKey,
        type: "agency_subscription",
      },
      success_url: `${baseUrl}/dashboard?subscribed=${tierKey.toLowerCase()}`,
      cancel_url: `${baseUrl}/pricing?cancelled=true`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ checkout_url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json({ error: "Failed to create checkout session. Please try again." }, { status: 500 });
  }
}
