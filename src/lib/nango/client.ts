/**
 * Nango server-side client.
 *
 * This is the server-only entry point for talking to Nango (https://nango.dev),
 * the per-tenant OAuth platform that's gradually replacing our DIY OAuth routes
 * for 700+ integrations. The DIY routes (under `src/app/api/oauth/...`) stay
 * in place for rollback during the migration.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Architecture
 * ─────────────────────────────────────────────────────────────────────────
 *
 * - We use ONE singleton `Nango` instance per process, lazily created on
 *   first call. Module-level SDK init is BANNED in this repo (see CLAUDE.md
 *   on the Stripe lazy-init refactor) because it breaks Vercel build during
 *   page-data collection on SDK bumps.
 *
 * - Auth: every call uses the secret key (NANGO_SECRET_KEY). The public key
 *   (NEXT_PUBLIC_NANGO_PUBLIC_KEY) is browser-only — see `./browser.ts`.
 *
 * - Failure mode: fail-closed. If NANGO_SECRET_KEY is missing we throw a
 *   `NangoError` with a clear code so callers can render a sane error.
 *
 * - Connection ID convention: `${user_id}-${integration_id}` (e.g.
 *   `aaaa-bbbb-cccc-google-zanb`). The convention is enforced at the call
 *   site, not here — this module is provider-agnostic.
 */

import { Nango } from "@nangohq/node";

// Re-export shared constants so existing server-side imports from this
// module keep working. Client components must import from ./shared instead.
export { NANGO_INTEGRATIONS, type NangoIntegrationId } from "./shared";

/** Error class for Nango-related failures. Wraps the underlying axios/SDK
 *  error so callers don't need to depend on Nango internals. */
export class NangoError extends Error {
  public readonly code: NangoErrorCode;
  public readonly cause?: unknown;

  constructor(code: NangoErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "NangoError";
    this.code = code;
    this.cause = cause;
  }
}

export type NangoErrorCode =
  | "missing_secret_key"
  | "connection_not_found"
  | "credentials_unavailable"
  | "delete_failed"
  | "list_failed"
  | "unknown";

/** Just-the-tokens shape returned by `getCredentials`. Keeps the call sites
 *  decoupled from Nango's larger connection payload. */
export interface NangoCredentials {
  access_token: string;
  refresh_token: string | null;
  /** ISO-8601 expiry timestamp, or null if Nango doesn't track expiry for
   *  this provider (e.g. long-lived API keys). */
  expires_at: string | null;
  /** Raw provider-returned scope string when available. */
  scope: string | null;
}

let _nango: Nango | null = null;

/** Lazy singleton accessor. Builds the client on first call from
 *  NANGO_SECRET_KEY; subsequent calls return the cached instance. Throws
 *  `NangoError("missing_secret_key", ...)` if the env var is missing — fail
 *  closed. */
export function getNango(): Nango {
  if (_nango) return _nango;

  const secretKey = process.env.NANGO_SECRET_KEY;
  if (!secretKey) {
    throw new NangoError(
      "missing_secret_key",
      "NANGO_SECRET_KEY is not set. Add it in Vercel → Project → Settings → Environment Variables."
    );
  }

  _nango = new Nango({ secretKey });
  return _nango;
}

/** Returns the full Nango connection payload (with refreshed access token).
 *  Use this when you need the metadata too — for credentials only, prefer
 *  `getCredentials()`. */
export async function getConnection(
  integrationId: string,
  connectionId: string,
) {
  try {
    const nango = getNango();
    // forceRefresh=true → Nango refreshes the access token before returning
    // if it's expired or close to expiry. refreshToken=true → also include
    // the refresh token in the response so we can persist it if needed.
    return await nango.getConnection(integrationId, connectionId, true, true);
  } catch (err) {
    throw wrapNangoError("connection_not_found", `Failed to fetch Nango connection ${integrationId}/${connectionId}`, err);
  }
}

/** Returns just the credentials (access_token + refresh_token + expires_at).
 *  This is the workhorse for API-call sites — call this right before hitting
 *  the provider's API and Nango will hand back a fresh access token. */
export async function getCredentials(
  integrationId: string,
  connectionId: string,
): Promise<NangoCredentials> {
  let connection: Awaited<ReturnType<Nango["getConnection"]>>;
  try {
    connection = await getConnection(integrationId, connectionId);
  } catch (err) {
    if (err instanceof NangoError) throw err;
    throw wrapNangoError("credentials_unavailable", `Failed to fetch credentials for ${integrationId}/${connectionId}`, err);
  }

  // Nango's connection.credentials shape varies by auth type. We support the
  // most common ones (OAuth2, API key, basic) by reading defensively rather
  // than narrowing to a single union.
  const creds = (connection as { credentials?: Record<string, unknown> }).credentials || {};
  const accessToken =
    typeof creds.access_token === "string" ? creds.access_token :
    typeof creds.apiKey === "string" ? creds.apiKey :
    null;

  if (!accessToken) {
    throw new NangoError(
      "credentials_unavailable",
      `Nango returned no access_token for ${integrationId}/${connectionId}`,
    );
  }

  return {
    access_token: accessToken,
    refresh_token: typeof creds.refresh_token === "string" ? creds.refresh_token : null,
    expires_at: typeof creds.expires_at === "string" ? creds.expires_at : null,
    scope: typeof creds.scope === "string" ? creds.scope : null,
  };
}

/** Disconnect a tenant from an integration. Nango revokes the upstream
 *  refresh token (where supported) and removes the connection. The caller is
 *  responsible for also cleaning up the corresponding row in
 *  `oauth_connections_nango`. */
export async function deleteConnection(
  integrationId: string,
  connectionId: string,
): Promise<void> {
  try {
    const nango = getNango();
    await nango.deleteConnection(integrationId, connectionId);
  } catch (err) {
    throw wrapNangoError("delete_failed", `Failed to delete Nango connection ${integrationId}/${connectionId}`, err);
  }
}

/** List all integrations a single tenant has connected. The connectionId is
 *  matched as an exact string. Returns Nango's raw connection objects so the
 *  caller can read end-user metadata, dates, etc. */
export async function listConnections(connectionId: string) {
  try {
    const nango = getNango();
    return await nango.listConnections(connectionId);
  } catch (err) {
    throw wrapNangoError("list_failed", `Failed to list Nango connections for ${connectionId}`, err);
  }
}

/** Build the canonical Nango connection ID for a (user, integration) pair.
 *  Centralized so route handlers and the connection-table writers can't drift. */
export function buildConnectionId(userId: string, integrationId: string): string {
  return `${userId}-${integrationId}`;
}

function wrapNangoError(
  code: NangoErrorCode,
  message: string,
  cause: unknown,
): NangoError {
  if (cause instanceof NangoError) return cause;
  const detail = cause instanceof Error ? `: ${cause.message}` : "";
  return new NangoError(code, `${message}${detail}`, cause);
}
