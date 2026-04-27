/**
 * Public API Bearer-token authentication.
 *
 * Pattern:
 *   import { authenticateApiKey, type ApiAuthContext } from "@/lib/api/auth";
 *
 *   export async function GET(req: NextRequest) {
 *     const auth = await authenticateApiKey(req, { requiredScope: "read" });
 *     if (!auth.ok) return auth.response;
 *     // auth.userId is the owner profile id; auth.scopes is the granted scope set
 *     ...
 *   }
 *
 * Token format:  ss_live_<32 random hex chars>
 *   - Stored in DB as SHA-256 hex hash, never plaintext.
 *   - Prefix `ss_live_` (8 chars) is also stored for display.
 *   - The full key is shown to the user ONCE at creation time.
 *
 * Auth flow:
 *   1. Read Authorization header. Must be `Bearer ss_live_<...>`.
 *   2. Hash and look up `api_keys` row by hash, scoped to non-revoked, non-expired.
 *   3. Check requested scope against granted scopes.
 *   4. Apply per-key rate limit.
 *   5. Update `last_used_at` (fire-and-forget; never blocks the request).
 */
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

export type ApiScope = "read" | "write" | "admin";

export interface ApiAuthContextOk {
  ok: true;
  userId: string;
  apiKeyId: string;
  scopes: ApiScope[];
  rateLimitPerMinute: number;
}

export interface ApiAuthContextErr {
  ok: false;
  response: NextResponse;
}

export type ApiAuthContext = ApiAuthContextOk | ApiAuthContextErr;

interface ApiKeyRow {
  id: string;
  user_id: string;
  scopes: string[] | null;
  rate_limit_per_minute: number | null;
  expires_at: string | null;
  revoked_at: string | null;
}

const KEY_PREFIX = "ss_live_";
const KEY_RANDOM_BYTES = 24; // 48 hex chars
const KEY_TOTAL_LENGTH = KEY_PREFIX.length + KEY_RANDOM_BYTES * 2;

/** Generate a brand new API key string. Plaintext — show ONCE. */
export function generateApiKey(): { plaintext: string; hash: string; prefix: string } {
  const random = crypto.randomBytes(KEY_RANDOM_BYTES).toString("hex");
  const plaintext = `${KEY_PREFIX}${random}`;
  const hash = hashApiKey(plaintext);
  // First 8 chars only (the static "ss_live_") so users see a recognizable prefix.
  const prefix = KEY_PREFIX;
  return { plaintext, hash, prefix };
}

/** SHA-256 hex hash of an API key. Used for storage + lookup. */
export function hashApiKey(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext).digest("hex");
}

/** Extract the bearer token from a request. Returns null if absent or malformed. */
function extractBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) return null;
  const token = match[1].trim();
  if (!token.startsWith(KEY_PREFIX)) return null;
  if (token.length !== KEY_TOTAL_LENGTH) return null;
  return token;
}

interface AuthOptions {
  /** Required scope (default "read"). Caller must own this scope or "admin". */
  requiredScope?: ApiScope;
}

/**
 * Authenticate a public-API request. Returns either an ok-context with the
 * resolved owner id, or an error context wrapping a NextResponse to return.
 *
 * The function never throws on auth failures — always returns a structured
 * result so route handlers stay branchless.
 */
export async function authenticateApiKey(
  req: NextRequest,
  options: AuthOptions = {},
): Promise<ApiAuthContext> {
  const required: ApiScope = options.requiredScope ?? "read";

  const token = extractBearerToken(req);
  if (!token) {
    return errResponse(401, "Missing or malformed Bearer token. Use Authorization: Bearer ss_live_...");
  }

  const supabase = createServiceClient();
  const hash = hashApiKey(token);

  const { data, error } = await supabase
    .from("api_keys")
    .select("id, user_id, scopes, rate_limit_per_minute, expires_at, revoked_at")
    .eq("key_hash", hash)
    .maybeSingle<ApiKeyRow>();

  if (error) {
    console.error("[api/auth] db lookup failed", error);
    return errResponse(500, "Authentication backend error");
  }
  if (!data) {
    return errResponse(401, "Invalid API key");
  }
  if (data.revoked_at) {
    return errResponse(401, "API key has been revoked");
  }
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    return errResponse(401, "API key has expired");
  }

  const scopes = (data.scopes ?? ["read"]) as ApiScope[];
  if (!hasScope(scopes, required)) {
    return errResponse(
      403,
      `API key lacks required scope: ${required}. Granted scopes: ${scopes.join(", ")}`,
    );
  }

  const limit = data.rate_limit_per_minute ?? 60;
  const rl = rateLimit(`api:${data.id}`, limit);
  if (!rl.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Rate limit exceeded",
          retry_after_ms: rl.resetAt - Date.now(),
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": "0",
          },
        },
      ),
    };
  }

  // Fire-and-forget: bump last_used_at without blocking.
  void supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then((res) => {
      if (res.error) console.error("[api/auth] last_used update failed", res.error);
    });

  return {
    ok: true,
    userId: data.user_id,
    apiKeyId: data.id,
    scopes,
    rateLimitPerMinute: limit,
  };
}

function hasScope(granted: ApiScope[], required: ApiScope): boolean {
  if (granted.includes("admin")) return true;
  if (required === "admin") return granted.includes("admin");
  if (required === "write") return granted.includes("write");
  return granted.includes("read") || granted.includes("write");
}

function errResponse(status: number, message: string): ApiAuthContextErr {
  return {
    ok: false,
    response: NextResponse.json({ error: message }, { status }),
  };
}
