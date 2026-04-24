import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, createSupabaseFromToken } from "@/lib/supabase/server";
import { generateDailyBriefing } from "@/lib/services/daily-briefing";

export const maxDuration = 120;

/**
 * GET /api/cron/daily-briefing
 * Nightly sweep — generates a daily briefing for every active admin.
 * Configured in vercel.json to run at 07:00 UTC.
 *
 * Auth: requires `Authorization: Bearer <CRON_SECRET>` header, matching
 * the existing cron pattern used by /api/cron/daily-brief etc.
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
