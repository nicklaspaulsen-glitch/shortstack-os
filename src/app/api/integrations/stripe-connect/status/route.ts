/**
 * Stripe Connect status — returns whether the authed agency has a connected
 * Stripe account and the relevant capability flags (charges_enabled,
 * payouts_enabled, details_submitted). The UI uses this to decide whether to
 * show the "Connect your Stripe" CTA or the connected state.
 *
 * Returns:
 *   { connected: false }
 *     — no row in agency_stripe_accounts
 *   { connected: true, account: { ... } }
 *     — row exists; account fields surface the flags
 */

import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: account } = await supabase
    .from("agency_stripe_accounts")
    .select(
      "stripe_account_id, account_type, charges_enabled, payouts_enabled, details_submitted, country, default_currency, business_name, connected_at",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (!account) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    account: {
      stripe_account_id: account.stripe_account_id,
      account_type: account.account_type,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      country: account.country,
      default_currency: account.default_currency,
      business_name: account.business_name,
      connected_at: account.connected_at,
      fully_onboarded:
        !!account.charges_enabled &&
        !!account.payouts_enabled &&
        !!account.details_submitted,
    },
  });
}
