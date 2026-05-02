/**
 * Next.js instrumentation hook — loads Sentry on the server and edge
 * runtimes at startup. Called by Next.js automatically when this file
 * exists at src/instrumentation.ts (requires Next.js 13.4+).
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}
