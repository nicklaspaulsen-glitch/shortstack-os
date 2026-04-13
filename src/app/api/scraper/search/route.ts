import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Simplified lead search for the client portal Lead Engine
// Wraps the same Google Places + Facebook logic as /api/scraper/run
// but designed for single-platform, single-niche searches with client_id association

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
  if (lead.source === "google_maps" || lead.source === "facebook") score += 10;
  return Math.min(score, 100);
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    platforms = ["google_maps"],
    niches = [],
    locations = [],
    max_results = 20,
    filters = {},
  } = body;

  const platform = platforms[0] || "google_maps";
  const niche = niches[0] || "";
  const location = locations[0] || "";

  if (!niche || !location) {
    return NextResponse.json({ error: "Niche and location are required" }, { status: 400 });
  }

  // Find the client record for this user (portal context)
  const { data: clientRecord } = await supabase
    .from("clients")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  const clientId = clientRecord?.id || null;
  const maxResults = Math.min(Math.max(1, max_results), 50);

  let totalFound = 0;
  let totalSkipped = 0;
  const errors: string[] = [];

  try {
    if (platform === "google_maps" || platform === "google") {
      const apiKey = process.env.GOOGLE_PLACES_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ error: "Google Places API not configured. Contact your admin." }, { status: 500 });
      }

      const query = `${niche} in ${location}`;
      const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.googleMapsUri",
        },
        body: JSON.stringify({ textQuery: query, maxResultCount: maxResults }),
      });
      const searchData = await searchRes.json();

      if (!searchData.places) {
        errors.push(searchData.error?.message || "No results found");
      } else {
        for (const place of searchData.places) {
          const d = {
            name: place.displayName?.text || "",
            phone: place.nationalPhoneNumber || null,
            address: place.formattedAddress || "",
            website: place.websiteUri || null,
            rating: place.rating || null,
            reviews: place.userRatingCount || 0,
            url: place.googleMapsUri || null,
          };

          // Apply filters
          if (filters.min_rating && d.rating && d.rating < filters.min_rating) continue;
          if (filters.require_phone && !d.phone) continue;
          if (filters.require_email) continue; // Can't guarantee email from Google

          // Deduplicate
          const { data: existing } = await supabase
            .from("leads")
            .select("id")
            .eq("business_name", d.name)
            .limit(1);

          if (existing && existing.length > 0) { totalSkipped++; continue; }

          // Try to scrape email from website
          let email = null;
          if (d.website) {
            try {
              const siteRes = await fetch(d.website, {
                headers: { "User-Agent": "Mozilla/5.0" },
                signal: AbortSignal.timeout(4000),
              });
              const html = await siteRes.text();
              const emailMatch = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
              if (emailMatch) email = emailMatch[0];
            } catch { /* timeout or fetch error */ }
          }

          const addressParts = d.address.split(",").map((s: string) => s.trim());

          const leadData = {
            business_name: d.name,
            phone: d.phone,
            email,
            website: d.website,
            address: d.address,
            city: addressParts[1] || null,
            state: addressParts[2]?.split(" ")[0] || null,
            country: addressParts[addressParts.length - 1] || "US",
            google_rating: d.rating,
            review_count: d.reviews,
            industry: niche,
            category: niche,
            source: "google_maps",
            source_url: d.url,
            status: "new",
            ghl_sync_status: "pending",
            ...(clientId ? { client_id: clientId } : {}),
          };

          const lead_score = scoreLeadQuality({
            phone: leadData.phone,
            email: leadData.email,
            website: leadData.website,
            google_rating: leadData.google_rating,
            review_count: leadData.review_count,
            source: "google_maps",
          });

          const { error: insertError } = await supabase.from("leads").insert({ ...leadData, lead_score });
          if (!insertError) totalFound++;
          else totalSkipped++;

          await new Promise(r => setTimeout(r, 150));
        }
      }
    }

    if (platform === "facebook" || platform === "meta") {
      const token = process.env.META_ACCESS_TOKEN;
      if (!token) {
        errors.push("Meta access token not configured");
      } else {
        const query = `${niche} ${location}`;
        const fbUrl = `https://graph.facebook.com/v18.0/pages/search?q=${encodeURIComponent(query)}&fields=name,phone,single_line_address,website,fan_count,category,link&access_token=${token}&limit=${maxResults}`;

        const fbRes = await fetch(fbUrl);
        const fbData = await fbRes.json();

        for (const page of (fbData.data || [])) {
          if (filters.require_phone && !page.phone) continue;

          const { data: existing } = await supabase
            .from("leads")
            .select("id")
            .eq("business_name", page.name)
            .limit(1);

          if (existing && existing.length > 0) { totalSkipped++; continue; }

          const fbLeadData = {
            business_name: page.name,
            phone: page.phone || null,
            address: page.single_line_address || null,
            website: page.website || null,
            review_count: page.fan_count || 0,
            industry: niche,
            category: page.category || niche,
            source: "facebook",
            source_url: page.link || null,
            facebook_url: page.link || null,
            status: "new",
            ghl_sync_status: "pending",
            ...(clientId ? { client_id: clientId } : {}),
          };

          const fb_score = scoreLeadQuality({
            phone: fbLeadData.phone,
            email: null,
            website: fbLeadData.website,
            google_rating: null,
            review_count: fbLeadData.review_count,
            facebook_url: fbLeadData.facebook_url,
            source: "facebook",
          });

          const { error: insertError } = await supabase.from("leads").insert({ ...fbLeadData, lead_score: fb_score });
          if (!insertError) totalFound++;
          else totalSkipped++;
        }
      }
    }
  } catch (err) {
    console.error("Scraper search error:", err);
    errors.push("Search failed unexpectedly");
  }

  return NextResponse.json({
    success: true,
    leads_found: totalFound,
    duplicates_skipped: totalSkipped,
    errors: errors.length > 0 ? errors : undefined,
  });
}
