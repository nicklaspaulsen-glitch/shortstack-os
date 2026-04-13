import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// ── Apify actor registry ─────────────────────────────────────────────
const APIFY_ACTORS: Record<string, { actorId: string; buildInput: (q: string, loc: string, max: number, filters: Record<string, unknown>) => Record<string, unknown> }> = {
  google_maps: {
    actorId: "apify/google-maps-scraper",
    buildInput: (q, loc, max) => ({
      searchStringsArray: [loc ? `${q} in ${loc}` : q],
      maxCrawledPlacesPerSearch: max,
      language: "en",
      includeWebResults: false,
    }),
  },
  instagram: {
    actorId: "apify/instagram-scraper",
    buildInput: (q, loc, max) => ({
      search: loc ? `${q} ${loc}` : q,
      searchType: "user",
      resultsLimit: max,
    }),
  },
  facebook: {
    actorId: "apify/facebook-pages-scraper",
    buildInput: (q, loc, max) => ({
      searchQueries: [loc ? `${q} ${loc}` : q],
      maxPages: max,
    }),
  },
  tripadvisor: {
    actorId: "apify/tripadvisor-scraper",
    buildInput: (q, loc, max) => ({
      query: loc ? `${q} ${loc}` : q,
      maxItems: max,
      language: "en",
    }),
  },
  trustpilot: {
    actorId: "apify/trustpilot-scraper",
    buildInput: (q, _loc, max) => ({
      searchQuery: q,
      maxItems: max,
    }),
  },
  yellow_pages: {
    actorId: "apify/yellow-pages-scraper",
    buildInput: (q, loc, max) => ({
      search: q,
      location: loc || "US",
      maxItems: max,
    }),
  },
  yelp: {
    actorId: "apify/yelp-scraper",
    buildInput: (q, loc, max) => ({
      searchTerms: [q],
      locations: [loc || "US"],
      maxResults: max,
    }),
  },
  indeed: {
    actorId: "apify/indeed-scraper",
    buildInput: (q, loc, max) => ({
      query: q,
      location: loc || "",
      maxItems: max,
    }),
  },
};

// ── Lead scoring (mirrors existing run/route.ts logic) ───────────────
function scoreLeadQuality(lead: {
  phone: string | null;
  email: string | null;
  website: string | null;
  google_rating: number | null;
  review_count: number;
  facebook_url?: string | null;
  source: string;
}): number {
  let score = 0;
  if (lead.phone) score += 15;
  if (lead.email) score += 15;
  if (lead.website) score += 10;
  if (lead.review_count < 20) score += 15;
  if (!lead.website || lead.website.includes("facebook.com") || lead.website.includes("yelp.com")) score += 10;
  if (lead.google_rating !== null && lead.google_rating < 4.0) score += 10;
  if (lead.google_rating !== null && lead.google_rating >= 4.0 && lead.review_count < 20) score += 10;
  if (lead.facebook_url) score += 5;
  if (["google_maps", "facebook", "tripadvisor", "yelp", "yellow_pages"].includes(lead.source)) score += 10;
  return Math.min(score, 100);
}

// ── Input validation ─────────────────────────────────────────────────
const MAX_QUERY_LENGTH = 200;
const MAX_LOCATION_LENGTH = 200;
const MAX_RESULTS_CEILING = 500;
const APIFY_RUN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const POLL_INTERVAL_MS = 3000;

function sanitize(val: unknown): string {
  if (typeof val !== "string") return "";
  // Strip control chars, trim, and limit length
  return val.replace(/[\x00-\x1F\x7F]/g, "").trim();
}

