import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { secureCompare } from "@/lib/security/ssrf-guard";

export const maxDuration = 30;

// Runs daily — archives stale leads based on lifecycle rules, scoped per agency
// owner to prevent cross-tenant data access. Previously operated across ALL
// leads globally, which meant a single bug in status/date filters could affect
// every agency's pipeline simultaneously.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const rawToken = authHeader?.replace(/^Bearer\s+/i, "") ?? "";
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !secureCompare(rawToken, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date();
  let totalMarkedNoResponse = 0;
  let totalArchived = 0;
  let totalDeleted = 0;

  // Collect distinct owner IDs that have leads in any cleanup-eligible status.
  // Same pattern as recompute-lead-scores: process per-owner so one agency's
  // lifecycle rules can never accidentally mutate another agency's data.
  const { data: ownerRows, error: ownerErr } = await supabase
    .from("leads")
    .select("user_id")
    .in("status", ["called", "no_response", "not_interested", "closed_lost", "archived"])
    .not("user_id", "is", null)
    .limit(10000);

  if (ownerErr) {
    console.error("[cron/lead-cleanup] failed to fetch owner IDs", ownerErr);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  const ownerIds = Array.from(
    new Set((ownerRows ?? []).map((r) => r.user_id as string)),
  );

  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
  const twentyOneDaysAgo = new Date(now.getTime() - 21 * 86400000).toISOString();
  const threeDaysAgo = new Date(now.getTime() - 3 * 86400000).toISOString();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000).toISOString();

  for (const ownerId of ownerIds) {
    // 1. Mark "called" leads as "no_response" if no reply after 7 days
    const { data: staleCalled } = await supabase
      .from("leads")
      .select("id")
      .eq("user_id", ownerId)
      .eq("status", "called")
      .lt("updated_at", sevenDaysAgo);

    if (staleCalled && staleCalled.length > 0) {
      const ids = staleCalled.map((l) => l.id);
      await supabase
        .from("leads")
        .update({ status: "no_response" })
        .eq("user_id", ownerId)
        .in("id", ids);
      totalMarkedNoResponse += ids.length;
    }

    // 2. Archive "no_response" leads after 14 more days (21 days total since outreach)
    const { data: staleNoResponse } = await supabase
      .from("leads")
      .select("id")
      .eq("user_id", ownerId)
      .eq("status", "no_response")
      .lt("updated_at", twentyOneDaysAgo);

    if (staleNoResponse && staleNoResponse.length > 0) {
      const ids = staleNoResponse.map((l) => l.id);
      await supabase
        .from("leads")
        .update({ status: "archived" })
        .eq("user_id", ownerId)
        .in("id", ids);
      totalArchived += ids.length;
    }

    // 3. Archive "not_interested" leads after 3 days (they said no)
    const { data: notInterested } = await supabase
      .from("leads")
      .select("id")
      .eq("user_id", ownerId)
      .eq("status", "not_interested")
      .lt("updated_at", threeDaysAgo);

    if (notInterested && notInterested.length > 0) {
      const ids = notInterested.map((l) => l.id);
      await supabase
        .from("leads")
        .update({ status: "archived" })
        .eq("user_id", ownerId)
        .in("id", ids);
      totalArchived += ids.length;
    }

    // 4. Archive "closed_lost" leads after 7 days
    const { data: closedLost } = await supabase
      .from("leads")
      .select("id")
      .eq("user_id", ownerId)
      .eq("status", "closed_lost")
      .lt("updated_at", sevenDaysAgo);

    if (closedLost && closedLost.length > 0) {
      const ids = closedLost.map((l) => l.id);
      await supabase
        .from("leads")
        .update({ status: "archived" })
        .eq("user_id", ownerId)
        .in("id", ids);
      totalArchived += ids.length;
    }

    // 5. Delete archived leads older than 90 days (permanent cleanup)
    const { count: deleted } = await supabase
      .from("leads")
      .delete({ count: "exact" })
      .eq("user_id", ownerId)
      .eq("status", "archived")
      .lt("updated_at", ninetyDaysAgo);
    totalDeleted += deleted || 0;
  }

  // Send Telegram summary if anything happened
  const totalActions = totalMarkedNoResponse + totalArchived + totalDeleted;
  if (totalActions > 0) {
    try {
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (chatId) {
        const { anyRoutineActive } = await import("@/lib/telegram/should-send-routine");
        const leadOn = await anyRoutineActive(supabase, "lead_finder_done");
        if (leadOn) {
          const { sendTelegramMessage } = await import("@/lib/services/trinity");
          await sendTelegramMessage(chatId,
            `🧹 *Lead Cleanup Report*\n\n` +
            `👥 Owners processed: ${ownerIds.length}\n` +
            `⏳ Marked no-response: ${totalMarkedNoResponse}\n` +
            `📦 Archived: ${totalArchived}\n` +
            `🗑️ Deleted (90d+): ${totalDeleted}\n\n` +
            `Keeps your pipeline clean and focused on active leads.`
          );
        }
      }
    } catch (err) {
      console.error("[cron/lead-cleanup] Telegram notification failed", err);
    }
  }

  return NextResponse.json({
    success: true,
    ownersProcessed: ownerIds.length,
    markedNoResponse: totalMarkedNoResponse,
    archived: totalArchived,
    deleted: totalDeleted,
    timestamp: now.toISOString(),
  });
}
