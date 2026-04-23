import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { generateReferralCode } from "@/lib/referral-code";

/**
 * POST /api/referrals/generate-code
 *
 * Force-regenerate the caller's referral code. Useful if a user shared
 * their code in a place they regret (e.g. a public post that attracted
 * bots). Invalidates the old code immediately — any bookmarked links
 * pointing to `?ref=OLDCODE` will no longer attribute back to this user.
 *
 * Rate limit is intentionally loose; the code is user-facing, not a
 * security token. A misbehaving caller can only mint codes for their
 * own account.
 */
export async function POST() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateReferralCode();
    const { error } = await supabase
      .from("profiles")
      .update({ referral_code: candidate })
      .eq("id", user.id);
    if (!error) {
      return NextResponse.json({ referral_code: candidate });
    }
    if (!/duplicate|unique/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json(
    { error: "Could not allocate code after 5 tries — retry in a moment" },
    { status: 500 },
  );
}
