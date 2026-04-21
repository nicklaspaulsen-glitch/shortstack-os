import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// Bulk step management for a single sequence. POST replaces all steps —
// callers send the full ordered list of steps. DELETE clears all steps.
// GET returns the ordered step list.

const VALID_CHANNELS = new Set(["email", "sms", "call", "dm", "wait"]);

interface StepInput {
  step_order?: number;
  delay_days?: number;
  channel?: string;
  template_body?: string | null;
  template_subject?: string | null;
}

interface PostBody {
  steps?: StepInput[];
}

async function verifyOwnership(
  supabase: ReturnType<typeof createServerSupabase>,
  sequenceId: string,
  ownerId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("sequences")
    .select("id")
    .eq("id", sequenceId)
    .eq("profile_id", ownerId)
    .single();
  return Boolean(data);
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!(await verifyOwnership(supabase, params.id, ownerId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: steps, error } = await supabase
    .from("sequence_steps")
    .select("id, step_order, delay_days, channel, template_body, template_subject, created_at")
    .eq("sequence_id", params.id)
    .order("step_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ steps: steps || [] });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!(await verifyOwnership(supabase, params.id, ownerId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const incoming = Array.isArray(body.steps) ? body.steps : [];
  for (const [i, s] of incoming.entries()) {
    if (!s.channel || !VALID_CHANNELS.has(s.channel)) {
      return NextResponse.json(
        { error: `steps[${i}].channel must be one of email|sms|call|dm|wait` },
        { status: 400 },
      );
    }
  }

  // Bulk POST is a replace — wipe existing steps, insert new ones in order.
  const { error: delErr } = await supabase
    .from("sequence_steps")
    .delete()
    .eq("sequence_id", params.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  if (incoming.length === 0) {
    return NextResponse.json({ steps: [] });
  }

  const rows = incoming.map((s, i) => ({
    sequence_id: params.id,
    step_order: typeof s.step_order === "number" ? s.step_order : i,
    delay_days: Math.max(0, Number(s.delay_days) || 0),
    channel: s.channel!,
    template_body: s.template_body ?? null,
    template_subject: s.template_subject ?? null,
  }));

  const { data: inserted, error: insErr } = await supabase
    .from("sequence_steps")
    .insert(rows)
    .select("id, step_order, delay_days, channel, template_body, template_subject");

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  return NextResponse.json({ steps: inserted || [] });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!(await verifyOwnership(supabase, params.id, ownerId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("sequence_steps")
    .delete()
    .eq("sequence_id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
