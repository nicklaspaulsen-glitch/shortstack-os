import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { verifyClientAccess } from "@/lib/verify-client-access";

/**
 * POST /api/content-calendar/approve-all
 *
 * Flips every `scheduled` row for the given client (or all of the user's
 * clients, if none supplied) into `approved_for_publish`. The publish-scheduled
 * cron worker only picks up approved rows, so until the user hits this button
 * nothing auto-posts — consent is explicit.
 *
 * Body: { client_id?: string, ids?: string[] }
 *   - client_id: optional — scopes the sweep to one client
 *   - ids: optional — only flip these specific calendar rows (still gated by
 *     ownership). Lets the UI approve a subset without changing every row.
 */
export async function POST(request: NextRequest) {
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const clientId: string | null = body?.client_id || null;
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === "string") : [];

  if (clientId) {
    const access = await verifyClientAccess(authSupabase, user.id, clientId);
    if (access.denied) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();

  // Build query. If ids are supplied, scope to them; else sweep by client.
  let q = supabase
    .from("content_calendar")
    .update({
      status: "approved_for_publish",
      approved_at: nowIso,
      approved_by: user.id,
    })
    .eq("status", "scheduled");

  if (ids.length > 0) {
    q = q.in("id", ids);
  }
  if (clientId) {
    q = q.eq("client_id", clientId);
  } else {
    // No client specified — scope to rows owned by this user (admin flow).
    // We look up the user's clients first so we don't grant approval power
    // outside their tenant.
    const { data: ownedClients } = await authSupabase
      .from("clients")
      .select("id")
      .eq("profile_id", user.id);
    const ownedIds = (ownedClients || []).map(c => c.id);
    if (ownedIds.length === 0) {
      return NextResponse.json({ success: true, approved: 0 });
    }
    q = q.in("client_id", ownedIds);
  }

  const { data, error } = await q.select("id, platform, scheduled_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    success: true,
    approved: data?.length || 0,
    items: data || [],
  });
}
