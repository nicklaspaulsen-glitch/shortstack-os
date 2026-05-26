/**
 * POST /api/integrations/news-triggers/[id]/acknowledge
 *
 * Marks a news-trigger row as seen by stamping `acknowledged_at`. Idempotent —
 * re-acknowledging refreshes the timestamp. Owner-scoped via RLS.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
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

  const id = params.id;
  if (!id || id.length < 8) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("news_triggers")
    .update({ acknowledged_at: new Date().toISOString() })
    .eq("id", id)
    .eq("agency_owner_id", ownerId)
    .select("id, acknowledged_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, acknowledged_at: data.acknowledged_at });
}
