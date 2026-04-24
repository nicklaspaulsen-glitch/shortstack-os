import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

// GET /api/funnels/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("funnels")
    .select(`*, funnel_steps(*)`)
    .eq("id", params.id)
    .eq("profile_id", user.id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Sort steps
  const steps = ((data.funnel_steps ?? []) as Record<string, unknown>[]).sort(
    (a, b) => (a.sort_order as number) - (b.sort_order as number)
  );

  return NextResponse.json({ funnel: { ...data, funnel_steps: steps } });
}

// PUT /api/funnels/[id]
export async function PUT(req: NextRequest, { params }: Params) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, description, status } = body;

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (status !== undefined) updates.status = status;

  const { data, error } = await supabase
    .from("funnels")
    .update(updates)
    .eq("id", params.id)
    .eq("profile_id", user.id)
    .select()
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found or update failed" }, { status: 404 });
  return NextResponse.json({ funnel: data });
}

// DELETE /api/funnels/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("funnels")
    .delete()
    .eq("id", params.id)
    .eq("profile_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
