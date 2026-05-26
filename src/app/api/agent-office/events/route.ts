import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/agent-office/events?agent_key=lyra&limit=50
 *
 * Paginated events for the side panel. Filters:
 *   • agent_key — required if `since` is omitted; one of the roster keys.
 *   • since     — optional ISO timestamp; rows newer than this are returned.
 *   • limit     — 1..100, default 50.
 *
 * Auth: Supabase JWT cookie. RLS scopes by agency.
 */
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

  const sp = request.nextUrl.searchParams;
  const agentKey = sp.get("agent_key");
  const since = sp.get("since");
  const limitRaw = sp.get("limit");
  const limit = Math.min(
    100,
    Math.max(1, limitRaw ? Number.parseInt(limitRaw, 10) : 50),
  );

  if (!agentKey && !since) {
    return NextResponse.json(
      { error: "Either agent_key or since is required" },
      { status: 400 },
    );
  }

  // Sanitize agentKey: simple kebab/snake/word characters only.
  if (agentKey && !/^[a-z0-9_-]{1,32}$/i.test(agentKey)) {
    return NextResponse.json({ error: "Invalid agent_key" }, { status: 400 });
  }

  let q = supabase
    .from("agent_activity_events")
    .select("id, agent_key, event_type, summary, ref_table, ref_id, metadata, created_at")
    .eq("agency_owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (agentKey) q = q.eq("agent_key", agentKey);
  if (since) q = q.gt("created_at", since);

  const { data, error } = await q;
  if (error) {
    console.error("[agent-office/events] fetch failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({
    events: data ?? [],
    total: (data ?? []).length,
  });
}
