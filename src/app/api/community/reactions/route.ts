import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const ALLOWED_EMOJIS = [
  "\u{1F44D}", // thumbs up
  "\u{2764}\u{FE0F}", // red heart
  "\u{1F389}", // party popper
  "\u{1F680}", // rocket
  "\u{1F440}", // eyes
  "\u{1F914}", // thinking face
];

/**
 * GET /api/community/reactions?target_type=post&target_id=UUID
 * Returns reactions + summary for a single target.
 */
export async function GET(req: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const target_type = req.nextUrl.searchParams.get("target_type");
  const target_id = req.nextUrl.searchParams.get("target_id");
  if (!target_type || !target_id || !["post", "comment"].includes(target_type)) {
    return NextResponse.json(
      { error: "target_type (post|comment) and target_id are required" },
      { status: 400 },
    );
  }

  const { data: reactions, error } = await supabase
    .from("community_reactions")
    .select("emoji, user_id")
    .eq("target_type", target_type)
    .eq("target_id", target_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    reactions: reactions || [],
    summary: aggregate(reactions || [], user.id),
  });
}

/**
 * POST /api/community/reactions
 * Body: { target_type: "post" | "comment", target_id: UUID, emoji: string }
 * Toggles the reaction: if the user already has that emoji on that target, it
 * is removed; otherwise it is added. Maintains the denormalized reaction_count
 * on community_posts / community_comments.
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { target_type, target_id, emoji } = body as {
    target_type?: string;
    target_id?: string;
    emoji?: string;
  };

  if (
    !target_type ||
    !target_id ||
    !emoji ||
    !["post", "comment"].includes(target_type)
  ) {
    return NextResponse.json(
      { error: "target_type (post|comment), target_id, emoji are required" },
      { status: 400 },
    );
  }

  // Defensive allowlist — keep the reaction set curated so the sidebar widget
  // doesn't have to cope with arbitrary emoji.
  if (!ALLOWED_EMOJIS.includes(emoji)) {
    return NextResponse.json(
      { error: "Unsupported emoji" },
      { status: 400 },
    );
  }

  const { data: existing } = await supabase
    .from("community_reactions")
    .select("id")
    .eq("target_type", target_type)
    .eq("target_id", target_id)
    .eq("user_id", user.id)
    .eq("emoji", emoji)
    .maybeSingle();

  const targetTable = target_type === "post"
    ? "community_posts"
    : "community_comments";

  if (existing) {
    // toggle off
    await supabase.from("community_reactions").delete().eq("id", existing.id);
    const { data: row } = await supabase
      .from(targetTable)
      .select("reaction_count")
      .eq("id", target_id)
      .maybeSingle();
    if (row) {
      await supabase
        .from(targetTable)
        .update({ reaction_count: Math.max(0, (row.reaction_count || 0) - 1) })
        .eq("id", target_id);
    }
    return NextResponse.json({ reacted: false, emoji });
  }

  const { error: insertErr } = await supabase
    .from("community_reactions")
    .insert({
      target_type,
      target_id,
      user_id: user.id,
      emoji,
    });
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  const { data: row } = await supabase
    .from(targetTable)
    .select("reaction_count")
    .eq("id", target_id)
    .maybeSingle();
  if (row) {
    await supabase
      .from(targetTable)
      .update({ reaction_count: (row.reaction_count || 0) + 1 })
      .eq("id", target_id);
  }

  return NextResponse.json({ reacted: true, emoji });
}

function aggregate(
  rows: Array<{ emoji: string; user_id: string }>,
  myUserId: string,
) {
  const map = new Map<string, { emoji: string; count: number; mine: boolean }>();
  for (const r of rows) {
    const e = map.get(r.emoji) || { emoji: r.emoji, count: 0, mine: false };
    e.count += 1;
    if (r.user_id === myUserId) e.mine = true;
    map.set(r.emoji, e);
  }
  return Array.from(map.values());
}
