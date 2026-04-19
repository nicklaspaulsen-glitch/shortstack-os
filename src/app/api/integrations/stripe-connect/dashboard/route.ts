/**
 * Stripe Express dashboard login link — lets the agency jump into their
 * connected account's Stripe dashboard to view balances, payouts, disputes,
 * etc. Works ONLY for Express accounts (stripe.accounts.createLoginLink).
 *
 * Returns: { url: string }
 *
 * For Standard accounts, the agency already has full access to dashboard.stripe.com
 * with their own login, so we return a generic dashboard URL instead.
 */

import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

export async function POST() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: account } = await supabase
    .from("agency_stripe_accounts")
    .select("stripe_account_id, account_type")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!account?.stripe_account_id) {
    return NextResponse.json(
      { error: "No connected Stripe account" },
      { status: 404 },
    );
  }

  try {
    if (account.account_type === "standard") {
      return NextResponse.json({
        url: "https://dashboard.stripe.com/",
      });
    }

    // Express accounts — generate a short-lived login link.
    const link = await stripe.accounts.createLoginLink(account.stripe_account_id);
    return NextResponse.json({ url: link.url });
  } catch (err) {
    console.error("[stripe-connect/dashboard] error:", err);
    const message = err instanceof Error ? err.message : "Failed to create login link";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
