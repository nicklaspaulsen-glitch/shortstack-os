import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

/**
 * POST — Delete old/stale sender accounts (> 7 days inactive or disconnected).
 * Can be triggered by user from dashboard, or by cron. Protected either way.
 *
 * Deletion criteria:
 * - Email senders: status=error/expired AND last_check older than 7 days
 * - Phone senders: status=error AND last_check older than 7 days
 * - Social accounts: status=expired/revoked/error AND updated_at older than 7 days
 *
 * Returns counts of deletions.
 */

function isCronRequest(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function POST(req: NextRequest) {
  const isCron = isCronRequest(req);
  const service = createServiceClient();

  let userId: string | null = null;
  if (!isCron) {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    userId = user.id;
  }

  const body = await req.json().catch(() => ({}));
  // Default: 7 days. Caller can override (e.g., "30" for a more conservative sweep)
  const daysOld = Math.max(1, Math.min(90, Number(body.days_old) || 7));
  const cutoff = new Date(Date.now() - daysOld * 86400000).toISOString();

  const deleted: Record<string, number> = { emails: 0, phones: 0, socials: 0 };
  const errors: string[] = [];

  // ── Email senders ─────────────────────────────────────────────────
  try {
    let query = service
      .from("email_senders")
      .delete()
      .in("status", ["error", "expired", "disabled"])
      .or(`last_check.lt.${cutoff},last_check.is.null`);
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query.select("id");
    const count = data?.length || 0;
    if (error) errors.push(`emails: ${error.message}`);
    else deleted.emails = count || 0;
  } catch (err) {
    errors.push(`emails: ${err instanceof Error ? err.message : "error"}`);
  }

  // ── Phone senders ─────────────────────────────────────────────────
  try {
    let query = service
      .from("phone_senders")
      .delete()
      .in("status", ["error", "expired", "disabled"])
      .or(`last_check.lt.${cutoff},last_check.is.null`);
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query.select("id");
    const count = data?.length || 0;
    if (error) errors.push(`phones: ${error.message}`);
    else deleted.phones = count || 0;
  } catch (err) {
    errors.push(`phones: ${err instanceof Error ? err.message : "error"}`);
  }

  // ── Social accounts ───────────────────────────────────────────────
  try {
    let query = service
      .from("social_accounts")
      .delete()
      .in("status", ["expired", "revoked", "error"])
      .lt("updated_at", cutoff);
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query.select("id");
    const count = data?.length || 0;
    if (error) errors.push(`socials: ${error.message}`);
    else deleted.socials = count || 0;
  } catch (err) {
    errors.push(`socials: ${err instanceof Error ? err.message : "error"}`);
  }

  const total = deleted.emails + deleted.phones + deleted.socials;

  // Log to trinity_log
  if (total > 0 && userId) {
    try {
      await service.from("trinity_log").insert({
        user_id: userId,
        action_type: "sender_cleanup",
        description: `Cleaned up ${total} stale sender accounts (${daysOld}+ days old)`,
        status: "completed",
        metadata: { deleted, days_old: daysOld, triggered_by: isCron ? "cron" : "user" },
      });
    } catch {}
  }

  return NextResponse.json({
    success: true,
    total_deleted: total,
    deleted,
    days_old: daysOld,
    errors: errors.length ? errors : undefined,
  });
}
