import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { secureCompare } from "@/lib/security/ssrf-guard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron: prune stale workspace presence rows.
 *
 * Runs every 5 minutes (see vercel.json). Deletes anything whose
 * last_seen_at is older than 5 minutes — that's the same window the
 * aggregator uses for "online now," so once the cron runs the table
 * stays small and queries stay fast.
 *
 * Auth model:
 *   - Requires `Authorization: Bearer ${CRON_SECRET}`.
 *   - If CRON_SECRET is unset on the deploy we fail-closed with 503
 *     (rather than silently allowing all callers, which would defeat
 *     the point of the bearer guard).
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // eslint-disable-next-line no-console
    console.error("[cron/prune-presence] CRON_SECRET not configured");
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }
  const authHeader = req.headers.get("authorization");
  const rawToken = authHeader?.replace(/\^Bearer\\s+/i, "") ?? "";
  if (!secureCompare(rawToken, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  try {
    const { count, error } = await service
      .from("workspace_presence")
      .delete({ count: "exact" })
      .lt("last_seen_at", cutoff);
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[cron/prune-presence] delete failed", error.message);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }
    return NextResponse.json({
      success: true,
      deleted: count ?? 0,
      cutoff,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    // eslint-disable-next-line no-console
    console.error("[cron/prune-presence] unexpected error", message);
    return NextResponse.json(
      { success: false, error: "unexpected error" },
      { status: 500 },
    );
  }
}
