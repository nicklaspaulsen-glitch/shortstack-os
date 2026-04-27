/**
 * Public API — info about the authenticated API key.
 *
 * GET /api/v1/me
 *
 * Returns the user_id, scopes, and rate limit attached to the calling key.
 * Useful for SDKs to verify a token is valid without making a domain call.
 */
import { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/api/auth";
import { ok } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req, { requiredScope: "read" });
  if (!auth.ok) return auth.response;

  return ok({
    user_id: auth.userId,
    api_key_id: auth.apiKeyId,
    scopes: auth.scopes,
    rate_limit_per_minute: auth.rateLimitPerMinute,
  });
}
