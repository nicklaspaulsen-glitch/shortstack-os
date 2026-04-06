import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Create a Discord server for a client using the Discord Bot API
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { server_name, client_id, channels } = await request.json();

  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) return NextResponse.json({ error: "Discord bot not configured. Add DISCORD_BOT_TOKEN." }, { status: 500 });

  try {
    // Create guild (server)
    const guildRes = await fetch("https://discord.com/api/v10/guilds", {
      method: "POST",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: server_name || "ShortStack Client Server",
        channels: (channels || [
          { name: "welcome", type: 0 },
          { name: "announcements", type: 0 },
          { name: "content-approvals", type: 0 },
          { name: "deliverables", type: 0 },
          { name: "support", type: 0 },
          { name: "general", type: 0 },
          { name: "Voice Chat", type: 2 },
        ]).map((ch: { name: string; type: number }) => ({ name: ch.name, type: ch.type })),
      }),
    });

    const guild = await guildRes.json();

    if (guild.id) {
      // Log it
      await supabase.from("trinity_log").insert({
        action_type: "custom",
        description: `Discord server created: ${server_name} (${guild.id})`,
        client_id: client_id || null,
        status: "completed",
        result: { guild_id: guild.id, name: guild.name, channels: guild.channels?.length },
      });

      // Create invite link
      const defaultChannel = guild.channels?.find((ch: { type: number }) => ch.type === 0);
      let inviteUrl = "";
      if (defaultChannel) {
        const inviteRes = await fetch(`https://discord.com/api/v10/channels/${defaultChannel.id}/invites`, {
          method: "POST",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ max_age: 0, max_uses: 0 }),
        });
        const invite = await inviteRes.json();
        if (invite.code) inviteUrl = `https://discord.gg/${invite.code}`;
      }

      return NextResponse.json({
        success: true,
        guild_id: guild.id,
        name: guild.name,
        invite_url: inviteUrl,
        channels: guild.channels?.length || 0,
      });
    }

    return NextResponse.json({ error: guild.message || "Failed to create server", details: guild }, { status: 500 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
