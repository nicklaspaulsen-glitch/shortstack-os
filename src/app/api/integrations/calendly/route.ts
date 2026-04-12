import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Calendly Integration — scheduling, event types, bookings
// Requires: CALENDLY_API_TOKEN (personal access token or OAuth)
// Docs: https://developer.calendly.com/api-docs

const CALENDLY_API = "https://api.calendly.com";

function getCalendlyToken() {
  return process.env.CALENDLY_API_TOKEN || "";
}

function calendlyHeaders() {
  return {
    Authorization: `Bearer ${getCalendlyToken()}`,
    "Content-Type": "application/json",
  };
}

// Get event types, scheduled events, or user info
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!getCalendlyToken()) {
    return NextResponse.json({ error: "Calendly not configured", connected: false }, { status: 500 });
  }

  const action = request.nextUrl.searchParams.get("action") || "event_types";

  try {
    // Get current user first
    const meRes = await fetch(`${CALENDLY_API}/users/me`, { headers: calendlyHeaders() });
    const meData = await meRes.json();
    const userUri = meData.resource?.uri;
    const orgUri = meData.resource?.current_organization;

    if (!userUri) return NextResponse.json({ error: "Failed to get Calendly user" }, { status: 500 });

    if (action === "me") {
      return NextResponse.json({
        success: true,
        user: {
          name: meData.resource.name,
          email: meData.resource.email,
          avatar: meData.resource.avatar_url,
          scheduling_url: meData.resource.scheduling_url,
          timezone: meData.resource.timezone,
        },
      });
    }

    if (action === "event_types") {
      const res = await fetch(`${CALENDLY_API}/event_types?user=${encodeURIComponent(userUri)}&active=true`, {
        headers: calendlyHeaders(),
      });
      const data = await res.json();
      const types = (data.collection || []).map((e: Record<string, unknown>) => ({
        uri: e.uri,
        name: e.name,
        slug: e.slug,
        duration: e.duration,
        description: e.description_plain,
        color: e.color,
        scheduling_url: e.scheduling_url,
        active: e.active,
      }));
      return NextResponse.json({ success: true, event_types: types });
    }

    if (action === "scheduled_events") {
      const status = request.nextUrl.searchParams.get("status") || "active";
      const minDate = request.nextUrl.searchParams.get("min_date") || new Date().toISOString();
      const res = await fetch(
        `${CALENDLY_API}/scheduled_events?organization=${encodeURIComponent(orgUri)}&user=${encodeURIComponent(userUri)}&status=${status}&min_start_time=${minDate}&count=25&sort=start_time:asc`,
        { headers: calendlyHeaders() }
      );
      const data = await res.json();
      const events = (data.collection || []).map((e: Record<string, unknown>) => ({
        uri: e.uri,
        name: e.name,
        status: e.status,
        start_time: e.start_time,
        end_time: e.end_time,
        event_type: e.event_type,
        location: e.location,
        invitees_counter: e.invitees_counter,
        created_at: e.created_at,
      }));
      return NextResponse.json({ success: true, events });
    }

    if (action === "invitees") {
      const eventUri = request.nextUrl.searchParams.get("event_uri");
      if (!eventUri) return NextResponse.json({ error: "event_uri required" }, { status: 400 });
      const uuid = eventUri.split("/").pop();
      const res = await fetch(`${CALENDLY_API}/scheduled_events/${uuid}/invitees`, {
        headers: calendlyHeaders(),
      });
      const data = await res.json();
      return NextResponse.json({ success: true, invitees: data.collection || [] });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: `Calendly API error: ${err}` }, { status: 500 });
  }
}

// Cancel an event or create a webhook subscription
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action, ...params } = await request.json();

  try {
    if (action === "cancel_event") {
      const { event_uri, reason } = params;
      const uuid = event_uri.split("/").pop();
      const res = await fetch(`${CALENDLY_API}/scheduled_events/${uuid}/cancellation`, {
        method: "POST",
        headers: calendlyHeaders(),
        body: JSON.stringify({ reason: reason || "Cancelled by ShortStack OS" }),
      });
      if (res.ok) {
        return NextResponse.json({ success: true });
      }
      const err = await res.json();
      return NextResponse.json({ error: err.message || "Failed to cancel" }, { status: 400 });
    }

    if (action === "create_webhook") {
      const { events, callback_url } = params;
      const meRes = await fetch(`${CALENDLY_API}/users/me`, { headers: calendlyHeaders() });
      const meData = await meRes.json();
      const orgUri = meData.resource?.current_organization;

      const res = await fetch(`${CALENDLY_API}/webhook_subscriptions`, {
        method: "POST",
        headers: calendlyHeaders(),
        body: JSON.stringify({
          url: callback_url || `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/inbound`,
          events: events || ["invitee.created", "invitee.canceled"],
          organization: orgUri,
          scope: "organization",
        }),
      });
      const data = await res.json();
      return NextResponse.json({ success: true, webhook: data.resource });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: `Calendly API error: ${err}` }, { status: 500 });
  }
}
