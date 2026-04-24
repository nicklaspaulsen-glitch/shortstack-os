import { NextRequest, NextResponse } from "next/server";

import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

/*
  POST /api/ai-budget/pause — admin manually pauses AI spend for the org.
  Inserts an audit row in ai_budget_alerts with alert_type = 'manual_pause'.
*/
export async function POST(req: NextRequest) {
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const reason: string =
    typeof body.reason === "string" && body.reason.trim()
      ? body.reason.trim()
      : "manual_pause";

  const orgId = user.id; // resolveOrgId — see main route

  const { data, error } = await supabase
    .from("org_ai_budgets")
    .update({ paused: true, paused_reason: reason })
    .eq("org_id", orgId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("ai_budget_alerts").insert({
    org_id: orgId,
    alert_type: "manual_pause",
    spend_at_alert: data.current_month_spend_usd ?? 0,
    recipient_email: user.email ?? null,
  });

  return NextResponse.json({ budget: data });
}
