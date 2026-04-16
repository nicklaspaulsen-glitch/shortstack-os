// Sender Rotation Service — Manages phone number and email sender pools
// Rotates intelligently across multiple senders to maximize deliverability

import { SupabaseClient } from "@supabase/supabase-js";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PhoneSender {
  id: string;
  phone_number: string;
  label: string;
  type: string;
  daily_limit: number;
  sent_today: number;
  warmup_stage: number;
  status: string;
}

export interface EmailSender {
  id: string;
  email: string;
  display_name: string;
  label: string;
  smtp_provider: string;
  smtp_host: string | null;
  smtp_port: string | null;
  smtp_user: string | null;
  daily_limit: number;
  sent_today: number;
  warmup_stage: number;
  status: string;
}

// ── Spam-Safe Hard Limits ──────────────────────────────────────────────────────
// These are ENFORCED caps based on industry standards. Even if a user sets
// daily_limit=5000, the system clamps to these maximums per warmup stage.
// Going above these triggers carrier/ISP spam flags.

const SAFE_EMAIL_LIMITS: Record<number, { daily: number; hourly: number; minDelaySec: number }> = {
  0: { daily: 20,  hourly: 5,  minDelaySec: 120 }, // new — max 20/day, 5/hr, 2 min gap
  1: { daily: 50,  hourly: 10, minDelaySec: 60 },  // warming — 50/day, 10/hr, 1 min gap
  2: { daily: 150, hourly: 25, minDelaySec: 30 },  // ramping — 150/day, 25/hr, 30s gap
  3: { daily: 500, hourly: 75, minDelaySec: 10 },  // full — 500/day, 75/hr, 10s gap
};

const SAFE_PHONE_LIMITS: Record<number, { daily: number; hourly: number; minDelaySec: number }> = {
  0: { daily: 25,  hourly: 5,  minDelaySec: 60 },  // new — 25 SMS/day, 5/hr
  1: { daily: 75,  hourly: 15, minDelaySec: 30 },  // warming
  2: { daily: 150, hourly: 30, minDelaySec: 10 },  // ramping
  3: { daily: 300, hourly: 50, minDelaySec: 3 },   // full — Twilio recommends ~1/sec/number
};

// Auto-pause thresholds — if a sender's rates exceed these, pause it
const BOUNCE_RATE_PAUSE_THRESHOLD = 0.05;    // 5% bounce rate → auto-pause
const COMPLAINT_RATE_PAUSE_THRESHOLD = 0.001; // 0.1% complaint rate → auto-pause
const MIN_SENDS_FOR_RATE_CHECK = 20;          // Don't check rates until at least 20 sends

const WARMUP_MULTIPLIERS: Record<number, number> = {
  0: 0.25, // new — 25% of daily limit
  1: 0.5,  // warming — 50%
  2: 0.75, // ramping — 75%
  3: 1.0,  // full — 100%
};

// Days since creation required to auto-advance to each stage
const WARMUP_THRESHOLDS: Record<number, number> = {
  1: 3,  // advance to stage 1 after 3 days
  2: 7,  // advance to stage 2 after 7 days
  3: 14, // advance to stage 3 after 14 days
};

/**
 * Get the effective daily limit.
 * Takes the MINIMUM of:
 *   1. User's configured limit * warmup multiplier
 *   2. Industry-standard hard cap for this warmup stage
 * This prevents users from accidentally nuking a sender's reputation.
 */
function getEffectiveLimit(dailyLimit: number, warmupStage: number, type: "email" | "phone" = "email", spamGuardEnabled = true): number {
  const multiplier = WARMUP_MULTIPLIERS[warmupStage] ?? 1.0;
  const userLimit = Math.floor(dailyLimit * multiplier);

  if (!spamGuardEnabled) {
    return userLimit; // No hard cap — user takes full risk
  }

  const safeLimits = type === "phone" ? SAFE_PHONE_LIMITS : SAFE_EMAIL_LIMITS;
  const hardCap = safeLimits[warmupStage]?.daily ?? 500;
  return Math.min(userLimit, hardCap);
}

/**
 * Get the hourly limit for a sender at its current warmup stage.
 */
export function getHourlyLimit(warmupStage: number, type: "email" | "phone" = "email"): number {
  const safeLimits = type === "phone" ? SAFE_PHONE_LIMITS : SAFE_EMAIL_LIMITS;
  return safeLimits[warmupStage]?.hourly ?? 50;
}

