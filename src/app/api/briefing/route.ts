import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/briefing
 * Returns today's daily briefing (if any) plus the archive of the past 14
 * days. The UI shows today at the top and archive below.
 */
export async function GET(_req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date().toISOString().slice(0, 10);
  const twoWeeksAgo = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);

  const [{ data: todayBriefing }, { data: archive }] = await Promise.all([
    supabase
      .from("daily_briefings")
      .select("*")
      .eq("user_id", user.id)
      .eq("briefing_date", today)
      .maybeSingle(),
    supabase
      .from("daily_briefings")
      .select("id, briefing_date, summary_markdown, generated_at")
      .eq("user_id", user.id)
      .gte("briefing_date", twoWeeksAgo)
      .order("briefing_date", { ascending: false }),
  ]);

  return NextResponse.json({
    today: todayBriefing || null,
    archive: archive || [],
  });
}

/**
 * POST /api/briefing
 * On-demand generation — same behavior as /api/briefing/generate but lives
 * at the root route so the UI can hit a single endpoint. Safe to call
 * repeatedly; upserts on (user_id, briefing_date).
 */
export async function POST(_req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Import lazily — keeps the GET path cheap.
  const { generateDailyBriefing } = await import("@/lib/services/daily-briefing");
  try {
    const briefing = await generateDailyBriefing(supabase, user.id);
    return NextResponse.json({ success: true, briefing });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to generate" },
      { status: 500 },
    );
  }
}
