// Lead Scraper Service — Uses Google Places API (free tier) + web scraping
// Targets: plumbers, dentists, lawyers, gyms, electricians, roofers, accountants,
// chiropractors, real estate agents, restaurants

interface ScrapedLead {
  business_name: string;
  owner_name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  google_rating: number | null;
  review_count: number;
  industry: string;
  category: string;
  source: string;
  source_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  linkedin_url: string | null;
}

const TARGET_INDUSTRIES = [
  "plumber", "dentist", "lawyer", "gym", "electrician",
  "roofer", "accountant", "chiropractor", "real estate agent", "restaurant",
];

const TARGET_CITIES = [
  // US — Top 50 metro areas
  "New York, NY", "Los Angeles, CA", "Chicago, IL", "Houston, TX",
  "Phoenix, AZ", "Philadelphia, PA", "San Antonio, TX", "San Diego, CA",
  "Dallas, TX", "Austin, TX", "Denver, CO", "Miami, FL",
  "Atlanta, GA", "Seattle, WA", "Portland, OR", "Nashville, TN",
  "San Francisco, CA", "Boston, MA", "Washington, DC", "Las Vegas, NV",
  "Detroit, MI", "Minneapolis, MN", "Tampa, FL", "Charlotte, NC",
  "Orlando, FL", "St. Louis, MO", "Pittsburgh, PA", "Sacramento, CA",
  "Kansas City, MO", "Columbus, OH", "Indianapolis, IN", "Cleveland, OH",
  "San Jose, CA", "Jacksonville, FL", "Fort Worth, TX", "Raleigh, NC",
  "Milwaukee, WI", "Oklahoma City, OK", "Memphis, TN", "Louisville, KY",
  "Baltimore, MD", "Richmond, VA", "Salt Lake City, UT", "Tucson, AZ",
  "Honolulu, HI", "Omaha, NE", "Albuquerque, NM", "New Orleans, LA",
  "Boise, ID", "Charleston, SC",
  // UK — Major cities
  "London, UK", "Manchester, UK", "Birmingham, UK", "Leeds, UK",
  "Glasgow, UK", "Liverpool, UK", "Bristol, UK", "Edinburgh, UK",
  "Sheffield, UK", "Newcastle, UK", "Nottingham, UK", "Cardiff, UK",
  "Leicester, UK", "Brighton, UK", "Southampton, UK", "Oxford, UK",
  "Cambridge, UK", "Reading, UK", "Aberdeen, UK", "Belfast, UK",
];

/**
 * Google Places API (New) caps each response at 20 results. To actually hit
 * a user's `maxResults` target, we paginate using `pageToken` until we hit
 * the target OR Google runs out of results OR we hit the page cap.
 *
 * Filters (no phone / >500 reviews) run BEFORE the count so the user gets
 * exactly as many qualified leads as they asked for (not "20 raw, 12 left
 * after filtering"). Filter drops are logged so you can see why a query
 * that "should" return 50 only produced 30.
 */
