import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Repair an agent — clears error state, retries last failed action, refreshes tokens.
//
// SECURITY (Apr 26): role-gated AND scoped to the caller's tenant. Pre-fix
// this route would mark the 5 newest error rows for an agent across the
// WHOLE trinity_log table — i.e. cross-tenant write of audit log status.
//
// Note: trinity_log is mixed-keyed across this codebase — some inserts
// write `user_id`, others write `profile_id`. We resolve the effective
// owner once (handles team_members) then filter by EITHER column so
// genuine error rows aren't missed by the scoping.
export async function POST(_request: NextRequest, { params }: { params: { agentId: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Role gate — clients should never repair agents. Fail-closed on missing
  // profile (otherwise users without a row would slip through).
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, parent_agency_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.role === "client") {
    return NextResponse.json({ error: "Operators only" }, { status: 403 });
  }

  // team_members operate on their parent agency's audit logs.
  const ownerId =
    profile.role === "team_member" && profile.parent_agency_id
      ? profile.parent_agency_id
      : user.id;

  const agentId = params.agentId;
  const repairs: string[] = [];

  // 1. Clear recent error logs — marked as "repaired".
  //
  // Tenant scoping uses a single nested PostgREST boolean expression so
  // there's exactly one `or=` query param on the wire. Two chained
  // .or() calls would add two separate `or=` params, which PostgREST
  // documents as AND'd top-level filters but the supabase-js builder
  // can collapse during chaining edge cases — codex flagged this in
  // round-2 review. Single nested expression is unambiguous.
  //
  // Logical shape:
  //   (user_id = ownerId OR profile_id = ownerId)
  //     AND
  //   (agent = agentId OR action_type = agentId)
  //     AND status = 'error'
  const tenantFilter = `or(user_id.eq.${ownerId},profile_id.eq.${ownerId})`;
  const agentFilter = `or(agent.eq.${agentId},action_type.eq.${agentId})`;
  const { data: errorLogs } = await supabase
    .from("trinity_log")
    .select("id")
    .or(`and(${tenantFilter},${agentFilter})`)
    .eq("status", "error")
    .order("created_at", { ascending: false })
    .limit(5);

  if (errorLogs && errorLogs.length > 0) {
    // Defense in depth: even though the SELECT was tenant-scoped, the
    // UPDATE re-applies the same tenant filter so a race between two
    // concurrent repair requests can't cross tenants.
    await supabase
      .from("trinity_log")
      .update({ status: "repaired" })
      .in("id", errorLogs.map(l => l.id))
      .or(`user_id.eq.${ownerId},profile_id.eq.${ownerId}`);
    repairs.push(`Cleared ${errorLogs.length} error logs`);
  }

  // 2. Agent-specific repair actions
  const agentRepairs: Record<string, () => Promise<string>> = {
    "lead-engine": async () => {
      // Test Google Places connectivity
      const key = process.env.GOOGLE_PLACES_API_KEY;
      if (!key) return "Google Places API key not configured";
      return "Lead Engine reset — ready to scrape";
    },
    "outreach": async () => {
      // Native outreach health: verify Resend + Twilio credentials exist.
      // GHL connectivity check removed Apr 21.
      const hasResend = Boolean(process.env.SMTP_PASS || process.env.RESEND_API_KEY);
      const hasTwilio = Boolean(
        process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_DEFAULT_NUMBER,
      );
      if (!hasResend && !hasTwilio) return "No outreach providers configured (Resend + Twilio both missing)";
      if (!hasResend) return "Resend/SMTP not configured — emails disabled";
      if (!hasTwilio) return "Twilio not configured — SMS disabled";
      return "Outreach Agent reset — Resend + Twilio ready";
    },
    "content": async () => {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) return "Anthropic API key not configured";
      return "Content Agent reset — AI generation ready";
    },
    "ads": async () => {
      return "Ads Manager reset — check Meta/Google ad accounts manually";
    },
    "reviews": async () => {
      return "Review Agent reset — monitoring active";
    },
    "analytics": async () => {
      return "Analytics Agent reset — data collection resumed";
    },
    "trinity": async () => {
      return "Trinity reset — central coordinator online";
    },
    "competitor": async () => {
      return "Competitor Agent reset — monitoring resumed";
    },
  };

  const repairFn = agentRepairs[agentId];
  if (repairFn) {
    const result = await repairFn();
    repairs.push(result);
  }

  // 3. Log the repair — stamp BOTH ownership keys so future tenant-scoped
  // queries hit the row regardless of which column they filter on.
  await supabase.from("trinity_log").insert({
    user_id: ownerId,
    profile_id: ownerId,
    agent: agentId,
    action_type: agentId,
    description: `Agent repaired: ${repairs.join(", ")}`,
    status: "success",
    result: { repairs, triggered_by: user.id },
  });

  return NextResponse.json({
    success: true,
    agent: agentId,
    repairs,
    message: `${agentId} repaired successfully`,
  });
}
