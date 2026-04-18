import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 60;

// Runs daily — archives stale leads based on lifecycle rules
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date();
  let archived = 0;
  let markedNoResponse = 0;

  // 1. Mark "called" leads as "no_response" if no reply after 7 days
  //    (they were emailed/SMS'd/DM'd but never responded)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
  const { data: staleCalledLeads } = await supabase
    .from("leads")
    .select("id")
    .eq("status", "called")
    .lt("updated_at", sevenDaysAgo);

  if (staleCalledLeads && staleCalledLeads.length > 0) {
    const ids = staleCalledLeads.map(l => l.id);
    await supabase
      .from("leads")
      .update({ status: "no_response" })
      .in("id", ids);
    markedNoResponse = ids.length;
  }

  // 2. Archive "no_response" leads after 14 more days (21 days total since outreach)
  const twentyOneDaysAgo = new Date(now.getTime() - 21 * 86400000).toISOString();
  const { data: staleNoResponse } = await supabase
    .from("leads")
    .select("id")
    .eq("status", "no_response")
    .lt("updated_at", twentyOneDaysAgo);

  if (staleNoResponse && staleNoResponse.length > 0) {
    const ids = staleNoResponse.map(l => l.id);
    await supabase
      .from("leads")
      .update({ status: "archived" })
      .in("id", ids);
    archived += ids.length;
  }

  // 3. Archive "not_interested" leads after 3 days (they said no)
  const threeDaysAgo = new Date(now.getTime() - 3 * 86400000).toISOString();
  const { data: notInterested } = await supabase
    .from("leads")
    .select("id")
    .eq("status", "not_interested")
    .lt("updated_at", threeDaysAgo);

  if (notInterested && notInterested.length > 0) {
    const ids = notInterested.map(l => l.id);
    await supabase
      .from("leads")
      .update({ status: "archived" })
      .in("id", ids);
    archived += ids.length;
  }

  // 4. Archive "closed_lost" leads after 7 days
  const { data: closedLost } = await supabase
    .from("leads")
    .select("id")
    .eq("status", "closed_lost")
    .lt("updated_at", sevenDaysAgo);

  if (closedLost && closedLost.length > 0) {
    const ids = closedLost.map(l => l.id);
    await supabase
      .from("leads")
      .update({ status: "archived" })
      .in("id", ids);
    archived += ids.length;
  }

  // 5. Delete archived leads older than 90 days (permanent cleanup)
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000).toISOString();
  const { count: deleted } = await supabase
    .from("leads")
    .delete({ count: "exact" })
    .eq("status", "archived")
    .lt("updated_at", ninetyDaysAgo);

  // Send Telegram summary if anything happened
  const totalActions = markedNoResponse + archived + (deleted || 0);
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
            `⏳ Marked no-response: ${markedNoResponse}\n` +
            `📦 Archived: ${archived}\n` +
            `🗑️ Deleted (90d+): ${deleted || 0}\n\n` +
            `Keeps your pipeline clean and focused on active leads.`
          );
        }
      }
    } catch {}
  }

  return NextResponse.json({
    success: true,
    markedNoResponse,
    archived,
    deleted: deleted || 0,
    timestamp: now.toISOString(),
  });
}
