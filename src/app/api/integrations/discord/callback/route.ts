import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyOAuthState } from "@/lib/oauth-state";

/**
 * Discord OAuth callback for public Trinity bot installs.
 *
 * Discord redirects here with:
 *   ?code=<auth_code>&state=<signed-payload>&guild_id=<guild_id>&permissions=<bitfield>
 *
 * Flow:
 *   1. Verify the HMAC-signed state — rejects forged URLs that could
 *      otherwise stash an attacker-controlled guild against a victim's
 *      user_id.
 *   2. Exchange the auth code for an access/refresh token.
 *   3. Fetch the Discord user (identify scope) and their guilds list.
 *   4. Pick the guild that was just installed into (guild_id from query).
 *   5. Upsert a row into discord_integrations keyed on (user_id, guild_id).
 *   6. Redirect back to /dashboard/integrations?discord=connected.
 *
 * SECURITY (Apr 27): state is now HMAC-signed by /lib/discord-install-url.ts.
 * Prior to this fix, state was a raw user_id which let anyone with a
 * known victim profile_id craft a Discord install URL that would link
 * an attacker-owned guild to the victim's tenant on completion.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const stateStr = params.get("state");
  const guildIdParam = params.get("guild_id");
  const error = params.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work";
  const redirectBack = (suffix: string) =>
    NextResponse.redirect(`${baseUrl}/dashboard/integrations?${suffix}`);

  if (error) return redirectBack(`discord_error=${encodeURIComponent(error)}`);
  if (!code || !stateStr) return redirectBack("discord_error=missing_params");

  const verified = verifyOAuthState(stateStr);
  if (!verified) return redirectBack("discord_error=invalid_state");
  const userId = verified.uid;

  const clientId =
    process.env.DISCORD_CLIENT_ID ||
    process.env.DISCORD_APP_ID ||
    process.env.NEXT_PUBLIC_DISCORD_APP_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return redirectBack("discord_error=not_configured");
  }

  const redirectUri = `${baseUrl}/api/integrations/discord/callback`;

  try {
    // 1. Exchange code for tokens
    const tokenBody = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    });

    const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString(),
    });

    if (!tokenRes.ok) {
      return redirectBack("discord_error=token_exchange_failed");
    }

    const tokenData = (await tokenRes.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      scope?: string;
      guild?: { id: string; name: string; icon?: string | null };
    };

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresAt = new Date(
      Date.now() + (tokenData.expires_in || 604800) * 1000
    ).toISOString();

    // Discord bot installs often return the guild inline in the token response.
    let guild: { id: string; name: string; icon?: string | null } | null =
      tokenData.guild || null;

    // 2. Fall back to guilds list if we didn't get a guild inline.
    if (!guild) {
      const targetGuildId = guildIdParam;
      if (targetGuildId) {
        try {
          const guildsRes = await fetch(
            "https://discord.com/api/v10/users/@me/guilds",
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (guildsRes.ok) {
            const guilds = (await guildsRes.json()) as Array<{
              id: string;
              name: string;
              icon: string | null;
            }>;
            const match = guilds.find((g) => g.id === targetGuildId);
            if (match) guild = match;
          }
        } catch {
          /* ignore */
        }
      }
    }

    if (!guild) {
      return redirectBack("discord_error=no_guild");
    }

    // 3. Upsert the integration row (service client because user session may
    // not be present in this redirect chain).
    const supabase = createServiceClient();
    const { error: upsertErr } = await supabase
      .from("discord_integrations")
      .upsert(
        {
          user_id: userId,
          guild_id: guild.id,
          guild_name: guild.name,
          icon_hash: guild.icon || null,
          access_token: accessToken,
          refresh_token: refreshToken,
          token_expires_at: expiresAt,
          installed_at: new Date().toISOString(),
          notifications_enabled: true,
          installed_bot_id: clientId,
        },
        { onConflict: "user_id,guild_id" }
      );

    if (upsertErr) {
      return redirectBack(
        `discord_error=${encodeURIComponent("db_" + upsertErr.code)}`
      );
    }

    return redirectBack(`discord=connected&guild=${encodeURIComponent(guild.name)}`);
  } catch (err) {
    return redirectBack(
      `discord_error=${encodeURIComponent(String(err).slice(0, 60))}`
    );
  }
}
