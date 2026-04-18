import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Webhook called after Discord OAuth redirect when a bot is added to a guild.
// Discord redirects with ?code=...&guild_id=...&state=<profile_id>
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const guildId = searchParams.get("guild_id");
  const state = searchParams.get("state");
  const code = searchParams.get("code");

  if (!guildId || !state) {
    return NextResponse.redirect(new URL("/dashboard/discord?error=missing_params", request.url));
  }

  const supabase = createServiceClient();
  const botToken = process.env.DISCORD_BOT_TOKEN;

  let guildName = "";
  let guildIcon: string | null = null;
  let memberCount = 0;

  if (botToken) {
    try {
      const r = await fetch(`https://discord.com/api/v10/guilds/${guildId}?with_counts=true`, {
        headers: { Authorization: `Bot ${botToken}` },
      });
      if (r.ok) {
        const g = await r.json();
        guildName = g.name || "";
        guildIcon = g.icon || null;
        memberCount = g.approximate_member_count || 0;
      }
    } catch { /* ignore */ }
  }

  const { data: server } = await supabase
    .from("discord_servers")
    .upsert({
      profile_id: state,
      guild_id: guildId,
      guild_name: guildName,
      guild_icon: guildIcon,
      member_count: memberCount,
      status: "active",
    }, { onConflict: "guild_id" })
    .select()
    .single();

  if (server) {
    await Promise.all([
      supabase.from("discord_leveling_config").upsert({ server_id: server.id }, { onConflict: "server_id" }),
      supabase.from("discord_welcome_config").upsert({ server_id: server.id }, { onConflict: "server_id" }),
      supabase.from("discord_moderation").upsert({ server_id: server.id }, { onConflict: "server_id" }),
      supabase.from("discord_audit_log").insert({
        server_id: server.id,
        event_type: "bot_added",
        actor: "system",
        details: { code_present: !!code },
      }),
    ]);
  }

  return NextResponse.redirect(new URL(`/dashboard/discord?added=${guildId}`, request.url));
}
