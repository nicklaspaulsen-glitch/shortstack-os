/**
 * Affiliate self-view — returns the affiliate row(s) the signed-in user
 * is associated with (matched on user_id) and their summary stats. Used by
 * the affiliate's own portal page at /portal/affiliate.
 *
 * Returns ALL affiliate rows in case the user is enrolled in multiple
 * programs across different ShortStack agency owners.
 */
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: affiliates, error } = await supabase
    .from("affiliates")
    .select(`
      id, program_id, email, name, ref_code, stripe_account_id, status,
      total_earned_cents, pending_cents, paid_cents, joined_at, approved_at,
      affiliate_programs ( id, name, description, commission_type, commission_value, cookie_days, payout_threshold_cents, payout_schedule, status )
    `)
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = affiliates ?? [];

  // Grab recent referrals + commissions across all the user's affiliate
  // memberships so the portal can render a single feed without N round-trips.
  const ids = rows.map((r) => r.id);
  let recentReferrals: unknown[] = [];
  let recentCommissions: unknown[] = [];
  if (ids.length > 0) {
    const [{ data: referrals }, { data: commissions }] = await Promise.all([
      supabase
        .from("affiliate_referrals")
        .select("id, affiliate_id, status, conversion_at, created_at, referred_email")
        .in("affiliate_id", ids)
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("affiliate_commissions")
        .select("id, affiliate_id, amount_cents, currency, status, paid_at, created_at")
        .in("affiliate_id", ids)
        .order("created_at", { ascending: false })
        .limit(25),
    ]);
    recentReferrals = referrals ?? [];
    recentCommissions = commissions ?? [];
  }

  return NextResponse.json({
    affiliates: rows,
    recent_referrals: recentReferrals,
    recent_commissions: recentCommissions,
  });
}
