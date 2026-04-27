/**
 * Single affiliate — detail data + status update.
 *
 * GET: returns the affiliate row, recent referrals, recent commissions, and
 *      summary stats for the per-affiliate dashboard page.
 * PATCH: update status (approve, suspend, reject) and/or stripe_account_id.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

const ALLOWED_STATUS = new Set(["pending", "approved", "suspended", "rejected"]);

async function ownsAffiliate(
  supabase: ReturnType<typeof createServerSupabase>,
  ownerId: string,
  affiliateId: string,
): Promise<{ id: string; program_id: string; user_id: string | null; email: string; name: string; ref_code: string; stripe_account_id: string | null; status: string; total_earned_cents: number; pending_cents: number; paid_cents: number; joined_at: string; approved_at: string | null } | null> {
  const { data } = await supabase
    .from("affiliates")
    .select(`
      id, program_id, user_id, email, name, ref_code, stripe_account_id,
      status, total_earned_cents, pending_cents, paid_cents, joined_at, approved_at,
      affiliate_programs!inner ( user_id )
    `)
    .eq("id", affiliateId)
    .eq("affiliate_programs.user_id", ownerId)
    .maybeSingle();
  if (!data) return null;
  // Strip the joined relation before returning.
  const { affiliate_programs: _ap, ...row } = data as typeof data & { affiliate_programs: unknown };
  void _ap;
  return row;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const affiliate = await ownsAffiliate(supabase, ownerId, params.id);
  if (!affiliate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Recent referrals — last 50.
  const { data: referrals } = await supabase
    .from("affiliate_referrals")
    .select("id, referred_email, status, click_id, source, conversion_at, created_at")
    .eq("affiliate_id", affiliate.id)
    .order("created_at", { ascending: false })
    .limit(50);

  // Recent commissions — last 50.
  const { data: commissions } = await supabase
    .from("affiliate_commissions")
    .select("id, referral_id, amount_cents, currency, status, stripe_transfer_id, paid_at, created_at")
    .eq("affiliate_id", affiliate.id)
    .order("created_at", { ascending: false })
    .limit(50);

  // Summary stats — re-derive from referrals + commissions for accuracy
  // even though the affiliates row caches totals (useful for sanity check).
  const allReferrals = referrals ?? [];
  const totalClicks = allReferrals.length;
  const subscribed = allReferrals.filter((r) => r.status === "subscribed").length;
  const conversionRate = totalClicks > 0 ? subscribed / totalClicks : 0;

  return NextResponse.json({
    affiliate,
    referrals: referrals ?? [],
    commissions: commissions ?? [],
    stats: {
      total_referrals: totalClicks,
      subscribed,
      conversion_rate: conversionRate,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await ownsAffiliate(supabase, ownerId, params.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.status === "string") {
    if (!ALLOWED_STATUS.has(body.status)) {
      return NextResponse.json({ error: "status must be pending|approved|suspended|rejected" }, { status: 400 });
    }
    updates.status = body.status;
    if (body.status === "approved" && !existing.approved_at) {
      updates.approved_at = new Date().toISOString();
    }
  }
  if (typeof body.stripe_account_id === "string" || body.stripe_account_id === null) {
    updates.stripe_account_id = body.stripe_account_id;
  }
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("affiliates")
    .update(updates)
    .eq("id", params.id)
    .select("id, program_id, user_id, email, name, ref_code, stripe_account_id, status, total_earned_cents, pending_cents, paid_cents, joined_at, approved_at")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to update" }, { status: 500 });
  }
  return NextResponse.json({ affiliate: data });
}
