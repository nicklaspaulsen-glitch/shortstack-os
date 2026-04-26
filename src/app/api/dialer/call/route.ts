import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

interface CallRequest {
  to: string;
  from?: string;
  contact_name?: string;
  contact_id?: string;
  client_id?: string;
}

// E.164 normaliser — defaults to +1 (US) when caller forgets the prefix.
// We never trust client-supplied phone strings; runs on every dial.
function toE164(raw: string): string | null {
  const cleaned = (raw || "").replace(/[^\d+]/g, "");
  if (cleaned.length < 7 || cleaned.length > 16) return null;
  return cleaned.startsWith("+") ? cleaned : `+1${cleaned}`;
}

// POST /api/dialer/call
// Initiate an outbound voice call from the dialer. Two integration modes:
//
// 1. Browser SDK (preferred, when Twilio Voice SDK is configured): the UI
//    has already created the call client-side via Device.connect(). This
//    endpoint just records the row in voice_calls so the dispositional log
//    matches the live call.
//
// 2. REST API (fallback when client requests `mode=rest`): place an
//    outbound call via Twilio REST so the agent's phone rings, then bridge
//    to the lead. We don't currently use this path from the dialer UI but
//    the route accepts it for parity with the existing voice flow.
//
// Returns the new voice_calls row id (used as the call's local key) so the
// disposition route can update it.
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as CallRequest;
  if (!body.to) {
    return NextResponse.json({ error: "Missing 'to' phone number" }, { status: 400 });
  }

  const toNumber = toE164(body.to);
  if (!toNumber) {
    return NextResponse.json({ error: "Invalid 'to' phone number" }, { status: 400 });
  }

  const fromNumber = body.from ? toE164(body.from) : process.env.TWILIO_DEFAULT_NUMBER || null;

  // Defense-in-depth: if a client_id is supplied, verify caller owns it via
  // service-role lookup. RLS on `clients` would also block it but we want a
  // clean 403 instead of an inscrutable RLS row miss.
  const service = createServiceClient();
  if (body.client_id) {
    const { data: clientRow } = await service
      .from("clients")
      .select("id, profile_id")
      .eq("id", body.client_id)
      .maybeSingle();
    if (!clientRow || clientRow.profile_id !== ownerId) {
      return NextResponse.json({ error: "Client not found or access denied" }, { status: 403 });
    }
  }

  // Idempotency: dialing the same number within 5 seconds reuses the same
  // row. Prevents double-tap UI bugs from creating ghost rows.
  const fiveSecondsAgo = new Date(Date.now() - 5_000).toISOString();
  const { data: recent } = await service
    .from("voice_calls")
    .select("id, started_at")
    .eq("profile_id", ownerId)
    .eq("to_number", toNumber)
    .eq("mode", "manual")
    .gte("started_at", fiveSecondsAgo)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent?.id) {
    return NextResponse.json({
      id: recent.id,
      to: toNumber,
      from: fromNumber,
      reused: true,
    });
  }

  const { data: inserted, error: insertError } = await service
    .from("voice_calls")
    .insert({
      profile_id: ownerId,
      client_id: body.client_id || null,
      from_number: fromNumber,
      to_number: toNumber,
      direction: "outbound",
      status: "ringing",
      outcome: "pending",
      mode: "manual",
      started_at: new Date().toISOString(),
      metadata: {
        via: "dialer",
        contact_name: body.contact_name || null,
        contact_id: body.contact_id || null,
      },
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    console.error("[dialer/call] insert failed:", insertError);
    return NextResponse.json({ error: "Failed to record call" }, { status: 500 });
  }

  return NextResponse.json({
    id: inserted.id,
    to: toNumber,
    from: fromNumber,
    reused: false,
  });
}
