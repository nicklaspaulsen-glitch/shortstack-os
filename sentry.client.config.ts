/**
 * Sentry browser-side initialisation.
 *
 * Required env vars (add to .env.local for dev, Vercel env for prod):
 *   NEXT_PUBLIC_SENTRY_DSN=   # DSN from sentry.io → Project Settings → Client Keys
 *   SENTRY_DSN=               # Same value, used by server/edge configs
 *   SENTRY_AUTH_TOKEN=        # Source-map upload token (optional, prod only)
 *
 * Soft-fail: if NEXT_PUBLIC_SENTRY_DSN is not set Sentry is a no-op.
 * Never throws at import time — consistent with the lazy-init pattern used
 * by getStripe() and the Anthropic singleton in this codebase.
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,

    // Sample 10% of traces in production, 100% in all other environments.
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Capture full session replay on every error.
    replaysOnErrorSampleRate: 1.0,

    // Capture 0% of non-error sessions to keep replay quota usage low.
    replaysSessionSampleRate: 0.0,

    integrations: [
      Sentry.replayIntegration(),
    ],

    // Surface environment in every event so triage is unambiguous.
    environment: process.env.NODE_ENV ?? "development",

    // Suppress noisy debug output in production.
    debug: false,
  });
}
