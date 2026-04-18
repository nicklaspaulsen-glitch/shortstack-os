import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Returns a Discord OAuth invite URL that adds the bot to a server.
// Permissions: Manage Roles, Send Messages, Embed Links, Read Message History,
// Manage Messages, Kick Members, Ban Members, Manage Channels, Add Reactions
// Bitfield = 1 (CREATE_INSTANT_INVITE) + 2 (KICK) + 4 (BAN) + 16 (MANAGE_CHANNELS)
//          + 268435456 (MANAGE_ROLES) + 2048 (SEND_MESSAGES) + 16384 (EMBED_LINKS)
//          + 65536 (READ_MESSAGE_HISTORY) + 8192 (MANAGE_MESSAGES) + 64 (ADD_REACTIONS)
const PERMISSIONS_BITFIELD = "268954166";

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const appId = process.env.DISCORD_APP_ID || process.env.NEXT_PUBLIC_DISCORD_APP_ID;
  if (!appId) {
    return NextResponse.json({
      error: "DISCORD_APP_ID not configured",
      instructions: "Set DISCORD_APP_ID env var (from your Discord app settings).",
    }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const trackingId = searchParams.get("tracking") || user.id;

  const scope = encodeURIComponent("bot applications.commands");
  const state = encodeURIComponent(trackingId);

  const url =
    `https://discord.com/oauth2/authorize?client_id=${appId}` +
    `&permissions=${PERMISSIONS_BITFIELD}` +
    `&scope=${scope}` +
    `&state=${state}`;

  return NextResponse.json({ invite_url: url, tracking: trackingId });
}
