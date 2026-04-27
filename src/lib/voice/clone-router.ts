/**
 * Voice cloning router — provider-agnostic API for the voice-studio surface.
 *
 * Three responsibilities:
 *   1. trainClone     — accepts samples, dispatches to provider, writes
 *                       voice_clones row.
 *   2. synthesize     — text + clone_id → R2 audio URL with caching.
 *   3. getDefaultClone — surface-specific default (dialer/voicemail/sms/dm).
 *
 * Provider selection (auto):
 *   1. Whatever provider is requested explicitly via `opts.provider`
 *   2. F5-TTS    (best zero-shot quality, free on user's RunPod)
 *   3. OpenVoice (free fallback)
 *   4. XTTS      (free, last-resort)
 *   5. ElevenLabs (premium, paid)
 *
 * The router is provider-agnostic at the call site — callers pass cloneId,
 * we look up the provider on the row.
 */

import crypto from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import {
  uploadToR2,
  r2PublicUrlFor,
} from "@/lib/server/r2-client";
import {
  createInstantVoice,
  synthesizeWithVoice,
  isElevenLabsConfigured,
} from "./elevenlabs-clone";
import {
  submitCloneTrain,
  synthesizeWithClone,
  getAvailableRunPodCloneProviders,
  type RunPodCloneProvider,
} from "./runpod-clone";
import {
  PRESETS,
  elevenLabsVoiceIdFromPresetSlug,
} from "./preset-library";

export type CloneProvider =
  | "runpod_f5tts"
  | "runpod_xtts"
  | "runpod_openvoice"
  | "elevenlabs"
  | "preset";

export type ConsentKind =
  | "self"
  | "client_signed"
  | "team_member_signed"
  | "preset";

export type DefaultSurface = "dialer" | "voicemail" | "sms" | "dm";

export interface VoiceCloneRow {
  id: string;
  agency_owner_id: string;
  owner_subject_kind: "user" | "team_member" | "client" | "preset";
  owner_subject_id: string | null;
  label: string;
  description: string | null;
  provider: CloneProvider;
  provider_voice_id: string | null;
  status: "training" | "ready" | "failed";
  language: string;
  consent_kind: ConsentKind;
  consent_evidence: Record<string, unknown>;
  is_default_for_user: boolean;
  is_default_for_voicemail: boolean;
  is_default_for_dialer: boolean;
  is_default_for_sms: boolean;
  is_default_for_dm: boolean;
  created_at: string;
  ready_at: string | null;
  failed_reason: string | null;
}

export interface TrainCloneOptions {
  agencyOwnerId: string;
  label: string;
  description?: string;
  consentKind: Exclude<ConsentKind, "preset">;
  consentEvidence?: Record<string, unknown>;
  ownerSubject?: {
    kind: "user" | "team_member" | "client";
    id: string;
  };
  language?: string;
  /** R2 keys (already uploaded) for the voice samples. */
  sampleR2Keys: string[];
  /**
   * Original audio buffers (only required when targetting ElevenLabs since
   * its API needs the bytes inline). When omitted we fall back to RunPod —
   * if no RunPod endpoint is configured the call fails with a clear error.
   */
  sampleBuffers?: Array<{
    buffer: Buffer;
    filename: string;
    contentType: string;
  }>;
  /** Force a specific provider; default is auto-pick. */
  provider?: Exclude<CloneProvider, "preset">;
}

export interface CloneTrainResult {
  cloneId: string;
  provider: CloneProvider;
  status: "training" | "ready" | "failed";
  providerVoiceId: string | null;
  failedReason?: string;
}

/**
 * Auto-select the best available cloning provider. Free providers preferred
 * (F5-TTS → OpenVoice → XTTS), paid (ElevenLabs) as last resort.
 */
function pickAutoProvider(): Exclude<CloneProvider, "preset"> | null {
  const runpodAvail = getAvailableRunPodCloneProviders();
  if (runpodAvail.length > 0) return runpodAvail[0];
  if (isElevenLabsConfigured()) return "elevenlabs";
  return null;
}

/**
 * Validate consent payload. Throws on missing required fields.
 */
