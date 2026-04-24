import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { recordMentions } from "@/lib/community/mentions";

export const VALID_CHANNELS = [
  "announcements",
  "wins",
  "questions",
  "feedback",
  "off-topic",
] as const;

export type CommunityChannel = (typeof VALID_CHANNELS)[number];

function normalizeChannel(input: string | null | undefined): CommunityChannel {
  if (input && (VALID_CHANNELS as readonly string[]).includes(input)) {
    return input as CommunityChannel;
  }
  return "announcements";
}

/**
 * GET /api/community/posts
 *   ?channel=wins       — filter to a single channel
 *   ?limit=50           — cap results (1-100, default 50)
 *   ?since=ISO          — only posts created after ISO
 *
 * Returns { posts: [...] } ordered pinned-first then newest first.
 */
export async function GET(req: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const channel = req.nextUrl.searchParams.get("channel");
  const limitParam = req.nextUrl.searchParams.get("limit");
  const since = req.nextUrl.searchParams.get("since");

  const limit = Math.min(
    100,
    Math.max(1, parseInt(limitParam || "50", 10) || 50),
  );

  let query = supabase
    .from("community_posts")
    .select("*")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (channel && (VALID_CHANNELS as readonly string[]).includes(channel)) {
    query = query.eq("channel", channel);
  }
  if (since) {
    query = query.gt("created_at", since);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ posts: data || [] });
}

/**
 * POST /api/community/posts
 * Body: { title, body, channel }
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
  const title = (body.title || "").trim();
  // Accept either "body" (new contract) or "content" (legacy) as the markdown body.
  const content = (body.body || body.content || "").trim();
  const channel = normalizeChannel(body.channel);

  if (!title || !content) {
    return NextResponse.json(
      { error: "title and body are required" },
      { status: 400 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, nickname, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const author_name =
    profile?.nickname ||
    profile?.full_name ||
    user.email?.split("@")[0] ||
    "Member";
  const author_avatar = profile?.avatar_url || null;

  const { data: post, error } = await supabase
    .from("community_posts")
    .insert({
      user_id: user.id,
      author_name,
      author_avatar,
      title,
      content,
      channel,
      // Keep legacy "category" populated so the old feed page keeps rendering.
      category: "discussion",
      pinned: false,
      likes: 0,
      comments_count: 0,
      reaction_count: 0,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Best-effort @mention fan-out (never blocks the post create).
  try {
    await recordMentions({
      supabase,
      authorId: user.id,
      authorName: author_name,
      body: content,
      postId: post?.id ?? null,
      link: `/dashboard/community/${post?.id}`,
      context: title,
    });
  } catch {
    /* ignore */
  }

  return NextResponse.json({ post });
}
