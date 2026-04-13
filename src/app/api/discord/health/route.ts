import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

const API = "https://discord.com/api/v10";
const GUILD_ID = "1492845816514347121";

interface ChannelInfo {
  id: string;
  name: string;
  type: number;
  position: number;
  permission_overwrites: Array<{
    id: string;
    type: number;
    allow: string;
    deny: string;
  }>;
}

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check admin
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) return NextResponse.json({ error: "DISCORD_BOT_TOKEN not configured" }, { status: 500 });

  const results: {
    bot_online: boolean;
    guild_found: boolean;
    guild_name: string;
    member_count: number;
    channels: Array<{
      name: string;
      type: string;
      id: string;
      writable_by_everyone: boolean;
      bot_only: boolean;
    }>;
    roles: Array<{ name: string; id: string; members: number }>;
    errors: string[];
  } = {
    bot_online: false,
    guild_found: false,
    guild_name: "",
    member_count: 0,
    channels: [],
    roles: [],
    errors: [],
  };

  try {
    // Test bot token — get bot user
    const botRes = await fetch(`${API}/users/@me`, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (botRes.ok) {
      results.bot_online = true;
    } else {
      results.errors.push("Bot token invalid or expired");
      return NextResponse.json(results);
    }

    // Get guild info
    const guildRes = await fetch(`${API}/guilds/${GUILD_ID}?with_counts=true`, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (guildRes.ok) {
      const guild = await guildRes.json();
      results.guild_found = true;
      results.guild_name = guild.name;
      results.member_count = guild.approximate_member_count || 0;
    } else {
      results.errors.push("Bot cannot access guild — check if bot is in the server");
      return NextResponse.json(results);
    }

    // Get channels
    const channelsRes = await fetch(`${API}/guilds/${GUILD_ID}/channels`, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (channelsRes.ok) {
      const channels: ChannelInfo[] = await channelsRes.json();

      // Get roles to find @everyone role
      const rolesRes = await fetch(`${API}/guilds/${GUILD_ID}/roles`, {
        headers: { Authorization: `Bot ${botToken}` },
      });
      const roles = rolesRes.ok ? await rolesRes.json() : [];
      const everyoneRoleId = GUILD_ID; // @everyone role ID equals guild ID

      results.roles = roles.map((r: { name: string; id: string }) => ({
        name: r.name,
        id: r.id,
        members: 0,
      }));

      for (const ch of channels) {
        const typeName = ch.type === 0 ? "text" : ch.type === 2 ? "voice" : ch.type === 4 ? "category" : `type-${ch.type}`;

        if (ch.type === 4) continue; // Skip categories

        // Check @everyone permissions on this channel
        const everyoneOverwrite = ch.permission_overwrites?.find(
          (o) => o.id === everyoneRoleId
        );

        // SEND_MESSAGES permission bit is 0x800 (2048)
        const SEND_MESSAGES = BigInt(0x800);
        const denyBits = BigInt(everyoneOverwrite?.deny || "0");
        const allowBits = BigInt(everyoneOverwrite?.allow || "0");

        const sendDenied = (denyBits & SEND_MESSAGES) !== BigInt(0);
        const sendAllowed = (allowBits & SEND_MESSAGES) !== BigInt(0);

        // If SEND_MESSAGES is denied for @everyone, the channel is read-only for regular users
        const botOnly = sendDenied && !sendAllowed;
        const writableByEveryone = !sendDenied;

        results.channels.push({
          name: ch.name,
          type: typeName,
          id: ch.id,
          writable_by_everyone: writableByEveryone,
          bot_only: botOnly,
        });
      }
    } else {
      results.errors.push("Cannot fetch channels");
    }
  } catch (err) {
    results.errors.push(`API error: ${String(err)}`);
  }

  return NextResponse.json(results);
}
