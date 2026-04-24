/**
 * MINIMAL STUB for the cost-reduction-layer's Claude client.
 *
 * The full implementation lives on feat/cost-reduction-layer and will
 * replace this file when that branch lands. Until then, the manage-ai
 * features import from here so everything type-checks and runs against
 * a plain Anthropic SDK call.
 *
 * Public surface intentionally mirrors the real client:
 *   - sendCached({ system, messages, model, maxTokens, endpoint, userId })
 *   - submitBatch(...)          → throws (batches only on full client)
 *   - getBatchResults(...)      → throws (batches only on full client)
 *
 * The real client adds prompt caching + usage logging to Supabase.
 * The stub just proxies to anthropic.messages.create with no caching.
 */
import Anthropic from "@anthropic-ai/sdk";
import {
  anthropic,
  MODEL_HAIKU,
  MODEL_SONNET,
  getResponseText,
} from "@/lib/ai/claude-helpers";

export { MODEL_HAIKU, MODEL_SONNET };

export interface SendCachedInput {
  system: string | Array<{ type: "text"; text: string; cache_control?: { type: "ephemeral" } }>;
  messages: Anthropic.MessageParam[];
  model?: string;
  maxTokens?: number;
  endpoint: string;
  userId?: string | null;
  temperature?: number;
}

export interface SendCachedResult {
  text: string;
  raw: Anthropic.Message;
}

/**
 * Thin wrapper around anthropic.messages.create. No caching, no batching.
 * Full implementation on feat/cost-reduction-layer; this stub exists so
 * the manage-ai branch can be developed in parallel.
 */
export async function sendCached(input: SendCachedInput): Promise<SendCachedResult> {
  // Flatten a string `system` into the SDK's expected shape.
  const systemParam: Anthropic.Messages.MessageCreateParams["system"] =
    typeof input.system === "string"
      ? input.system
      : (input.system as Anthropic.Messages.MessageCreateParams["system"]);

  const response = await anthropic.messages.create({
    model: input.model || MODEL_SONNET,
    max_tokens: input.maxTokens ?? 2048,
    temperature: input.temperature,
    system: systemParam,
    messages: input.messages,
  });

  return { text: getResponseText(response), raw: response };
}

export async function submitBatch(): Promise<never> {
  throw new Error(
    "ai-client: submitBatch not available on this branch — waiting on feat/cost-reduction-layer"
  );
}

export async function getBatchResults(): Promise<never> {
  throw new Error(
    "ai-client: getBatchResults not available on this branch — waiting on feat/cost-reduction-layer"
  );
}
