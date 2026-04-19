/**
 * Admin-only: returns the Stripe Payment Links configured in env vars.
 *
 * Payment Links are hosted checkout URLs you can create in the Stripe
 * Dashboard and hand to clients directly (useful when you want to skip the
 * in-app flow — email the link, share in DMs, drop in a proposal, etc.).
 *
 * To expose a link here, create it in Stripe Dashboard → Payment Links, then
 * add its URL to Vercel as one of:
 *   STRIPE_PAYMENT_LINK_STARTER_MONTHLY
 *   STRIPE_PAYMENT_LINK_STARTER_ANNUAL
 *   STRIPE_PAYMENT_LINK_PRO_MONTHLY
 *   STRIPE_PAYMENT_LINK_PRO_ANNUAL
 *   STRIPE_PAYMENT_LINK_BUSINESS_MONTHLY
 *   STRIPE_PAYMENT_LINK_BUSINESS_ANNUAL
 *   STRIPE_PAYMENT_LINK_UNLIMITED_MONTHLY
 *   STRIPE_PAYMENT_LINK_UNLIMITED_ANNUAL
 *   STRIPE_PAYMENT_LINK_GROWTH_MONTHLY  (optional)
 *   STRIPE_PAYMENT_LINK_GROWTH_ANNUAL   (optional)
 *
 * Only admins can see them. They're just text strings — no Stripe API key
 * is used here.
 */

import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

const TIERS = ["starter", "growth", "pro", "business", "unlimited"] as const;
const CYCLES = ["monthly", "annual"] as const;

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const links: Array<{ tier: string; cycle: string; url: string | null; env_var: string }> = [];
  for (const tier of TIERS) {
    for (const cycle of CYCLES) {
      const envVar = `STRIPE_PAYMENT_LINK_${tier.toUpperCase()}_${cycle.toUpperCase()}`;
      links.push({
        tier,
        cycle,
        url: process.env[envVar] || null,
        env_var: envVar,
      });
    }
  }

  return NextResponse.json({ links });
}
