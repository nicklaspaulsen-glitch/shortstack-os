/**
 * Portal Book-a-Call endpoint
 *
 * GET /api/portal/book-call?duration=30
 *   Returns up to 10 available 30-min slots in the next 14 days based on the
 *   agency owner's calendar_availability rows (weekday working hours) minus
 *   existing calendar_events. If the agency has no availability configured,
 *   falls back to a default 9am–5pm Mon–Fri schedule in the owner's timezone
 *   (or America/Los_Angeles).
 *
 * POST /api/portal/book-call
 *   body: { start_iso: string, duration?: number, title?: string, notes?: string }
 *   Creates a calendar_events row on the agency owner's calendar, sends a
 *   notification, records a trinity_log entry, and — if the agency has a
 *   Google Calendar oauth_connection — also creates the event on Google
 *   Calendar with a Google Meet link. Returns event details incl. meet_url
 *   when Google integration is wired.
 *
 * Auth: portal session (regular Supabase auth) required. Caller must have a
 * clients row linked to their profile.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { assignBookingToMember } from "@/lib/calendar/round-robin";

const DEFAULT_DURATION_MIN = 30;
const LOOKAHEAD_DAYS = 14;
const MAX_SLOTS = 10;

async function resolvePortalContext(userId: string) {
  const service = createServiceClient();
  const { data: client } = await service
    .from("clients")
    .select("id, profile_id, business_name, contact_name, email")
    .eq("profile_id", userId)
    .maybeSingle();

  if (!client) return null;

  // Agency owner resolution
  const { data: clientProfile } = await service
    .from("profiles")
    .select("parent_agency_id, timezone")
    .eq("id", client.profile_id)
    .maybeSingle();

  const ownerId = clientProfile?.parent_agency_id || client.profile_id;
  const { data: ownerProfile } = await service
    .from("profiles")
    .select("id, email, full_name, timezone")
    .eq("id", ownerId)
    .maybeSingle();

  return {
    client,
    ownerId,
    ownerEmail: ownerProfile?.email || null,
    ownerName: ownerProfile?.full_name || null,
    timezone: ownerProfile?.timezone || "America/Los_Angeles",
  };
}

interface Slot {
  start: string; // ISO
  end: string;
  label: string;
}

async function computeSlots(
  ownerId: string,
  duration: number,
  service: ReturnType<typeof createServiceClient>,
): Promise<Slot[]> {
  // Load availability rules
  const { data: availability } = await service
    .from("calendar_availability")
    .select("weekday, start_time, end_time, timezone, is_active")
    .eq("user_id", ownerId)
    .eq("is_active", true);

  const rules = (availability && availability.length > 0)
    ? availability
    : // Default: Mon–Fri 9–17, owner-local tz
      [1, 2, 3, 4, 5].map((weekday) => ({
        weekday,
        start_time: "09:00:00",
        end_time: "17:00:00",
        timezone: "America/Los_Angeles",
        is_active: true,
      }));

  // Existing events → treat as busy
  const lookaheadStart = new Date();
  const lookaheadEnd = new Date(Date.now() + LOOKAHEAD_DAYS * 86400000);
  const { data: existing } = await service
    .from("calendar_events")
    .select("date, time, duration")
    .eq("user_id", ownerId)
    .gte("date", lookaheadStart.toISOString().slice(0, 10))
    .lte("date", lookaheadEnd.toISOString().slice(0, 10));

  const busy = new Set<string>();
  for (const ev of existing || []) {
    // Block the exact hh:mm on that date — slot comparison key: `YYYY-MM-DD HH:MM`
    busy.add(`${ev.date} ${(ev.time || "").slice(0, 5)}`);
  }

  const slots: Slot[] = [];
  const now = new Date();

  for (let d = 0; d < LOOKAHEAD_DAYS && slots.length < MAX_SLOTS; d++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    const weekday = day.getDay();
    const rulesForDay = rules.filter((r) => r.weekday === weekday);
    if (rulesForDay.length === 0) continue;

    for (const rule of rulesForDay) {
      const [sh, sm] = (rule.start_time as string).split(":").map(Number);
      const [eh, em] = (rule.end_time as string).split(":").map(Number);
      const dayStart = new Date(day);
      dayStart.setHours(sh, sm, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(eh, em, 0, 0);

      for (
        let t = new Date(dayStart);
        t.getTime() + duration * 60000 <= dayEnd.getTime() && slots.length < MAX_SLOTS;
        t = new Date(t.getTime() + duration * 60000)
      ) {
        // Skip slots in the past or less than 1h out
        if (t.getTime() < now.getTime() + 3600000) continue;

        const dateKey = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
        const hhmm = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
        const busyKey = `${dateKey} ${hhmm}`;
        if (busy.has(busyKey)) continue;

        const end = new Date(t.getTime() + duration * 60000);
        slots.push({
          start: t.toISOString(),
          end: end.toISOString(),
          label: t.toLocaleString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZone: rule.timezone || "America/Los_Angeles",
          }),
        });
      }
    }
  }

  return slots.slice(0, MAX_SLOTS);
}

export async function GET(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = await resolvePortalContext(user.id);
  if (!ctx) {
    return NextResponse.json(
      { error: "No portal client linked to this account" },
      { status: 403 },
    );
  }

  const durationParam = Number(req.nextUrl.searchParams.get("duration")) || DEFAULT_DURATION_MIN;
  const duration = Math.min(Math.max(durationParam, 15), 120);

  const service = createServiceClient();
  const slots = await computeSlots(ctx.ownerId, duration, service);

  // Check if Google Calendar is wired
  const { data: gcal } = await service
    .from("oauth_connections")
    .select("id, is_active, token_expires_at")
    .eq("user_id", ctx.ownerId)
    .in("platform", ["google_calendar", "google"])
    .eq("is_active", true)
    .maybeSingle();

  return NextResponse.json({
    slots,
    duration,
    provider: gcal ? "google_calendar" : "native",
    timezone: ctx.timezone,
    fallback_embed_url: process.env.CALCOM_PORTAL_BOOKING_URL || null,
  });
}

async function refreshGoogleToken(
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number } | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret || !refreshToken) return null;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return { access_token: json.access_token, expires_in: json.expires_in };
  } catch {
    return null;
  }
}

async function createGoogleCalendarEvent(
  accessToken: string,
  summary: string,
  description: string,
  startIso: string,
  endIso: string,
  attendeeEmails: string[],
  timeZone: string,
): Promise<{ meet_url: string | null; event_id: string | null; html_link: string | null } | null> {
  try {
    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary,
          description,
          start: { dateTime: startIso, timeZone },
          end: { dateTime: endIso, timeZone },
          attendees: attendeeEmails.filter(Boolean).map((email) => ({ email })),
          conferenceData: {
            createRequest: {
              requestId: `portal-${Date.now()}`,
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          },
        }),
      },
    );
    if (!res.ok) {
      console.warn("[portal book-call] Google Calendar error:", await res.text());
      return null;
    }
    const json = await res.json();
    const meetUrl = json.conferenceData?.entryPoints?.find(
      (e: { entryPointType: string; uri: string }) => e.entryPointType === "video",
    )?.uri || json.hangoutLink || null;
    return {
      meet_url: meetUrl,
      event_id: json.id || null,
      html_link: json.htmlLink || null,
    };
  } catch (e) {
    console.warn("[portal book-call] Google Calendar error:", e);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = await resolvePortalContext(user.id);
  if (!ctx) {
    return NextResponse.json(
      { error: "No portal client linked to this account" },
      { status: 403 },
    );
  }

  let body: {
    start_iso?: string;
    duration?: number;
    title?: string;
    notes?: string;
    team_id?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const start = body.start_iso ? new Date(body.start_iso) : null;
  if (!start || isNaN(start.getTime())) {
    return NextResponse.json({ error: "start_iso required" }, { status: 400 });
  }
  if (start.getTime() < Date.now() + 30 * 60000) {
    return NextResponse.json(
      { error: "Slot must be at least 30 minutes in the future" },
      { status: 400 },
    );
  }

  const duration = Math.min(Math.max(body.duration || DEFAULT_DURATION_MIN, 15), 120);
  const end = new Date(start.getTime() + duration * 60000);
  const service = createServiceClient();

  // Team round-robin routing (optional; falls back to single-user when team_id absent)
  let assignedUserId: string | null = null;
  let assignedTeamId: string | null = null;
  let assignedTeamMemberName: string | null = null;
  if (body.team_id) {
    const { data: team } = await service
      .from("booking_teams")
      .select("id, owner_user_id, name, active")
      .eq("id", body.team_id)
      .maybeSingle();
    if (team && team.owner_user_id === ctx.ownerId && team.active) {
      const assignment = await assignBookingToMember({
        service,
        teamId: body.team_id,
        slotStart: start,
        slotEnd: end,
      });
      if (assignment) {
        assignedUserId = assignment.userId;
        assignedTeamId = body.team_id;
        const { data: repProfile } = await service
          .from("profiles")
          .select("full_name, email")
          .eq("id", assignment.userId)
          .maybeSingle();
        assignedTeamMemberName =
          repProfile?.full_name || repProfile?.email || null;
      } else {
        return NextResponse.json(
          { error: "No team member is available for that slot", code: "NO_REP_AVAILABLE" },
          { status: 409 },
        );
      }
    }
  }

  const bookingHolderId = assignedUserId || ctx.ownerId;
  const title =
    body.title?.trim() ||
    `Call with ${ctx.client.business_name || ctx.client.contact_name || "client"}`;
  const description = (body.notes || "").trim() ||
    `Booked via client portal by ${ctx.client.contact_name || ctx.client.email || user.email || "client"}.`;

  // Re-check availability — reject if slot now taken
  const dateStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  const timeStr = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
  const { data: conflict } = await service
    .from("calendar_events")
    .select("id")
    .eq("user_id", ctx.ownerId)
    .eq("date", dateStr)
    .eq("time", timeStr)
    .maybeSingle();
  if (conflict) {
    return NextResponse.json(
      { error: "Slot no longer available", code: "SLOT_TAKEN" },
      { status: 409 },
    );
  }

  // Insert native calendar event (owner-scoped; assigned_user_id + booking_team_id when routed)
  const { data: event, error: evError } = await service
    .from("calendar_events")
    .insert({
      user_id: ctx.ownerId,
      title,
      client: ctx.client.business_name || ctx.client.contact_name || null,
      team_member: assignedTeamMemberName || ctx.ownerName || "",
      date: dateStr,
      time: timeStr,
      duration: String(duration),
      category: "call",
      type: "video",
      recurring: false,
      booking_team_id: assignedTeamId,
      assigned_user_id: bookingHolderId,
      booked_via: "portal",
      booking_status: "confirmed",
      client_id: ctx.client.id,
      client_contact_name: ctx.client.contact_name,
      client_contact_email: ctx.client.email,
    })
    .select()
    .single();

  if (evError) {
    console.error("[portal book-call] calendar_events insert error:", evError);
    return NextResponse.json({ error: evError.message }, { status: 500 });
  }

  // Try Google Calendar sync
  let googleResult: Awaited<ReturnType<typeof createGoogleCalendarEvent>> = null;
  const { data: gcal } = await service
    .from("oauth_connections")
    .select("id, access_token, refresh_token, token_expires_at, is_active")
    .eq("user_id", ctx.ownerId)
    .in("platform", ["google_calendar", "google"])
    .eq("is_active", true)
    .maybeSingle();

  if (gcal?.access_token) {
    let token = gcal.access_token as string;
    const expiresAt = gcal.token_expires_at ? new Date(gcal.token_expires_at).getTime() : 0;
    if (expiresAt && expiresAt < Date.now() + 60000 && gcal.refresh_token) {
      const refreshed = await refreshGoogleToken(gcal.refresh_token as string);
      if (refreshed) {
        token = refreshed.access_token;
        await service
          .from("oauth_connections")
          .update({
            access_token: refreshed.access_token,
            token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
          })
          .eq("id", gcal.id);
      }
    }

    googleResult = await createGoogleCalendarEvent(
      token,
      title,
      description,
      start.toISOString(),
      end.toISOString(),
      [ctx.ownerEmail, ctx.client.email, user.email].filter((e): e is string => !!e),
      ctx.timezone,
    );
  }

  // Record trinity log
  await service.from("trinity_log").insert({
    agent: "portal",
    action_type: "custom",
    description: `Call booked for ${ctx.client.business_name || "client"} at ${start.toISOString()}`,
    client_id: ctx.client.id,
    status: "completed",
    result: {
      type: "portal_booking",
      event_id: event.id,
      start_iso: start.toISOString(),
      end_iso: end.toISOString(),
      meet_url: googleResult?.meet_url || null,
      google_event_id: googleResult?.event_id || null,
      duration_minutes: duration,
    },
  });

  // Notify agency owner
  try {
    if (ctx.ownerId !== user.id) {
      await service.from("notifications").insert({
        user_id: ctx.ownerId,
        title: "Client booked a call",
        message: `${ctx.client.business_name || "Client"} booked ${duration}-min call on ${start.toLocaleString("en-US", { timeZone: ctx.timezone })}`,
        type: "info",
        link: "/dashboard/calendar",
      });
    }
  } catch (e) {
    console.warn("[portal book-call] notify failed:", e);
  }

  return NextResponse.json({
    event,
    start_iso: start.toISOString(),
    end_iso: end.toISOString(),
    meet_url: googleResult?.meet_url || null,
    google_event_id: googleResult?.event_id || null,
    google_html_link: googleResult?.html_link || null,
    provider: googleResult ? "google_calendar" : "native",
  });
}
