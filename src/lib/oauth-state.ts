/**
 * OAuth state helpers.
 *
 * We use HMAC-signed `state` strings for OAuth callbacks so the callback
 * handler can verify that:
 *   1. The `state` was issued by us (integrity).
 *   2. The caller completing the callback is the same authenticated user
 *      who initiated it (ownership — prevents state-confusion CSRF).
 *
 * Layout:
 *   state = base64url( JSON({ client_id, platform, uid, nonce, iat }) ) + "." + base64url( HMAC-SHA256(secret, payload) )
 *
 * `client_id` is the agency/client row the tokens will be saved against.
 * `uid` is the Supabase user id that initiated the flow — the callback
 * rejects the request unless the current session's user id matches.
 */

import crypto from "crypto";

type StatePayload = {
  client_id: string;
  platform: string;
  uid: string;
  nonce: string;
  iat: number;
};

const MAX_AGE_MS = 10 * 60 * 1000; // 10 min

function getSecret(): string {
  const s = process.env.OAUTH_STATE_SECRET
    || process.env.NEXTAUTH_SECRET
    || process.env.CRON_SECRET
    || "";
  if (!s) {
    throw new Error(
      "[oauth-state] OAUTH_STATE_SECRET / NEXTAUTH_SECRET / CRON_SECRET must be set"
    );
  }
  return s;
}

function b64urlEncode(buf: Buffer | string): string {
  return (Buffer.isBuffer(buf) ? buf : Buffer.from(buf))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

/**
 * Sign a state payload for the given user + client.
 */
export function signOAuthState(params: {
  client_id: string;
  platform: string;
  uid: string;
}): string {
  const payload: StatePayload = {
    ...params,
    nonce: crypto.randomBytes(16).toString("hex"),
    iat: Date.now(),
  };

  const body = b64urlEncode(JSON.stringify(payload));
  const sig = crypto
    .createHmac("sha256", getSecret())
    .update(body)
    .digest();
  return `${body}.${b64urlEncode(sig)}`;
}

/**
 * Verify and decode a state string. Returns the payload on success,
 * or null if the signature is invalid, the state is malformed, or the
 * state has expired.
 */
export function verifyOAuthState(state: string | null | undefined): StatePayload | null {
  if (!state || typeof state !== "string") return null;
  const parts = state.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;

  let expected: Buffer;
  try {
    expected = crypto
      .createHmac("sha256", getSecret())
      .update(body)
      .digest();
  } catch {
    return null;
  }

  let provided: Buffer;
  try {
    provided = b64urlDecode(sig);
  } catch {
    return null;
  }

  if (
    expected.length !== provided.length ||
    !crypto.timingSafeEqual(expected, provided)
  ) {
    return null;
  }

  let payload: StatePayload;
  try {
    payload = JSON.parse(b64urlDecode(body).toString("utf8")) as StatePayload;
  } catch {
    return null;
  }

  if (!payload.client_id || !payload.platform || !payload.uid) return null;
  if (!payload.iat || Date.now() - payload.iat > MAX_AGE_MS) return null;

  return payload;
}

/**
 * Verify that the currently-authenticated user is allowed to save OAuth
 * tokens against the target `client_id`. This covers:
 *   - The user IS the agency owner (profiles.id === client_id).
 *   - The user is a team_member whose parent_agency_id === client_id.
 *   - The user has a row in clients{id, user_id} (legacy — client_id column points to a clients-table row).
 */
export async function canUserWriteForClient(
  supabase: {
    from: (tbl: string) => {
      select: (cols: string) => {
        eq: (c: string, v: string) => {
          maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
        };
      };
    };
  },
  userId: string,
  clientId: string
): Promise<boolean> {
  if (userId === clientId) return true;

  // profiles.role = team_member with parent_agency_id = clientId
  const { data: profile } = await supabase
    .from("profiles")
    .select("role,parent_agency_id")
    .eq("id", userId)
    .maybeSingle();
  if (
    profile
    && profile["role"] === "team_member"
    && profile["parent_agency_id"] === clientId
  ) {
    return true;
  }

  // Legacy clients table (one row per end-client, owned by an agency user)
  const { data: legacyClient } = await supabase
    .from("clients")
    .select("user_id")
    .eq("id", clientId)
    .maybeSingle();
  if (legacyClient && legacyClient["user_id"] === userId) return true;

  return false;
}
