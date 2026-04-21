import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { checkLimit, recordUsage } from "@/lib/usage-limits";

// DEPRECATED — Legacy GHL cold-call endpoint.
// This route now delegates to the native ElevenAgents caller via /api/call.
// The GHL implementation was removed Apr 21 per MEMORY migration plan.
// Kept in place so any existing UI that posts here continues to work.
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Owner scoping — matches the native /api/call contract.
  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { lead_id, phone_number, business_name } = await request.json();

  // Plan-tier cap: mirror `/api/call` so this endpoint can't be used to bypass
  // call_minutes limits.
  const gate = await checkLimit(ownerId, "call_minutes", 1);
  if (!gate.allowed) {
    return NextResponse.json(
      { error: gate.reason || "Call minutes limit reached for your plan.", current: gate.current, limit: gate.limit, plan_tier: gate.plan_tier },
      { status: 402 },
    );
  }

  const serviceSupabase = createServiceClient();

  // Resolve phone + business name from lead_id when provided, owner-scoped.
  let phone = phone_number;
  let name = business_name || "Lead";
  if (lead_id) {
    const { data: lead } = await serviceSupabase
      .from("leads")
      .select("*")
      .eq("id", lead_id)
      .eq("user_id", ownerId)
      .single();
    if (!lead) {
      return NextResponse.json({ error: "Lead not found or access denied" }, { status: 403 });
    }
    phone = lead.phone || phone_number;
    name = lead.business_name;
  }

  if (!phone) return NextResponse.json({ error: "No phone number" }, { status: 400 });

  // Delegate to the native ElevenAgents caller. /api/call handles agent
  // resolution, phone provisioning, and webhook wiring.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app";
  try {
    const callRes = await fetch(`${appUrl}/api/call`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: request.headers.get("cookie") || "",
      },
      body: JSON.stringify({ lead_id, phone, business_name: name }),
    });
    const callData = await callRes.json().catch(() => ({}));

    if (!callRes.ok) {
      return NextResponse.json(
        { error: callData.error || "Call delegation to ElevenAgents failed", status: callRes.status },
        { status: callRes.status },
      );
    }

    // Mirror the legacy success shape for any callers that expected it.
    if (lead_id) {
      await serviceSupabase
        .from("leads")
        .update({ status: "called" })
        .eq("id", lead_id)
        .eq("user_id", ownerId);
    }

    // Plan-tier usage metering
    await recordUsage(ownerId, "call_minutes", 1, { lead_id: lead_id || null, platform: "eleven_agents_via_ghl_shim" });

    await serviceSupabase.from("trinity_log").insert({
      action_type: "lead_gen",
      description: `Cold call (via ElevenAgents): ${name} (${phone})`,
      status: "completed",
      result: { phone, business: name, delegated_to: "/api/call", response: callData },
    });

    return NextResponse.json({ success: true, phone, business: name, delegated: true, ...callData });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
