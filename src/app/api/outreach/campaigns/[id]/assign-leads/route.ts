import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

/**
 * POST /api/outreach/campaigns/[id]/assign-leads
 *
 * Body: {
 *   lead_ids: string[],
 *   schedule: "once" | "daily" | "every_other_day" | "weekdays" | "custom",
 *   start_at?: string (ISO),
 *   team_member_id?: string
 * }
 *
 * Links leads to the given campaign by writing:
 *   leads.metadata.assigned_campaign_id
 *   leads.metadata.campaign_schedule
 *   leads.metadata.campaign_assigned_at
 *   leads.metadata.campaign_start_at
 *   leads.assigned_to (team_member_id, if provided)
 *
 * We store the campaign linkage inside `leads.metadata` rather than adding a
 * column, since campaigns are persisted inside the outreach_config JSON blob
 * today — this keeps the schema change non-breaking.
 */

type Schedule = "once" | "daily" | "every_other_day" | "weekdays" | "custom";

const VALID_SCHEDULES: Schedule[] = ["once", "daily", "every_other_day", "weekdays", "custom"];

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

  const campaignId = params.id;
  if (!campaignId) return NextResponse.json({ error: "Campaign id required" }, { status: 400 });

  let body: {
    lead_ids?: unknown;
    schedule?: unknown;
    start_at?: unknown;
    team_member_id?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const leadIds = Array.isArray(body.lead_ids)
    ? (body.lead_ids as unknown[]).filter(id => typeof id === "string") as string[]
    : [];
  if (leadIds.length === 0) {
    return NextResponse.json({ error: "lead_ids[] is required" }, { status: 400 });
  }
  if (leadIds.length > 1000) {
    return NextResponse.json({ error: "Max 1000 leads per request" }, { status: 400 });
  }

  const schedule = typeof body.schedule === "string" && VALID_SCHEDULES.includes(body.schedule as Schedule)
    ? (body.schedule as Schedule)
    : "once";
  const startAt = typeof body.start_at === "string" ? body.start_at : new Date().toISOString();
  const teamMemberId = typeof body.team_member_id === "string" ? body.team_member_id : null;

  // Verify the campaign exists and belongs to the caller. Campaigns are stored
  // inside system_health.metadata.campaigns[] for this org — so we fetch that
  // blob and assert the id matches one of the user's campaigns.
  const { data: cfg } = await supabase
    .from("system_health")
    .select("metadata, updated_at")
    .eq("integration_name", "outreach_config")
    .single();

  const campaigns = ((cfg?.metadata as Record<string, unknown> | undefined)?.campaigns as Array<{ id?: string }> | undefined) || [];
  const campaign = campaigns.find(c => c?.id === campaignId);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found or not owned by user" }, { status: 404 });
  }

  // Verify the leads belong to the effective owner before mutating.
  const service = createServiceClient();

  const { data: ownLeads } = await service
    .from("leads")
    .select("id, metadata, user_id")
    .eq("user_id", ownerId)
    .in("id", leadIds);

  // Strict scope to caller's owned leads — never auto-claim legacy null-user_id
  // rows (previous logic let any caller take ownership of them).
  const allowedLeads = ownLeads || [];

  if (allowedLeads.length === 0) {
    return NextResponse.json({ error: "No permitted leads in request" }, { status: 403 });
  }

  const nowIso = new Date().toISOString();
  let updatedCount = 0;
  const errors: string[] = [];

  for (const lead of allowedLeads) {
    const existingMeta = (lead.metadata as Record<string, unknown> | null) || {};
    const newMeta = {
      ...existingMeta,
      assigned_campaign_id: campaignId,
      campaign_schedule: schedule,
      campaign_assigned_at: nowIso,
      campaign_start_at: startAt,
      ...(teamMemberId ? { campaign_team_member_id: teamMemberId } : {}),
    };

    // Write both the dedicated columns (added in 20260418 migration) and
    // mirror into metadata so the data works even on older schemas.
    const update: Record<string, unknown> = {
      metadata: newMeta,
      assigned_campaign_id: campaignId,
      campaign_schedule: schedule,
      campaign_assigned_at: nowIso,
      campaign_start_at: startAt,
    };
    if (teamMemberId) {
      update.assigned_to = teamMemberId;
      update.campaign_team_member_id = teamMemberId;
    }

    const { error } = await service.from("leads").update(update).eq("id", lead.id);
    if (error) {
      // If dedicated columns don't exist yet, fall back to metadata-only update.
      const fallback: Record<string, unknown> = { metadata: newMeta };
      if (teamMemberId) fallback.assigned_to = teamMemberId;
      const { error: e2 } = await service.from("leads").update(fallback).eq("id", lead.id);
      if (e2) {
        errors.push(`${lead.id}: ${e2.message}`);
      } else {
        updatedCount++;
      }
    } else {
      updatedCount++;
    }
  }

  return NextResponse.json({
    success: true,
    campaign_id: campaignId,
    assigned: updatedCount,
    skipped: leadIds.length - updatedCount,
    schedule,
    start_at: startAt,
    errors: errors.slice(0, 10),
  });
}
