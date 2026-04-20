import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// SECURITY: this endpoint used to write to a SHARED `system_config` row
// keyed "scraper_auto_run" — meaning ANY authed user (including a client
// role) could flip the scraper off for the whole product or redirect it to
// their own niches. Now:
//   1. Gated to agency-owner roles only (admin | founder | agency | team_member)
//   2. Config is keyed per-user: `scraper_auto_run:${ownerId}`
//   3. GET/POST both scope to the caller's ownerId — no more global reads/writes

const ALLOWED_ROLES = ["admin", "founder", "agency", "team_member"];

async function resolveOwner(authSupabase: ReturnType<typeof createServerSupabase>, userId: string) {
  const { data: profile } = await authSupabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  const role = (profile as { role: string } | null)?.role || "";
  if (!ALLOWED_ROLES.includes(role)) return null;
  return getEffectiveOwnerId(authSupabase, userId);
}

/**
 * POST /api/scraper/auto-run
 * Save or update the caller's auto-run scraper configuration.
 */
export async function POST(request: NextRequest) {
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await resolveOwner(authSupabase, user.id);
  if (!ownerId) {
    return NextResponse.json(
      { error: "Only agency owners, founders, or team members can configure the scraper" },
      { status: 403 },
    );
  }

  try {
    const { enabled, time, days, platforms, niches, locations, max_results, filters } =
      await request.json();

    const supabase = createServiceClient();
    const configKey = `scraper_auto_run:${ownerId}`;

    const config = {
      owner_id: ownerId,
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

    // Upsert per-user config row.
    const { error } = await supabase
      .from("system_config")
      .upsert(
        {
          key: configKey,
          value: config,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );

    if (error) {
      // If system_config table doesn't exist, fall back to system_health
      // with a per-user service_name so we still get tenant isolation.
      console.warn("[auto-run] system_config upsert failed, trying system_health:", error.message);

      const { error: err2 } = await supabase
        .from("system_health")
        .upsert(
          {
            service_name: configKey,
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
 * Retrieve the caller's auto-run configuration.
 */
export async function GET() {
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await resolveOwner(authSupabase, user.id);
  if (!ownerId) {
    return NextResponse.json(
      { error: "Only agency owners, founders, or team members can read the scraper config" },
      { status: 403 },
    );
  }

  try {
    const supabase = createServiceClient();
    const configKey = `scraper_auto_run:${ownerId}`;

    // Try per-user config first
    const { data } = await supabase
      .from("system_config")
      .select("value")
      .eq("key", configKey)
      .maybeSingle();

    if (data?.value) {
      return NextResponse.json({ config: data.value });
    }

    // Fallback to system_health with per-user service_name
    const { data: shData } = await supabase
      .from("system_health")
      .select("metadata, status")
      .eq("service_name", configKey)
      .maybeSingle();

    if (shData?.metadata) {
      return NextResponse.json({
        config: {
          ...shData.metadata,
          enabled: shData.status === "healthy",
        },
      });
    }

    // No config yet for this owner
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
