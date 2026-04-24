import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/feed/events/[id]/comments — list active comments for an event.
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: comments, error } = await supabase
    .from("activity_comments")
    .select("id, event_id, author_id, content, created_at, edited_at")
    .eq("event_id", params.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const authorIds = Array.from(new Set((comments ?? []).map((c) => c.author_id).filter(Boolean) as string[]));
  const { data: authors } = authorIds.length
    ? await supabase.from("profiles").select("id, full_name, avatar_url").in("id", authorIds)
    : { data: [] as { id: string; full_name: string | null; avatar_url: string | null }[] };
  const authorMap = new Map((authors ?? []).map((a) => [a.id, a]));

  const hydrated = (comments ?? []).map((c) => ({
    ...c,
    author: c.author_id ? authorMap.get(c.author_id) ?? null : null,
  }));
  return NextResponse.json({ comments: hydrated });
}

// POST /api/feed/events/[id]/comments — add a comment.
// Body: { content: string }
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { content?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return NextResponse.json({ error: "content required" }, { status: 400 });
  if (content.length > 4000) {
    return NextResponse.json({ error: "content too long (max 4000)" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("activity_comments")
    .insert({ event_id: params.id, author_id: user.id, content })
    .select("id, event_id, author_id, content, created_at, edited_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: author } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json({ comment: { ...data, author: author ?? null } }, { status: 201 });
}

// PATCH /api/feed/events/[id]/comments — edit a comment.
// Body: { comment_id, content }
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { comment_id?: unknown; content?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const commentId = typeof body.comment_id === "string" ? body.comment_id : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!commentId) return NextResponse.json({ error: "comment_id required" }, { status: 400 });
  if (!content) return NextResponse.json({ error: "content required" }, { status: 400 });
  if (content.length > 4000) {
    return NextResponse.json({ error: "content too long (max 4000)" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("activity_comments")
    .update({ content, edited_at: new Date().toISOString() })
    .eq("id", commentId)
    .eq("event_id", params.id)
    .eq("author_id", user.id)
    .select("id, event_id, author_id, content, created_at, edited_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ comment: data });
}

// DELETE /api/feed/events/[id]/comments?comment_id=xxx — soft-delete a comment.
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const commentId = request.nextUrl.searchParams.get("comment_id");
  if (!commentId) return NextResponse.json({ error: "comment_id required" }, { status: 400 });

  const { error } = await supabase
    .from("activity_comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId)
    .eq("event_id", params.id)
    .eq("author_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
