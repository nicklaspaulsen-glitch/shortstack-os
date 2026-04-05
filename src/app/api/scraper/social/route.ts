import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Social Media Lead Scraper — Finds business leads from Instagram, Facebook, TikTok, LinkedIn
// Scrapes by hashtag, keyword, location, niche — then AI scores each lead
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    platform, // "instagram" | "facebook" | "tiktok" | "linkedin" | "all"
    search_type, // "hashtag" | "keyword" | "location" | "niche" | "competitor_followers"
    query, // the search term, hashtag, or niche
    location,
    max_leads,
    hashtags, // array of hashtags to search
    niche,
    filters,
    auto_score, // AI score leads after finding
  } = await request.json();

  const metaToken = process.env.META_ACCESS_TOKEN;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const results: Array<Record<string, unknown>> = [];
  const errors: string[] = [];
  const platforms = platform === "all" ? ["instagram", "facebook", "tiktok", "linkedin"] : [platform];

  for (const plat of platforms) {
    try {
      // ============ INSTAGRAM ============
      if (plat === "instagram") {
        if (!metaToken) { errors.push("Meta token needed for Instagram"); continue; }

        // Search by hashtag
        if (search_type === "hashtag" || hashtags) {
          const tags = hashtags || [query];
          for (const tag of tags) {
            const cleanTag = tag.replace("#", "").toLowerCase();
            try {
              // Get hashtag ID
              const tagRes = await fetch(`https://graph.facebook.com/v18.0/ig_hashtag_search?q=${cleanTag}&access_token=${metaToken}`);
              const tagData = await tagRes.json();
              if (!tagData.data?.[0]?.id) continue;

              // Get recent media for this hashtag — extract business accounts
              const mediaRes = await fetch(`https://graph.facebook.com/v18.0/${tagData.data[0].id}/recent_media?fields=caption,permalink,username,timestamp&access_token=${metaToken}&limit=${max_leads || 20}`);
              const mediaData = await mediaRes.json();

              for (const post of (mediaData.data || [])) {
                if (!post.username) continue;
                // Check if this username is already in results
                if (results.find(r => r.instagram_handle === `@${post.username}`)) continue;

                results.push({
                  business_name: post.username,
                  instagram_handle: `@${post.username}`,
                  instagram_url: `https://instagram.com/${post.username}`,
                  source: "instagram",
                  source_type: "hashtag",
                  source_query: `#${cleanTag}`,
                  post_caption: post.caption?.substring(0, 200),
                  post_url: post.permalink,
                  found_at: post.timestamp,
                  industry: niche || query,
                });
              }
            } catch (e) { errors.push(`IG hashtag #${cleanTag}: ${e}`); }
          }
        }

        // Search by location/keyword via Facebook Pages (which have IG links)
        if (search_type === "keyword" || search_type === "niche" || search_type === "location") {
          const searchQ = `${niche || query} ${location || ""}`.trim();
          try {
            const res = await fetch(`https://graph.facebook.com/v18.0/pages/search?q=${encodeURIComponent(searchQ)}&fields=name,phone,single_line_address,website,instagram_business_account,category,link&access_token=${metaToken}&limit=${max_leads || 20}`);
            const data = await res.json();
            for (const page of (data.data || [])) {
              results.push({
                business_name: page.name,
                phone: page.phone || null,
                website: page.website || null,
                address: page.single_line_address || null,
                facebook_url: page.link || null,
                instagram_url: page.instagram_business_account ? `https://instagram.com/${page.instagram_business_account.username || ""}` : null,
                instagram_handle: page.instagram_business_account?.username ? `@${page.instagram_business_account.username}` : null,
                category: page.category,
                source: "instagram",
                source_type: search_type,
                source_query: searchQ,
                industry: niche || query,
              });
            }
          } catch (e) { errors.push(`IG keyword search: ${e}`); }
        }
      }

      // ============ FACEBOOK ============
      if (plat === "facebook") {
        if (!metaToken) { errors.push("Meta token needed for Facebook"); continue; }
        const searchQ = `${niche || query} ${location || ""}`.trim();
        try {
          const res = await fetch(`https://graph.facebook.com/v18.0/pages/search?q=${encodeURIComponent(searchQ)}&fields=name,phone,single_line_address,website,fan_count,category,link,emails&access_token=${metaToken}&limit=${max_leads || 20}`);
          const data = await res.json();
          for (const page of (data.data || [])) {
            if (filters?.min_followers && (page.fan_count || 0) < filters.min_followers) continue;
            if (filters?.require_phone && !page.phone) continue;
            results.push({
              business_name: page.name,
              phone: page.phone || null,
              email: page.emails?.[0] || null,
              website: page.website || null,
              address: page.single_line_address || null,
              facebook_url: page.link || null,
              followers: page.fan_count || 0,
              category: page.category,
              source: "facebook",
              source_type: search_type || "keyword",
              source_query: searchQ,
              industry: niche || query,
            });
          }
        } catch (e) { errors.push(`FB search: ${e}`); }
      }

      // ============ TIKTOK ============
      if (plat === "tiktok") {
        // TikTok doesn't have a business search API
        // We use Google to find TikTok business profiles
        const placesKey = process.env.GOOGLE_PLACES_API_KEY;
        if (!placesKey) { errors.push("Google API needed for TikTok search"); continue; }

        const searchQ = `${niche || query} ${location || ""}`.trim();
        // Search Google Maps and then enrich with TikTok handles from their websites
        const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": placesKey,
            "X-Goog-FieldMask": "places.displayName,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount",
          },
          body: JSON.stringify({ textQuery: searchQ, maxResultCount: Math.min(max_leads || 10, 20) }),
        });
        const data = await res.json();

        for (const place of (data.places || [])) {
          let tiktokUrl = null;
          // Try to find TikTok handle from website
          if (place.websiteUri) {
            try {
              const siteRes = await fetch(place.websiteUri, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(4000) });
              const html = await siteRes.text();
              const tkMatch = html.match(/tiktok\.com\/@([a-zA-Z0-9_.]+)/);
              if (tkMatch) tiktokUrl = `https://tiktok.com/@${tkMatch[1]}`;
            } catch {}
          }

          if (tiktokUrl || !filters?.require_tiktok) {
            results.push({
              business_name: place.displayName?.text,
              phone: place.nationalPhoneNumber || null,
              website: place.websiteUri || null,
              tiktok_url: tiktokUrl,
              rating: place.rating,
              review_count: place.userRatingCount || 0,
              source: "tiktok",
              source_type: "google_enriched",
              source_query: searchQ,
              industry: niche || query,
            });
          }
        }
      }

      // ============ LINKEDIN ============
      if (plat === "linkedin") {
        // Search for companies via Google
        const placesKey = process.env.GOOGLE_PLACES_API_KEY;
        const searchQ = `${niche || query} ${location || ""}`.trim();

        // Use Google Maps to find businesses, then enrich with LinkedIn from website
        if (placesKey) {
          const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": placesKey,
              "X-Goog-FieldMask": "places.displayName,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.formattedAddress",
            },
            body: JSON.stringify({ textQuery: searchQ, maxResultCount: Math.min(max_leads || 10, 20) }),
          });
          const data = await res.json();

          for (const place of (data.places || [])) {
            let linkedinUrl = null;
            let email = null;
            if (place.websiteUri) {
              try {
                const siteRes = await fetch(place.websiteUri, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(4000) });
                const html = await siteRes.text();
                const liMatch = html.match(/linkedin\.com\/(?:company|in)\/([a-zA-Z0-9_.-]+)/);
                if (liMatch) linkedinUrl = `https://linkedin.com/company/${liMatch[1]}`;
                const emailMatch = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                if (emailMatch) email = emailMatch[0];
              } catch {}
            }

            results.push({
              business_name: place.displayName?.text,
              phone: place.nationalPhoneNumber || null,
              email,
              website: place.websiteUri || null,
              address: place.formattedAddress || null,
              linkedin_url: linkedinUrl,
              rating: place.rating,
              review_count: place.userRatingCount || 0,
              source: "linkedin",
              source_type: "google_enriched",
              source_query: searchQ,
              industry: niche || query,
            });
          }
        } else {
          errors.push("Google API needed for LinkedIn search");
        }
      }

    } catch (err) {
      errors.push(`${plat}: ${err}`);
    }
  }

  // ============ AI SCORING ============
  let scores: Array<Record<string, unknown>> = [];
  if (auto_score && apiKey && results.length > 0) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 3000,
          system: `You are a lead qualification expert. Score these social media leads 1-100 on how likely they are to be a qualified prospect for a digital marketing agency. Consider: business type, online presence gaps (no website = high need), low followers = needs growth, local business = good prospect, has email/phone = higher score. Return JSON array of {index, score, qualification ("hot"|"warm"|"cold"), reason}. Only valid JSON, no other text.`,
          messages: [{ role: "user", content: JSON.stringify(results.map((r, i) => ({
            index: i,
            name: r.business_name,
            platform: r.source,
            hasPhone: !!r.phone,
            hasEmail: !!r.email,
            hasWebsite: !!r.website,
            hasSocials: !!(r.instagram_url || r.facebook_url || r.tiktok_url || r.linkedin_url),
            followers: r.followers || r.review_count || 0,
            industry: r.industry,
          }))) }],
        }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "[]";
      scores = JSON.parse(text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());

      // Merge scores into results
      for (const s of scores) {
        const idx = s.index as number;
        if (results[idx]) {
          results[idx].lead_score = s.score;
          results[idx].qualification = s.qualification;
          results[idx].score_reason = s.reason;
        }
      }

      // Sort by score descending
      results.sort((a, b) => ((b.lead_score as number) || 0) - ((a.lead_score as number) || 0));
    } catch (e) { errors.push(`Scoring: ${e}`); }
  }

  // Save leads to database
  let saved = 0;
  for (const lead of results) {
    const { error: insertError } = await supabase.from("leads").insert({
      business_name: (lead.business_name as string) || "Unknown",
      phone: (lead.phone as string) || null,
      email: (lead.email as string) || null,
      website: (lead.website as string) || null,
      address: (lead.address as string) || null,
      instagram_url: (lead.instagram_url as string) || null,
      facebook_url: (lead.facebook_url as string) || null,
      linkedin_url: (lead.linkedin_url as string) || null,
      tiktok_url: (lead.tiktok_url as string) || null,
      google_rating: (lead.rating as number) || null,
      review_count: (lead.review_count as number) || 0,
      industry: (lead.industry as string) || niche || query || "business",
      category: (lead.category as string) || niche || "",
      source: (lead.source as string) || platform,
      source_url: (lead.post_url as string) || (lead.instagram_url as string) || (lead.facebook_url as string) || null,
      status: "new",
      ghl_sync_status: "pending",
    });
    if (!insertError) saved++;
  }

  // Telegram notification
  const { sendTelegramMessage } = await import("@/lib/services/trinity");
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (chatId && saved > 0) {
    const topLeads = results.filter(r => r.qualification === "hot").slice(0, 3);
    await sendTelegramMessage(chatId, `🔍 *Social Lead Scrape Done*\n\nPlatform: ${platforms.join(", ")}\nQuery: ${query || niche}\n${location ? `Location: ${location}\n` : ""}Found: ${results.length} leads\nSaved: ${saved} new\n${topLeads.length > 0 ? `\n🔥 *Hot Leads:*\n${topLeads.map(l => `• ${l.business_name} (score: ${l.lead_score})`).join("\n")}` : ""}`);
  }

  return NextResponse.json({
    success: true,
    total_found: results.length,
    saved_to_db: saved,
    leads: results,
    scores: scores.length,
    errors,
    config: { platform, search_type, query, location, niche, hashtags, max_leads },
  });
}
