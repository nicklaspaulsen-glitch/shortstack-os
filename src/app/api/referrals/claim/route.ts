import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server";
import { normalizeReferralCode } from "@/lib/referral-code";

/**
 * POST /api/referrals/claim
 *
 * Called by the login page IMMEDIATELY after a successful sign-up, while
 * the `ss_ref` cookie is still present. Looks up the referral code,
 * resolves it to a referrer user_id, and sets `profiles.referred_by_user_id`
 * on the caller's own row. Idempotent: if the caller already has a referrer,
 * we leave it alone (first-touch attribution wins).
 *
 * Self-referrals are rejected — no juicing your own leaderboard rank.
 */
export async function POST(req: Request) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Code source priority: explicit body > cookie. Body wins so client code
  // that reads the cookie client-side and forwards the value still works.
  const body = (await req.json().catch(() => ({}))) as { code?: string };
  const cookieStore = cookies();
  const rawCode = body.code ?? cookieStore.get("ss_ref")?.value ?? null;
  const code = normalizeReferralCode(rawCode);
  if (!code) {
    return NextResponse.json({ ok: true, attributed: false, reason: "no_code" });
  }

  // Already attributed? No-op.
  const { data: me } = await supabase
    .from("profiles")
    .select("referred_by_user_id")
    .eq("id", user.id)
    .single();
  if (me?.referred_by_user_id) {
    return NextResponse.json({ ok: true, attributed: false, reason: "already_attributed" });
  }

  // Look up referrer by code
  const { data: referrer } = await supabase
    .from("profiles")
    .select("id")
    .eq("referral_code", code)
    .maybeSingle();
  if (!referrer) {
    return NextResponse.json({ ok: true, attributed: false, reason: "invalid_code" });
  }

  if (referrer.id === user.id) {
    return NextResponse.json({ ok: true, attributed: false, reason: "self_referral" });
  }

  const { error: updErr } = await supabase
    .from("profiles")
    .update({ referred_by_user_id: referrer.id })
    .eq("id", user.id);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, attributed: true });
}
