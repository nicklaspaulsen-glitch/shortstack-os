/*
 * SQL Migration — run once in Supabase SQL Editor:
 *
 * CREATE TABLE IF NOT EXISTS bookings (
 *   id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   meeting_type_id  uuid NOT NULL REFERENCES meeting_types(id) ON DELETE CASCADE,
 *   user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 *   guest_name       text NOT NULL,
 *   guest_email      text NOT NULL,
 *   guest_phone      text,
 *   date             date NOT NULL,
 *   time             text NOT NULL,
 *   status           text NOT NULL DEFAULT 'confirmed'
 *                      CHECK (status IN ('confirmed','cancelled','completed','no_show')),
 *   notes            text,
 *   created_at       timestamptz NOT NULL DEFAULT now()
 * );
 *
 * ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
 *
 * CREATE POLICY "Users can view own bookings"
 *   ON bookings FOR SELECT USING (auth.uid() = user_id);
 *
 * CREATE POLICY "Users can insert own bookings"
 *   ON bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
 *
 * CREATE POLICY "Users can update own bookings"
 *   ON bookings FOR UPDATE USING (auth.uid() = user_id);
 *
 * CREATE POLICY "Users can delete own bookings"
 *   ON bookings FOR DELETE USING (auth.uid() = user_id);
 *
 * CREATE INDEX idx_bookings_user_id ON bookings(user_id);
 * CREATE INDEX idx_bookings_meeting_type_id ON bookings(meeting_type_id);
 * CREATE INDEX idx_bookings_date ON bookings(date);
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { fireTrigger } from "@/lib/workflows/trigger-dispatch";

// GET — fetch bookings for the authenticated user, optionally filtered by meeting_type_id
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const meetingTypeId = searchParams.get("meeting_type_id");

  let query = supabase
    .from("bookings")
    .select("*, meeting_types(name, duration, color)")
    .eq("user_id", user.id)
    .order("date", { ascending: false });

  if (meetingTypeId) {
    query = query.eq("meeting_type_id", meetingTypeId);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ bookings: data });
}

// POST — create a new booking
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { meeting_type_id, guest_name, guest_email, guest_phone, date, time, notes } = body;

  if (!meeting_type_id || !guest_name || !guest_email || !date || !time) {
    return NextResponse.json(
      { error: "meeting_type_id, guest_name, guest_email, date, and time are required" },
      { status: 400 }
    );
  }

  // Verify the meeting type belongs to this user
  const { data: meetingType, error: mtError } = await supabase
    .from("meeting_types")
    .select("id, max_bookings_per_day")
    .eq("id", meeting_type_id)
    .eq("user_id", user.id)
    .single();

  if (mtError || !meetingType) {
    return NextResponse.json({ error: "Meeting type not found" }, { status: 404 });
  }

  // Check max bookings per day if set
  if (meetingType.max_bookings_per_day) {
    const { count } = await supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("meeting_type_id", meeting_type_id)
      .eq("date", date)
      .neq("status", "cancelled");

    if (count !== null && count >= meetingType.max_bookings_per_day) {
      return NextResponse.json({ error: "Maximum bookings for this day reached" }, { status: 409 });
    }
  }

  const { data, error } = await supabase
    .from("bookings")
    .insert({
      meeting_type_id,
      user_id: user.id,
      guest_name,
      guest_email,
      guest_phone: guest_phone ?? null,
      date,
      time,
      status: "confirmed",
      notes: notes ?? null,
    })
    .select("*, meeting_types(name, duration, color)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fire the appointment_booked workflow trigger. Fire-and-forget so the
  // booking response isn't delayed by downstream workflow execution.
  fireTrigger({
    supabase: createServiceClient(),
    userId: user.id,
    triggerType: "appointment_booked",
    payload: {
      booking_id: (data as { id?: string } | null)?.id,
      meeting_type_id,
      guest_name,
      guest_email,
      guest_phone,
      date,
      time,
    },
  }).catch((err) => console.error("[scheduling/bookings] fireTrigger failed:", err));

  return NextResponse.json({ booking: data }, { status: 201 });
}

// PATCH — update booking status (confirm, cancel, reschedule)
export async function PATCH(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const allowedFields = ["status", "date", "time", "notes", "guest_name", "guest_email", "guest_phone"];
  const safeUpdates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in updates) {
      safeUpdates[key] = updates[key];
    }
  }

  if (Object.keys(safeUpdates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("bookings")
    .update(safeUpdates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*, meeting_types(name, duration, color)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // When status flips to "completed", fire the appointment_completed trigger
  // so workflows like "send review request" can run. Two paths fire in parallel:
  //   1. In-process fireTrigger() — fast, for users not running the cron
  //   2. trigger_events queue — durable, picked up by /api/cron/process-trigger-events
  // Fire-and-forget — do not block the booking response on workflow execution.
  if (
    safeUpdates.status === "completed" &&
    data &&
    typeof (data as { id?: string }).id === "string"
  ) {
    const booking = data as {
      id: string;
      meeting_type_id: string;
      guest_name?: string;
      guest_email?: string;
      guest_phone?: string;
      date: string;
      time: string;
    };
    const triggerPayload = {
      booking_id: booking.id,
      meeting_type_id: booking.meeting_type_id,
      guest_name: booking.guest_name,
      guest_email: booking.guest_email,
      guest_phone: booking.guest_phone,
      date: booking.date,
      time: booking.time,
    };
    const service = createServiceClient();
    // Path 1: in-process
    fireTrigger({
      supabase: service,
      userId: user.id,
      triggerType: "appointment_completed",
      payload: triggerPayload,
    }).catch((err) => console.error("[scheduling/bookings] fireTrigger failed:", err));
    // Path 2: durable queue
    service
      .from("trigger_events")
      .insert({
        user_id: user.id,
        trigger_type: "appointment_completed",
        source_table: "bookings",
        source_id: booking.id,
        payload: triggerPayload,
        status: "pending",
      })
      .then(({ error: queueErr }) => {
        if (queueErr) {
          console.error("[scheduling/bookings] trigger_events queue insert failed:", queueErr.message);
        }
      });
  }

  return NextResponse.json({ booking: data });
}
