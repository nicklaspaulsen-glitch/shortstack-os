import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/*
  community_polls — see migration 20260418_community_events_polls_resources.sql
  Per-option vote counts are derived by aggregating community_poll_votes.
*/

// GET — list active polls (ends_at null or in future).
// Each poll is enriched with per-option counts and the caller's vote (if any).
export async function GET() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const nowIso = new Date().toISOString();
  const { data: polls, error } = await supabase
    .from("community_polls")
    .select("*")
    .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
    .order("created_at", { ascending: false });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (polls || []).map((p) => p.id);
  if (ids.length === 0) return NextResponse.json({ polls: [] });

  const { data: votes } = await supabase
    .from("community_poll_votes")
    .select("poll_id, user_id, option_index")
    .in("poll_id", ids);

  const tallies = new Map<string, Map<number, number>>();
  const myVote = new Map<string, number>();
  for (const v of votes || []) {
    if (!tallies.has(v.poll_id)) tallies.set(v.poll_id, new Map());
    const m = tallies.get(v.poll_id)!;
    m.set(v.option_index, (m.get(v.option_index) || 0) + 1);
    if (v.user_id === user.id) myVote.set(v.poll_id, v.option_index);
  }

  const enriched = (polls || []).map((p) => {
    const opts: string[] = Array.isArray(p.options) ? p.options : [];
    const counts = tallies.get(p.id) || new Map<number, number>();
    let total = 0;
    const optionCounts = opts.map((label, i) => {
      const votes = counts.get(i) || 0;
      total += votes;
      return { label, votes };
    });
    return {
      ...p,
      option_counts: optionCounts,
      total_votes: total,
      my_vote: myVote.get(p.id) ?? null,
    };
  });

  return NextResponse.json({ polls: enriched });
}

// POST — create a new poll
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { question, options, ends_at } = body;

  if (!question?.trim())
    return NextResponse.json({ error: "question is required" }, { status: 400 });

  if (!Array.isArray(options) || options.length < 2)
    return NextResponse.json(
      { error: "at least 2 options are required" },
      { status: 400 }
    );

  const cleanOptions = options
    .map((o: unknown) => (typeof o === "string" ? o.trim() : ""))
    .filter((o: string) => o.length > 0);

  if (cleanOptions.length < 2)
    return NextResponse.json(
      { error: "at least 2 non-empty options are required" },
      { status: 400 }
    );

  const { data: poll, error } = await supabase
    .from("community_polls")
    .insert({
      user_id: user.id,
      question: question.trim(),
      options: cleanOptions,
      ends_at: ends_at || null,
      total_votes: 0,
    })
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ poll });
}