export async function scrapeGooglePlaces(
  industry: string,
  location: string,
  maxResults: number = 20,
  opts: { requirePhone?: boolean; maxReviewCount?: number; maxPages?: number } = {}
): Promise<ScrapedLead[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("Google Places API key not configured");

  const requirePhone = opts.requirePhone !== false; // default true
  const maxReviewCount = opts.maxReviewCount ?? 500;
  const maxPages = opts.maxPages ?? 10; // 10 pages × 20 = 200 leads ceiling per query

  const leads: ScrapedLead[] = [];
  const seen = new Set<string>(); // dedupe within this run by place name+phone
  const query = `${industry} in ${location}`;
  let pageToken: string | undefined;
  let pagesFetched = 0;
  let rawFetched = 0;
  let droppedNoPhone = 0;
  let droppedTooPopular = 0;

  try {
    // Paginate until target met or API exhausted
    while (leads.length < maxResults && pagesFetched < maxPages) {
      const body: Record<string, unknown> = {
        textQuery: query,
        // Places API (New) max per page is 20 — pageToken pulls next page.
        maxResultCount: Math.min(maxResults - leads.length + 5, 20),
      };
      if (pageToken) body.pageToken = pageToken;

      const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.googleMapsUri,places.types,nextPageToken",
        },
        body: JSON.stringify(body),
      });
      if (!searchRes.ok) {
        const errText = await searchRes.text().catch(() => "");
        console.error(`[scrapeGooglePlaces] ${query} HTTP ${searchRes.status}: ${errText.slice(0, 200)}`);
        break;
      }
      const searchData = await searchRes.json();
      pagesFetched++;
      if (!searchData.places || !Array.isArray(searchData.places) || searchData.places.length === 0) break;
      rawFetched += searchData.places.length;

      for (const place of searchData.places) {
        if (leads.length >= maxResults) break;
        const detail = {
          name: place.displayName?.text || "",
          formatted_phone_number: place.nationalPhoneNumber || null,
          formatted_address: place.formattedAddress || "",
          website: place.websiteUri || null,
          rating: place.rating || null,
          user_ratings_total: place.userRatingCount || 0,
          url: place.googleMapsUri || null,
          types: place.types || [],
        };

        // Dedupe within this run — Google sometimes returns same place across pages
        const key = `${detail.name}::${detail.formatted_phone_number || ""}`;
        if (seen.has(key)) continue;
        seen.add(key);

        // Filters — tracked so we can report what was dropped
        if (requirePhone && !detail.formatted_phone_number) { droppedNoPhone++; continue; }
        if (detail.user_ratings_total && detail.user_ratings_total > maxReviewCount) { droppedTooPopular++; continue; }

        const addressParts = (detail.formatted_address || "").split(",").map((s: string) => s.trim());

        leads.push({
          business_name: detail.name || place.name,
          owner_name: null,
          phone: detail.formatted_phone_number || null,
          email: null,
          website: detail.website || null,
          address: detail.formatted_address || null,
          city: addressParts[1] || null,
          state: addressParts[2]?.split(" ")[0] || null,
          country: addressParts[addressParts.length - 1] || "US",
          google_rating: detail.rating || null,
          review_count: detail.user_ratings_total || 0,
          industry: industry,
          category: (detail.types || []).join(", "),
          source: "google_maps",
          source_url: detail.url || null,
          instagram_url: null,
          facebook_url: null,
          linkedin_url: null,
        });
      }

      pageToken = searchData.nextPageToken;
      if (!pageToken) break; // no more pages
      // Google recommends a 2s delay between paginated calls
      await new Promise(r => setTimeout(r, 2000));
    }

    // Log the breakdown so the user can see WHY a query returned fewer than requested
    if (leads.length < maxResults) {
      console.warn(
        `[scrapeGooglePlaces] ${query}: requested=${maxResults} got=${leads.length} ` +
        `raw=${rawFetched} pages=${pagesFetched} droppedNoPhone=${droppedNoPhone} droppedTooPopular=${droppedTooPopular}`,
      );
    }
  } catch (error) {
    console.error(`[scrapeGooglePlaces] ${query} error:`, error);
  }

  return leads;
}

export async function scrapeWebsiteForEmail(websiteUrl: string): Promise<string | null> {
  try {
    const res = await fetch(websiteUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ShortStackBot/1.0)" },
      signal: AbortSignal.timeout(5000),
    });
    const html = await res.text();

    // Extract emails from HTML
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = html.match(emailRegex);

    if (emails && emails.length > 0) {
      // Filter out non-email matches (image filenames, tracking pixels, etc.)
      const imageExts = /\.(png|jpg|jpeg|gif|svg|webp|ico|bmp|css|js)$/i;
      const filtered = emails.filter(
        (e) =>
          !e.includes("example.com") &&
          !e.includes("wixpress") &&
          !e.includes("sentry") &&
          !e.includes("cloudflare") &&
          !e.includes("googleapis") &&
          !imageExts.test(e) &&
          !e.match(/@\d/) && // e.g. sprite@2x.png
          e.includes(".") &&
          e.split("@")[1]?.includes(".")
      );
      return filtered[0] || null;
    }
  } catch {
    // Timeout or fetch error
  }
  return null;
}

