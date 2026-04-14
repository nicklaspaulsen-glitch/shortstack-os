/**
 * Standardized API error handling.
 * Use in all API routes to return consistent error responses
 * and optionally report to an error tracking service.
 */

import { NextResponse } from "next/server";

interface ApiErrorOptions {
  /** HTTP status code (default: 500) */
  status?: number;
  /** Internal error code for client-side handling */
  code?: string;
  /** Log context — route name, user ID, etc. */
  context?: Record<string, unknown>;
}

/**
 * Return a consistent JSON error response.
 *
 * Usage:
 * ```ts
 * return apiError("Something went wrong", { status: 400, code: "INVALID_INPUT" });
 * ```
 */
export function apiError(message: string, options: ApiErrorOptions = {}) {
  const { status = 500, code, context } = options;

  // Log server-side (replace with Sentry/LogTail in production)
  if (status >= 500) {
    console.error(`[API Error ${status}]`, message, context || "");
  }

  return NextResponse.json(
    {
      error: message,
      ...(code ? { code } : {}),
    },
    { status }
  );
}

/**
 * Wrap an async API handler to catch unhandled errors.
 * Prevents raw stack traces from leaking to users.
 *
 * Usage:
 * ```ts
 * export const POST = withErrorHandler(async (request) => {
 *   // your handler code
 *   return NextResponse.json({ success: true });
 * });
 * ```
 */
export function withErrorHandler(
  handler: (request: Request) => Promise<Response>
) {
  return async (request: Request) => {
    try {
      return await handler(request);
    } catch (err) {
      console.error("[Unhandled API Error]", err instanceof Error ? err.message : err);

      // Future: report to Sentry
      // Sentry.captureException(err);

      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 }
      );
    }
  };
}

/**
 * Require authentication. Returns user or error response.
 *
 * Usage:
 * ```ts
 * const [user, errorResponse] = await requireAuth(supabase);
 * if (errorResponse) return errorResponse;
 * // user is guaranteed to exist here
 * ```
 */
export async function requireAuth(
  supabase: { auth: { getUser: () => Promise<{ data: { user: { id: string; email?: string } | null } }> } }
): Promise<[{ id: string; email?: string }, null] | [null, Response]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return [null, apiError("Unauthorized", { status: 401, code: "UNAUTHORIZED" })];
  }
  return [user, null];
}
