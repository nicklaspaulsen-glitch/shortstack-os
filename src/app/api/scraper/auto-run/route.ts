import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/scraper/auto-run
 * Save or update the daily auto-run scraper configuration.
 * Stores in system_config table — the cron job reads this to decide whether to run.
 */
export async function POST(request: NextRequest) {
  try {
    const { enabled, time, days, platforms, niches, locations, max_results, filters } =
      await request.json();

    const supabase = createServiceClient();

    // Upsert auto-run config into system_config
    const config = {
      enabled: !!enabled,
      time: time || "09:00",
      days: days || ["mon", "tue", "wed", "thu", "fri"],
      platforms: platforms || ["google_maps"],
      niches: niches || [],
      locations: locations || [],
      max_results: max_results || 20,
      filters: filters || {},
      updated_at: new Date().toISOString(),
    };

    // Try to upsert into system_config table
    const { error } = await supabase
      .from("system_config")
      .upsert(
        {
          key: "scraper_auto_run",
          value: config,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );

    if (error) {
      // If system_config table doesn't exist, fall back to system_health
      console.warn("[auto-run] system_config upsert failed, trying system_health:", error.message);

      const { error: err2 } = await supabase
        .from("system_health")
        .upsert(
          {
            service_name: "scraper_auto_run",
            status: enabled ? "healthy" : "down",
            response_time_ms: 0,
            metadata: config,
            checked_at: new Date().toISOString(),
          },
          { onConflict: "service_name" }
        );

      if (err2) {
        console.error("[auto-run] Both upsert paths failed:", err2.message);
        return NextResponse.json({ error: "Failed to save config" }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      config,
      message: enabled
        ? `Auto-run enabled — daily at ${config.time}`
        : "Auto-run disabled",
    });
  } catch (err) {
    console.error("[auto-run]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/**
 * GET /api/scraper/auto-run
 * Retrieve current auto-run configuration.
 */
export async function GET() {
  try {
    const supabase = createServiceClient();

    // Try system_config first
    const { data } = await supabase
      .from("system_config")
      .select("value")
      .eq("key", "scraper_auto_run")
      .single();

    if (data?.value) {
      return NextResponse.json({ config: data.value });
    }

    // Fallback to system_health
    const { data: shData } = await supabase
      .from("system_health")
      .select("metadata, status")
      .eq("service_name", "scraper_auto_run")
      .single();

    if (shData?.metadata) {
      return NextResponse.json({
        config: {
          ...shData.metadata,
          enabled: shData.status === "healthy",
        },
      });
    }

    // No config yet
    return NextResponse.json({
      config: {
        enabled: false,
        time: "09:00",
        days: ["mon", "tue", "wed", "thu", "fri"],
        platforms: ["google_maps"],
        niches: [],
        locations: [],
        max_results: 20,
        filters: {},
      },
    });
  } catch (err) {
    console.error("[auto-run GET]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
