// Required env vars (add to .env.local and Vercel project settings):
//   POSTHOG_KEY=    # server-side key from posthog.com (starts with phc_)
//   NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

import { PostHog } from "posthog-node";

let _serverClient: PostHog | null = null;

/**
 * Returns a PostHog Node client for server-side event capture, or null
 * when POSTHOG_KEY is absent (soft-fail — no throw).
 *
 * Safe to call multiple times; the client is lazily initialised once.
 */
export function getPostHogServerClient(): PostHog | null {
  const key = process.env.POSTHOG_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;

  if (_serverClient) return _serverClient;

  const host =
    process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com";

  _serverClient = new PostHog(key, {
    host,
    flushAt: 20,
    flushInterval: 10_000,
  });

  return _serverClient;
}
