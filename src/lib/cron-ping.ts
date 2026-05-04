/**
 * Uptime monitor ping helper for Vercel cron jobs.
 *
 * Compatible with Cronitor (https://cronitor.link/p/<CRONITOR_API_KEY>/<monitor_key>/<state>)
 * and BetterUptime heartbeats (https://betteruptime.com/api/v1/heartbeat/<key>).
 *
 * To enable:
 *   CRONITOR_API_KEY=<your-key>  — uses Cronitor's telemetry API
 *   -OR-
 *   CRONITOR_PING_URL=https://cronitor.link/p/<key>  — explicit base URL override
 *
 * If neither env var is set, all pings are silently skipped (no-op).
 * This function NEVER throws — a monitoring failure must never kill a cron.
 *
 * Usage:
 *   import { pingCron } from "@/lib/cron-ping";
 *
 *   export async function GET(request: NextRequest) {
 *     const done = await pingCron("cold-email-runner");   // signals "run"
 *     // ... do work ...
 *     await done("complete");   // signals "complete" (or "fail" on catch)
 *   }
 *
 * Monitor keys should match the cron route path segment, e.g.:
 *   /api/cron/cold-email-runner  →  key = "cold-email-runner"
 */

type CronState = "run" | "complete" | "fail";

const CRONITOR_BASE =
  process.env.CRONITOR_PING_URL ||
  (process.env.CRONITOR_API_KEY
    ? `https://cronitor.link/p/${process.env.CRONITOR_API_KEY}`
    : null);

/**
 * Fire a single telemetry ping for a monitor.
 * State "run" = cron started, "complete" = finished OK, "fail" = errored.
 */
async function ping(monitorKey: string, state: CronState): Promise<void> {
  if (!CRONITOR_BASE) return;

  try {
    await fetch(`${CRONITOR_BASE}/${monitorKey}/${state}`, {
      method: "GET",
      signal: AbortSignal.timeout(3_000),
    });
  } catch {
    // Intentionally swallowed — monitor pings must never affect cron health
  }
}

/**
 * Begin a monitored cron run.
 *
 * Immediately signals "run" to the uptime monitor, then returns a `done`
 * callback. Call `done("complete")` on success or `done("fail")` on error.
 *
 * Returns a no-op done() when monitoring is not configured.
 */
export async function pingCron(
  monitorKey: string
): Promise<(state?: "complete" | "fail") => Promise<void>> {
  await ping(monitorKey, "run");

  return async (state: "complete" | "fail" = "complete") => {
    await ping(monitorKey, state);
  };
}

/**
 * Convenience wrapper: record a simple heartbeat (run + complete in one call).
 * Use for short-lived crons where you just want to confirm they fired.
 */
export async function heartbeat(monitorKey: string): Promise<void> {
  await ping(monitorKey, "run");
  await ping(monitorKey, "complete");
}
