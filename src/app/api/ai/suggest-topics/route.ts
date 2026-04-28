import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { anthropic, MODEL_HAIKU, safeJsonParse, getResponseText } from "@/lib/ai/claude-helpers";
import { checkAiRateLimit } from "@/lib/api-rate-limit";

/**
 * POST /api/ai/suggest-topics
 *
 * Surface-aware topic suggestions. The user types or hovers a tool
 * (Script Lab, Cold Email, Copywriter, Thumbnail Generator, etc.) and
 * sees N ranked topic ideas based on:
 *   - their business niche + onboarding answers
 *   - recent activity (last 7 days from trinity_log)
 *   - top-performing content (if content_calendar populated)
 *   - the specific surface (different angles for scripts vs cold email)
 *
 * Body:
 *   surface: SuggestSurface       // which tool is asking
 *   clientId?: string             // narrow context to a single client
 *   max?: number                  // 1..10, default 6
 *   regenerate?: boolean          // force fresh, ignore cache
 *
 * Returns: { suggestions: SuggestedTopic[] }
 */

type SuggestSurface =
  | "script_lab"
  | "cold_email"
  | "copywriter"
  | "thumbnail"
  | "ad_copy"
  | "email_composer"
  | "social_post"
  | "voice_studio";

interface SuggestedTopic {
  /** The topic text users will see and copy into the input. */
  topic: string;
  /** One-line "why now" that makes the suggestion non-generic. */
  reason: string;
  /** Predicted impact rank — for sort order + UI badge. */
  impact: "high" | "medium" | "low";
  /** Optional category tag for filtering. */
  category?: string;
}

interface SuggestResponse {
  suggestions: SuggestedTopic[];
  surface: SuggestSurface;
  generated_at: string;
}

const SURFACE_PROMPTS: Record<SuggestSurface, string> = {
  script_lab:
    "Suggest specific video / short-form / podcast SCRIPT topics this user should make next. Mix hook angles (contrarian take, transformation story, behind-the-scenes, top-mistakes-list, before/after).",
  cold_email:
    "Suggest specific COLD EMAIL angles for outreach: subject line + opening hook combos. Mix curiosity-led, social-proof-led, problem-led, gift-led.",
  copywriter:
    "Suggest specific COPY topics for blog/landing/long-form. Mix evergreen pillar pieces, response-to-objection pieces, and trend-hijack pieces.",
  thumbnail:
    "Suggest specific THUMBNAIL concepts (face emotion + bold text + visual contrast). One sentence per concept describing the image + the 3-5 word headline.",
  ad_copy:
    "Suggest specific AD COPY hooks for paid ads. Mix problem-aware, solution-aware, and direct-offer hooks. Each suggestion is a one-line hook + one-line body.",
  email_composer:
    "Suggest specific NEWSLETTER / broadcast email topics for nurture / launch / re-engagement. Specific to this user's audience.",
  social_post:
    "Suggest specific SOCIAL POST topics (LinkedIn / X / Instagram). Mix thought-leadership, swipe-file post, list-post, and contrarian.",
  voice_studio:
    "Suggest specific VOICE-MEMO scripts for outreach (cold-call openers, voicemail drops, DM voice notes). Each <30 seconds spoken.",
};

const SYSTEM_PROMPT = `You are a content strategist for marketing agencies and content creators.

You suggest specific, opinionated, non-generic topics for a single tool surface based on a user's business and recent activity. Topics MUST be concrete enough that someone could start writing today — not vague themes.

Constraints:
- Each suggestion has a 6-15 word "topic" string.
- Each "reason" is one short sentence saying why THIS topic for THIS user RIGHT NOW (cite their niche, recent gap, or top-performer).
- Diversify: don't repeat the same angle 3 times. Mix high/medium/low impact across the list.
- Avoid generic prompts like "10 tips for X" unless THE USER's niche makes that the right play.
- Tone: punchy, real. No corporate filler.

Return strict JSON only:
{
  "suggestions": [
    {
      "topic": "...",
      "reason": "...",
      "impact": "high" | "medium" | "low",
      "category": "..."
    }
  ]
}`;

const VALID_SURFACES = new Set<SuggestSurface>([
  "script_lab",
  "cold_email",
  "copywriter",
  "thumbnail",
  "ad_copy",
  "email_composer",
  "social_post",
  "voice_studio",
]);

/**
 * Cache key for storing the last batch of suggestions on the user's
 * profile so we can short-circuit repeat calls within the cache window.
 */
function cacheKey(surface: SuggestSurface, clientId?: string): string {
  return clientId ? `last_suggestions_${surface}_${clientId}` : `last_suggestions_${surface}`;
}

