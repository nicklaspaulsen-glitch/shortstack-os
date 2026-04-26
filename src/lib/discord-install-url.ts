/**
 * Discord bot install URL generator.
 *
 * Builds the OAuth authorization URL that other agencies click to install the
 * Trinity bot into their own Discord server. Uses the `bot` + `applications.commands`
 * + `identify` + `guilds` scopes so we can:
 *   - bot: actually add the bot to the target guild
 *   - applications.commands: register slash commands (/trinity-status etc.)
 *   - identify: know which user ran the install (to link to our profile)
 *   - guilds: list the user's guilds so they can pick which one to connect
 *
 * Permissions bitfield rationale (kept minimal):
 *   - SEND_MESSAGES (2048)
 *   - EMBED_LINKS (16384)
 *   - VIEW_CHANNEL (1024)
 *   - READ_MESSAGE_HISTORY (65536)
 *   - USE_APPLICATION_COMMANDS (2147483648)
 * Total = 2147566720
 *
 * SECURITY: state is HMAC-signed via signOAuthState so the callbacks
 * (/api/integrations/discord/callback and /api/discord/bot-added) can
 * verify it was issued by us and reject forged URLs that claim to belong
 * to a victim's user_id. See src/lib/oauth-state.ts.
 */

import { signOAuthState } from "./oauth-state";

const PERMISSIONS_MINIMAL = "2147566720";

export interface DiscordInstallUrlOptions {
  /** The profile.id of the user initiating the install (passed through via state) */
  userId: string;
  /** Base URL of the app (defaults to NEXT_PUBLIC_APP_URL) */
  baseUrl?: string;
  /** Override the Discord app/client ID (defaults to env) */
  clientId?: string;
  /** Override redirect URI path */
  redirectPath?: string;
}

/**
 * Returns the Discord OAuth install URL, or null if DISCORD_CLIENT_ID is missing.
 */
export function buildDiscordInstallUrl(opts: DiscordInstallUrlOptions): string | null {
  const clientId =
    opts.clientId ||
    process.env.DISCORD_CLIENT_ID ||
    process.env.DISCORD_APP_ID ||
    process.env.NEXT_PUBLIC_DISCORD_APP_ID;

  if (!clientId) return null;

  const baseUrl =
    opts.baseUrl ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://app.shortstack.work";

  const redirectPath = opts.redirectPath || "/api/integrations/discord/callback";
  const redirectUri = `${baseUrl}${redirectPath}`;

  const scope = "bot applications.commands identify guilds";
  // Sign the state so the callback can verify it was issued by us. Each user
  // owns their own Discord integration (no separate client tenant), so we use
  // the same userId for both client_id and uid in the signed payload.
  const state = signOAuthState({
    client_id: opts.userId,
    uid: opts.userId,
    platform: "discord",
  });
  const params = new URLSearchParams({
    client_id: clientId,
    scope,
    permissions: PERMISSIONS_MINIMAL,
    response_type: "code",
    redirect_uri: redirectUri,
    state,
    // prompt=consent forces the consent screen so the user always sees the guild picker.
    prompt: "consent",
  });

  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

/**
 * Just the permissions bitfield we request — exported so UI can explain it.
 */
export const DISCORD_INSTALL_PERMISSIONS = PERMISSIONS_MINIMAL;

export const DISCORD_INSTALL_SCOPES = [
  "bot",
  "applications.commands",
  "identify",
  "guilds",
] as const;
