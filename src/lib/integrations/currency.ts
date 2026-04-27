/**
 * Currency exchange — Frankfurter (free, no key, ECB-sourced) primary,
 * Open Exchange Rates (free 1k req/mo) fallback.
 *
 * Used by the white-label client portal to show invoice + balance amounts in
 * the client's local currency next to the agency's reporting currency.
 *
 * CACHING:
 *   - Process-local Map keyed by `${from}->${to}`. 1-hour TTL.
 *   - Frankfurter only updates daily, so cache savings are real.
 *   - Cache survives across requests within a single Vercel lambda; cold
 *     starts pay the network cost again. That's fine — it's bounded.
 *
 * SOFT-FAIL DESIGN:
 *   - Both providers down → returns rate=1 (fallback identity). Caller is
 *     expected to render "≈" or omit the conversion display rather than
 *     show a misleading number, but rate=1 means math doesn't crash.
 */

const FETCH_TIMEOUT_MS = 5_000;
const CACHE_TTL_MS = 60 * 60 * 1_000; // 1 hour

export interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  fetched_at: string;
  /** Whether the rate came from the cache vs a fresh provider call. */
  cached?: boolean;
  /** Provider that supplied the rate, or "fallback" when both failed. */
  source: "frankfurter" | "openexchangerates" | "fallback" | "cache";
}

interface CacheEntry {
  rate: number;
  fetched_at: number;
  source: ExchangeRate["source"];
}

const cache = new Map<string, CacheEntry>();

function cacheKey(from: string, to: string): string {
  return `${from.toUpperCase()}->${to.toUpperCase()}`;
}

function getCached(from: string, to: string): CacheEntry | null {
  const k = cacheKey(from, to);
  const entry = cache.get(k);
  if (!entry) return null;
  if (Date.now() - entry.fetched_at > CACHE_TTL_MS) {
    cache.delete(k);
    return null;
  }
  return entry;
}