const CACHE_TTL_MS = 6 * 3600_000; // 6 hours

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = checkAiRateLimit(user.id);
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as {
    surface?: string;
    clientId?: string;
    max?: number;
    regenerate?: boolean;
  };

  const surface = body.surface as SuggestSurface | undefined;
  if (!surface || !VALID_SURFACES.has(surface)) {
    return NextResponse.json(
      { error: `Invalid surface. Expected one of: ${Array.from(VALID_SURFACES).join(", ")}` },
      { status: 400 },
    );
  }

  const max = Math.max(1, Math.min(10, body.max ?? 6));
  const regenerate = Boolean(body.regenerate);
  const clientId = body.clientId;

  const service = createServiceClient();

  // Pull profile + onboarding answers for niche/business/goals/pain points.
  const { data: profile } = await service
    .from("profiles")
    .select("user_type, onboarding_preferences, full_name, nickname")
    .eq("id", user.id)
    .single();

  const onboarding = (profile?.onboarding_preferences as Record<string, unknown>) || {};

  // Cache check — skip the LLM call if we have a fresh batch unless `regenerate`.
  const cached = onboarding[cacheKey(surface, clientId)] as
    | { generated_at: string; suggestions: SuggestedTopic[] }
    | undefined;
  if (!regenerate && cached?.generated_at) {
    const age = Date.now() - new Date(cached.generated_at).getTime();
    if (age < CACHE_TTL_MS && Array.isArray(cached.suggestions) && cached.suggestions.length > 0) {
      return NextResponse.json({
        suggestions: cached.suggestions.slice(0, max),
        surface,
        generated_at: cached.generated_at,
        cached: true,
      });
    }
  }

  // Optional client narrowing — pull industry / notes for that one client.
  let clientContext = "";
  if (clientId) {
    const { data: client } = await service
      .from("clients")
      .select("name, industry, notes, goals")
      .eq("id", clientId)
      .eq("profile_id", user.id)
      .maybeSingle();
    if (client) {
      clientContext = `
Targeting client: ${client.name}
Client industry: ${client.industry ?? "not specified"}
Client goals: ${typeof client.goals === "string" ? client.goals : JSON.stringify(client.goals ?? "")}
Client notes: ${(client.notes ?? "").slice(0, 400)}`;
    }
  }

  // Recent agency activity — what tools have they used lately?
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: recentActivity } = await service
    .from("trinity_log")
    .select("action_type, description, created_at")
    .eq("user_id", user.id)
    .gte("created_at", sevenDaysAgo)
    .order("created_at", { ascending: false })
    .limit(20);

  // Top-performing content from the calendar (if populated).
  const { data: topContent } = await service
    .from("content_calendar")
    .select("title, type, status, scheduled_at")
    .eq("user_id", user.id)
    .order("scheduled_at", { ascending: false })
    .limit(8);

  const contextBlob = `
SURFACE: ${surface}
SURFACE_DIRECTIVE: ${SURFACE_PROMPTS[surface]}

USER:
- Type: ${profile?.user_type ?? "agency"}
- Name: ${profile?.nickname ?? profile?.full_name ?? "there"}
- Business: ${(onboarding.business_name as string) ?? "not specified"}
- Niche: ${(onboarding.niche as string) ?? "not specified"}
- Goals: ${JSON.stringify(onboarding.goals ?? "not specified")}
- Pain points: ${JSON.stringify(onboarding.pain_points ?? "not specified")}
${clientContext}

RECENT ACTIVITY (last 7 days, most recent first):
${(recentActivity ?? []).slice(0, 12).map(a => `- ${a.action_type}: ${(a.description ?? "").slice(0, 80)}`).join("\n") || "(no activity yet)"}

RECENT CONTENT (last 8):
${(topContent ?? []).map(c => `- [${c.type}] ${c.title} (${c.status})`).join("\n") || "(none)"}

${regenerate ? "Note: User asked for FRESH suggestions. Avoid repeating obvious topics from above." : ""}

Return ${max} ranked suggestions for the SURFACE above.`;

  try {
    const resp = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 1500,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: contextBlob }],
    });

    const text = getResponseText(resp);
    const parsed = safeJsonParse<{ suggestions?: SuggestedTopic[] }>(text);

    if (!parsed?.suggestions || !Array.isArray(parsed.suggestions)) {
      return NextResponse.json({ error: "AI returned invalid format" }, { status: 502 });
    }

    // Defensive — keep only the fields we care about, cap to `max`, sort
    // high impact first while preserving model order within each tier.
    const rank: Record<SuggestedTopic["impact"], number> = { high: 0, medium: 1, low: 2 };
    const cleaned: SuggestedTopic[] = parsed.suggestions
      .filter(s => s && typeof s.topic === "string" && s.topic.trim())
      .map(s => ({
        topic: s.topic.trim(),
        reason: typeof s.reason === "string" ? s.reason.trim() : "",
        impact: (["high", "medium", "low"] as const).includes(s.impact) ? s.impact : "medium",
        category: typeof s.category === "string" ? s.category : undefined,
      }))
      .sort((a, b) => rank[a.impact] - rank[b.impact])
      .slice(0, max);

    if (cleaned.length === 0) {
      return NextResponse.json({ error: "AI returned no usable suggestions" }, { status: 502 });
    }

    const generated_at = new Date().toISOString();
    const out: SuggestResponse = { suggestions: cleaned, surface, generated_at };

    // Cache for repeat hits within TTL.
    try {
      await service
        .from("profiles")
        .update({
          onboarding_preferences: {
            ...onboarding,
            [cacheKey(surface, clientId)]: { generated_at, suggestions: cleaned },
          },
        })
        .eq("id", user.id);
    } catch (err) {
      console.warn("[ai-suggest-topics] profile cache update failed:", err);
    }

    return NextResponse.json(out);
  } catch (err) {
    console.error("[ai-suggest-topics] LLM call failed:", err);
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }
}
