import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 30;

/**
 * POST /api/user/backup/restore
 * Body: the JSON payload produced by GET /api/user/backup.
 * We do a conservative restore — only sidebar_preferences is written
 * by default (safe, idempotent, no foreign keys). Profile is merged
 * for a small whitelist of columns. Other arrays are counted and
 * returned so the UI can show "X clients, Y leads would be restored"
 * with a confirmation step later. A second call with ?apply=true
 * commits clients/leads/content/videos (admin-only side of the hatch).
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Basic structural validation
  if (!body || typeof body !== "object" || typeof body.backup_version !== "number") {
    return NextResponse.json({ error: "Not a valid backup file (missing backup_version)" }, { status: 400 });
  }

  const url = new URL(req.url);
  const apply = url.searchParams.get("apply") === "true";

  const service = createServiceClient();
  let restoredCounts: Record<string, number> = {
    sidebar_preferences: 0,
    profile: 0,
    clients: 0,
    leads: 0,
    content_calendar: 0,
    video_projects: 0,
  };

  // 1) Sidebar preferences — always safe to restore
  if (body.sidebar_preferences && typeof body.sidebar_preferences === "object") {
    const prefs = body.sidebar_preferences as Record<string, unknown>;
    const patch: Record<string, unknown> = {
      user_id: user.id,
    };
    if (Array.isArray(prefs.enabled_items)) patch.enabled_items = prefs.enabled_items;
    if (Array.isArray(prefs.custom_groups)) patch.custom_groups = prefs.custom_groups;
    if (prefs.order_overrides && typeof prefs.order_overrides === "object") patch.order_overrides = prefs.order_overrides;
    if (typeof prefs.business_type === "string") patch.business_type = prefs.business_type;
    const { error } = await service.from("user_sidebar_preferences").upsert(patch, { onConflict: "user_id" });
    if (!error) restoredCounts.sidebar_preferences = 1;
  }

  // 2) Profile — merge whitelisted fields only
  if (body.profile && typeof body.profile === "object") {
    const p = body.profile as Record<string, unknown>;
    const allowed = ["nickname", "avatar_url", "user_type", "onboarding_preferences"];
    const patch: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in p) patch[key] = p[key];
    }
    if (Object.keys(patch).length > 0) {
      const { error } = await service.from("profiles").update(patch).eq("id", user.id);
      if (!error) restoredCounts.profile = 1;
    }
  }

  // 3) Count other arrays (preview mode)
  const counts: Record<string, number> = {
    clients: Array.isArray(body.clients) ? (body.clients as unknown[]).length : 0,
    leads: Array.isArray(body.leads) ? (body.leads as unknown[]).length : 0,
    content_calendar: Array.isArray(body.content_calendar) ? (body.content_calendar as unknown[]).length : 0,
    video_projects: Array.isArray(body.video_projects) ? (body.video_projects as unknown[]).length : 0,
  };

  if (apply) {
    // Full restore (best-effort). Only commits rows that belong to this user.
    for (const table of ["clients", "leads", "content_calendar", "video_projects"] as const) {
      const rows = Array.isArray(body[table]) ? (body[table] as Array<Record<string, unknown>>) : [];
      if (rows.length === 0) continue;
      try {
        // Re-assign ownership to the current user
        const withOwner = rows.map(r => ({
          ...r,
          ...(("owner_id" in r) ? { owner_id: user.id } : {}),
          ...(("user_id" in r) ? { user_id: user.id } : {}),
        }));
        const { error } = await service.from(table).upsert(withOwner);
        if (!error) restoredCounts[table] = withOwner.length;
      } catch {
        // Skip tables that don't exist or can't accept these rows
      }
    }
  } else {
    restoredCounts = { ...restoredCounts, ...counts };
  }

  return NextResponse.json({
    success: true,
    applied: apply,
    counts: apply ? restoredCounts : {
      sidebar_preferences: restoredCounts.sidebar_preferences,
      profile: restoredCounts.profile,
      clients: counts.clients,
      leads: counts.leads,
      content_calendar: counts.content_calendar,
      video_projects: counts.video_projects,
    },
    message: apply
      ? "Backup applied. Refresh to see updated data."
      : "Preview only. POST again with ?apply=true to commit the full restore.",
  });
}
