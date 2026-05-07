/**
 * Lazy-initialised Firecrawl client.
 *
 * Pattern mirrors src/lib/stripe/client.ts and src/lib/ai/claude-helpers.ts:
 * module-level SDK construction is BANNED in this repo because Vercel's
 * page-data collection pass imports every route module at build time, before
 * runtime env vars are available. Constructing a client at module scope causes
 * build failures when the API key is absent.
 *
 * SDK note: @mendable/firecrawl-js v4 exports `Firecrawl` as default (v2 client
 * with `scrape()` / `crawl()` methods). The legacy v1 `FirecrawlApp` is still
 * accessible as `client.v1` but is feature-frozen — use the v2 methods.
 *
 * Usage:
 *   const client = getFirecrawlClient();      // throws if key not set
 *   const client = getFirecrawlClientOrNull(); // null if key not set
 */

import Firecrawl from "@mendable/firecrawl-js";

let _client: Firecrawl | null = null;

/**
 * Returns the singleton Firecrawl client, constructing it on first call.
 * Throws a descriptive error if FIRECRAWL_API_KEY is not configured so the
 * caller can return a proper 500 with a useful message rather than a cryptic
 * SDK crash.
 */
export function getFirecrawlClient(): Firecrawl {
  if (_client) return _client;
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) {
    throw new Error(
      "FIRECRAWL_API_KEY is not configured. Set it in Vercel env vars (or .env.local for dev) before calling Firecrawl-backed routes.",
    );
  }
  _client = new Firecrawl({ apiKey: key });
  return _client;
}

/**
 * Returns the lazy Firecrawl client, or null if FIRECRAWL_API_KEY is missing.
 * Use this in paths that should gracefully degrade rather than throw.
 */
export function getFirecrawlClientOrNull(): Firecrawl | null {
  if (_client) return _client;
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return null;
  _client = new Firecrawl({ apiKey: key });
  return _client;
}

/** Whether Firecrawl is configured. Useful for gating UI scrape buttons. */
export function isFirecrawlConfigured(): boolean {
  return Boolean(process.env.FIRECRAWL_API_KEY);
}
