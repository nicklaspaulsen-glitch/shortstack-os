import { SupabaseClient } from "@supabase/supabase-js";
import { sendCached, submitBatch, MODEL_HAIKU } from "@/lib/ai/claude-client";

/**
 * Shared helper to build + persist a daily briefing for one user.
 * Used by both the on-demand /api/briefing/generate POST and the nightly
 * /api/cron/daily-briefing sweep that runs for every user.
 *
 * Gathers yesterday's metrics (leads, deals, outreach, content, revenue,
 * issues), calls Claude Haiku for a punchy markdown summary, and upserts
 * into `daily_briefings` keyed on (user_id, briefing_date).
 *
 * Cost-optimized:
 *   - System prompt is stable across every user → prompt caching (90% off).
 *   - For the nightly cron sweep, use collectBriefingMetrics() +
 *     submitDailyBriefingBatch() to send all users in one batch (50% off).
 */

const BRIEFING_SYSTEM_PROMPT =
  "You are an executive briefing assistant for an AI-first agency operator. Write a crisp, markdown-formatted daily briefing that highlights wins, risks, and what needs attention today. Use headings, bullets, and bold for key numbers. 150 words max.";

export interface BriefingMetrics {
  new_leads: number;
  dms_sent: number;
  replies: number;
  content_published: number;
  trinity_actions: number;
  new_deals: number;
  total_mrr: number;
  issues_down: string[];
}

function defaultSummary(metrics: BriefingMetrics, downList: string[]): string {
  return [
    `# Yesterday at a glance`,
    ``,
    `- **${metrics.new_leads}** new leads · **${metrics.dms_sent}** DMs sent · **${metrics.replies}** replies`,
    `- **${metrics.new_deals}** new deals closed · **$${metrics.total_mrr.toLocaleString()}** MRR`,
    `- **${metrics.content_published}** content pieces published · **${metrics.trinity_actions}** Trinity actions`,
    downList.length > 0 ? `- Issues: ${downList.join(", ")} down` : `- All systems healthy`,
  ].join("\n");
}

/**
 * Gather the per-user metrics for a single briefing. Exported so the cron
 * sweep can collect everyone's metrics in parallel then ship one batch.
 */
export async function collectBriefingMetrics(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ ownerId: string; metrics: BriefingMetrics; briefingDate: string }> {
  const today = new Date();
  const briefingDate = today.toISOString().slice(0, 10);
  const since = new Date(today.getTime() - 86_400_000).toISOString();

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

  const metrics: BriefingMetrics = {
    new_leads: newLeads || 0,
    dms_sent: dmsSent,
    replies,
    content_published: contentPublished || 0,
    trinity_actions: trinityActions || 0,
    new_deals: newDeals || 0,
    total_mrr: totalMrr,
    issues_down: downList,
  };

  return { ownerId, metrics, briefingDate };
}

async function upsertBriefing(
  supabase: SupabaseClient,
  userId: string,
  briefingDate: string,
  summary: string,
  metrics: BriefingMetrics,
) {
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

export async function generateDailyBriefing(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ id: string; briefing_date: string; summary_markdown: string; metrics: Record<string, unknown> }> {
  const { metrics, briefingDate } = await collectBriefingMetrics(supabase, userId);

  let summary = defaultSummary(metrics, metrics.issues_down);

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      // Synchronous path — used by on-demand /api/briefing/generate.
      // System prompt is cached (stable across all users + days).
      const result = await sendCached({
        model: MODEL_HAIKU,
        maxTokens: 400,
        system: BRIEFING_SYSTEM_PROMPT,
        userMessage: `Yesterday's metrics:\n\n${JSON.stringify(metrics, null, 2)}\n\nWrite today's daily briefing.`,
        endpoint: "daily-briefing/synchronous",
        userId,
      });
      if (result.text.length > 0) summary = result.text;
    } catch {
      /* fall back to default summary */
    }
  }

  return upsertBriefing(supabase, userId, briefingDate, summary, metrics);
}

/**
 * Submit a batch of daily-briefing summarizations in one Message Batches API
 * call. Used by the nightly /api/cron/daily-briefing sweep.
 *
 * Caller should:
 *   1. Collect metrics for each user via collectBriefingMetrics()
 *   2. Upsert a default briefing row so the UI has *something* immediately.
 *   3. Call this to queue the AI rewrites.
 *   4. Later, /api/cron/process-batches polls results and updates rows.
 */
export interface BriefingBatchUser {
  user_id: string;
  briefing_date: string;
  metrics: BriefingMetrics;
}

export async function submitDailyBriefingBatch(
  users: BriefingBatchUser[],
): Promise<{ batch_id: string; item_count: number; fallback_synchronous: boolean }> {
  if (users.length === 0) return { batch_id: "", item_count: 0, fallback_synchronous: true };

  const items = users.map((u) => ({
    // custom_id encodes user_id + date so process-batches can find the row.
    custom_id: `briefing:${u.user_id}:${u.briefing_date}`,
    system: BRIEFING_SYSTEM_PROMPT,
    userMessage: `Yesterday's metrics:\n\n${JSON.stringify(u.metrics, null, 2)}\n\nWrite today's daily briefing.`,
    maxTokens: 400,
  }));

  const result = await submitBatch({
    model: MODEL_HAIKU,
    endpoint: "daily-briefing/batch",
    items,
  });

  return {
    batch_id: result.batch_id,
    item_count: result.item_count,
    fallback_synchronous: !!result.fallback_synchronous,
  };
}

/**
 * Given the { custom_id, text } results from a completed daily-briefing
 * batch, update `daily_briefings` rows with the AI-rewritten summary.
 * Used by /api/cron/process-batches.
 */
export async function applyDailyBriefingResults(
  supabase: SupabaseClient,
  results: Array<{ custom_id: string; text: string | null }>,
): Promise<{ updated: number; skipped: number }> {
  let updated = 0;
  let skipped = 0;
  for (const r of results) {
    if (!r.text) {
      skipped++;
      continue;
    }
    // custom_id format: "briefing:<user_id>:<yyyy-mm-dd>"
    const parts = r.custom_id.split(":");
    if (parts.length !== 3 || parts[0] !== "briefing") {
      skipped++;
      continue;
    }
    const [, userId, briefingDate] = parts;
    try {
      await supabase
        .from("daily_briefings")
        .update({
          summary_markdown: r.text,
          generated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("briefing_date", briefingDate);
      updated++;
    } catch {
      skipped++;
    }
  }
  return { updated, skipped };
}
