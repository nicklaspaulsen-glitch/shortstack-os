/**
 * Trending viral video research — hybrid Claude-generated research endpoint.
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
import crypto from "crypto";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import { anthropic, MODEL_HAIKU, safeJsonParse, getResponseText } from "@/lib/ai/claude-helpers";

export interface TrendingVideo {
  id: string;
  title: string;
  creator_name: string;
  creator_handle: string;
  platform: string; // youtube | tiktok | instagram | shorts
  thumbnail_hint: string; // a short vivid description used to render a thumbnail placeholder
  thumbnail_emoji?: string; // single emoji that represents the video visually
  view_count: number;
  view_count_label: string; // "1.2M", "347K", etc
  published_days_ago: number;
  engagement_rate: number; // percent, 0-100
  duration_sec: number;
  hook: string;
  why_trending: string;
  keywords_used: string[];
  url_hint: string; // e.g. "https://www.youtube.com/results?search_query=..." — a searchable link
}

const ALLOWED_PLATFORMS = ["youtube", "tiktok", "instagram", "shorts"] as const;

function normKeywordHash(arr: string[]): string {
  const clean = arr.map(s => s.trim().toLowerCase()).filter(Boolean).sort();
  return crypto.createHash("md5").update(clean.join("|")).digest("hex");
}

function normPlatformHash(arr: string[]): string {
  const clean = arr.map(s => s.trim().toLowerCase()).filter(Boolean).sort();
  return crypto.createHash("md5").update(clean.join("|")).digest("hex");
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("plan_tier").eq("id", user.id).single();
  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const nicheRaw = (body.niche as string | undefined) || "";
  const keywordsRaw = Array.isArray(body.keywords) ? (body.keywords as string[]) : [];
  const platformsRaw = Array.isArray(body.platforms) ? (body.platforms as string[]) : [];
  const limit = Math.min(Math.max(Number(body.limit) || 30, 5), 40);
  const forceRefresh = Boolean(body.force_refresh);

  const niche = nicheRaw.trim().toLowerCase();
  if (!niche) {
    return NextResponse.json({ error: "niche is required" }, { status: 400 });
  }

  const keywords = keywordsRaw.map(k => String(k).trim()).filter(Boolean).slice(0, 20);
  const platforms = (platformsRaw.length ? platformsRaw : ["youtube", "tiktok", "instagram"])
    .map(p => String(p).trim().toLowerCase())
    .filter(p => (ALLOWED_PLATFORMS as readonly string[]).includes(p));

  const keywordsHash = normKeywordHash(keywords);
  const platformsHash = normPlatformHash(platforms);

  // Check cache first (unless force_refresh)
  if (!forceRefresh) {
    const { data: cached } = await supabase
      .from("viral_research_cache")
      .select("id, results, created_at, expires_at")
      .eq("user_id", user.id)
      .eq("niche", niche)
      .eq("keywords_hash", keywordsHash)
      .eq("platforms_hash", platformsHash)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached?.results) {
      return NextResponse.json({
        success: true,
        cached: true,
        cached_at: cached.created_at,
        expires_at: cached.expires_at,
        videos: cached.results,
        count: Array.isArray(cached.results) ? cached.results.length : 0,
      });
    }
  }

  // Build prompt — ask Claude to generate realistic trending video data
  const platformList = platforms.length ? platforms.join(", ") : "youtube, tiktok, instagram reels";
  const keywordLine = keywords.length ? `Keywords the client is targeting: ${keywords.join(", ")}` : "No specific keywords — infer from niche.";

  const prompt = `You are a viral content research analyst. Given a niche, keywords, and platforms, generate a realistic list of ${limit} videos that would be trending today in that niche.

NICHE: ${niche}
${keywordLine}
PLATFORMS: ${platformList}

For each video, return a realistic entry that could plausibly exist on that platform right now. Draw from real creator archetypes, real viral hook patterns working in that niche today, and real engagement dynamics for each platform. Do NOT invent brand names that are clearly fictional — use plausible creator handles.

Return ONLY a JSON array of exactly ${limit} items (no markdown, no prose), each item matching this schema:
{
  "title": "the video's actual title / caption as it would appear on-platform",
  "creator_name": "display name of the creator",
  "creator_handle": "@handle",
  "platform": "one of: youtube, tiktok, instagram, shorts",
  "thumbnail_hint": "short vivid description of the thumbnail frame (8-16 words) — used to render a stylised placeholder",
  "thumbnail_emoji": "one emoji that captures the vibe",
  "view_count": realistic integer (tiktok typically 100K-10M, youtube 50K-5M, instagram 30K-2M),
  "view_count_label": "human readable (e.g. 1.2M, 347K)",
  "published_days_ago": integer 0-14 (today=0, max two weeks),
  "engagement_rate": number 2-18 (percent),
  "duration_sec": integer (shorts/tiktok 15-90, youtube long 300-900),
  "hook": "the exact first 3 seconds / opening line, proven pattern",
  "why_trending": "1-2 sentences: psychological trigger + algorithm signal (curiosity gap, controversy, pattern interrupt, trending sound, etc)",
  "keywords_used": ["3-5 keywords this video is ranking for"],
  "url_hint": "a sensible searchable link — e.g. https://www.youtube.com/results?search_query=<urlencoded_title> or https://www.tiktok.com/search?q=<urlencoded_title>"
}

Rules:
- Spread across the requested platforms proportionally
- Variety in view counts (don't cluster around the same number)
- Mix of published_days_ago — some from today, some from earlier this week
- Hooks must be punchy, platform-native, first-person where natural
- Titles should feel natural for each platform (TikTok/Reels: short + emoji, YouTube: searchable + benefit-driven)
- Engagement rate: TikTok 8-18%, Reels 4-10%, YouTube Shorts 3-8%, YouTube long-form 2-6%`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 6000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = getResponseText(response);
    const parsed = safeJsonParse<Array<Record<string, unknown>>>(text);

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return NextResponse.json({ error: "Failed to parse trending results", raw: text.slice(0, 500) }, { status: 500 });
    }

    // Normalise each video with stable id + fallback values
    const videos: TrendingVideo[] = parsed.slice(0, limit).map((v, i) => {
      const rawPlatform = String(v.platform || platforms[0] || "tiktok").toLowerCase();
      const plat = (ALLOWED_PLATFORMS as readonly string[]).includes(rawPlatform) ? rawPlatform : "tiktok";
      const viewCount = typeof v.view_count === "number" ? Math.round(v.view_count) : 0;

      return {
        id: `${Date.now()}_${i}_${crypto.randomBytes(3).toString("hex")}`,
        title: String(v.title || "Untitled trending video"),
        creator_name: String(v.creator_name || "Unknown Creator"),
        creator_handle: String(v.creator_handle || "@creator"),
        platform: plat,
        thumbnail_hint: String(v.thumbnail_hint || ""),
        thumbnail_emoji: String(v.thumbnail_emoji || "🔥"),
        view_count: viewCount,
        view_count_label: String(v.view_count_label || formatViews(viewCount)),
        published_days_ago: typeof v.published_days_ago === "number" ? Math.max(0, Math.round(v.published_days_ago)) : 1,
        engagement_rate: typeof v.engagement_rate === "number" ? Math.max(0, Math.min(100, v.engagement_rate)) : 5,
        duration_sec: typeof v.duration_sec === "number" ? Math.max(1, Math.round(v.duration_sec)) : 30,
        hook: String(v.hook || ""),
        why_trending: String(v.why_trending || ""),
        keywords_used: Array.isArray(v.keywords_used) ? v.keywords_used.map(String).slice(0, 8) : [],
        url_hint: String(v.url_hint || ""),
      };
    });

    // Cache result — fire-and-forget-ish (await so we get the insert error if any but don't fail the request)
    const { error: cacheErr } = await supabase.from("viral_research_cache").insert({
      user_id: user.id,
      niche,
      keywords_hash: keywordsHash,
      platforms_hash: platformsHash,
      keywords,
      platforms,
      results: videos,
      result_count: videos.length,
    });

    return NextResponse.json({
      success: true,
      cached: false,
      videos,
      count: videos.length,
      cache_error: cacheErr?.message || null,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}
