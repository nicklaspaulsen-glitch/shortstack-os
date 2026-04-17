import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// PATCH — edit a comment
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { data, error } = await supabase
    .from("community_comments")
    .update({
      content: body.content,
      edited: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, comment: data });
}

// DELETE — remove a comment
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("community_comments")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// POST — toggle like
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check if user already liked
  const { data: existing } = await supabase
    .from("community_comment_likes")
    .select("id")
    .eq("comment_id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("community_comment_likes").delete().eq("id", existing.id);
    // Decrement
    const { data: c } = await supabase.from("community_comments").select("likes").eq("id", params.id).single();
    if (c) await supabase.from("community_comments").update({ likes: Math.max(0, (c.likes || 0) - 1) }).eq("id", params.id);
    return NextResponse.json({ success: true, liked: false });
  } else {
    await supabase.from("community_comment_likes").insert({ comment_id: params.id, user_id: user.id });
    const { data: c } = await supabase.from("community_comments").select("likes").eq("id", params.id).single();
    if (c) await supabase.from("community_comments").update({ likes: (c.likes || 0) + 1 }).eq("id", params.id);
    return NextResponse.json({ success: true, liked: true });
  }
}
