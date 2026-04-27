import {
  AUTH_COOKIE_PREFIX,
  AUTH_COOKIE_SUFFIX,
  SHORTSTACK_COOKIE_DOMAIN,
  getSettings,
} from "../shared/config";
import type { AuthState } from "../shared/types";

// Supabase stores its session as a JSON-encoded cookie named
// `sb-<project-ref>-auth-token`. We read it via chrome.cookies — works for
// both same-origin and cross-origin so the extension can authenticate even
// when the user is browsing LinkedIn.
//
// SECURITY: we never persist the token to chrome.storage. We re-read the
// cookie on every API call so a logout in the web app immediately
// invalidates the extension. If the user logs out in app.shortstack.work,
// their browser drops the cookie and our next call returns 401.

interface SupabaseSessionShape {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  user?: { email?: string };
}

function decodeCookieValue(rawValue: string): SupabaseSessionShape | null {
  // Newer Supabase versions URL-encode then base64-prefix the value.
  // Older versions store raw JSON. Handle both shapes.
  const trimmed = rawValue.trim();

  // Format: base64-<encoded-json>
  if (trimmed.startsWith("base64-")) {
    try {
      const b64 = trimmed.slice("base64-".length);
      const json = atob(b64);
      const parsed = JSON.parse(json) as unknown;
      if (
        parsed &&
        typeof parsed === "object" &&
        "access_token" in parsed &&
        typeof (parsed as { access_token: unknown }).access_token === "string"
      ) {
        return parsed as SupabaseSessionShape;
      }
      return null;
    } catch {
      return null;
    }
  }

  // Plain JSON (or URL-encoded JSON)
  try {
    const decoded = trimmed.startsWith("%7B") ? decodeURIComponent(trimmed) : trimmed;
    const parsed = JSON.parse(decoded) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "access_token" in parsed &&
      typeof (parsed as { access_token: unknown }).access_token === "string"
    ) {
      return parsed as SupabaseSessionShape;
    }
    return null;
  } catch {
    return null;
  }
}

async function getSessionCookie(): Promise<SupabaseSessionShape | null> {
  // Look for any Supabase session cookie on the ShortStack domain.
  // We don't hardcode the project ref because it can change between
  // staging/prod and we don't want to ship a build artifact each time.
  const cookies = await chrome.cookies.getAll({
    domain: SHORTSTACK_COOKIE_DOMAIN,
  });

  const authCookies = cookies.filter(
    (c) =>
      c.name.startsWith(AUTH_COOKIE_PREFIX) && c.name.endsWith(AUTH_COOKIE_SUFFIX),
  );
  if (authCookies.length === 0) return null;

  // Supabase splits large session cookies across N parts (`<base>.0`,
  // `<base>.1`, ...). Reassemble in order before parsing.
  type Cookie = chrome.cookies.Cookie;
  const grouped = new Map<string, Cookie[]>();
  for (const c of authCookies) {
    // Strip trailing `.<n>` so split parts share a base name.
    const base = c.name.replace(/\.\d+$/, "");
    const arr = grouped.get(base) ?? [];
    arr.push(c);
    grouped.set(base, arr);
  }

  for (const parts of grouped.values()) {
    parts.sort((a, b) => {
      const aIdx = parseInt(a.name.match(/\.(\d+)$/)?.[1] ?? "-1", 10);
      const bIdx = parseInt(b.name.match(/\.(\d+)$/)?.[1] ?? "-1", 10);
      return aIdx - bIdx;
    });
    const value = parts.map((p) => p.value).join("");
    const session = decodeCookieValue(value);
    if (session) return session;
  }

  return null;
}

export async function getAccessToken(): Promise<string | null> {
  const session = await getSessionCookie();
  if (!session) return null;
  if (session.expires_at && session.expires_at * 1000 < Date.now()) {
    // Token expired; let the user re-auth in the web app.
    return null;
  }
  return session.access_token;
}

export async function checkAuth(): Promise<AuthState> {
  try {
    const session = await getSessionCookie();
    if (!session) return { connected: false, reason: "no_token" };
    if (session.expires_at && session.expires_at * 1000 < Date.now()) {
      return { connected: false, reason: "expired" };
    }
    return { connected: true, userEmail: session.user?.email };
  } catch (e) {
    console.error("[prospector] checkAuth failed:", e);
    return { connected: false, reason: "unknown" };
  }
}

export async function openLoginTab(): Promise<void> {
  const { baseUrl } = await getSettings();
  await chrome.tabs.create({ url: `${baseUrl}/login` });
}
