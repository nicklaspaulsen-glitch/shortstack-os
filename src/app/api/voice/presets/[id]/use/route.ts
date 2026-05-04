import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string };
}

/**
 * POST /api/voice/presets/[id]/use
 *
 * "Save to My Voices" — copies a preset's voice parameters into a new
 * user-owned clone row so the user can set surface defaults (dialer,
 * voicemail, SMS, DM) against it.
 *
 * Idempotent: if the caller already has a clone that originated from
 * this preset, the existing clone_id is returned with `already_existed: true`.
 *
 * Response: { clone_id: string; already_existed: boolean }
 */
export async function POST(_request: NextRequest, context: RouteContext) {
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

  const presetId = context.params.id;
  if (!presetId) {
    return NextResponse.json({ error: "Missing preset id" }, { status: 400 });
  }

  const service = createServiceClient();

  // Fetch the preset — must be owner_subject_kind === "preset".
  const { data: preset, error: presetErr } = await service
    .from("voice_clones")
    .select("id, owner_subject_kind, label, description, provider, provider_voice_id, language, status")
    .eq("id", presetId)
    .eq("owner_subject_kind", "preset")
    .maybeSingle();

  if (presetErr) {
    return NextResponse.json({ error: presetErr.message }, { status: 500 });
  }
  if (!preset) {
    return NextResponse.json({ error: "Preset not found" }, { status: 404 });
  }

  // Idempotency — check if the user already saved this preset.
  const { data: existing } = await service
    .from("voice_clones")
    .select("id")
    .eq("agency_owner_id", ownerId)
    .contains("consent_evidence", { source_preset_id: presetId })
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ clone_id: existing.id, already_existed: true });
  }

  // Create a user-owned clone row that inherits the preset's voice parameters.
  // The clone is immediately "ready" — no training step needed since it
  // references the provider voice that the preset already validated.
  const { data: newClone, error: insertErr } = await service
    .from("voice_clones")
    .insert({
      agency_owner_id: ownerId,
      owner_subject_kind: "user",
      label: preset.label,
      description: preset.description,
      provider: preset.provider,
      provider_voice_id: preset.provider_voice_id,
      language: preset.language || "en",
      status: "ready",
      consent_evidence: {
        kind: "preset",
        source_preset_id: presetId,
        saved_at: new Date().toISOString(),
      },
    })
    .select("id")
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ clone_id: newClone.id, already_existed: false });
}
