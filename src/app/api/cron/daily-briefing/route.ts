import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, createSupabaseFromToken } from "@/lib/supabase/server";
import {
  collectBriefingMetrics,
  submitDailyBriefingBatch,
  generateDailyBriefing,
} from "@/lib/services/daily-briefing";

export const maxDuration = 120;

/**
 * GET /api/cron/daily-briefing
 * Nightly sweep — queues a daily briefing for every active admin.
 * Configured in vercel.json to run at 07:00 UTC.
 *
 * Cost-optimized:
 *   1. Collect every admin's metrics in parallel.
 *   2. Upsert a default (non-AI) briefing row so the UI has something
 *      to show immediately — AI polish arrives later when the batch
 *      completes.
 *   3. Submit ONE Message Batches API call for all users (50% off).
 *      /api/cron/process-batches polls it and applies results back.
 *
 * Kill-switch (DISABLE_AI_OPTIMIZATIONS=true): falls back to per-user
 * synchronous `generateDailyBriefing` calls.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>`
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();

  const { data: admins, error } = await service
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .eq("is_active", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const adminList = admins || [];

  if (adminList.length === 0) {
    return NextResponse.json({ success: true, queued: 0, generated: 0 });
  }

  // Fallback path — per-user synchronous.
  if (process.env.DISABLE_AI_OPTIMIZATIONS === "true") {
    let generated = 0;
    let failed = 0;
    for (const a of adminList) {
      try {
        await generateDailyBriefing(
          service as unknown as ReturnType<typeof createSupabaseFromToken>,
          a.id,
        );
        generated++;
      } catch {
        failed++;
      }
    }
    return NextResponse.json({ success: true, mode: "synchronous", generated, failed });
  }

  // Optimized path — gather metrics, upsert defaults, submit one batch.
  const metricsPerUser = await Promise.all(
    adminList.map(async (a) => {
      try {
        const { metrics, briefingDate } = await collectBriefingMetrics(
          service as unknown as ReturnType<typeof createSupabaseFromToken>,
          a.id,
        );
        return { user_id: a.id, briefingDate, metrics };
      } catch {
        return null;
      }
    }),
  );

  const users = metricsPerUser.filter((m): m is NonNullable<typeof m> => m !== null);

  // Upsert default briefings so the UI isn't empty while batch runs.
  await Promise.all(
    users.map(async (u) => {
      const defaultSummary = [
        `# Yesterday at a glance`,
        ``,
        `- **${u.metrics.new_leads}** new leads · **${u.metrics.dms_sent}** DMs sent · **${u.metrics.replies}** replies`,
        `- **${u.metrics.new_deals}** new deals closed · **$${u.metrics.total_mrr.toLocaleString()}** MRR`,
        `- **${u.metrics.content_published}** content pieces published · **${u.metrics.trinity_actions}** Trinity actions`,
        u.metrics.issues_down.length > 0
          ? `- Issues: ${u.metrics.issues_down.join(", ")} down`
          : `- All systems healthy`,
      ].join("\n");

      const { data: existing } = await service
        .from("daily_briefings")
        .select("id")
        .eq("user_id", u.user_id)
        .eq("briefing_date", u.briefingDate)
        .maybeSingle();

      if (existing) {
        await service
          .from("daily_briefings")
          .update({ metrics: u.metrics, generated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await service.from("daily_briefings").insert({
          user_id: u.user_id,
          briefing_date: u.briefingDate,
          summary_markdown: defaultSummary,
          metrics: u.metrics,
        });
      }
    }),
  );

  const batchResult = await submitDailyBriefingBatch(
    users.map((u) => ({ user_id: u.user_id, briefing_date: u.briefingDate, metrics: u.metrics })),
  );

  return NextResponse.json({
    success: true,
    mode: "batch",
    queued: batchResult.item_count,
    batch_id: batchResult.batch_id,
  });
}
