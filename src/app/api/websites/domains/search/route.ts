import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Check domain availability across common TLDs via GoDaddy.
 * Body: { query: string }
 * Returns: { results: Array<{ domain, available, price, currency, source }> }
 *
 * Environment:
 *   GODADDY_API_KEY / GODADDY_API_SECRET  — production credentials (default)
 *   GODADDY_API_KEY_OTE / GODADDY_API_SECRET_OTE  — OTE sandbox credentials
 *   GODADDY_USE_OTE=1                     — force OTE endpoint even with prod key
 *
 * If neither set of creds is present we return stub data marked source="stub".
 *
 * Note: GoDaddy's /v1/domains/available endpoint requires a reseller account
 * on production. Personal API keys will receive 403 Forbidden. If that happens
 * we now propagate a useful error instead of silently marking every domain as
 * "Taken" (the old behaviour that made every random search look unavailable).
 */

const TLDS = ["com", "io", "co", "net", "app", "dev", "xyz"];

interface GoDaddyAvailability {
  domain?: string;
  available?: boolean;
  price?: number;
  currency?: string;
}

// Pick the right base URL + credentials. Prefer production; fall back to OTE
// if only OTE creds exist or GODADDY_USE_OTE is explicitly set.
function resolveGoDaddyConfig() {
  const prodKey = process.env.GODADDY_API_KEY;
  const prodSecret = process.env.GODADDY_API_SECRET;
  const oteKey = process.env.GODADDY_API_KEY_OTE;
  const oteSecret = process.env.GODADDY_API_SECRET_OTE;
  const forceOte = process.env.GODADDY_USE_OTE === "1" || process.env.GODADDY_USE_OTE === "true";

  if (forceOte && oteKey && oteSecret) {
    return { key: oteKey, secret: oteSecret, baseUrl: "https://api.ote-godaddy.com", env: "ote" as const };
  }
  if (prodKey && prodSecret) {
    return { key: prodKey, secret: prodSecret, baseUrl: "https://api.godaddy.com", env: "production" as const };
  }
  if (oteKey && oteSecret) {
    return { key: oteKey, secret: oteSecret, baseUrl: "https://api.ote-godaddy.com", env: "ote" as const };
  }
  return null;
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { query } = await request.json();
  if (!query || typeof query !== "string") {
    return NextResponse.json({ error: "query required" }, { status: 400 });
  }

  const clean = query.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60);
  if (!clean) return NextResponse.json({ error: "invalid query" }, { status: 400 });

  const config = resolveGoDaddyConfig();

  // Stub mode
  if (!config) {
    const stubPrices: Record<string, number> = {
      com: 12.99, io: 34.99, co: 29.99, net: 14.99, app: 14.99, dev: 12.99, xyz: 2.99,
    };
    return NextResponse.json({
      results: TLDS.map(tld => ({
        domain: `${clean}.${tld}`,
        available: tld !== "com", // pretend .com is taken for realism
        price: stubPrices[tld],
        currency: "USD",
        source: "stub",
      })),
      stub: true,
      message: "Stub data — set GODADDY_API_KEY + GODADDY_API_SECRET for real lookups.",
    });
  }

  // Track API errors so we can surface them (instead of silently flagging all
  // domains as taken).
  const apiErrors: string[] = [];

  try {
    const results = await Promise.all(TLDS.map(async tld => {
      const domain = `${clean}.${tld}`;
      try {
        const url = `${config.baseUrl}/v1/domains/available?domain=${encodeURIComponent(domain)}&checkType=FULL`;
        const res = await fetch(url, {
          headers: { Authorization: `sso-key ${config.key}:${config.secret}` },
        });
        if (!res.ok) {
          const bodyText = await res.text().catch(() => "");
          console.warn(
            `[domains/search] GoDaddy ${config.env} returned HTTP ${res.status} for ${domain}: ${bodyText.slice(0, 200)}`
          );
          apiErrors.push(`HTTP ${res.status}`);
          // CRITICAL: when GoDaddy returns an auth/permission error (401/403)
          // we have NO idea if the domain is available — return `null` rather
          // than `false` so the UI can show an "unknown" state instead of
          // misleading "Taken".
          return {
            domain,
            available: null,
            price: null,
            currency: "USD",
            source: `godaddy-${config.env}`,
            error: `HTTP ${res.status}${bodyText ? `: ${bodyText.slice(0, 120)}` : ""}`,
          };
        }
        const data: GoDaddyAvailability = await res.json();
        // GoDaddy returns price in micros (1/1000000 of the currency unit)
        const priceValue = typeof data.price === "number" ? data.price / 1000000 : null;
        return {
          domain,
          available: !!data.available,
          price: priceValue,
          currency: data.currency || "USD",
          source: `godaddy-${config.env}`,
        };
      } catch (err) {
        console.warn(`[domains/search] GoDaddy ${config.env} fetch error for ${domain}:`, err);
        apiErrors.push(String(err));
        return {
          domain,
          available: null,
          price: null,
          currency: "USD",
          source: `godaddy-${config.env}`,
          error: String(err),
        };
      }
    }));

    // If EVERY request failed with the same auth error, surface a top-level
    // error so the UI can explain what's wrong rather than mislabelling every
    // domain as taken.
    const allFailed = results.every(r => r.available === null);
    const hasAuthError = apiErrors.some(e => e.includes("401") || e.includes("403"));
    if (allFailed && hasAuthError) {
      return NextResponse.json({
        results,
        stub: false,
        env: config.env,
        error: `GoDaddy ${config.env} rejected the API credentials (likely reseller-only access required). Verify GODADDY_API_KEY / GODADDY_API_SECRET are for ${config.env === "production" ? "production" : "OTE"} and have domain availability access enabled.`,
      }, { status: 200 });
    }

    return NextResponse.json({ results, stub: false, env: config.env });
  } catch (err) {
    console.error("[domains/search] unexpected error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
