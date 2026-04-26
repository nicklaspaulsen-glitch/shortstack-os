/**
 * OpenRouter provider for the LLM router.
 *
 * Uses the OpenAI-compatible chat-completions endpoint at
 * https://openrouter.ai/api/v1/chat/completions. Cheap models live here:
 *   - meta-llama/llama-3.1-70b-instruct  ~$0.0002 / 1k tokens both ways
 *   - qwen/qwen3-coder                    ~$0.0002 / 1k tokens both ways
 *
 * Auth: OPENROUTER_API_KEY env var.
 */
import type {
  LLMAttachment,
  ProviderInvokeArgs,
  ProviderInvokeResult,
} from "./types";

export const OPENROUTER_MODELS = {
  LLAMA_70B: "meta-llama/llama-3.1-70b-instruct",
  QWEN3_CODER: "qwen/qwen3-coder",
} as const;

interface OpenRouterPricing {
  inputPerM: number;
  outputPerM: number;
}

const PRICING: Record<string, OpenRouterPricing> = {
  [OPENROUTER_MODELS.LLAMA_70B]: { inputPerM: 0.2, outputPerM: 0.2 },
  [OPENROUTER_MODELS.QWEN3_CODER]: { inputPerM: 0.2, outputPerM: 0.2 },
};

const DEFAULT_PRICING: OpenRouterPricing = { inputPerM: 0.2, outputPerM: 0.2 };

export type CallOpenRouterArgs = ProviderInvokeArgs;
export type CallOpenRouterResult = ProviderInvokeResult;

interface OpenRouterChoice {
  message?: { content?: string };
}

interface OpenRouterResponse {
  choices?: OpenRouterChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string };
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
}

function calcCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model] ?? DEFAULT_PRICING;
  return (
    (inputTokens / 1_000_000) * p.inputPerM +
    (outputTokens / 1_000_000) * p.outputPerM
  );
}

function buildUserContent(
  userPrompt: string,
  attachments?: LLMAttachment[],
): ChatMessage["content"] {
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

export async function callOpenRouter(
  model: string,
  args: CallOpenRouterArgs,
): Promise<CallOpenRouterResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not configured");
  }

  const messages: ChatMessage[] = [];
  if (args.systemPrompt) {
    messages.push({ role: "system", content: args.systemPrompt });
  }
  messages.push({
    role: "user",
    content: buildUserContent(args.userPrompt, args.attachments),
  });

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://app.shortstack.work",
      "X-Title": "ShortStack OS",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: args.maxTokens,
      temperature: args.temperature,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`[openrouter] ${res.status}: ${detail.slice(0, 500)}`);
  }

  const data: OpenRouterResponse = await res.json();
  if (data.error) {
    throw new Error(`[openrouter] ${data.error.message ?? "unknown error"}`);
  }

  const text = data.choices?.[0]?.message?.content ?? "";
  const inputTokens = data.usage?.prompt_tokens ?? 0;
  const outputTokens = data.usage?.completion_tokens ?? 0;

  return {
    text,
    inputTokens,
    outputTokens,
    costUsd: calcCost(model, inputTokens, outputTokens),
  };
}
