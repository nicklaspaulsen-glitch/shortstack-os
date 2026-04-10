import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// POST — add a note to a lead
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { lead_id, note } = await request.json();
  if (!lead_id || !note) return NextResponse.json({ error: "lead_id and note required" }, { status: 400 });

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

  const leadId = request.nextUrl.searchParams.get("lead_id");
  if (!leadId) return NextResponse.json({ error: "lead_id required" }, { status: 400 });

  const { data } = await supabase
    .from("outreach_log")
    .select("*")
    .eq("lead_id", leadId)
    .eq("platform", "note")
    .order("sent_at", { ascending: false });

  return NextResponse.json({ notes: data || [] });
}
