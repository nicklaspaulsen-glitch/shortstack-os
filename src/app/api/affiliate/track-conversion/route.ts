/**
 * Track a signup conversion.
 *
 * Called from the signup flow once an account is created. The signup form
 * reads the `ssoa_ref` cookie (or falls back to a query param) and POSTs
 * here with the new user's profile id + the ref code.
 *
 * We attach an affiliate_referrals row in 'signed_up' state. The 'subscribed'
 * transition happens later via the Stripe checkout webhook.
 *
 * This endpoint is auth-aware — if the caller is signed in we trust the
 * provided user_id only when it matches the session user; otherwise we use
 * the session user. If unauthenticated, we accept the user_id at face value
 * (the signup flow runs with a fresh session that may not yet be available
 * to the cookie reader). Worst case: someone fakes a signup attribution
 * for their own ref code, which doesn't earn money until a real subscribe
 * event lands via Stripe.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { normalizeAffiliateRefCode } from "@/lib/affiliate";

export const dynamic = "force-dynamic";

interface ConversionInput {
  ref_code?: string;
  user_id?: string;
  email?: string;
}

export async function POST(request: NextRequest) {
  let body: ConversionInput;
  try {
    body = (await request.json()) as ConversionInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const refCode = normalizeAffiliateRefCode(body.ref_code);
  if (!refCode) return NextResponse.json({ error: "ref_code required" }, { status: 400 });

  // Resolve session user if available — used to lock down the user_id we trust.
  let trustedUserId: string | null = null;
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) trustedUserId = user.id;
  } catch {
    // ignore — proceed unauthenticated
  }

  const claimedUserId = body.user_id;
  const userIdForRow = trustedUserId
    ? trustedUserId
    : (claimedUserId && /^[0-9a-f-]{36}$/i.test(claimedUserId) ? claimedUserId : null);

  // Service-role for the insert because the visitor's JWT may not have RLS
  // permission to write to affiliate_referrals before the trigger runs.
  const service = createServiceClient();

  const { data: affiliate } = await service
    .from("affiliates")
    .select("id, status")
    .eq("ref_code", refCode)
    .maybeSingle();
  if (!affiliate || affiliate.status === "suspended" || affiliate.status === "rejected") {
    return NextResponse.json({ error: "Unknown or inactive ref code" }, { status: 404 });
  }

  // Look for an existing 'clicked' row in the past 30 days for the same ref
  // and bump it to 'signed_up' rather than creating a duplicate. If none
  // exists (cookie blocked, etc.), insert a fresh row.
  const thirtyDaysAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await service
    .from("affiliate_referrals")
    .select("id, status")
    .eq("affiliate_id", affiliate.id)
    .eq("status", "clicked")
    .gte("created_at", thirtyDaysAgoIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error: updErr } = await service
      .from("affiliate_referrals")
      .update({
        status: "signed_up",
        referred_user_id: userIdForRow,
        referred_email: body.email ?? null,
        conversion_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, referral_id: existing.id, mode: "updated" });
  }

  const { data: inserted, error: insErr } = await service
    .from("affiliate_referrals")
    .insert({
      affiliate_id: affiliate.id,
      referred_user_id: userIdForRow,
      referred_email: body.email ?? null,
      status: "signed_up",
      conversion_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (insErr || !inserted) {
    return NextResponse.json({ error: insErr?.message ?? "Failed to record" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, referral_id: inserted.id, mode: "inserted" });
}
