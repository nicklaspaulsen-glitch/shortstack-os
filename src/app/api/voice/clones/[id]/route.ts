import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabase,
  createServiceClient,
} from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { deleteVoice } from "@/lib/voice/elevenlabs-clone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string };
}

/**
 * GET /api/voice/clones/[id] — full detail row + samples + recent renders.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cloneId = context.params.id;
  if (!cloneId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  // RLS-bound read keeps presets visible (read-everyone) and own clones
  // accessible. Cross-tenant non-preset rows are filtered out by RLS.
  const { data: clone, error } = await supabase
    .from("voice_clones")
    .select("*")
    .eq("id", cloneId)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!clone) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: samples } = await supabase
    .from("voice_clone_samples")
    .select("id, r2_key, mime_type, duration_seconds, transcript, uploaded_at")
    .eq("clone_id", cloneId)
    .order("uploaded_at", { ascending: false });

  const { data: renders } = await supabase
    .from("voice_renders")
    .select("id, text_preview, r2_key, duration_seconds, rendered_at, use_count, context")
    .eq("clone_id", cloneId)
    .order("rendered_at", { ascending: false })
    .limit(50);

  return NextResponse.json({
    clone,
    samples: samples || [],
    renders: renders || [],
  });
}

interface PatchBody {
  label?: string;
  description?: string;
  is_default_for_user?: boolean;
  is_default_for_voicemail?: boolean;
  is_default_for_dialer?: boolean;
  is_default_for_sms?: boolean;
  is_default_for_dm?: boolean;
}

/**
 * PATCH /api/voice/clones/[id] — update label, description, or default flags.
 *
 * When a default flag is set true on this row, we clear it on every other
 * row for the same agency owner so we maintain a single-default invariant.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cloneId = context.params.id;
  if (!cloneId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // RLS-checked existence read first so we don't leak cross-tenant ids.
  const { data: existing } = await supabase
    .from("voice_clones")
    .select("id, agency_owner_id, owner_subject_kind")
    .eq("id", cloneId)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.agency_owner_id !== ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (existing.owner_subject_kind === "preset") {
    return NextResponse.json(
      { error: "Cannot modify preset rows." },
      { status: 400 },
    );
  }

  const update: Record<string, unknown> = {};
  if (typeof body.label === "string") {
    if (!body.label.trim() || body.label.length > 120) {
      return NextResponse.json({ error: "Invalid label" }, { status: 400 });
    }
    update.label = body.label.trim();
  }
  if (typeof body.description === "string") {
    update.description = body.description.slice(0, 500);
  }

  const surfaceFlags: Array<keyof PatchBody> = [
    "is_default_for_user",
    "is_default_for_voicemail",
    "is_default_for_dialer",
    "is_default_for_sms",
    "is_default_for_dm",
  ];
  const service = createServiceClient();

  // Clear sibling defaults so only this row holds the flag.
  for (const flag of surfaceFlags) {
    if (typeof body[flag] === "boolean") {
      update[flag] = body[flag];
      if (body[flag] === true) {
        await service
          .from("voice_clones")
          .update({ [flag]: false })
          .eq("agency_owner_id", ownerId)
          .neq("id", cloneId);
      }
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true, no_changes: true });
  }

  const { error: updErr } = await service
    .from("voice_clones")
    .update(update)
    .eq("id", cloneId)
    .eq("agency_owner_id", ownerId);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/voice/clones/[id] — delete the clone (cascades samples + renders).
 *
 * Also fires a best-effort delete against the provider (ElevenLabs only —
 * RunPod fingerprints are stateless so there's nothing to clean up there).
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cloneId = context.params.id;
  if (!cloneId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: existing } = await service
    .from("voice_clones")
    .select("provider, provider_voice_id, owner_subject_kind, agency_owner_id")
    .eq("id", cloneId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.agency_owner_id !== ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (existing.owner_subject_kind === "preset") {
    return NextResponse.json(
      { error: "Cannot delete preset rows." },
      { status: 400 },
    );
  }

  // Fire-and-forget provider-side deletion. Errors are logged and swallowed.
  if (existing.provider === "elevenlabs" && existing.provider_voice_id) {
    deleteVoice(existing.provider_voice_id).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : "unknown";
      console.warn(
        `[voice/clones DELETE] elevenlabs deleteVoice failed: ${msg}`,
      );
    });
  }

  const { error: delErr } = await service
    .from("voice_clones")
    .delete()
    .eq("id", cloneId)
    .eq("agency_owner_id", ownerId);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