export async function scrapeWebsiteForSocials(websiteUrl: string): Promise<{ instagram_url: string | null; facebook_url: string | null; linkedin_url: string | null }> {
  const result = { instagram_url: null as string | null, facebook_url: null as string | null, linkedin_url: null as string | null };
  try {
    const res = await fetch(websiteUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ShortStackBot/1.0)" },
      signal: AbortSignal.timeout(5000),
    });
    const html = await res.text();

    // Extract Instagram URL
    const igMatch = html.match(/https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.]+\/?/);
    if (igMatch) result.instagram_url = igMatch[0].replace(/\/$/, "");

    // Extract Facebook URL
    const fbMatch = html.match(/https?:\/\/(www\.)?facebook\.com\/[a-zA-Z0-9.]+\/?/);
    if (fbMatch && !fbMatch[0].includes("facebook.com/sharer")) result.facebook_url = fbMatch[0].replace(/\/$/, "");

    // Extract LinkedIn URL
    const liMatch = html.match(/https?:\/\/(www\.)?linkedin\.com\/(company|in)\/[a-zA-Z0-9_-]+\/?/);
    if (liMatch) result.linkedin_url = liMatch[0].replace(/\/$/, "");
  } catch {}
  return result;
}

export async function scrapeFacebookBusinessPages(
  industry: string,
  location: string
): Promise<ScrapedLead[]> {
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!accessToken) return [];

  const leads: ScrapedLead[] = [];

  try {
    const query = `${industry} ${location}`;
    const url = `https://graph.facebook.com/v18.0/pages/search?q=${encodeURIComponent(query)}&fields=name,phone,single_line_address,website,fan_count,category,link&access_token=${accessToken}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.data) return leads;

    for (const page of data.data) {
      if (!page.phone) continue;

      leads.push({
        business_name: page.name,
        owner_name: null,
        phone: page.phone,
        email: null,
        website: page.website || null,
        address: page.single_line_address || null,
        city: null,
        state: null,
        country: "US",
        google_rating: null,
        review_count: page.fan_count || 0,
        industry,
        category: page.category || "",
        source: "facebook",
        source_url: page.link || null,
        instagram_url: null,
        facebook_url: page.link || null,
        linkedin_url: null,
      });
    }
  } catch (error) {
    console.error(`Error scraping Facebook for ${industry}:`, error);
  }

  return leads;
}

export async function runDailyLeadScrape(): Promise<{
  totalScraped: number;
  bySource: Record<string, number>;
  errors: string[];
}> {
  const allLeads: ScrapedLead[] = [];
  const errors: string[] = [];
  const leadsPerIndustryPerCity = 5; // ~480 leads: 10 industries × 16 cities × 3 sources

  for (const industry of TARGET_INDUSTRIES) {
    for (const city of TARGET_CITIES.slice(0, 8)) { // 8 cities per run to stay within free tier
      try {
        // Google Maps
        const googleLeads = await scrapeGooglePlaces(industry, city, leadsPerIndustryPerCity);
        allLeads.push(...googleLeads);

        // Facebook
        const fbLeads = await scrapeFacebookBusinessPages(industry, city);
        allLeads.push(...fbLeads.slice(0, leadsPerIndustryPerCity));

        // Small delay to respect rate limits
        await new Promise((r) => setTimeout(r, 200));
      } catch (err) {
        errors.push(`${industry}/${city}: ${err}`);
      }
    }
  }

  // Enrich emails from websites
  for (const lead of allLeads) {
    if (lead.website && !lead.email) {
      lead.email = await scrapeWebsiteForEmail(lead.website);
    }
  }

  const bySource: Record<string, number> = {};
  allLeads.forEach((l) => {
    bySource[l.source] = (bySource[l.source] || 0) + 1;
  });

  return { totalScraped: allLeads.length, bySource, errors };
}

export { TARGET_INDUSTRIES, TARGET_CITIES };
export type { ScrapedLead };
