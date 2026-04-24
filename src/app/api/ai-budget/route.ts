import { NextRequest, NextResponse } from "next/server";

import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

/*
  /api/ai-budget
  ──────────────
  GET   — current org budget state (members)
  PATCH — update limit / alert threshold (admin only)
*/

interface BudgetRow {
  org_id: string;
  monthly_limit_usd: number;
  current_month_spend_usd: number;
  reset_date: string;
  alert_threshold_pct: number;
  paused: boolean;
  paused_reason: string | null;
  updated_at: string;
}

async function resolveOrgId(userId: string): Promise<string> {
  // No `organizations` table yet — use the user's own id as a stand-in org scope.
  // When a real org concept lands, swap this resolver.
  return userId;
}

export async function GET(_req: NextRequest) {
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = await resolveOrgId(user.id);
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("org_ai_budgets")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    // Lazy-init default row
    const { data: created, error: insErr } = await supabase
      .from("org_ai_budgets")
      .insert({ org_id: orgId })
      .select("*")
      .single();
    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
    return NextResponse.json({ budget: created as BudgetRow });
  }

  return NextResponse.json({ budget: data as BudgetRow });
}

export async function PATCH(req: NextRequest) {
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
  const payload: Record<string, unknown> = {};

  if (typeof body.monthly_limit_usd === "number" && body.monthly_limit_usd >= 0) {
    payload.monthly_limit_usd = body.monthly_limit_usd;
  }
  if (
    typeof body.alert_threshold_pct === "number" &&
    body.alert_threshold_pct > 0 &&
    body.alert_threshold_pct <= 100
  ) {
    payload.alert_threshold_pct = Math.round(body.alert_threshold_pct);
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const orgId = await resolveOrgId(user.id);
  const { data, error } = await supabase
    .from("org_ai_budgets")
    .update(payload)
    .eq("org_id", orgId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ budget: data as BudgetRow });
}
