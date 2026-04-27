/**
 * `callLLMHumanized` — drop-in replacement for `callLLM` that:
 *   1. Optionally injects a learned voice snippet into the system prompt.
 *   2. Optionally runs the model output through `humanize()` to strip AI tells.
 *
 * Default behaviour:
 *   - `humanize` defaults to TRUE (content surfaces want this).
 *   - Pass `humanize: false` for analysis surfaces (coach insights JSON,
 *     classifiers, anything where "voice" is irrelevant).
 *
 * Cost note: when `humanize: true` we add a single Haiku call for the
 * rewrite. Tracked through the same usage events table as the primary
 * call. For tiny payloads (`< 80 chars`) the rewrite skips the LLM and
 * runs only the deterministic regex pass — no extra spend.
 */
import { callLLM, type LLMRequest, type LLMResponse } from "@/lib/ai/llm-router";
import { humanize, type HumanizeOptions } from "@/lib/ai/humanizer";
import { getVoiceSnippet, type VoiceSubjectKind } from "@/lib/ai/voice-profile";

export interface CallLLMHumanizedRequest extends LLMRequest {
  /** Voice profile to consult for both prompt-injection and post-rewrite. */
  voiceProfile?: { subjectKind: VoiceSubjectKind; subjectId: string };
  /** Enable post-rewrite humanizer. Default: true. */
  humanize?: boolean;
  /** Channel hint passed into the humanizer for tone tuning. */
  channel?: HumanizeOptions["channel"];
}

export interface CallLLMHumanizedResponse extends LLMResponse {
  /** The voice snippet that was injected (if any). Useful for debugging. */
  voiceUsed?: string | null;
}

/**
 * Call the LLM with optional voice-profile injection + output humanization.
 * Falls back gracefully on every soft failure: voice-snippet lookup error
 * → no injection; humanize error → return preHumanize-only text.
 */
export async function callLLMHumanized(
  req: CallLLMHumanizedRequest,
): Promise<CallLLMHumanizedResponse> {
  const { voiceProfile, humanize: humanizeFlag, channel, ...rest } = req;
  const shouldHumanize = humanizeFlag !== false;

  let voiceSnippet: string | null = null;
  if (voiceProfile) {
    try {
      voiceSnippet = await getVoiceSnippet(voiceProfile);
    } catch (err) {
      console.warn("[call-llm-humanized] voice snippet lookup failed", err);
    }
  }

  // Inject voice context into the system prompt without overwriting the
  // caller's instructions. We append; the model will naturally honour the
  // voice cue when it appears at the bottom.
  const augmentedSystemPrompt = voiceSnippet
    ? `${rest.systemPrompt ?? ""}\n\nVOICE CONTEXT: ${voiceSnippet}`.trim()
    : rest.systemPrompt;

  const result = await callLLM({
    ...rest,
    systemPrompt: augmentedSystemPrompt,
  });

  if (!shouldHumanize) {
    return { ...result, voiceUsed: voiceSnippet };
  }

  let humanText = result.text;
  try {
    humanText = await humanize(result.text, {
      voiceSnippet: voiceSnippet ?? undefined,
      channel,
      userId: rest.userId,
    });
  } catch (err) {
    console.warn("[call-llm-humanized] humanize step failed", err);
  }

  return { ...result, text: humanText, voiceUsed: voiceSnippet };
}
