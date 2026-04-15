import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/*
  community_posts table schema:

  CREATE TABLE community_posts (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    author_name   text NOT NULL,
    author_avatar text,
    title         text NOT NULL,
    content       text NOT NULL,
    category      text NOT NULL DEFAULT 'discussion'
                  CHECK (category IN ('announcement','discussion','question','resource','showcase')),
    pinned        boolean NOT NULL DEFAULT false,
    likes         integer NOT NULL DEFAULT 0,
    comments_count integer NOT NULL DEFAULT 0,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX idx_community_posts_created ON community_posts (created_at DESC);
  CREATE INDEX idx_community_posts_user    ON community_posts (user_id);
*/

// GET — fetch community posts, ordered pinned-first then newest
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = Math.min(
    100,
    Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") || "50"))
  );

  const { data: posts, error } = await supabase
    .from("community_posts")
    .select("*")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ posts: posts || [] });
}

// POST — create a new community post
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { title, content, category, author_name, author_avatar } = body;

  if (!title?.trim() || !content?.trim())
    return NextResponse.json(
      { error: "title and content are required" },
      { status: 400 }
    );

  const validCategories = [
    "announcement",
    "discussion",
    "question",
    "resource",
    "showcase",
  ];
  const cat = validCategories.includes(category) ? category : "discussion";

  const { data: post, error } = await supabase
    .from("community_posts")
    .insert({
      user_id: user.id,
      author_name: author_name || user.email?.split("@")[0] || "Anonymous",
      author_avatar: author_avatar || null,
      title: title.trim(),
      content: content.trim(),
      category: cat,
      pinned: false,
      likes: 0,
      comments_count: 0,
    })
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ post });
}

// PATCH — update a post (edit, like, pin)
export async function PATCH(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, action, title, content, category, pinned } = body;

  if (!id)
    return NextResponse.json(
      { error: "post id is required" },
      { status: 400 }
    );

  // Like action — increment likes
  if (action === "like") {
    const { data: existing, error: fetchErr } = await supabase
      .from("community_posts")
      .select("likes")
      .eq("id", id)
      .single();

    if (fetchErr || !existing)
      return NextResponse.json({ error: "Post not found" }, { status: 404 });

    const { data: post, error } = await supabase
      .from("community_posts")
      .update({ likes: existing.likes + 1, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ post });
  }

  // Pin action — only post author can pin for now
  if (action === "pin") {
    const { data: post, error } = await supabase
      .from("community_posts")
      .update({ pinned: !!pinned, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ post });
  }

  // Edit action — only the author can edit their post
  const { data: existing } = await supabase
    .from("community_posts")
    .select("user_id")
    .eq("id", id)
    .single();

  if (!existing)
    return NextResponse.json({ error: "Post not found" }, { status: 404 });

  if (existing.user_id !== user.id)
    return NextResponse.json(
      { error: "You can only edit your own posts" },
      { status: 403 }
    );

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (title?.trim()) updates.title = title.trim();
  if (content?.trim()) updates.content = content.trim();
  if (
    category &&
    ["announcement", "discussion", "question", "resource", "showcase"].includes(
      category
    )
  )
    updates.category = category;

  const { data: post, error } = await supabase
    .from("community_posts")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ post });
}

// DELETE — remove a post (only the author can delete)
export async function DELETE(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await request.json();
  if (!id)
    return NextResponse.json(
      { error: "post id is required" },
      { status: 400 }
    );

  // Check ownership
  const { data: existing } = await supabase
    .from("community_posts")
    .select("user_id")
    .eq("id", id)
    .single();

  if (!existing)
    return NextResponse.json({ error: "Post not found" }, { status: 404 });

  if (existing.user_id !== user.id)
    return NextResponse.json(
      { error: "You can only delete your own posts" },
      { status: 403 }
    );

  const { error } = await supabase
    .from("community_posts")
    .delete()
    .eq("id", id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
