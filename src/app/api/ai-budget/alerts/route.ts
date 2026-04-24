import { NextRequest, NextResponse } from "next/server";

import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

/*
  GET /api/ai-budget/alerts — recent alerts for the caller's org.
*/
export async function GET(_req: NextRequest) {
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = user.id;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("ai_budget_alerts")
    .select("id, alert_type, spend_at_alert, sent_at, recipient_email")
    .eq("org_id", orgId)
    .order("sent_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ alerts: data ?? [] });
}
