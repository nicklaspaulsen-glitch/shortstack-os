/**
 * Voice provider abstraction — public API barrel.
 *
 * Default: `runpod_xtts` (free, self-hosted on RunPod)
 * Premium opt-in: `elevenlabs`
 * Fallback: `openai_tts`
 *
 * Use {@link synthesizeVoice} from any server-side route. Don't construct
 * provider clients directly — the router handles fall-through, env-var
 * checks, and `voice_usage_events` logging.
 */

export {
  synthesizeVoice,
  getVoiceProvider,
  getProviderStatus,
  type VoiceRouterOptions,
} from "./router";
export {
  type VoiceProvider,
  type VoiceProviderImpl,
  type VoiceSynthRequest,
  type VoiceSynthResponse,
  VoiceProviderError,
} from "./provider";
