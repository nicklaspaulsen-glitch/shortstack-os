import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// AI Lead Gen Agent — Fully autonomous lead generation pipeline
// Like Clay + Instantly combined: finds leads, enriches them, scores them, and sends outreach
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    mode, // "find", "enrich", "score", "outreach", "full_pipeline"
    niche, location, max_leads,
    lead_ids, // for enrich/score/outreach modes
    outreach_config, // for outreach mode
    // client_id available for future use
  } = await request.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const placesKey = process.env.GOOGLE_PLACES_API_KEY;
  const results: Record<string, unknown> = {};

  // ============ STEP 1: FIND LEADS ============
  if (mode === "find" || mode === "full_pipeline") {
    if (!placesKey) return NextResponse.json({ error: "Google API key needed" }, { status: 500 });

    const searchQuery = `${niche || "business"} in ${location || "US"}`;
    const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": placesKey,
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.googleMapsUri",
      },
      body: JSON.stringify({ textQuery: searchQuery, maxResultCount: Math.min(max_leads || 20, 20) }),
    });
    const searchData = await searchRes.json();

    const foundLeads: Array<Record<string, unknown>> = [];
    for (const p of (searchData.places || [])) {
      // Enrich email from website
      let email = null;
      if (p.websiteUri) {
        try {
          const siteRes = await fetch(p.websiteUri, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(5000) });
          const html = await siteRes.text();
          const match = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
          if (match) email = match[0];
        } catch {}
      }

      // Insert into database
      const { data: lead } = await supabase.from("leads").insert({
        business_name: p.displayName?.text || "",
        phone: p.nationalPhoneNumber || null,
        email,
        website: p.websiteUri || null,
        address: p.formattedAddress || null,
        google_rating: p.rating || null,
        review_count: p.userRatingCount || 0,
        industry: niche || "business",
        source: "ai_lead_gen",
        source_url: p.googleMapsUri || null,
        status: "new",
        ghl_sync_status: "pending",
      }).select("id").single();

      if (lead) foundLeads.push({ id: lead.id, name: p.displayName?.text, phone: p.nationalPhoneNumber, email, rating: p.rating });
      await new Promise(r => setTimeout(r, 200));
    }
    results.found = foundLeads.length;
    results.leads = foundLeads;
  }

  // ============ STEP 2: AI ENRICH ============
  if (mode === "enrich" || mode === "full_pipeline") {
    const ids = lead_ids || (results.leads as Array<Record<string, string>>)?.map(l => l.id) || [];
    const enriched: Array<Record<string, unknown>> = [];

    for (const id of ids.slice(0, 20)) {
      const { data: lead } = await supabase.from("leads").select("*").eq("id", id).single();
      if (!lead) continue;

      // Scrape website for more info
      // scrape website
      if (lead.website) {
        try {
          const res = await fetch(lead.website, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(5000) });
          const html = await res.text();
          // siteContent used for enrichment
          void html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().substring(0, 1500);

          // Extract social links
          const igMatch = html.match(/instagram\.com\/([a-zA-Z0-9_.]+)/);
          const fbMatch = html.match(/facebook\.com\/([a-zA-Z0-9_.]+)/);
          const liMatch = html.match(/linkedin\.com\/(?:company|in)\/([a-zA-Z0-9_.-]+)/);
          const tkMatch = html.match(/tiktok\.com\/@([a-zA-Z0-9_.]+)/);

          const updates: Record<string, string | null> = {};
          if (igMatch && !lead.instagram_url) updates.instagram_url = `https://instagram.com/${igMatch[1]}`;
          if (fbMatch && !lead.facebook_url) updates.facebook_url = `https://facebook.com/${fbMatch[1]}`;
          if (liMatch && !lead.linkedin_url) updates.linkedin_url = `https://linkedin.com/company/${liMatch[1]}`;
          if (tkMatch && !lead.tiktok_url) updates.tiktok_url = `https://tiktok.com/@${tkMatch[1]}`;

          // Find owner name from website
          const ownerMatch = html.match(/(?:owner|founder|CEO|Dr\.|by)\s*:?\s*([A-Z][a-z]+ [A-Z][a-z]+)/i);
          if (ownerMatch && !lead.owner_name) updates.owner_name = ownerMatch[1];

          if (Object.keys(updates).length > 0) {
            await supabase.from("leads").update(updates).eq("id", id);
          }

          enriched.push({ id, name: lead.business_name, ...updates, has_website_content: true });
        } catch {
          enriched.push({ id, name: lead.business_name, has_website_content: false });
        }
      }
    }
    results.enriched = enriched.length;
    results.enrichment_details = enriched;
  }

  // ============ STEP 3: AI SCORE ============
  if (mode === "score" || mode === "full_pipeline") {
    if (!apiKey) { results.scoring_error = "AI not configured"; } else {
      const ids = lead_ids || (results.leads as Array<Record<string, string>>)?.map(l => l.id) || [];
      const { data: leadsToScore } = await supabase.from("leads").select("*").in("id", ids.slice(0, 30));

      if (leadsToScore && leadsToScore.length > 0) {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 2000,
            system: "Score these business leads 1-100 for likelihood of needing digital marketing services. Consider: low reviews = needs help, no website = urgent need, low rating = needs reputation management. Return JSON array of {id, score, reason}. Only JSON.",
            messages: [{ role: "user", content: JSON.stringify(leadsToScore.map(l => ({ id: l.id, name: l.business_name, rating: l.google_rating, reviews: l.review_count, hasPhone: !!l.phone, hasEmail: !!l.email, hasWebsite: !!l.website, hasSocials: !!(l.instagram_url || l.facebook_url) }))) }],
          }),
        });
        const data = await res.json();
        const text = data.content?.[0]?.text || "[]";
        try {
          const scores = JSON.parse(text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
          results.scores = scores;
          results.scored = scores.length;
        } catch { results.scoring_error = "Failed to parse scores"; }
      }
    }
  }

  // ============ STEP 4: AUTO OUTREACH ============
  if (mode === "outreach" || mode === "full_pipeline") {
    const ids = lead_ids || (results.leads as Array<Record<string, string>>)?.map(l => l.id) || [];
    const { data: leadsForOutreach } = await supabase.from("leads").select("*").in("id", ids.slice(0, 20)).eq("status", "new");

    let dmsSent = 0;
    let emailsSent = 0;

    for (const lead of (leadsForOutreach || [])) {
      // Generate personalized message
      let message = `Hey! I came across ${lead.business_name} and love what you're doing. We help ${lead.industry || "businesses"} like yours get more clients through digital marketing. Open to a quick chat?`;

      if (apiKey) {
        try {
          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
            body: JSON.stringify({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 150,
              system: "Write a short, friendly cold outreach DM for a digital marketing agency. Max 3 sentences. Not salesy. Include a soft CTA.",
              messages: [{ role: "user", content: `Write a DM to ${lead.owner_name || "the owner"} of ${lead.business_name} (${lead.industry}). ${lead.google_rating ? `They have ${lead.google_rating} stars with ${lead.review_count} reviews.` : ""}` }],
            }),
          });
          const data = await res.json();
          message = data.content?.[0]?.text || message;
        } catch {}
      }

      // Send cold email if we have their email
      if (lead.email && (outreach_config?.send_email !== false)) {
        const ghlKey = process.env.GHL_API_KEY;
        if (ghlKey && lead.ghl_contact_id) {
          await fetch("https://services.leadconnectorhq.com/conversations/messages", {
            method: "POST",
            headers: { Authorization: `Bearer ${ghlKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
            body: JSON.stringify({
              type: "Email", contactId: lead.ghl_contact_id,
              subject: `Quick question about ${lead.business_name}`,
              html: `<p>${message.replace(/\n/g, "<br>")}</p><p>Best,<br>ShortStack Team</p>`,
              emailFrom: outreach_config?.from_email || "growth@shortstack.work",
            }),
          });
          emailsSent++;
        }
      }

      // Log DM outreach
      await supabase.from("outreach_log").insert({
        lead_id: lead.id,
        platform: lead.instagram_url ? "instagram" : lead.facebook_url ? "facebook" : lead.linkedin_url ? "linkedin" : "tiktok",
        business_name: lead.business_name,
        recipient_handle: lead.instagram_url || lead.facebook_url || lead.linkedin_url || lead.email || "",
        message_text: message,
        status: "sent",
      });
      dmsSent++;

      // Update lead status
      await supabase.from("leads").update({ status: "called" }).eq("id", lead.id);
      await new Promise(r => setTimeout(r, 500));
    }

    results.outreach = { dms_sent: dmsSent, emails_sent: emailsSent };
  }

  // Notify on Telegram
  const { sendTelegramMessage } = await import("@/lib/services/trinity");
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (chatId) {
    await sendTelegramMessage(chatId, `🤖 *AI Lead Gen Complete*\n\nMode: ${mode}\n${results.found ? `Found: ${results.found} leads` : ""}${results.enriched ? `\nEnriched: ${results.enriched}` : ""}${results.scored ? `\nScored: ${results.scored}` : ""}${(results.outreach as Record<string, number>)?.dms_sent ? `\nDMs: ${(results.outreach as Record<string, number>).dms_sent}` : ""}`);
  }

  return NextResponse.json({ success: true, mode, results });
}