function setCached(from: string, to: string, rate: number, source: ExchangeRate["source"]): void {
  cache.set(cacheKey(from, to), { rate, fetched_at: Date.now(), source });
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

interface FrankfurterResponse {
  amount?: number;
  base?: string;
  date?: string;
  rates?: Record<string, number>;
}

interface OpenExchangeResponse {
  base?: string;
  rates?: Record<string, number>;
  timestamp?: number;
  error?: boolean;
  message?: string;
}

async function fetchFromFrankfurter(
  from: string,
  toMany: string[],
): Promise<Record<string, number> | null> {
  const fromU = from.toUpperCase();
  const toList = toMany.map((c) => c.toUpperCase()).filter((c) => c !== fromU);
  if (toList.length === 0) return {};

  const params = new URLSearchParams({
    from: fromU,
    to: toList.join(","),
  });
  const res = await timedFetch(`https://api.frankfurter.app/latest?${params.toString()}`);
  if (!res || !res.ok) return null;
  try {
    const json = (await res.json()) as FrankfurterResponse;
    if (!json.rates) return null;
    return json.rates;
  } catch {
    return null;
  }
}

async function fetchFromOpenExchange(
  from: string,
  toMany: string[],
): Promise<Record<string, number> | null> {
  const key = process.env.OPEN_EXCHANGE_KEY;
  if (!key) return null;

  const fromU = from.toUpperCase();
  const toList = toMany.map((c) => c.toUpperCase());

  // Open Exchange's free tier only supports USD as base. We fetch USD->X
  // for all currencies and compute cross-rates manually.
  const params = new URLSearchParams({
    app_id: key,
    base: "USD",
    symbols: Array.from(new Set([fromU, ...toList])).join(","),
  });
  const res = await timedFetch(`https://openexchangerates.org/api/latest.json?${params.toString()}`);
  if (!res || !res.ok) return null;
  try {
    const json = (await res.json()) as OpenExchangeResponse;
    if (json.error || !json.rates) return null;
    const usdToFrom = fromU === "USD" ? 1 : json.rates[fromU];
    if (!usdToFrom) return null;
    const result: Record<string, number> = {};
    for (const to of toList) {
      if (to === fromU) {
        result[to] = 1;
        continue;
      }
      const usdToTo = to === "USD" ? 1 : json.rates[to];
      if (usdToTo) {
        // from -> USD -> to
        result[to] = usdToTo / usdToFrom;
      }
    }
    return result;
  } catch {
    return null;
  }
}

/**
 * Single-pair exchange rate. Caches for 1 hour.
 * Returns rate=1 with source="fallback" if all providers are unreachable —
 * caller can detect this and hide the conversion display.
 */
export async function getRate(from: string, to: string): Promise<ExchangeRate> {
  const fromU = from.toUpperCase();
  const toU = to.toUpperCase();

  if (fromU === toU) {
    return {
      from: fromU,
      to: toU,
      rate: 1,
      fetched_at: new Date().toISOString(),
      source: "cache",
    };
  }

  const cached = getCached(fromU, toU);
  if (cached) {
    return {
      from: fromU,
      to: toU,
      rate: cached.rate,
      fetched_at: new Date(cached.fetched_at).toISOString(),
      cached: true,
      source: "cache",
    };
  }

  // Try Frankfurter first
  const frankfurter = await fetchFromFrankfurter(fromU, [toU]);
  if (frankfurter && frankfurter[toU]) {
    const rate = frankfurter[toU];
    setCached(fromU, toU, rate, "frankfurter");
    return {
      from: fromU,
      to: toU,
      rate,
      fetched_at: new Date().toISOString(),
      source: "frankfurter",
    };
  }

  // Fallback to Open Exchange Rates
  const oxr = await fetchFromOpenExchange(fromU, [toU]);
  if (oxr && oxr[toU]) {
    const rate = oxr[toU];
    setCached(fromU, toU, rate, "openexchangerates");
    return {
      from: fromU,
      to: toU,
      rate,
      fetched_at: new Date().toISOString(),
      source: "openexchangerates",
    };
  }

  // Both failed — caller should detect source="fallback" and hide UI.
  return {
    from: fromU,
    to: toU,
    rate: 1,
    fetched_at: new Date().toISOString(),
    source: "fallback",
  };
}

/**
 * Bulk: fetch rates from one base to many targets in a single provider hit.
 * Returns a map of currencyCode -> rate. Only includes currencies that
 * the provider returned. Same currency as `from` always returns 1.
 */
export async function getRates(
  from: string,
  toMany: string[],
): Promise<Record<string, number>> {
  const fromU = from.toUpperCase();
  const targets = Array.from(new Set(toMany.map((c) => c.toUpperCase())));

  // Pull what we have cached
  const result: Record<string, number> = {};
  const missing: string[] = [];
  for (const to of targets) {
    if (to === fromU) {
      result[to] = 1;
      continue;
    }
    const cached = getCached(fromU, to);
    if (cached) result[to] = cached.rate;
    else missing.push(to);
  }
  if (missing.length === 0) return result;

  // Fetch missing
  const frankfurter = await fetchFromFrankfurter(fromU, missing);
  if (frankfurter) {
    for (const to of missing) {
      if (frankfurter[to]) {
        result[to] = frankfurter[to];
        setCached(fromU, to, frankfurter[to], "frankfurter");
      }
    }
    // Anything left missing fall back to OXR
    const stillMissing = missing.filter((t) => result[t] === undefined);
    if (stillMissing.length === 0) return result;
    const oxr = await fetchFromOpenExchange(fromU, stillMissing);
    if (oxr) {
      for (const to of stillMissing) {
        if (oxr[to]) {
          result[to] = oxr[to];
          setCached(fromU, to, oxr[to], "openexchangerates");
        }
      }
    }
    return result;
  }

  // Frankfurter completely down — try OXR
  const oxr = await fetchFromOpenExchange(fromU, missing);
  if (oxr) {
    for (const to of missing) {
      if (oxr[to]) {
        result[to] = oxr[to];
        setCached(fromU, to, oxr[to], "openexchangerates");
      }
    }
  }
  return result;
}

/**
 * Convert a cents-denominated amount from one currency to another.
 * Cents in, cents out — keeps callers honest about FP errors.
 */
export async function convert(
  amountCents: number,
  from: string,
  to: string,
): Promise<{ amount_cents: number; rate: number; source: ExchangeRate["source"] }> {
  const r = await getRate(from, to);
  const converted = Math.round(amountCents * r.rate);
  return { amount_cents: converted, rate: r.rate, source: r.source };
}

/**
 * Test-only: clear the in-memory cache. Exported for vitest.
 */
export function __clearCurrencyCache(): void {
  cache.clear();
}
