import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

// Helper: verify ownership of a step via funnel chain
async function verifyStepOwnership(supabase: ReturnType<typeof createServerSupabase>, stepId: string, userId: string) {
  const { data } = await supabase
    .from("funnel_steps")
    .select("*, funnels!inner(profile_id)")
    .eq("id", stepId)
    .single();

  if (!data) return null;
  const funnelData = data.funnels as unknown as { profile_id: string };
  if (funnelData.profile_id !== userId) return null;
  return data;
}

// PUT /api/funnels/steps/[id] — update step or reorder
export async function PUT(req: NextRequest, { params }: Params) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const step = await verifyStepOwnership(supabase, params.id, user.id);
  if (!step) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { title, step_type, page_id, sort_order, settings, direction } = body;

  // Reorder: move left/right
  if (direction === "left" || direction === "right") {
    const { data: allSteps } = await supabase
      .from("funnel_steps")
      .select("id, sort_order")
      .eq("funnel_id", step.funnel_id)
      .order("sort_order", { ascending: true });

    if (!allSteps) return NextResponse.json({ error: "Steps not found" }, { status: 404 });

    const idx = allSteps.findIndex((s) => s.id === params.id);
    const swapIdx = direction === "left" ? idx - 1 : idx + 1;

    if (swapIdx < 0 || swapIdx >= allSteps.length) {
      return NextResponse.json({ error: "Cannot move in that direction" }, { status: 400 });
    }

    const current = allSteps[idx];
    const swapStep = allSteps[swapIdx];

    await Promise.all([
      supabase.from("funnel_steps").update({ sort_order: swapStep.sort_order }).eq("id", current.id),
      supabase.from("funnel_steps").update({ sort_order: current.sort_order }).eq("id", swapStep.id),
    ]);

    return NextResponse.json({ success: true });
  }

  // Regular update — extend with public-funnel columns added in the
  // 20260427 ghl_phase2 migration (page_doc, slug, next_step_id).
  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (step_type !== undefined) updates.step_type = step_type;
  if (page_id !== undefined) updates.page_id = page_id;
  if (sort_order !== undefined) updates.sort_order = sort_order;
  if (settings !== undefined) updates.settings = settings;
  if (body.page_doc !== undefined) updates.page_doc = body.page_doc;
  if (body.next_step_id !== undefined) updates.next_step_id = body.next_step_id;
  if (body.slug !== undefined && typeof body.slug === "string") {
    updates.slug = body.slug.toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 64);
  }

  const { data, error } = await supabase
    .from("funnel_steps")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ step: data });
}

// DELETE /api/funnels/steps/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const step = await verifyStepOwnership(supabase, params.id, user.id);
  if (!step) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabase
    .from("funnel_steps")
    .delete()
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
