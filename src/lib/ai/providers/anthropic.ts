/**
 * Anthropic provider for the LLM router.
 *
 * Reuses the shared `anthropic` singleton from claude-helpers.ts — never
 * constructs a new client (per CLAUDE.md SDK rules).
 *
 * Pricing as of 2026-04-26:
 *   Haiku 4.5      $1.00 / $5.00  per Mtok input/output
 *   Sonnet 4.6     $3.00 / $15.00 per Mtok input/output
 *   Opus 4.5       $15.00 / $75.00 per Mtok input/output
 */
import { anthropic, getResponseText } from "../claude-helpers";
import type {
  LLMAttachment,
  ProviderInvokeArgs,
  ProviderInvokeResult,
} from "./types";

export const ANTHROPIC_MODEL_IDS = {
  HAIKU: "claude-haiku-4-5-20251001",
  SONNET: "claude-sonnet-4-6-20250514",
  OPUS: "claude-opus-4-5-20250929",
} as const;

interface AnthropicPricing {
  inputPerM: number;
  outputPerM: number;
}

const PRICING: Record<string, AnthropicPricing> = {
  [ANTHROPIC_MODEL_IDS.HAIKU]: { inputPerM: 1.0, outputPerM: 5.0 },
  [ANTHROPIC_MODEL_IDS.SONNET]: { inputPerM: 3.0, outputPerM: 15.0 },
  [ANTHROPIC_MODEL_IDS.OPUS]: { inputPerM: 15.0, outputPerM: 75.0 },
};

export type CallAnthropicArgs = ProviderInvokeArgs;
export type CallAnthropicResult = ProviderInvokeResult;

function calcCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model];
  if (!p) return 0;
  return (
    (inputTokens / 1_000_000) * p.inputPerM +
    (outputTokens / 1_000_000) * p.outputPerM
  );
}

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "url"; url: string } };

function buildUserContent(
  userPrompt: string,
  attachments?: LLMAttachment[],
): string | AnthropicContentBlock[] {
  if (!attachments || attachments.length === 0) return userPrompt;
  const blocks: AnthropicContentBlock[] = [];
  for (const a of attachments) {
    if (a.type === "image") {
      blocks.push({ type: "image", source: { type: "url", url: a.url } });
    }
  }
  blocks.push({ type: "text", text: userPrompt });
  return blocks;
}

export async function callAnthropic(
  model: string,
  args: CallAnthropicArgs,
): Promise<CallAnthropicResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const userContent = buildUserContent(args.userPrompt, args.attachments);
  const response = await anthropic.messages.create({
    model,
    max_tokens: args.maxTokens,
    messages: [{ role: "user", content: userContent }],
    ...(args.systemPrompt ? { system: args.systemPrompt } : {}),
    ...(typeof args.temperature === "number"
      ? { temperature: args.temperature }
      : {}),
  });

  const text = getResponseText(response);
  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;

  return {
    text,
    inputTokens,
    outputTokens,
    costUsd: calcCost(model, inputTokens, outputTokens),
  };
}
