import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared helper to build + persist a daily briefing for one user.
 * Used by both the on-demand /api/briefing/generate POST and the nightly
 * /api/cron/daily-briefing sweep that runs for every user.
 *
 * Gathers yesterday's metrics (leads, deals, outreach, content, revenue,
 * issues), calls Claude Haiku for a punchy markdown summary, and upserts
 * into `daily_briefings` keyed on (user_id, briefing_date).
 */
export async function generateDailyBriefing(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ id: string; briefing_date: string; summary_markdown: string; metrics: Record<string, unknown> }> {
  const today = new Date();
  const briefingDate = today.toISOString().slice(0, 10);
  const since = new Date(today.getTime() - 86_400_000).toISOString();

  // Resolve effective owner (team_member → parent agency).
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, parent_agency_id")
    .eq("id", userId)
    .single();
  const ownerId = profile?.role === "team_member" && profile?.parent_agency_id
    ? profile.parent_agency_id
    : userId;

  const [
    { count: newLeads },
    { count: contentPublished },
    { count: trinityActions },
    { count: newDeals },
    { data: activeClients },
    { data: systemDown },
  ] = await Promise.all([
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("user_id", ownerId).gte("scraped_at", since),
    supabase.from("content_calendar").select("*", { count: "exact", head: true }).eq("status", "published").gte("published_at", since),
    supabase.from("trinity_log").select("*", { count: "exact", head: true }).eq("user_id", ownerId).gte("created_at", since),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("user_id", ownerId).eq("status", "won").gte("closed_at", since),
    supabase.from("clients").select("mrr").eq("profile_id", ownerId).eq("is_active", true),
    supabase.from("system_health").select("integration_name").eq("status", "down"),
  ]);

  // Outreach is scoped via owned leads.
  const { data: ownedLeadIds } = await supabase.from("leads").select("id").eq("user_id", ownerId);
  const ids = (ownedLeadIds || []).map((l) => l.id as string);
  const dmsSent = ids.length === 0
    ? 0
    : (await supabase.from("outreach_log").select("*", { count: "exact", head: true }).in("lead_id", ids).gte("sent_at", since)).count || 0;
  const replies = ids.length === 0
    ? 0
    : (await supabase.from("outreach_log").select("*", { count: "exact", head: true }).in("lead_id", ids).eq("status", "replied").gte("sent_at", since)).count || 0;

  const totalMrr = (activeClients || []).reduce((s, c) => s + (c.mrr || 0), 0);
  const downList = (systemDown || []).map((s) => s.integration_name as string);

  const metrics = {
    new_leads: newLeads || 0,
    dms_sent: dmsSent,
    replies,
    content_published: contentPublished || 0,
    trinity_actions: trinityActions || 0,
    new_deals: newDeals || 0,
    total_mrr: totalMrr,
    issues_down: downList,
  };

  // Default fallback summary — used if the Haiku call fails.
  let summary = [
    `# Yesterday at a glance`,
    ``,
    `- **${metrics.new_leads}** new leads · **${metrics.dms_sent}** DMs sent · **${metrics.replies}** replies`,
    `- **${metrics.new_deals}** new deals closed · **$${metrics.total_mrr.toLocaleString()}** MRR`,
    `- **${metrics.content_published}** content pieces published · **${metrics.trinity_actions}** Trinity actions`,
    downList.length > 0 ? `- Issues: ${downList.join(", ")} down` : `- All systems healthy`,
  ].join("\n");

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
          max_tokens: 400,
          system:
            "You are an executive briefing assistant for an AI-first agency operator. Write a crisp, markdown-formatted daily briefing that highlights wins, risks, and what needs attention today. Use headings, bullets, and bold for key numbers. 150 words max.",
          messages: [
            {
              role: "user",
              content: `Yesterday's metrics:\n\n${JSON.stringify(metrics, null, 2)}\n\nWrite today's daily briefing.`,
            },
          ],
        }),
      });
      const json = await res.json();
      const text = json?.content?.[0]?.text;
      if (typeof text === "string" && text.length > 0) summary = text;
    } catch {
      /* fall back to default summary */
    }
  }

  // Upsert on (user_id, briefing_date).
  const { data: existing } = await supabase
    .from("daily_briefings")
    .select("id")
    .eq("user_id", userId)
    .eq("briefing_date", briefingDate)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("daily_briefings")
      .update({ summary_markdown: summary, metrics, generated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  const { data, error } = await supabase
    .from("daily_briefings")
    .insert({ user_id: userId, briefing_date: briefingDate, summary_markdown: summary, metrics })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}
