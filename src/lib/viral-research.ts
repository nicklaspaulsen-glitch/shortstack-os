/**
 * Viral Research — shared helper for generating trending video lists.
 *
 * Used by:
 *   - POST /api/script-lab/trending        (on-demand user search)
 *   - POST /api/viral/watchlists/[id]/scan-now  (manual watchlist refresh)
 *   - GET  /api/cron/viral-scan             (daily cron worker)
 *
 * The logic is:
 *   1. Normalise niche/keywords/platforms + hash the latter two
 *   2. Look up `viral_research_cache` for a non-expired hit (skippable via forceRefresh)
 *   3. On miss, prompt Claude Haiku for `limit` realistic trending videos
 *   4. Parse, sanitise, and cache the results in `viral_research_cache`
 *
 * Works with either a cookie-scoped supabase client (user routes) or a
 * service-role client (cron) — the caller provides the client + user_id.
 */
import crypto from "crypto";
import { SupabaseClient } from "@supabase/supabase-js";
import { anthropic, MODEL_HAIKU, safeJsonParse, getResponseText } from "@/lib/ai/claude-helpers";

export interface TrendingVideo {
  id: string;
  title: string;
  creator_name: string;
  creator_handle: string;
  platform: string; // youtube | tiktok | instagram | shorts
  thumbnail_hint: string;
  thumbnail_emoji?: string;
  view_count: number;
  view_count_label: string;
  published_days_ago: number;
  engagement_rate: number;
  duration_sec: number;
  hook: string;
  why_trending: string;
  keywords_used: string[];
  url_hint: string;
}

export const ALLOWED_PLATFORMS = ["youtube", "tiktok", "instagram", "shorts"] as const;

export function normKeywordHash(arr: string[]): string {
  const clean = arr.map(s => s.trim().toLowerCase()).filter(Boolean).sort();
  return crypto.createHash("md5").update(clean.join("|")).digest("hex");
}

export function normPlatformHash(arr: string[]): string {
  const clean = arr.map(s => s.trim().toLowerCase()).filter(Boolean).sort();
  return crypto.createHash("md5").update(clean.join("|")).digest("hex");
}

export function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export interface ResearchInput {
  niche: string;
  keywords: string[];
  platforms: string[];
  limit?: number;
  forceRefresh?: boolean;
}

export interface ResearchOutput {
  videos: TrendingVideo[];
  cached: boolean;
  cached_at?: string;
  expires_at?: string;
  cache_error?: string | null;
}

export class ViralResearchError extends Error {
  public readonly status: number;
  public readonly raw?: string;
  constructor(message: string, status = 500, raw?: string) {
    super(message);
    this.status = status;
    this.raw = raw;
  }
}

/**
 * Canonicalise user-supplied input for both the cache lookup and the Claude prompt.
 */
export function canonicaliseInput(input: ResearchInput): {
  niche: string;
  keywords: string[];
  platforms: string[];
  limit: number;
  keywordsHash: string;
  platformsHash: string;
} {
  const niche = (input.niche || "").trim().toLowerCase();
  if (!niche) throw new ViralResearchError("niche is required", 400);

  const keywords = (input.keywords || [])
    .map(k => String(k).trim())
    .filter(Boolean)
    .slice(0, 20);

  const platforms = ((input.platforms && input.platforms.length
    ? input.platforms
    : ["youtube", "tiktok", "instagram"]) as string[])
    .map(p => String(p).trim().toLowerCase())
    .filter(p => (ALLOWED_PLATFORMS as readonly string[]).includes(p));

  const limit = Math.min(Math.max(Number(input.limit) || 30, 5), 40);

  return {
    niche,
    keywords,
    platforms,
    limit,
    keywordsHash: normKeywordHash(keywords),
    platformsHash: normPlatformHash(platforms),
  };
}

/**
 * Look up a non-expired cache row. Returns the stored videos or null.
 */
