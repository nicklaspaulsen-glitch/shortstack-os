/**
 * GET /api/outreach/conversations/[contactId]
 *
 * Returns the full event timeline for a single contact (oldest → newest)
 * along with an AI-generated thread summary suitable for the top-of-thread
 * card. Mixes voice_calls, outreach_log, and conversation_messages.
 *
 * Query params:
 *   kind - "lead" (default) or "client" (for clients with no lead row)
 *
 * The portal version (used by clients) is gated by the `client_id` of the
 * portal user — they can only fetch threads for contacts under their own
 * client_id. That filter is enforced at this route and again inside the
 * aggregator via RLS.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { verifyClientAccess } from "@/lib/verify-client-access";
import { getThread } from "@/lib/outreach/aggregator";
import { getOrComputeThreadSummary } from "@/lib/outreach/thread-summary";
import type { ContactKind } from "@/lib/outreach/types";

interface RouteContext {
  params: { contactId: string };
}

function parseKind(value: string | null): ContactKind {
  return value === "client" ? "client" : "lead";
}

export async function GET(request: NextRequest, context: RouteContext) {
  const contactId = context.params?.contactId;
  if (!contactId) {
    return NextResponse.json({ error: "Missing contact id" }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Resolve effective owner (admin/team_member → agency owner; client → self).
  const access = await verifyClientAccess(supabase, user.id);
  if (access.denied) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const kind = parseKind(url.searchParams.get("kind"));

  try {
    const { events, contact } = await getThread(supabase, ownerId, kind, contactId);

    // Portal scope: client role can only see threads tied to their own client_id.
    if (access.role === "client") {
      const allowedClientId = access.clientId;
      if (!contact || contact.client_id !== allowedClientId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const summary = await getOrComputeThreadSummary(
      supabase,
      ownerId,
      kind,
      contactId,
      events,
      contact?.name || "Contact",
    );

    return NextResponse.json({ events, contact, summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Thread load failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
