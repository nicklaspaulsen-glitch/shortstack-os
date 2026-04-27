/**
 * GET /api/integrations/news-triggers
 *
 * Lists news-trigger hits for the caller's agency. Supports two filters:
 *   - lead_id: scope to a single lead
 *   - unacknowledged=true: only show triggers that haven't been seen yet
 *
 * Results are ordered newest-first, capped at 100.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Profile not found" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get("lead_id");
  const unacknowledged = searchParams.get("unacknowledged") === "true";
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(searchParams.get("limit") || "50", 10) || 50),
  );

  let query = supabase
    .from("news_triggers")
    .select(
      "id, lead_id, company, headline, url, published_at, source, trigger_type, summary, acknowledged_at, created_at",
    )
    .eq("agency_owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (leadId) query = query.eq("lead_id", leadId);
  if (unacknowledged) query = query.is("acknowledged_at", null);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ triggers: data ?? [] });
}
