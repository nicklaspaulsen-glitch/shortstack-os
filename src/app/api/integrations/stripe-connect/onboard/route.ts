/**
 * Stripe Connect onboarding — creates an Express connected account for the
 * authed agency and returns a Stripe-hosted onboarding URL. The agency clicks
 * the URL, fills out the Stripe onboarding (KYC, bank info, etc.), and is
 * redirected back to /api/integrations/stripe-connect/callback.
 *
 * This is DISTINCT from Trinity's platform Stripe (STRIPE_SECRET_KEY) which
 * bills the agency for their SaaS subscription. Connect accounts let agencies
 * charge THEIR clients on their OWN Stripe.
 *
 * Required env:
 *   STRIPE_SECRET_KEY — Trinity platform key (same one we already use)
 *   NEXT_PUBLIC_APP_URL — base URL for the return/refresh links
 *
 * Returns: { url: string, account_id: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    new URL(request.url).origin ||
    "https://app.shortstack.work";

  try {
    const stripe = getStripe();
    // If the user already has a connected account, re-generate the onboarding
    // link for it instead of creating a new one (prevents orphaned accounts).
    const { data: existing } = await supabase
      .from("agency_stripe_accounts")
      .select("stripe_account_id, details_submitted")
      .eq("user_id", user.id)
      .maybeSingle();

    let accountId: string;

    if (existing?.stripe_account_id) {
      accountId = existing.stripe_account_id;
    } else {
      // Fetch profile for nicer account setup
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .single();

      const account = await stripe.accounts.create({
        type: "express",
        email: user.email || profile?.email || undefined,
        metadata: {
          shortstack_user_id: user.id,
          purpose: "agency_client_billing",
        },
        business_profile: profile?.full_name
          ? { name: profile.full_name }
          : undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      accountId = account.id;

      // Insert a stub row now so we can detect in-progress onboarding even if
      // the user bails out before the callback. The callback will fill in
      // charges_enabled/payouts_enabled/country from stripe.accounts.retrieve().
      await supabase.from("agency_stripe_accounts").upsert(
        {
          user_id: user.id,
          stripe_account_id: accountId,
          account_type: "express",
          charges_enabled: false,
          payouts_enabled: false,
          details_submitted: false,
        },
        { onConflict: "user_id" },
      );
    }

    // Generate a fresh onboarding link. These URLs are single-use & short
    // lived, so always regenerate rather than caching.
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/api/integrations/stripe-connect/onboard?retry=1`,
      return_url: `${baseUrl}/api/integrations/stripe-connect/callback?account_id=${accountId}`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url, account_id: accountId });
  } catch (err) {
    console.error("[stripe-connect/onboard] error:", err);
    const message = err instanceof Error ? err.message : "Failed to create onboarding link";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Stripe redirects here with ?retry=1 if the user needs to re-open the link.
// Easiest fix: forward them to the POST flow via a tiny client redirect.
export async function GET(request: NextRequest) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    new URL(request.url).origin ||
    "https://app.shortstack.work";
  // Redirect back to the settings page — the UI there will offer to re-initiate onboarding.
  return NextResponse.redirect(
    `${baseUrl}/dashboard/settings?stripe_connect=retry`,
  );
}
