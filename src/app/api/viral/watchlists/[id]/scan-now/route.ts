/**
 * /api/viral/watchlists/[id]/scan-now — manually trigger a refresh for one
 * watchlist. Equivalent to what the daily cron does per-row: re-runs the
 * Claude research, updates the cache, and stamps last_scanned_at.
 *
 * Same rate-limit as /api/script-lab/trending POST so free users can't loop
 * this to hammer Claude.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import { runResearch, ViralResearchError } from "@/lib/viral-research";

export const maxDuration = 60;

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("plan_tier").eq("id", user.id).single();
  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  const { data: watchlist, error: fetchErr } = await supabase
    .from("viral_watchlists")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!watchlist) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const out = await runResearch(supabase, user.id, {
      niche: watchlist.niche,
      keywords: watchlist.keywords || [],
      platforms: watchlist.platforms || [],
      forceRefresh: true, // scan-now always refreshes
    });

    // Stamp last_scanned_at — best-effort, ignore errors so we still return data.
    await supabase
      .from("viral_watchlists")
      .update({ last_scanned_at: new Date().toISOString() })
      .eq("id", watchlist.id)
      .eq("user_id", user.id);

    return NextResponse.json({
      success: true,
      watchlist_id: watchlist.id,
      videos: out.videos,
      count: out.videos.length,
      cached: out.cached,
      cache_error: out.cache_error ?? null,
    });
  } catch (err) {
    if (err instanceof ViralResearchError) {
      const body: Record<string, unknown> = { error: err.message };
      if (err.raw) body.raw = err.raw;
      return NextResponse.json(body, { status: err.status });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
