import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { AGENTS } from "@/lib/pixel-office/agents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/agent-office/snapshot
 *
 * Initial hydration data for the pixel office page. Returns:
 *   • ownerId — effective agency owner (so the React client knows which
 *     realtime channel partition to subscribe to without leaking the
 *     team_member resolution into the browser).
 *   • agents — the static roster (echoed back so the page can render
 *     even before importing the lib).
 *   • recentEvents — last 30 across all agents (powers the global feed).
 *   • byAgent — last 10 per agent (powers each agent's side panel).
 *   • stats — small set of "today" counters for the hero.
 *   • online — workspace presence rows so the rail can show "X online".
 *
 * Auth: Supabase JWT cookie. RLS on `agent_activity_events` already
 * enforces visibility for team_members; the bare `agency_owner_id` filter
 * here is the owner-resolution path for owners.
 */
export async function GET() {
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

  // Recent events — we cap at 200 rows so the per-agent slicing is cheap
  // and we don't overfetch on a busy agency.
  const { data: events, error: eventsErr } = await supabase
    .from("agent_activity_events")
    .select("id, agent_key, event_type, summary, ref_table, ref_id, metadata, created_at")
    .eq("agency_owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (eventsErr) {
    console.error("[agent-office/snapshot] events fetch failed", eventsErr);
  }

  const recentEvents = (events ?? []).slice(0, 30);
  const byAgent: Record<
    string,
    Array<{
      id: string;
      summary: string;
      ref_table: string | null;
      ref_id: string | null;
      created_at: string;
      event_type: string;
    }>
  > = {};
  for (const agent of AGENTS) byAgent[agent.key] = [];
  for (const ev of events ?? []) {
    const list = byAgent[ev.agent_key];
    if (list && list.length < 10) {
      list.push({
        id: ev.id,
        summary: ev.summary,
        ref_table: ev.ref_table,
        ref_id: ev.ref_id,
        created_at: ev.created_at,
        event_type: ev.event_type,
      });
    }
  }

  // Stats — small, parallel queries. Each is best-effort; a single failed
  // counter doesn't break the page (we just return 0).
  const todayIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const stats = await collectStats(supabase, ownerId, todayIso);

  // Online presence — best-effort, table may not exist on every project.
  const online = await collectOnline(supabase, ownerId);

  return NextResponse.json({
    ownerId,
    agents: AGENTS.map((a) => ({
      key: a.key,
      name: a.name,
      role: a.role,
      brand: `#${a.brandColor.toString(16).padStart(6, "0")}`,
    })),
    recentEvents,
    byAgent,
    stats,
    online,
  });
}

interface SbCounter {
  count: number | null;
}

async function collectStats(
  supabase: ReturnType<typeof createServerSupabase>,
  ownerId: string,
  sinceIso: string,
): Promise<{
  callsToday: number;
  leadsScored: number;
  emailsSent: number;
  proposalsExecuted: number;
  contentPosted: number;
  thumbnailsRendered: number;
}> {
  // We deliberately don't `await Promise.all` to keep individual error
  // handling clean — these are tiny count queries and the latency cost of
  // sequencing is negligible vs the readability win.
  const calls = await safeCount(supabase, "voice_calls", ownerId, sinceIso);
  const leads = await safeCount(supabase, "lead_scores", ownerId, sinceIso);
  const emails = await safeCount(supabase, "outreach_log", ownerId, sinceIso);
  const proposals = await safeCount(
    supabase,
    "trinity_actions",
    ownerId,
    sinceIso,
  );
  const content = await safeCount(supabase, "scheduled_posts", ownerId, sinceIso);
  const thumbs = await safeCount(supabase, "thumbnail_jobs", ownerId, sinceIso);

  return {
    callsToday: calls,
    leadsScored: leads,
    emailsSent: emails,
    proposalsExecuted: proposals,
    contentPosted: content,
    thumbnailsRendered: thumbs,
  };
}

async function safeCount(
  supabase: ReturnType<typeof createServerSupabase>,
  table: string,
  ownerId: string,
  sinceIso: string,
): Promise<number> {
  try {
    const { count } = (await supabase
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("agency_owner_id", ownerId)
      .gte("created_at", sinceIso)) as SbCounter;
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function collectOnline(
  supabase: ReturnType<typeof createServerSupabase>,
  ownerId: string,
): Promise<{ online_at: string; presence_ref?: string }[]> {
  try {
    // workspace_presence may or may not be present in every environment.
    // Soft-fail to an empty list so the rail still renders.
    const { data } = await supabase
      .from("workspace_presence")
      .select("user_id, last_seen_at")
      .eq("agency_owner_id", ownerId)
      .gte("last_seen_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());
    return (data ?? []).map((row, i) => ({
      online_at: (row as { last_seen_at: string }).last_seen_at,
      presence_ref: `${(row as { user_id: string }).user_id}-${i}`,
    }));
  } catch {
    return [];
  }
}
