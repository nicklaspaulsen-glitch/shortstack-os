/**
 * Stripe Connect return URL — Stripe redirects here after the agency completes
 * (or abandons) onboarding. We retrieve the full account status from Stripe,
 * upsert it into agency_stripe_accounts, and redirect to the settings UI.
 *
 * Note: Stripe's onboarding is async — details_submitted may be true while
 * charges_enabled is still false while Stripe reviews. The UI shows those
 * flags as independent status chips.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const accountId = params.get("account_id");

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    new URL(request.url).origin ||
    "https://shortstack-os.vercel.app";

  const redirectBack = (suffix: string) =>
    NextResponse.redirect(`${baseUrl}/dashboard/settings?${suffix}`);

  if (!accountId) return redirectBack("stripe_connect_error=missing_account");

  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirectBack("stripe_connect_error=unauthorized");

  try {
    const stripe = getStripe();
    const account = await stripe.accounts.retrieve(accountId);

    // Sanity check: the account we're upserting must have been created by
    // this user (via our metadata tag set in /onboard). Protects against a
    // crafted account_id query param.
    const meta = account.metadata || {};
    if (meta.shortstack_user_id && meta.shortstack_user_id !== user.id) {
      return redirectBack("stripe_connect_error=account_mismatch");
    }

    // Dashboard URL — for Express accounts, we generate a login link on demand.
    // We don't store a dashboard URL up-front; the /dashboard endpoint does it.
    const serviceSupabase = createServiceClient();
    await serviceSupabase.from("agency_stripe_accounts").upsert(
      {
        user_id: user.id,
        stripe_account_id: account.id,
        account_type: (account.type as "express" | "standard") || "express",
        charges_enabled: !!account.charges_enabled,
        payouts_enabled: !!account.payouts_enabled,
        details_submitted: !!account.details_submitted,
        country: account.country || null,
        default_currency: account.default_currency || null,
        business_name:
          account.business_profile?.name ||
          (account.settings?.dashboard?.display_name as string | undefined) ||
          null,
        dashboard_url: null,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    return redirectBack("stripe_connected=1");
  } catch (err) {
    console.error("[stripe-connect/callback] error:", err);
    const msg = err instanceof Error ? err.message.slice(0, 80) : "unknown";
    return redirectBack(`stripe_connect_error=${encodeURIComponent(msg)}`);
  }
}
