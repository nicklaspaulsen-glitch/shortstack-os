import { NextRequest, NextResponse } from "next/server";

import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

/*
  POST /api/ai-budget/resume — admin manually resumes AI spend for the org.
  Inserts an audit row with alert_type = 'manual_resume'.
*/
export async function POST(_req: NextRequest) {
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

  const orgId = user.id;

  const { data, error } = await supabase
    .from("org_ai_budgets")
    .update({ paused: false, paused_reason: null })
    .eq("org_id", orgId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("ai_budget_alerts").insert({
    org_id: orgId,
    alert_type: "manual_resume",
    spend_at_alert: data.current_month_spend_usd ?? 0,
    recipient_email: user.email ?? null,
  });

  return NextResponse.json({ budget: data });
}
