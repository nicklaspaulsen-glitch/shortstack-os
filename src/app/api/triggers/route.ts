import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// CRUD for workflow triggers — the "when X happens" entry points that kick
// off a workflow. UI at /dashboard/workflows reads/writes through here.
//
//  GET    ?workflow_id=X  — list triggers for a workflow (or all if omitted)
//  POST   { workflow_id, trigger_type, config?, is_active? }
//  PATCH  { id, ...fields }
//  DELETE ?id=X

const VALID_TYPES = [
  "form_submitted",
  "email_opened",
  "email_clicked",
  "email_replied",
  "link_clicked",
  "tag_added",
  "tag_removed",
  "appointment_booked",
  "pipeline_stage_changed",
  "webhook_received",
  "schedule",
  "manual",
];

async function resolveOwner(): Promise<
  | { ownerId: string; service: ReturnType<typeof createServiceClient> }
  | { error: string; status: number }
> {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 };
  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return { error: "Forbidden", status: 403 };
  return { ownerId, service: createServiceClient() };
}

export async function GET(request: NextRequest) {
  const ctx = await resolveOwner();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const workflowId = request.nextUrl.searchParams.get("workflow_id");

  let query = ctx.service
    .from("workflow_triggers")
    .select("*")
    .eq("user_id", ctx.ownerId)
    .order("created_at", { ascending: false });
  if (workflowId) query = query.eq("workflow_id", workflowId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, triggers: data || [] });
}

export async function POST(request: NextRequest) {
  const ctx = await resolveOwner();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const body = await request.json().catch(() => ({}));
  const { workflow_id, trigger_type, config, is_active } = body as {
    workflow_id?: string;
    trigger_type?: string;
    config?: Record<string, unknown>;
    is_active?: boolean;
  };

  if (!workflow_id) return NextResponse.json({ error: "workflow_id required" }, { status: 400 });
  if (!trigger_type || !VALID_TYPES.includes(trigger_type)) {
    return NextResponse.json(
      { error: `trigger_type must be one of: ${VALID_TYPES.join(", ")}` },
      { status: 400 },
    );
  }

  // Verify the caller owns the workflow
  const { data: wf } = await ctx.service
    .from("workflows")
    .select("id, user_id")
    .eq("id", workflow_id)
    .eq("user_id", ctx.ownerId)
    .maybeSingle();
  if (!wf) return NextResponse.json({ error: "Workflow not found or access denied" }, { status: 403 });

  const { data, error } = await ctx.service
    .from("workflow_triggers")
    .insert({
      workflow_id,
      user_id: ctx.ownerId,
      trigger_type,
      config: config || {},
      is_active: is_active !== false,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, trigger: data });
}

export async function PATCH(request: NextRequest) {
  const ctx = await resolveOwner();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const body = await request.json().catch(() => ({}));
  const { id, trigger_type, config, is_active } = body as {
    id?: string;
    trigger_type?: string;
    config?: Record<string, unknown>;
    is_active?: boolean;
  };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (trigger_type && VALID_TYPES.includes(trigger_type)) updates.trigger_type = trigger_type;
  if (config !== undefined) updates.config = config;
  if (is_active !== undefined) updates.is_active = is_active;

  const { data, error } = await ctx.service
    .from("workflow_triggers")
    .update(updates)
    .eq("id", id)
    .eq("user_id", ctx.ownerId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
  return NextResponse.json({ ok: true, trigger: data });
}

export async function DELETE(request: NextRequest) {
  const ctx = await resolveOwner();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await ctx.service
    .from("workflow_triggers")
    .delete()
    .eq("id", id)
    .eq("user_id", ctx.ownerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
