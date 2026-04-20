import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { cleanupOldTelegramMessages } from "@/lib/services/trinity";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export async function POST(_request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // SECURITY: every count below MUST be scoped to the caller's owner,
  // otherwise the response leaks aggregate revenue/lead/outreach numbers
  // across every tenant to the current user. Previously unscoped.
  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Get last login/briefing time
  const { data: lastBriefing } = await supabase
    .from("briefings")
    .select("generated_at")
    .eq("user_id", user.id)
    .order("generated_at", { ascending: false })
    .limit(1)
    .single();

  const since = lastBriefing?.generated_at || new Date(Date.now() - 24 * 3600000).toISOString();

  // Gather all stats — tenant-scoped. `system_health` stays global because
  // integration status (e.g. "Twilio down") is platform-level and the same
  // for every tenant.
  const [
    { count: newLeads },
    { count: totalLeads },
    { count: dmsSent },
    { count: replies },
    { count: activeMembers },
    { count: clientUpdates },
    { count: pendingTasks },
    { count: trinityActions },
    { count: systemIssues },
    { data: systemDown },
    { count: newDeals },
    { data: clients },
  ] = await Promise.all([
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("user_id", ownerId).gte("scraped_at", since),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("user_id", ownerId),
    // outreach_log has no direct user_id — scope via the caller's lead_ids.
    // Cheap approximation: filter lead_id via a subquery-ish IN.
    (async () => {
      const { data: myLeadIds } = await supabase.from("leads").select("id").eq("user_id", ownerId);
      const ids = (myLeadIds || []).map((l) => l.id);
      if (ids.length === 0) return { count: 0 };
      const { count } = await supabase
        .from("outreach_log")
        .select("*", { count: "exact", head: true })
        .in("lead_id", ids)
        .gte("sent_at", since);
      return { count };
    })(),
    (async () => {
      const { data: myLeadIds } = await supabase.from("leads").select("id").eq("user_id", ownerId);
      const ids = (myLeadIds || []).map((l) => l.id);
      if (ids.length === 0) return { count: 0 };
      const { count } = await supabase
        .from("outreach_log")
        .select("*", { count: "exact", head: true })
        .in("lead_id", ids)
        .eq("status", "replied")
        .gte("sent_at", since);
      return { count };
    })(),
    supabase.from("team_members").select("*", { count: "exact", head: true }).eq("parent_profile_id", ownerId).eq("is_active", true),
    supabase.from("clients").select("*", { count: "exact", head: true }).eq("profile_id", ownerId).gte("updated_at", since),
    (async () => {
      const { data: myClientIds } = await supabase.from("clients").select("id").eq("profile_id", ownerId);
      const ids = (myClientIds || []).map((c) => c.id);
      if (ids.length === 0) return { count: 0 };
      const { count } = await supabase
        .from("client_tasks")
        .select("*", { count: "exact", head: true })
        .in("client_id", ids)
        .eq("is_completed", false);
      return { count };
    })(),
    supabase.from("trinity_log").select("*", { count: "exact", head: true }).eq("user_id", ownerId).gte("created_at", since),
    supabase.from("system_health").select("*", { count: "exact", head: true }).eq("status", "down"),
    supabase.from("system_health").select("integration_name").eq("status", "down"),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("user_id", ownerId).eq("status", "won").gte("closed_at", since),
    supabase.from("clients").select("mrr").eq("profile_id", ownerId).eq("is_active", true),
  ]);

  const totalMRR = clients?.reduce((sum, c) => sum + (c.mrr || 0), 0) || 0;

  const content = {
    leads: { scraped_since: newLeads || 0, total: totalLeads || 0 },
    outreach: { sent_since: dmsSent || 0, replies: replies || 0 },
    team: { active_members: activeMembers || 0, messages: 0 },
    clients: { updates: clientUpdates || 0, deliverables_pending: pendingTasks || 0 },
    trinity: { actions_since: trinityActions || 0 },
    system: {
      issues: systemIssues || 0,
      details: (systemDown || []).map((s: { integration_name: string }) => `${s.integration_name} is down`),
    },
    revenue: { new_deals: newDeals || 0, mrr_change: 0, total_mrr: totalMRR },
  };

  // Generate AI summary
  let summary = `Since your last login: ${newLeads || 0} new leads scraped, ${dmsSent || 0} DMs sent with ${replies || 0} replies. ${trinityActions || 0} Trinity actions executed.`;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 200,
          system: "You are an executive assistant for ShortStack agency. Write a concise morning briefing summary (3-5 sentences) based on the data. Be direct and highlight anything that needs attention.",
          messages: [
            {
              role: "user",
              content: JSON.stringify(content),
            },
          ],
        }),
      });
      const data = await res.json();
      summary = data.content?.[0]?.text || summary;
    } catch {
      // Use default summary
    }
  }

  // Save briefing
  const { data: briefing, error } = await supabase
    .from("briefings")
    .insert({
      user_id: user.id,
      content: { ...content, summary },
      summary,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Clean up old Telegram messages and send new briefing
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;
  if (telegramToken && telegramChatId) {
    // Clean up old irrelevant messages first
    const serviceSupabase = createServiceClient();
    await cleanupOldTelegramMessages(telegramChatId, serviceSupabase);
    const telegramMsg = `📋 *Morning Briefing*\n\n${summary}\n\n📊 Leads: ${content.leads.scraped_since} new | DMs: ${content.outreach.sent_since} sent, ${content.outreach.replies} replies\n💰 MRR: $${content.revenue.total_mrr.toLocaleString()} | Deals: ${content.revenue.new_deals} new\n${content.system.issues > 0 ? `⚠️ ${content.system.issues} system issues` : "✅ All systems go"}`;

    await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: telegramMsg,
        parse_mode: "Markdown",
      }),
    }).catch(() => {});
  }

  return NextResponse.json({ success: true, briefing });
}
