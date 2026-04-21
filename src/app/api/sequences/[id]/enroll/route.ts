import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// Enroll leads in a sequence. Accepts { lead_ids: string[] } and creates
// one sequence_enrollments row per lead. Dedup is handled by the
// (sequence_id, lead_id) unique constraint — we use upsert ignoreDuplicates
// so re-posting the same lead is a no-op instead of a 409.

interface EnrollInput {
  lead_ids?: string[];
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Verify sequence ownership — 404 if caller doesn't own it
  const { data: seq } = await supabase
    .from("sequences")
    .select("id, is_active")
    .eq("id", params.id)
    .eq("profile_id", ownerId)
    .single();
  if (!seq) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: EnrollInput;
  try {
    body = (await request.json()) as EnrollInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const leadIds = Array.isArray(body.lead_ids)
    ? body.lead_ids.filter((x): x is string => typeof x === "string")
    : [];
  if (leadIds.length === 0) {
    return NextResponse.json({ error: "lead_ids must be a non-empty array" }, { status: 400 });
  }

  // Verify the leads belong to this owner (leads.user_id scoping). We only
  // accept leads the caller owns — silently drop anything else.
  const { data: ownedLeads } = await supabase
    .from("leads")
    .select("id")
    .eq("user_id", ownerId)
    .in("id", leadIds);
  const allowed = new Set((ownedLeads || []).map(l => l.id));
  const validLeads = leadIds.filter(id => allowed.has(id));

  if (validLeads.length === 0) {
    return NextResponse.json(
      { error: "No valid leads found for this owner" },
      { status: 400 },
    );
  }

  const rows = validLeads.map(lead_id => ({
    sequence_id: params.id,
    lead_id,
    status: "active",
    current_step: 0,
  }));

  const { data, error } = await supabase
    .from("sequence_enrollments")
    .upsert(rows, { onConflict: "sequence_id,lead_id", ignoreDuplicates: true })
    .select("id, lead_id, status, current_step, enrolled_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    enrolled: data?.length || 0,
    skipped: leadIds.length - validLeads.length,
    enrollments: data || [],
  });
}
