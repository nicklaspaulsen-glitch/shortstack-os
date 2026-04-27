/**
 * Voice Studio preset library — 10 curated voices keyed to ElevenLabs'
 * publicly-available pre-built voices. These ship with the API (no consent
 * issues — ElevenLabs has the rights), so we expose them as system presets
 * every agency can use without uploading their own samples.
 *
 * IDs are the canonical ElevenLabs voice IDs — these are stable across the
 * Eleven v2/v3 API surfaces and have been the same for ~2 years. If they
 * ever rotate, /api/voice/presets/seed re-syncs the table with whatever IDs
 * we declare here.
 *
 * Reference: https://elevenlabs.io/docs/api-reference/voices/get-shared
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface VoicePreset {
  /** Stable preset slug used as `voice_clones.provider_voice_id` row key. */
  slug: string;
  /** Human label shown in the UI. */
  label: string;
  /** Marketing description — explains when to pick this voice. */
  description: string;
  /** Category chip on the preset card. */
  category:
    | "warm"
    | "authoritative"
    | "youthful"
    | "narrator"
    | "casual"
    | "british";
  /** ElevenLabs canonical voice_id. */
  elevenLabsVoiceId: string;
  /** Default language hint. ElevenLabs auto-detects but we surface it. */
  language: string;
}

export const PRESETS: ReadonlyArray<VoicePreset> = [
  {
    slug: "preset_warm_friendly",
    label: "Preset: Warm & friendly (Aria)",
    description:
      "Calm, approachable American female. Ideal for nurture sequences and check-in voicemails.",
    category: "warm",
    elevenLabsVoiceId: "9BWtsMINqrJLrRacOk9x",
    language: "en",
  },
  {
    slug: "preset_authoritative",
    label: "Preset: Authoritative (Roger)",
    description:
      "Confident, executive American male. Best for closing calls and decision-maker outreach.",
    category: "authoritative",
    elevenLabsVoiceId: "CwhRBWXzGAHq8TQ4Fs17",
    language: "en",
  },
  {
    slug: "preset_youthful_energetic",
    label: "Preset: Youthful & energetic (Sarah)",
    description:
      "High-energy American female. Top-of-funnel cold calls and Gen Z DMs.",
    category: "youthful",
    elevenLabsVoiceId: "EXAVITQu4vr4xnSDxMaL",
    language: "en",
  },
  {
    slug: "preset_narrator_deep",
    label: "Preset: Narrator (Adam)",
    description:
      "Deep, smooth American male — documentary narrator energy. Use for explainer voicemails.",
    category: "narrator",
    elevenLabsVoiceId: "pNInz6obpgDQGcFmaJgB",
    language: "en",
  },
  {
    slug: "preset_natural_male",
    label: "Preset: Natural male (Antoni)",
    description:
      "Approachable American male. Sounds like a friend leaving a quick voice note.",
    category: "casual",
    elevenLabsVoiceId: "ErXwobaYiN019PkySvjV",
    language: "en",
  },
  {
    slug: "preset_british_female",
    label: "Preset: British female (Charlotte)",
    description:
      "Composed British female. Professional, premium feel for high-ticket service offers.",
    category: "british",
    elevenLabsVoiceId: "XB0fDUnXU5powFXDhCwa",
    language: "en",
  },
  {
    slug: "preset_british_male",
    label: "Preset: British male (Daniel)",
    description:
      "Authoritative British male — newsreader energy. Use for premium B2B outreach.",
    category: "british",
    elevenLabsVoiceId: "onwK4e9ZLuTAKqWW03F9",
    language: "en",
  },
  {
    slug: "preset_warm_male",
    label: "Preset: Warm male (Josh)",
    description:
      "Calm American male. Solid default for check-ins and friendly follow-ups.",
    category: "warm",
    elevenLabsVoiceId: "TxGEqnHWrfWFTfGW9XjX",
    language: "en",
  },
  {
    slug: "preset_youthful_female",
    label: "Preset: Youthful female (Bella)",
    description:
      "Lively American female. Great for SMS voice notes and consumer-facing brands.",
    category: "youthful",
    elevenLabsVoiceId: "EXAVITQu4vr4xnSDxMaL",
    language: "en",
  },
  {
    slug: "preset_narrator_clear",
    label: "Preset: Narrator clear (Rachel)",
    description:
      "Crisp American female. Reads numbers and proper nouns cleanly — best for stat-heavy voicemails.",
    category: "narrator",
    elevenLabsVoiceId: "21m00Tcm4TlvDq8ikWAM",
    language: "en",
  },
];

/**
 * Idempotent preset seeder. Called from `/api/voice/presets/seed` (admin) and
 * lazily from the dashboard mount when no preset rows exist yet for the
 * current agency owner.
 *
 * Presets are stored as voice_clones rows with owner_subject_kind='preset'.
 * Every agency owner gets their own copy of the preset row so RLS keeps
 * SELECT/UPDATE policies straightforward — the read-everyone RLS policy
 * surfaces them all to other tenants without leaking ownership semantics.
 *
 * Re-runs are safe: we look up by (agency_owner_id, provider_voice_id) and
 * skip rows that already exist.
 */
export async function ensurePresetsSeeded(
  service: SupabaseClient,
  agencyOwnerId: string,
): Promise<{ inserted: number; existing: number }> {
  let inserted = 0;
  let existing = 0;

  for (const preset of PRESETS) {
    const { data: row } = await service
      .from("voice_clones")
      .select("id")
      .eq("agency_owner_id", agencyOwnerId)
      .eq("owner_subject_kind", "preset")
      .eq("provider_voice_id", preset.slug)
      .maybeSingle();

    if (row) {
      existing += 1;
      continue;
    }

    const { error } = await service.from("voice_clones").insert({
      agency_owner_id: agencyOwnerId,
      owner_subject_kind: "preset",
      owner_subject_id: null,
      label: preset.label,
      description: preset.description,
      provider: "preset",
      provider_voice_id: preset.slug,
      status: "ready",
      language: preset.language,
      consent_kind: "preset",
      consent_evidence: {
        source: "elevenlabs_public_voice",
        elevenlabs_voice_id: preset.elevenLabsVoiceId,
        category: preset.category,
      },
      ready_at: new Date().toISOString(),
    });

    if (!error) {
      inserted += 1;
    } else {
      // Log + continue — one preset failing should not block the others.
      console.error(
        `[voice/preset-library] seed failed for ${preset.slug}:`,
        error.message,
      );
    }
  }

  return { inserted, existing };
}

/**
 * Resolve the underlying ElevenLabs voice id for a preset slug. Returns null
 * if the slug isn't in the curated list (caller should fall back gracefully).
 */
export function elevenLabsVoiceIdFromPresetSlug(slug: string): string | null {
  const preset = PRESETS.find((p) => p.slug === slug);
  return preset?.elevenLabsVoiceId ?? null;
}
