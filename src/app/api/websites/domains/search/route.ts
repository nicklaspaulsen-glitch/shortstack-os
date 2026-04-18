import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Check domain availability across common TLDs via GoDaddy.
 * Body: { query: string }
 * Returns: { results: Array<{ domain, available, price, currency, source }> }
 *
 * If GODADDY_API_KEY is missing, returns stub data marked source="stub".
 */

const TLDS = ["com", "io", "co", "net", "app", "dev", "xyz"];

interface GoDaddyAvailability {
  domain?: string;
  available?: boolean;
  price?: number;
  currency?: string;
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

  const godaddyKey = process.env.GODADDY_API_KEY;
  const godaddySecret = process.env.GODADDY_API_SECRET;

  // Stub mode
  if (!godaddyKey || !godaddySecret) {
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

  try {
    const results = await Promise.all(TLDS.map(async tld => {
      const domain = `${clean}.${tld}`;
      try {
        const res = await fetch(
          `https://api.godaddy.com/v1/domains/available?domain=${encodeURIComponent(domain)}&checkType=FULL`,
          { headers: { Authorization: `sso-key ${godaddyKey}:${godaddySecret}` } }
        );
        if (!res.ok) {
          return { domain, available: false, price: null, currency: "USD", source: "godaddy", error: `HTTP ${res.status}` };
        }
        const data: GoDaddyAvailability = await res.json();
        // GoDaddy returns price in micros (1/1000000 of the currency unit)
        const priceValue = typeof data.price === "number" ? data.price / 1000000 : null;
        return {
          domain,
          available: !!data.available,
          price: priceValue,
          currency: data.currency || "USD",
          source: "godaddy",
        };
      } catch (err) {
        return { domain, available: false, price: null, currency: "USD", source: "godaddy", error: String(err) };
      }
    }));

    return NextResponse.json({ results, stub: false });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
