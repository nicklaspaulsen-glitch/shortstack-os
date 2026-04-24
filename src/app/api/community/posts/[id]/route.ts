import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { VALID_CHANNELS } from "../route";

/**
 * GET /api/community/posts/[id]
 * Returns { post, reactions, reaction_summary }.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: post, error } = await supabase
    .from("community_posts")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const { data: reactions } = await supabase
    .from("community_reactions")
    .select("emoji, user_id")
    .eq("target_type", "post")
    .eq("target_id", params.id);

  const reaction_summary = aggregateReactions(reactions || [], user.id);

  return NextResponse.json({ post, reactions: reactions || [], reaction_summary });
}

/**
 * PATCH /api/community/posts/[id]
 * Body: { title?, body?, channel?, pinned? }
 * Only the author can edit. `pinned` additionally requires author ownership for now.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: existing } = await supabase
    .from("community_posts")
    .select("user_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }
  if (existing.user_id !== user.id) {
    return NextResponse.json(
      { error: "You can only edit your own posts" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (typeof body.title === "string" && body.title.trim()) {
    updates.title = body.title.trim();
  }
  const content = body.body ?? body.content;
  if (typeof content === "string" && content.trim()) {
    updates.content = content.trim();
  }
  if (
    typeof body.channel === "string" &&
    (VALID_CHANNELS as readonly string[]).includes(body.channel)
  ) {
    updates.channel = body.channel;
  }
  if (typeof body.pinned === "boolean") {
    updates.pinned = body.pinned;
  }

  const { data: post, error } = await supabase
    .from("community_posts")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ post });
}

/**
 * DELETE /api/community/posts/[id]
 * Only the author can delete.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: existing } = await supabase
    .from("community_posts")
    .select("user_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }
  if (existing.user_id !== user.id) {
    return NextResponse.json(
      { error: "You can only delete your own posts" },
      { status: 403 },
    );
  }

  const { error } = await supabase
    .from("community_posts")
    .delete()
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

/**
 * Build a per-emoji reaction summary: { emoji, count, mine }
 */
function aggregateReactions(
  rows: Array<{ emoji: string; user_id: string }>,
  myUserId: string,
) {
  const map = new Map<string, { emoji: string; count: number; mine: boolean }>();
  for (const r of rows) {
    const entry = map.get(r.emoji) || { emoji: r.emoji, count: 0, mine: false };
    entry.count += 1;
    if (r.user_id === myUserId) entry.mine = true;
    map.set(r.emoji, entry);
  }
  return Array.from(map.values());
}
