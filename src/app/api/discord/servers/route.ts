import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// GET: list servers for current user
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("discord_servers")
    .select("*")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Optionally enrich from Discord API
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const enriched = await Promise.all((data || []).map(async (s) => {
    if (!botToken || !s.guild_id) return s;
    try {
      const r = await fetch(`https://discord.com/api/v10/guilds/${s.guild_id}?with_counts=true`, {
        headers: { Authorization: `Bot ${botToken}` },
      });
      if (r.ok) {
        const g = await r.json();
        return {
          ...s,
          guild_name: g.name || s.guild_name,
          guild_icon: g.icon || s.guild_icon,
          member_count: g.approximate_member_count ?? s.member_count,
        };
      }
    } catch { /* ignore */ }
    return s;
  }));

  return NextResponse.json({ servers: enriched });
}

// POST: add/upsert a server (used after bot is added to a guild)
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { guild_id, guild_name, guild_icon, member_count } = body;
  if (!guild_id) return NextResponse.json({ error: "guild_id required" }, { status: 400 });

  const { data, error } = await supabase
    .from("discord_servers")
    .upsert({
      profile_id: user.id,
      guild_id,
      guild_name,
      guild_icon,
      member_count: member_count || 0,
      status: "active",
    }, { onConflict: "guild_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Create default config rows
  await Promise.all([
    supabase.from("discord_leveling_config").upsert({ server_id: data.id }, { onConflict: "server_id" }),
    supabase.from("discord_welcome_config").upsert({ server_id: data.id }, { onConflict: "server_id" }),
    supabase.from("discord_moderation").upsert({ server_id: data.id }, { onConflict: "server_id" }),
  ]);

  return NextResponse.json({ server: data });
}

// PATCH: update a server (status, settings, features_enabled)
export async function PATCH(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ...patch } = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data, error } = await supabase
    .from("discord_servers")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("profile_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ server: data });
}

// DELETE: remove a server connection
export async function DELETE(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase
    .from("discord_servers")
    .delete()
    .eq("id", id)
    .eq("profile_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
