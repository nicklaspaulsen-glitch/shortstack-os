import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import {
  getCurrentUsage,
  limitsForTier,
  normalizePlanTier,
  type UsageResource,
} from "@/lib/usage-limits";

/**
 * GET /api/usage/current
 * Returns the caller's current-month usage vs their plan-tier limits.
 * Used by the dashboard usage widget. Scope: effective agency owner.
 */
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", ownerId)
    .maybeSingle();
  const planTier = normalizePlanTier(profile?.plan_tier as string | null | undefined);
  const limits = limitsForTier(planTier);

  const usageRaw = await getCurrentUsage(ownerId);
  const resources: UsageResource[] = ["emails", "tokens", "clients", "sms", "call_minutes"];

  const usage: Record<string, number> = {};
  const limitsOut: Record<string, number | "unlimited"> = {};
  const remaining: Record<string, number | "unlimited"> = {};

  for (const r of resources) {
    const u = usageRaw[r];
    const l = limits[r];
    usage[r] = u;
    if (!Number.isFinite(l)) {
      limitsOut[r] = "unlimited";
      remaining[r] = "unlimited";
    } else {
      limitsOut[r] = l;
      remaining[r] = Math.max(0, l - u);
    }
  }

  return NextResponse.json({
    plan_tier: planTier,
    usage,
    limits: limitsOut,
    remaining,
    notes: usageRaw.notes ?? [],
  });
}
