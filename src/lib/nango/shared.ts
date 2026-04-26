/**
 * Nango shared constants — safe for both server and client bundles.
 *
 * This file intentionally has NO imports from Node.js built-ins or
 * server-only packages (no @nangohq/node). It exists so that client
 * components can reference integration IDs and types without pulling
 * the server SDK into the browser bundle.
 *
 * Server-only logic (credentials, token refresh, etc.) stays in
 * ./client.ts which imports @nangohq/node.
 */

/** Standard Nango integration IDs in this codebase.
 *
 *  These mirror the integration keys configured in the Nango dashboard. Keep
 *  them centralized so route handlers, UI, and the connections table all use
 *  the same string. */
export const NANGO_INTEGRATIONS = {
  GOOGLE_ADS: "google-zanb",
  FACEBOOK: "facebook",
  APIFY: "apify",
} as const;

export type NangoIntegrationId =
  (typeof NANGO_INTEGRATIONS)[keyof typeof NANGO_INTEGRATIONS];
