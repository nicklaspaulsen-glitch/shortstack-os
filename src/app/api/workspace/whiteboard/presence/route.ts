import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface PresenceBody {
  surface?: string;
  context?: Record<string, unknown>;
}

/**
 * Resolve the agency_owner_id for the calling user.
 * - admins / founders / agency / client: profile.id (they own themselves)
 * - team_member: parent_agency_id (the agency they belong to)
 *
 * Returns null if the profile row is missing — callers should 401 in that
 * case rather than insert a presence row with a bogus owner.
 */
async function resolveAgencyOwnerId(
  supabase: ReturnType<typeof createServerSupabase>,
  userId: string,
): Promise<string | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, parent_agency_id")
    .eq("id", userId)
    .single();
  if (!profile) return null;
  if (profile.role === "team_member" && profile.parent_agency_id) {
    return profile.parent_agency_id as string;
  }
  return profile.id as string;
}

/**
 * POST /api/workspace/whiteboard/presence
 * Heartbeat — upserts (profile_id, surface) and refreshes last_seen_at.
 * Frontend pings every ~30s while the page is visible.
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PresenceBody;
  try {
    body = (await req.json()) as PresenceBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const surface = (body.surface || "").trim();
  if (!surface) {
    return NextResponse.json({ error: "surface required" }, { status: 400 });
  }
  if (surface.length > 120) {
    return NextResponse.json({ error: "surface too long" }, { status: 400 });
  }
  const context = body.context && typeof body.context === "object" ? body.context : {};

  const agencyOwnerId = await resolveAgencyOwnerId(supabase, auth.user.id);
  if (!agencyOwnerId) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("workspace_presence")
    .upsert(
      {
        profile_id: auth.user.id,
        agency_owner_id: agencyOwnerId,
        surface,
        context,
        last_seen_at: now,
      },
      { onConflict: "profile_id,surface" },
    );

  if (error) {
    // eslint-disable-next-line no-console
    console.warn("[workspace/presence] upsert failed", error.message);
    return NextResponse.json({ error: "presence write failed" }, { status: 500 });
  }
  return NextResponse.json({ success: true, last_seen_at: now });
}

/**
 * DELETE /api/workspace/whiteboard/presence?surface=whiteboard
 * Explicit "I'm leaving" signal — fired via navigator.sendBeacon on
 * tab-close / visibilitychange so other viewers see you drop out
 * without waiting for the 5-minute prune cron.
 */
export async function DELETE(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const surface = (url.searchParams.get("surface") || "").trim();
  if (!surface) {
    return NextResponse.json({ error: "surface required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("workspace_presence")
    .delete()
    .eq("profile_id", auth.user.id)
    .eq("surface", surface);

  if (error) {
    // eslint-disable-next-line no-console
    console.warn("[workspace/presence] delete failed", error.message);
    return NextResponse.json({ error: "presence delete failed" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
