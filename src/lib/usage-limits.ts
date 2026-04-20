/**
 * Helpers for per-user soft usage caps + plan-tier monthly enforcement.
 *
 * Two layers:
 *   1. Per-user soft caps — stored in `profiles.onboarding_preferences.usage_limits`
 *      and compared as daily counters (tokens/videos/thumbnails/emails).
 *   2. Plan-tier monthly hard limits — `LIMITS_BY_TIER` maps Stripe plan tiers to
 *      monthly caps for emails/tokens/clients/sms/call_minutes. Use `checkLimit`
 *      before consuming a resource and `recordUsage` after.
 *
 * Plan-tier usage is backed by `usage_events` (migration applied separately).
 */
import { createServiceClient } from "@/lib/supabase/server";

export type UsageKind = "tokens" | "videos" | "thumbnails" | "emails";
export type UsageResource = "emails" | "tokens" | "clients" | "sms" | "call_minutes";

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

// ──────────────────────────────────────────────────────────────────────────────
//  Plan-tier monthly limits (Starter / Growth / Pro / Business / Unlimited)
// ──────────────────────────────────────────────────────────────────────────────

export interface TierLimits {
  emails: number;
  tokens: number;
  clients: number;
  sms: number;
  call_minutes: number;
}

/**
 * Hard monthly caps per Stripe plan tier. `Infinity` = no cap.
 * Keys match the TitleCase values stored in `profiles.plan_tier`.
 * "Founder" is an internal/dev tier — treated as unlimited.
 */
export const LIMITS_BY_TIER: Record<string, TierLimits> = {
  Starter:   { emails:     500, tokens:    250_000, clients:   5, sms:    100, call_minutes:     60 },
  Growth:    { emails:   5_000, tokens:  1_000_000, clients:  15, sms:  1_000, call_minutes:    300 },
  Pro:       { emails:  25_000, tokens:  5_000_000, clients:  50, sms:  5_000, call_minutes:  2_000 },
  Business:  { emails: 100_000, tokens: 20_000_000, clients: 150, sms: 25_000, call_minutes: 10_000 },
  Unlimited: { emails: Infinity, tokens: Infinity, clients: Infinity, sms: Infinity, call_minutes: Infinity },
  Founder:   { emails: Infinity, tokens: Infinity, clients: Infinity, sms: Infinity, call_minutes: Infinity },
};

/** Normalise a plan_tier value from the DB. Nulls default to "Starter". */
export function normalizePlanTier(raw: string | null | undefined): string {
  if (!raw) return "Starter";
  const v = String(raw).trim();
  // Accept lowercase too (billing checkout accepts lowercase)
  const titled = v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
  if (titled in LIMITS_BY_TIER) return titled;
  // Legacy "Enterprise" → Business
  if (titled === "Enterprise") return "Business";
  return "Starter";
}

export function limitsForTier(tier: string | null | undefined): TierLimits {
  const key = normalizePlanTier(tier);
  return LIMITS_BY_TIER[key] ?? LIMITS_BY_TIER.Starter;
}

// Token estimation for trinity_log rows (mirrors billing/tokens/route.ts)
const TOKEN_ESTIMATES: Record<string, number> = {
  copywriter: 1500, content_script: 2000, email_generation: 1200, social_post: 800,
  ai_chat: 1000, chief_agent: 2000, image_generation: 3000, thumbnail: 2500,
  seo_audit: 2000, competitor_analysis: 2500, landing_page: 3000, report: 1500,
  proposal: 2000, autopilot: 2000, default: 500,
};

function estimateTokensForAction(actionType: string | null | undefined): number {
  if (!actionType) return TOKEN_ESTIMATES.default;
  const match = Object.keys(TOKEN_ESTIMATES).find((k) => actionType.includes(k));
  return match ? TOKEN_ESTIMATES[match] : TOKEN_ESTIMATES.default;
}

export interface CurrentUsage {
  emails: number;
  tokens: number;
  clients: number;
  sms: number;
  call_minutes: number;
  notes?: string[]; // reasons a metric could not be computed
}

/**
 * Compute this-calendar-month usage for a given agency owner.
 * Reads a mix of sources: `usage_events` (new canonical), plus legacy logs
 * (`trinity_log` for tokens, `outreach_log` join leads for emails/sms/calls,
 * `clients` count for concurrent clients). The canonical `usage_events` total
 * is summed with legacy totals to avoid losing historical data.
 */
