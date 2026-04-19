import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 60;

// Weekly cron — generates and logs reports for all active clients
// Run Fridays at 3 PM: 0 15 * * 5
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const { data: clients } = await supabase
    .from("clients")
    .select("id, business_name, contact_name, email, mrr, package_tier, health_score, industry")
    .eq("is_active", true);

  let generated = 0;

  for (const client of (clients || []).slice(0, 15)) {
    try {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

      const [{ count: leadsThisWeek }, { count: outreachThisWeek }, { data: aiActions }] = await Promise.all([
        supabase.from("leads").select("*", { count: "exact", head: true }).eq("client_id", client.id).gte("created_at", weekAgo),
        supabase.from("outreach_log").select("*", { count: "exact", head: true }).eq("client_id", client.id).gte("sent_at", weekAgo),
        supabase.from("trinity_log").select("description").eq("client_id", client.id).gte("created_at", weekAgo).limit(5),
      ]);

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 400,
          messages: [{
            role: "user",
            content: `Write a brief weekly update email for ${client.contact_name} at ${client.business_name}. This week: ${leadsThisWeek || 0} new leads, ${outreachThisWeek || 0} outreach messages, health score ${client.health_score}%. Recent actions: ${(aiActions || []).map(a => a.description).join("; ") || "routine maintenance"}. Keep it under 150 words, warm and professional. No markdown, plain text.`,
          }],
        }),
      });
      const data = await res.json();
      const reportText = data.content?.[0]?.text || "";

      if (reportText) {
        await supabase.from("trinity_log").insert({
          agent: "analytics",
          action_type: "content",
          description: `Weekly report generated for ${client.business_name}`,
          client_id: client.id,
          status: "completed",
          result: { type: "weekly_report", report: reportText },
        });
        generated++;
      }
    } catch {}
  }

  // Notify
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (chatId && botToken) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: `Weekly Reports Generated\n\n${generated}/${(clients || []).length} client reports ready.` }),
    });
  }

  return NextResponse.json({ success: true, generated, total: (clients || []).length });
}
