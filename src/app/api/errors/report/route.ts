import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/errors/report
 *
 * Accepts client-side render/lifecycle errors caught by ErrorBoundary and
 * the Next.js `error.tsx` segments, and logs them to `trinity_log` for
 * triage.
 *
 * Body: {
 *   error: string,          // error.message
 *   stack?: string,         // error.stack
 *   componentStack?: string, // React component stack (when available)
 *   digest?: string,        // Next.js error digest
 *   pathname: string,       // window.location.pathname at time of crash
 *   userAgent: string,      // navigator.userAgent
 *   section?: string,       // "dashboard" | "portal" | "root" | custom label
 *   manual?: boolean,       // true if user clicked "Report bug", false for auto-report
 * }
 *
 * Rate-limited to 10 requests/min per user (or per-IP for anonymous callers)
 * to prevent a crash loop from DoS-ing the logging table.
 */

interface ErrorReportBody {
  error?: unknown;
  stack?: unknown;
  componentStack?: unknown;
  digest?: unknown;
  pathname?: unknown;
  userAgent?: unknown;
  section?: unknown;
  manual?: unknown;
}

const MAX_STRING = 4_000; // Clip to keep rows bounded
const MAX_STACK = 8_000;

function clip(v: unknown, max: number): string | null {
  if (typeof v !== "string" || !v) return null;
  return v.length > max ? v.slice(0, max) + "…[truncated]" : v;
}

export async function POST(request: NextRequest) {
  // Parse body first so we can fail fast on malformed input.
  let body: ErrorReportBody;
  try {
    body = (await request.json()) as ErrorReportBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const errorMessage = clip(body.error, MAX_STRING);
  if (!errorMessage) {
    return NextResponse.json({ error: "Missing error" }, { status: 400 });
  }
  const stack = clip(body.stack, MAX_STACK);
  const componentStack = clip(body.componentStack, MAX_STACK);
  const digest = clip(body.digest, 256);
  const pathname = clip(body.pathname, 512) ?? "/";
  const userAgent = clip(body.userAgent, 512);
  const section = clip(body.section, 64);
  const manual = Boolean(body.manual);

  // Resolve the caller — authenticated user when possible, else a coarse
  // per-IP bucket. Anonymous errors still get logged (e.g. /login crashes).
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rateKey = user?.id
    ? `errors:user:${user.id}`
    : `errors:ip:${
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown"
      }`;

  const rl = rateLimit(rateKey, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        retry_after_ms: rl.resetAt - Date.now(),
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.ceil((rl.resetAt - Date.now()) / 1000)
          ),
        },
      }
    );
  }

  // Service client — logging should succeed regardless of RLS on
  // trinity_log, and callers may be anonymous (portal, login screen).
  const service = createServiceClient();
  const { error: insertError } = await service.from("trinity_log").insert({
    user_id: user?.id ?? null,
    agent: "client-error-boundary",
    action_type: "custom",
    description: `Client error${section ? ` in ${section}` : ""}: ${errorMessage.slice(
      0,
      200
    )}`,
    status: "failed",
    error_message: errorMessage,
    result: {
      pathname,
      section,
      digest,
      user_agent: userAgent,
      component_stack: componentStack,
      stack,
    },
    metadata: {
      label: "error_reported",
      section,
      pathname,
      manual,
      user_email: user?.email ?? null,
      reported_at: new Date().toISOString(),
    },
  });

  if (insertError) {
    console.error("[errors/report] insert failed:", insertError);
    return NextResponse.json(
      { error: "Failed to record error" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
