import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { PLAN_TIERS, type PlanTier, isValidPlanTier } from "@/lib/plan-config";

export async function GET(_request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get user's plan
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", user.id)
    .single();

  const planTier = (profile?.plan_tier || "Growth") as string;
  const tier = isValidPlanTier(planTier)
    ? PLAN_TIERS[planTier as PlanTier]
    : PLAN_TIERS.Growth;
  const limit = tier.tokens_monthly;

  // Get month boundaries
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const daysElapsed = Math.max(
    1,
    Math.floor((now.getTime() - monthStart.getTime()) / 86400000)
  );
  const daysRemaining = Math.ceil(
    (nextMonth.getTime() - now.getTime()) / 86400000
  );

  // Count token usage from trinity_log this month — scope to the authed user,
  // otherwise every user sees the same global usage (and over-reports quotas).
  // trinity_log has both profile_id (preferred) and user_id on some rows, so OR them.
  const { data: logs } = await supabase
    .from("trinity_log")
    .select("action_type, description, created_at, status")
    .or(`profile_id.eq.${user.id},user_id.eq.${user.id}`)
    .gte("created_at", monthStart.toISOString())
    .order("created_at", { ascending: false })
    .limit(1000);

  // Token estimation by action type
  const TOKEN_ESTIMATES: Record<string, number> = {
    copywriter: 1500,
    content_script: 2000,
    email_generation: 1200,
    social_post: 800,
    ai_chat: 1000,
    chief_agent: 2000,
    image_generation: 3000,
    thumbnail: 2500,
    seo_audit: 2000,
    competitor_analysis: 2500,
    landing_page: 3000,
    report: 1500,
    proposal: 2000,
    autopilot: 2000,
    default: 500,
  };

  const CATEGORY_MAP: Record<string, string> = {
    copywriter: "Content Generation",
    content_script: "Content Generation",
    blog: "Content Generation",
    autopilot_blog: "Content Generation",
    autopilot_strategy: "Content Generation",
    ai_chat: "AI Chat",
    chief_agent: "AI Chat",
    custom: "AI Chat",
    email_generation: "Email Generation",
    autopilot_email: "Email Generation",
    image_generation: "Image Generation",
    thumbnail: "Image Generation",
    social_post: "Social Media",
    social_autopilot: "Social Media",
    autopilot_ads: "Social Media",
    lead_scraper: "Lead Scraper",
    scraper: "Lead Scraper",
  };

  let totalUsed = 0;
  const byCategory: Record<string, number> = {};
  const dailyMap: Record<string, number> = {};
  const recentActivity: Array<{
    id: string;
    action_type: string;
    description: string;
    tokens_used: number;
    created_at: string;
  }> = [];

  for (const log of logs || []) {
    const matchedKey =
      Object.keys(TOKEN_ESTIMATES).find((k) =>
        log.action_type?.includes(k)
      ) || "default";
    const tokens = TOKEN_ESTIMATES[matchedKey];
    totalUsed += tokens;

    const catKey = Object.keys(CATEGORY_MAP).find((k) =>
      log.action_type?.includes(k)
    );
    const category = catKey ? CATEGORY_MAP[catKey] : "Other";
    byCategory[category] = (byCategory[category] || 0) + tokens;

    const day = log.created_at?.substring(0, 10) || "";
    if (day) dailyMap[day] = (dailyMap[day] || 0) + tokens;

    if (recentActivity.length < 20) {
      recentActivity.push({
        id: `${log.created_at}_${recentActivity.length}`,
        action_type: log.action_type || "unknown",
        description: (log.description || "").substring(0, 100),
        tokens_used: tokens,
        created_at: log.created_at,
      });
    }
  }

  // Check for bonus tokens stored in system_health
  const { data: bonusData } = await supabase
    .from("system_health")
    .select("metadata")
    .eq("integration_name", `bonus_tokens_${user.id}`)
    .single();
  const bonusTokens =
    (bonusData?.metadata as Record<string, number>)?.tokens || 0;

  // Build daily usage array for last 30 days
  const dailyUsage: Array<{ date: string; tokens: number }> = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().substring(0, 10);
    dailyUsage.push({ date: dateStr, tokens: dailyMap[dateStr] || 0 });
  }

  return NextResponse.json({
    plan: planTier,
    limit,
    used: totalUsed,
    bonus_tokens: bonusTokens,
    effective_limit: limit === -1 ? -1 : limit + bonusTokens,
    reset_date: nextMonth.toISOString(),
    days_remaining: daysRemaining,
    daily_average: Math.round(totalUsed / daysElapsed),
    by_category: byCategory,
    daily_usage: dailyUsage,
    recent_activity: recentActivity,
  });
}
