import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// GET — list bookmarked posts for the user
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("community_bookmarks")
    .select("post_id, created_at")
    .eq("user_id", user.id);

  return NextResponse.json({ bookmarks: data || [] });
}

// POST — toggle bookmark
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { post_id } = await req.json();
  if (!post_id) return NextResponse.json({ error: "post_id required" }, { status: 400 });

  const { data: existing } = await supabase
    .from("community_bookmarks")
    .select("id")
    .eq("post_id", post_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("community_bookmarks").delete().eq("id", existing.id);
    return NextResponse.json({ success: true, bookmarked: false });
  }
  await supabase.from("community_bookmarks").insert({ post_id, user_id: user.id });
  return NextResponse.json({ success: true, bookmarked: true });
}
