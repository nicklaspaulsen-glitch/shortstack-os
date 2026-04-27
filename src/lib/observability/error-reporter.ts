/**
 * Error reporter — provider-agnostic abstraction over Sentry-compatible
 * error sinks (Sentry cloud, GlitchTip self-hosted, both share the same
 * DSN format and SDK wire protocol).
 *
 * ## Why this lives here
 *
 * The repo deliberately doesn't ship the `@sentry/nextjs` package today —
 * it adds ~80 KB to the client bundle and the user wants to stay flexible
 * about whether to host on Sentry cloud (~$26/mo team plan) or run
 * GlitchTip on a Hetzner CX21 (~€5/mo). This helper is the seam: every
 * critical-path catch block calls `reportError(err, ctx)` and ships a
 * structured payload to whichever DSN is set in `SENTRY_DSN`.
 *
 * - When `SENTRY_DSN` is set, we POST a Sentry "store" envelope directly
 *   over fetch. No SDK dependency. Works against Sentry cloud, GlitchTip,
 *   relay-proxied Sentry, or any wire-compatible sink.
 * - When unset, falls back to `console.error` with a `[error-reporter]`
 *   prefix so the line is still visible in Vercel logs / wherever else
 *   logs are scraped.
 *
 * ## Usage
 *
 *   import { reportError } from "@/lib/observability/error-reporter";
 *   try {
 *     await doRiskyThing();
 *   } catch (err) {
 *     reportError(err, { route: "/api/x", userId: user?.id });
 *     throw err; // up to caller whether to swallow or rethrow
 *   }
 *
 * ## What we DO NOT send
 *
 * - Full request bodies (PII risk + huge payloads)
 * - Authorization / cookie / api-key headers
 * - Stripe metadata, email subjects/bodies, customer addresses
 *
 * Callers are responsible for keeping the `context` object slim. This
 * helper does best-effort scrubbing of obvious secret-looking keys but
 * is NOT a PII firewall — that's the caller's job.
 *
 * ## Sampling
 *
 * Every error is sent (sample rate = 1.0) unless `SENTRY_SAMPLE_RATE`
 * is set to a number in [0, 1]. Only error events are sampled — there
 * are no transactions, no breadcrumbs, no performance traces. If you
 * want any of that, install the actual SDK first.
 */

interface ErrorContext {
  route?: string;
  component?: string;
  userId?: string;
  [key: string]: unknown;
}

interface SentryDsn {
  protocol: string;
  publicKey: string;
  host: string;
  projectId: string;
  ingestUrl: string;
}

const SECRET_KEY_PATTERN = /token|secret|password|api[_-]?key|authorization|cookie|bearer/i;

function parseDsn(dsn: string): SentryDsn | null {
  // Sentry DSN format: https://<publicKey>@<host>/<projectId>
  // GlitchTip uses the same format, may include a path prefix.
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\/+/, "").replace(/\/+$/, "");
    if (!projectId) return null;
    return {
      protocol: url.protocol.replace(":", ""),
      publicKey: url.username,
      host: url.host,
      projectId,
      ingestUrl: `${url.protocol}//${url.host}/api/${projectId}/store/`,
    };
  } catch {
    return null;
  }
}

function scrubContext(ctx: ErrorContext): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (SECRET_KEY_PATTERN.test(k)) {
      out[k] = "[scrubbed]";
      continue;
    }
    if (typeof v === "string" && v.length > 1000) {
      // Long strings are usually payloads. Keep first 500 chars so the
      // error is still actionable but never ship gigabyte-length blobs.
      out[k] = `${v.slice(0, 500)}…[truncated ${v.length - 500} chars]`;
      continue;
    }
    out[k] = v;
  }
  return out;
}

function shouldSample(): boolean {
  const raw = process.env.SENTRY_SAMPLE_RATE;
  if (!raw) return true;
  const rate = Number(raw);
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) return true;
  return Math.random() < rate;
}

function buildSentryEnvelope(
  err: unknown,
  context: ErrorContext,
): {
  event_id: string;
  timestamp: number;
  platform: "javascript";
  level: "error";
  message: string;
  exception: { values: Array<{ type: string; value: string; stacktrace?: { frames: unknown[] } }> };
  tags: Record<string, string>;
  extra: Record<string, unknown>;
  release?: string;
  environment?: string;
} {
  const errorObj =
    err instanceof Error ? err : new Error(typeof err === "string" ? err : JSON.stringify(err));
  const eventId = crypto.randomUUID().replace(/-/g, "");
  const stackFrames = errorObj.stack
    ? errorObj.stack
        .split("\n")
        .slice(1)
        .map((line) => ({ filename: line.trim() }))
    : [];

  return {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: "javascript",
    level: "error",
    message: errorObj.message,
    exception: {
      values: [
        {
          type: errorObj.name || "Error",
          value: errorObj.message,
          stacktrace: stackFrames.length > 0 ? { frames: stackFrames } : undefined,
        },
      ],
    },
    tags: {
      route: typeof context.route === "string" ? context.route : "unknown",
      component: typeof context.component === "string" ? context.component : "unknown",
    },
    extra: scrubContext(context),
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  };
}

/**
 * Report an error to Sentry/GlitchTip if configured, otherwise log to
 * stderr. Never throws — failure to ship telemetry must never break the
 * caller's flow.
 */
export function reportError(err: unknown, context: ErrorContext = {}): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    const errMsg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error(
      `[error-reporter] ${errMsg}`,
      context,
      err instanceof Error ? err.stack : undefined,
    );
    return;
  }

  if (!shouldSample()) return;

  const parsed = parseDsn(dsn);
  if (!parsed) {
    console.error("[error-reporter] SENTRY_DSN is malformed — falling back to console");
    console.error(err, context);
    return;
  }

  const envelope = buildSentryEnvelope(err, context);

  // Fire-and-forget. Error in transport is logged (so ops sees it) but
  // never thrown back at the caller — telemetry must never break the
  // user-facing path.
  fetch(parsed.ingestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Sentry-Auth": [
        "Sentry sentry_version=7",
        `sentry_key=${parsed.publicKey}`,
        "sentry_client=shortstack/1.0",
      ].join(", "),
    },
    body: JSON.stringify(envelope),
    // 3s timeout — telemetry must not stall request handling.
    signal: AbortSignal.timeout(3000),
  }).catch((e) => {
    console.error("[error-reporter] failed to ship event:", e);
  });
}

/**
 * Strict variant — for places where you want to know synchronously whether
 * the report was attempted (true) or fell back to console (false). Useful
 * for tests and runbook smoke checks.
 */
export function isErrorReporterConfigured(): boolean {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;
  return parseDsn(dsn) !== null;
}
