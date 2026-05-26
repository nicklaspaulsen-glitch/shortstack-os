/**
 * GET /api/outreach/conversations
 *
 * Returns the per-contact conversation list for the agency owner. Each
 * row aggregates voice_calls + outreach_log + conversation_messages and
 * surfaces the latest interaction's body, channel, direction, outcome,
 * and unread count.
 *
 * Query params:
 *   q          - free-text contact search
 *   client_id  - filter to a specific client (used by the portal)
 *   channel    - filter by channel: voice_call|email|sms|dm
 *   limit      - default 50, max 200
 *   offset     - pagination offset
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { verifyClientAccess } from "@/lib/verify-client-access";
import { listConversations } from "@/lib/outreach/aggregator";
import type { OutreachChannel } from "@/lib/outreach/types";

const VALID_CHANNELS = new Set<OutreachChannel>(["voice_call", "email", "sms", "dm"]);

function parseChannel(value: string | null): OutreachChannel | null {
  if (!value) return null;
  return VALID_CHANNELS.has(value as OutreachChannel) ? (value as OutreachChannel) : null;
}

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Resolve role + own client (for portal scope) up front.
  const access = await verifyClientAccess(supabase, user.id);
  if (access.denied) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  const requestedClientId = url.searchParams.get("client_id");
  const channel = parseChannel(url.searchParams.get("channel"));
  const limit = Math.min(Number(url.searchParams.get("limit") || "50"), 200);
  const offset = Number(url.searchParams.get("offset") || "0");

  // Portal scope: clients can only see their own conversations. We force
  // the client_id filter regardless of what they passed, so a tampered
  // query string can't surface another tenant's data.
  let effectiveClientId: string | null = null;
  if (access.role === "client") {
    if (!access.clientId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    effectiveClientId = access.clientId;
  } else if (requestedClientId) {
    effectiveClientId = requestedClientId;
  }

  try {
    const conversations = await listConversations(supabase, ownerId, {
      q,
      client_id: effectiveClientId,
      channel,
      limit,
      offset,
    });
    return NextResponse.json({ conversations });
  } catch (err) {
    const msg = "Aggregator failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
