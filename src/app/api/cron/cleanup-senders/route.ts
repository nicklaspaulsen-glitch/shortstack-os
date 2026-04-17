import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Cron: Weekly cleanup of stale sender accounts across ALL users.
 * Protected by CRON_SECRET. Deletes senders that have been in error/expired
 * state for more than 7 days.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();

  const deleted: Record<string, number> = { emails: 0, phones: 0, socials: 0 };
  const errors: string[] = [];

  try {
    const { count, error } = await service
      .from("email_senders")
      .delete({ count: "exact" })
      .in("status", ["error", "expired", "disabled"])
      .or(`last_check.lt.${cutoff},last_check.is.null`);
    if (error) errors.push(`emails: ${error.message}`);
    else deleted.emails = count || 0;
  } catch (err) {
    errors.push(`emails: ${err instanceof Error ? err.message : "error"}`);
  }

  try {
    const { count, error } = await service
      .from("phone_senders")
      .delete({ count: "exact" })
      .in("status", ["error", "expired", "disabled"])
      .or(`last_check.lt.${cutoff},last_check.is.null`);
    if (error) errors.push(`phones: ${error.message}`);
    else deleted.phones = count || 0;
  } catch (err) {
    errors.push(`phones: ${err instanceof Error ? err.message : "error"}`);
  }

  try {
    const { count, error } = await service
      .from("social_accounts")
      .delete({ count: "exact" })
      .in("status", ["expired", "revoked", "error"])
      .lt("updated_at", cutoff);
    if (error) errors.push(`socials: ${error.message}`);
    else deleted.socials = count || 0;
  } catch (err) {
    errors.push(`socials: ${err instanceof Error ? err.message : "error"}`);
  }

  const total = deleted.emails + deleted.phones + deleted.socials;

  return NextResponse.json({
    success: true,
    total_deleted: total,
    deleted,
    errors: errors.length ? errors : undefined,
    cutoff,
  });
}