/**
 * Get the minimum delay in seconds between sends for a sender.
 */
export function getMinDelay(warmupStage: number, type: "email" | "phone" = "email"): number {
  const safeLimits = type === "phone" ? SAFE_PHONE_LIMITS : SAFE_EMAIL_LIMITS;
  return safeLimits[warmupStage]?.minDelaySec ?? 10;
}

/**
 * Check if spam guard is enabled for the current user.
 * Returns true (safe default) if the setting doesn't exist.
 */
export async function isSpamGuardEnabled(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "spam_guard_enabled")
      .single();
    return data?.value !== "false";
  } catch {
    return true; // Safe default
  }
}

/**
 * Check if a sender can send RIGHT NOW given hourly rate and last-send timing.
 * Returns { allowed: true } or { allowed: false, reason, retryAfterSec }.
 */
export async function canSendNow(
  supabase: SupabaseClient,
  senderId: string,
  type: "email" | "phone"
): Promise<{ allowed: boolean; reason?: string; retryAfterSec?: number }> {
  const table = type === "phone" ? "phone_numbers" : "email_senders";
  try {
    const { data: sender } = await supabase
      .from(table)
      .select("id, warmup_stage, sent_today, daily_limit, last_sent_at, sent_this_hour, hour_window_start, bounces, complaints, total_sent")
      .eq("id", senderId)
      .single();

    if (!sender) return { allowed: false, reason: "Sender not found" };

    const stage = sender.warmup_stage ?? 0;
    const safeLimits = type === "phone" ? SAFE_PHONE_LIMITS : SAFE_EMAIL_LIMITS;
    const limits = safeLimits[stage] ?? safeLimits[3];

    // 1. Daily limit check (hard cap)
    const effectiveDaily = getEffectiveLimit(sender.daily_limit ?? 500, stage, type);
    if ((sender.sent_today ?? 0) >= effectiveDaily) {
      return { allowed: false, reason: `Daily limit reached (${effectiveDaily})` };
    }

    // 2. Hourly rate check
    const now = Date.now();
    const hourStart = sender.hour_window_start ? new Date(sender.hour_window_start).getTime() : 0;
    const withinHour = (now - hourStart) < 3600_000;
    if (withinHour && (sender.sent_this_hour ?? 0) >= limits.hourly) {
      const retryAfter = Math.ceil((hourStart + 3600_000 - now) / 1000);
      return { allowed: false, reason: `Hourly limit reached (${limits.hourly}/hr)`, retryAfterSec: retryAfter };
    }

    // 3. Minimum delay between sends
    if (sender.last_sent_at) {
      const lastSent = new Date(sender.last_sent_at).getTime();
      const elapsed = (now - lastSent) / 1000;
      if (elapsed < limits.minDelaySec) {
        return { allowed: false, reason: "Sending too fast", retryAfterSec: Math.ceil(limits.minDelaySec - elapsed) };
      }
    }

    // 4. Bounce/complaint rate check (only after enough sends)
    const totalSent = sender.total_sent ?? 0;
    if (totalSent >= MIN_SENDS_FOR_RATE_CHECK) {
      const bounceRate = (sender.bounces ?? 0) / totalSent;
      if (bounceRate > BOUNCE_RATE_PAUSE_THRESHOLD) {
        return { allowed: false, reason: `Bounce rate too high (${(bounceRate * 100).toFixed(1)}% > 5%)` };
      }
      const complaintRate = (sender.complaints ?? 0) / totalSent;
      if (complaintRate > COMPLAINT_RATE_PAUSE_THRESHOLD) {
        return { allowed: false, reason: `Complaint rate too high (${(complaintRate * 100).toFixed(1)}% > 0.1%)` };
      }
    }

    return { allowed: true };
  } catch {
    return { allowed: true }; // Fail open — don't block sends if tracking is broken
  }
}

/**
 * Record a bounce event. Auto-pauses the sender if bounce rate exceeds threshold.
 */
