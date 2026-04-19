import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { verifyClientAccess } from "@/lib/verify-client-access";
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
    .select("id, client_id, title, platform, scheduled_at, status, notes, metadata")
    .eq("id", rowId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Ownership: if the row has a client_id, verify the caller has access.
  if (row.client_id) {
    const access = await verifyClientAccess(authSupabase, user.id, row.client_id);
    if (access.denied) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Use service client so we can freely write posted/failed statuses and
  // insert audit rows without fighting RLS policies.
  const supabase = createServiceClient();
  const outcome = await publishCalendarRow(supabase, row as CalendarRow);

  // Record who triggered the manual publish (helps audit later)
  try {
    await supabase
      .from("content_calendar")
      .update({ approved_by: user.id, approved_at: new Date().toISOString() })
      .eq("id", rowId);
  } catch {}

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
