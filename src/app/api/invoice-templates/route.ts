/**
 * Invoice Templates API — CRUD over `invoice_templates` table.
 *
 * line_items is a jsonb array of { description, quantity, unit_price_cents }.
 * We only validate that it's an array on write; the schema of each item is
 * enforced in the UI.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const { data, error } = await supabase
    .from("invoice_templates")
    .select("*")
    .eq("user_id", ownerId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const body = await request.json();
  const { name, line_items, tax_rate, notes, is_default } = body ?? {};
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const lineItems = Array.isArray(line_items) ? line_items : [];

  // If this template is being set default, clear any existing default first.
  if (is_default) {
    await supabase
      .from("invoice_templates")
      .update({ is_default: false })
      .eq("user_id", ownerId)
      .eq("is_default", true);
  }

  const { data, error } = await supabase
    .from("invoice_templates")
    .insert({
      user_id: ownerId,
      name: name.trim(),
      line_items: lineItems,
      tax_rate: Number.isFinite(Number(tax_rate)) ? Number(tax_rate) : 0,
      notes: notes || null,
      is_default: !!is_default,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const body = await request.json();
  const { id, ...updates } = body ?? {};
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const allowed = ["name", "line_items", "tax_rate", "notes", "is_default"];
  const safe: Record<string, unknown> = {};
  for (const k of allowed) if (k in updates) safe[k] = updates[k];
  if ("line_items" in safe && !Array.isArray(safe.line_items)) {
    return NextResponse.json({ error: "line_items must be an array" }, { status: 400 });
  }
  if (Object.keys(safe).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }
  safe.updated_at = new Date().toISOString();

  // Flipping on is_default should clear any other default for this user.
  if (safe.is_default === true) {
    await supabase
      .from("invoice_templates")
      .update({ is_default: false })
      .eq("user_id", ownerId)
      .eq("is_default", true)
      .neq("id", id);
  }

  const { data, error } = await supabase
    .from("invoice_templates")
    .update(safe)
    .eq("id", id)
    .eq("user_id", ownerId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
}

export async function DELETE(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { error } = await supabase
    .from("invoice_templates")
    .delete()
    .eq("id", id)
    .eq("user_id", ownerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
