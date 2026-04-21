import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// Single-sequence GET / PATCH / DELETE. RLS already scopes rows to
// profile_id = auth.uid(); we also verify ownership explicitly so we can
// return a clean 404 (RLS would just return "no row" which looks like 500).

interface PatchInput {
  name?: string;
  description?: string | null;
  is_active?: boolean;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: seq, error } = await supabase
    .from("sequences")
    .select("id, name, description, is_active, created_at, updated_at, profile_id")
    .eq("id", params.id)
    .eq("profile_id", ownerId)
    .single();
  if (error || !seq) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [{ data: steps }, { data: enrollments }] = await Promise.all([
    supabase
      .from("sequence_steps")
      .select("id, step_order, delay_days, channel, template_body, template_subject")
      .eq("sequence_id", params.id)
      .order("step_order", { ascending: true }),
    supabase
      .from("sequence_enrollments")
      .select("id, lead_id, status, current_step, enrolled_at, completed_at")
      .eq("sequence_id", params.id),
  ]);

  return NextResponse.json({
    sequence: seq,
    steps: steps || [],
    enrollments: enrollments || [],
  });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: PatchInput;
  try {
    body = (await request.json()) as PatchInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (body.description !== undefined) patch.description = body.description;
  if (typeof body.is_active === "boolean") patch.is_active = body.is_active;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("sequences")
    .update(patch)
    .eq("id", params.id)
    .eq("profile_id", ownerId)
    .select("id, name, description, is_active, created_at, updated_at")
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ sequence: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error, count } = await supabase
    .from("sequences")
    .delete({ count: "exact" })
    .eq("id", params.id)
    .eq("profile_id", ownerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!count) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
