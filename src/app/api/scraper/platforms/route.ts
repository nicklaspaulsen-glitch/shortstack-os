import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Multi-Platform Lead Scraper — Scrapes LinkedIn, Instagram, Facebook, Google Maps, Yelp
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { platform, query, location, max_results, filters } = await request.json(); void 0;

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const results: Array<Record<string, unknown>> = [];
  const errors: string[] = [];

  try {
    switch (platform) {
      case "google_maps": {
        if (!apiKey) { errors.push("Google API key missing"); break; }
        const searchQuery = location ? `${query} in ${location}` : query;
        const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.googleMapsUri,places.businessStatus,places.types,places.primaryType",
          },
          body: JSON.stringify({ textQuery: searchQuery, maxResultCount: Math.min(max_results || 20, 20) }),
        });
        const data = await res.json();
        if (data.places) {
          for (const p of data.places) {
            // Apply filters
            if (filters?.min_rating && p.rating < filters.min_rating) continue;
            if (filters?.max_reviews && p.userRatingCount > filters.max_reviews) continue;
            if (filters?.require_phone && !p.nationalPhoneNumber) continue;
            if (filters?.require_website && !p.websiteUri) continue;
            if (p.businessStatus && p.businessStatus !== "OPERATIONAL") continue;

            // Scrape email from website
            let email = null;
            if (p.websiteUri) {
              try {
                const siteRes = await fetch(p.websiteUri, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(5000) });
                const html = await siteRes.text();
                const match = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                if (match && !match[0].includes("example") && !match[0].includes("wix") && !match[0].includes("sentry")) email = match[0];
              } catch {}
            }

            results.push({
              business_name: p.displayName?.text,
              phone: p.nationalPhoneNumber || p.internationalPhoneNumber,
              email,
              website: p.websiteUri,
              address: p.formattedAddress,
              rating: p.rating,
              review_count: p.userRatingCount || 0,
              maps_url: p.googleMapsUri,
              category: p.primaryType || (p.types || [])[0] || "",
              source: "google_maps",
              status: p.businessStatus,
            });
          }
        } else { errors.push(data.error?.message || "No results"); }
        break;
      }

      case "facebook": {
        const token = process.env.META_ACCESS_TOKEN;
        if (!token) { errors.push("Meta token missing"); break; }
        const searchQuery = location ? `${query} ${location}` : query;
        const res = await fetch(`https://graph.facebook.com/v18.0/pages/search?q=${encodeURIComponent(searchQuery)}&fields=name,phone,single_line_address,website,fan_count,category,link,emails&access_token=${token}&limit=${max_results || 20}`);
        const data = await res.json();
        for (const page of (data.data || [])) {
          if (filters?.require_phone && !page.phone) continue;
          results.push({
            business_name: page.name,
            phone: page.phone,
            email: page.emails?.[0] || null,
            website: page.website,
            address: page.single_line_address,
            rating: null,
            review_count: page.fan_count || 0,
            category: page.category,
            source: "facebook",
            facebook_url: page.link,
          });
        }
        break;
      }

      case "instagram": {
        // Search Instagram business profiles via Facebook Graph API
        const token = process.env.META_ACCESS_TOKEN;
        if (!token) { errors.push("Meta token missing — needed for Instagram"); break; }
        // Instagram business discovery requires a connected IG account
        // For now we use hashtag/location search approach
        const res = await fetch(`https://graph.facebook.com/v18.0/ig_hashtag_search?q=${encodeURIComponent(query)}&access_token=${token}`);
        const data = await res.json();
        if (data.data) {
          for (const tag of data.data.slice(0, max_results || 10)) {
            results.push({
              business_name: `#${query} businesses`,
              hashtag_id: tag.id,
              source: "instagram",
              note: "Use hashtag to find businesses manually or via IG scraping",
            });
          }
        }
        // Also search via Places on IG
        errors.push("Instagram scraping requires IG Business account connection — use Lead Finder with Google Maps for best results");
        break;
      }

      case "linkedin": {
        // LinkedIn doesn't have a public search API — we use Google to find LinkedIn profiles
        if (!apiKey) { errors.push("Google API needed for LinkedIn search"); break; }
        const searchQuery = `site:linkedin.com/company ${query} ${location || ""}`;
        const res = await fetch(`https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=SEARCH_ENGINE_ID&q=${encodeURIComponent(searchQuery)}&num=${Math.min(max_results || 10, 10)}`);
        const data = await res.json();
        if (data.items) {
          for (const item of data.items) {
            results.push({
              business_name: item.title?.replace(" | LinkedIn", "").replace(" - LinkedIn", ""),
              linkedin_url: item.link,
              description: item.snippet,
              source: "linkedin",
            });
          }
        } else {
          errors.push("LinkedIn search via Google requires Custom Search Engine setup — use direct Google Maps scraping instead");
        }
        break;
      }

      case "yelp": {
        // Yelp Fusion API (free tier: 5000 calls/day)
        const yelpKey = process.env.YELP_API_KEY;
        if (!yelpKey) { errors.push("Yelp API key not configured"); break; }
        const res = await fetch(`https://api.yelp.com/v3/businesses/search?term=${encodeURIComponent(query)}&location=${encodeURIComponent(location || "US")}&limit=${Math.min(max_results || 20, 50)}`, {
          headers: { Authorization: `Bearer ${yelpKey}` },
        });
        const data = await res.json();
        for (const biz of (data.businesses || [])) {
          if (filters?.min_rating && biz.rating < filters.min_rating) continue;
          if (filters?.require_phone && !biz.phone) continue;
          results.push({
            business_name: biz.name,
            phone: biz.phone,
            address: biz.location?.display_address?.join(", "),
            rating: biz.rating,
            review_count: biz.review_count,
            website: biz.url,
            category: biz.categories?.[0]?.title,
            source: "yelp",
            yelp_url: biz.url,
            image_url: biz.image_url,
          });
        }
        break;
      }

      default:
        errors.push(`Platform '${platform}' not supported`);
    }
  } catch (err) {
    errors.push(String(err));
  }

  return NextResponse.json({ success: true, platform, results, count: results.length, errors });
}
