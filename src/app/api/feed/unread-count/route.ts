import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/feed/unread-count — returns { count } of events newer than the
// caller's last_read_at, excluding their own. Capped at 100.
export async function GET(_request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: readState } = await supabase
    .from("activity_read_state")
    .select("last_read_at")
    .eq("user_id", user.id)
    .maybeSingle();
  const lastReadAt = readState?.last_read_at ?? new Date(0).toISOString();

  const { count, error } = await supabase
    .from("activity_events")
    .select("id", { count: "exact", head: true })
    .gt("created_at", lastReadAt)
    .neq("actor_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const capped = Math.min(count ?? 0, 100);
  return NextResponse.json({ count: capped });
}
