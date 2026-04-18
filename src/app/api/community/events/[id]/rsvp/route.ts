import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// POST — set/toggle the user's RSVP for an event.
// Body: { rsvp_status: 'going' | 'maybe' | 'not_going' }
// If the user already has the same rsvp_status, the row is removed (toggle off).
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const rsvp_status = (body.rsvp_status as string) || "going";
  if (!["going", "maybe", "not_going"].includes(rsvp_status)) {
    return NextResponse.json(
      { error: "rsvp_status must be one of going|maybe|not_going" },
      { status: 400 }
    );
  }

  // Check the event exists
  const { data: event } = await supabase
    .from("community_events")
    .select("id, max_attendees")
    .eq("id", params.id)
    .single();
  if (!event)
    return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const { data: existing } = await supabase
    .from("community_event_rsvps")
    .select("id, rsvp_status")
    .eq("event_id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  // Toggle off — clicking the same status again removes the RSVP
  if (existing && existing.rsvp_status === rsvp_status) {
    await supabase
      .from("community_event_rsvps")
      .delete()
      .eq("id", existing.id);
    await refreshAttendeeCount(supabase, params.id);
    return NextResponse.json({ success: true, rsvp_status: null });
  }

  // Capacity check for "going"
  if (rsvp_status === "going" && event.max_attendees) {
    const { count } = await supabase
      .from("community_event_rsvps")
      .select("id", { count: "exact", head: true })
      .eq("event_id", params.id)
      .eq("rsvp_status", "going");
    const goingNow = count || 0;
    const wasGoing = existing?.rsvp_status === "going";
    if (!wasGoing && goingNow >= event.max_attendees) {
      return NextResponse.json(
        { error: "This event is at capacity" },
        { status: 409 }
      );
    }
  }

  if (existing) {
    await supabase
      .from("community_event_rsvps")
      .update({ rsvp_status })
      .eq("id", existing.id);
  } else {
    await supabase.from("community_event_rsvps").insert({
      event_id: params.id,
      user_id: user.id,
      rsvp_status,
    });
  }

  await refreshAttendeeCount(supabase, params.id);
  return NextResponse.json({ success: true, rsvp_status });
}

// Recompute the cached attendees_count to keep it in sync (RLS-safe; only "going" rsvps).
async function refreshAttendeeCount(
  supabase: ReturnType<typeof createServerSupabase>,
  eventId: string
) {
  const { count } = await supabase
    .from("community_event_rsvps")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("rsvp_status", "going");
  await supabase
    .from("community_events")
    .update({ attendees_count: count || 0 })
    .eq("id", eventId);
}
