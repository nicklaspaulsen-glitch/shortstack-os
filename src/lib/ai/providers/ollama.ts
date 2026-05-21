/**
 * Ollama LLM provider for the LLM router.
 *
 * Routes to a local or self-hosted Ollama instance.
 * Soft-fails: if OLLAMA_BASE_URL is not set, the provider throws so the router
 * falls back to the next option. No requests are made at module load time.
 *
 * Environment:
 *   OLLAMA_BASE_URL   Base URL for the Ollama API (e.g. http://localhost:11434
 *                     or http://your-hetzner-host:11434). Required at call time.
 *
 * Model spec syntax in the router: "ollama:<model-tag>"
 *   e.g. "ollama:llama3.2:3b", "ollama:mistral", "ollama:qwen2.5-coder"
 *
 * Ollama chat API: POST /api/chat
 *   { model, messages: [{role, content}], stream: false }
 *   Response: { message: { role, content }, prompt_eval_count, eval_count }
 *
 * Pricing: self-hosted — near-zero marginal cost. costUsd is always 0.
 */
import type { ProviderInvokeArgs, ProviderInvokeResult } from "./types";

interface OllamaChatResponse {
  model?: string;
  message?: { role?: string; content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
  done?: boolean;
  error?: string;
}

function getBaseUrl(): string {
  const url = process.env.OLLAMA_BASE_URL;
  if (!url) throw new Error("[ollama] OLLAMA_BASE_URL is not configured");
  // Strip trailing slash
  return url.replace(/\/$/, "");
}

export async function callOllama(
  model: string,
  args: ProviderInvokeArgs,
): Promise<ProviderInvokeResult> {
  const baseUrl = getBaseUrl();

  type OllamaMessage = { role: "system" | "user" | "assistant"; content: string };
  const messages: OllamaMessage[] = [];
  if (args.systemPrompt) {
    messages.push({ role: "system", content: args.systemPrompt });
  }
  messages.push({ role: "user", content: args.userPrompt });

  const body = {
    model,
    messages,
    stream: false,
    options: {
      num_predict: args.maxTokens ?? 1500,
      temperature: args.temperature ?? 0.7,
    },
  };

  let rawRes: Response;
  try {
    rawRes = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // 60 s timeout — local models may be slow
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    throw new Error(
      `[ollama] Network error connecting to ${baseUrl}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!rawRes.ok) {
    const text = await rawRes.text().catch(() => "");
    throw new Error(`[ollama] HTTP ${rawRes.status} from ${baseUrl}: ${text}`);
  }

  let data: OllamaChatResponse;
  try {
    data = (await rawRes.json()) as OllamaChatResponse;
  } catch {
    throw new Error("[ollama] Failed to parse JSON response from Ollama");
  }

  if (data.error) {
    throw new Error(`[ollama] Model error: ${data.error}`);
  }

  const text = data.message?.content ?? "";
  const inputTokens = data.prompt_eval_count ?? 0;
  const outputTokens = data.eval_count ?? 0;

  return {
    text,
    inputTokens,
    outputTokens,
    // Self-hosted — no per-token cost. Return 0 for honest tracking.
    costUsd: 0,
  };
}

/**
 * List models available on the Ollama server.
 * Returns [] if the server is unreachable (soft-fail).
 */
export async function listOllamaModels(): Promise<string[]> {
  let baseUrl: string;
  try {
    baseUrl = getBaseUrl();
  } catch {
    return [];
  }
  try {
    const res = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { models?: { name: string }[] };
    return (data.models ?? []).map((m) => m.name);
  } catch {
    return [];
  }
}
