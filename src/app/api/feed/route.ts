import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export const dynamic = "force-dynamic";

const WIN_EVENT_TYPES = [
  "project_completed",
  "client_approved",
  "milestone_hit",
  "case_study_published",
];

// GET /api/feed ?tab=all|following|projects|wins &before=<iso> &limit=<n>
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") || "all";
  const before = searchParams.get("before");
  const limitRaw = Number(searchParams.get("limit") || "25");
  const limit = Math.min(Math.max(Math.trunc(limitRaw) || 25, 1), 100);

  let query = supabase
    .from("activity_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (before) {
    const d = new Date(before);
    if (!Number.isNaN(d.getTime())) query = query.lt("created_at", d.toISOString());
  }

  if (tab === "wins") {
    query = query.in("event_type", WIN_EVENT_TYPES);
  } else if (tab === "projects") {
    const { data: myBoards } = await supabase
      .from("project_boards")
      .select("id")
      .eq("user_id", ownerId);
    const ids = (myBoards ?? []).map((b) => b.id);
    if (ids.length === 0) return NextResponse.json({ events: [], cursor: null });
    query = query.in("project_id", ids);
  } else if (tab === "following") {
    const { data: follows } = await supabase
      .from("activity_follows")
      .select("subject_type, subject_id")
      .eq("user_id", user.id);
    const actorIds = (follows ?? []).filter((f) => f.subject_type === "user").map((f) => f.subject_id);
    const projectIds = (follows ?? []).filter((f) => f.subject_type === "project").map((f) => f.subject_id);
    if (actorIds.length === 0 && projectIds.length === 0) {
      return NextResponse.json({ events: [], cursor: null });
    }
    const orParts: string[] = [];
    if (actorIds.length > 0) orParts.push(`actor_id.in.(${actorIds.join(",")})`);
    if (projectIds.length > 0) orParts.push(`project_id.in.(${projectIds.join(",")})`);
    query = query.or(orParts.join(","));
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const events = data ?? [];
  const cursor = events.length === limit ? events[events.length - 1].created_at : null;

  const eventIds = events.map((e) => e.id);
  const actorIds = Array.from(new Set(events.map((e) => e.actor_id).filter(Boolean) as string[]));

  const [{ data: profiles }, { data: reactions }, { data: commentCounts }] = await Promise.all([
    actorIds.length > 0
      ? supabase.from("profiles").select("id, full_name, avatar_url").in("id", actorIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; avatar_url: string | null }[] }),
    eventIds.length > 0
      ? supabase.from("activity_reactions").select("event_id, emoji, user_id").in("event_id", eventIds)
      : Promise.resolve({ data: [] as { event_id: string; emoji: string; user_id: string }[] }),
    eventIds.length > 0
      ? supabase.from("activity_comments").select("event_id").in("event_id", eventIds).is("deleted_at", null)
      : Promise.resolve({ data: [] as { event_id: string }[] }),
  ]);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const reactionMap = new Map<string, Record<string, number>>();
  const reactedByMe = new Map<string, Set<string>>();
  for (const r of reactions ?? []) {
    const bucket = reactionMap.get(r.event_id) ?? {};
    bucket[r.emoji] = (bucket[r.emoji] ?? 0) + 1;
    reactionMap.set(r.event_id, bucket);
    if (r.user_id === user.id) {
      const set = reactedByMe.get(r.event_id) ?? new Set<string>();
      set.add(r.emoji);
      reactedByMe.set(r.event_id, set);
    }
  }
  const commentCountMap = new Map<string, number>();
  for (const c of commentCounts ?? []) {
    commentCountMap.set(c.event_id, (commentCountMap.get(c.event_id) ?? 0) + 1);
  }

  const hydrated = events.map((e) => ({
    ...e,
    actor: e.actor_id ? profileMap.get(e.actor_id) ?? null : null,
    reactions: reactionMap.get(e.id) ?? {},
    my_reactions: Array.from(reactedByMe.get(e.id) ?? []),
    comment_count: commentCountMap.get(e.id) ?? 0,
  }));

  return NextResponse.json({ events: hydrated, cursor });
}