export async function recordBounce(
  supabase: SupabaseClient,
  senderId: string,
  type: "email" | "phone"
): Promise<{ paused: boolean }> {
  const table = type === "phone" ? "phone_numbers" : "email_senders";
  try {
    const { data } = await supabase
      .from(table)
      .select("bounces, total_sent")
      .eq("id", senderId)
      .single();

    const bounces = (data?.bounces ?? 0) + 1;
    const totalSent = data?.total_sent ?? 0;

    const updates: Record<string, unknown> = { bounces };

    // Auto-pause if rate exceeded
    if (totalSent >= MIN_SENDS_FOR_RATE_CHECK && bounces / totalSent > BOUNCE_RATE_PAUSE_THRESHOLD) {
      updates.status = "suspended";
    }

    await supabase.from(table).update(updates).eq("id", senderId);
    return { paused: !!updates.status };
  } catch {
    return { paused: false };
  }
}

/**
 * Record a spam complaint. Auto-pauses at very low thresholds (0.1%).
 */
export async function recordComplaint(
  supabase: SupabaseClient,
  senderId: string,
  type: "email" | "phone"
): Promise<{ paused: boolean }> {
  const table = type === "phone" ? "phone_numbers" : "email_senders";
  try {
    const { data } = await supabase
      .from(table)
      .select("complaints, total_sent")
      .eq("id", senderId)
      .single();

    const complaints = (data?.complaints ?? 0) + 1;
    const totalSent = data?.total_sent ?? 0;

    const updates: Record<string, unknown> = { complaints };

    if (totalSent >= MIN_SENDS_FOR_RATE_CHECK && complaints / totalSent > COMPLAINT_RATE_PAUSE_THRESHOLD) {
      updates.status = "suspended";
    }

    await supabase.from(table).update(updates).eq("id", senderId);
    return { paused: !!updates.status };
  } catch {
    return { paused: false };
  }
}

/**
 * Get sender health/reputation score (0-100).
 * 100 = perfect, <50 = problematic, 0 = suspended.
 */
export async function getSenderReputation(
  supabase: SupabaseClient,
  senderId: string,
  type: "email" | "phone"
): Promise<{ score: number; status: string; issues: string[] }> {
  const table = type === "phone" ? "phone_numbers" : "email_senders";
  try {
    const { data } = await supabase
      .from(table)
      .select("total_sent, bounces, complaints, status, warmup_stage")
      .eq("id", senderId)
      .single();

    if (!data) return { score: 0, status: "unknown", issues: ["Sender not found"] };
    if (data.status === "suspended") return { score: 0, status: "suspended", issues: ["Sender is suspended"] };

    let score = 100;
    const issues: string[] = [];
    const totalSent = data.total_sent ?? 0;

    if (totalSent >= MIN_SENDS_FOR_RATE_CHECK) {
      const bounceRate = (data.bounces ?? 0) / totalSent;
      if (bounceRate > 0.03) { score -= 30; issues.push(`High bounce rate: ${(bounceRate * 100).toFixed(1)}%`); }
      else if (bounceRate > 0.01) { score -= 10; issues.push(`Elevated bounce rate: ${(bounceRate * 100).toFixed(1)}%`); }

      const complaintRate = (data.complaints ?? 0) / totalSent;
      if (complaintRate > 0.0005) { score -= 40; issues.push(`Complaint rate: ${(complaintRate * 100).toFixed(2)}%`); }
    }

    if (data.warmup_stage < 2) { score -= 10; issues.push("Still in warmup"); }

    const status = score >= 80 ? "healthy" : score >= 50 ? "warning" : "critical";
    return { score: Math.max(0, score), status, issues };
  } catch {
    return { score: 50, status: "unknown", issues: ["Could not check reputation"] };
  }
}

// ── Phone Number Rotation ──────────────────────────────────────────────────────

/**
 * Pick the next best phone number for outreach.
 * Strategy: round-robin by least-used-today, respecting warmup limits.
 * Returns null if all numbers are at capacity.
 */
