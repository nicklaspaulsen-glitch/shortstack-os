/**
 * Sentry edge runtime initialisation.
 *
 * Edge functions run in a limited V8 environment — no Node.js APIs.
 * Keep this config minimal: no Node integrations, no file I/O.
 *
 * Soft-fail: if SENTRY_DSN is not set Sentry is a no-op.
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,

    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    environment: process.env.NODE_ENV ?? "development",

    debug: false,
  });
}
