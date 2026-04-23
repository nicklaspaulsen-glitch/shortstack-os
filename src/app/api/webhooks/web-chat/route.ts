import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { upsertInboundMessage } from "@/lib/conversations";

// Web chat widget ingest → Conversations.
//
// Agencies embed the ShortStack chat widget on their client sites. The
// widget POSTs here with:
//   {
//     agency_user_id: "uuid",        — from the embed code: <script data-agency="...">
//     visitor_id:     "cookie_uuid", — persistent per-visitor identifier
//     visitor_name?:  "John"
//     visitor_email?: "john@x.com"
//     text:           "Hi, are you open?"
//   }
//
// No secret — the endpoint is public by design (any visitor can write),
// but we require agency_user_id to exist as a valid profile. Abuse is
// rate-limited at the edge via IP (not implemented here — TODO).

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(request: NextRequest) {
  let payload: {
    agency_user_id?: string;
    visitor_id?: string;
    visitor_name?: string;
    visitor_email?: string;
    text?: string;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { agency_user_id, visitor_id, visitor_name, visitor_email, text } = payload;
  if (!agency_user_id || !visitor_id || !text) {
    return NextResponse.json({ error: "agency_user_id, visitor_id, text required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Validate the agency_user_id exists.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", agency_user_id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "Unknown agency" }, { status: 404 });

  const handle = visitor_name || visitor_email || `web-${visitor_id.slice(0, 8)}`;

  await upsertInboundMessage({
    supabase,
    userId: agency_user_id,
    channel: "web_chat",
    externalThreadId: visitor_id,
    fromIdentifier: handle,
    body: text,
  });

  return NextResponse.json({ ok: true });
}

// Short-poll endpoint for the widget to fetch outbound agent replies.
// Clients hit `/api/webhooks/web-chat?visitor_id=...&agency_user_id=...`
// every N seconds. Realtime would be nicer but this keeps the widget tiny.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const agencyUserId = url.searchParams.get("agency_user_id");
  const visitorId = url.searchParams.get("visitor_id");
  const since = url.searchParams.get("since"); // ISO timestamp
  if (!agencyUserId || !visitorId) {
    return NextResponse.json({ error: "agency_user_id + visitor_id required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: conv } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_id", agencyUserId)
    .eq("channel", "web_chat")
    .eq("external_thread_id", visitorId)
    .maybeSingle();
  if (!conv) return NextResponse.json({ messages: [] });

  let q = supabase
    .from("conversation_messages")
    .select("id, direction, body, sent_at")
    .eq("conversation_id", conv.id)
    .order("sent_at", { ascending: true });
  if (since) q = q.gt("sent_at", since);

  const { data } = await q;
  return NextResponse.json({ messages: data ?? [] });
}
