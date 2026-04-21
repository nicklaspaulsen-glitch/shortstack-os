import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// Native sequences list + create. Replaces the in-memory store the UI used
// before the Apr 21 GHL migration finished.

interface StepInput {
  step_order?: number;
  delay_days?: number;
  channel?: string;
  template_body?: string | null;
  template_subject?: string | null;
}

interface CreateInput {
  name?: string;
  description?: string | null;
  is_active?: boolean;
  steps?: StepInput[];
}

const VALID_CHANNELS = new Set(["email", "sms", "call", "dm", "wait"]);

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: sequences, error } = await supabase
    .from("sequences")
    .select("id, name, description, is_active, created_at, updated_at")
    .eq("profile_id", ownerId)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (sequences || []).map(s => s.id);
  let stepsByParent: Record<string, number> = {};
  let enrolledByParent: Record<string, number> = {};
  if (ids.length > 0) {
    const [{ data: steps }, { data: enrollments }] = await Promise.all([
      supabase.from("sequence_steps").select("sequence_id").in("sequence_id", ids),
      supabase.from("sequence_enrollments").select("sequence_id, status").in("sequence_id", ids),
    ]);
    stepsByParent = (steps || []).reduce<Record<string, number>>((acc, s) => {
      acc[s.sequence_id] = (acc[s.sequence_id] || 0) + 1;
      return acc;
    }, {});
    enrolledByParent = (enrollments || []).reduce<Record<string, number>>((acc, e) => {
      acc[e.sequence_id] = (acc[e.sequence_id] || 0) + 1;
      return acc;
    }, {});
  }

  const enriched = (sequences || []).map(s => ({
    ...s,
    step_count: stepsByParent[s.id] || 0,
    enrolled_count: enrolledByParent[s.id] || 0,
  }));

  return NextResponse.json({ sequences: enriched });
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
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  // Validate steps up front — any bad channel rejects the whole create.
  // Classic index loop rather than Array.prototype.entries() — tsc's
  // default target doesn't enable downlevel iteration for ArrayIterator.
  const incomingSteps = Array.isArray(body.steps) ? body.steps : [];
  for (let i = 0; i < incomingSteps.length; i++) {
    const s = incomingSteps[i];
    if (!s.channel || !VALID_CHANNELS.has(s.channel)) {
      return NextResponse.json(
        { error: `steps[${i}].channel must be one of email|sms|call|dm|wait` },
        { status: 400 },
      );
    }
  }

  const { data: seq, error } = await supabase
    .from("sequences")
    .insert({
      profile_id: ownerId,
      name,
      description: body.description ?? null,
      is_active: body.is_active !== false,
    })
    .select("id, name, description, is_active, created_at, updated_at")
    .single();

  if (error || !seq) {
    return NextResponse.json({ error: error?.message || "Failed to create sequence" }, { status: 500 });
  }

  if (incomingSteps.length > 0) {
    const rows = incomingSteps.map((s, i) => ({
      sequence_id: seq.id,
      step_order: typeof s.step_order === "number" ? s.step_order : i,
      delay_days: Math.max(0, Number(s.delay_days) || 0),
      channel: s.channel!,
      template_body: s.template_body ?? null,
      template_subject: s.template_subject ?? null,
    }));
    const { error: stepErr } = await supabase.from("sequence_steps").insert(rows);
    if (stepErr) {
      // Roll back the parent sequence — failed step insert leaves nothing behind.
      await supabase.from("sequences").delete().eq("id", seq.id);
      return NextResponse.json({ error: stepErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ sequence: seq });
}
