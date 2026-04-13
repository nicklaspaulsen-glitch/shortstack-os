import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";

// ── Token-based auth for data queries ──
// The browser client (cookie-based) has known issues with chunked cookie
// corruption in certain environments. Once the auth-context syncs the
// session from the server, we store the access token here and use it
// for all subsequent data queries via the Authorization header.
// This bypasses cookie auth entirely, which is the same proven pattern
// used by createSupabaseFromToken() on the server side.

let _accessToken: string | null = null;
let _tokenClient: ReturnType<typeof createSupabaseJsClient> | null = null;
let _lastToken: string | null = null;

export function setAccessToken(token: string | null) {
  _accessToken = token;
  // Invalidate cached client when token changes
  if (token !== _lastToken) {
    _tokenClient = null;
    _lastToken = null;
  }
}

export function getAccessToken(): string | null {
  return _accessToken;
}

/**
 * Create a Supabase client for browser use (data queries).
 *
 * - If an access token has been set (after auth-context syncs from server),
 *   returns a CACHED client that uses the token in the Authorization header.
 *   This bypasses cookie-based auth entirely. The client is cached so
 *   React hooks (useCallback, useMemo) that depend on it don't trigger
 *   unnecessary re-renders.
 *
 * - If no token is set yet (initial page load, before auth syncs),
 *   falls back to the standard cookie-based browser client (singleton).
 */
export function createClient() {
  if (_accessToken) {
    // Return cached client if token hasn't changed
    if (_tokenClient && _lastToken === _accessToken) {
      return _tokenClient;
    }
    _tokenClient = createSupabaseJsClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${_accessToken}` },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
    _lastToken = _accessToken;
    return _tokenClient;
  }
  // Fallback: cookie-based browser client (singleton)
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Create the cookie-based browser client for AUTH operations only
 * (setSession, signOut, onAuthStateChange). Always returns the
 * cookie-based singleton regardless of token state.
 */
export function createAuthClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