export async function getCurrentUsage(ownerId: string): Promise<CurrentUsage> {
  const notes: string[] = [];
  const service = createServiceClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const result: CurrentUsage = {
    emails: 0, tokens: 0, clients: 0, sms: 0, call_minutes: 0,
  };

  // ── usage_events: canonical source (if any rows exist yet) ──
  try {
    const { data: events } = await service
      .from("usage_events")
      .select("resource, amount")
      .eq("user_id", ownerId)
      .gte("created_at", monthStart);
    for (const ev of events || []) {
      const r = ev.resource as UsageResource;
      const amt = Number(ev.amount) || 0;
      if (r === "emails" || r === "tokens" || r === "sms" || r === "call_minutes") {
        result[r] += amt;
      }
    }
  } catch {
    notes.push("usage_events read failed");
  }

  // ── Legacy: trinity_log → tokens ──
  try {
    const { data: logs } = await service
      .from("trinity_log")
      .select("action_type, user_id, metadata")
      .or(`user_id.eq.${ownerId},profile_id.eq.${ownerId}`)
      .gte("created_at", monthStart)
      .limit(5000);
    let legacyTokens = 0;
    for (const l of logs || []) {
      const meta = (l as { metadata?: Record<string, unknown> }).metadata;
      const metaTokens = typeof meta?.tokens === "number" ? Number(meta.tokens) : 0;
      legacyTokens += metaTokens > 0 ? metaTokens : estimateTokensForAction(l.action_type);
    }
    result.tokens += legacyTokens;
  } catch {
    notes.push("trinity_log read failed — tokens may be under-counted");
  }

  // ── Legacy: outreach_log (joined via leads.user_id) for emails/sms/calls ──
  // outreach_log itself has no user_id — we filter via leads owned by ownerId.
  try {
    const { data: leadRows } = await service
      .from("leads")
      .select("id")
      .eq("user_id", ownerId)
      .limit(10000);
    const leadIds = (leadRows || []).map((r) => r.id);
    if (leadIds.length > 0) {
      const { data: outreach } = await service
        .from("outreach_log")
        .select("platform, status, metadata")
        .in("lead_id", leadIds)
        .gte("created_at", monthStart)
        .eq("status", "sent")
        .limit(20000);
      for (const o of outreach || []) {
        if (o.platform === "email") result.emails += 1;
        else if (o.platform === "sms") result.sms += 1;
        else if (o.platform === "call") {
          const meta = (o as { metadata?: Record<string, unknown> }).metadata;
          const dur = typeof meta?.duration_minutes === "number" ? Number(meta.duration_minutes) : 1;
          result.call_minutes += dur;
        }
      }
    }
  } catch {
    notes.push("outreach_log/leads read failed — email/sms/call_minutes may be under-counted");
  }

  // ── Clients: concurrent (active) — point-in-time, not monthly sum ──
  try {
    const { count } = await service
      .from("clients")
      .select("*", { count: "exact", head: true })
      .eq("profile_id", ownerId)
      .eq("is_active", true);
    result.clients = count || 0;
  } catch {
    notes.push("clients count failed");
  }

  if (notes.length) result.notes = notes;
  return result;
}

export interface CheckLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  plan_tier: string;
  remaining: number;
  reason?: string;
}

/**
 * Check whether a user is allowed to consume `cost` more of the given resource
 * this month. Does NOT record usage — call `recordUsage` after a successful op.
 */
export async function checkLimit(
  ownerId: string,
  resource: UsageResource,
  cost: number = 1,
): Promise<CheckLimitResult> {
  const service = createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("plan_tier")
    .eq("id", ownerId)
    .maybeSingle();
  const planTier = normalizePlanTier(profile?.plan_tier as string | null | undefined);
  const limits = limitsForTier(planTier);
  const limit = limits[resource];

  const usage = await getCurrentUsage(ownerId);
  const current = usage[resource] || 0;

  if (!Number.isFinite(limit)) {
    // Unlimited tier
    return {
      allowed: true,
      current,
      limit,
      plan_tier: planTier,
      remaining: Infinity,
    };
  }

  const projected = current + Math.max(0, cost);
  const allowed = projected <= limit;
  return {
    allowed,
    current,
    limit,
    plan_tier: planTier,
    remaining: Math.max(0, limit - current),
    reason: allowed
      ? undefined
      : `Monthly ${resource} limit reached for ${planTier} plan (${current}/${limit}). Upgrade to continue.`,
  };
}

/**
 * Record usage of a resource. Lightweight — inserts a row into `usage_events`.
 * Never throws: best-effort writer so callers don't need to wrap in try/catch.
 */
export async function recordUsage(
  ownerId: string,
  resource: string,
  amount: number,
  metadata?: Record<string, unknown>,
): Promise<void> {
  if (!ownerId || !resource) return;
  const allowed: UsageResource[] = ["emails", "tokens", "clients", "sms", "call_minutes"];
  if (!allowed.includes(resource as UsageResource)) return;
  try {
    const service = createServiceClient();
    await service.from("usage_events").insert({
      user_id: ownerId,
      resource,
      amount: Number.isFinite(amount) ? amount : 1,
      metadata: metadata || {},
    });
  } catch {
    // swallow — usage tracking must not break user-facing requests
  }
}
