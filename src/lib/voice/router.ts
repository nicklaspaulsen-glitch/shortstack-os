import { runpodXttsProvider } from "./providers/runpod-xtts";
import { elevenLabsProvider } from "./providers/elevenlabs";
import { openaiTtsProvider } from "./providers/openai-tts";
import {
  type VoiceProvider,
  type VoiceProviderImpl,
  type VoiceSynthRequest,
  type VoiceSynthResponse,
  VoiceProviderError,
} from "./provider";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Voice provider router — picks the cheapest available provider for free
 * synthesis and falls through to ElevenLabs / OpenAI TTS when the user has
 * opted into premium voices or RunPod is unavailable.
 *
 * Defaults (no env override):
 *   1. runpod_xtts  (free)
 *   2. openai_tts   (cheap, reliable)
 *   3. elevenlabs   (premium, paid)
 *
 * Premium opt-in (`opts.premium === true`):
 *   1. elevenlabs   (best quality)
 *   2. openai_tts
 *   3. runpod_xtts
 *
 * Override via env:
 *   VOICE_PROVIDER_DEFAULT  — `runpod_xtts` | `openai_tts` | `elevenlabs`
 *   VOICE_PROVIDER_PREMIUM  — provider used when premium=true (default `elevenlabs`)
 *   TRINITY_TTS_PROVIDER    — legacy alias preserved for the existing
 *                             /api/tts/speak debug + force-provider flow.
 */

const PROVIDERS: Record<VoiceProvider, VoiceProviderImpl> = {
  runpod_xtts: runpodXttsProvider,
  elevenlabs: elevenLabsProvider,
  openai_tts: openaiTtsProvider,
};

export interface VoiceRouterOptions {
  /** Force a specific provider as the first attempt. */
  prefer?: VoiceProvider;
  /** When true, prefer the premium provider (ElevenLabs by default). */
  premium?: boolean;
}

function resolveDefault(): VoiceProvider {
  const fromEnv =
    process.env.VOICE_PROVIDER_DEFAULT ||
    // Legacy alias used by /api/tts/speak/route.ts. Prefer the new name.
    (process.env.TRINITY_TTS_PROVIDER === "xtts"
      ? "runpod_xtts"
      : process.env.TRINITY_TTS_PROVIDER === "openai"
        ? "openai_tts"
        : process.env.TRINITY_TTS_PROVIDER === "elevenlabs"
          ? "elevenlabs"
          : undefined);
  if (
    fromEnv === "runpod_xtts" ||
    fromEnv === "openai_tts" ||
    fromEnv === "elevenlabs"
  ) {
    return fromEnv;
  }
  return "runpod_xtts";
}

function resolvePremium(): VoiceProvider {
  const fromEnv = process.env.VOICE_PROVIDER_PREMIUM;
  if (
    fromEnv === "runpod_xtts" ||
    fromEnv === "openai_tts" ||
    fromEnv === "elevenlabs"
  ) {
    return fromEnv;
  }
  return "elevenlabs";
}

function buildPriorityList(opts?: VoiceRouterOptions): VoiceProvider[] {
  const seen = new Set<VoiceProvider>();
  const order: VoiceProvider[] = [];

  const push = (p: VoiceProvider | undefined) => {
    if (!p) return;
    if (seen.has(p)) return;
    seen.add(p);
    order.push(p);
  };

  if (opts?.prefer) {
    push(opts.prefer);
  }

  if (opts?.premium) {
    push(resolvePremium());
    push("openai_tts");
    push("runpod_xtts");
  } else {
    push(resolveDefault());
    push("openai_tts");
    push("elevenlabs");
  }

  // Always include every provider as a final fallback so a misconfigured
  // priority order still tries every option before failing.
  push("runpod_xtts");
  push("openai_tts");
  push("elevenlabs");

  return order;
}

/**
 * Pick the first available provider in priority order. Throws if no provider
 * is configured.
 */
export function getVoiceProvider(opts?: VoiceRouterOptions): VoiceProviderImpl {
  const order = buildPriorityList(opts);
  for (const name of order) {
    const provider = PROVIDERS[name];
    if (provider.available()) return provider;
  }
  throw new Error(
    "No voice provider configured. Set RUNPOD_XTTS_URL, OPENAI_API_KEY, or ELEVENLABS_API_KEY.",
  );
}

interface SynthesisAttempt {
  provider: VoiceProvider;
  reason: string;
}

/**
 * Synthesize speech with automatic fall-through across providers.
 *
 * Tries providers in priority order; on `VoiceProviderError` it logs and
 * advances to the next available provider. Tracks the successful synthesis
 * in `voice_usage_events` (best-effort — we never let logging failure block
 * audio playback).
 */
export async function synthesizeVoice(
  req: VoiceSynthRequest,
  opts?: VoiceRouterOptions,
): Promise<VoiceSynthResponse> {
  const order = buildPriorityList(opts);
  const attempts: SynthesisAttempt[] = [];

  for (const name of order) {
    const provider = PROVIDERS[name];
    if (!provider.available()) {
      attempts.push({ provider: name, reason: "not_configured" });
      continue;
    }

    try {
      const result = await provider.synthesize(req);
      // Best-effort usage logging. Errors here are swallowed by design.
      await trackUsage(req, result).catch((err) => {
        console.warn("[voice/router] usage tracking failed:", err);
      });
      return result;
    } catch (err) {
      const reason =
        err instanceof VoiceProviderError
          ? err.reason
          : err instanceof Error
            ? err.message
            : "unknown_error";
      attempts.push({ provider: name, reason });
      // Hard not_configured shouldn't keep retrying the same provider next
      // request — but we still drop through to the next provider this
      // request, which is the entire point of the router.
      console.warn(`[voice/router] ${name} failed (${reason}), trying next`);
    }
  }

  const summary = attempts
    .map((a) => `${a.provider}=${a.reason}`)
    .join(", ");
  throw new Error(`All voice providers failed: ${summary || "no providers configured"}`);
}

/**
 * Insert a row into `voice_usage_events`. Service-client write because the
 * synthesis path runs both as authenticated user (dashboard preview) and as
 * service (cron / webhook). Skipped silently when `userId` is missing — we
 * never want to drop audio just because telemetry can't write.
 */
async function trackUsage(
  req: VoiceSynthRequest,
  result: VoiceSynthResponse,
): Promise<void> {
  if (!req.userId) return;
  try {
    const supabase = createServiceClient();
    await supabase.from("voice_usage_events").insert({
      user_id: req.userId,
      provider: result.provider,
      characters_count: req.text.length,
      duration_seconds: result.durationSeconds ?? null,
      cost_usd: result.costEstimate ?? 0,
      context: req.context ?? null,
    });
  } catch (err) {
    // Don't bubble — caller already has its audio.
    console.warn("[voice/router] insert voice_usage_events failed:", err);
  }
}

/**
 * Snapshot of every provider's availability, useful for the /api/tts/debug
 * endpoint and the dashboard "voice provider status" tile.
 */
export function getProviderStatus(): Array<{
  name: VoiceProvider;
  available: boolean;
  costPerCharUsd: number;
}> {
  return (Object.keys(PROVIDERS) as VoiceProvider[]).map((name) => ({
    name,
    available: PROVIDERS[name].available(),
    costPerCharUsd: PROVIDERS[name].costPerCharUsd,
  }));
}