function validateConsent(
  consentKind: TrainCloneOptions["consentKind"],
  consentEvidence: Record<string, unknown> | undefined,
): void {
  if (consentKind === "self") return;
  if (consentKind === "client_signed" || consentKind === "team_member_signed") {
    if (!consentEvidence || Object.keys(consentEvidence).length === 0) {
      throw new Error(
        `consent_kind=${consentKind} requires consent_evidence (signed_by, signed_at, ip).`,
      );
    }
    const required = ["signed_by", "signed_at"];
    for (const key of required) {
      if (!consentEvidence[key]) {
        throw new Error(
          `consent_evidence missing '${key}' for consent_kind=${consentKind}.`,
        );
      }
    }
  }
}

/**
 * Train a voice clone from one or more samples. Dispatches to the chosen
 * provider, persists a voice_clones row, returns the new id + status.
 *
 * Synchronous-ish — ElevenLabs returns voice_id immediately, F5-TTS often
 * returns within /runsync, and slower providers fall back to status='training'
 * with the cron polling completion.
 */
export async function trainClone(
  opts: TrainCloneOptions,
): Promise<CloneTrainResult> {
  validateConsent(opts.consentKind, opts.consentEvidence);

  const provider = opts.provider || pickAutoProvider();
  if (!provider) {
    throw new Error(
      "No cloning provider configured. Set RUNPOD_F5TTS_ENDPOINT (or OPENVOICE/XTTS) for free path, or ELEVENLABS_API_KEY for paid path. See docs/VOICE_CLONING_SETUP.md.",
    );
  }

  const service = createServiceClient();
  const language = opts.language || "en";
  const insertPayload = {
    agency_owner_id: opts.agencyOwnerId,
    owner_subject_kind: opts.ownerSubject?.kind || "user",
    owner_subject_id: opts.ownerSubject?.id || null,
    label: opts.label,
    description: opts.description || null,
    provider,
    provider_voice_id: null as string | null,
    status: "training" as const,
    language,
    consent_kind: opts.consentKind,
    consent_evidence: opts.consentEvidence || {},
  };

  const { data: cloneRow, error: insertErr } = await service
    .from("voice_clones")
    .insert(insertPayload)
    .select("id")
    .single();

  if (insertErr || !cloneRow) {
    throw new Error(
      `Failed to insert voice_clones row: ${insertErr?.message || "unknown"}`,
    );
  }

  const cloneId = cloneRow.id as string;

  // Persist sample-list rows up-front (regardless of provider) so the
  // dashboard can show what we tried to train on.
  if (opts.sampleR2Keys.length > 0) {
    const sampleRows = opts.sampleR2Keys.map((r2_key) => ({
      clone_id: cloneId,
      agency_owner_id: opts.agencyOwnerId,
      r2_key,
      mime_type: "audio/mpeg",
    }));
    await service.from("voice_clone_samples").insert(sampleRows);
  }

  // Dispatch to provider.
  if (provider === "elevenlabs") {
    if (!opts.sampleBuffers || opts.sampleBuffers.length === 0) {
      await markFailed(cloneId, "elevenlabs requires inline sample buffers");
      return {
        cloneId,
        provider,
        status: "failed",
        providerVoiceId: null,
        failedReason: "elevenlabs requires inline sample buffers",
      };
    }
    try {
      const result = await createInstantVoice(
        opts.sampleBuffers,
        opts.label,
        opts.description,
      );
      await service
        .from("voice_clones")
        .update({
          provider_voice_id: result.voiceId,
          status: "ready",
          ready_at: new Date().toISOString(),
        })
        .eq("id", cloneId);
      return {
        cloneId,
        provider,
        status: "ready",
        providerVoiceId: result.voiceId,
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown_error";
      await markFailed(cloneId, reason);
      return {
        cloneId,
        provider,
        status: "failed",
        providerVoiceId: null,
        failedReason: reason,
      };
    }
  }

  // RunPod path — F5-TTS / OpenVoice / XTTS
  try {
    const result = await submitCloneTrain({
      provider: provider as RunPodCloneProvider,
      sampleR2Keys: opts.sampleR2Keys,
      language,
      label: opts.label,
    });

    if (result.status === "failed") {
      await markFailed(cloneId, result.failedReason || "runpod_failed");
      return {
        cloneId,
        provider,
        status: "failed",
        providerVoiceId: null,
        failedReason: result.failedReason,
      };
    }

    const fingerprint = result.fingerprint || result.jobId;
    const update: Record<string, unknown> = {
      provider_voice_id: fingerprint,
    };
    if (result.status === "ready") {
      update.status = "ready";
      update.ready_at = new Date().toISOString();
    }
    await service.from("voice_clones").update(update).eq("id", cloneId);

    return {
      cloneId,
      provider,
      status: result.status,
      providerVoiceId: fingerprint,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown_error";
    await markFailed(cloneId, reason);
    return {
      cloneId,
      provider,
      status: "failed",
      providerVoiceId: null,
      failedReason: reason,
    };
  }
}

async function markFailed(cloneId: string, reason: string): Promise<void> {
  const service = createServiceClient();
  await service
    .from("voice_clones")
    .update({
      status: "failed",
      failed_reason: reason,
    })
    .eq("id", cloneId);
}

export interface SynthesizeOptions {
  cloneId: string;
  text: string;
  agencyOwnerId: string;
  format?: "mp3" | "wav";
  speed?: number;
  /** Default true — disable to force a fresh render. */
  cache?: boolean;
  /** Telemetry label (dialer / voicemail / sms_voice / dm_voice / preview). */
  context?: string;
}

export interface SynthesizeResult {
  /** Public CDN URL (R2). */
  r2Url: string;
  /** R2 key (storage path). */
  r2Key: string;
  durationSeconds: number;
  cached: boolean;
}

/**
 * Synthesize speech from a clone. Cached by hash of (text, format, speed)
 * — repeated requests reuse the same R2 object.
 */
export async function synthesize(
  opts: SynthesizeOptions,
): Promise<SynthesizeResult> {
  const service = createServiceClient();
  const text = opts.text.trim();
  if (!text) throw new Error("synthesize: empty text");

  // Look up the clone row.
  const { data: clone, error: loadErr } = await service
    .from("voice_clones")
    .select("*")
    .eq("id", opts.cloneId)
    .maybeSingle();
  if (loadErr || !clone) {
    throw new Error(`Clone ${opts.cloneId} not found.`);
  }
  if (clone.status !== "ready") {
    throw new Error(
      `Clone ${opts.cloneId} status=${clone.status}, not ready for synthesis.`,
    );
  }

  const format = opts.format || "mp3";
  const speed = opts.speed ?? 1.0;
  const textHash = hashText(text, format, speed);

  // Cache lookup.
  if (opts.cache !== false) {
    const { data: cached } = await service
      .from("voice_renders")
      .select("r2_key, duration_seconds")
      .eq("clone_id", opts.cloneId)
      .eq("text_hash", textHash)
      .maybeSingle();
    if (cached?.r2_key) {
      // Bump use_count (best-effort).
      await service
        .from("voice_renders")
        .update({ use_count: 1 })
        .eq("clone_id", opts.cloneId)
        .eq("text_hash", textHash);
      return {
        r2Url: r2PublicUrlFor(cached.r2_key),
        r2Key: cached.r2_key,
        durationSeconds: Number(cached.duration_seconds || 0),
        cached: true,
      };
    }
  }

  // Render.
  const cloneRow = clone as VoiceCloneRow;
  const rendered = await renderClone(cloneRow, text, format, speed);

  // Upload to R2.
  const r2Key = `voice-renders/${cloneRow.agency_owner_id}/${cloneRow.id}/${textHash}.${format}`;
  await uploadToR2(r2Key, rendered.audio, rendered.contentType);

  // Persist cache row. Use upsert via insert with ON CONFLICT semantics
  // (UNIQUE constraint on (clone_id, text_hash) will kick in if a parallel
  // request beat us to it; we tolerate either outcome).
  await service.from("voice_renders").upsert(
    {
      agency_owner_id: cloneRow.agency_owner_id,
      clone_id: cloneRow.id,
      text_hash: textHash,
      text_preview: text.slice(0, 240),
      r2_key: r2Key,
      duration_seconds: rendered.durationSeconds || null,
      use_count: 1,
      context: opts.context || null,
    },
    { onConflict: "clone_id,text_hash" },
  );

  return {
    r2Url: r2PublicUrlFor(r2Key),
    r2Key,
    durationSeconds: rendered.durationSeconds || 0,
    cached: false,
  };
}

interface RenderResult {
  audio: Buffer;
  contentType: string;
  durationSeconds?: number;
}

async function renderClone(
  clone: VoiceCloneRow,
  text: string,
  format: "mp3" | "wav",
  speed: number,
): Promise<RenderResult> {
  // Preset → ElevenLabs synth with the preset's voice id.
  if (clone.provider === "preset") {
    const slug = clone.provider_voice_id;
    if (!slug) throw new Error("Preset clone missing provider_voice_id");
    const elevenId = elevenLabsVoiceIdFromPresetSlug(slug);
    if (!elevenId) {
      throw new Error(`Preset ${slug} not in PRESETS catalog.`);
    }
    if (!isElevenLabsConfigured()) {
      throw new Error(
        "Preset playback requires ELEVENLABS_API_KEY (presets are ElevenLabs voices).",
      );
    }
    const result = await synthesizeWithVoice({
      voiceId: elevenId,
      text,
      outputFormat: format === "wav" ? "pcm_44100" : "mp3_44100_128",
    });
    return {
      audio: result.audio,
      contentType: result.contentType,
    };
  }

  // ElevenLabs cloned voice → use stored voice_id.
  if (clone.provider === "elevenlabs") {
    if (!clone.provider_voice_id) {
      throw new Error("ElevenLabs clone missing provider_voice_id");
    }
    const result = await synthesizeWithVoice({
      voiceId: clone.provider_voice_id,
      text,
      outputFormat: format === "wav" ? "pcm_44100" : "mp3_44100_128",
    });
    return {
      audio: result.audio,
      contentType: result.contentType,
    };
  }

  // RunPod-backed clones.
  if (
    clone.provider === "runpod_f5tts" ||
    clone.provider === "runpod_xtts" ||
    clone.provider === "runpod_openvoice"
  ) {
    if (!clone.provider_voice_id) {
      throw new Error(`${clone.provider} clone missing provider_voice_id`);
    }
    const out = await synthesizeWithClone({
      provider: clone.provider,
      fingerprint: clone.provider_voice_id,
      text,
      language: clone.language,
      speed,
    });
    return {
      audio: out.audio,
      contentType: out.contentType,
      durationSeconds: out.durationSeconds,
    };
  }

  throw new Error(`Unknown clone provider: ${clone.provider}`);
}

function hashText(text: string, format: string, speed: number): string {
  return crypto
    .createHash("sha256")
    .update(`${format}|${speed}|${text}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Resolve the user's default clone for a given delivery surface. Falls back
 * to any preset if the user hasn't configured a personal default.
 */
export async function getDefaultClone(opts: {
  agencyOwnerId: string;
  surface: DefaultSurface;
}): Promise<VoiceCloneRow | null> {
  const service = createServiceClient();
  const column = `is_default_for_${opts.surface}`;

  // First — look up an explicit default for this surface.
  const { data: defaultRow } = await service
    .from("voice_clones")
    .select("*")
    .eq("agency_owner_id", opts.agencyOwnerId)
    .eq("status", "ready")
    .eq(column, true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (defaultRow) return defaultRow as VoiceCloneRow;

  // Fall back to is_default_for_user.
  const { data: anyDefault } = await service
    .from("voice_clones")
    .select("*")
    .eq("agency_owner_id", opts.agencyOwnerId)
    .eq("status", "ready")
    .eq("is_default_for_user", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (anyDefault) return anyDefault as VoiceCloneRow;

  // Fall back to first preset available to this owner. Presets are seeded
  // per-owner so there should always be one once the dashboard has been
  // visited at least once.
  const { data: preset } = await service
    .from("voice_clones")
    .select("*")
    .eq("agency_owner_id", opts.agencyOwnerId)
    .eq("owner_subject_kind", "preset")
    .eq("status", "ready")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (preset as VoiceCloneRow | null) || null;
}

/** Re-export presets so consumers don't have to import two modules. */
export { PRESETS };
