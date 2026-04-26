/**
 * RunPod self-hosted LLM provider for the LLM router.
 *
 * Hits RUNPOD_LLM_URL (an OpenAI-compatible /runsync endpoint, typically a
 * Llama or Mixtral image). Authenticated via RUNPOD_API_KEY when set.
 *
 * Cost: ~$0.0001 / 1k tokens (depends on GPU type / pod hours). We treat it
 * as effectively free at the request level — precise spend gets reconciled
 * against the monthly RunPod bill, not per-call.
 */
import type { ProviderInvokeArgs, ProviderInvokeResult } from "./types";

const PRICE_PER_M_TOKENS = 0.1; // $0.10/Mtok approximate amortised

export type CallRunpodLLMArgs = ProviderInvokeArgs;
export type CallRunpodLLMResult = ProviderInvokeResult;

interface RunpodChoice {
  message?: { content?: string };
}

interface RunpodOutput {
  choices?: RunpodChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

interface RunpodResponse {
  status?: string;
  output?: RunpodOutput;
  error?: string;
}

export async function callRunpodLLM(args: CallRunpodLLMArgs): Promise<CallRunpodLLMResult> {
  const url = process.env.RUNPOD_LLM_URL;
  if (!url) throw new Error("RUNPOD_LLM_URL not configured");

  const apiKey = process.env.RUNPOD_API_KEY;

  // Vision attachments not supported by the typical Llama serverless image —
  // throw so the router falls back to a vision-capable provider.
  if (args.attachments && args.attachments.length > 0) {
    throw new Error("[runpod-llm] attachments not supported on this endpoint");
  }

  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (args.systemPrompt) messages.push({ role: "system", content: args.systemPrompt });
  messages.push({ role: "user", content: args.userPrompt });

  const res = await fetch(`${url.replace(/\/$/, "")}/runsync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      input: {
        messages,
        max_tokens: args.maxTokens,
        temperature: args.temperature,
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`[runpod-llm] ${res.status}: ${detail.slice(0, 500)}`);
  }

  const data: RunpodResponse = await res.json();
  if (data.status && data.status !== "COMPLETED") {
    throw new Error(`[runpod-llm] status=${data.status}: ${data.error ?? ""}`);
  }

  const text = data.output?.choices?.[0]?.message?.content ?? "";
  const inputTokens = data.output?.usage?.prompt_tokens ?? 0;
  const outputTokens = data.output?.usage?.completion_tokens ?? 0;

  const costUsd =
    ((inputTokens + outputTokens) / 1_000_000) * PRICE_PER_M_TOKENS;

  return {
    text,
    inputTokens,
    outputTokens,
    costUsd,
  };
}