export async function getNextPhoneNumber(
  supabase: SupabaseClient
): Promise<PhoneSender | null> {
  try {
    const spamGuard = await isSpamGuardEnabled(supabase);

    const { data, error } = await supabase
      .from("phone_numbers")
      .select("id, phone_number, label, type, daily_limit, sent_today, warmup_stage, status, sent_this_hour, hour_window_start, last_sent_at, bounces, complaints, total_sent")
      .eq("status", "active")
      .order("sent_today", { ascending: true });

    if (error || !data || data.length === 0) return null;

    const now = Date.now();
    for (const sender of data) {
      const stage = sender.warmup_stage ?? 0;
      const limits = SAFE_PHONE_LIMITS[stage] ?? SAFE_PHONE_LIMITS[3];
      const effectiveDaily = getEffectiveLimit(sender.daily_limit, stage, "phone", spamGuard);

      // Daily cap
      if ((sender.sent_today ?? 0) >= effectiveDaily) continue;

      if (spamGuard) {
        // Hourly cap
        const hourStart = sender.hour_window_start ? new Date(sender.hour_window_start).getTime() : 0;
        if ((now - hourStart) < 3600_000 && (sender.sent_this_hour ?? 0) >= limits.hourly) continue;

        // Min delay
        if (sender.last_sent_at) {
          const elapsed = (now - new Date(sender.last_sent_at).getTime()) / 1000;
          if (elapsed < limits.minDelaySec) continue;
        }

        // Bounce/complaint check
        const totalSent = sender.total_sent ?? 0;
        if (totalSent >= MIN_SENDS_FOR_RATE_CHECK) {
          if ((sender.bounces ?? 0) / totalSent > BOUNCE_RATE_PAUSE_THRESHOLD) continue;
          if ((sender.complaints ?? 0) / totalSent > COMPLAINT_RATE_PAUSE_THRESHOLD) continue;
        }
      }

      return sender as PhoneSender;
    }

    return null;
  } catch {
    return null;
  }
}

// ── Email Sender Rotation ──────────────────────────────────────────────────────

/**
 * Pick the next best email sender for outreach.
 * Same strategy as phone rotation.
 */
export async function getNextEmailSender(
  supabase: SupabaseClient
): Promise<EmailSender | null> {
  try {
    const spamGuard = await isSpamGuardEnabled(supabase);

    const { data, error } = await supabase
      .from("email_senders")
      .select(
        "id, email, display_name, label, smtp_provider, smtp_host, smtp_port, smtp_user, daily_limit, sent_today, warmup_stage, status, sent_this_hour, hour_window_start, last_sent_at, bounces, complaints, total_sent"
      )
      .eq("status", "active")
      .order("sent_today", { ascending: true });

    if (error || !data || data.length === 0) return null;

    const now = Date.now();
    for (const sender of data) {
      const stage = sender.warmup_stage ?? 0;
      const limits = SAFE_EMAIL_LIMITS[stage] ?? SAFE_EMAIL_LIMITS[3];
      const effectiveDaily = getEffectiveLimit(sender.daily_limit, stage, "email", spamGuard);

      if ((sender.sent_today ?? 0) >= effectiveDaily) continue;

      if (spamGuard) {
        const hourStart = sender.hour_window_start ? new Date(sender.hour_window_start).getTime() : 0;
        if ((now - hourStart) < 3600_000 && (sender.sent_this_hour ?? 0) >= limits.hourly) continue;

        if (sender.last_sent_at) {
          const elapsed = (now - new Date(sender.last_sent_at).getTime()) / 1000;
          if (elapsed < limits.minDelaySec) continue;
        }

        const totalSent = sender.total_sent ?? 0;
        if (totalSent >= MIN_SENDS_FOR_RATE_CHECK) {
          if ((sender.bounces ?? 0) / totalSent > BOUNCE_RATE_PAUSE_THRESHOLD) continue;
          if ((sender.complaints ?? 0) / totalSent > COMPLAINT_RATE_PAUSE_THRESHOLD) continue;
        }
      }

      return sender as EmailSender;
    }

    return null;
  } catch {
    return null;
  }
}

// ── Batch Allocation ───────────────────────────────────────────────────────────

/**
 * Pick N phone numbers distributed across the pool.
 * Used for batch outreach — spreads the load evenly.
 * Returns an array of { sender, count } allocations.
 */
export async function allocatePhoneSenders(
  supabase: SupabaseClient,
  totalNeeded: number
): Promise<Array<{ sender: PhoneSender; count: number }>> {
  if (totalNeeded <= 0) return [];

  try {
    const spamGuard = await isSpamGuardEnabled(supabase);

    const { data, error } = await supabase
      .from("phone_numbers")
      .select("id, phone_number, label, type, daily_limit, sent_today, warmup_stage, status")
      .eq("status", "active")
      .order("sent_today", { ascending: true });

    if (error || !data || data.length === 0) return [];

    return distributeLoad(data as PhoneSender[], totalNeeded, "phone", spamGuard);
  } catch {
    return [];
  }
}

/**
 * Same as above but for email senders.
 */
