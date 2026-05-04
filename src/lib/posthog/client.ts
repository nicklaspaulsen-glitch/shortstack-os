// Required env vars (add to .env.local and Vercel project settings):
//   NEXT_PUBLIC_POSTHOG_KEY=    # from posthog.com project settings → Project API Key
//   NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

"use client";

import posthog, { type PostHog } from "posthog-js";

let _client: PostHog | null = null;

/**
 * Returns an initialised PostHog browser client, or null when:
 *   - NEXT_PUBLIC_POSTHOG_KEY is absent (soft-fail — no throw)
 *   - The user has not yet accepted cookie consent (GDPR gate)
 *
 * Safe to call multiple times; PostHog is only initialised once,
 * and only after the user explicitly accepts the cookie banner.
 * Consent is stored under the "cookie-consent" localStorage key.
 */
export function getPostHogClient(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;

  // Return cached client — consent was already verified at init time.
  if (_client) return _client;

  // GDPR: never initialise PostHog before the user gives explicit consent.
  // The cookie-consent banner sets this key to "accepted" on approval.
  if (typeof window === "undefined") return null;
  if (localStorage.getItem("cookie-consent") !== "accepted") return null;

  const host =
    process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com";
  const isDev = process.env.NODE_ENV === "development";

  posthog.init(key, {
    api_host: host,
    autocapture: true,
    capture_pageview: false, // handled manually in PostHogProvider
    session_recording: {
      maskAllInputs: true,
    },
    disable_session_recording: isDev,
  });

  _client = posthog;
  return _client;
}
