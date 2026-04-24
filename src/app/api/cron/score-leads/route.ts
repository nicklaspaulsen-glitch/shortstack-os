import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { scoreLead, submitLeadScoringBatch, type Lead } from "@/lib/lead-scoring";

export const maxDuration = 300;

// GET/POST /api/cron/score-leads
//
// Cost-optimized nightly sweep:
//   - Fetch up to 200 leads that are unscored or >7d stale
//   - Submit them as ONE Message Batches API job (50% off)
//   - /api/cron/process-batches polls results and writes back scores
//
// Kill-switch (DISABLE_AI_OPTIMIZATIONS=true): reverts to the legacy
// parallel-batches-of-10 synchronous path.
//
// Auth: Bearer CRON_SECRET.
async function handler(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: leads, error } = await supabase
    .from("leads")
    .select(
      "id, business_name, phone, email, website, google_rating, review_count, industry, city, state, instagram_url, facebook_url, linkedin_url, source"
    )
    .or(`score.is.null,score_computed_at.lt.${sevenDaysAgo}`)
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!leads || leads.length === 0) {
    return NextResponse.json({ success: true, scored: 0, message: "No leads need scoring" });
  }

  // Synchronous fallback path.
  if (process.env.DISABLE_AI_OPTIMIZATIONS === "true") {
    const BATCH_SIZE = 10;
    let scored = 0;
    let failed = 0;

    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
      const chunk = leads.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        chunk.map(async (lead) => {
          const result = await scoreLead(lead as Lead);
          await supabase
            .from("leads")
            .update({
              score: result.score,
              score_breakdown: result.breakdown,
              score_reasoning: result.reasoning,
              score_computed_at: new Date().toISOString(),
              score_version: 1,
            })
            .eq("id", lead.id);
          return result;
        })
      );
      for (const r of results) {
        if (r.status === "fulfilled") scored++;
        else failed++;
      }
      if (i + BATCH_SIZE < leads.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return NextResponse.json({
      success: true,
      mode: "synchronous",
      scored,
      failed,
      total: leads.length,
      timestamp: new Date().toISOString(),
    });
  }

  // Optimized path — one batch, 50% off.
  const batchResult = await submitLeadScoringBatch(leads as Lead[]);

  // Kill-switch at sendCached level may have returned inline results.
  if (batchResult.fallback_synchronous && batchResult.inline_results) {
    let scored = 0;
    await Promise.all(
      batchResult.inline_results.map(async (r) => {
        await supabase
          .from("leads")
          .update({
            score: r.score.score,
            score_breakdown: r.score.breakdown,
            score_reasoning: r.score.reasoning,
            score_computed_at: new Date().toISOString(),
            score_version: 1,
          })
          .eq("id", r.lead_id);
        scored++;
      }),
    );
    return NextResponse.json({
      success: true,
      mode: "inline",
      scored,
      total: leads.length,
    });
  }

  return NextResponse.json({
    success: true,
    mode: "batch",
    queued: batchResult.item_count,
    batch_id: batchResult.batch_id,
    total: leads.length,
    timestamp: new Date().toISOString(),
  });
}

export const POST = handler;
export const GET = handler; // Vercel cron calls GET
