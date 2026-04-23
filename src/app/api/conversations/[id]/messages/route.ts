import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// GET /api/conversations/:id/messages — all messages in a conversation thread.
// RLS ensures the caller owns the parent conversation.
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // RLS on conversation_messages checks the parent; double-check anyway so
  // we return 404 rather than an empty list when the id is wrong.
  const { data: conv, error: convErr } = await supabase
    .from("conversations")
    .select("id, channel, external_thread_id, subject, status, contact_id, assigned_to_user_id, tags")
    .eq("id", params.id)
    .maybeSingle();

  if (convErr || !conv) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const { data: messages, error } = await supabase
    .from("conversation_messages")
    .select("id, direction, from_identifier, to_identifier, body, attachments, sent_at, read_at, external_message_id, created_at")
    .eq("conversation_id", params.id)
    .order("sent_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let contact = null;
  if (conv.contact_id) {
    const { data } = await supabase
      .from("clients")
      .select("id, business_name, contact_name, email, phone, industry, mrr, notes")
      .eq("id", conv.contact_id)
      .maybeSingle();
    contact = data;
  }

  return NextResponse.json({
    conversation: { ...conv, contact },
    messages: messages ?? [],
  });
}
