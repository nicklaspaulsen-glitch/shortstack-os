import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

const ALLOWED = new Set(["open", "snoozed", "closed", "archived"]);

// POST /api/conversations/:id/status
// Body: { status: "open"|"snoozed"|"closed"|"archived" }
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { status } = await request.json();
  if (typeof status !== "string" || !ALLOWED.has(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // Security: explicitly verify the caller's tenant owns this conversation
  // before mutating it. Returns 404 (not 403) on mismatch to avoid leaking
  // conversation existence — mirrors the pattern in send/route.ts (e39e9fd).
  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

  const { data: conv } = await supabase
    .from("conversations")
    .select("id, user_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  if (conv.user_id !== ownerId) {
    console.error(`[conversations/status] access denied: conv.user_id=${conv.user_id} ownerId=${ownerId}`);
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("conversations")
    .update({ status })
    .eq("id", params.id)
    .eq("user_id", ownerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
