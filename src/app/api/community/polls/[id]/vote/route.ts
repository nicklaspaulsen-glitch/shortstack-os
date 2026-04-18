import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// POST — submit (or change) a user's vote for a poll.
// Body: { option_index: number }
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const optionIndex = Number(body.option_index);
  if (!Number.isInteger(optionIndex) || optionIndex < 0)
    return NextResponse.json(
      { error: "option_index must be a non-negative integer" },
      { status: 400 }
    );

  const { data: poll } = await supabase
    .from("community_polls")
    .select("id, options, ends_at")
    .eq("id", params.id)
    .single();
  if (!poll)
    return NextResponse.json({ error: "Poll not found" }, { status: 404 });

  const opts: string[] = Array.isArray(poll.options) ? poll.options : [];
  if (optionIndex >= opts.length)
    return NextResponse.json(
      { error: "option_index out of range" },
      { status: 400 }
    );

  if (poll.ends_at && new Date(poll.ends_at).getTime() <= Date.now())
    return NextResponse.json(
      { error: "This poll has ended" },
      { status: 410 }
    );

  // Upsert the user's vote (unique constraint on poll_id + user_id ensures one vote per user)
  const { data: existing } = await supabase
    .from("community_poll_votes")
    .select("id")
    .eq("poll_id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("community_poll_votes")
      .update({ option_index: optionIndex })
      .eq("id", existing.id);
  } else {
    await supabase.from("community_poll_votes").insert({
      poll_id: params.id,
      user_id: user.id,
      option_index: optionIndex,
    });
  }

  // Recompute total_votes (cheap: small table, scoped to this poll)
  const { count } = await supabase
    .from("community_poll_votes")
    .select("id", { count: "exact", head: true })
    .eq("poll_id", params.id);
  await supabase
    .from("community_polls")
    .update({ total_votes: count || 0 })
    .eq("id", params.id);

  return NextResponse.json({ success: true, option_index: optionIndex });
}
