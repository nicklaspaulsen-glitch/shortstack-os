import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/community/users?q=foo
 * Returns a small candidate list of profiles whose nickname or full_name
 * matches the prefix — used to power the @mention autocomplete in comments.
 */
export async function GET(req: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  // Empty query returns most-recently-seen active posters so the picker
  // still has useful suggestions before the user starts typing.
  if (!q) {
    const { data: recent } = await supabase
      .from("community_posts")
      .select("user_id, author_name, author_avatar")
      .order("created_at", { ascending: false })
      .limit(40);
    const seen = new Set<string>();
    const users = (recent || []).filter((r: { user_id: string }) => {
      if (seen.has(r.user_id)) return false;
      seen.add(r.user_id);
      return true;
    }).slice(0, 10).map((r: {
      user_id: string;
      author_name: string;
      author_avatar: string | null;
    }) => ({
      id: r.user_id,
      handle: toHandle(r.author_name),
      display_name: r.author_name,
      avatar_url: r.author_avatar,
    }));
    return NextResponse.json({ users });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, nickname, full_name, avatar_url")
    .or(`nickname.ilike.${q}%,full_name.ilike.${q}%`)
    .limit(10);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const users = (data || []).map((p: {
    id: string;
    nickname: string | null;
    full_name: string | null;
    avatar_url: string | null;
  }) => ({
    id: p.id,
    handle: toHandle(p.nickname || p.full_name || ""),
    display_name: p.nickname || p.full_name || "Member",
    avatar_url: p.avatar_url,
  }));

  return NextResponse.json({ users });
}

function toHandle(raw: string): string {
  if (!raw) return "member";
  const first = raw.split(" ")[0] || raw;
  return first.toLowerCase().replace(/[^a-z0-9._-]/g, "");
}
