import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/community/mentions
 *   ?only_unseen=1       — filter to unseen mentions
 *   ?limit=50            — cap results (default 50)
 *
 * Returns the current user's mentions, newest first.
 */
export async function GET(req: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const onlyUnseen = req.nextUrl.searchParams.get("only_unseen") === "1";
  const limit = Math.min(
    100,
    Math.max(
      1,
      parseInt(req.nextUrl.searchParams.get("limit") || "50", 10) || 50,
    ),
  );

  let query = supabase
    .from("community_mentions")
    .select("*")
    .eq("mentioned_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (onlyUnseen) {
    query = query.is("seen_at", null);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Count unseen separately so the header badge doesn't have to pull everything.
  const { count } = await supabase
    .from("community_mentions")
    .select("id", { count: "exact", head: true })
    .eq("mentioned_user_id", user.id)
    .is("seen_at", null);

  return NextResponse.json({ mentions: data || [], unseen: count || 0 });
}

/**
 * PATCH /api/community/mentions
 * Body: { id?: string, all?: true }
 * Marks one or all of the current user's mentions as seen.
 */
export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const nowIso = new Date().toISOString();

  if (body.all) {
    const { error } = await supabase
      .from("community_mentions")
      .update({ seen_at: nowIso })
      .eq("mentioned_user_id", user.id)
      .is("seen_at", null);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, marked: "all" });
  }

  if (body.id) {
    const { error } = await supabase
      .from("community_mentions")
      .update({ seen_at: nowIso })
      .eq("id", body.id)
      .eq("mentioned_user_id", user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, marked: body.id });
  }

  return NextResponse.json(
    { error: "Provide { id } or { all: true }" },
    { status: 400 },
  );
}
