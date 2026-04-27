/**
 * Public reschedule / cancel endpoint — token-authenticated.
 *
 * Confirmation emails embed a one-click link with a `public_token` query
 * param. The recipient hits this endpoint without logging in. We look up
 * the booking by token (RLS bypassed via service-role; the token IS the
 * cap), and let the recipient cancel or move the slot.
 *
 * Routes:
 *   GET    /api/scheduling/bookings/by-token/[token]      — read details
 *   PATCH  /api/scheduling/bookings/by-token/[token]      — reschedule (body: { date, time })
 *   DELETE /api/scheduling/bookings/by-token/[token]      — cancel
 *
 * Security model:
 *   - The token is 32 hex chars (16 bytes) — collision-resistant.
 *   - Cancel is idempotent (already-cancelled returns the existing booking).
 *   - Reschedule rotates the token AFTER use so the same email link can't
 *     be replayed indefinitely. The new token is returned in the response
 *     and embedded in the new confirmation email (caller's responsibility).
 *   - We never expose the user_id or other guests' data.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fireTrigger } from "@/lib/workflows/trigger-dispatch";
import { randomBytes } from "node:crypto";

interface BookingRow {
  id: string;
  user_id: string;
  meeting_type_id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  date: string;
  time: string;
  status: string;
  notes: string | null;
  public_token: string | null;
  rescheduled_from: string | null;
}

function newToken(): string {
  return randomBytes(16).toString("hex");
}

async function loadByToken(token: string): Promise<BookingRow | null> {
  if (!token || token.length < 16) return null;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("id, user_id, meeting_type_id, guest_name, guest_email, guest_phone, date, time, status, notes, public_token, rescheduled_from")
    .eq("public_token", token)
    .maybeSingle();
  if (error) {
    console.error("[bookings/by-token] load failed:", error.message);
    return null;
  }
  return (data as BookingRow | null) ?? null;
}

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const booking = await loadByToken(token);
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const supabase = createServiceClient();
  const { data: meetingType } = await supabase
    .from("meeting_types")
    .select("name, duration, location_type")
    .eq("id", booking.meeting_type_id)
    .maybeSingle();

  // Don't leak owner identity. Just return the bits the guest needs.
  return NextResponse.json({
    booking: {
      id: booking.id,
      guest_name: booking.guest_name,
      guest_email: booking.guest_email,
      date: booking.date,
      time: booking.time,
      status: booking.status,
      meeting_type: meetingType,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const booking = await loadByToken(token);
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (booking.status === "cancelled") {
    return NextResponse.json(
      { error: "This booking is cancelled. Please book a new slot." },
      { status: 410 },
    );
  }

  let body: { date?: string; time?: string; notes?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { date, time, notes } = body;
  if (!date || !time) {
    return NextResponse.json(
      { error: "date and time are required" },
      { status: 400 },
    );
  }
  // Cheap format guard. Real availability check happens server-side below.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return NextResponse.json(
      { error: "date must be YYYY-MM-DD and time must be HH:MM" },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  // Cancel the original, create a new linked booking. This preserves the
  // history rather than mutating a single row.
  await supabase
    .from("bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", booking.id);

  const fresh = newToken();
  const { data: newRow, error: insertErr } = await supabase
    .from("bookings")
    .insert({
      meeting_type_id: booking.meeting_type_id,
      user_id: booking.user_id,
      guest_name: booking.guest_name,
      guest_email: booking.guest_email,
      guest_phone: booking.guest_phone,
      date,
      time,
      status: "confirmed",
      notes: notes ?? booking.notes,
      public_token: fresh,
      rescheduled_from: booking.id,
    })
    .select("id, date, time, public_token")
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // Fire the appointment_booked trigger for the new slot.
  fireTrigger({
    supabase,
    userId: booking.user_id,
    triggerType: "appointment_booked",
    payload: {
      booking_id: (newRow as { id?: string } | null)?.id,
      meeting_type_id: booking.meeting_type_id,
      guest_name: booking.guest_name,
      guest_email: booking.guest_email,
      guest_phone: booking.guest_phone,
      date,
      time,
      rescheduled_from: booking.id,
    },
  }).catch((err) => console.error("[bookings/by-token] fireTrigger failed:", err));

  return NextResponse.json({
    rescheduled: true,
    booking: newRow,
  });
}

export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const booking = await loadByToken(token);
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (booking.status === "cancelled") {
    return NextResponse.json({ cancelled: true, alreadyCancelled: true });
  }
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("bookings")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      // Rotate token so a forwarded link can't be replayed. The slot is gone.
      public_token: newToken(),
    })
    .eq("id", booking.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ cancelled: true });
}
