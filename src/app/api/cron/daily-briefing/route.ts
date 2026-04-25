import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, createSupabaseFromToken } from "@/lib/supabase/server";
import { generateDailyBriefing } from "@/lib/services/daily-briefing";

export const maxDuration = 120;

/**
 * GET /api/cron/daily-briefing
 * Nightly sweep — generates a daily briefing for every active admin via
 * `generateDailyBriefing()` (lib/services/daily-briefing.ts). Output lands
 * in the daily_briefings table keyed on (user_id, briefing_date).
 *
 * NOT a duplicate of /api/cron/daily-brief — that one builds + sends a
 * Telegram summary for the agency owner; this one generates per-admin
 * briefings stored in the DB.
 *
 * Auth: requires `Authorization: Bearer <CRON_SECRET>` header, matching
 * the existing cron pattern used by /api/cron/daily-brief etc.
 *
 * ── ORPHAN HANDLER STATUS (Apr 27 audit) ──
 * The comment below originally said "Configured in vercel.json to run at
 * 07:00 UTC" but the entry was never actually added. Either:
 *   (a) Schedule it in vercel.json (recommended: "0 7 * * *"), OR
 *   (b) Delete this route if the per-admin briefing feature is shelved.
 * Until one of those happens, daily_briefings rows only get created via
 * the on-demand /api/briefing/generate POST.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();

  // Pull every active admin — briefings are owner-scoped, team_members get
  // their agency's briefing via the owner-resolution in generateDailyBriefing.
  const { data: admins, error } = await service
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .eq("is_active", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let generated = 0;
  let failed = 0;

  for (const a of admins || []) {
    try {
      // We run with the service role here because we're iterating all users.
      // generateDailyBriefing only uses user_id as a scope key for queries —
      // it doesn't depend on RLS.
      //
      // (The SupabaseClient type from createSupabaseFromToken matches the
      // one the helper expects; service client works too.)
      await generateDailyBriefing(
        service as unknown as ReturnType<typeof createSupabaseFromToken>,
        a.id,
      );
      generated++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ success: true, generated, failed });
}
