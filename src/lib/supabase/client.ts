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

// TRUE SINGLETON for the cookie-based browser client.
// This prevents "Multiple GoTrueClient instances" warnings and the
// associated lock contention that causes "Lock not released within 5000ms"
// errors — which was the root cause of the sidebar showing no nav items
// (profile fetch failed because auth operations deadlocked on the lock).
let _browserClient: ReturnType<typeof createBrowserClient> | null = null;

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

// Build-time / SSG placeholder values. The SDK only rejects empty strings
// and undefined for url/anon-key — any non-empty values pass the check.
// We never *use* this client (it's constructed during prerender but data
// queries only fire in client-side useEffect/event handlers), so a
// connection to an invalid host never happens. If somehow a query did
// fire against this stub it would surface a clean "fetch failed" rather
// than crashing the entire Next.js build.
const SSG_PLACEHOLDER_URL = "https://placeholder.supabase.co";
const SSG_PLACEHOLDER_KEY = "placeholder-anon-key";

/**
 * Get the singleton cookie-based browser client.
 * Used for AUTH operations and as fallback for data queries.
 * Always returns the exact same instance to avoid multiple GoTrueClient warnings.
 *
 * SSG/prerender resilience: if NEXT_PUBLIC_SUPABASE_URL or _ANON_KEY are
 * missing (Preview deploys without those env vars set, fresh setup, etc),
 * we return an ephemeral non-cached stub instead of crashing the build.
 * The real client gets constructed (and cached) the first time the env
 * vars are available — typically the first hydration tick in the browser.
 */
function getBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // SSG-time fallback. Don't cache — env vars may become available later
    // (e.g. when the same module is reused at runtime with a different env).
    return createBrowserClient(SSG_PLACEHOLDER_URL, SSG_PLACEHOLDER_KEY);
  }
  if (!_browserClient) {
    _browserClient = createBrowserClient(url, key);
  }
  return _browserClient;
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
 *   falls back to the singleton cookie-based browser client.
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
  // Fallback: singleton cookie-based browser client
  return getBrowserClient();
}

/**
 * Create the cookie-based browser client for AUTH operations only
 * (setSession, signOut, onAuthStateChange). Returns the same singleton
 * instance as createClient's fallback to avoid multiple GoTrueClient instances.
 */
export function createAuthClient() {
  return getBrowserClient();
}
