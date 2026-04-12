import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Community API — posts, comments, announcements for client community
// Uses community_posts table in Supabase

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const type = request.nextUrl.searchParams.get("type") || "all";
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "20");

  let query = supabase
    .from("community_posts")
    .select("*, profiles:author_id(full_name, avatar_url, role)")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (type !== "all") {
    query = query.eq("type", type);
  }

  const { data: posts, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get comment counts
  const postIds = (posts || []).map(p => p.id);
  const { data: commentCounts } = await supabase
    .from("community_comments")
    .select("post_id")
    .in("post_id", postIds.length > 0 ? postIds : ["_none"]);

  const countMap: Record<string, number> = {};
  (commentCounts || []).forEach(c => {
    countMap[c.post_id] = (countMap[c.post_id] || 0) + 1;
  });

  const enriched = (posts || []).map(p => ({
    ...p,
    comment_count: countMap[p.id] || 0,
  }));

  return NextResponse.json({ success: true, posts: enriched });
}

// Create a post or comment
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action, ...params } = await request.json();

  if (action === "create_post") {
    const { title, content, type } = params;
    if (!title || !content) return NextResponse.json({ error: "title and content required" }, { status: 400 });

    const { data: post, error } = await supabase
      .from("community_posts")
      .insert({
        author_id: user.id,
        title,
        content,
        type: type || "discussion",
        pinned: false,
        likes: 0,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, post });
  }

  if (action === "create_comment") {
    const { post_id, content } = params;
    if (!post_id || !content) return NextResponse.json({ error: "post_id and content required" }, { status: 400 });

    const { data: comment, error } = await supabase
      .from("community_comments")
      .insert({ post_id, author_id: user.id, content })
      .select("*, profiles:author_id(full_name, avatar_url, role)")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, comment });
  }

  if (action === "get_comments") {
    const { post_id } = params;
    const { data: comments } = await supabase
      .from("community_comments")
      .select("*, profiles:author_id(full_name, avatar_url, role)")
      .eq("post_id", post_id)
      .order("created_at", { ascending: true });

    return NextResponse.json({ success: true, comments: comments || [] });
  }

  if (action === "like_post") {
    const { post_id } = params;
    await supabase.rpc("increment_likes", { post_id_input: post_id }).single();
    return NextResponse.json({ success: true });
  }

  if (action === "pin_post") {
    const { post_id, pinned } = params;
    // Only admins can pin
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return NextResponse.json({ error: "Only admins can pin posts" }, { status: 403 });

    await supabase.from("community_posts").update({ pinned }).eq("id", post_id);
    return NextResponse.json({ success: true });
  }

  if (action === "delete_post") {
    const { post_id } = params;
    const { data: post } = await supabase.from("community_posts").select("author_id").eq("id", post_id).single();
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (post?.author_id !== user.id && profile?.role !== "admin") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    await supabase.from("community_comments").delete().eq("post_id", post_id);
    await supabase.from("community_posts").delete().eq("id", post_id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
