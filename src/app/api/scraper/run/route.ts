import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

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
            const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
            const searchRes = await fetch(searchUrl);
            const searchData = await searchRes.json();

            if (!searchData.results) continue;

            const places = searchData.results.slice(0, max_results_per_search);

            for (const place of places) {
              // Apply filters
              if (filters.min_rating && place.rating < filters.min_rating) continue;
              if (filters.max_reviews && place.user_ratings_total > filters.max_reviews) continue;
              if (filters.min_reviews && place.user_ratings_total < filters.min_reviews) continue;

              // Get details
              const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_phone_number,formatted_address,website,rating,user_ratings_total,url&key=${apiKey}`;
              const detailRes = await fetch(detailUrl);
              const detailData = await detailRes.json();
              const d = detailData.result;
              if (!d) continue;

              // Filter: must have phone if required
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

              const lead = {
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

              const { error: insertError } = await supabase.from("leads").insert(lead);
              if (!insertError) {
                totalScraped++;
                results.push({
                  business_name: lead.business_name,
                  phone: lead.phone,
                  email: lead.email,
                  website: lead.website,
                  address: lead.address,
                  google_rating: lead.google_rating,
                  review_count: lead.review_count,
                  industry: lead.industry,
                  source: lead.source,
                  status: "new",
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

                const { error: insertError } = await supabase.from("leads").insert({
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
                });

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

  return NextResponse.json({
    success: true,
    totalScraped,
    totalSkipped,
    results: results.slice(0, 50), // Return first 50 for UI
    errors: errors.slice(0, 5),
    config: { platforms, niches, locations, max_results_per_search, filters },
  });
}
