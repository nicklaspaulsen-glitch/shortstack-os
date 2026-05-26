/**
 * Daily news-triggers scan cron.
 *
 * Schedule: 06:00 UTC (`0 6 * * *`).
 *
 * For each active lead that has a `business_name`, search NewsAPI (primary,
 * 100/day quota) or GDELT (fallback, no quota) for fresh mentions in the past
 * 7 days. Insert each unique (lead_id, url) into `public.news_triggers`.
 *
 * Cap: 100 leads per tick to respect NewsAPI's free quota. Prioritises leads
 * that haven't been scanned recently (by joining on max(created_at) of their
 * news_triggers rows).
 *
 * Auth: x-vercel-cron header OR Authorization: Bearer ${CRON_SECRET}.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { searchCompanyNews } from "@/lib/integrations/news-triggers";
import { secureCompare } from "@/lib/security/ssrf-guard";

export const maxDuration = 300;

const MAX_LEADS_PER_TICK = 100;
const SINCE_DAYS = 7;

interface LeadRow {
  id: string;
  user_id: string;
  business_name: string | null;
  status: string | null;
}

export async function GET(request: NextRequest) {
  const isVercelCron = request.headers.get("x-vercel-cron") !== null;
  const auth = request.headers.get("authorization");
  const rawToken = auth?.replace(/^Bearer\s+/i, "") ?? "";
  const hasBearer =
    !!process.env.CRON_SECRET && secureCompare(rawToken, process.env.CRON_SECRET);
  if (!isVercelCron && !hasBearer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Pick leads to scan: active leads with a business_name, oldest scanned first.
  // Excludes converted/lost since they're not active outreach targets.
  const { data: leadRows, error } = await supabase
    .from("leads")
    .select("id, user_id, business_name, status")
    .not("business_name", "is", null)
    .not("status", "in", "(converted,lost,unqualified)")
    .order("score_updated_at", { ascending: true, nullsFirst: true })
    .limit(MAX_LEADS_PER_TICK);

  if (error) {
    console.error("[news-triggers-scan] lead select failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const leads = (leadRows ?? []) as LeadRow[];
  if (leads.length === 0) {
    return NextResponse.json({
      scanned: 0,
      hits: 0,
      inserted: 0,
      timestamp: new Date().toISOString(),
    });
  }

  let totalHits = 0;
  let inserted = 0;
  let scanned = 0;

  for (const lead of leads) {
    const company = (lead.business_name || "").trim();
    if (!company || company.length < 2) continue;

    scanned++;
    let hits;
    try {
      hits = await searchCompanyNews(company, SINCE_DAYS);
    } catch (err) {
      console.error(
        "[news-triggers-scan] search failed",
        company,
        "Internal server error",
      );
      continue;
    }
    if (hits.length === 0) continue;
    totalHits += hits.length;

    const rows = hits.map((h) => ({
      agency_owner_id: lead.user_id,
      lead_id: lead.id,
      company: h.company,
      headline: h.headline,
      url: h.url,
      published_at: h.published_at,
      source: h.source,
      trigger_type: h.trigger_type,
      summary: h.summary,
    }));

    // Upsert with onConflict ignores duplicates (lead_id, url).
    const { error: insertErr, count } = await supabase
      .from("news_triggers")
      .upsert(rows, {
        onConflict: "lead_id,url",
        ignoreDuplicates: true,
        count: "exact",
      });

    if (insertErr) {
      console.error(
        "[news-triggers-scan] insert failed",
        lead.id,
        insertErr.message,
      );
      continue;
    }
    inserted += count ?? rows.length;
  }

  return NextResponse.json({
    scanned,
    hits: totalHits,
    inserted,
    timestamp: new Date().toISOString(),
  });
}
