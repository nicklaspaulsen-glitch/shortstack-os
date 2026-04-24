import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { resolveOrgId } from "@/lib/chat/server-helpers";

export const maxDuration = 10;

/**
 * POST /api/chat/seed-defaults
 * Creates (idempotently) the default org channels: #general, #wins, #questions.
 * Adds the caller (and all existing team members of the org) as members.
 */
export async function POST() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await resolveOrgId(supabase, user.id);
  const service = createServiceClient();

  const defaults: Array<{ name: string; description: string }> = [
    { name: "general", description: "Everyone. Anything goes." },
    { name: "wins", description: "Celebrate closed deals, shipped features, happy clients." },
    { name: "questions", description: "Ask anything — no question is too small." },
  ];

  // Gather org members (owner + team_members with active status)
  const memberIds = new Set<string>([orgId, user.id]);
  const { data: tm } = await service
    .from("team_members")
    .select("member_profile_id")
    .eq("agency_owner_id", orgId)
    .eq("status", "active");
  for (const r of tm || []) {
    const mid = (r as { member_profile_id: string | null }).member_profile_id;
    if (mid) memberIds.add(mid);
  }

  const created: Array<{ name: string; id: string; existed: boolean }> = [];

  for (const d of defaults) {
    const { data: existing } = await service
      .from("channels")
      .select("id")
      .eq("org_id", orgId)
      .eq("name", d.name)
      .eq("channel_type", "public")
      .maybeSingle();

    let channelId: string;
    let existed = false;
    if (existing) {
      channelId = existing.id as string;
      existed = true;
    } else {
      const { data: ins, error } = await service
        .from("channels")
        .insert({
          org_id: orgId,
          name: d.name,
          description: d.description,
          channel_type: "public",
          created_by: user.id,
        })
        .select("id")
        .single();
      if (error || !ins) continue;
      channelId = ins.id as string;
    }

    // Add members (idempotent)
    const rows = Array.from(memberIds).map((uid) => ({ channel_id: channelId, user_id: uid }));
    await service
      .from("channel_members")
      .upsert(rows, { onConflict: "channel_id,user_id", ignoreDuplicates: true });

    created.push({ name: d.name, id: channelId, existed });
  }

  return NextResponse.json({ channels: created });
}
