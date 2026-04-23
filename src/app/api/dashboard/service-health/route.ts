import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * GET — Check the health of critical services and return a status summary.
 * Used by the dashboard to show a downtime banner when something is broken.
 */
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  interface ServiceStatus {
    key: string;
    label: string;
    status: "operational" | "degraded" | "down" | "unknown";
    message?: string;
    last_check?: string;
  }

  const services: ServiceStatus[] = [];

  // Check system_health table for any active issues.
  // Column is `last_check_at` (see system_health schema) — the old code queried
  // `last_check` which silently returned no rows inside the try/catch.
  try {
    const { data: healthRecords } = await supabase
      .from("system_health")
      .select("integration_name, status, last_check_at, error_message")
      .in("status", ["degraded", "down", "error"])
      .order("last_check_at", { ascending: false })
      .limit(15);

    if (Array.isArray(healthRecords)) {
      for (const h of healthRecords) {
        services.push({
          key: h.integration_name,
          label: formatLabel(h.integration_name),
          status: h.status === "down" || h.status === "error" ? "down" : "degraded",
          message: h.error_message || undefined,
          last_check: h.last_check_at,
        });
      }
    }
  } catch {
    // table missing — fallthrough
  }

  // Check for failed cron jobs recently (last 2 hours)
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: failed } = await supabase
      .from("trinity_log")
      .select("action_type, description, created_at")
      .eq("status", "failed")
      .gte("created_at", twoHoursAgo)
      .limit(5);

    if (Array.isArray(failed) && failed.length > 0) {
      const seen = new Set<string>();
      for (const row of failed) {
        const key = `cron_${row.action_type}`;
        if (seen.has(key)) continue;
        seen.add(key);
        services.push({
          key,
          label: `Automation: ${formatLabel(row.action_type)}`,
          status: "degraded",
          message: (row.description || "Recent run failed").slice(0, 120),
          last_check: row.created_at,
        });
      }
    }
  } catch {}

  // Overall status
  const hasDown = services.some(s => s.status === "down");
  const hasDegraded = services.some(s => s.status === "degraded");
  const overall = hasDown ? "down" : hasDegraded ? "degraded" : "operational";

  return NextResponse.json({
    overall,
    count: services.length,
    services,
    checked_at: new Date().toISOString(),
  });
}

function formatLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}
