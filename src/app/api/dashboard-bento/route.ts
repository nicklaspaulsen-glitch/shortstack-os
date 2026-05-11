import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

/**
 * GET /api/dashboard-bento
 *
 * Bento-grid tile data for the redesigned dashboard home (Phase 2B).
 * Each block in the response maps to a tile in the editorial-bento layout.
 *
 *   - hero       — derived "hero moment" (most interesting headline)
 *   - kpis       — 4-card strip (pipeline, leads-this-week, deals, MRR)
 *   - recentCalls   — last 5 voice_calls
 *   - recentEmails  — last 5 outreach_log email rows
 *   - hotLeads      — top 8 leads by score
 *   - schedule      — today's scheduled posts + upcoming meetings
 *   - agentEvents   — last 30 agent_activity_events
 *
 * Each block is best-effort. A failed sub-query falls back to an empty
 * array so the UI can render its empty state instead of a 500.
 *
 * Auth: Supabase JWT cookie. RLS-scoped via `getEffectiveOwnerId`.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface VoiceCallRow {
  id: string;
  duration_seconds: number | null;
  from_number: string | null;
  to_number: string | null;
  started_at: string;
  outcome: string | null;
}

interface OutreachEmailRow {
  id: string;
  recipient: string | null;
  subject: string | null;
  status: string;
  sent_at: string;
}

interface HotLeadRow {
  id: string;
  business_name: string | null;
  industry: string | null;
  lead_score: number | null;
  scraped_at: string | null;
  status: string | null;
}

interface ScheduledItem {
  id: string;
  kind: "post" | "meeting" | "calendar";
  title: string;
  scheduled_at: string;
  detail: string | null;
}

interface AgentEventRow {
  id: string;
  agent_key: string;
  event_type: string;
  summary: string;
  ref_table: string | null;
  ref_id: string | null;
  created_at: string;
}

interface KpiBlock {
  pipelineValue: number;
  leadsThisWeek: number;
  dealsWonThisMonth: number;
  mrr: number;
  pipelineSpark: number[];
  leadsSpark: number[];
  dealsSpark: number[];
  mrrSpark: number[];
}

interface OwnerProfile {
  firstName: string;
  avatarUrl: string | null;
  planTier: string | null;
  clientCount: number;
  mrr: number;
}

interface BentoResponse {
  ownerId: string;
  hero: {
    headline: string;
    subhead: string;
    progressPct: number; // 0..100
    cta: { label: string; href: string };
  };
  kpis: KpiBlock;
  profile: OwnerProfile;
  recentCalls: VoiceCallRow[];
  recentEmails: OutreachEmailRow[];
  hotLeads: HotLeadRow[];
  schedule: ScheduledItem[];
  agentEvents: AgentEventRow[];
  microStats: { calls: number; leads: number; hot: number };
}

export async function GET() {
  const supabase = createServerSupabase();

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const todayIso = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const weekAgoIso = new Date(Date.now() - 7 * 86400000).toISOString();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  // outreach_log doesn't carry user_id directly — scope via owned leads/clients.
  const service = createServiceClient();
  const [{ data: ownedLeads }, { data: ownedClients }] = await Promise.all([
    service.from("leads").select("id").eq("user_id", ownerId),
    service.from("clients").select("id").eq("profile_id", ownerId),
  ]);
  const ownedLeadIds = (ownedLeads || []).map((l) => l.id as string);
  const ownedClientIds = (ownedClients || []).map((c) => c.id as string);
  const outreachOwnershipFilters: string[] = [];
  if (ownedLeadIds.length > 0) outreachOwnershipFilters.push(`lead_id.in.(${ownedLeadIds.join(",")})`);
  if (ownedClientIds.length > 0) outreachOwnershipFilters.push(`client_id.in.(${ownedClientIds.join(",")})`);
  const outreachOrFilter =
    outreachOwnershipFilters.length > 0
      ? outreachOwnershipFilters.join(",")
      : "id.eq.00000000-0000-0000-0000-000000000000";

  // Helper: run a Supabase query and return only the data array, falling
  // back to an empty list on any error. Supabase queries are PromiseLike,
  // not full Promises, so we await them inside a Promise wrapper to get
  // standard `.catch()` semantics.
  async function safeRows<T>(builder: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
    try {
      const { data } = await builder;
      return data ?? [];
    } catch {
      return [];
    }
  }

  // Run every block in parallel. Each safeRows() failure returns [] so the
  // page can render the empty-state for that tile rather than a 500.
  const [
    callsResult,
    emailsResult,
    hotLeadsResult,
    eventsResult,
    scheduledPostsResult,
    meetingsResult,
    pipelineNewCount,
    pipelineCalledCount,
    pipelineRepliedCount,
    pipelineBookedCount,
    leadsThisWeekCount,
    dealsThisMonthCount,
    activeClientsResult,
    callsTodayCount,
    leadsTodayCount,
    hotLeadsTodayCount,
    ownerProfileResult,
  ] = await Promise.all([
    safeRows<VoiceCallRow>(
      supabase
        .from("voice_calls")
        .select("id, duration_seconds, from_number, to_number, started_at, outcome")
        .eq("profile_id", ownerId)
        .order("started_at", { ascending: false })
        .limit(5),
    ),

    safeRows<OutreachEmailRow>(
      supabase
        .from("outreach_log")
        .select("id, recipient, subject, status, sent_at")
        .or(outreachOrFilter)
        .eq("platform", "email")
        .order("sent_at", { ascending: false })
        .limit(5),
    ),

    safeRows<HotLeadRow>(
      supabase
        .from("leads")
        .select("id, business_name, industry, lead_score, scraped_at, status")
        .eq("user_id", ownerId)
        .not("lead_score", "is", null)
        .order("lead_score", { ascending: false })
        .limit(8),
    ),

    safeRows<AgentEventRow>(
      supabase
        .from("agent_activity_events")
        .select("id, agent_key, event_type, summary, ref_table, ref_id, created_at")
        .eq("agency_owner_id", ownerId)
        .order("created_at", { ascending: false })
        .limit(30),
    ),

    safeRows<{ id: string; content: string | null; platform: string | null; scheduled_for: string }>(
      supabase
        .from("scheduled_posts")
        .select("id, content, platform, scheduled_for")
        .eq("user_id", ownerId)
        .gte("scheduled_for", todayIso)
        .lte("scheduled_for", new Date(Date.now() + 86400000).toISOString())
        .order("scheduled_for", { ascending: true })
        .limit(8),
    ),

    safeRows<{ id: string; title: string | null; scheduled_at: string; duration_seconds: number | null }>(
      supabase
        .from("meetings")
        .select("id, title, scheduled_at, duration_seconds")
        .eq("created_by", ownerId)
        .gte("scheduled_at", todayIso)
        .lte("scheduled_at", new Date(Date.now() + 86400000).toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(6),
    ),

    supabase.from("leads").select("*", { count: "exact", head: true }).eq("user_id", ownerId).eq("status", "new"),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("user_id", ownerId).eq("status", "called"),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("user_id", ownerId).eq("status", "replied"),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("user_id", ownerId).eq("status", "booked"),

    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("user_id", ownerId)
      .gte("scraped_at", weekAgoIso),

    supabase
      .from("deals")
      .select("*", { count: "exact", head: true })
      .eq("user_id", ownerId)
      .eq("status", "won")
      .gte("created_at", monthStart),

    safeRows<{ mrr: number | null }>(
      supabase.from("clients").select("mrr").eq("profile_id", ownerId).eq("is_active", true),
    ),

    supabase
      .from("voice_calls")
      .select("*", { count: "exact", head: true })
      .eq("profile_id", ownerId)
      .gte("started_at", todayIso),

    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("user_id", ownerId)
      .gte("scraped_at", todayIso),

    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("user_id", ownerId)
      .gte("lead_score", 80),

    supabase
      .from("profiles")
      .select("full_name, avatar_url, plan_tier")
      .eq("id", ownerId)
      .single(),
  ]);

  const calls = callsResult;
  const emails = emailsResult;
  const hotLeads = hotLeadsResult;
  const events = eventsResult;
  const posts = scheduledPostsResult;
  const meetings = meetingsResult;
  const activeClients = activeClientsResult;

  // Combine schedule items
  const schedule: ScheduledItem[] = [
    ...posts.map((p) => ({
      id: p.id,
      kind: "post" as const,
      title: (p.content || "Scheduled post").slice(0, 60),
      scheduled_at: p.scheduled_for,
      detail: p.platform,
    })),
    ...meetings.map((m) => ({
      id: m.id,
      kind: "meeting" as const,
      title: m.title || "Meeting",
      scheduled_at: m.scheduled_at,
      detail: m.duration_seconds ? `${Math.round(m.duration_seconds / 60)}m` : null,
    })),
  ].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()).slice(0, 8);

  // KPIs — derive from the parallel queries, then synthesize tiny sparkline
  // arrays from agent_activity_events grouped by day. The sparklines are
  // *trends*, not exact values — purely for visual signal in the StatCard.
  const pipelineValue =
    (pipelineNewCount.count || 0) +
    (pipelineCalledCount.count || 0) +
    (pipelineRepliedCount.count || 0) +
    (pipelineBookedCount.count || 0);
  const leadsThisWeek = leadsThisWeekCount.count || 0;
  const dealsWonThisMonth = dealsThisMonthCount.count || 0;
  const mrr = activeClients.reduce((sum, c) => sum + (c.mrr || 0), 0);

  const sparkBuckets = bucketEventsByDay(events, 7);
  const kpis: KpiBlock = {
    pipelineValue,
    leadsThisWeek,
    dealsWonThisMonth,
    mrr,
    pipelineSpark: sparkBuckets.map((d) => d.events),
    leadsSpark: sparkBuckets.map((d) => d.leadEvents),
    dealsSpark: sparkBuckets.map((d) => d.dealEvents),
    mrrSpark: sparkBuckets.map((d) => Math.round(mrr * (0.85 + d.events / Math.max(...sparkBuckets.map((b) => b.events), 1) * 0.15))),
  };

  // Hero moment — pick the most narratively interesting derived stat.
  const callsToday = callsTodayCount.count || 0;
  const leadsToday = leadsTodayCount.count || 0;
  const hotLeadsCount = hotLeadsTodayCount.count || 0;

  const hero = pickHero({
    pipelineValue,
    leadsToday,
    callsToday,
    hotLeadsCount,
    repliesThisWeek: emails.filter((e) => e.status === "replied").length,
    dealsWonThisMonth,
  });

  const ownerFullName = ownerProfileResult.data?.full_name ?? "";
  const ownerProfile: OwnerProfile = {
    firstName: ownerFullName.split(" ")[0] || "You",
    avatarUrl: ownerProfileResult.data?.avatar_url ?? null,
    planTier: ownerProfileResult.data?.plan_tier ?? null,
    clientCount: activeClients.length,
    mrr,
  };

  const response: BentoResponse = {
    ownerId,
    hero,
    kpis,
    profile: ownerProfile,
    recentCalls: calls,
    recentEmails: emails,
    hotLeads,
    schedule,
    agentEvents: events,
    microStats: {
      calls: callsToday,
      leads: leadsToday,
      hot: hotLeadsCount,
    },
  };

  return NextResponse.json(response);
}

/**
 * Bucket agent events into N daily buckets ending today. Returns a tiny
 * synthetic series suitable for sparkline rendering.
 */
