import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// Verify caller owns the lead before reading/writing notes.
async function leadIsOwned(
  supabase: ReturnType<typeof createServerSupabase>,
  leadId: string,
  ownerId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("leads")
    .select("user_id")
    .eq("id", leadId)
    .single();
  return data?.user_id === ownerId;
}

// POST — add a note to a lead
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { lead_id, note } = await request.json();
  if (!lead_id || !note) return NextResponse.json({ error: "lead_id and note required" }, { status: 400 });

  // Only allow notes on leads the caller owns — prevents cross-tenant note write.
  if (!(await leadIsOwned(supabase, lead_id, ownerId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Add note to outreach_log as a "note" type entry
  const { error } = await supabase.from("outreach_log").insert({
    lead_id,
    platform: "note",
    message_text: note,
    status: "note",
    metadata: { type: "internal_note", author: user.id },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

// GET — get notes for a lead
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const leadId = request.nextUrl.searchParams.get("lead_id");
  if (!leadId) return NextResponse.json({ error: "lead_id required" }, { status: 400 });

  // Only return notes for leads the caller owns — prevents cross-tenant note leak.
  if (!(await leadIsOwned(supabase, leadId, ownerId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data } = await supabase
    .from("outreach_log")
    .select("*")
    .eq("lead_id", leadId)
    .eq("platform", "note")
    .order("sent_at", { ascending: false });

  return NextResponse.json({ notes: data || [] });
}
