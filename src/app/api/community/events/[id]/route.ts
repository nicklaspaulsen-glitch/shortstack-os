import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// DELETE — remove an event (creator only — also enforced by RLS)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: existing } = await supabase
    .from("community_events")
    .select("user_id")
    .eq("id", params.id)
    .single();

  if (!existing)
    return NextResponse.json({ error: "Event not found" }, { status: 404 });

  if (existing.user_id !== user.id)
    return NextResponse.json(
      { error: "You can only delete your own events" },
      { status: 403 }
    );

  // Defense-in-depth: scope by user_id (captured from ownership read above) to
  // close the TOCTOU window between the check and this write. RLS also enforces
  // creator-only deletes, but the explicit WHERE closes the window.
  const { error } = await supabase
    .from("community_events")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
