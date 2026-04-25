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

  // Defense in depth: scope to the agency owner. team_members get resolved
  // to their parent_agency_id (matches conversations table owner key).
  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;
  const { error, count } = await supabase
    .from("conversations")
    .update({ status }, { count: "exact" })
    .eq("id", params.id)
    .eq("user_id", ownerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!count) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
