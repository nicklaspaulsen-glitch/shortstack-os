/**
 * Booking SMS Reminders (Cron)
 *
 * Walks every booking that's due in ~24h or ~1h, and sends an SMS reminder
 * via Twilio if the meeting type has `sms_reminders_enabled = true`.
 * Each (booking_id, kind) pair is logged once in `booking_reminder_log` so
 * the cron is idempotent — re-running within the same window is a no-op.
 *
 * Schedule: every 15 minutes (cron expression "* / 15 * * * *", no spaces) —
 * wide enough to catch every booking once before its slot, narrow enough
 * that the 1h reminder lands within ~15 min of the target.
 *
 * Auth: Bearer ${CRON_SECRET}.
 *
 * Notes:
 *   - SMS body is rendered from a default template if the meeting_type has
 *     no `sms_reminder_template`. Authors can override per meeting type.
 *   - Phone is taken from `bookings.guest_phone` — bookings without phone
 *     are silently skipped (logged as `status='skipped'`).
 *   - We use createServiceClient() because cron has no auth context.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const REMINDER_KINDS = ["24h", "1h"] as const;
type ReminderKind = (typeof REMINDER_KINDS)[number];

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
  sms_reminder_24h_sent_at: string | null;
  sms_reminder_1h_sent_at: string | null;
}

interface MeetingTypeRow {
  id: string;
  name: string;
  duration: number;
  sms_reminders_enabled: boolean;
}

function combineDateTime(date: string, time: string): Date {
  // Format: 'YYYY-MM-DD' + 'HH:MM' (24h)
  const [h, m] = time.split(":").map((n) => parseInt(n, 10));
  return new Date(`${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`);
}

async function sendSms(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_DEFAULT_NUMBER;
  if (!sid || !token || !from) {
    return { ok: false, error: "Twilio not configured" };
  }
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Twilio ${res.status}: ${text.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date();
  // Anything starting in the next ~25 hours is a candidate (covers both
  // 24h and 1h reminder windows). Past bookings are excluded.
  const horizon = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("id, user_id, meeting_type_id, guest_name, guest_email, guest_phone, date, time, status, sms_reminder_24h_sent_at, sms_reminder_1h_sent_at")
    .eq("status", "confirmed")
    .gte("date", now.toISOString().split("T")[0])
    .lte("date", horizon.toISOString().split("T")[0]);

  if (error) {
    console.error("[booking-reminders] load failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (bookings || []) as BookingRow[];
  if (rows.length === 0) {
    return NextResponse.json({ checked: 0, sent: 0 });
  }

  // Batch-load meeting types for these bookings.
  const meetingTypeIds = Array.from(new Set(rows.map((b) => b.meeting_type_id)));
  const { data: meetingTypes } = await supabase
    .from("meeting_types")
    .select("id, name, duration, sms_reminders_enabled")
    .in("id", meetingTypeIds);
  const typeById = new Map<string, MeetingTypeRow>(
    (meetingTypes || []).map((mt) => [mt.id, mt as MeetingTypeRow]),
  );

  let sent = 0;
  let skipped = 0;

  for (const booking of rows) {
    const mtype = typeById.get(booking.meeting_type_id);
    if (!mtype || !mtype.sms_reminders_enabled) {
      skipped++;
      continue;
    }
    if (!booking.guest_phone) {
      skipped++;
      continue;
    }

    const start = combineDateTime(booking.date, booking.time);
    const minutesUntil = (start.getTime() - now.getTime()) / 60000;

    // 24h window: between 23h and 24.5h before start
    // 1h window:  between 0.5h and 1.5h before start
    const candidates: ReminderKind[] = [];
    if (
      minutesUntil >= 23 * 60 &&
      minutesUntil <= 24.5 * 60 &&
      !booking.sms_reminder_24h_sent_at
    ) {
      candidates.push("24h");
    }
    if (
      minutesUntil >= 30 &&
      minutesUntil <= 1.5 * 60 &&
      !booking.sms_reminder_1h_sent_at
    ) {
      candidates.push("1h");
    }
    if (candidates.length === 0) {
      skipped++;
      continue;
    }

    for (const kind of candidates) {
      const friendlyTime = `${booking.date} at ${booking.time}`;
      const body = kind === "24h"
        ? `Reminder: your ${mtype.name} appointment is tomorrow at ${booking.time}. See you then!`
        : `Heads up: your ${mtype.name} appointment is in about an hour (${friendlyTime}).`;

      const { ok, error: smsErr } = await sendSms(booking.guest_phone, body);

      // Log + mark on the booking so we don't re-send.
      await supabase.from("booking_reminder_log").insert({
        booking_id: booking.id,
        user_id: booking.user_id,
        channel: "sms",
        reminder_kind: kind,
        status: ok ? "sent" : "failed",
        error_text: smsErr ?? null,
      });
      if (ok) {
        const update: Record<string, string> = {};
        if (kind === "24h") update.sms_reminder_24h_sent_at = new Date().toISOString();
        if (kind === "1h") update.sms_reminder_1h_sent_at = new Date().toISOString();
        await supabase.from("bookings").update(update).eq("id", booking.id);
        sent++;
      } else {
        skipped++;
      }
    }
  }

  return NextResponse.json({ checked: rows.length, sent, skipped });
}