export async function allocateEmailSenders(
  supabase: SupabaseClient,
  totalNeeded: number
): Promise<Array<{ sender: EmailSender; count: number }>> {
  if (totalNeeded <= 0) return [];

  try {
    const spamGuard = await isSpamGuardEnabled(supabase);

    const { data, error } = await supabase
      .from("email_senders")
      .select(
        "id, email, display_name, label, smtp_provider, smtp_host, smtp_port, smtp_user, daily_limit, sent_today, warmup_stage, status"
      )
      .eq("status", "active")
      .order("sent_today", { ascending: true });

    if (error || !data || data.length === 0) return [];

    return distributeLoad(data as EmailSender[], totalNeeded, "email", spamGuard);
  } catch {
    return [];
  }
}

/**
 * Distribute a total send count across available senders as evenly as possible.
 * Each sender can only take up to (effectiveLimit - sent_today) more sends.
 * Enforces industry-standard hard caps per warmup stage.
 */
function distributeLoad<T extends { daily_limit: number; sent_today: number; warmup_stage: number }>(
  senders: T[],
  totalNeeded: number,
  type: "email" | "phone" = "email",
  spamGuardEnabled = true
): Array<{ sender: T; count: number }> {
  // Calculate remaining capacity for each sender (clamped by hard safety limits when spam guard is on)
  const available = senders
    .map((sender) => ({
      sender,
      remaining: Math.max(0, getEffectiveLimit(sender.daily_limit, sender.warmup_stage, type, spamGuardEnabled) - sender.sent_today),
    }))
    .filter((s) => s.remaining > 0);

  if (available.length === 0) return [];

  const totalCapacity = available.reduce((sum, s) => sum + s.remaining, 0);
  const toAllocate = Math.min(totalNeeded, totalCapacity);

  if (toAllocate <= 0) return [];

  // Distribute evenly: base amount per sender, then spread remainder
  const allocations: Array<{ sender: T; count: number }> = [];
  let remaining = toAllocate;

  // First pass: give each sender a proportional share, capped by its remaining capacity
  const basePerSender = Math.floor(toAllocate / available.length);

  for (const entry of available) {
    const count = Math.min(basePerSender, entry.remaining);
    if (count > 0) {
      allocations.push({ sender: entry.sender, count });
      remaining -= count;
    } else {
      // Still track for remainder distribution
      allocations.push({ sender: entry.sender, count: 0 });
    }
  }

  // Second pass: distribute remainder one-by-one to senders that still have capacity
  let idx = 0;
  while (remaining > 0 && idx < allocations.length) {
    const entry = available[idx];
    const current = allocations[idx].count;
    if (current < entry.remaining) {
      allocations[idx].count += 1;
      remaining -= 1;
    }
    idx++;
    // Wrap around if we still have remainder
    if (idx >= allocations.length && remaining > 0) {
      idx = 0;
    }
  }

  // Filter out any senders that ended up with 0 allocation
  return allocations.filter((a) => a.count > 0);
}

// ── Send Recording ─────────────────────────────────────────────────────────────

/**
 * Record a successful phone send — increments daily + hourly counters,
 * updates last_sent_at and total_sent.
 */
export async function recordPhoneSend(
  supabase: SupabaseClient,
  phoneId: string
): Promise<void> {
  await recordSend(supabase, "phone_numbers", phoneId);
}

/**
 * Record a successful email send — same tracking as phone.
 */
export async function recordEmailSend(
  supabase: SupabaseClient,
  emailId: string
): Promise<void> {
  await recordSend(supabase, "email_senders", emailId);
}

async function recordSend(
  supabase: SupabaseClient,
  table: "phone_numbers" | "email_senders",
  id: string
): Promise<void> {
  try {
    const { data } = await supabase
      .from(table)
      .select("sent_today, sent_this_hour, hour_window_start, total_sent")
      .eq("id", id)
      .single();

    if (!data) return;

    const now = new Date();
    const hourStart = data.hour_window_start ? new Date(data.hour_window_start) : null;
    const withinHour = hourStart && (now.getTime() - hourStart.getTime()) < 3600_000;

    await supabase
      .from(table)
      .update({
        sent_today: (data.sent_today ?? 0) + 1,
        total_sent: (data.total_sent ?? 0) + 1,
        sent_this_hour: withinHour ? (data.sent_this_hour ?? 0) + 1 : 1,
        hour_window_start: withinHour ? data.hour_window_start : now.toISOString(),
        last_sent_at: now.toISOString(),
      })
      .eq("id", id);
  } catch {
    // Silently fail — don't crash outreach over a counter update
  }
}

