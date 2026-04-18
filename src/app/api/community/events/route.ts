import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/*
  community_events table — see migration 20260418_community_events_polls_resources.sql
  Backed by community_event_rsvps for per-user RSVP tracking.
*/

// GET — list upcoming events ordered by date_time ASC, with attendee count and the
// caller's RSVP status (if any). Falls back to attendees_count column if rsvp counts can't be fetched.
export async function GET() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: events, error } = await supabase
    .from("community_events")
    .select("*")
    .neq("status", "ended")
    .order("date_time", { ascending: true });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (events || []).map((e) => e.id);
  if (ids.length === 0) return NextResponse.json({ events: [] });

  // Fetch all RSVPs for these events in one go to compute "going" counts and the user's RSVP.
  const { data: rsvps } = await supabase
    .from("community_event_rsvps")
    .select("event_id, user_id, rsvp_status")
    .in("event_id", ids);

  const goingCounts = new Map<string, number>();
  const myRsvp = new Map<string, string>();
  for (const r of rsvps || []) {
    if (r.rsvp_status === "going") {
      goingCounts.set(r.event_id, (goingCounts.get(r.event_id) || 0) + 1);
    }
    if (r.user_id === user.id) {
      myRsvp.set(r.event_id, r.rsvp_status);
    }
  }

  const enriched = (events || []).map((e) => ({
    ...e,
    attendees_count: goingCounts.get(e.id) || 0,
    my_rsvp: myRsvp.get(e.id) || null,
  }));

  return NextResponse.json({ events: enriched });
}

// POST — create a new event
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { title, description, date_time, location, max_attendees, category, cover_url } = body;

  if (!title?.trim() || !date_time)
    return NextResponse.json(
      { error: "title and date_time are required" },
      { status: 400 }
    );

  const { data: event, error } = await supabase
    .from("community_events")
    .insert({
      user_id: user.id,
      title: title.trim(),
      description: description?.trim() || null,
      date_time,
      location: location?.trim() || null,
      max_attendees: max_attendees ?? null,
      category: category?.trim() || "general",
      cover_url: cover_url?.trim() || null,
      status: "upcoming",
    })
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ event });
}
