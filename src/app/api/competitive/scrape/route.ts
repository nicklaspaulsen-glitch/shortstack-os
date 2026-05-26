/**
 * POST /api/competitive/scrape
 *
 * Auth-gated endpoint that scrapes a competitor URL (single page or full
 * crawl), runs Claude to extract competitive insights, and stores the result
 * in `competitive_snapshots`.
 *
 * Body: { url: string, type: "page" | "crawl", competitorId: string,
 *          competitorName?: string, limit?: number }
 *
 * Returns the snapshot row that was inserted so the UI can display it
 * immediately without a separate fetch.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { isFirecrawlConfigured } from "@/lib/scraping/firecrawl-client";
import {
  scrapeCompetitorPage,
  crawlCompetitorSite,
  extractCompetitorInsights,
} from "@/lib/scraping/competitor-scraper";

// ── Request schema ─────────────────────────────────────────────────────────────

interface ScrapeRequestBody {
  url: string;
  type: "page" | "crawl";
  competitorId: string;
  competitorName?: string;
  /** Max pages for crawl type. Default 10, max 50. */
  limit?: number;
}

function validateBody(body: unknown): ScrapeRequestBody {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object.");
  }
  const b = body as Record<string, unknown>;

  if (typeof b.url !== "string" || !b.url.startsWith("http")) {
    throw new Error("url must be a valid http/https URL string.");
  }
  if (b.type !== "page" && b.type !== "crawl") {
    throw new Error('type must be "page" or "crawl".');
  }
  if (typeof b.competitorId !== "string" || !b.competitorId.trim()) {
    throw new Error("competitorId must be a non-empty string.");
  }

  return {
    url: b.url,
    type: b.type,
    competitorId: b.competitorId.trim(),
    competitorName:
      typeof b.competitorName === "string" ? b.competitorName.trim() : undefined,
    limit:
      typeof b.limit === "number"
        ? Math.min(50, Math.max(1, Math.floor(b.limit)))
        : 10,
  };
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth check — every competitive feature requires a logged-in user.
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Guard against missing Firecrawl config early — better UX than a 500
  // halfway through scraping.
  if (!isFirecrawlConfigured()) {
    return NextResponse.json(
      {
        error:
          "FIRECRAWL_API_KEY is not configured. Add it to your Vercel environment variables to enable scraping.",
      },
      { status: 503 },
    );
  }

  // Parse and validate the request body.
  let body: ScrapeRequestBody;
  try {
    const raw: unknown = await req.json();
    body = validateBody(raw);
  } catch (err) {
    const message = "Invalid request body.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { url, type, competitorId, competitorName, limit } = body;
  const resolvedName = competitorName ?? competitorId;

  // ── Scrape ─────────────────────────────────────────────────────────────────

  let combinedMarkdown = "";

  try {
    if (type === "page") {
      const page = await scrapeCompetitorPage(url);
      combinedMarkdown = page.markdown;
    } else {
      // crawl — concatenate all page markdowns with URL headers for context.
      const site = await crawlCompetitorSite(url, limit);
      combinedMarkdown = site.pages
        .map((p) => `## ${p.url}\n\n${p.markdown}`)
        .join("\n\n---\n\n");
    }
  } catch (err) {
    console.error("[competitive/scrape] Firecrawl error", { url, type, err });
    const message =
      "Scraping failed with unknown error.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // ── AI insights ────────────────────────────────────────────────────────────

  let aiInsights = null;
  try {
    aiInsights = await extractCompetitorInsights(combinedMarkdown, resolvedName);
  } catch (err) {
    // Insights are valuable but not critical — save the raw content even if
    // Claude fails.
    console.error("[competitive/scrape] AI insights extraction failed", err);
  }

  // ── Persist snapshot ────────────────────────────────────────────────────────

  const { data: snapshot, error: dbError } = await supabase
    .from("competitive_snapshots")
    .insert({
      user_id: user.id,
      competitor_id: competitorId,
      competitor_name: resolvedName,
      url,
      markdown_content: combinedMarkdown,
      ai_insights: aiInsights,
    })
    .select("*")
    .single();

  if (dbError) {
    console.error("[competitive/scrape] DB insert failed", dbError);
    return NextResponse.json(
      { error: "Failed to save snapshot to database." },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: snapshot }, { status: 201 });
}
