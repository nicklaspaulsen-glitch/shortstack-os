/**
 * News trigger detection — primary NewsAPI.org, fallback GDELT 2.0 DOC API.
 *
 * Free-tier quotas:
 *   - NewsAPI.org: 100 req/day (developer plan, 24h delay on articles)
 *   - GDELT 2.0 DOC API: free, no API key, generous (we still throttle)
 *
 * Returns a normalised list of `NewsTriggerHit` rows that are safe to insert
 * into `public.news_triggers`. The caller dedupes via the (lead_id, url)
 * unique constraint — we don't dedupe here.
 *
 * Soft-fail: if neither path returns hits we return an empty array. Never
 * throws.
 */

const TIMEOUT_MS = 10_000;

export type TriggerType =
  | "funding"
  | "hiring"
  | "product_launch"
  | "acquisition"
  | "news_general";

export interface NewsTriggerHit {
  company: string;
  headline: string;
  url: string;
  published_at: string;
  source: string;
  trigger_type: TriggerType;
  summary: string;
}

function getNewsApiKey(): string | null {
  return process.env.NEWSAPI_KEY?.trim() || null;
}

interface NewsApiArticle {
  source?: { id?: string | null; name?: string };
  author?: string;
  title?: string;
  description?: string;
  url?: string;
  urlToImage?: string;
  publishedAt?: string;
  content?: string;
}

interface NewsApiResponse {
  status?: string;
  totalResults?: number;
  articles?: NewsApiArticle[];
  message?: string;
}

interface GdeltArticle {
  url?: string;
  url_mobile?: string;
  title?: string;
  seendate?: string;
  socialimage?: string;
  domain?: string;
  language?: string;
  sourcecountry?: string;
}

interface GdeltResponse {
  articles?: GdeltArticle[];
}

async function fetchWithTimeout(
  url: string,
  ms: number,
  init?: RequestInit,
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...(init ?? {}), signal: controller.signal });
  } catch (err) {
    console.warn(
      "[news-triggers] fetch failed",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Crude but effective trigger classifier from the headline alone. Order
 * matters: more specific patterns first.
 */
export function classifyTrigger(headline: string): TriggerType {
  const h = (headline || "").toLowerCase();
  if (
    /\b(raised|raises|funding round|seed round|series\s+[a-d]|venture round|secures? \$|closes \$|backed by)\b/.test(
      h,
    )
  ) {
    return "funding";
  }
  if (/\b(acquires?|acquired|merger|merges with|to buy|takeover|bought by)\b/.test(h)) {
    return "acquisition";
  }
  if (
    /\b(launches?|launch of|unveils?|introduces?|releases? new|debuts?|rolls? out|announces? new)\b/.test(
      h,
    )
  ) {
    return "product_launch";
  }
  if (/\b(hires?|appointed?|joins as|names?\s+\w+\s+as|new\s+(ceo|cto|cfo|coo|cmo|chief|head|vp|director))\b/.test(h)) {
    return "hiring";
  }
  return "news_general";
}

function summarise(headline: string, description?: string | null): string {
  const text = (description || headline || "").trim();
  if (text.length <= 200) return text;
  return text.slice(0, 197) + "...";
}

function buildSinceIso(sinceDays: number): string {
  return new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
}

async function searchViaNewsApi(
  companyName: string,
  sinceDays: number,
  apiKey: string,
): Promise<NewsTriggerHit[] | null> {
  const from = buildSinceIso(sinceDays).slice(0, 10); // YYYY-MM-DD
  const q = encodeURIComponent(`"${companyName}"`);
  const url = `https://newsapi.org/v2/everything?q=${q}&from=${from}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${encodeURIComponent(apiKey)}`;
  const res = await fetchWithTimeout(url, TIMEOUT_MS);
  if (!res) return null;
  if (!res.ok) {
    console.warn("[news-triggers] newsapi non-200", res.status);
    return null;
  }
  let json: NewsApiResponse;
  try {
    json = (await res.json()) as NewsApiResponse;
  } catch {
    return null;
  }
  if (json.status !== "ok" || !Array.isArray(json.articles)) {
    if (json.message) {
      console.warn("[news-triggers] newsapi error", json.message);
    }
    return null;
  }
  const hits: NewsTriggerHit[] = [];
  for (const a of json.articles) {
    if (!a.title || !a.url || !a.publishedAt) continue;
    hits.push({
      company: companyName,
      headline: a.title.slice(0, 500),
      url: a.url.slice(0, 1000),
      published_at: new Date(a.publishedAt).toISOString(),
      source: a.source?.name?.slice(0, 200) || "newsapi",
      trigger_type: classifyTrigger(a.title),
      summary: summarise(a.title, a.description).slice(0, 1000),
    });
  }
  return hits;
}

async function searchViaGdelt(
  companyName: string,
  sinceDays: number,
): Promise<NewsTriggerHit[]> {
  // GDELT format: timespan is e.g. "7d" / "1d". Their query language wraps
  // exact phrases in quotes the same way NewsAPI does.
  const span = `${Math.max(1, Math.min(31, Math.round(sinceDays)))}d`;
  const q = encodeURIComponent(`"${companyName}"`);
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=ArtList&maxrecords=25&format=json&timespan=${span}&sort=DateDesc`;
  const res = await fetchWithTimeout(url, TIMEOUT_MS, {
    headers: { "User-Agent": "ShortStackOS-NewsTriggers/1.0" },
  });
  if (!res) return [];
  if (!res.ok) {
    console.warn("[news-triggers] gdelt non-200", res.status);
    return [];
  }
  let json: GdeltResponse;
  try {
    json = (await res.json()) as GdeltResponse;
  } catch {
    return [];
  }
  const hits: NewsTriggerHit[] = [];
  for (const a of json.articles ?? []) {
    if (!a.title || !a.url || !a.seendate) continue;
    // GDELT seendate format: "20260420T120000Z" → ISO.
    const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(a.seendate);
    const iso = m
      ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`
      : new Date().toISOString();
    hits.push({
      company: companyName,
      headline: a.title.slice(0, 500),
      url: a.url.slice(0, 1000),
      published_at: iso,
      source: a.domain?.slice(0, 200) || "gdelt",
      trigger_type: classifyTrigger(a.title),
      summary: summarise(a.title, null).slice(0, 1000),
    });
  }
  return hits;
}

/**
 * Search for fresh news mentions of a company. Tries NewsAPI first when keyed,
 * then falls back to GDELT (always free). Empty array on total miss — never throws.
 */
export async function searchCompanyNews(
  companyName: string,
  sinceDays = 7,
): Promise<NewsTriggerHit[]> {
  const trimmed = (companyName || "").trim();
  if (!trimmed || trimmed.length < 2) return [];

  const apiKey = getNewsApiKey();
  if (apiKey) {
    const hits = await searchViaNewsApi(trimmed, sinceDays, apiKey);
    if (hits && hits.length > 0) return hits;
    // NewsAPI returned 0 hits or failed; fall through to GDELT.
  }
  return searchViaGdelt(trimmed, sinceDays);
}
