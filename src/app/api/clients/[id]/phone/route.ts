import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import {
  checkLimit,
  limitsForTier,
  normalizePlanTier,
} from "@/lib/usage-limits";

/**
 * GET /api/clients/:id/phone
 * Per-client phone-number status: attached Twilio number, ElevenAgent, and
 * this-calendar-month SMS sent + call minutes for THIS client (scoped via
 * outreach_log). Also returns the agency's plan-tier concurrent phone_numbers
 * cap so the UI can decide whether to show a "Provision" button.
 *
 * Caller must be the agency owner (or team member) that owns the client —
 * portal users get the same data for their own client row.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: clientId } = await context.params;
  if (!clientId) {
    return NextResponse.json({ error: "client id required" }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  // Fetch the client row + verify ownership.
  const { data: client } = await service
    .from("clients")
    .select(
      "id, profile_id, business_name, twilio_phone_number, twilio_phone_sid, eleven_phone_number_id, eleven_agent_id",
    )
    .eq("id", clientId)
    .maybeSingle();

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Ownership check: the caller must be either the agency owner (profile_id
  // match after team-member resolution) or the portal user whose profile_id
  // is set directly on the client row.
  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  const callerIsOwner = !!ownerId && client.profile_id === ownerId;
  const callerIsPortalUser = client.profile_id === user.id;
  if (!callerIsOwner && !callerIsPortalUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Monthly usage for THIS client only — via outreach_log (lead_id join not
  // needed, outreach_log has client_id). This keeps the per-client numbers
  // distinct from the agency-wide totals shown in /api/usage/current.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  let smsThisMonth = 0;
  let callMinutesThisMonth = 0;
  try {
    const { data: outreach } = await service
      .from("outreach_log")
      .select("platform, status, metadata")
      .eq("client_id", clientId)
      .gte("created_at", monthStart)
      .eq("status", "sent")
      .limit(20000);
    for (const o of outreach || []) {
      if (o.platform === "sms") smsThisMonth += 1;
      else if (o.platform === "call") {
        const meta = (o as { metadata?: Record<string, unknown> }).metadata;
        const dur =
          typeof meta?.duration_minutes === "number"
            ? Number(meta.duration_minutes)
            : 1;
        callMinutesThisMonth += dur;
      }
    }
  } catch {
    // best-effort — leave counts at 0
  }

  // Plan-tier cap lookup (against agency owner, not the portal user). We
  // still compute this when the caller is a portal user so the UI can show
  // how many numbers the agency has remaining — but the "Provision" button
  // is only rendered for agency-side callers.
  const capOwnerId = ownerId || client.profile_id;
  let planTier = "Starter";
  let cap: number | "unlimited" = 0;
  let currentCount = 0;
  let remaining: number | "unlimited" = 0;

  if (capOwnerId) {
    const { data: profile } = await service
      .from("profiles")
      .select("plan_tier")
      .eq("id", capOwnerId)
      .maybeSingle();
    planTier = normalizePlanTier(profile?.plan_tier as string | null | undefined);
    const tierLimits = limitsForTier(planTier);
    const gate = await checkLimit(capOwnerId, "phone_numbers", 0);
    currentCount = gate.current;
    if (Number.isFinite(tierLimits.phone_numbers)) {
      cap = tierLimits.phone_numbers;
      remaining = Math.max(0, tierLimits.phone_numbers - currentCount);
    } else {
      cap = "unlimited";
      remaining = "unlimited";
    }
  }

  return NextResponse.json({
    client_id: client.id,
    business_name: client.business_name,
    phone_number: client.twilio_phone_number || null,
    twilio_sid: client.twilio_phone_sid || null,
    eleven_phone_number_id: client.eleven_phone_number_id || null,
    eleven_agent_id: client.eleven_agent_id || null,
    has_number: !!client.twilio_phone_number,
    usage: {
      sms_this_month: smsThisMonth,
      call_minutes_this_month: callMinutesThisMonth,
    },
    plan: {
      plan_tier: planTier,
      cap,
      current: currentCount,
      remaining,
    },
    caller_role: callerIsOwner ? "owner" : "client",
  });
}
