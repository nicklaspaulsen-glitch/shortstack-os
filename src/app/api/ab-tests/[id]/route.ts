/**
 * A/B Test single — fetch, update (status, traffic_split), delete.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

const ALLOWED_STATUS = new Set(["running", "paused", "completed"]);

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) ?? user.id;

  const { data, error } = await supabase
    .from("ab_tests")
    .select("*, ab_variants(*)")
    .eq("id", params.id)
    .eq("user_id", ownerId)
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ test: data });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) ?? user.id;
  const body = (await req.json()) as Record<string, unknown>;

  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string") updates.name = body.name;
  if (typeof body.status === "string" && ALLOWED_STATUS.has(body.status)) {
    updates.status = body.status;
    if (body.status === "completed") updates.ended_at = new Date().toISOString();
  }
  if (body.traffic_split && typeof body.traffic_split === "object") {
    updates.traffic_split = body.traffic_split;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("ab_tests")
    .update(updates)
    .eq("id", params.id)
    .eq("user_id", ownerId)
    .select()
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ test: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) ?? user.id;

  const { error } = await supabase
    .from("ab_tests")
    .delete()
    .eq("id", params.id)
    .eq("user_id", ownerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
