import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import { safeJsonParse } from "@/lib/ai/claude-helpers";
import { callLLM } from "@/lib/ai/llm-router";
import { pickRecommendedTimes } from "@/lib/social-studio/time-recommender";
import { ALL_PLATFORMS, FALLBACK_HASHTAGS } from "@/lib/social-studio/constants";
import type {
  AutoUploadSuggestions,
  CaptionVariation,
  SocialPlatform,
} from "@/lib/social-studio/types";

/**
 * POST /api/social/auto-upload
 *
 * Drag-drop media → AI handles the rest. Body shape:
 * {
 *   media_url?: string,
 *   media_kind?: "image" | "video" | "text",
 *   text?: string,         // for text-only posts
 *   tone?: string,         // optional "professional" / "playful" / etc.
 *   target_platforms?: SocialPlatform[]  // optional caller hint
 * }
 *
 * Returns AutoUploadSuggestions — recommended platforms, suggested send
 * times, 3 caption variations per platform, 8-15 hashtags per platform.
 */
type AutoUploadRequest = {
  media_url?: string;
  media_kind?: "image" | "video" | "text";
  text?: string;
  tone?: string;
  target_platforms?: SocialPlatform[];
};

interface ClaudeAnalysis {
  asset_summary: string;
  recommended_platforms: SocialPlatform[];
  captions: Partial<Record<SocialPlatform, Array<{ text: string; rationale: string }>>>;
  hashtags: Partial<Record<SocialPlatform, string[]>>;
}

const SYSTEM_PROMPT = `You are a social media strategist for an agency operating system. The user just dropped a piece of content (an image URL, a video URL, or a block of text) and wants it scheduled across the platforms it will perform best on.

Your job:
1. Briefly summarise the asset.
2. Recommend the top 3-5 platforms (from: instagram, tiktok, linkedin, facebook, twitter, youtube, pinterest, threads).
3. Per recommended platform produce exactly 3 caption variations: one direct/benefit-led, one story-driven, one witty/punchy. Each must respect the platform's character feel (LinkedIn: professional, TikTok: casual, X: short).
4. Per recommended platform produce 8-15 hashtags ranked by relevance.

Return STRICT JSON. No prose, no markdown fences. Schema:
{
  "asset_summary": "string",
  "recommended_platforms": ["instagram", ...],
  "captions": {
    "instagram": [
      { "text": "string", "rationale": "string" },
      { "text": "string", "rationale": "string" },
      { "text": "string", "rationale": "string" }
    ]
  },
  "hashtags": {
    "instagram": ["#tag", "#tag", ...]
  }
}`;

function buildPrompt(input: AutoUploadRequest): string {
  const lines: string[] = [];
  if (input.text) {
    lines.push(`Source text the user dropped:\n${input.text}`);
  }
  if (input.media_url) {
    lines.push(`Media URL: ${input.media_url}`);
    lines.push(`Media kind: ${input.media_kind ?? "unknown"}`);
  }
  if (input.tone) {
    lines.push(`Preferred tone: ${input.tone}`);
  }
  if (input.target_platforms && input.target_platforms.length > 0) {
    lines.push(`User has already pre-selected these platforms (consider them seriously): ${input.target_platforms.join(", ")}`);
  }
  if (lines.length === 0) {
    lines.push("(No content provided — produce a generic best-practice template the user can edit.)");
  }
  return lines.join("\n\n");
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit AI usage by plan.
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", user.id)
    .single();
  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  let body: AutoUploadRequest;
  try {
    body = (await request.json()) as AutoUploadRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Reject completely empty payload — caller must provide at least one of
  // media_url, text, or target_platforms.
  if (!body.media_url && !body.text && (!body.target_platforms || body.target_platforms.length === 0)) {
    return NextResponse.json(
      { error: "Provide media_url, text, or target_platforms" },
      { status: 400 },
    );
  }

  let analysis: ClaudeAnalysis | null = null;

  try {
    const response = await callLLM({
      // Caption generation across platforms — Haiku is plenty.
      taskType: "caption_generation",
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildPrompt(body),
      maxTokens: 2400,
      userId: user.id,
      context: "/api/social/auto-upload",
    });
    analysis = safeJsonParse<ClaudeAnalysis>(response.text);
  } catch (err) {
    console.error("[social-studio/auto-upload] llm error", err);
    // Fall through to deterministic fallback.
  }

  // Deterministic fallback if Claude fails or returns junk. Keeps the UX
  // resilient — the user always gets something usable to edit.
  if (!analysis || !Array.isArray(analysis.recommended_platforms) || analysis.recommended_platforms.length === 0) {
    const fallbackPlatforms: SocialPlatform[] =
      body.target_platforms && body.target_platforms.length > 0
        ? body.target_platforms
        : ["instagram", "linkedin", "twitter"];

    analysis = {
      asset_summary: body.text
        ? body.text.slice(0, 240)
        : "Uploaded asset — caption and hashtags fallback (AI unavailable).",
      recommended_platforms: fallbackPlatforms,
      captions: Object.fromEntries(
        fallbackPlatforms.map((p) => [
          p,
          [
            { text: body.text ?? "Fresh drop. Tap in and let me know what you think.", rationale: "Direct hook — works on most platforms." },
            { text: body.text ?? "Story I keep coming back to: [your story here]. Saving this one for later.", rationale: "Story-driven variant." },
            { text: body.text ?? "If you liked this, you'll love what's coming next.", rationale: "Punchy CTA variant." },
          ],
        ])
      ),
      hashtags: Object.fromEntries(
        fallbackPlatforms.map((p) => [p, FALLBACK_HASHTAGS[p].slice(0, 10)]),
      ),
    };
  }

  // Validate Claude output shape — drop any platform we don't know.
  const cleanedPlatforms = analysis.recommended_platforms.filter((p): p is SocialPlatform =>
    ALL_PLATFORMS.includes(p as SocialPlatform)
  );

  // Normalise captions — promote to CaptionVariation with stable variant numbers.
  const captionsOut: AutoUploadSuggestions["captions_per_platform"] = {};
  for (const platform of cleanedPlatforms) {
    const raw = analysis.captions?.[platform];
    if (!raw) continue;
    captionsOut[platform] = raw.slice(0, 3).map((c, idx): CaptionVariation => ({
      variant: idx + 1,
      text: typeof c.text === "string" ? c.text : "",
      rationale: typeof c.rationale === "string" ? c.rationale : "",
    }));
  }

  // Hashtags — clamp to 15 + ensure leading #, fallback when missing.
  const hashtagsOut: AutoUploadSuggestions["hashtags_per_platform"] = {};
  for (const platform of cleanedPlatforms) {
    const raw = Array.isArray(analysis.hashtags?.[platform])
      ? (analysis.hashtags?.[platform] as string[])
      : FALLBACK_HASHTAGS[platform];
    const tags = raw
      .slice(0, 15)
      .map((t) => (t.startsWith("#") ? t : `#${t}`))
      .filter((t) => t.length > 1);
    hashtagsOut[platform] = tags.length > 0 ? tags : FALLBACK_HASHTAGS[platform].slice(0, 10);
  }

  const times = pickRecommendedTimes(cleanedPlatforms);

  const suggestions: AutoUploadSuggestions = {
    platforms_recommended: cleanedPlatforms,
    times_recommended: times,
    captions_per_platform: captionsOut,
    hashtags_per_platform: hashtagsOut,
    asset_summary: analysis.asset_summary || "",
  };

  return NextResponse.json(suggestions);
}
