/**
 * Competitor scraping service.
 *
 * Wraps Firecrawl with typed, opinionated helpers for the competitive
 * intelligence feature. Three public functions:
 *
 *   scrapeCompetitorPage      — single URL → clean markdown
 *   crawlCompetitorSite       — crawl up to N pages of a site
 *   extractCompetitorInsights — run Claude over scraped markdown to produce
 *                               structured competitive intel
 *
 * All functions throw on hard failure. The API route wraps calls in try/catch
 * and decides whether to surface a 50x or a partial result.
 *
 * SDK note: @mendable/firecrawl-js v4 uses scrape() / crawl() (not scrapeUrl
 * / crawlUrl). The crawl() method polls until completion and returns a CrawlJob
 * whose `.data` array contains Document objects.
 */

import type { Document, CrawlJob } from "@mendable/firecrawl-js";
import { getFirecrawlClient } from "./firecrawl-client";
import { anthropic, MODEL_HAIKU } from "@/lib/ai/claude-helpers";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CompetitorPageData {
  url: string;
  markdown: string;
  title?: string;
  description?: string;
  scrapedAt: string;
}

export interface CompetitorSiteData {
  rootUrl: string;
  pages: CompetitorPageData[];
  totalPages: number;
  scrapedAt: string;
}

export interface CompetitorInsights {
  summary: string;
  keyChanges: string[];
  pricingMentions: string[];
  featureMentions: string[];
  /** Competitive sentiment score from -1 (major threat) to 1 (weak competitor). */
  sentimentScore: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function documentToPageData(doc: Document, fallbackUrl: string, scrapedAt: string): CompetitorPageData {
  return {
    url: doc.metadata?.sourceURL ?? fallbackUrl,
    markdown: doc.markdown ?? "",
    title: doc.metadata?.title,
    description: doc.metadata?.description,
    scrapedAt,
  };
}

// ── Single-page scrape ────────────────────────────────────────────────────────

/**
 * Scrape a single competitor URL and return clean markdown content.
 * Uses Firecrawl's scrape endpoint which handles JS rendering and content
 * cleaning automatically.
 */
export async function scrapeCompetitorPage(
  url: string,
): Promise<CompetitorPageData> {
  const client = getFirecrawlClient(); // throws if key not set
  const scrapedAt = new Date().toISOString();

  // v4 API: scrape() returns a Document directly (throws on failure).
  const doc: Document = await client.scrape(url, {
    formats: ["markdown"],
  });

  return documentToPageData(doc, url, scrapedAt);
}

// ── Site crawl ────────────────────────────────────────────────────────────────

/**
 * Crawl up to `limit` pages starting from `url` and return all scraped pages.
 * Firecrawl handles link discovery, robots.txt, and deduplication.
 *
 * Default limit is 10 — covers homepage + pricing + features without burning
 * too many credits.
 */
export async function crawlCompetitorSite(
  url: string,
  limit = 10,
): Promise<CompetitorSiteData> {
  const client = getFirecrawlClient();
  const scrapedAt = new Date().toISOString();

  // v4: crawl() polls until completion and returns a CrawlJob.
  const job: CrawlJob = await client.crawl(url, {
    limit,
    scrapeOptions: {
      formats: ["markdown"],
    },
  });

  const pages: CompetitorPageData[] = job.data.map((doc) =>
    documentToPageData(doc, url, scrapedAt),
  );

  return {
    rootUrl: url,
    pages,
    totalPages: pages.length,
    scrapedAt,
  };
}

// ── AI insights extraction ────────────────────────────────────────────────────

const INSIGHTS_SYSTEM_PROMPT = `You are a competitive intelligence analyst. Given scraped markdown content from a competitor's website, extract structured competitive insights.

Return ONLY valid JSON with no markdown fences and no commentary. Use this exact shape:
{
  "summary": "2-3 sentence executive summary of what this competitor does and their positioning",
  "keyChanges": ["list of notable changes or announcements if identifiable, otherwise empty array"],
  "pricingMentions": ["list of pricing strings found, e.g. '$49/mo', 'Free tier', 'Enterprise'"],
  "featureMentions": ["list of key product features or capabilities mentioned"],
  "sentimentScore": 0.0
}

sentimentScore: float from -1.0 to 1.0 indicating competitive threat level:
  -1.0 = major competitive threat (strong features, aggressive pricing, direct overlap)
   0.0 = neutral or unclear
   1.0 = weak competitor (limited features, poor positioning, narrow niche)`;

/**
 * Run Claude over scraped competitor markdown to produce structured insights.
 * Uses Haiku for cost efficiency — this is extraction, not creative generation.
 */
export async function extractCompetitorInsights(
  markdown: string,
  competitorName: string,
): Promise<CompetitorInsights> {
  // Truncate to ~12k chars to avoid context overflow while covering most
  // homepages and pricing pages in full.
  const truncated =
    markdown.length > 12_000
      ? markdown.slice(0, 12_000) + "\n\n[content truncated]"
      : markdown;

  const response = await anthropic.messages.create({
    model: MODEL_HAIKU,
    max_tokens: 1024,
    system: INSIGHTS_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Competitor: ${competitorName}\n\n---\n\n${truncated}`,
      },
    ],
  });

  const rawText =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const parsed = JSON.parse(rawText) as CompetitorInsights;
    // Clamp sentimentScore in case the model drifts outside [-1, 1].
    parsed.sentimentScore = Math.max(-1, Math.min(1, parsed.sentimentScore ?? 0));
    return parsed;
  } catch {
    console.error(
      "[competitor-scraper] extractCompetitorInsights — Claude returned non-JSON",
      rawText,
    );
    // Return a safe fallback so the snapshot still writes to the DB.
    return {
      summary: "AI analysis unavailable — failed to parse model output.",
      keyChanges: [],
      pricingMentions: [],
      featureMentions: [],
      sentimentScore: 0,
    };
  }
}
