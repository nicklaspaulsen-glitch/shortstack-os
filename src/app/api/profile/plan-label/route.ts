import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/profile/plan-label
 *
 * Set or clear the custom plan-tier label shown in the topbar PlanBadge.
 * Lets a user replace "Starter" / "Growth" / "Founder" / etc. with any
 * label they want without changing their actual subscription tier. The
 * underlying `plan_tier` column is untouched — billing continues to work
 * off the canonical tier. Only the displayed text changes.
 *
 * Body: { label: string | null }   // null clears the override
 *
 * Response: { ok: true, label: string | null }
 *
 * Apr 28 — added in response to the user request: "make a custom name
 * for payment plan for example i have founder but make a custom one to
 * appear on which payment plan they have."
 */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { label?: string | null };
  const raw = body.label;
  // Accept up to 32 chars; trim aggressive whitespace; treat empty/null as "clear".
  const cleaned: string | null =
    typeof raw === "string" && raw.trim().length > 0 ? raw.trim().slice(0, 32) : null;

  // Read current onboarding_preferences so we don't clobber other keys.
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_preferences")
    .eq("id", user.id)
    .maybeSingle();
  const current = (profile?.onboarding_preferences as Record<string, unknown> | null) || {};
  const next = { ...current };
  if (cleaned === null) {
    delete next.custom_plan_label;
  } else {
    next.custom_plan_label = cleaned;
  }

  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_preferences: next })
    .eq("id", user.id);
  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, label: cleaned });
}
