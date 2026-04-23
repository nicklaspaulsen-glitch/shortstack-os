import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

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

  const { error: convErr } = await supabase
    .from("conversations")
    .update({ unread_count: 0 })
    .eq("id", params.id);

  if (convErr) return NextResponse.json({ error: convErr.message }, { status: 500 });

  // Mark inbound messages read. Outbound messages don't track read state.
  await supabase
    .from("conversation_messages")
    .update({ read_at: nowIso })
    .eq("conversation_id", params.id)
    .eq("direction", "inbound")
    .is("read_at", null);

  return NextResponse.json({ ok: true });
}
