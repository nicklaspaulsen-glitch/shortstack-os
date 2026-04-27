/**
 * Single affiliate program — GET / PATCH.
 * DELETE is intentionally omitted in v1 — closed programs are paused via
 * status='closed' so historical commissions stay queryable.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

const ALLOWED_TYPE = new Set(["flat", "percentage"]);
const ALLOWED_SCHEDULE = new Set(["weekly", "monthly", "quarterly"]);
const ALLOWED_STATUS = new Set(["active", "paused", "closed"]);

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("affiliate_programs")
    .select("id, name, description, commission_type, commission_value, cookie_days, payout_threshold_cents, payout_schedule, status, created_at, updated_at")
    .eq("id", params.id)
    .eq("user_id", ownerId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ program: data });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (typeof body.description === "string" || body.description === null) updates.description = body.description;
  if (typeof body.commission_type === "string") {
    if (!ALLOWED_TYPE.has(body.commission_type)) {
      return NextResponse.json({ error: "commission_type must be flat|percentage" }, { status: 400 });
    }
    updates.commission_type = body.commission_type;
  }
  if (typeof body.commission_value === "number" && body.commission_value > 0) {
    updates.commission_value = body.commission_value;
  }
  if (typeof body.cookie_days === "number") {
    updates.cookie_days = Math.max(1, Math.min(365, body.cookie_days));
  }
  if (typeof body.payout_threshold_cents === "number") {
    updates.payout_threshold_cents = Math.max(0, body.payout_threshold_cents);
  }
  if (typeof body.payout_schedule === "string") {
    if (!ALLOWED_SCHEDULE.has(body.payout_schedule)) {
      return NextResponse.json({ error: "payout_schedule must be weekly|monthly|quarterly" }, { status: 400 });
    }
    updates.payout_schedule = body.payout_schedule;
  }
  if (typeof body.status === "string") {
    if (!ALLOWED_STATUS.has(body.status)) {
      return NextResponse.json({ error: "status must be active|paused|closed" }, { status: 400 });
    }
    updates.status = body.status;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("affiliate_programs")
    .update(updates)
    .eq("id", params.id)
    .eq("user_id", ownerId)
    .select("id, name, description, commission_type, commission_value, cookie_days, payout_threshold_cents, payout_schedule, status, created_at, updated_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Not found" }, { status: 404 });
  }
  return NextResponse.json({ program: data });
}
