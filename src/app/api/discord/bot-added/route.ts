import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyOAuthState } from "@/lib/oauth-state";

// Webhook called after Discord OAuth redirect when a bot is added to a guild.
// Discord redirects with ?code=...&guild_id=...&state=<signed-payload>
//
// SECURITY: state is HMAC-signed by /lib/discord-install-url.ts
// (signOAuthState({ client_id: userId, uid: userId, platform: "discord" })).
// Pre-Apr 27 this was a raw user_id, which let anyone craft a URL with
// ?state=<victim_id>&guild_id=<attacker_guild> to register an attacker-
// controlled guild against a victim's profile_id, polluting the victim's
// dashboard and routing inbound webhook events to the wrong tenant.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const guildId = searchParams.get("guild_id");
  const stateStr = searchParams.get("state");
  const code = searchParams.get("code");

  if (!guildId || !stateStr) {
    return NextResponse.redirect(new URL("/dashboard/discord?error=missing_params", request.url));
  }

  const verified = verifyOAuthState(stateStr);
  if (!verified) {
    return NextResponse.redirect(new URL("/dashboard/discord?error=invalid_state", request.url));
  }
  const profileId = verified.uid;

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
      profile_id: profileId,
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
