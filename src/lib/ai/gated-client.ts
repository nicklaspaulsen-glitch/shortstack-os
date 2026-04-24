/**
 * Gated Claude client — wraps the Anthropic SDK with:
 *   1. Output caching (input-hash dedup, 7-day TTL)
 *   2. Per-org budget gate + circuit breaker
 *
 * Call order:
 *   1. hashInput()       — compute sha256 of the request
 *   2. getCached()       — short-circuit on hit (no API call, no spend)
 *   3. checkBudget()     — throws if paused / over-cap
 *   4. anthropic.messages.create() — the real API call
 *   5. recordSpend()     — increments org spend, may trip circuit breaker
 *   6. setCached()       — store for future identical requests
 *
 * NOTE: `feat/cost-reduction-layer` introduces a richer `claude-client.ts`
 * with prompt caching + Batches API. When that branch merges to main, merge
 * this module's gating logic into `sendCached` there. Until then, this file
 * is the entrypoint — import `sendGated` in place of the raw SDK.
 */

import Anthropic from "@anthropic-ai/sdk";

import { anthropic, MODEL_SONNET, getResponseText } from "./claude-helpers";
import { checkBudget, recordSpend } from "./budget-gate";
import {
  getCached,
  hashInput,
  setCached,
  type HashInput,
} from "./output-cache";

// Rough blended rates (USD per MTok). Sonnet 4.x.
const USD_PER_INPUT_TOKEN = 3 / 1_000_000;
const USD_PER_OUTPUT_TOKEN = 15 / 1_000_000;

export interface SendGatedArgs {
  model?: string;
  system?: string;
  messages: Array<Anthropic.MessageParam>;
  temperature?: number;
  max_tokens?: number;
  orgId?: string | null;
  /** Skip cache for this call (still records spend). */
  bypassCache?: boolean;
}

export interface SendGatedResult {
  text: string;
  cached: boolean;
  inputHash: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
  };
}

/**
 * Send a Claude request through the full cache + budget stack.
 */
export async function sendGated(args: SendGatedArgs): Promise<SendGatedResult> {
  const model = args.model ?? MODEL_SONNET;
  const orgId = args.orgId ?? null;

  const hashPayload: HashInput = {
    model,
    system: args.system,
    messages: args.messages as HashInput["messages"],
    temperature: args.temperature,
  };
  const inputHash = hashInput(hashPayload);

  // 1. Output cache
  if (!args.bypassCache) {
    const hit = await getCached(inputHash);
    if (hit) {
      return { text: hit.output, cached: true, inputHash };
    }
  }

  // 2. Budget gate — throws on paused/over-cap
  if (orgId) {
    await checkBudget(orgId);
  }

  // 3. Real API call
  const response = await anthropic.messages.create({
    model,
    max_tokens: args.max_tokens ?? 1024,
    system: args.system,
    messages: args.messages,
    ...(typeof args.temperature === "number"
      ? { temperature: args.temperature }
      : {}),
  });

  const text = getResponseText(response);
  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;
  const costUsd =
    inputTokens * USD_PER_INPUT_TOKEN + outputTokens * USD_PER_OUTPUT_TOKEN;

  // 4. Record spend (fire-and-forget semantics; don't block response)
  if (orgId && costUsd > 0) {
    await recordSpend(orgId, costUsd);
  }

  // 5. Persist to output cache
  if (!args.bypassCache && text) {
    await setCached({
      hash: inputHash,
      output: text,
      model,
      outputTokens,
      orgId,
    });
  }

  return {
    text,
    cached: false,
    inputHash,
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: Math.round(costUsd * 10000) / 10000,
    },
  };
}
