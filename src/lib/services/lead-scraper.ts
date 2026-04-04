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
  "New York, NY", "Los Angeles, CA", "Chicago, IL", "Houston, TX",
  "Phoenix, AZ", "Philadelphia, PA", "San Antonio, TX", "San Diego, CA",
  "Dallas, TX", "Austin, TX", "Denver, CO", "Miami, FL",
  "Atlanta, GA", "Seattle, WA", "Portland, OR", "Nashville, TN",
];

export async function scrapeGooglePlaces(
  industry: string,
  location: string,
  maxResults: number = 20
): Promise<ScrapedLead[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("Google Places API key not configured");

  const leads: ScrapedLead[] = [];
  const query = `${industry} in ${location}`;

  try {
    // Text Search API (free tier: ~$0 for first requests with free credit)
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    if (!searchData.results) return leads;

    const results = searchData.results.slice(0, maxResults);

    for (const place of results) {
      // Get detailed info for each place
      const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_phone_number,formatted_address,website,rating,user_ratings_total,url,types&key=${apiKey}`;
      const detailRes = await fetch(detailUrl);
      const detailData = await detailRes.json();
      const detail = detailData.result;

      if (!detail) continue;

      // Filter: must have phone, be local, under 500 reviews
      if (!detail.formatted_phone_number) continue;
      if (detail.user_ratings_total && detail.user_ratings_total > 500) continue;

      const addressParts = (detail.formatted_address || "").split(",").map((s: string) => s.trim());

      leads.push({
        business_name: detail.name || place.name,
        owner_name: null,
        phone: detail.formatted_phone_number || null,
        email: null, // Will be enriched by website scraping
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
  } catch (error) {
    console.error(`Error scraping Google Places for ${industry} in ${location}:`, error);
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
      // Filter out common non-business emails
      const filtered = emails.filter(
        (e) => !e.includes("example.com") && !e.includes("wixpress") && !e.includes("sentry")
      );
      return filtered[0] || null;
    }
  } catch {
    // Timeout or fetch error
  }
  return null;
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
