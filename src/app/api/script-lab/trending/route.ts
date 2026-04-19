/**
 * Trending viral video research — hybrid Claude-generated research endpoint.
 *
 * The core research logic (prompt, parse, cache) lives in
 * `@/lib/viral-research` so the cron worker, scan-now endpoint, and this
 * on-demand POST all share a single implementation.
 *
 * For production: integrate YouTube Data API v3 (search.list with
 * order=viewCount + relevanceLanguage), TikTok Research API, and
 * Instagram Graph API to pull real trending content in the given niche.
 * For now Claude generates the research based on its training + current
 * awareness of trends in each niche/platform.
 *
 * Results are cached in `viral_research_cache` for 24h per
 * (user_id, niche, keywords_hash, platforms_hash) combo so the same
 * query doesn't re-prompt Claude on every click.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import { runResearch, ViralResearchError, type TrendingVideo } from "@/lib/viral-research";

// Re-exported for back-compat with any existing importers.
export type { TrendingVideo };

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("plan_tier").eq("id", user.id).single();
  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));

  try {
    const out = await runResearch(supabase, user.id, {
      niche: (body.niche as string | undefined) || "",
      keywords: Array.isArray(body.keywords) ? (body.keywords as string[]) : [],
      platforms: Array.isArray(body.platforms) ? (body.platforms as string[]) : [],
      limit: typeof body.limit === "number" ? body.limit : undefined,
      forceRefresh: Boolean(body.force_refresh),
    });

    if (out.cached) {
      return NextResponse.json({
        success: true,
        cached: true,
        cached_at: out.cached_at,
        expires_at: out.expires_at,
        videos: out.videos,
        count: out.videos.length,
      });
    }

    return NextResponse.json({
      success: true,
      cached: false,
      videos: out.videos,
      count: out.videos.length,
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