export async function getCachedResearch(
  supabase: SupabaseClient,
  userId: string,
  niche: string,
  keywordsHash: string,
  platformsHash: string,
): Promise<{ videos: TrendingVideo[]; created_at: string; expires_at: string } | null> {
  const { data } = await supabase
    .from("viral_research_cache")
    .select("results, created_at, expires_at")
    .eq("user_id", userId)
    .eq("niche", niche)
    .eq("keywords_hash", keywordsHash)
    .eq("platforms_hash", platformsHash)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.results) return null;
  const videos = Array.isArray(data.results) ? (data.results as TrendingVideo[]) : [];
  return { videos, created_at: data.created_at as string, expires_at: data.expires_at as string };
}

/**
 * Prompt Claude for a fresh list of trending videos. Throws ViralResearchError
 * if the ANTHROPIC_API_KEY is missing or the model returns unparseable junk.
 */
export async function fetchFreshResearch(params: {
  niche: string;
  keywords: string[];
  platforms: string[];
  limit: number;
}): Promise<TrendingVideo[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ViralResearchError("AI not configured", 500);
  }

  const { niche, keywords, platforms, limit } = params;
  const platformList = platforms.length ? platforms.join(", ") : "youtube, tiktok, instagram reels";
  const keywordLine = keywords.length
    ? `Keywords the client is targeting: ${keywords.join(", ")}`
    : "No specific keywords — infer from niche.";

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

  const response = await anthropic.messages.create({
    model: MODEL_HAIKU,
    max_tokens: 6000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = getResponseText(response);
  const parsed = safeJsonParse<Array<Record<string, unknown>>>(text);

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new ViralResearchError("Failed to parse trending results", 500, text.slice(0, 500));
  }

  const fallbackPlat = platforms[0] || "tiktok";

  return parsed.slice(0, limit).map((v, i) => {
    const rawPlatform = String(v.platform || fallbackPlat).toLowerCase();
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
      keywords_used: Array.isArray(v.keywords_used) ? (v.keywords_used as unknown[]).map(String).slice(0, 8) : [],
      url_hint: String(v.url_hint || ""),
    };
  });
}

/**
 * Write a new cache row. Does not throw — returns the (optional) error message.
 */
export async function writeCacheRow(
  supabase: SupabaseClient,
  userId: string,
  niche: string,
  keywords: string[],
  platforms: string[],
  keywordsHash: string,
  platformsHash: string,
  videos: TrendingVideo[],
): Promise<string | null> {
  const { error } = await supabase.from("viral_research_cache").insert({
    user_id: userId,
    niche,
    keywords_hash: keywordsHash,
    platforms_hash: platformsHash,
    keywords,
    platforms,
    results: videos,
    result_count: videos.length,
  });
  return error?.message || null;
}

/**
 * End-to-end: canonicalise → cache-lookup → (optional) fresh fetch → cache-write.
 *
 * Throws ViralResearchError on invalid input or AI failures. Callers should
 * translate these into NextResponse shapes (status + error message).
 */
export async function runResearch(
  supabase: SupabaseClient,
  userId: string,
  input: ResearchInput,
): Promise<ResearchOutput> {
  const canon = canonicaliseInput(input);

  if (!input.forceRefresh) {
    const cached = await getCachedResearch(
      supabase,
      userId,
      canon.niche,
      canon.keywordsHash,
      canon.platformsHash,
    );
    if (cached) {
      return {
        videos: cached.videos,
        cached: true,
        cached_at: cached.created_at,
        expires_at: cached.expires_at,
      };
    }
  }

  const videos = await fetchFreshResearch({
    niche: canon.niche,
    keywords: canon.keywords,
    platforms: canon.platforms,
    limit: canon.limit,
  });

  const cacheError = await writeCacheRow(
    supabase,
    userId,
    canon.niche,
    canon.keywords,
    canon.platforms,
    canon.keywordsHash,
    canon.platformsHash,
    videos,
  );

  return {
    videos,
    cached: false,
    cache_error: cacheError,
  };
}
