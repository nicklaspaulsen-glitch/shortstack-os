import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getBatchResults } from "@/lib/ai/claude-client";
import { applyDailyBriefingResults } from "@/lib/services/daily-briefing";
import { parseLeadScoringResults, type Lead } from "@/lib/lead-scoring";

export const maxDuration = 120;

/**
 * GET /api/cron/process-batches
 *
 * Polls in-progress rows in `ai_batch_jobs`, and for each that's finished
 * on Anthropic's side, drains results and applies them back to the right
 * target tables (daily_briefings, leads, etc.).
 *
 * Schedule: every 10 minutes (see vercel.json).
 *
 * Auth: Bearer CRON_SECRET.
 *
 * Dispatch is keyed off `endpoint`:
 *   - "daily-briefing/batch"   → applyDailyBriefingResults()
 *   - "lead-scoring/batch"     → parseLeadScoringResults() + update leads
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: jobs, error } = await supabase
    .from("ai_batch_jobs")
    .select("*")
    .eq("status", "in_progress")
    .order("submitted_at", { ascending: true })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ success: true, checked: 0, completed: 0 });
  }

  let checked = 0;
  let completed = 0;
  let failed = 0;
  let stillRunning = 0;
  const details: Array<Record<string, unknown>> = [];

  for (const job of jobs) {
    checked++;
    try {
      const r = await getBatchResults(job.batch_id);
      if (r.status === "in_progress") {
        stillRunning++;
        continue;
      }

      if (r.status === "canceled" || r.status === "expired") {
        await supabase
          .from("ai_batch_jobs")
          .update({
            status: r.status,
            completed_at: new Date().toISOString(),
          })
          .eq("batch_id", job.batch_id);
        failed++;
        details.push({ batch_id: job.batch_id, status: r.status });
        continue;
      }

      // r.status === "ended"
      const textResults = r.results.map((e) => ({
        custom_id: e.custom_id,
        text: e.text,
      }));

      if (job.endpoint === "daily-briefing/batch") {
        const { updated, skipped } = await applyDailyBriefingResults(supabase, textResults);
        details.push({ batch_id: job.batch_id, endpoint: job.endpoint, updated, skipped });
      } else if (job.endpoint === "lead-scoring/batch") {
        const ids = textResults.map((t) => t.custom_id.replace(/^lead:/, ""));
        const { data: leads } = await supabase
          .from("leads")
          .select("id, business_name, phone, email, website, google_rating, review_count, industry, city, state, instagram_url, facebook_url, linkedin_url, source")
          .in("id", ids);
        const index: Record<string, Lead> = {};
        (leads || []).forEach((l) => {
          index[l.id as string] = l as Lead;
        });
        const parsed = parseLeadScoringResults(textResults, index);
        let updated = 0;
        await Promise.all(
          parsed.map(async (p) => {
            await supabase
              .from("leads")
              .update({
                score: p.score.score,
                score_breakdown: p.score.breakdown,
                score_reasoning: p.score.reasoning,
                score_computed_at: new Date().toISOString(),
                score_version: 1,
              })
              .eq("id", p.lead_id);
            updated++;
          }),
        );
        details.push({ batch_id: job.batch_id, endpoint: job.endpoint, updated });
      } else {
        details.push({
          batch_id: job.batch_id,
          endpoint: job.endpoint,
          note: "unknown endpoint — results discarded",
        });
      }

      await supabase
        .from("ai_batch_jobs")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("batch_id", job.batch_id)
        .eq("status", "in_progress");

      completed++;
    } catch (err) {
      failed++;
      details.push({
        batch_id: job.batch_id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    success: true,
    checked,
    completed,
    failed,
    still_running: stillRunning,
    details,
  });
}
