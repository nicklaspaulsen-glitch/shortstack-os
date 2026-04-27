// Centralized config. Production points at https://app.shortstack.work; users
// can override via the options page (e.g. for self-hosted instances or local
// dev against http://localhost:3000).

export const DEFAULT_BASE_URL = "https://app.shortstack.work";
export const SHORTSTACK_COOKIE_DOMAIN = "app.shortstack.work";

// Supabase auth cookie name used by Next.js middleware. We read it via
// chrome.cookies.get instead of touching localStorage so the extension
// works even when the user isn't on a ShortStack tab.
export const AUTH_COOKIE_PREFIX = "sb-";
export const AUTH_COOKIE_SUFFIX = "-auth-token";

export interface StoredSettings {
  baseUrl: string;
}

export const DEFAULT_SETTINGS: StoredSettings = {
  baseUrl: DEFAULT_BASE_URL,
};

export async function getSettings(): Promise<StoredSettings> {
  const stored = await chrome.storage.sync.get(["baseUrl"]);
  return {
    baseUrl:
      typeof stored.baseUrl === "string" && stored.baseUrl.trim() !== ""
        ? stored.baseUrl.replace(/\/+$/, "")
        : DEFAULT_BASE_URL,
  };
}

export async function setSettings(partial: Partial<StoredSettings>): Promise<void> {
  await chrome.storage.sync.set(partial);
}
