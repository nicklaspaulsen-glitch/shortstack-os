/**
 * Stock photo search — Pexels (primary) with Unsplash fallback.
 *
 * Both providers are free and license-clean (Pexels license + Unsplash license).
 * Used by the thumbnail editor and AI Studio to insert backdrops without
 * burning a FLUX render every time.
 *
 * SOFT-FAIL DESIGN:
 *   - If neither key is set, returns []. Never throws.
 *   - 5s fetch timeout. On timeout / network error, falls through to the next
 *     provider, then returns [].
 *
 * ATTRIBUTION:
 *   - Pexels: not strictly required, but we include the photographer name.
 *   - Unsplash: required by API guidelines. We pre-build an HTML snippet
 *     that callers can paste under the image.
 */

const FETCH_TIMEOUT_MS = 5_000;

export type StockPhotoOrientation = "landscape" | "portrait" | "square";

export interface StockPhoto {
  id: string;
  src_full: string;
  src_thumb: string;
  width: number;
  height: number;
  photographer: string;
  photographer_url?: string;
  source: "pexels" | "unsplash";
  /** Ready-to-paste credit line. Pre-rendered to keep the caller honest. */
  attribution_html: string;
}

interface SearchOpts {
  perPage?: number;
  orientation?: StockPhotoOrientation;
}

function getPexelsKey(): string | null {
  return process.env.PEXELS_API_KEY || null;
}

function getUnsplashKey(): string | null {
  return process.env.UNSPLASH_ACCESS_KEY || null;
}

async function timedFetch(url: string, init: RequestInit = {}): Promise<Response | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url?: string;
  src: {
    original: string;
    large2x?: string;
    large?: string;
    medium?: string;
    small?: string;
    portrait?: string;
    landscape?: string;
    tiny?: string;
  };
}

interface PexelsSearchResponse {
  photos?: PexelsPhoto[];
  page?: number;
  per_page?: number;
  total_results?: number;
  error?: string;
}

interface UnsplashPhoto {
  id: string;
  width: number;
  height: number;
  urls: {
    raw?: string;
    full?: string;
    regular?: string;
    small?: string;
    thumb?: string;
  };
  user: {
    name: string;
    username: string;
    links?: { html?: string };
  };
  links?: { html?: string };
}

interface UnsplashSearchResponse {
  results?: UnsplashPhoto[];
  total?: number;
  total_pages?: number;
  errors?: string[];
}

function pexelsToCommon(p: PexelsPhoto): StockPhoto {
  return {
    id: `pexels-${p.id}`,
    src_full: p.src.large2x || p.src.large || p.src.original,
    src_thumb: p.src.medium || p.src.small || p.src.tiny || p.src.original,
    width: p.width,
    height: p.height,
    photographer: p.photographer,
    photographer_url: p.photographer_url,
    source: "pexels",
    attribution_html: `Photo by <a href="${escapeHtml(p.photographer_url || "https://pexels.com")}" target="_blank" rel="noopener">${escapeHtml(p.photographer)}</a> on <a href="https://pexels.com" target="_blank" rel="noopener">Pexels</a>`,
  };
}

function unsplashToCommon(p: UnsplashPhoto): StockPhoto {
  const userUrl = p.user.links?.html || `https://unsplash.com/@${p.user.username}`;
  return {
    id: `unsplash-${p.id}`,
    src_full: p.urls.regular || p.urls.full || p.urls.raw || "",
    src_thumb: p.urls.small || p.urls.thumb || p.urls.regular || "",
    width: p.width,
    height: p.height,
    photographer: p.user.name,
    photographer_url: userUrl,
    source: "unsplash",
    // Unsplash license requires attribution + source link.
    attribution_html: `Photo by <a href="${escapeHtml(userUrl)}?utm_source=shortstack&utm_medium=referral" target="_blank" rel="noopener">${escapeHtml(p.user.name)}</a> on <a href="https://unsplash.com/?utm_source=shortstack&utm_medium=referral" target="_blank" rel="noopener">Unsplash</a>`,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function searchPexels(query: string, opts: SearchOpts): Promise<StockPhoto[]> {
  const key = getPexelsKey();
  if (!key) return [];
  const perPage = Math.max(1, Math.min(80, opts.perPage ?? 12));
  const params = new URLSearchParams({
    query,
    per_page: String(perPage),
  });
  if (opts.orientation) params.set("orientation", opts.orientation);

  const res = await timedFetch(`https://api.pexels.com/v1/search?${params.toString()}`, {
    headers: { Authorization: key },
  });
  if (!res || !res.ok) return [];
  try {
    const json = (await res.json()) as PexelsSearchResponse;
    if (!json.photos) return [];
    return json.photos.map(pexelsToCommon);
  } catch {
    return [];
  }
}

async function searchUnsplash(query: string, opts: SearchOpts): Promise<StockPhoto[]> {
  const key = getUnsplashKey();
  if (!key) return [];
  const perPage = Math.max(1, Math.min(30, opts.perPage ?? 12));
  const params = new URLSearchParams({
    query,
    per_page: String(perPage),
    client_id: key,
  });
  if (opts.orientation) {
    // Unsplash uses different orientation values
    const map: Record<StockPhotoOrientation, string> = {
      landscape: "landscape",
      portrait: "portrait",
      square: "squarish",
    };
    params.set("orientation", map[opts.orientation]);
  }

  const res = await timedFetch(`https://api.unsplash.com/search/photos?${params.toString()}`);
  if (!res || !res.ok) return [];
  try {
    const json = (await res.json()) as UnsplashSearchResponse;
    if (!json.results) return [];
    return json.results.map(unsplashToCommon);
  } catch {
    return [];
  }
}

/**
 * Search license-clean stock photos. Returns [] on any failure (graceful).
 * Uses Pexels primary, falls back to Unsplash if Pexels returned nothing.
 */
export async function searchStockPhotos(
  query: string,
  opts: SearchOpts = {},
): Promise<StockPhoto[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Try Pexels first; if it returns any results, use them.
  const pexels = await searchPexels(trimmed, opts);
  if (pexels.length > 0) return pexels;

  // Fallback to Unsplash.
  const unsplash = await searchUnsplash(trimmed, opts);
  return unsplash;
}

const CURATED_QUERIES: Record<
  "business" | "tech" | "abstract" | "people" | "nature",
  string
> = {
  business: "modern office workspace",
  tech: "technology computer abstract",
  abstract: "abstract gradient texture",
  people: "diverse people lifestyle",
  nature: "nature landscape sunlight",
};

/**
 * Curated category browsing — when the user just wants to look at "tech"
 * backgrounds without typing a query.
 */
export async function getCuratedStockPhotos(
  category: keyof typeof CURATED_QUERIES,
  perPage = 12,
): Promise<StockPhoto[]> {
  const query = CURATED_QUERIES[category];
  return searchStockPhotos(query, { perPage });
}

/**
 * Used by /api/integrations/health-style probes. Returns whether at least
 * one stock-photo provider is configured.
 */
export function isStockPhotosConfigured(): { configured: boolean; providers: string[] } {
  const providers: string[] = [];
  if (getPexelsKey()) providers.push("pexels");
  if (getUnsplashKey()) providers.push("unsplash");
  return { configured: providers.length > 0, providers };
}
