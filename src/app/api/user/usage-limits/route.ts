import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 10;

export interface UsageLimits {
  max_tokens_per_day: number;
  max_videos_per_day: number;
  max_thumbnails_per_day: number;
  max_emails_per_day: number;
  warn_at_percent: number; // 0..100
  warning_enabled: boolean;
}

const DEFAULTS: UsageLimits = {
  max_tokens_per_day: 0, // 0 = no user cap (fall back to plan)
  max_videos_per_day: 0,
  max_thumbnails_per_day: 0,
  max_emails_per_day: 0,
  warn_at_percent: 85,
  warning_enabled: true,
};

/**
 * GET /api/user/usage-limits
 * Returns the user's saved usage caps (from profiles.onboarding_preferences.usage_limits).
 */
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data } = await service
    .from("profiles")
    .select("onboarding_preferences")
    .eq("id", user.id)
    .maybeSingle();

  const prefs = (data?.onboarding_preferences && typeof data.onboarding_preferences === "object")
    ? data.onboarding_preferences as Record<string, unknown>
    : {};
  const raw = prefs.usage_limits && typeof prefs.usage_limits === "object"
    ? prefs.usage_limits as Partial<UsageLimits>
    : {};

  const limits: UsageLimits = {
    max_tokens_per_day: numberOr(raw.max_tokens_per_day, DEFAULTS.max_tokens_per_day),
    max_videos_per_day: numberOr(raw.max_videos_per_day, DEFAULTS.max_videos_per_day),
    max_thumbnails_per_day: numberOr(raw.max_thumbnails_per_day, DEFAULTS.max_thumbnails_per_day),
    max_emails_per_day: numberOr(raw.max_emails_per_day, DEFAULTS.max_emails_per_day),
    warn_at_percent: numberOr(raw.warn_at_percent, DEFAULTS.warn_at_percent),
    warning_enabled: raw.warning_enabled !== false,
  };

  return NextResponse.json({ limits });
}

/**
 * POST /api/user/usage-limits
 * Body: Partial<UsageLimits>
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Partial<UsageLimits>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: existing } = await service
    .from("profiles")
    .select("onboarding_preferences")
    .eq("id", user.id)
    .maybeSingle();

  const prefs = (existing?.onboarding_preferences && typeof existing.onboarding_preferences === "object")
    ? { ...(existing.onboarding_preferences as Record<string, unknown>) }
    : {};

  const nextLimits: UsageLimits = {
    max_tokens_per_day: clampInt(body.max_tokens_per_day, 0, 10_000_000),
    max_videos_per_day: clampInt(body.max_videos_per_day, 0, 10_000),
    max_thumbnails_per_day: clampInt(body.max_thumbnails_per_day, 0, 10_000),
    max_emails_per_day: clampInt(body.max_emails_per_day, 0, 100_000),
    warn_at_percent: clampInt(body.warn_at_percent, 1, 100, 85),
    warning_enabled: body.warning_enabled !== false,
  };

  prefs.usage_limits = nextLimits;

  const { error } = await service
    .from("profiles")
    .update({ onboarding_preferences: prefs })
    .eq("id", user.id);

  if (error) {
    console.error("[usage-limits] POST error:", error);
    return NextResponse.json({ error: "Failed to save limits" }, { status: 500 });
  }

  return NextResponse.json({ success: true, limits: nextLimits });
}

function numberOr(v: unknown, d: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return d;
}
function clampInt(v: unknown, min: number, max: number, fallback = 0): number {
  const n = typeof v === "number" ? Math.floor(v) : Number.parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
