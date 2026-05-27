import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

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

  // May 26 audit: system_health has no user_id column so RLS alone cannot
  // isolate per-tenant rows. Scope the integration_name key to ownerId so
  // each agency owner reads/writes their own config row.
  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data } = await supabase
    .from("system_health")
    .select("metadata")
    .eq("integration_name", `outreach_config_${ownerId}`)
    .single();

  const meta = (data?.metadata as Record<string, unknown> | undefined) || {};
  const campaigns = Array.isArray(meta.campaigns) ? meta.campaigns : [];

  return NextResponse.json({ campaigns });
}
