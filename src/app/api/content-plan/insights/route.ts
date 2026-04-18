import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { anthropic, MODEL_HAIKU, safeJsonParse, getResponseText } from "@/lib/ai/claude-helpers";
import { checkAiRateLimit } from "@/lib/api-rate-limit";

/**
 * GET /api/content-plan/insights
 *
 * Analyzes the user's recent content_calendar entries with Claude Haiku
 * and returns:
 *   - top_performing[]
 *   - trending_topics[]
 *   - needs_attention[]
 *   - thumbnail_suggestions[]
 *
 * The system prompt uses prompt caching (ephemeral cache_control) so that
 * repeated calls for the same account are cheaper.
 */

const SYSTEM_PROMPT = `You are a social media content strategist. You analyze a user's recent posts (across Instagram, TikTok, LinkedIn, Facebook, YouTube, X) and return a JSON analysis with four sections.

Return ONLY valid JSON matching this schema:
{
  "top_performing": [
    { "post_id": "string", "title": "string", "platform": "string", "why": "one sentence on why it worked", "engagement_score": 0-100 }
  ],
  "trending_topics": [
    { "topic": "string", "why_trending": "string", "content_angle": "suggested angle for this niche", "urgency": "high" | "medium" | "low" }
  ],
  "needs_attention": [
    { "post_id": "string", "title": "string", "platform": "string", "reason": "low engagement / bounced comments / stale", "action": "what to do" }
  ],
  "thumbnail_suggestions": [
    { "post_id": "string", "title": "string", "current_issue": "why the thumbnail likely hurt CTR", "suggestion": "what a better thumbnail would look like" }
  ]
}

Keep each list to a MAX of 5 items. Be specific and actionable. If there is no data for a section, return an empty array.`;

interface PostInput {
  id: string;
  title: string;
  platform: string;
  status: string;
  posted_at: string | null;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  top_comment: { text: string; sentiment?: string } | null;
  caption: string | null;
}

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("plan_tier").eq("id", user.id).single();
  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

  const url = request.nextUrl;
  const niche = url.searchParams.get("niche") || "general digital creators";

  // Fetch the user's clients → then recent posts (clients.profile_id owns the client row)
  const { data: clientRows } = await supabase.from("clients").select("id, industry").eq("profile_id", ownerId);
  const clientIds = (clientRows || []).map(c => c.id);
  const derivedNiche = (clientRows || []).find(c => c.industry)?.industry || niche;

  if (clientIds.length === 0) {
    return NextResponse.json({
      top_performing: [],
      trending_topics: [],
      needs_attention: [],
      thumbnail_suggestions: [],
      source: "empty",
    });
  }

  const { data: rows } = await supabase
    .from("content_calendar")
    .select("id, title, platform, status, scheduled_at, published_at, content_script_id, notes")
    .in("client_id", clientIds)
    .order("scheduled_at", { ascending: false })
    .limit(60);

  const scriptIds = Array.from(new Set((rows || []).map(r => r.content_script_id).filter(Boolean))) as string[];
  let scripts: Record<string, string> = {};
  if (scriptIds.length > 0) {
    const { data: scriptRows } = await supabase
      .from("content_scripts")
      .select("id, hook, script_body")
      .in("id", scriptIds);
    scripts = Object.fromEntries((scriptRows || []).map(s => [s.id, (s.script_body || s.hook || "").slice(0, 220)]));
  }

  const posts: PostInput[] = (rows || []).map(r => {
    const meta = (r as unknown as { metadata?: Record<string, unknown>; engagement_data?: Record<string, unknown> }).metadata
      || (r as unknown as { engagement_data?: Record<string, unknown> }).engagement_data
      || {};
    const topCommentRaw = (meta as Record<string, unknown>).top_comment;
    const top_comment = typeof topCommentRaw === "object" && topCommentRaw
      ? { text: String((topCommentRaw as Record<string, unknown>).text || ""), sentiment: String((topCommentRaw as Record<string, unknown>).sentiment || "neutral") }
      : null;
    return {
      id: r.id,
      title: r.title,
      platform: r.platform,
      status: r.status,
      posted_at: r.published_at,
      likes: toNum((meta as Record<string, unknown>).likes) ?? 0,
      comments: toNum((meta as Record<string, unknown>).comments) ?? 0,
      shares: toNum((meta as Record<string, unknown>).shares) ?? 0,
      views: toNum((meta as Record<string, unknown>).views) ?? 0,
      top_comment,
      caption: r.content_script_id ? (scripts[r.content_script_id] || r.notes) : r.notes,
    };
  });

  if (posts.length === 0) {
    return NextResponse.json({
      top_performing: [],
      trending_topics: [],
      needs_attention: [],
      thumbnail_suggestions: [],
      source: "empty",
    });
  }

  const compact = posts.slice(0, 30).map(p => ({
    id: p.id,
    title: p.title,
    platform: p.platform,
    status: p.status,
    posted_at: p.posted_at,
    stats: { likes: p.likes, comments: p.comments, shares: p.shares, views: p.views },
    top_comment: p.top_comment?.text || null,
    caption_snippet: (p.caption || "").slice(0, 180),
  }));

  const userPrompt = `Niche: ${derivedNiche}

Recent posts (JSON):
${JSON.stringify(compact, null, 2)}

Produce the JSON analysis per the schema. Use the exact post "id" values above in the post_id fields. Be concise and actionable.`;

  try {
    const resp = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 1800,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = getResponseText(resp);
    const parsed = safeJsonParse<{
      top_performing: Array<{ post_id: string; title: string; platform: string; why: string; engagement_score: number }>;
      trending_topics: Array<{ topic: string; why_trending: string; content_angle: string; urgency: string }>;
      needs_attention: Array<{ post_id: string; title: string; platform: string; reason: string; action: string }>;
      thumbnail_suggestions: Array<{ post_id: string; title: string; current_issue: string; suggestion: string }>;
    }>(text);

    if (!parsed) {
      return NextResponse.json({
        top_performing: [],
        trending_topics: [],
        needs_attention: [],
        thumbnail_suggestions: [],
        source: "parse_error",
      });
    }

    return NextResponse.json({
      top_performing: parsed.top_performing?.slice(0, 5) || [],
      trending_topics: parsed.trending_topics?.slice(0, 5) || [],
      needs_attention: parsed.needs_attention?.slice(0, 5) || [],
      thumbnail_suggestions: parsed.thumbnail_suggestions?.slice(0, 5) || [],
      source: "claude-haiku",
      analyzed_posts: compact.length,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

function toNum(v: unknown): number | null {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}
