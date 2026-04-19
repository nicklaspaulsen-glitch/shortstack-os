import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { buildDiscordInstallUrl } from "@/lib/discord-install-url";

/** Returns the Discord bot install URL for the authenticated user. */
export async function GET() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = buildDiscordInstallUrl({ userId: user.id });
  if (!url) {
    return NextResponse.json(
      {
        error: "DISCORD_CLIENT_ID not configured",
        instructions:
          "Set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET in Vercel env vars (from your Discord application in the Developer Portal).",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ install_url: url });
}
