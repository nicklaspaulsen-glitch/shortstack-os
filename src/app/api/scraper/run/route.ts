import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Lead scoring: rates 0-100 based on how likely a lead needs marketing help
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

  // Contact info availability
  if (lead.phone) score += 15;
  if (lead.email) score += 15;
  if (lead.website) score += 10;

  // Low review count = needs marketing help
  if (lead.review_count < 20) score += 15;

  // No website or placeholder website = needs web presence
  if (!lead.website || lead.website.includes("facebook.com") || lead.website.includes("yelp.com")) {
    score += 10;
  }

  // Low rating = needs reputation management
  if (lead.google_rating !== null && lead.google_rating < 4.0) score += 10;

  // Good rating but few reviews = good business needing visibility
  if (lead.google_rating !== null && lead.google_rating >= 4.0 && lead.review_count < 20) score += 10;

  // Has social media presence (shows they care about marketing)
  if (lead.facebook_url) score += 5;

  // Local business signal (sourced from local search platforms)
  if (lead.source === "google_maps" || lead.source === "facebook") score += 10;

  return Math.min(score, 100);
}

// Custom Lead Scraper — Apify-style with full platform/niche/volume control
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await request.json();
  const {
    platforms = ["google_maps"],
    niches = ["dentist"],
    locations = ["New York, NY"],
    max_results_per_search = 20,
    filters = {},
    tags = [],

  } = config;

  const results: Array<{
    business_name: string;
    phone: string | null;
    email: string | null;
    website: string | null;
    address: string | null;
    google_rating: number | null;
    review_count: number;
    industry: string;
    source: string;
    status: string;
    lead_score: number;
  }> = [];
  const errors: string[] = [];
  let totalScraped = 0;
  let totalSkipped = 0;

  for (const platform of platforms) {
    for (const niche of niches) {
      for (const location of locations) {
        try {
          if (platform === "google_maps") {
            const apiKey = process.env.GOOGLE_PLACES_API_KEY;
            if (!apiKey) { errors.push("Google Places API key not configured"); continue; }

            const query = `${niche} in ${location}`;

            // Use Places API (New) — the legacy API is deprecated
            const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": apiKey,
                "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.googleMapsUri",
              },
              body: JSON.stringify({ textQuery: query, maxResultCount: max_results_per_search }),
            });
            const searchData = await searchRes.json();

            if (!searchData.places) { errors.push(`Google: ${searchData.error?.message || "No results"}`); continue; }

            for (const place of searchData.places) {
              const d = {
                name: place.displayName?.text || "",
                formatted_phone_number: place.nationalPhoneNumber || null,
                formatted_address: place.formattedAddress || "",
                website: place.websiteUri || null,
                rating: place.rating || null,
                user_ratings_total: place.userRatingCount || 0,
                url: place.googleMapsUri || null,
              };

              // Apply filters
              if (filters.min_rating && d.rating && d.rating < filters.min_rating) continue;
              if (filters.max_reviews && d.user_ratings_total > filters.max_reviews) continue;
              if (filters.min_reviews && d.user_ratings_total < filters.min_reviews) continue;
              if (filters.require_phone && !d.formatted_phone_number) continue;
              if (filters.require_website && !d.website) continue;

              // Deduplicate
              const { data: existing } = await supabase
                .from("leads")
                .select("id")
                .eq("business_name", d.name || place.name)
                .limit(1);

              if (existing && existing.length > 0) { totalSkipped++; continue; }

              // Scrape email from website
              let email = null;
              if (d.website) {
                try {
                  const siteRes = await fetch(d.website, {
                    headers: { "User-Agent": "Mozilla/5.0" },
                    signal: AbortSignal.timeout(5000),
                  });
                  const html = await siteRes.text();
                  const emailMatch = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                  if (emailMatch) email = emailMatch[0];
                } catch {}
              }

              const addressParts = (d.formatted_address || "").split(",").map((s: string) => s.trim());

              const leadData = {
                business_name: d.name || place.name,
                phone: d.formatted_phone_number || null,
                email,
                website: d.website || null,
                address: d.formatted_address || null,
                city: addressParts[1] || null,
                state: addressParts[2]?.split(" ")[0] || null,
                country: addressParts[addressParts.length - 1] || "US",
                google_rating: d.rating || null,
                review_count: d.user_ratings_total || 0,
                industry: niche,
                category: tags.join(", ") || niche,
                source: platform,
                source_url: d.url || null,
                status: "new" as const,
                ghl_sync_status: "pending",
              };

              const lead_score = scoreLeadQuality({
                phone: leadData.phone,
                email: leadData.email,
                website: leadData.website,
                google_rating: leadData.google_rating,
                review_count: leadData.review_count,
                source: leadData.source,
              });

              const { error: insertError } = await supabase.from("leads").insert({ ...leadData, lead_score });
              if (!insertError) {
                totalScraped++;
                results.push({
                  business_name: leadData.business_name,
                  phone: leadData.phone,
                  email: leadData.email,
                  website: leadData.website,
                  address: leadData.address,
                  google_rating: leadData.google_rating,
                  review_count: leadData.review_count,
                  industry: leadData.industry,
                  source: leadData.source,
                  status: "new",
                  lead_score,
                });
              } else {
                totalSkipped++;
              }

              // Rate limit
              await new Promise(r => setTimeout(r, 200));
            }
          }

          if (platform === "facebook") {
            const token = process.env.META_ACCESS_TOKEN;
            if (!token) { errors.push("Meta access token not configured"); continue; }

            const query = `${niche} ${location}`;
            const fbUrl = `https://graph.facebook.com/v18.0/pages/search?q=${encodeURIComponent(query)}&fields=name,phone,single_line_address,website,fan_count,category,link&access_token=${token}&limit=${max_results_per_search}`;

            try {
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
                };

                const fb_lead_score = scoreLeadQuality({
                  phone: fbLeadData.phone,
                  email: null,
                  website: fbLeadData.website,
                  google_rating: null,
                  review_count: fbLeadData.review_count,
                  facebook_url: fbLeadData.facebook_url,
                  source: fbLeadData.source,
                });

                const { error: insertError } = await supabase.from("leads").insert({ ...fbLeadData, lead_score: fb_lead_score });

                if (!insertError) {
                  totalScraped++;
                  results.push({
                    business_name: page.name,
                    phone: page.phone,
                    email: null,
                    website: page.website,
                    address: page.single_line_address,
                    google_rating: null,
                    review_count: page.fan_count || 0,
                    industry: niche,
                    source: "facebook",
                    status: "new",
                    lead_score: fb_lead_score,
                  });
                }
              }
            } catch (e) { errors.push(`Facebook: ${e}`); }
          }

        } catch (err) {
          errors.push(`${platform}/${niche}/${location}: ${err}`);
        }
      }
    }
  }

  // Notify on Telegram
  if (totalScraped > 0) {
    const { sendTelegramMessage } = await import("@/lib/services/trinity");
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (chatId) {
      await sendTelegramMessage(chatId, `🔍 *Lead Scraper Complete*\n\n${totalScraped} new leads found\n${totalSkipped} duplicates skipped\nPlatforms: ${platforms.join(", ")}\nNiches: ${niches.join(", ")}\nLocations: ${locations.join(", ")}`);
    }
  }

  // Sort by lead score (highest first) and enforce max_results limit
  results.sort((a, b) => b.lead_score - a.lead_score);

  const trimmed = results.length > max_results_per_search;
  const finalResults = trimmed ? results.slice(0, max_results_per_search) : results;

  return NextResponse.json({
    success: true,
    totalScraped,
    totalSkipped,
    totalResults: results.length,
    ...(trimmed
      ? { trimmedToLimit: max_results_per_search, note: `Results trimmed from ${results.length} to ${max_results_per_search} (max_results_per_search). Top-scored leads kept.` }
      : results.length < max_results_per_search
        ? { note: `Found ${results.length} results, fewer than the requested ${max_results_per_search}.` }
        : {}),
    results: finalResults,
    errors: errors.slice(0, 5),
    config: { platforms, niches, locations, max_results_per_search, filters },
  });
}
