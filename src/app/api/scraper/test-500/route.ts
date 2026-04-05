import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Test scraper with 500 leads: 10 niches x 5 cities x 10 results = 500 target leads
export async function POST(_request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify admin
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Google Places API key not configured" }, { status: 500 });

  const niches = [
    "plumber", "dentist", "lawyer", "gym", "electrician",
    "roofer", "accountant", "chiropractor", "real estate agent", "restaurant",
  ];

  const cities = [
    "New York, NY", "Los Angeles, CA", "Chicago, IL",
    "Houston, TX", "Miami, FL",
  ];

  const results: { niche: string; city: string; found: number; saved: number; skipped: number }[] = [];
  let totalFound = 0;
  let totalSaved = 0;
  let totalSkipped = 0;
  const errors: string[] = [];

  for (const niche of niches) {
    for (const city of cities) {
      try {
        const query = `${niche} in ${city}`;

        const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.googleMapsUri",
          },
          body: JSON.stringify({ textQuery: query, maxResultCount: 10 }),
        });

        const searchData = await searchRes.json();
        if (!searchData.places) {
          errors.push(`No results: ${niche}/${city}`);
          continue;
        }

        let found = 0;
        let saved = 0;
        let skipped = 0;

        for (const place of searchData.places) {
          found++;
          const name = place.displayName?.text || "";
          const phone = place.nationalPhoneNumber || null;
          if (!phone) continue; // Require phone

          // Deduplicate
          const { data: existing } = await supabase
            .from("leads")
            .select("id")
            .eq("business_name", name)
            .limit(1);

          if (existing && existing.length > 0) {
            skipped++;
            continue;
          }

          // Scrape email
          let email = null;
          const website = place.websiteUri || null;
          if (website) {
            try {
              const siteRes = await fetch(website, {
                headers: { "User-Agent": "Mozilla/5.0 (compatible; ShortStackBot/1.0)" },
                signal: AbortSignal.timeout(3000),
              });
              const html = await siteRes.text();
              const emailMatch = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
              if (emailMatch && !emailMatch[0].includes("example.com") && !emailMatch[0].includes("wixpress")) {
                email = emailMatch[0];
              }
            } catch {}
          }

          const addressParts = (place.formattedAddress || "").split(",").map((s: string) => s.trim());

          const { error: insertError } = await supabase.from("leads").insert({
            business_name: name,
            phone,
            email,
            website,
            address: place.formattedAddress || null,
            city: addressParts[1] || null,
            state: addressParts[2]?.split(" ")[0] || null,
            country: addressParts[addressParts.length - 1] || "US",
            google_rating: place.rating || null,
            review_count: place.userRatingCount || 0,
            industry: niche,
            category: niche,
            source: "google_maps",
            source_url: place.googleMapsUri || null,
            status: "new",
            ghl_sync_status: "pending",
          });

          if (!insertError) {
            saved++;
          } else {
            skipped++;
          }
        }

        totalFound += found;
        totalSaved += saved;
        totalSkipped += skipped;
        results.push({ niche, city, found, saved, skipped });

        // Rate limit: 200ms between batches
        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        errors.push(`${niche}/${city}: ${err}`);
      }
    }
  }

  // Log the test run
  await supabase.from("trinity_log").insert({
    action_type: "lead_gen",
    description: `500-lead test scrape: ${totalSaved} saved, ${totalSkipped} duplicates, ${errors.length} errors`,
    status: errors.length === 0 ? "completed" : "completed_with_errors",
    metadata: { totalFound, totalSaved, totalSkipped, errors: errors.slice(0, 10) },
  });

  // Telegram notification
  try {
    const { sendTelegramMessage } = await import("@/lib/services/trinity");
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (chatId) {
      await sendTelegramMessage(chatId,
        `🔍 *500-Lead Test Complete*\n\n` +
        `Found: ${totalFound}\n` +
        `Saved: ${totalSaved}\n` +
        `Duplicates: ${totalSkipped}\n` +
        `Errors: ${errors.length}\n\n` +
        `Niches: ${niches.length}\nCities: ${cities.length}`
      );
    }
  } catch {}

  return NextResponse.json({
    success: true,
    totalFound,
    totalSaved,
    totalSkipped,
    errors: errors.slice(0, 10),
    breakdown: results,
  });
}
