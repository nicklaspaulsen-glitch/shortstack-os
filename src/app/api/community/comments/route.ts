import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { recordMentions } from "@/lib/community/mentions";

// GET ?post_id=xxx — fetch comments for a post (threaded)
export async function GET(req: NextRequest) {
  const supabase = createServerSupabase();
  const post_id = req.nextUrl.searchParams.get("post_id");
  if (!post_id) return NextResponse.json({ error: "post_id required" }, { status: 400 });

  const { data, error } = await supabase
    .from("community_comments")
    .select("*")
    .eq("post_id", post_id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ comments: [], error: error.message });
  return NextResponse.json({ comments: data || [] });
}

// POST — create a new comment
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { post_id, content, parent_id } = body;
  if (!post_id || !content?.trim()) {
    return NextResponse.json({ error: "post_id and content required" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, nickname, avatar_url")
    .eq("id", user.id)
    .single();

  const { data, error } = await supabase
    .from("community_comments")
    .insert({
      post_id,
      parent_id: parent_id || null,
      user_id: user.id,
      author_name: profile?.nickname || profile?.full_name || "Member",
      author_avatar: profile?.avatar_url || null,
      content: content.trim(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Increment the post's comments_count (safe fail)
  try {
    await supabase.rpc("increment_post_comments", { p_post_id: post_id });
  } catch {
    // RPC may not exist — try a direct update
    const { data: p } = await supabase.from("community_posts").select("comments_count").eq("id", post_id).single();
    if (p) {
      await supabase.from("community_posts").update({ comments_count: (p.comments_count || 0) + 1 }).eq("id", post_id);
    }
  }

  // Resolve @mentions and notify mentioned users. Best-effort — never blocks
  // the comment insert from succeeding.
  try {
    const { data: parentPost } = await supabase
      .from("community_posts")
      .select("title")
      .eq("id", post_id)
      .maybeSingle();
    await recordMentions({
      supabase,
      authorId: user.id,
      authorName: profile?.nickname || profile?.full_name || "Someone",
      body: content,
      commentId: data?.id ?? null,
      postId: post_id,
      link: `/dashboard/community/${post_id}`,
      context: parentPost?.title || undefined,
    });
  } catch {
    /* ignore — mentions are optional */
  }

  return NextResponse.json({ success: true, comment: data });
}
