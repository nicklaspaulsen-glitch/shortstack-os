import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// GET all enrollments for a sequence, joined with lead business_name / email
// so the dashboard can render a readable "who's enrolled + where are they"
// list. Scoped to the owner of the sequence.

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Verify sequence ownership — return 404 instead of letting RLS hide
  const { data: seq } = await supabase
    .from("sequences")
    .select("id")
    .eq("id", params.id)
    .eq("profile_id", ownerId)
    .single();
  if (!seq) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: enrollments, error } = await supabase
    .from("sequence_enrollments")
    .select(
      "id, lead_id, status, current_step, enrolled_at, completed_at, leads(id, business_name, email, phone, status)",
    )
    .eq("sequence_id", params.id)
    .order("enrolled_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ enrollments: enrollments || [] });
}
