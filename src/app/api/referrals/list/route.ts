import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCommissionPct } from "@/lib/referral-commission";

/**
 * GET /api/referrals/list
 *
 * Lists users referred by the signed-in user. Payload is intentionally
 * narrow — email + name + plan + signup date + commission% — and excludes
 * anything that would leak PII outside what the referrer already knows
 * (they brought these people in).
 */
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, plan_tier, subscription_status, created_at")
    .eq("referred_by_user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []).map(r => ({
    id: r.id,
    email: r.email,
    full_name: r.full_name,
    plan_tier: r.plan_tier || "Starter",
    subscription_status: r.subscription_status || "inactive",
    signed_up_at: r.created_at,
    commission_pct: getCommissionPct(r.plan_tier),
  }));

  return NextResponse.json({ referrals: rows });
}
