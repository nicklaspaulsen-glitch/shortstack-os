/**
 * Public booking creation endpoint — no auth required.
 *
 * POST /api/scheduling/bookings/public
 * Body: { meeting_type_id, guest_name, guest_email, guest_phone?, date, time, notes? }
 *
 * Used by the public booking page (`/book` and `/book/embed/[id]`). Uses
 * the service-role client to insert because the requester has no Supabase
 * session — the meeting_type_id IS the cap (it's not a secret, but it
 * scopes the booking to the right user_id).
 *
 * Round-robin assignment: if the meeting type has `assignment_strategy =
 * 'round_robin'` and `round_robin_assignees` is populated, we pick the
 * assignee with the FEWEST upcoming bookings on that day. Ties broken
 * by random selection so consecutive bookings don't always pile on the
 * same person.
 *
 * Buffer-time enforcement: we re-check the slot is available immediately
 * before insert (the public availability endpoint cached at the client
 * could be stale).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fireTrigger } from "@/lib/workflows/trigger-dispatch";
import { sendEmail } from "@/lib/email";
import { randomBytes } from "node:crypto";

interface MeetingType {
  id: string;
  user_id: string;
  active: boolean;
  duration: number;
  buffer_time: number;
  max_bookings_per_day: number | null;
  assignment_strategy: string;
  round_robin_assignees: string[] | null;
  group_event: boolean;
  max_invitees_per_slot: number;
}

interface ExistingBooking {
  time: string;
  status: string;
  assigned_to: string | null;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map((n) => parseInt(n, 10));
  return h * 60 + m;
}

function newToken(): string {
  return randomBytes(16).toString("hex");
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function POST(request: NextRequest) {
  let body: {
    meeting_type_id?: string;
    guest_name?: string;
    guest_email?: string;
    guest_phone?: string | null;
    date?: string;
    time?: string;
    notes?: string | null;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { meeting_type_id, guest_name, guest_email, guest_phone, date, time, notes } = body;
  if (!meeting_type_id || !guest_name || !guest_email || !date || !time) {
    return NextResponse.json(
      { error: "meeting_type_id, guest_name, guest_email, date, and time are required" },
      { status: 400 },
    );
  }
  if (!isValidEmail(guest_email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return NextResponse.json(
      { error: "date must be YYYY-MM-DD and time must be HH:MM" },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  const { data: meetingTypeData, error: mtErr } = await supabase
    .from("meeting_types")
    .select("id, user_id, active, duration, buffer_time, max_bookings_per_day, assignment_strategy, round_robin_assignees, group_event, max_invitees_per_slot")
    .eq("id", meeting_type_id)
    .maybeSingle();

  if (mtErr) return NextResponse.json({ error: mtErr.message }, { status: 500 });
  if (!meetingTypeData) {
    return NextResponse.json({ error: "Meeting type not found" }, { status: 404 });
  }
  const mt = meetingTypeData as MeetingType;
  if (!mt.active) {
    return NextResponse.json({ error: "Meeting type inactive" }, { status: 410 });
  }

  // Re-check availability (defense against stale client cache).
  const { data: existingData } = await supabase
    .from("bookings")
    .select("time, status, assigned_to")
    .eq("meeting_type_id", meeting_type_id)
    .eq("date", date)
    .neq("status", "cancelled");
  const existing = (existingData || []) as ExistingBooking[];

  if (
    mt.max_bookings_per_day !== null &&
    existing.length >= mt.max_bookings_per_day
  ) {
    return NextResponse.json({ error: "Day is full" }, { status: 409 });
  }

  const slotStart = timeToMinutes(time);
  const slotEnd = slotStart + mt.duration;
  const buffer = mt.buffer_time || 0;

  if (mt.group_event) {
    const sameSlotCount = existing.filter((b) => b.time === time).length;
    if (sameSlotCount >= (mt.max_invitees_per_slot || 1)) {
      return NextResponse.json({ error: "This slot is full" }, { status: 409 });
    }
  } else {
    for (const b of existing) {
      const bStart = timeToMinutes(b.time);
      const bEnd = bStart + mt.duration;
      if (slotStart < bEnd + buffer && slotEnd > bStart - buffer) {
        return NextResponse.json({ error: "Slot no longer available" }, { status: 409 });
      }
    }
  }

  // Pick an assignee for round-robin.
  let assignedTo: string | null = null;
  if (
    mt.assignment_strategy === "round_robin" &&
    mt.round_robin_assignees &&
    mt.round_robin_assignees.length > 0
  ) {
    const counts = new Map<string, number>();
    for (const id of mt.round_robin_assignees) counts.set(id, 0);
    for (const b of existing) {
      if (b.assigned_to && counts.has(b.assigned_to)) {
        counts.set(b.assigned_to, (counts.get(b.assigned_to) || 0) + 1);
      }
    }
    const countValues = Array.from(counts.values());
    const min = Math.min(...countValues);
    const candidates = Array.from(counts.entries())
      .filter(([, c]) => c === min)
      .map(([id]) => id);
    assignedTo = candidates[Math.floor(Math.random() * candidates.length)] ?? null;
  }

  const publicToken = newToken();
  const { data: created, error: insertErr } = await supabase
    .from("bookings")
    .insert({
      meeting_type_id,
      user_id: mt.user_id,
      guest_name,
      guest_email,
      guest_phone: guest_phone ?? null,
      date,
      time,
      status: "confirmed",
      notes: notes ?? null,
      public_token: publicToken,
      assigned_to: assignedTo,
    })
    .select("id, public_token, date, time")
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // Fire appointment_booked trigger.
  fireTrigger({
    supabase,
    userId: mt.user_id,
    triggerType: "appointment_booked",
    payload: {
      booking_id: (created as { id?: string } | null)?.id,
      meeting_type_id,
      guest_name,
      guest_email,
      guest_phone,
      date,
      time,
      assigned_to: assignedTo,
    },
  }).catch((err) => console.error("[bookings/public] fireTrigger failed:", err));

  // Send the confirmation email with reschedule + cancel links. Fire-and-forget.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work";
  const manageUrl = `${appUrl}/book/manage/${publicToken}`;
  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("business_name, full_name")
    .eq("id", mt.user_id)
    .maybeSingle();
  const businessName =
    ownerProfile?.business_name || ownerProfile?.full_name || "your team";

  void sendEmail({
    to: guest_email,
    subject: `Booking confirmed: ${date} at ${time}`,
    html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#222;">
      <p style="font-size:15px;line-height:1.6;">Hi ${guest_name.split(" ")[0]},</p>
      <p style="font-size:15px;line-height:1.6;">
        Your booking with <strong>${businessName}</strong> is confirmed for
        <strong>${date} at ${time}</strong>.
      </p>
      <p style="margin-top:18px;">
        <a href="${manageUrl}" style="background:#c8a855;color:#000;padding:9px 18px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px;">Manage booking</a>
      </p>
      <p style="font-size:12px;color:#666;margin-top:14px;">
        Need to reschedule or cancel? Use the button above — no login required.
      </p>
    </div>`,
    text: `Your booking with ${businessName} is confirmed for ${date} at ${time}.\n\nManage your booking (reschedule or cancel): ${manageUrl}`,
  }).catch((err) => console.error("[bookings/public] confirmation email failed:", err));

  return NextResponse.json({
    booking: created,
    reschedule_url: manageUrl,
  }, { status: 201 });
}
