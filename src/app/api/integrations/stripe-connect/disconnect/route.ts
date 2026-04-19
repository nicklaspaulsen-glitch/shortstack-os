/**
 * Stripe Connect disconnect — deletes the agency_stripe_accounts row AND all
 * associated client invoice + payment link records, so the UI goes back to
 * "Connect your Stripe" state.
 *
 * Does NOT delete the underlying Stripe account — Stripe doesn't allow
 * programmatic deletion of connected accounts with prior payment history.
 * The agency has to visit dashboard.stripe.com to close the account there.
 */

import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function DELETE() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("agency_stripe_accounts")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    console.error("[stripe-connect/disconnect] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message:
      "Disconnected from Trinity. To fully close your Stripe account, visit dashboard.stripe.com.",
  });
}