function bucketEventsByDay(
  events: AgentEventRow[],
  days: number,
): Array<{ events: number; leadEvents: number; dealEvents: number }> {
  const now = Date.now();
  const buckets: Array<{ events: number; leadEvents: number; dealEvents: number }> = Array.from(
    { length: days },
    () => ({ events: 0, leadEvents: 0, dealEvents: 0 }),
  );
  for (const ev of events) {
    const t = new Date(ev.created_at).getTime();
    const ageDays = Math.floor((now - t) / 86400000);
    if (ageDays < 0 || ageDays >= days) continue;
    const idx = days - 1 - ageDays;
    buckets[idx].events += 1;
    if (ev.ref_table === "leads" || ev.ref_table === "lead_scores") buckets[idx].leadEvents += 1;
    if (ev.ref_table === "deals") buckets[idx].dealEvents += 1;
  }
  return buckets;
}

interface HeroInput {
  pipelineValue: number;
  leadsToday: number;
  callsToday: number;
  hotLeadsCount: number;
  repliesThisWeek: number;
  dealsWonThisMonth: number;
}

interface HeroOutput {
  headline: string;
  subhead: string;
  progressPct: number;
  cta: { label: string; href: string };
}

/**
 * Picks the most narratively interesting derived stat for the hero tile.
 * Order of preference: hot leads streak > deal momentum > reply velocity >
 * lead capture > calls > pipeline volume > onboarding nudge.
 */
