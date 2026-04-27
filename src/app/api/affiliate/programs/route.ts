/**
 * Affiliate programs — list and create.
 *
 * Each agency owner can run multiple programs (e.g. "Main 30% recurring",
 * "Black Friday flat $50"). Programs hold the commercial terms; affiliates
 * are attached to a program.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export const dynamic = "force-dynamic";

const ALLOWED_TYPE = new Set(["flat", "percentage"]);
const ALLOWED_SCHEDULE = new Set(["weekly", "monthly", "quarterly"]);
const ALLOWED_STATUS = new Set(["active", "paused", "closed"]);

interface CreateInput {
  name?: string;
  description?: string | null;
  commission_type?: string;
  commission_value?: number;
  cookie_days?: number;
  payout_threshold_cents?: number;
  payout_schedule?: string;
  status?: string;
}

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: programs, error } = await supabase
    .from("affiliate_programs")
    .select("id, name, description, commission_type, commission_value, cookie_days, payout_threshold_cents, payout_schedule, status, created_at, updated_at")
    .eq("user_id", ownerId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with affiliate count for each program — single round-trip over
  // affiliates table filtered to the program ids we just loaded.
  const ids = (programs || []).map((p) => p.id);
  let affiliateCountByProgram: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: counts } = await supabase
      .from("affiliates")
      .select("program_id")
      .in("program_id", ids);
    affiliateCountByProgram = (counts || []).reduce<Record<string, number>>((acc, a) => {
      acc[a.program_id] = (acc[a.program_id] || 0) + 1;
      return acc;
    }, {});
  }

  const enriched = (programs || []).map((p) => ({
    ...p,
    affiliate_count: affiliateCountByProgram[p.id] || 0,
  }));

  return NextResponse.json({ programs: enriched });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: CreateInput;
  try {
    body = (await request.json()) as CreateInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const commission_type = body.commission_type;
  if (!commission_type || !ALLOWED_TYPE.has(commission_type)) {
    return NextResponse.json({ error: "commission_type must be 'flat' or 'percentage'" }, { status: 400 });
  }

  const commission_value = Number(body.commission_value);
  if (!Number.isFinite(commission_value) || commission_value <= 0) {
    return NextResponse.json({ error: "commission_value must be a positive number" }, { status: 400 });
  }
  // Soft cap percentages so a fat finger doesn't pay 1000%.
  if (commission_type === "percentage" && commission_value > 100) {
    return NextResponse.json({ error: "commission_value cannot exceed 100 for percentage" }, { status: 400 });
  }

  const payout_schedule = body.payout_schedule ?? "monthly";
  if (!ALLOWED_SCHEDULE.has(payout_schedule)) {
    return NextResponse.json({ error: "payout_schedule must be weekly|monthly|quarterly" }, { status: 400 });
  }

  const status = body.status ?? "active";
  if (!ALLOWED_STATUS.has(status)) {
    return NextResponse.json({ error: "status must be active|paused|closed" }, { status: 400 });
  }

  const insertRow = {
    user_id: ownerId,
    name,
    description: body.description ?? null,
    commission_type,
    commission_value,
    cookie_days: typeof body.cookie_days === "number" ? Math.max(1, Math.min(365, body.cookie_days)) : 30,
    payout_threshold_cents: typeof body.payout_threshold_cents === "number"
      ? Math.max(0, body.payout_threshold_cents)
      : 5000,
    payout_schedule,
    status,
  };

  const { data, error } = await supabase
    .from("affiliate_programs")
    .insert(insertRow)
    .select("id, name, description, commission_type, commission_value, cookie_days, payout_threshold_cents, payout_schedule, status, created_at, updated_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Failed to create program" }, { status: 500 });
  }

  return NextResponse.json({ program: data });
}
