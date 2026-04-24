import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { scoreLead } from "@/lib/lead-scoring";

export const maxDuration = 300;

// POST /api/cron/score-leads — batch score up to 200 leads that are unscored or stale (>7 days)
// Protected by CRON_SECRET bearer token (also works as GET for Vercel cron)
async function handler(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Fetch up to 200 leads: unscored OR scored more than 7 days ago
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

  // Process in parallel batches of 10 with 100ms delay between batches
  const BATCH_SIZE = 10;
  let scored = 0;
  let failed = 0;

  for (let i = 0; i < leads.length; i += BATCH_SIZE) {
    const batch = leads.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (lead) => {
        const result = await scoreLead(lead);
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

    // Delay between batches to avoid rate limits (skip delay after the last batch)
    if (i + BATCH_SIZE < leads.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return NextResponse.json({
    success: true,
    scored,
    failed,
    total: leads.length,
    timestamp: new Date().toISOString(),
  });
}

export const POST = handler;
export const GET = handler; // Vercel cron calls GET