function pickHero(input: HeroInput): HeroOutput {
  if (input.hotLeadsCount >= 3) {
    return {
      headline: `${input.hotLeadsCount} hot leads waiting`,
      subhead: "These prospects scored 80+ — call them today before the score decays.",
      progressPct: Math.min(100, input.hotLeadsCount * 10),
      cta: { label: "View hot leads", href: "/dashboard/leads?filter=hot" },
    };
  }
  if (input.dealsWonThisMonth >= 1) {
    return {
      headline: `${input.dealsWonThisMonth} deal${input.dealsWonThisMonth === 1 ? "" : "s"} won this month`,
      subhead: "Momentum is real. Keep the outreach engine warm so next month compounds.",
      progressPct: Math.min(100, input.dealsWonThisMonth * 20),
      cta: { label: "View pipeline", href: "/dashboard/pipeline" },
    };
  }
  if (input.repliesThisWeek >= 3) {
    return {
      headline: `Hot streak: ${input.repliesThisWeek} replies this week`,
      subhead: "Conversations are landing. Reply within an hour to lock the close.",
      progressPct: Math.min(100, input.repliesThisWeek * 8),
      cta: { label: "Open inbox", href: "/dashboard/conversations" },
    };
  }
  if (input.leadsToday >= 5) {
    return {
      headline: `${input.leadsToday} new leads today`,
      subhead: "Fresh prospects in the funnel — start scoring and routing them now.",
      progressPct: Math.min(100, input.leadsToday * 5),
      cta: { label: "Score leads", href: "/dashboard/leads" },
    };
  }
  if (input.callsToday >= 1) {
    return {
      headline: `${input.callsToday} call${input.callsToday === 1 ? "" : "s"} today`,
      subhead: "Voice agents are running. Review transcripts to find the next move.",
      progressPct: Math.min(100, input.callsToday * 12),
      cta: { label: "Review calls", href: "/dashboard/voice-receptionist" },
    };
  }
  if (input.pipelineValue >= 10) {
    return {
      headline: `${input.pipelineValue} leads in motion`,
      subhead: "Your pipeline is staffed. Time to push the highest-score prospects to outreach.",
      progressPct: Math.min(100, input.pipelineValue),
      cta: { label: "View pipeline", href: "/dashboard/pipeline" },
    };
  }
  return {
    headline: "A clean slate is rare",
    subhead: "Connect a lead source or run a scrape to start filling the pipeline.",
    progressPct: 0,
    cta: { label: "Find leads", href: "/dashboard/scraper" },
  };
}
