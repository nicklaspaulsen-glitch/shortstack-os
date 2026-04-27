import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

const ALLOWED_PATCH_FIELDS = new Set([
  "status",
  "plan_tier",
  "monthly_amount_cents",
  "name",
  "stripe_subscription_id",
  "metadata",
]);

const ALLOWED_STATUSES = new Set(["pending", "active", "suspended", "cancelled"]);

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [key, value] of Object.entries(body)) {
    if (!ALLOWED_PATCH_FIELDS.has(key)) continue;
    if (key === "status") {
      if (typeof value !== "string" || !ALLOWED_STATUSES.has(value)) continue;
      updates.status = value;
      if (value === "active") updates.activated_at = new Date().toISOString();
      if (value === "cancelled") updates.cancelled_at = new Date().toISOString();
    } else if (key === "monthly_amount_cents") {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) continue;
      updates.monthly_amount_cents = Math.floor(value);
    } else {
      updates[key] = value;
    }
  }

  const service = createServiceClient();
  const { data: row } = await service
    .from("subaccounts")
    .select("parent_user_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!row || row.parent_user_id !== ownerId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await service
    .from("subaccounts")
    .update(updates)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) {
    console.error("[subaccounts/:id] PATCH error:", error);
    return NextResponse.json({ error: error.message || "Update failed" }, { status: 500 });
  }
  return NextResponse.json({ subaccount: data });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();
  const { data: row } = await service
    .from("subaccounts")
    .select("parent_user_id, status")
    .eq("id", params.id)
    .maybeSingle();
  if (!row || row.parent_user_id !== ownerId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await service
    .from("subaccounts")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id);

  if (error) {
    console.error("[subaccounts/:id] DELETE error:", error);
    return NextResponse.json({ error: error.message || "Cancel failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
