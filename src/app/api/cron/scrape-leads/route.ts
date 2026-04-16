import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { scrapeGooglePlaces, scrapeFacebookBusinessPages, scrapeWebsiteForEmail, scrapeWebsiteForSocials, TARGET_INDUSTRIES, TARGET_CITIES } from "@/lib/services/lead-scraper";
import { importLeadToGHL } from "@/lib/services/ghl";

export const maxDuration = 300; // 5 minutes

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  let totalImported = 0;
  let totalSkipped = 0;
  let totalEnriched = 0;
  const errors: string[] = [];

  // ── Check auto-run config (user-configured daily schedule) ──
  let autoRunConfig: { enabled?: boolean; days?: string[]; platforms?: string[]; niches?: string[]; locations?: string[]; max_results?: number; filters?: Record<string, unknown> } | null = null;
  try {
    // Check system_config first
    const { data: configRow } = await supabase
      .from("system_config")
      .select("value")
      .eq("key", "scraper_auto_run")
      .single();
    if (configRow?.value?.enabled) {
      autoRunConfig = configRow.value;
    }
  } catch {
    // Fallback: check system_health
    try {
      const { data: shRow } = await supabase
        .from("system_health")
        .select("metadata, status")
        .eq("service_name", "scraper_auto_run")
        .single();
      if (shRow?.status === "healthy" && shRow?.metadata?.enabled) {
        autoRunConfig = shRow.metadata;
      }
    } catch {}
  }

  // Check if today is a scheduled day
  if (autoRunConfig?.days && Array.isArray(autoRunConfig.days)) {
    const dayMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const today = dayMap[new Date().getDay()];
    if (!autoRunConfig.days.includes(today)) {
      return NextResponse.json({
        success: true,
        message: `Skipped — ${today} is not a scheduled day`,
        scheduled_days: autoRunConfig.days,
      });
    }
  }

  // Load agent settings from DB
  let targetLeads = 50;
  let customIndustries: string[] | null = null;
  let customLocations: string[] | null = null;
  try {
    const { data: settingsRow } = await supabase
      .from("system_health")
      .select("metadata")
      .eq("integration_name", "agent_settings")
      .single();
    if (settingsRow?.metadata) {
      const settings = settingsRow.metadata as Record<string, Record<string, unknown>>;
      targetLeads = (settings.lead_engine?.leads_per_run as number) || 50;
      const industries = settings.lead_engine?.target_industries as string[];
      if (industries && industries.length > 0) customIndustries = industries;
      const locations = settings.lead_engine?.target_locations as string[];
      if (locations && locations.length > 0) customLocations = locations;
    }
  } catch {}

  // Auto-run config overrides defaults if present
  if (autoRunConfig) {
    if (autoRunConfig.niches && autoRunConfig.niches.length > 0) {
      customIndustries = autoRunConfig.niches;
    }
    if (autoRunConfig.locations && autoRunConfig.locations.length > 0) {
      customLocations = autoRunConfig.locations;
    }
    if (autoRunConfig.max_results) {
      targetLeads = autoRunConfig.max_results * (autoRunConfig.niches?.length || 1) * (autoRunConfig.locations?.length || 1);
    }
  }

  try {
    const industries = customIndustries || TARGET_INDUSTRIES;
    const allCities = customLocations || TARGET_CITIES;

    // Spread cities across the week instead of binary flip
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const citiesPerDay = Math.max(3, Math.min(allCities.length, 8));
    const cityOffset = (dayOfYear * citiesPerDay) % Math.max(allCities.length, 1);
    const todayCities: string[] = [];
    for (let i = 0; i < citiesPerDay; i++) {
      todayCities.push(allCities[(cityOffset + i) % allCities.length]);
    }

    // Calculate how many leads per query to hit target
    const totalCombinations = industries.length * todayCities.length;
    const leadsPerQuery = Math.max(2, Math.min(20, Math.ceil(targetLeads / Math.max(totalCombinations, 1))));

    // Track progress toward target
    let scraped = 0;

    for (const industry of industries) {
      if (scraped >= targetLeads) break;

      for (const city of todayCities) {
        if (scraped >= targetLeads) break;

        const remaining = targetLeads - scraped;
        const batchSize = Math.min(leadsPerQuery, remaining);

        try {
          // Scrape Google Places
          const googleLeads = await scrapeGooglePlaces(industry, city, batchSize);

          // Scrape Facebook (only if Google didn't return enough)
          let fbLeads: typeof googleLeads = [];
          if (googleLeads.length < batchSize) {
            fbLeads = await scrapeFacebookBusinessPages(industry, city);
          }

          const allLeads = [...googleLeads, ...fbLeads.slice(0, Math.max(0, batchSize - googleLeads.length))];

          for (const lead of allLeads) {
            if (scraped >= targetLeads) break;

            // Deduplicate: check if phone+name combo exists
            const { data: existing } = await supabase
              .from("leads")
              .select("id")
              .eq("business_name", lead.business_name)
              .eq("phone", lead.phone || "")
              .limit(1);

            if (existing && existing.length > 0) {
              totalSkipped++;
              continue;
            }

            // Insert lead
            const { data: newLead, error: insertError } = await supabase
              .from("leads")
              .insert({
                ...lead,
                status: "new",
                ghl_sync_status: "pending",
              })
              .select("id")
              .single();

            if (insertError) {
              totalSkipped++;
              continue;
            }

            // Import to GHL
            const { contactId, success } = await importLeadToGHL(lead);
            if (success && newLead) {
              await supabase
                .from("leads")
                .update({
                  ghl_contact_id: contactId,
                  ghl_sync_status: "synced",
                  ghl_synced_at: new Date().toISOString(),
                })
                .eq("id", newLead.id);
            }

            totalImported++;
            scraped++;
          }

          // Rate limit
          await new Promise((r) => setTimeout(r, 200));
        } catch (err) {
          errors.push(`${industry}/${city}: ${err}`);
        }
      }
    }

    // Batch enrich emails + social profiles for leads missing them (parallel, capped)
    const { data: unenrichedLeads } = await supabase
      .from("leads")
      .select("id, website, email, instagram_url, facebook_url, linkedin_url")
      .not("website", "is", null)
      .or("email.is.null,instagram_url.is.null")
      .eq("status", "new")
      .limit(20);

    if (unenrichedLeads && unenrichedLeads.length > 0) {
      await Promise.all(unenrichedLeads.map(async (lead) => {
        if (!lead.website) return;
        try {
          const updates: Record<string, string | null> = {};

          if (!lead.email) {
            const email = await scrapeWebsiteForEmail(lead.website);
            if (email) updates.email = email;
          }

          if (!lead.instagram_url || !lead.facebook_url) {
            const socials = await scrapeWebsiteForSocials(lead.website);
            if (!lead.instagram_url && socials.instagram_url) updates.instagram_url = socials.instagram_url;
            if (!lead.facebook_url && socials.facebook_url) updates.facebook_url = socials.facebook_url;
            if (!lead.linkedin_url && socials.linkedin_url) updates.linkedin_url = socials.linkedin_url;
          }

          if (Object.keys(updates).length > 0) {
            await supabase.from("leads").update(updates).eq("id", lead.id);
            totalEnriched++;
          }
        } catch {}
      }));
    }

    return NextResponse.json({
      success: true,
      targetLeads,
      totalImported,
      totalSkipped,
      totalEnriched,
      errors: errors.slice(0, 10),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
