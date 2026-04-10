import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { scrapeGooglePlaces, scrapeFacebookBusinessPages, scrapeWebsiteForEmail, TARGET_INDUSTRIES, TARGET_CITIES } from "@/lib/services/lead-scraper";
import { importLeadToGHL } from "@/lib/services/ghl";

export const maxDuration = 300; // 5 minutes

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  let totalImported = 0;
  let totalSkipped = 0;
  const errors: string[] = [];

  // Load agent settings from DB
  let leadsPerQuery = 6;
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
      const leadsPerRun = (settings.lead_engine?.leads_per_run as number) || 50;
      leadsPerQuery = Math.max(1, Math.round(leadsPerRun / 10));
      const industries = settings.lead_engine?.target_industries as string[];
      if (industries && industries.length > 0) customIndustries = industries;
      const locations = settings.lead_engine?.target_locations as string[];
      if (locations && locations.length > 0) customLocations = locations;
    }
  } catch {}

  try {
    // Use custom settings or defaults
    const industries = customIndustries || TARGET_INDUSTRIES;
    const allCities = customLocations || TARGET_CITIES;

    // Rotate through cities each day
    const dayOfMonth = new Date().getDate();
    const cityOffset = (dayOfMonth % 2) * Math.min(8, allCities.length);
    const todayCities = allCities.slice(cityOffset, cityOffset + 8);

    for (const industry of industries) {
      for (const city of todayCities) {
        try {
          // Scrape Google Places
          const googleLeads = await scrapeGooglePlaces(industry, city, leadsPerQuery);

          // Scrape Facebook
          const fbLeads = await scrapeFacebookBusinessPages(industry, city);

          const allLeads = [...googleLeads, ...fbLeads.slice(0, leadsPerQuery)];

          for (const lead of allLeads) {
            // Enrich email from website
            if (lead.website && !lead.email) {
              lead.email = await scrapeWebsiteForEmail(lead.website);
            }

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
              // Likely duplicate constraint violation
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
          }

          // Rate limit pause
          await new Promise((r) => setTimeout(r, 300));
        } catch (err) {
          errors.push(`${industry}/${city}: ${err}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      totalImported,
      totalSkipped,
      errors: errors.slice(0, 10),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: String(err),
    }, { status: 500 });
  }
}
