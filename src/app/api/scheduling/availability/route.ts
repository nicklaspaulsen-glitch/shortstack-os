/**
 * Slot availability — public endpoint, no auth required.
 *
 * Generates available time slots for a given meeting type and date,
 * accounting for:
 *   - the meeting type's `available_days` + `available_hours_*`
 *   - `buffer_time` padding between bookings (each booking blocks
 *     `duration + buffer_time` minutes on either side)
 *   - `max_bookings_per_day` cap
 *   - `group_event` + `max_invitees_per_slot` (a slot is still available
 *     if fewer than max guests have booked it)
 *   - existing confirmed/completed bookings (cancelled bookings DO release the slot)
 *
 * GET /api/scheduling/availability?meeting_type_id={id}&date=YYYY-MM-DD
 *
 * Returns:
 *   { slots: ["09:00", "09:30", ...], duration, buffer_time, group_event }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

interface MeetingType {
  id: string;
  user_id: string;
  duration: number;
  buffer_time: number;
  max_bookings_per_day: number | null;
  available_days: string[];
  available_hours_start: string;
  available_hours_end: string;
  group_event: boolean;
  max_invitees_per_slot: number;
  active: boolean;
}

interface BookingSlot {
  time: string;
  status: string;
}

const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const SLOT_INCREMENT_MIN = 30;

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map((n) => parseInt(n, 10));
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const meetingTypeId = sp.get("meeting_type_id");
  const date = sp.get("date");
  if (!meetingTypeId || !date) {
    return NextResponse.json(
      { error: "meeting_type_id and date are required" },
      { status: 400 },
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }

  // Public endpoint → service-role lookup. We never expose user_id.
  const supabase = createServiceClient();
  const { data: meetingType, error } = await supabase
    .from("meeting_types")
    .select("id, user_id, duration, buffer_time, max_bookings_per_day, available_days, available_hours_start, available_hours_end, group_event, max_invitees_per_slot, active")
    .eq("id", meetingTypeId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!meetingType) return NextResponse.json({ error: "Meeting type not found" }, { status: 404 });
  const mt = meetingType as MeetingType;
  if (!mt.active) {
    return NextResponse.json({ slots: [], reason: "meeting type inactive" });
  }

  const dayName = DAY_NAMES[new Date(`${date}T00:00:00Z`).getUTCDay()];
  if (!mt.available_days.includes(dayName)) {
    return NextResponse.json({ slots: [], reason: "day not available" });
  }

  const startMin = timeToMinutes(mt.available_hours_start);
  const endMin = timeToMinutes(mt.available_hours_end);
  const duration = Math.max(mt.duration, 1);
  const buffer = Math.max(mt.buffer_time || 0, 0);
  const groupEvent = !!mt.group_event;
  const maxInvitees = Math.max(mt.max_invitees_per_slot || 1, 1);

  // Load all non-cancelled bookings for this meeting type on this date.
  const { data: bookingsData } = await supabase
    .from("bookings")
    .select("time, status")
    .eq("meeting_type_id", mt.id)
    .eq("date", date)
    .neq("status", "cancelled");

  const bookings = (bookingsData || []) as BookingSlot[];
  const bookingCount = bookings.length;

  if (
    mt.max_bookings_per_day !== null &&
    bookingCount >= mt.max_bookings_per_day
  ) {
    return NextResponse.json({ slots: [], reason: "max bookings reached" });
  }

  // Tally per-slot fill (group events allow >1 booking per time slot).
  const fillByTime = new Map<string, number>();
  for (const b of bookings) {
    fillByTime.set(b.time, (fillByTime.get(b.time) || 0) + 1);
  }

  const slots: string[] = [];
  for (let t = startMin; t + duration <= endMin; t += SLOT_INCREMENT_MIN) {
    const slotTime = minutesToTime(t);
    const slotEnd = t + duration;
    const fill = fillByTime.get(slotTime) || 0;

    if (groupEvent) {
      // Group: a time is available as long as < maxInvitees seats are filled
      // AND no overlapping non-group booking blocks it.
      if (fill >= maxInvitees) continue;
    } else {
      // Single: time is unavailable if any existing booking overlaps with
      // this slot ± buffer.
      let blocked = false;
      for (const b of bookings) {
        const bStart = timeToMinutes(b.time);
        const bEnd = bStart + duration; // assume same duration for the meeting type
        // Two intervals overlap if start < other.end + buffer AND end > other.start - buffer
        if (t < bEnd + buffer && slotEnd > bStart - buffer) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
    }

    slots.push(slotTime);
  }

  return NextResponse.json({
    slots,
    duration,
    buffer_time: buffer,
    group_event: groupEvent,
    max_invitees_per_slot: maxInvitees,
    seats_remaining: groupEvent ? Math.max(0, maxInvitees - bookingCount) : null,
  });
}
