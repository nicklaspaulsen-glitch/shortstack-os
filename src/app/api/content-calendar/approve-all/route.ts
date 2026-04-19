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
    // No client specified — scope to rows owned by this user's tenant.
    // For admins: clients they own (clients.profile_id === user.id).
    // For team members: clients belonging to their parent agency, optionally
    //   narrowed by allowed_client_ids if their access mode is "specific".
    const { data: profile } = await authSupabase
      .from("profiles")
      .select("role, parent_agency_id")
      .eq("id", user.id)
      .maybeSingle();

    let ownerProfileId: string | null = null;
    let allowedSubset: string[] | null = null;

    if (profile?.role === "admin") {
      ownerProfileId = user.id;
    } else if (profile?.role === "team_member") {
      const { data: member } = await authSupabase
        .from("team_members")
        .select("agency_owner_id, client_access_mode, allowed_client_ids, status")
        .eq("member_profile_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      if (!member) {
        return NextResponse.json(
          { success: false, error: "Team member has no active agency link" },
          { status: 403 },
        );
      }
      if (member.client_access_mode === "none") {
        return NextResponse.json(
          { success: false, error: "Your access mode does not permit approval" },
          { status: 403 },
        );
      }
      ownerProfileId = member.agency_owner_id || profile.parent_agency_id;
      if (member.client_access_mode === "specific") {
        allowedSubset = (member.allowed_client_ids as string[]) || [];
      }
    } else {
      // Clients don't approve their own calendar (we don't let the portal
      // user hit this endpoint without a client_id).
      return NextResponse.json(
        { success: false, error: "client_id required for this role" },
        { status: 403 },
      );
    }

    if (!ownerProfileId) {
      return NextResponse.json({ success: true, approved: 0 });
    }

    const { data: ownedClients } = await authSupabase
      .from("clients")
      .select("id")
      .eq("profile_id", ownerProfileId);
    let ownedIds = (ownedClients || []).map(c => c.id);
    if (allowedSubset && allowedSubset.length > 0) {
      ownedIds = ownedIds.filter(id => allowedSubset!.includes(id));
    } else if (allowedSubset && allowedSubset.length === 0) {
      // Team member with empty allowlist and mode=specific → no clients.
      return NextResponse.json({ success: true, approved: 0 });
    }
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
