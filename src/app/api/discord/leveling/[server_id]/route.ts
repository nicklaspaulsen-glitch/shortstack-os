import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

const LEVELING_FIELDS = new Set([
  "enabled",
  "xp_per_message",
  "xp_cooldown_seconds",
  "level_up_message",
  "role_rewards",
]);

async function assertOwnsServer(serverId: string, userId: string) {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("discord_servers")
    .select("id")
    .eq("id", serverId)
    .eq("profile_id", userId)
    .maybeSingle();
  return !!data;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { server_id: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { server_id } = params;
  if (!(await assertOwnsServer(server_id, user.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [configRes, leaderboardRes] = await Promise.all([
    supabase.from("discord_leveling_config").select("*").eq("server_id", server_id).maybeSingle(),
    supabase
      .from("discord_levels")
      .select("user_id, username, avatar_url, xp, level, messages_count")
      .eq("server_id", server_id)
      .order("xp", { ascending: false })
      .limit(10),
  ]);

  return NextResponse.json({
    config: configRes.data || {
      enabled: true,
      xp_per_message: 15,
      xp_cooldown_seconds: 60,
      level_up_message: "Congrats {{user}}, you reached level {{level}}!",
      role_rewards: [],
    },
    leaderboard: leaderboardRes.data || [],
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { server_id: string } }
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { server_id } = params;
  if (!(await assertOwnsServer(server_id, user.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  // Allowlist prevents mass assignment — only known leveling config columns
  // are forwarded. server_id always comes from the authenticated path param.
  const safeBody = Object.fromEntries(
    Object.entries(body as Record<string, unknown>).filter(([k]) => LEVELING_FIELDS.has(k))
  );
  const { data, error } = await supabase
    .from("discord_leveling_config")
    .upsert({ server_id, ...safeBody, updated_at: new Date().toISOString() }, { onConflict: "server_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  return NextResponse.json({ config: data });
}
