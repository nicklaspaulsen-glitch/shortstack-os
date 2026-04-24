import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export const dynamic = "force-dynamic";

// GET /api/feed/summary/weekly
//   ?org_id=<uuid>&cron_secret=<secret>  (internal/cron)
//   OR with session cookie (logged-in user → uses their effective org)
// Returns 7-day activity aggregate: total events, by_type, top contributors,
// and top-10 highlight events (most reactions/comments).
export async function GET(request: NextRequest) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const url = new URL(request.url);
  const cronSecret = url.searchParams.get("cron_secret");
  const orgIdParam = url.searchParams.get("org_id");

  let supabase: ReturnType<typeof createServiceClient>;
  let orgId: string | null = null;

  if (cronSecret && cronSecret === process.env.CRON_SECRET && orgIdParam) {
    supabase = createServiceClient();
    orgId = orgIdParam;
  } else {
    const userSupabase = createServerSupabase();
    const { data: { user } } = await userSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    orgId = (await getEffectiveOwnerId(userSupabase, user.id)) || user.id;
    supabase = userSupabase as unknown as ReturnType<typeof createServiceClient>;
  }

  if (!orgId) return NextResponse.json({ error: "org_id required" }, { status: 400 });

  const { data: events, error } = await supabase
    .from("activity_events")
    .select("id, event_type, actor_id, subject_preview, created_at")
    .eq("org_id", orgId)
    .gte("created_at", since);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const total = events?.length ?? 0;
  const byType: Record<string, number> = {};
  const byActor: Record<string, number> = {};
  for (const e of events ?? []) {
    byType[e.event_type] = (byType[e.event_type] ?? 0) + 1;
    if (e.actor_id) byActor[e.actor_id] = (byActor[e.actor_id] ?? 0) + 1;
  }

  const contributorIds = Object.entries(byActor)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id);

  const { data: contributorProfiles } = contributorIds.length
    ? await supabase.from("profiles").select("id, full_name, avatar_url").in("id", contributorIds)
    : { data: [] as { id: string; full_name: string | null; avatar_url: string | null }[] };
  const profMap = new Map((contributorProfiles ?? []).map((p) => [p.id, p]));
  const contributors = contributorIds.map((id) => ({
    id,
    count: byActor[id],
    profile: profMap.get(id) ?? null,
  }));

  // Highlights: score by reactions+comments count in the window.
  const eventIds = (events ?? []).map((e) => e.id);
  const [{ data: reactions }, { data: comments }] = await Promise.all([
    eventIds.length
      ? supabase.from("activity_reactions").select("event_id").in("event_id", eventIds)
      : Promise.resolve({ data: [] as { event_id: string }[] }),
    eventIds.length
      ? supabase.from("activity_comments").select("event_id").in("event_id", eventIds).is("deleted_at", null)
      : Promise.resolve({ data: [] as { event_id: string }[] }),
  ]);
  const score: Record<string, number> = {};
  for (const r of reactions ?? []) score[r.event_id] = (score[r.event_id] ?? 0) + 1;
  for (const c of comments ?? []) score[c.event_id] = (score[c.event_id] ?? 0) + 2;

  const highlights = (events ?? [])
    .map((e) => ({ ...e, score: score[e.id] ?? 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return NextResponse.json({
    since,
    total,
    by_type: byType,
    contributors,
    highlights,
  });
}
