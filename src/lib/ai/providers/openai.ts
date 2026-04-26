/**
 * OpenAI provider for the LLM router.
 *
 * Uses lazy-init for the SDK client (per CLAUDE.md: no module-level SDK init).
 *
 * Pricing as of 2026-04-26:
 *   gpt-4o-mini   $0.15 / $0.60  per Mtok input/output
 *   gpt-4o        $2.50 / $10.00 per Mtok input/output
 */
import OpenAI from "openai";
import type {
  LLMAttachment,
  ProviderInvokeArgs,
  ProviderInvokeResult,
} from "./types";

export const OPENAI_MODELS = {
  GPT_4O_MINI: "gpt-4o-mini",
  GPT_4O: "gpt-4o",
} as const;

interface OpenAIPricing {
  inputPerM: number;
  outputPerM: number;
}

const PRICING: Record<string, OpenAIPricing> = {
  [OPENAI_MODELS.GPT_4O_MINI]: { inputPerM: 0.15, outputPerM: 0.6 },
  [OPENAI_MODELS.GPT_4O]: { inputPerM: 2.5, outputPerM: 10.0 },
};

const DEFAULT_PRICING: OpenAIPricing = { inputPerM: 1.0, outputPerM: 3.0 };

export type CallOpenAIArgs = ProviderInvokeArgs;
export type CallOpenAIResult = ProviderInvokeResult;

let cachedClient: OpenAI | null = null;
function getClient(): OpenAI {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
  cachedClient = new OpenAI({ apiKey });
  return cachedClient;
}

function calcCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model] ?? DEFAULT_PRICING;
  return (
    (inputTokens / 1_000_000) * p.inputPerM +
    (outputTokens / 1_000_000) * p.outputPerM
  );
}

type UserContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

function buildUserContent(userPrompt: string, attachments?: LLMAttachment[]): UserContent {
  if (!attachments || attachments.length === 0) return userPrompt;
  const parts: Array<
    { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
  > = [];
  for (const a of attachments) {
    if (a.type === "image") {
      parts.push({ type: "image_url", image_url: { url: a.url } });
    }
  }
  parts.push({ type: "text", text: userPrompt });
  return parts;
}

export async function callOpenAI(
  model: string,
  args: CallOpenAIArgs,
): Promise<CallOpenAIResult> {
  const client = getClient();

  const messages: Array<{
    role: "system" | "user" | "assistant";
    content: UserContent;
  }> = [];
  if (args.systemPrompt) messages.push({ role: "system", content: args.systemPrompt });
  messages.push({
    role: "user",
    content: buildUserContent(args.userPrompt, args.attachments),
  });

  const response = await client.chat.completions.create({
    model,
    max_tokens: args.maxTokens,
    temperature: args.temperature,
    messages: messages as Parameters<typeof client.chat.completions.create>[0]["messages"],
  });

  const text = response.choices?.[0]?.message?.content ?? "";
  const inputTokens = response.usage?.prompt_tokens ?? 0;
  const outputTokens = response.usage?.completion_tokens ?? 0;

  return {
    text,
    inputTokens,
    outputTokens,
    costUsd: calcCost(model, inputTokens, outputTokens),
  };
}
