import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 10;

/**
 * GET /api/chat/mentions
 * Returns unread @mentions (messages that list the caller in `mentions[]`
 * and are newer than their channel's last_read_at).
 */
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  const { data: memberships } = await service
    .from("channel_members")
    .select("channel_id, last_read_at")
    .eq("user_id", user.id);

  if (!memberships || memberships.length === 0) {
    return NextResponse.json({ mentions: [] });
  }

  const mentionRows: Array<{
    message_id: string;
    channel_id: string;
    channel_name: string;
    sender_id: string;
    content: string;
    created_at: string;
  }> = [];

  // Fetch per-channel to honor each membership's last_read_at
  for (const m of memberships) {
    const cid = m.channel_id as string;
    const since = m.last_read_at as string;
    const { data: msgs } = await service
      .from("messages")
      .select("id, channel_id, sender_id, content, created_at")
      .eq("channel_id", cid)
      .contains("mentions", [user.id])
      .is("deleted_at", null)
      .gt("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!msgs || msgs.length === 0) continue;

    const { data: chan } = await service
      .from("channels")
      .select("name")
      .eq("id", cid)
      .maybeSingle();

    const channelName = (chan?.name as string) || "";
    for (const row of msgs) {
      mentionRows.push({
        message_id: row.id as string,
        channel_id: row.channel_id as string,
        channel_name: channelName,
        sender_id: row.sender_id as string,
        content: row.content as string,
        created_at: row.created_at as string,
      });
    }
  }

  mentionRows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return NextResponse.json({ mentions: mentionRows.slice(0, 100) });
}
