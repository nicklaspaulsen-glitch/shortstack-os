/**
 * Helpers for per-user soft usage caps.
 * Reads `profiles.onboarding_preferences.usage_limits` and compares daily counters.
 * Falls back to plan-level limits when the user-set cap is 0 (meaning "no override").
 */
import { createServiceClient } from "@/lib/supabase/server";

export type UsageKind = "tokens" | "videos" | "thumbnails" | "emails";

export interface UserUsageLimits {
  max_tokens_per_day: number;
  max_videos_per_day: number;
  max_thumbnails_per_day: number;
  max_emails_per_day: number;
  warn_at_percent: number;
  warning_enabled: boolean;
}

const DEFAULTS: UserUsageLimits = {
  max_tokens_per_day: 0,
  max_videos_per_day: 0,
  max_thumbnails_per_day: 0,
  max_emails_per_day: 0,
  warn_at_percent: 85,
  warning_enabled: true,
};

/** Fetch the user's saved usage caps (or defaults). */
export async function getUserUsageLimits(userId: string): Promise<UserUsageLimits> {
  try {
    const service = createServiceClient();
    const { data } = await service
      .from("profiles")
      .select("onboarding_preferences")
      .eq("id", userId)
      .maybeSingle();
    const prefs = (data?.onboarding_preferences && typeof data.onboarding_preferences === "object")
      ? data.onboarding_preferences as Record<string, unknown>
      : {};
    const raw = prefs.usage_limits && typeof prefs.usage_limits === "object"
      ? prefs.usage_limits as Partial<UserUsageLimits>
      : {};
    return {
      max_tokens_per_day: numberOr(raw.max_tokens_per_day, DEFAULTS.max_tokens_per_day),
      max_videos_per_day: numberOr(raw.max_videos_per_day, DEFAULTS.max_videos_per_day),
      max_thumbnails_per_day: numberOr(raw.max_thumbnails_per_day, DEFAULTS.max_thumbnails_per_day),
      max_emails_per_day: numberOr(raw.max_emails_per_day, DEFAULTS.max_emails_per_day),
      warn_at_percent: numberOr(raw.warn_at_percent, DEFAULTS.warn_at_percent),
      warning_enabled: raw.warning_enabled !== false,
    };
  } catch {
    return DEFAULTS;
  }
}

/**
 * Pick the effective per-day cap for a given usage kind.
 * Returns the user's cap when > 0, otherwise the plan-level fallback.
 */
export function effectiveDailyCap(
  kind: UsageKind,
  userLimits: UserUsageLimits,
  planFallback: number
): number {
  const key: keyof UserUsageLimits =
    kind === "tokens" ? "max_tokens_per_day" :
    kind === "videos" ? "max_videos_per_day" :
    kind === "thumbnails" ? "max_thumbnails_per_day" :
    "max_emails_per_day";
  const user = userLimits[key] as number;
  if (typeof user === "number" && user > 0) return user;
  return planFallback;
}

/**
 * Return true if usage is above the user's warning threshold (but not over the cap).
 */
export function shouldWarn(used: number, cap: number, limits: UserUsageLimits): boolean {
  if (!limits.warning_enabled) return false;
  if (cap <= 0) return false;
  const pct = (used / cap) * 100;
  return pct >= limits.warn_at_percent && pct < 100;
}

function numberOr(v: unknown, d: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return d;
}