// ── Unified result mapper ────────────────────────────────────────────
// Each Apify actor returns different shapes. This normalizes them all
// into the leads table schema.
function mapToLead(
  platform: string,
  item: Record<string, unknown>,
  query: string,
): Record<string, unknown> {
  switch (platform) {
    case "google_maps": {
      const addressParts = (str(item.address) || str(item.formattedAddress) || "").split(",").map(s => s.trim());
      return {
        business_name: str(item.title) || str(item.name) || str(item.displayName) || "",
        phone: str(item.phone) || str(item.phoneNumber) || null,
        email: str(item.email) || null,
        website: str(item.website) || str(item.url) || null,
        address: str(item.address) || str(item.formattedAddress) || null,
        city: str(item.city) || addressParts[1] || null,
        state: str(item.state) || addressParts[2]?.split(" ")[0] || null,
        country: str(item.countryCode) || addressParts[addressParts.length - 1] || "US",
        google_rating: num(item.totalScore) ?? num(item.rating) ?? null,
        review_count: num(item.reviewsCount) ?? num(item.userRatingCount) ?? 0,
        industry: query,
        category: str(item.categoryName) || str(item.category) || query,
        source: "google_maps",
        source_url: str(item.url) || str(item.googleMapsUri) || null,
      };
    }

    case "instagram": {
      return {
        business_name: str(item.fullName) || str(item.username) || str(item.name) || "",
        phone: str(item.phone) || str(item.businessPhoneNumber) || null,
        email: str(item.email) || str(item.businessEmail) || null,
        website: str(item.externalUrl) || str(item.website) || null,
        address: str(item.address) || str(item.businessAddress) || null,
        city: str(item.city) || null,
        state: null,
        country: null,
        google_rating: null,
        review_count: num(item.followersCount) ?? num(item.followers) ?? 0,
        industry: query,
        category: str(item.category) || str(item.businessCategory) || query,
        source: "instagram",
        source_url: str(item.url) || (str(item.username) ? `https://instagram.com/${str(item.username)}` : null),
        instagram_url: str(item.url) || (str(item.username) ? `https://instagram.com/${str(item.username)}` : null),
      };
    }

    case "facebook": {
      return {
        business_name: str(item.name) || str(item.title) || "",
        phone: str(item.phone) || null,
        email: str(item.email) || firstStr(item.emails) || null,
        website: str(item.website) || null,
        address: str(item.address) || str(item.singleLineAddress) || null,
        city: str(item.city) || null,
        state: str(item.state) || null,
        country: str(item.country) || null,
        google_rating: num(item.overallStarRating) ?? null,
        review_count: num(item.reviewCount) ?? num(item.likes) ?? num(item.fanCount) ?? 0,
        industry: query,
        category: str(item.category) || str(item.categoryList) || query,
        source: "facebook",
        source_url: str(item.url) || str(item.link) || null,
        facebook_url: str(item.url) || str(item.link) || null,
      };
    }

    case "tripadvisor": {
      const addrObj = item.addressObj;
      return {
        business_name: str(item.name) || str(item.title) || "",
        phone: str(item.phone) || str(item.telephone) || null,
        email: str(item.email) || null,
        website: str(item.website) || str(item.webUrl) || null,
        address: str(item.address) || str(nested(addrObj, "street1")) || null,
        city: str(nested(addrObj, "city")) || str(item.city) || null,
        state: str(nested(addrObj, "state")) || str(item.state) || null,
        country: str(nested(addrObj, "country")) || str(item.country) || null,
        google_rating: num(item.rating) ?? null,
        review_count: num(item.reviewsCount) ?? num(item.numReviews) ?? 0,
        industry: query,
        category: str(item.category) || str(item.subcategory) || query,
        source: "tripadvisor",
        source_url: str(item.url) || str(item.webUrl) || null,
      };
    }

    case "trustpilot": {
      return {
        business_name: str(item.name) || str(item.displayName) || str(item.businessName) || "",
        phone: str(item.phone) || null,
        email: str(item.email) || null,
        website: str(item.website) || str(item.websiteUrl) || null,
        address: str(item.address) || null,
        city: str(item.city) || null,
        state: str(item.state) || null,
        country: str(item.country) || null,
        google_rating: num(item.trustScore) ?? num(item.score) ?? null,
        review_count: num(item.numberOfReviews) ?? num(item.reviewsCount) ?? 0,
        industry: query,
        category: str(item.category) || query,
        source: "trustpilot",
        source_url: str(item.url) || str(item.profileUrl) || null,
      };
    }

    case "yellow_pages": {
      return {
        business_name: str(item.name) || str(item.businessName) || "",
        phone: str(item.phone) || str(item.phoneNumber) || null,
        email: str(item.email) || null,
        website: str(item.website) || str(item.websiteUrl) || null,
        address: str(item.address) || str(item.street) || null,
        city: str(item.city) || null,
        state: str(item.state) || null,
        country: "US",
        google_rating: num(item.rating) ?? null,
        review_count: num(item.reviewCount) ?? 0,
        industry: query,
        category: str(item.category) || str(item.categories) || query,
        source: "yellow_pages",
        source_url: str(item.url) || str(item.yellowPagesUrl) || null,
      };
    }

    case "yelp": {
      return {
        business_name: str(item.name) || str(item.businessName) || "",
        phone: str(item.phone) || str(item.displayPhone) || null,
        email: str(item.email) || null,
        website: str(item.website) || str(item.businessUrl) || null,
        address: str(item.address) || str(item.fullAddress) || null,
        city: str(item.city) || null,
        state: str(item.state) || null,
        country: str(item.country) || "US",
        google_rating: num(item.rating) ?? null,
        review_count: num(item.reviewCount) ?? num(item.reviewsCount) ?? 0,
        industry: query,
        category: firstStr(item.categories) || str(item.category) || query,
        source: "yelp",
        source_url: str(item.url) || str(item.businessUrl) || null,
      };
    }

    case "indeed": {
      // Indeed yields job listings; we extract the hiring company as a B2B lead
      return {
        business_name: str(item.company) || str(item.companyName) || str(item.employerName) || "",
        phone: null,
        email: null,
        website: str(item.companyUrl) || str(item.companyLink) || null,
        address: str(item.location) || null,
        city: str(item.city) || null,
        state: str(item.state) || null,
        country: str(item.country) || "US",
        google_rating: null,
        review_count: 0,
        industry: query,
        category: str(item.jobType) || str(item.category) || query,
        source: "indeed",
        source_url: str(item.url) || str(item.jobUrl) || null,
      };
    }

    default:
      return { business_name: str(item.name) || "Unknown", source: platform, industry: query };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────
function str(v: unknown): string | null {
  if (typeof v === "string" && v.length > 0) return v;
  if (typeof v === "object" && v !== null && "text" in (v as Record<string, unknown>)) return str((v as Record<string, unknown>).text);
  return null;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") { const n = parseFloat(v); if (!Number.isNaN(n)) return n; }
  return null;
}

function firstStr(v: unknown): string | null {
  if (Array.isArray(v) && v.length > 0) return str(v[0]?.title) || str(v[0]?.name) || str(v[0]);
  return str(v);
}

// Safely access nested object properties on Apify result items
function nested(obj: unknown, key: string): unknown {
  if (typeof obj !== "object" || obj === null) return undefined;
  return (obj as Record<string, unknown>)[key];
}

// ── Main handler ─────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── Parse & validate input ──────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const platform = sanitize(body.platform);
  const query = sanitize(body.query);
  const location = sanitize(body.location);
  const maxResults = Math.max(1, Math.min(Number(body.max_results) || 20, MAX_RESULTS_CEILING));
  const filters = (typeof body.filters === "object" && body.filters !== null ? body.filters : {}) as Record<string, unknown>;
  const clientId = sanitize(body.client_id) || null;

  if (!platform) return NextResponse.json({ error: "Missing `platform`" }, { status: 400 });
  if (!query) return NextResponse.json({ error: "Missing `query`" }, { status: 400 });
  if (query.length > MAX_QUERY_LENGTH) return NextResponse.json({ error: `query exceeds ${MAX_QUERY_LENGTH} chars` }, { status: 400 });
  if (location.length > MAX_LOCATION_LENGTH) return NextResponse.json({ error: `location exceeds ${MAX_LOCATION_LENGTH} chars` }, { status: 400 });

  const actor = APIFY_ACTORS[platform];
  if (!actor) {
    return NextResponse.json({ error: `Unsupported platform: ${platform}. Supported: ${Object.keys(APIFY_ACTORS).join(", ")}` }, { status: 400 });
  }

  const apifyToken = process.env.APIFY_API_TOKEN;
  if (!apifyToken) {
    return NextResponse.json({ error: "APIFY_API_TOKEN not configured" }, { status: 500 });
  }

  // ── Start Apify run ─────────────────────────────────────────────
  const input = actor.buildInput(query, location, maxResults, filters);

  let runId: string;
  try {
    const startRes = await fetch(`https://api.apify.com/v2/acts/${actor.actorId}/runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apifyToken}`,
      },
      body: JSON.stringify(input),
    });

    if (!startRes.ok) {
      const errBody = await startRes.text();
      return NextResponse.json({ error: `Apify start failed (${startRes.status}): ${errBody}` }, { status: 502 });
    }

    const startData = await startRes.json();
    runId = startData.data?.id;
    if (!runId) {
      return NextResponse.json({ error: "Apify returned no run ID" }, { status: 502 });
    }
  } catch (err) {
    return NextResponse.json({ error: `Failed to start Apify run: ${err}` }, { status: 502 });
  }

  // ── Poll until SUCCEEDED or timeout ─────────────────────────────
  const deadline = Date.now() + APIFY_RUN_TIMEOUT_MS;
  let datasetId: string | null = null;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    try {
      const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, {
        headers: { Authorization: `Bearer ${apifyToken}` },
      });

      if (!statusRes.ok) continue; // transient — retry

      const statusData = await statusRes.json();
      const status = statusData.data?.status;

      if (status === "SUCCEEDED") {
        datasetId = statusData.data?.defaultDatasetId;
        break;
      }

      if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
        return NextResponse.json(
          { error: `Apify run ${status.toLowerCase()}: ${statusData.data?.statusMessage || "no details"}` },
          { status: 502 },
        );
      }
      // RUNNING / READY — keep polling
    } catch {
      // Network blip — keep polling
    }
  }

  if (!datasetId) {
    return NextResponse.json({ error: "Apify run timed out after 5 minutes" }, { status: 504 });
  }

  // ── Fetch dataset items ─────────────────────────────────────────
  let items: Record<string, unknown>[];
  try {
    const dataRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?limit=${maxResults}`, {
      headers: { Authorization: `Bearer ${apifyToken}` },
    });

    if (!dataRes.ok) {
      return NextResponse.json({ error: `Failed to fetch Apify dataset (${dataRes.status})` }, { status: 502 });
    }

    items = await dataRes.json();
    if (!Array.isArray(items)) items = [];
  } catch (err) {
    return NextResponse.json({ error: `Dataset fetch error: ${err}` }, { status: 502 });
  }

  // ── Map, score, deduplicate, and save ───────────────────────────
  let leadsSaved = 0;
  let duplicatesSkipped = 0;
  const savedLeads: Record<string, unknown>[] = [];

  for (const item of items) {
    const lead = mapToLead(platform, item, query) as Record<string, unknown>;

    // Must have a business name to be useful
    if (!lead.business_name || (lead.business_name as string).length === 0) continue;

    // Apply client-side filters
    if (filters.min_rating && lead.google_rating !== null && (lead.google_rating as number) < (filters.min_rating as number)) continue;
    if (filters.max_reviews && (lead.review_count as number) > (filters.max_reviews as number)) continue;
    if (filters.require_phone && !lead.phone) continue;
    if (filters.require_website && !lead.website) continue;

    // Deduplication: check by business_name (matching existing pattern)
    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .eq("business_name", lead.business_name as string)
      .limit(1);

    if (existing && existing.length > 0) {
      duplicatesSkipped++;
      continue;
    }

    // Score
    const leadScore = scoreLeadQuality({
      phone: (lead.phone as string) || null,
      email: (lead.email as string) || null,
      website: (lead.website as string) || null,
      google_rating: (lead.google_rating as number) ?? null,
      review_count: (lead.review_count as number) || 0,
      facebook_url: (lead.facebook_url as string) || null,
      source: platform,
    });

    // Build insert payload matching leads table schema
    const insertPayload: Record<string, unknown> = {
      business_name: lead.business_name,
      phone: lead.phone || null,
      email: lead.email || null,
      website: lead.website || null,
      address: lead.address || null,
      city: lead.city || null,
      state: lead.state || null,
      country: lead.country || null,
      google_rating: lead.google_rating ?? null,
      review_count: lead.review_count || 0,
      industry: lead.industry || query,
      category: lead.category || query,
      source: platform,
      source_url: lead.source_url || null,
      instagram_url: lead.instagram_url || null,
      facebook_url: lead.facebook_url || null,
      linkedin_url: lead.linkedin_url || null,
      tiktok_url: lead.tiktok_url || null,
      status: "new",
      ghl_sync_status: "pending",
      lead_score: leadScore,
    };

    // Attach client_id if provided (for multi-tenant setups)
    if (clientId) insertPayload.client_id = clientId;

    const { error: insertError } = await supabase.from("leads").insert(insertPayload);

    if (!insertError) {
      leadsSaved++;
      savedLeads.push({ ...insertPayload, lead_score: leadScore });
    } else {
      // Likely unique constraint violation — treat as duplicate
      duplicatesSkipped++;
    }
  }

  // ── Telegram notification (mirrors existing scraper behavior) ───
  if (leadsSaved > 0) {
    try {
      const { sendTelegramMessage } = await import("@/lib/services/trinity");
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (chatId) {
        await sendTelegramMessage(
          chatId,
          `🔍 *Apify Scraper Complete*\n\nPlatform: ${platform}\nQuery: ${query}${location ? ` in ${location}` : ""}\n${leadsSaved} new leads saved\n${duplicatesSkipped} duplicates skipped`,
        );
      }
    } catch {
      // Telegram notification is best-effort
    }
  }

  // Sort saved leads by score (highest first)
  savedLeads.sort((a, b) => ((b.lead_score as number) || 0) - ((a.lead_score as number) || 0));

  return NextResponse.json({
    success: true,
    platform,
    leads_found: items.length,
    leads_saved: leadsSaved,
    duplicates_skipped: duplicatesSkipped,
    leads: savedLeads,
    apify_run_id: runId,
    apify_dataset_id: datasetId,
  });
}
