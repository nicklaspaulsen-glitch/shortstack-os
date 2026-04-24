import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/feed/events/[id] — fetch one event with actor, reactions, comments.
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: event, error } = await supabase
    .from("activity_events")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [
    { data: actor },
    { data: reactions },
    { data: comments },
  ] = await Promise.all([
    event.actor_id
      ? supabase.from("profiles").select("id, full_name, avatar_url").eq("id", event.actor_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("activity_reactions").select("emoji, user_id").eq("event_id", params.id),
    supabase
      .from("activity_comments")
      .select("id, event_id, author_id, content, created_at, edited_at")
      .eq("event_id", params.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
  ]);

  const reactionMap: Record<string, number> = {};
  const myReactions: string[] = [];
  for (const r of reactions ?? []) {
    reactionMap[r.emoji] = (reactionMap[r.emoji] ?? 0) + 1;
    if (r.user_id === user.id) myReactions.push(r.emoji);
  }

  const authorIds = Array.from(new Set((comments ?? []).map((c) => c.author_id).filter(Boolean) as string[]));
  const { data: authors } = authorIds.length
    ? await supabase.from("profiles").select("id, full_name, avatar_url").in("id", authorIds)
    : { data: [] as { id: string; full_name: string | null; avatar_url: string | null }[] };
  const authorMap = new Map((authors ?? []).map((a) => [a.id, a]));

  const hydratedComments = (comments ?? []).map((c) => ({
    ...c,
    author: c.author_id ? authorMap.get(c.author_id) ?? null : null,
  }));

  return NextResponse.json({
    event: {
      ...event,
      actor: actor ?? null,
      reactions: reactionMap,
      my_reactions: myReactions,
    },
    comments: hydratedComments,
  });
}

// DELETE /api/feed/events/[id] — remove own event (RLS enforces access).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("activity_events")
    .delete()
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
