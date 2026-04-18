import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { anthropic, MODEL_HAIKU, safeJsonParse, getResponseText } from "@/lib/ai/claude-helpers";
import { checkAiRateLimit } from "@/lib/api-rate-limit";

/**
 * POST — Generate AI-powered recommendations on what the user should create next.
 * Personalized based on their business type, onboarding answers, and recent activity.
 *
 * Returns ranked list of recommended actions (videos, thumbnails, scripts, emails,
 * social posts, etc.) with "Why this" reasoning + one-click execution payload.
 */

interface Recommendation {
  id: string;
  type: "video" | "thumbnail" | "script" | "email" | "social_post" | "blog" | "carousel" | "landing_page" | "cold_call" | "dm_campaign";
  title: string;
  description: string;
  reason: string;       // why this is recommended right now
  impact: "high" | "medium" | "low";
  effort: "quick" | "medium" | "deep";   // 5 min / 30 min / 2+ hrs
  icon: string;          // lucide icon name
  action_href: string;   // where to go
  prefilled?: Record<string, unknown>;  // data to auto-populate
}

const SYSTEM_PROMPT = `You are an AI content strategist for marketing agencies and content creators.
Given context about a user's business, their goals, and recent activity, recommend 6-8 specific creative/marketing tasks they should do NEXT to move the needle.

Consider:
- What they haven't done yet vs. what they've done lately (diversify)
- What's high-impact for their business type (agency vs creator vs ecommerce vs saas)
- Trending content types in their niche
- Quick wins (short effort, high impact) first
- Mix content types (video, thumbnail, email, script, social)

Return strict JSON only:
{
  "recommendations": [
    {
      "id": "unique-slug",
      "type": "video" | "thumbnail" | "script" | "email" | "social_post" | "blog" | "carousel" | "landing_page" | "cold_call" | "dm_campaign",
      "title": "Specific task headline (10 words max)",
      "description": "What to make, 1-2 sentences",
      "reason": "Why now — specific to their recent activity or gap",
      "impact": "high" | "medium" | "low",
      "effort": "quick" | "medium" | "deep",
      "icon": "Film" | "Image" | "FileText" | "Mail" | "Send" | "Megaphone" | "Phone" | "LayoutTemplate" | "Layers",
      "action_href": "/dashboard/ai-video" | "/dashboard/thumbnail-generator" | "/dashboard/script-lab" | "/dashboard/email-composer" | "/dashboard/social-manager" | "/dashboard/newsletter" | "/dashboard/carousel-generator" | "/dashboard/landing-pages" | "/dashboard/eleven-agents" | "/dashboard/dm-controller",
      "prefilled": { "topic": "...", "style": "..." }
    }
  ],
  "overall_theme": "One-line strategy summary",
  "priority_focus": "What to tackle first and why (one sentence)"
}`;

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = checkAiRateLimit(user.id);
  if (limited) return limited;

  const body = await req.json();
  const { regenerate = false } = body;

  const service = createServiceClient();

  // Gather context: profile, onboarding prefs, recent activity
  const { data: profile } = await service
    .from("profiles")
    .select("user_type, onboarding_preferences, full_name, nickname")
    .eq("id", user.id)
    .single();

  const user_type = (profile?.user_type as string) || "agency";
  const onboarding = (profile?.onboarding_preferences as Record<string, unknown>) || {};

  // Recent activity — what have they created lately?
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: recentActivity } = await service
    .from("trinity_log")
    .select("action_type, description, created_at")
    .eq("user_id", user.id)
    .gte("created_at", sevenDaysAgo)
    .order("created_at", { ascending: false })
    .limit(30);

  // Client count
  const { count: clientCount } = await service
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id);

  // Lead count
  const { count: leadCount } = await service
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const contextBlob = `
User type: ${user_type}
Name: ${profile?.nickname || profile?.full_name || "there"}
Business: ${(onboarding.business_name as string) || "not specified"}
Niche: ${(onboarding.niche as string) || "not specified"}
Goals: ${JSON.stringify(onboarding.goals || "not specified")}
Pain points: ${JSON.stringify(onboarding.pain_points || "not specified")}
Active clients: ${clientCount || 0}
Total leads: ${leadCount || 0}
Recent activity (last 7 days):
${(recentActivity || []).slice(0, 20).map(a => `- ${a.action_type}: ${a.description?.slice(0, 80)}`).join("\n") || "(no activity)"}

${regenerate ? "IMPORTANT: User wants DIFFERENT recommendations than last time. Vary content types." : ""}

Recommend 6-8 things they should do NEXT to grow their business.`;

  try {
    const resp = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 2000,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: contextBlob }],
    });

    const text = getResponseText(resp);
    const parsed = safeJsonParse<{
      recommendations: Recommendation[];
      overall_theme: string;
      priority_focus: string;
    }>(text);

    if (!parsed || !Array.isArray(parsed.recommendations)) {
      return NextResponse.json({ error: "AI returned invalid format" }, { status: 502 });
    }

    // Cache to user's profile for "remember last" feature
    try {
      await service
        .from("profiles")
        .update({
          onboarding_preferences: {
            ...onboarding,
            last_recommendations: parsed,
            last_recommendations_at: new Date().toISOString(),
          },
        })
        .eq("id", user.id);
    } catch {}

    // Log
    try {
      void service.from("trinity_log").insert({
        user_id: user.id,
        action_type: "ai_recommendations_generated",
        description: `Generated ${parsed.recommendations.length} recommendations for ${user_type}`,
        status: "completed",
        metadata: { count: parsed.recommendations.length, regenerate },
      });
    } catch {}

    return NextResponse.json({ success: true, ...parsed, user_type });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

/* GET — Return cached recommendations if any, otherwise empty */
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_preferences, user_type")
    .eq("id", user.id)
    .single();

  const prefs = (profile?.onboarding_preferences as Record<string, unknown>) || {};
  const cached = prefs.last_recommendations as { recommendations: Recommendation[]; overall_theme: string; priority_focus: string } | undefined;

  return NextResponse.json({
    success: true,
    has_cached: !!cached,
    last_generated_at: (prefs.last_recommendations_at as string) || null,
    ...(cached || { recommendations: [], overall_theme: "", priority_focus: "" }),
    user_type: profile?.user_type || "agency",
  });
}
