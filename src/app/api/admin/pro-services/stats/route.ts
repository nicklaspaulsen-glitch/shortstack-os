import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/admin/pro-services/stats
 *
 * Admin-only platform stats for the Pro Services curation dashboard.
 * Numbers are aggregates over the whole table — cheap enough for v1.
 */
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
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { data: providers } = await supabase
    .from("pro_services_providers")
    .select("id, vetted, subscription_status");
  const { data: requests } = await supabase
    .from("pro_services_requests")
    .select("id, status, created_at");
  const { data: referrals } = await supabase
    .from("pro_services_referrals")
    .select("referral_cents, paid_at");

  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const requestsLast30 = (requests ?? []).filter((r) => r.created_at > monthAgo).length;
  const totalProviders = providers?.length ?? 0;
  const vettedProviders = (providers ?? []).filter((p) => p.vetted).length;
  const activeSubs = (providers ?? []).filter((p) => p.subscription_status === "active").length;
  const completedRequests = (requests ?? []).filter((r) => r.status === "completed").length;
  const totalReferralCents = (referrals ?? []).reduce(
    (sum, r) => sum + (r.referral_cents ?? 0),
    0,
  );
  const paidReferralCents = (referrals ?? [])
    .filter((r) => r.paid_at)
    .reduce((sum, r) => sum + (r.referral_cents ?? 0), 0);

  return NextResponse.json({
    total_providers: totalProviders,
    vetted_providers: vettedProviders,
    pending_vetting: totalProviders - vettedProviders,
    active_subscriptions: activeSubs,
    requests_last_30d: requestsLast30,
    total_requests: requests?.length ?? 0,
    completed_requests: completedRequests,
    total_referral_cents: totalReferralCents,
    paid_referral_cents: paidReferralCents,
  });
}
