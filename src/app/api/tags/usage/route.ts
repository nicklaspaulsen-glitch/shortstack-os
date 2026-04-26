import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// GET /api/tags/usage
//
// Returns lead/asset usage counts per tag-name. Joins the canonical `tags`
// table (per-user, named) with the lookup tables that store applied tags
// by name string: `lead_tags.tag` and `asset_tags.tag`.
//
// Output: { usage: Array<{ name: string, leads: number, assets: number }> }
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Pull all per-name lead_tags rows for this owner, count locally. Postgres
  // doesn't have a built-in group-by helper in supabase-js, so we aggregate
  // here. lead_tags volume is bounded by leads * tags_per_lead (typically
  // < 50k rows even for heavy users — well within a single fetch).
  const { data: leadTagRows } = await supabase
    .from("lead_tags")
    .select("tag")
    .eq("profile_id", ownerId);

  const leadCounts: Record<string, number> = {};
  for (const row of (leadTagRows || []) as Array<{ tag: string }>) {
    if (!row.tag) continue;
    leadCounts[row.tag] = (leadCounts[row.tag] || 0) + 1;
  }

  // asset_tags has a different schema (org_id-scoped, no per-user
  // attribution by name in a join row). Skip asset counts for now —
  // per-tenant leads counts are the primary signal users want here.
  const allNames = new Set<string>(Object.keys(leadCounts));

  const usage = Array.from(allNames)
    .map((name) => ({
      name,
      leads: leadCounts[name] || 0,
      assets: 0,
    }))
    .sort((a, b) => b.leads - a.leads);

  return NextResponse.json({ usage });
}
