import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { SCORING_CONFIG } from "@/lib/leads/scoring";

interface ScoringConfigPatch {
  weights?: Partial<typeof SCORING_CONFIG.weights>;
  caps?: Partial<typeof SCORING_CONFIG.caps>;
  thresholds?: Partial<typeof SCORING_CONFIG.thresholds>;
}

/**
 * GET /api/leads/scoring-config
 *
 * Returns the active scoring config for the caller's agency:
 *  - the system defaults (immutable)
 *  - the override stored in profiles.metadata.scoring_config (if any)
 *  - the merged effective config the engine will use
 *
 * v1: write path stores in profiles.metadata so we don't need a new table.
 */
export async function GET(): Promise<NextResponse> {
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("metadata")
    .eq("id", ownerId)
    .single();

  const metadata =
    (profile?.metadata as { scoring_config?: ScoringConfigPatch } | null) ??
    null;
  const override = metadata?.scoring_config ?? null;

  return NextResponse.json({
    defaults: SCORING_CONFIG,
    override,
    effective: mergeConfig(SCORING_CONFIG, override),
  });
}

/**
 * PATCH /api/leads/scoring-config
 *
 * Stores a partial override under `profiles.metadata.scoring_config`. Only the
 * agency owner can write. v1 simply persists — the engine still reads the
 * baked-in defaults (deferred: load overrides at compute time).
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId || ownerId !== user.id) {
    return NextResponse.json(
      { error: "Only the agency owner can edit scoring config" },
      { status: 403 },
    );
  }

  let patch: ScoringConfigPatch;
  try {
    patch = (await request.json()) as ScoringConfigPatch;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Light validation — anything we don't recognize is dropped.
  const cleanPatch: ScoringConfigPatch = {};
  if (patch.weights && typeof patch.weights === "object") {
    cleanPatch.weights = filterNumeric(
      patch.weights,
      Object.keys(SCORING_CONFIG.weights),
    ) as Partial<typeof SCORING_CONFIG.weights>;
  }
  if (patch.caps && typeof patch.caps === "object") {
    cleanPatch.caps = filterNumeric(
      patch.caps,
      Object.keys(SCORING_CONFIG.caps),
    ) as Partial<typeof SCORING_CONFIG.caps>;
  }
  if (patch.thresholds && typeof patch.thresholds === "object") {
    cleanPatch.thresholds = filterNumeric(
      patch.thresholds,
      Object.keys(SCORING_CONFIG.thresholds),
    ) as Partial<typeof SCORING_CONFIG.thresholds>;
  }

  const { data: existing } = await supabase
    .from("profiles")
    .select("metadata")
    .eq("id", ownerId)
    .single();

  const metadata =
    (existing?.metadata as Record<string, unknown> | null) ?? {};
  const nextMetadata = {
    ...metadata,
    scoring_config: cleanPatch,
  };

  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ metadata: nextMetadata })
    .eq("id", ownerId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    override: cleanPatch,
    effective: mergeConfig(SCORING_CONFIG, cleanPatch),
  });
}

function filterNumeric(
  src: Record<string, unknown>,
  allowedKeys: string[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of allowedKeys) {
    const v = src[k];
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

function mergeConfig(
  base: typeof SCORING_CONFIG,
  override: ScoringConfigPatch | null,
) {
  if (!override) return base;
  return {
    ...base,
    weights: { ...base.weights, ...(override.weights ?? {}) },
    caps: { ...base.caps, ...(override.caps ?? {}) },
    thresholds: { ...base.thresholds, ...(override.thresholds ?? {}) },
  };
}
