/**
 * Preview the next N round-robin assignments for a booking team — dry-run
 * (does not persist any state). Used by the team builder UI.
 *
 * GET /api/calendar/teams/preview?team_id=<id>&count=5
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { previewAssignments } from "@/lib/calendar/round-robin";

export async function GET(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const teamId = req.nextUrl.searchParams.get("team_id");
  const count = Math.min(Math.max(Number(req.nextUrl.searchParams.get("count")) || 5, 1), 25);
  if (!teamId) return NextResponse.json({ error: "team_id required" }, { status: 400 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;
  const service = createServiceClient();
  const { data: team } = await service
    .from("booking_teams")
    .select("id, owner_user_id")
    .eq("id", teamId)
    .maybeSingle();
  if (!team || team.owner_user_id !== ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const preview = await previewAssignments(service, teamId, count);
  return NextResponse.json({ preview });
}