// ── Daily Reset & Warmup Advancement ───────────────────────────────────────────

/**
 * Reset daily counters (call at midnight via cron).
 * Also auto-advance warmup stages if a sender has been active for enough days.
 */
export async function resetDailyCounts(supabase: SupabaseClient): Promise<void> {
  try {
    // Reset sent_today for all phone numbers
    await supabase
      .from("phone_numbers")
      .update({ sent_today: 0 })
      .neq("sent_today", 0);

    // Reset sent_today for all email senders
    await supabase
      .from("email_senders")
      .update({ sent_today: 0 })
      .neq("sent_today", 0);

    // Auto-advance warmup stages based on age
    await advanceWarmupStages(supabase, "phone_numbers");
    await advanceWarmupStages(supabase, "email_senders");
  } catch {
    // Don't crash — the next cron run will retry
  }
}

/**
 * Advance warmup stages for senders that have aged past their threshold.
 * Stage 0 → 1 after 3 days, 1 → 2 after 7 days, 2 → 3 after 14 days.
 */
async function advanceWarmupStages(
  supabase: SupabaseClient,
  table: "phone_numbers" | "email_senders"
): Promise<void> {
  try {
    const { data, error } = await supabase
      .from(table)
      .select("id, warmup_stage, created_at")
      .in("status", ["active", "warmup"])
      .lt("warmup_stage", 3);

    if (error || !data) return;

    const now = new Date();

    for (const sender of data) {
      const createdAt = new Date(sender.created_at);
      const daysSinceCreation = Math.floor(
        (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      let newStage = sender.warmup_stage;

      // Check thresholds from highest to lowest so we can skip stages if needed
      if (daysSinceCreation >= WARMUP_THRESHOLDS[3] && sender.warmup_stage < 3) {
        newStage = 3;
      } else if (daysSinceCreation >= WARMUP_THRESHOLDS[2] && sender.warmup_stage < 2) {
        newStage = 2;
      } else if (daysSinceCreation >= WARMUP_THRESHOLDS[1] && sender.warmup_stage < 1) {
        newStage = 1;
      }

      if (newStage !== sender.warmup_stage) {
        await supabase
          .from(table)
          .update({ warmup_stage: newStage })
          .eq("id", sender.id);
      }
    }
  } catch {
    // Non-critical — warmup will catch up on next run
  }
}

// ── Rotation Stats ─────────────────────────────────────────────────────────────

/**
 * Get rotation stats — how many senders, capacity remaining, etc.
 */
export async function getRotationStats(supabase: SupabaseClient): Promise<{
  phones: { total: number; active: number; capacity: number; usedToday: number };
  emails: { total: number; active: number; capacity: number; usedToday: number };
}> {
  const empty = {
    phones: { total: 0, active: 0, capacity: 0, usedToday: 0 },
    emails: { total: 0, active: 0, capacity: 0, usedToday: 0 },
  };

  try {
    const [phoneResult, emailResult] = await Promise.all([
      supabase
        .from("phone_numbers")
        .select("id, daily_limit, sent_today, warmup_stage, status"),
      supabase
        .from("email_senders")
        .select("id, daily_limit, sent_today, warmup_stage, status"),
    ]);

    if (phoneResult.error && emailResult.error) return empty;

    const phones = phoneResult.data ?? [];
    const emails = emailResult.data ?? [];

    const activePhones = phones.filter((p) => p.status === "active");
    const activeEmails = emails.filter((e) => e.status === "active");

    return {
      phones: {
        total: phones.length,
        active: activePhones.length,
        capacity: activePhones.reduce(
          (sum, p) => sum + getEffectiveLimit(p.daily_limit, p.warmup_stage, "phone"),
          0
        ),
        usedToday: activePhones.reduce((sum, p) => sum + (p.sent_today ?? 0), 0),
      },
      emails: {
        total: emails.length,
        active: activeEmails.length,
        capacity: activeEmails.reduce(
          (sum, e) => sum + getEffectiveLimit(e.daily_limit, e.warmup_stage, "email"),
          0
        ),
        usedToday: activeEmails.reduce((sum, e) => sum + (e.sent_today ?? 0), 0),
      },
    };
  } catch {
    return empty;
  }
}
