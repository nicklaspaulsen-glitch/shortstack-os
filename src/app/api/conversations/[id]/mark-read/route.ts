import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// POST /api/conversations/:id/mark-read
// Zeros unread_count on the conversation and timestamps every inbound message.
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const nowIso = new Date().toISOString();

  // Defense in depth: pre-verify the caller's tenant owns the conversation
  // BEFORE mutating either it or its messages. team_member users resolve
  // to their parent_agency_id so they can mark-read for the agency.
  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;
  const { data: conv } = await supabase
    .from("conversations")
    .select("user_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!conv || conv.user_id !== ownerId) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const { error: convErr } = await supabase
    .from("conversations")
    .update({ unread_count: 0 })
    .eq("id", params.id)
    .eq("user_id", ownerId);

  if (convErr) return NextResponse.json({ error: convErr.message }, { status: 500 });

  // Mark inbound messages read. Scope by conversation_id (the ownership
  // check above already verified the conversation belongs to ownerId).
  await supabase
    .from("conversation_messages")
    .update({ read_at: nowIso })
    .eq("conversation_id", params.id)
    .eq("direction", "inbound")
    .is("read_at", null);

  return NextResponse.json({ ok: true });
}
