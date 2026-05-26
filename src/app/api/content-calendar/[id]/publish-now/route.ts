import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { verifyClientAccess } from "@/lib/verify-client-access";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { publishCalendarRow, type CalendarRow } from "@/lib/content-publish";

/**
 * POST /api/content-calendar/[id]/publish-now
 *
 * On-demand publish of a single calendar entry. Performs the same work as
 * the cron worker but for one row, and respects client-access gating so
 * users can't nudge other tenants' rows.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rowId = params.id;
  if (!rowId) return NextResponse.json({ error: "Missing calendar id" }, { status: 400 });

  // Fetch the row under the user's RLS
  const { data: row, error } = await authSupabase
    .from("content_calendar")
    .select("id, user_id, client_id, title, platform, scheduled_at, status, notes, metadata")
    .eq("id", rowId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Apr 28 IDOR fix: ownership check previously short-circuited when
  // `row.client_id` was null (agency-wide social posts that aren't
  // tied to a specific client). Net effect: any authenticated user
  // could publish other tenants' agency-wide content. Now the row's
  // `user_id` is checked against the caller's effective owner as a
  // fallback when client_id is null.
  if (row.client_id) {
    const access = await verifyClientAccess(authSupabase, user.id, row.client_id);
    if (access.denied) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } else {
    const ownerId = await getEffectiveOwnerId(authSupabase, user.id);
    if (!ownerId || row.user_id !== ownerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Use service client so we can freely write posted/failed statuses and
  // insert audit rows without fighting RLS policies.
  const supabase = createServiceClient();
  const outcome = await publishCalendarRow(supabase, row as CalendarRow);

  // Record who triggered the manual publish (helps audit later).
  // Defense-in-depth: scope by user_id (from the already-authenticated row
  // read) to close the TOCTOU window between the ownership check and this
  // service-client write. Service client bypasses RLS.
  try {
    await supabase
      .from("content_calendar")
      .update({ approved_by: user.id, approved_at: new Date().toISOString() })
      .eq("id", rowId)
      .eq("user_id", row.user_id);
  } catch (err) { console.error("[content-calendar/publish-now] audit stamp failed:", err); }

  if (outcome.status === "posted") {
    return NextResponse.json({ success: true, outcome });
  }
  if (outcome.status === "needs_connection") {
    return NextResponse.json(
      {
        success: false,
        outcome,
        error: `No connected ${outcome.short_platform} account. Connect in Integrations first.`,
        connect_url: "/dashboard/social-manager",
      },
      { status: 409 },
    );
  }
  // failed
  return NextResponse.json({ success: false, outcome, error: outcome.error }, { status: 502 });
}
