import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/integrations/discord/channels?integration_id=<id>
 * Returns the text channels for the integration's guild. Uses the bot token
 * (not the user's OAuth token) since the bot is already in the guild and has
 * VIEW_CHANNEL permission.
 */
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const integrationId = request.nextUrl.searchParams.get("integration_id");
  if (!integrationId) {
    return NextResponse.json({ error: "Missing integration_id" }, { status: 400 });
  }

  const { data: integration, error } = await supabase
    .from("discord_integrations")
    .select("guild_id")
    .eq("id", integrationId)
    .eq("user_id", user.id)
    .single();

  if (error || !integration) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ channels: [], error: "DISCORD_BOT_TOKEN not configured" });
  }

  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${integration.guild_id}/channels`,
      { headers: { Authorization: `Bot ${botToken}` } }
    );
    if (!res.ok) {
      return NextResponse.json(
        { channels: [], error: `Discord returned ${res.status}` },
        { status: 200 }
      );
    }
    const channels = (await res.json()) as Array<{
      id: string;
      name: string;
      type: number;
      parent_id?: string | null;
    }>;
    // Type 0 = GUILD_TEXT, Type 5 = GUILD_ANNOUNCEMENT
    const textChannels = channels
      .filter((c) => c.type === 0 || c.type === 5)
      .map((c) => ({ id: c.id, name: c.name, type: c.type }));
    return NextResponse.json({ channels: textChannels });
  } catch (err) {
    return NextResponse.json(
      { channels: [], error: String(err) },
      { status: 200 }
    );
  }
}
