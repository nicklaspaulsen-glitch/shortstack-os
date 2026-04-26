/**
 * Google Ads API client backed by Nango credentials.
 *
 * This is the new code path — the legacy direct-OAuth path under
 * `src/app/api/integrations/google-ads/route.ts` reads access tokens from the
 * `social_accounts` table. That path is intentionally NOT removed in this PR
 * so we keep a rollback option.
 *
 * Usage:
 *
 *   import { getGoogleAdsAccessToken } from "@/lib/ads/google-ads-nango-client";
 *
 *   const token = await getGoogleAdsAccessToken(userId);
 *   const headers = await googleAdsHeaders(userId);
 *   // ... fetch from googleads.googleapis.com with `headers`
 *
 * Notes:
 *
 * - Nango refreshes the access token transparently. Always call this right
 *   before making the API request — don't cache the returned token.
 *
 * - We require `GOOGLE_ADS_DEVELOPER_TOKEN` (a separate Google-side
 *   developer-program credential, not the OAuth token). This is unrelated to
 *   the Nango migration and stays in env vars exactly like before.
 *
 * - Touching Nango from a route handler can raise `NangoError`. Callers
 *   should catch and surface a 5xx with a useful message.
 */

import {
  NANGO_INTEGRATIONS,
  buildConnectionId,
  getCredentials,
} from "@/lib/nango/client";

const INTEGRATION_ID = NANGO_INTEGRATIONS.GOOGLE_ADS;

/** Returns a fresh access token for the given user's Google Ads connection.
 *  Throws `NangoError` if the user hasn't connected, Nango is misconfigured,
 *  or the upstream refresh fails. */
export async function getGoogleAdsAccessToken(userId: string): Promise<string> {
  const connectionId = buildConnectionId(userId, INTEGRATION_ID);
  const creds = await getCredentials(INTEGRATION_ID, connectionId);
  return creds.access_token;
}

/** Returns the standard Google Ads API request headers for a given user. The
 *  developer-token env var is required (and is intentionally distinct from
 *  the OAuth token Nango manages — it identifies the OAuth client to Google
 *  Ads, not the user). */
export async function googleAdsHeaders(
  userId: string,
  loginCustomerId?: string,
): Promise<Record<string, string>> {
  const accessToken = await getGoogleAdsAccessToken(userId);
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!devToken) {
    throw new Error(
      "GOOGLE_ADS_DEVELOPER_TOKEN is not set. Add it in Vercel → Settings → Environment Variables.",
    );
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": devToken,
    "Content-Type": "application/json",
  };

  if (loginCustomerId) {
    headers["login-customer-id"] = loginCustomerId.replace(/-/g, "");
  }

  return headers;
}
