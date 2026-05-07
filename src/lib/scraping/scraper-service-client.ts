/**
 * Client for the self-hosted ShortStack Scraper Service.
 *
 * The scraper service runs at SCRAPER_SERVICE_URL (default http://localhost:8765)
 * and exposes two complementary scrapers:
 *
 *  - /smart-scrape  — ScrapeGraphAI: LLM-powered structured extraction.
 *                     Give it a URL + natural-language prompt, get back JSON.
 *                     Great for: lead enrichment, competitor monitoring, product
 *                     data extraction, pricing intelligence.
 *
 *  - /crawl         — Scrapling: fast anti-detection HTTP scraping.
 *                     Give it a URL + optional CSS selector, get back text.
 *                     Great for: raw page dumps, element extraction, link lists.
 *
 *  - /search        — ScrapeGraphAI SearchGraph: web search + extraction.
 *                     Give it a query, get structured results for N URLs.
 *
 * Pattern mirrors src/lib/scraping/firecrawl-client.ts:
 * no module-level construction, lazy base-URL resolution.
 */

const DEFAULT_SCRAPER_URL = "http://localhost:8765";

function getBaseUrl(): string {
  return (process.env.SCRAPER_SERVICE_URL ?? DEFAULT_SCRAPER_URL).replace(/\/$/, "");
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SmartScrapeResult {
  url: string;
  prompt: string;
  result: unknown;
}

export interface CrawlResult {
  url: string;
  content: string;
  selector_matches: string[] | null;
  status_code: number;
}

export interface SearchResult {
  url: string;
  prompt: string;
  result: unknown;
}

export interface ScraperHealth {
  status: "ok";
  scrapegraphai: boolean;
  scrapling: boolean;
}

// ── API ────────────────────────────────────────────────────────────────────────

/**
 * LLM-powered structured extraction.
 * Sends the page at `url` through an LLM with `prompt` and returns
 * whatever JSON structure the LLM extracts.
 *
 * @example
 * const data = await smartScrape(
 *   "https://competitor.com/pricing",
 *   "Extract all plan names and their monthly prices as an array of {name, price} objects"
 * );
 */
export async function smartScrape(url: string, prompt: string): Promise<SmartScrapeResult> {
  const res = await fetch(`${getBaseUrl()}/smart-scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, prompt }),
    signal: AbortSignal.timeout(120_000), // LLM can be slow
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Scraper service /smart-scrape failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<SmartScrapeResult>;
}

/**
 * Fast anti-detection scraping via Scrapling.
 * Optionally restrict output to elements matching `selector`.
 *
 * @example
 * // Full page text
 * const result = await crawl("https://example.com/team");
 *
 * // Extract just the email addresses from anchor tags
 * const result = await crawl("https://example.com/contact", "a[href^='mailto']");
 */
export async function crawl(
  url: string,
  selector?: string,
  stealth = true
): Promise<CrawlResult> {
  const res = await fetch(`${getBaseUrl()}/crawl`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, selector, stealth }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Scraper service /crawl failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<CrawlResult>;
}

/**
 * Web search + structured extraction.
 * Searches for `query` across up to `maxResults` pages and returns structured data.
 *
 * @example
 * const data = await searchScrape("ShortStack competitors pricing 2025", 3);
 */
export async function searchScrape(query: string, maxResults = 5): Promise<SearchResult> {
  const res = await fetch(`${getBaseUrl()}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, max_results: maxResults }),
    signal: AbortSignal.timeout(180_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Scraper service /search failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<SearchResult>;
}

/**
 * Returns null if the service is unreachable (instead of throwing).
 * Useful for graceful degradation in UI components.
 */
export async function getScraperHealth(): Promise<ScraperHealth | null> {
  try {
    const res = await fetch(`${getBaseUrl()}/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    return res.json() as Promise<ScraperHealth>;
  } catch {
    return null;
  }
}

/** Whether the scraper service URL is configured (doesn't check reachability). */
export function isScraperServiceConfigured(): boolean {
  return Boolean(process.env.SCRAPER_SERVICE_URL);
}
