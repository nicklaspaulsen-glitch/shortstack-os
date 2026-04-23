import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { generateReferralCode } from "@/lib/referral-code";
import { PLAN_TIERS, type PlanTier, isValidPlanTier } from "@/lib/plan-config";
import { getCommissionRate } from "@/lib/referral-commission";

/**
 * GET /api/referrals/me (routed here via /api/referrals)
 *
 * Returns the signed-in user's referral code + summary stats. The code is
 * lazily generated on first visit if the profile doesn't have one yet —
 * this is the main path because we don't want to backfill every existing
 * row up-front.
 */
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Load current profile
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("referral_code, plan_tier")
    .eq("id", user.id)
    .single();
  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  let referralCode: string | null = profile?.referral_code ?? null;

  // Lazy-generate on first visit. Retry up to 5 times in the (very rare)
  // event of a unique-index collision.
  if (!referralCode) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateReferralCode();
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ referral_code: candidate })
        .eq("id", user.id);
      if (!updErr) {
        referralCode = candidate;
        break;
      }
      // If it's a unique-violation, loop and try another code.
      if (!/duplicate|unique/i.test(updErr.message)) {
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }
    }
    if (!referralCode) {
      return NextResponse.json(
        { error: "Could not allocate referral code after 5 tries" },
        { status: 500 },
      );
    }
  }

  // Referred users (for totals — full list is at /api/referrals/list)
  const { data: referees } = await supabase
    .from("profiles")
    .select("id, plan_tier, subscription_status")
    .eq("referred_by_user_id", user.id);

  const totalReferrals = referees?.length ?? 0;
  const activeSubs = (referees ?? []).filter(
    r => r.subscription_status === "active" || r.subscription_status === "trialing",
  ).length;

  // Earnings — sum of paid_at IS NOT NULL rows
  const { data: payouts } = await supabase
    .from("referral_payouts")
    .select("amount_cents, paid_at, month_start")
    .eq("referrer_user_id", user.id);

  const totalEarnedCents = (payouts ?? [])
    .filter(p => p.paid_at)
    .reduce((sum, p) => sum + (p.amount_cents ?? 0), 0);

  const pendingPayoutCents = (payouts ?? [])
    .filter(p => !p.paid_at)
    .reduce((sum, p) => sum + (p.amount_cents ?? 0), 0);

  // This-month earnings (paid OR pending, from the current calendar month)
  const now = new Date();
  const monthStartISO = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const thisMonthCents = (payouts ?? [])
    .filter(p => p.month_start === monthStartISO)
    .reduce((sum, p) => sum + (p.amount_cents ?? 0), 0);

  // Projected monthly recurring earnings from active subs — useful for the
  // "what's this worth to me" feel-good number.
  const projectedMonthlyCents = (referees ?? [])
    .filter(r => r.subscription_status === "active" || r.subscription_status === "trialing")
    .reduce((sum, r) => {
      const tier = (r.plan_tier && isValidPlanTier(r.plan_tier) ? r.plan_tier : "Starter") as PlanTier;
      const price = PLAN_TIERS[tier]?.price_monthly ?? 0;
      return sum + Math.round(price * 100 * getCommissionRate(tier));
    }, 0);

  return NextResponse.json({
    referral_code: referralCode,
    share_url: `https://shortstack.work/login?ref=${referralCode}`,
    stats: {
      total_referrals: totalReferrals,
      active_subs: activeSubs,
      total_earned_cents: totalEarnedCents,
      pending_payout_cents: pendingPayoutCents,
      this_month_cents: thisMonthCents,
      projected_monthly_cents: projectedMonthlyCents,
    },
  });
}
