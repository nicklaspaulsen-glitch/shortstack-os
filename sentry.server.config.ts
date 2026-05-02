/**
 * Sentry server-side (Node.js runtime) initialisation.
 *
 * Soft-fail: if SENTRY_DSN is not set Sentry is a no-op.
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,

    // Sample 10% of traces in production, 100% in all other environments.
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    environment: process.env.NODE_ENV ?? "development",

    debug: false,
  });
}
