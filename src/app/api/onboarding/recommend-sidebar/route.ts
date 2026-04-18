import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import {
  anthropic,
  MODEL_HAIKU,
  safeJsonParse,
  getResponseText,
} from "@/lib/ai/claude-helpers";
import {
  ALL_SIDEBAR_ITEMS,
  getUserTypeMeta,
  SIDEBAR_CATEGORIES,
} from "@/lib/user-types";

export const maxDuration = 30;

interface RequestBody {
  user_type?: string;
  goals?: string | string[];
  niche?: string;
  business_info?: Record<string, unknown>;
}

const SYSTEM_PROMPT = `You recommend which ShortStack OS sidebar items a user should see.

INPUT
- user_type (agency, content_creator, real_estate, coach, ecommerce, saas, service_provider, other)
- goals, niche, and business_info
- a list of all available sidebar item hrefs (you MUST only use hrefs from this list)

TASK
Pick the 12-20 most relevant hrefs for this user's day-to-day. Keep the sidebar tight and useful — do NOT include everything. Prefer tools directly tied to their stated goals and niche.

OUTPUT
Respond with ONLY raw JSON:
{
  "enabled_items": ["/dashboard", "/dashboard/analytics", ...],
  "reasoning": "One sentence on why."
}

Rules:
- Always include "/dashboard" and "/dashboard/settings".
- Only include hrefs that EXIST in the provided list.
- 12-20 items. Don't go over 20.`;

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", user.id)
    .single();
  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const userType = typeof body.user_type === "string" ? body.user_type : "other";
  const meta = getUserTypeMeta(userType);
  const goals = Array.isArray(body.goals)
    ? body.goals.filter((g) => typeof g === "string").join(", ")
    : typeof body.goals === "string"
      ? body.goals
      : "";
  const niche = typeof body.niche === "string" ? body.niche : "";
  const info = body.business_info && typeof body.business_info === "object" ? body.business_info : {};

  // Try AI first; fall back to static recommendation if anything goes wrong.
  try {
    const allowed = ALL_SIDEBAR_ITEMS;

    const userText = `USER TYPE: ${userType}
NICHE: ${niche || "(not provided)"}
GOALS: ${goals || "(not provided)"}
BUSINESS INFO:
${Object.entries(info).map(([k, v]) => `- ${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`).join("\n") || "(none)"}

ALLOWED SIDEBAR HREFS (must pick from these):
${allowed.map((h) => `- ${h}`).join("\n")}

Pick 12-20 most useful hrefs for this user. Return JSON only.`;

    const resp = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 900,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userText }],
    });

    const raw = getResponseText(resp);
    const parsed = safeJsonParse<{ enabled_items?: unknown; reasoning?: unknown }>(raw);

    const enabled_items = Array.isArray(parsed?.enabled_items)
      ? (parsed!.enabled_items as unknown[])
          .filter((h): h is string => typeof h === "string" && ALL_SIDEBAR_ITEMS.includes(h))
          .slice(0, 20)
      : [];

    if (enabled_items.length < 5) {
      // Not enough — fall back to static recommendation.
      return NextResponse.json({
        success: true,
        enabled_items: meta.recommendedSidebar,
        reasoning: `Defaulted to the standard ${meta.label} layout.`,
        fallback: true,
      });
    }

    // Always ensure /dashboard and /dashboard/settings are present.
    const finalItems = Array.from(new Set(["/dashboard", ...enabled_items, "/dashboard/settings"]));

    return NextResponse.json({
      success: true,
      enabled_items: finalItems,
      reasoning: typeof parsed?.reasoning === "string" ? parsed.reasoning : "",
      categories: SIDEBAR_CATEGORIES.map((c) => c.category),
    });
  } catch (err) {
    console.error("[onboarding/recommend-sidebar] failed:", err);
    return NextResponse.json({
      success: true,
      enabled_items: meta.recommendedSidebar,
      reasoning: `Defaulted to the standard ${meta.label} layout.`,
      fallback: true,
    });
  }
}
