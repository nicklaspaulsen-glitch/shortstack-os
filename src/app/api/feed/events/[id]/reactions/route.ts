import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["👍", "🔥", "❤️", "🎉", "💡", "🚀"]);

// POST /api/feed/events/[id]/reactions — toggle a reaction for the caller.
// Body: { emoji: string }
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { emoji?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const emoji = typeof body.emoji === "string" ? body.emoji : "";
  if (!ALLOWED.has(emoji)) {
    return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });
  }

  // Check existing.
  const { data: existing } = await supabase
    .from("activity_reactions")
    .select("event_id")
    .eq("event_id", params.id)
    .eq("user_id", user.id)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("activity_reactions")
      .delete()
      .eq("event_id", params.id)
      .eq("user_id", user.id)
      .eq("emoji", emoji);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ emoji, active: false });
  } else {
    const { error } = await supabase
      .from("activity_reactions")
      .insert({ event_id: params.id, user_id: user.id, emoji });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ emoji, active: true });
  }
}
