import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Check domain availability across common TLDs.
 *
 * Resolution order per domain:
 *   1. GoDaddy /v1/domains/available (needs reseller-grade API key, gives price)
 *   2. RDAP fallback (open standard, free, no auth) when GoDaddy returns 401/403
 *      or is not configured. RDAP returns 200 if taken, 404 if available.
 *
 * RDAP cannot tell us price, so we only get available/taken — the UI shows a
 * fallback placeholder price. If both sources fail we return `available: null`
 * ("Unknown — can't verify") instead of lying about the status.
 *
 * Body: { query: string }
 * Returns: { results: Array<{ domain, available, price, currency, source }> }
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

/**
 * Return the RDAP endpoint URL for a given domain's TLD.
 * Uses per-TLD servers where known (faster, more reliable) and falls back to
 * the federated rdap.org resolver which redirects to the correct server.
 */
function rdapUrlFor(domain: string): string {
  const tld = domain.split(".").pop()?.toLowerCase() || "";
  const enc = encodeURIComponent(domain);
  switch (tld) {
    case "com":
    case "net":
      return `https://rdap.verisign.com/com/v1/domain/${enc}`;
    case "io":
      return `https://rdap.nic.io/domain/${enc}`;
    case "co":
      return `https://rdap.nic.co/domain/${enc}`;
    case "app":
    case "dev":
      return `https://rdap.nic.google/domain/${enc}`;
    case "xyz":
      return `https://rdap.centralnic.com/xyz/domain/${enc}`;
    default:
      return `https://rdap.org/domain/${enc}`;
  }
}

/**
 * Probe RDAP for a domain. Per RFC 9082:
 *   - 200 → domain is registered (taken)
 *   - 404 → domain is not registered (available)
 *   - anything else → uncertain; return null
 */
async function rdapLookup(domain: string): Promise<boolean | null> {
  try {
    const res = await fetch(rdapUrlFor(domain), {
      headers: { Accept: "application/rdap+json, application/json" },
      // Don't let a slow RDAP server block the whole search — bail after 4s.
      signal: AbortSignal.timeout(4000),
    });
    if (res.status === 200) return false; // registered → NOT available
    if (res.status === 404) return true;  // not found → available
    return null;
  } catch {
    return null;
  }
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

  // Stub mode — no GoDaddy creds at all. We still try RDAP so the user gets
  // real availability data even without a paid reseller account.
  if (!config) {
    const stubPrices: Record<string, number> = {
      com: 12.99, io: 34.99, co: 29.99, net: 14.99, app: 14.99, dev: 12.99, xyz: 2.99,
    };
    const results = await Promise.all(TLDS.map(async tld => {
      const domain = `${clean}.${tld}`;
      const available = await rdapLookup(domain);
      return {
        domain,
        available,
        price: available === true ? stubPrices[tld] : null,
        currency: "USD",
        source: available === null ? "stub" : "rdap",
      };
    }));
    return NextResponse.json({
      results,
      stub: true,
      message: "Using RDAP (no GoDaddy creds). Set GODADDY_API_KEY + GODADDY_API_SECRET for wholesale pricing.",
    });
  }

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
          // Auth/permission errors are where GoDaddy personal keys fail on
          // production (403). Fall back to RDAP so the user still sees real
          // availability instead of a useless "Unknown (HTTP 403)" string.
          const rdapAvailable = await rdapLookup(domain);
          return {
            domain,
            available: rdapAvailable,
            price: null,
            currency: "USD",
            source: rdapAvailable === null ? `godaddy-${config.env}` : "rdap",
            error: rdapAvailable === null
              ? "Unknown — can't verify"
              : undefined,
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
        // Network/transport errors → try RDAP as a safety net.
        const rdapAvailable = await rdapLookup(domain);
        return {
          domain,
          available: rdapAvailable,
          price: null,
          currency: "USD",
          source: rdapAvailable === null ? `godaddy-${config.env}` : "rdap",
          error: rdapAvailable === null ? "Unknown — can't verify" : undefined,
        };
      }
    }));

    // If every GoDaddy call failed with auth errors but RDAP rescued most of
    // them, we still want to tell the operator so they can fix the API key.
    const allGoDaddyFailed = apiErrors.length === TLDS.length;
    const hasAuthError = apiErrors.some(e => e.includes("401") || e.includes("403"));
    if (allGoDaddyFailed && hasAuthError) {
      return NextResponse.json({
        results,
        stub: false,
        env: config.env,
        warning: `GoDaddy ${config.env} rejected the API credentials — using RDAP fallback (no pricing). Fix GODADDY_API_KEY / GODADDY_API_SECRET for wholesale prices.`,
      });
    }

    return NextResponse.json({ results, stub: false, env: config.env });
  } catch (err) {
    console.error("[domains/search] unexpected error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
