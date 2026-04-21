import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// GET /api/voice-calls
//
// Paginated list of voice calls for the caller's agency (or, for clients,
// their own profile). Powers the voice-receptionist dashboard call log.
//
// Query params:
//   client_id  — filter to a single client (must belong to caller)
//   limit      — 1..100, default 25
//   offset     — default 0
//
// Returns { calls: [...], stats: { handled, booked, qualified, avg_duration_seconds } }
// computed server-side over the *same* query (so stats match the visible rows).
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("client_id");
  const rawLimit = parseInt(searchParams.get("limit") || "25", 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(100, Math.max(1, rawLimit))
    : 25;
  const rawOffset = parseInt(searchParams.get("offset") || "0", 10);
  const offset = Number.isFinite(rawOffset) ? Math.max(0, rawOffset) : 0;

  const service = createServiceClient();

  // If a client_id is requested, verify it belongs to ownerId.
  if (clientId) {
    const { data: c } = await service
      .from("clients")
      .select("id, profile_id")
      .eq("id", clientId)
      .maybeSingle();
    if (!c || c.profile_id !== ownerId) {
      return NextResponse.json(
        { error: "Client not found or access denied" },
        { status: 403 },
      );
    }
  }

  let query = service
    .from("voice_calls")
    .select(
      "id, profile_id, client_id, twilio_call_sid, eleven_agent_id, from_number, to_number, direction, duration_seconds, status, outcome, transcript, recording_url, started_at, ended_at, created_at, metadata",
      { count: "exact" },
    )
    .eq("profile_id", ownerId)
    .order("started_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (clientId) query = query.eq("client_id", clientId);

  const { data, error, count } = await query;
  if (error) {
    console.error("[voice-calls] list failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Stats across the *unpaginated* query (owner+client filter, any time window
  // — month-level filtering is a UI concern for later).
  let statsQuery = service
    .from("voice_calls")
    .select("duration_seconds, outcome", { count: "exact" })
    .eq("profile_id", ownerId);
  if (clientId) statsQuery = statsQuery.eq("client_id", clientId);
  const { data: statsRows } = await statsQuery;

  const rows = statsRows || [];
  const booked = rows.filter((r) => r.outcome === "booked").length;
  const qualified = rows.filter((r) => r.outcome === "qualified").length;
  const totalDuration = rows.reduce(
    (sum, r) => sum + (r.duration_seconds || 0),
    0,
  );
  const avgDuration = rows.length > 0 ? Math.round(totalDuration / rows.length) : 0;

  return NextResponse.json({
    ok: true,
    calls: data || [],
    total: count ?? 0,
    stats: {
      handled: rows.length,
      booked,
      qualified,
      avg_duration_seconds: avgDuration,
    },
  });
}
