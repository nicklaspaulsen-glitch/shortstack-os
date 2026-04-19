/**
 * Daily viral watchlist scanner.
 *
 *   vercel.json: { "path": "/api/cron/viral-scan", "schedule": "0 6 * * *" }
 *
 * For every active `viral_watchlists` row:
 *   1. Re-run the Claude research via `runResearch()` (forceRefresh=true so
 *      the 24h cache gets a fresh row, not a cache hit).
 *   2. Stamp last_scanned_at.
 *   3. If `alert_on_new = true` AND the refresh produced videos, fire a
 *      Telegram digest with the top 3 titles.
 *
 * Rate-limited per user via `checkAiRateLimit` — a plan-starved user with
 * 50 watchlists will have most of them skipped on this tick, which is fine:
 * they'll get picked up tomorrow (last_scanned_at ASC ordering means the
 * least-recently-scanned rows are tried first).
 *
 * Auth: fail-closed on Bearer CRON_SECRET — same pattern as every other
 * cron endpoint in this repo.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import { runResearch, ViralResearchError, type TrendingVideo } from "@/lib/viral-research";
import { sendTelegramDigest } from "@/lib/content-publish";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface WatchlistRow {
  id: string;
  user_id: string;
  name: string;
  niche: string;
  keywords: string[] | null;
  platforms: string[] | null;
  active: boolean;
  alert_on_new: boolean;
  last_scanned_at: string | null;
}

interface ScanResult {
  id: string;
  name: string;
  user_id: string;
  status: "refreshed" | "skipped" | "error";
  video_count?: number;
  error?: string;
}

export async function GET(request: NextRequest) {
  // Fail-closed CRON_SECRET gate.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Server misconfigured: CRON_SECRET not set" }, { status: 500 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Fetch every active watchlist, oldest-scanned-first so stale rows get
  // priority when we're close to the 5-minute Vercel ceiling.
  const { data: watchlists, error: listErr } = await supabase
    .from("viral_watchlists")
    .select("id, user_id, name, niche, keywords, platforms, active, alert_on_new, last_scanned_at")
    .eq("active", true)
    .order("last_scanned_at", { ascending: true, nullsFirst: true })
    .limit(500);

  if (listErr) {
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }

  const rows = (watchlists || []) as WatchlistRow[];
  const results: ScanResult[] = [];
  let refreshed = 0;
  let skipped = 0;
  let errors = 0;

  // Cache plan-tier per user so we don't refetch for every watchlist they own.
  const planByUser = new Map<string, string | null>();

  for (const w of rows) {
    try {
      let planTier: string | null;
      if (planByUser.has(w.user_id)) {
        planTier = planByUser.get(w.user_id) ?? null;
      } else {
        const { data: profile } = await supabase
          .from("profiles")
          .select("plan_tier")
          .eq("id", w.user_id)
          .maybeSingle();
        planTier = (profile?.plan_tier as string | null | undefined) ?? null;
        planByUser.set(w.user_id, planTier);
      }

      const limited = checkAiRateLimit(w.user_id, planTier);
      if (limited) {
        skipped++;
        results.push({ id: w.id, name: w.name, user_id: w.user_id, status: "skipped" });
        continue;
      }

      const out = await runResearch(supabase, w.user_id, {
        niche: w.niche,
        keywords: w.keywords || [],
        platforms: w.platforms || [],
        forceRefresh: true,
      });

      await supabase
        .from("viral_watchlists")
        .update({ last_scanned_at: new Date().toISOString() })
        .eq("id", w.id);

      refreshed++;
      results.push({
        id: w.id,
        name: w.name,
        user_id: w.user_id,
        status: "refreshed",
        video_count: out.videos.length,
      });

      // Optional Telegram digest — only when the watchlist opted in AND we got videos.
      if (w.alert_on_new && out.videos.length > 0) {
        const top3 = (out.videos as TrendingVideo[]).slice(0, 3).map(v => v.title).filter(Boolean);
        if (top3.length > 0) {
          await sendTelegramDigest(
            `*Trinity Viral Scan* — new trends for ${w.name}: ${top3.join(" • ")}`,
          );
        }
      }
    } catch (err) {
      errors++;
      const msg = err instanceof ViralResearchError ? err.message : String(err);
      results.push({ id: w.id, name: w.name, user_id: w.user_id, status: "error", error: msg });
    }
  }

  return NextResponse.json({
    success: true,
    processed: rows.length,
    refreshed,
    skipped,
    errors,
    results,
  });
}
