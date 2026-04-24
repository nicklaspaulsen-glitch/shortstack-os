/**
 * Admin-only: recent referral payout runs.
 *
 * GET → { runs: Array<PayoutRun> } — last 20 rows from payout_runs,
 *        newest first. Used by the Payouts tab on /dashboard/referrals.
 *
 * Auth: signed-in + profile.role === 'admin'. The payout_runs RLS policy
 * already enforces admin-only reads, but we gate here too so non-admin
 * callers get a proper 403 instead of an empty array.
 */

import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const sb = createServerSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: me } = await sb
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (me?.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const svc = createServiceClient();
  const { data, error } = await svc
    .from("payout_runs")
    .select(
      "id, started_at, finished_at, triggered_by, payouts_total, payouts_paid, payouts_failed, payouts_skipped, amount_cents, error_text, notes",
    )
    .order("started_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ runs: data ?? [] });
}
