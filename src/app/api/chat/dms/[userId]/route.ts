import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { dmChannelName } from "@/lib/chat/types";
import { resolveOrgId } from "@/lib/chat/server-helpers";

export const maxDuration = 10;

type Ctx = { params: { userId: string } };

/**
 * GET /api/chat/dms/:userId
 * Returns (creating if needed) a DM channel between the current user and
 * the target user. Both users are added as members.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const targetUserId = params.userId;
  if (!targetUserId || targetUserId === user.id) {
    return NextResponse.json({ error: "Invalid target user" }, { status: 400 });
  }

  const orgId = await resolveOrgId(supabase, user.id);
  const canonical = dmChannelName(user.id, targetUserId);
  const service = createServiceClient();

  // Look up existing DM channel by canonical name within the org
  const { data: existing } = await service
    .from("channels")
    .select("*")
    .eq("org_id", orgId)
    .eq("channel_type", "dm")
    .eq("name", canonical)
    .maybeSingle();

  if (existing) {
    // Ensure both members exist (idempotent)
    await service
      .from("channel_members")
      .upsert(
        [
          { channel_id: existing.id, user_id: user.id },
          { channel_id: existing.id, user_id: targetUserId },
        ],
        { onConflict: "channel_id,user_id", ignoreDuplicates: true },
      );
    return NextResponse.json({ channel: existing });
  }

  // Create channel + both members
  const { data: created, error } = await service
    .from("channels")
    .insert({
      org_id: orgId,
      name: canonical,
      description: null,
      channel_type: "dm",
      project_id: null,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (error || !created) {
    return NextResponse.json({ error: error?.message || "Failed to create DM" }, { status: 500 });
  }

  await service.from("channel_members").insert([
    { channel_id: created.id, user_id: user.id },
    { channel_id: created.id, user_id: targetUserId },
  ]);

  return NextResponse.json({ channel: created });
}
