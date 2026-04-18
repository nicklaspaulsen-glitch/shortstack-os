import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/outreach/campaigns
 *
 * Returns the authenticated user's outreach campaigns.
 * Campaigns are persisted inside system_health.metadata.campaigns[]
 * (see /api/outreach/configure for the source of truth).
 */
export async function GET(_request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("system_health")
    .select("metadata")
    .eq("integration_name", "outreach_config")
    .single();

  const meta = (data?.metadata as Record<string, unknown> | undefined) || {};
  const campaigns = Array.isArray(meta.campaigns) ? meta.campaigns : [];

  return NextResponse.json({ campaigns });
}
