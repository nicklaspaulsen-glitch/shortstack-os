/**
 * Structured logging — wraps `console.log/warn/error` so every line emits
 * as a single JSON object. Vector (or any log shipper) parses cleanly
 * without regex sweat over bracketed text prefixes.
 *
 * The bracketed `[component-name]` prefix used elsewhere in the repo
 * stays inside the human-readable message field — the JSON wrapping is
 * additive. Existing log-grep workflows still work.
 *
 * ## Output shape
 *
 *   {
 *     "timestamp": "2026-04-27T14:00:00.000Z",
 *     "level": "info" | "warn" | "error",
 *     "component": "<bracketed prefix without brackets>",
 *     "message": "what happened",
 *     "context": { ... small key/value map ... },
 *     "service": "shortstack",
 *     "env": "production" | "preview" | "development"
 *   }
 *
 * ## Why JSON
 *
 * - Vector's `parse_json` transform handles it natively
 * - ClickHouse's `JSONEachRow` insert format ingests it directly
 * - Datadog/Loki/Splunk all index JSON well
 * - Plain bracketed lines force regex parsing per shipper, every time
 *
 * ## Backward compatibility
 *
 * All existing `console.error("[component] msg")` calls keep working.
 * This helper is opt-in per call site. Convert the noisy critical paths
 * first; leave the rest until they bite.
 */

interface LogContext {
  [key: string]: unknown;
}

type LogLevel = "info" | "warn" | "error";

const SECRET_KEY_PATTERN = /token|secret|password|api[_-]?key|authorization|cookie|bearer/i;

function scrub(ctx: LogContext): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (SECRET_KEY_PATTERN.test(k)) {
      out[k] = "[scrubbed]";
      continue;
    }
    if (typeof v === "string" && v.length > 2000) {
      out[k] = `${v.slice(0, 1000)}…[truncated ${v.length - 1000} chars]`;
      continue;
    }
    out[k] = v;
  }
  return out;
}

/**
 * Strip the leading `[name]` bracket from the prefix, keeping the bare
 * component name. We accept either form:
 *   structuredLog.info("[email-router]", "msg", {})
 *   structuredLog.info("email-router", "msg", {})
 */
function normalizeComponent(prefix: string): string {
  const match = prefix.match(/^\[([^\]]+)\]\s*$/);
  return match ? match[1] : prefix;
}

function emit(
  level: LogLevel,
  prefix: string,
  message: string,
  context?: LogContext,
): void {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    component: normalizeComponent(prefix),
    // Keep the original `[component] message` format inside the message
    // string too — that's what every existing grep / human-eyeball
    // workflow expects to see. The JSON wrapping is additive.
    message: `[${normalizeComponent(prefix)}] ${message}`,
    context: context ? scrub(context) : undefined,
    service: "shortstack",
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA,
  };

  // Use the right console fn so log shippers + Vercel's level filter still
  // work. Vector log drains see the same level Vercel does.
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    // We deliberately use console.log here for `info`. Vercel's "production
    // log" stream surfaces console.log; using `console.info` would route
    // through the same pipe but with confusing labels in some shippers.
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

export const structuredLog = {
  info(prefix: string, message: string, context?: LogContext): void {
    emit("info", prefix, message, context);
  },
  warn(prefix: string, message: string, context?: LogContext): void {
    emit("warn", prefix, message, context);
  },
  error(prefix: string, message: string, context?: LogContext): void {
    emit("error", prefix, message, context);
  },
};
