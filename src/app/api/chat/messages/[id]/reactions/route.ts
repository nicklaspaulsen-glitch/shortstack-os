import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 10;

type Ctx = { params: { id: string } };

/**
 * POST /api/chat/messages/:id/reactions
 * Body: { emoji: string }
 * Toggles a reaction for the current user on the given message.
 * Returns { added: true | false } describing the final state.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const messageId = params.id;
  let body: { emoji?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const emoji = typeof body.emoji === "string" ? body.emoji : "";
  if (!emoji) return NextResponse.json({ error: "emoji required" }, { status: 400 });

  const service = createServiceClient();

  // Caller must be a member of the message's channel
  const { data: msg } = await service
    .from("messages")
    .select("channel_id")
    .eq("id", messageId)
    .maybeSingle();
  if (!msg) return NextResponse.json({ error: "Message not found" }, { status: 404 });

  const { data: membership } = await service
    .from("channel_members")
    .select("user_id")
    .eq("channel_id", msg.channel_id as string)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Toggle: if row exists → delete; else insert
  const { data: existing } = await service
    .from("message_reactions")
    .select("emoji")
    .eq("message_id", messageId)
    .eq("user_id", user.id)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    const { error } = await service
      .from("message_reactions")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", user.id)
      .eq("emoji", emoji);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ added: false });
  }

  const { error } = await service.from("message_reactions").insert({
    message_id: messageId,
    user_id: user.id,
    emoji,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ added: true });
}
