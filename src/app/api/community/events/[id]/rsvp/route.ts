import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// POST — set/toggle the user's RSVP for an event.
// Body: { rsvp_status: 'going' | 'maybe' | 'not_going' }
//
// Delegates to the atomic `rsvp_to_event` Postgres function which does the
// capacity check + insert/update under a row lock, preventing races where
// two concurrent RSVPs both see capacity available and both insert.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const rsvp_status = (body.rsvp_status as string) || "going";
  if (!["going", "maybe", "not_going"].includes(rsvp_status)) {
    return NextResponse.json(
      { error: "rsvp_status must be one of going|maybe|not_going" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase.rpc("rsvp_to_event", {
    p_event_id: params.id,
    p_user_id: user.id,
    p_rsvp_status: rsvp_status,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = data as { success: boolean; error?: string; rsvp_status?: string | null };
  if (!result?.success) {
    if (result?.error === "event_not_found") {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    if (result?.error === "at_capacity") {
      return NextResponse.json({ error: "This event is at capacity" }, { status: 409 });
    }
    return NextResponse.json({ error: result?.error || "RSVP failed" }, { status: 400 });
  }

  return NextResponse.json({ success: true, rsvp_status: result.rsvp_status ?? null });
}
