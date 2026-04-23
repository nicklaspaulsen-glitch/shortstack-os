import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// POST /api/conversations/:id/assign
// Body: { assigned_to_user_id: string | null }
// Null clears the assignment.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { assigned_to_user_id } = await request.json();
  if (assigned_to_user_id !== null && typeof assigned_to_user_id !== "string") {
    return NextResponse.json({ error: "assigned_to_user_id must be UUID or null" }, { status: 400 });
  }

  const { error } = await supabase
    .from("conversations")
    .update({ assigned_to_user_id })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
