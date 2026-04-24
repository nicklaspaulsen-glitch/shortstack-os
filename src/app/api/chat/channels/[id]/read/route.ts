import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 10;

type Ctx = { params: { id: string } };

/**
 * POST /api/chat/channels/:id/read
 * Updates the caller's last_read_at on the channel to now().
 */
export async function POST(_req: Request, { params }: Ctx) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const channelId = params.id;
  const service = createServiceClient();

  const { error } = await service
    .from("channel_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("channel_id", channelId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
