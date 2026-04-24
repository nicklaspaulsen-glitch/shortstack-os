/**
 * Dual-engine LLM router — "local for bulk, cloud for precision".
 *
 * Routes task types to the cheapest capable tier:
 *   - local  → Ollama (localhost or RunPod-hosted GPU pod) for bulk/routine tasks
 *   - cloud  → Anthropic (Haiku for classify/extract/summarize, Sonnet for code/decide)
 *
 * On ANY local failure, falls back to cloud automatically. Every call is
 * logged to `llm_router_log` with tier, task_type, tokens, latency, and
 * whether a fallback fired.
 *
 * Kill-switch: set LLM_ROUTER_MODE=cloud-only to disable local entirely.
 *
 * Env vars:
 *   OLLAMA_BASE_URL        default http://localhost:11434
 *   OLLAMA_MODEL           default gemma4:27b
 *   RUNPOD_API_KEY         optional — enables RunPod preference
 *   RUNPOD_OLLAMA_URL      optional — RunPod pod's Ollama URL (preferred over localhost)
 *   LLM_ROUTER_MODE        dual (default) | cloud-only
 *   ANTHROPIC_API_KEY      required for cloud fallback
 */

import { createServiceClient } from "@/lib/supabase/server";
import { MODEL_HAIKU, MODEL_SONNET } from "@/lib/ai/claude-helpers";

export type Tier = "local" | "cloud";

export type TaskType =
  // local-friendly (bulk/routine)
  | "summarize"
  | "classify"
  | "extract"
  | "score"
  | "draft"
  | "brainstorm"
  | "translate"
  | "explain"
  | "first_pass"
  // cloud-only (precision-critical)
  | "code"
  | "decide"
  | "customer_facing"
  | "tool_use"
  | "security_review";

const LOCAL_TASKS = new Set<TaskType>([
  "summarize",
  "classify",
  "extract",
  "score",
  "draft",
  "brainstorm",
  "translate",
  "explain",
  "first_pass",
]);

// Cloud-Haiku for the short, structured local-equivalent workloads when we fall back.
// Cloud-Sonnet for the tasks we never attempt locally (complex reasoning, code, etc).
const HAIKU_CLOUD_TASKS = new Set<TaskType>([
  "summarize",
  "classify",
  "extract",
  "score",
  "draft",
  "translate",
  "explain",
  "first_pass",
  "brainstorm",
]);

// Per-million-token prices (USD). Used by the admin dashboard to compute savings.
// Haiku 4.5 is $1/MTok input, $5/MTok output (cheapest Claude). Sonnet is $3/$15.
// Local runs on owned GPU (RunPod by the hour or local hardware) → cost ≈ $0.
export const TOKEN_COST = {
  haiku_in_per_m: 1.0,
  haiku_out_per_m: 5.0,
  sonnet_in_per_m: 3.0,
  sonnet_out_per_m: 15.0,
};

interface RouteResult {
  tier: Tier;
  endpoint: string;
  model: string;
}

interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  system?: string;
  userId?: string | null;
}

interface ChatResult {
  text: string;
  tier: Tier;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  fallbackUsed: boolean;
}

/**
 * Resolve which tier/endpoint/model a task should hit FIRST.
 * Does not account for fallback — see `chatWithFallback` for the full flow.
 */
export function route(taskType: TaskType): RouteResult {
  const mode = (process.env.LLM_ROUTER_MODE || "dual").toLowerCase();

  // Kill-switch: bypass local entirely.
  if (mode === "cloud-only") {
    return cloudRoute(taskType);
  }

  // Cloud-only task types always go to cloud.
  if (!LOCAL_TASKS.has(taskType)) {
    return cloudRoute(taskType);
  }

  return localRoute();
}

function localRoute(): RouteResult {
  // Prefer RunPod if configured, else local Ollama.
  const base =
    process.env.RUNPOD_OLLAMA_URL ||
    process.env.OLLAMA_BASE_URL ||
    "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL || "gemma4:27b";
  return {
    tier: "local",
    endpoint: `${base.replace(/\/+$/, "")}/v1/chat/completions`,
    model,
  };
}

function cloudRoute(taskType: TaskType): RouteResult {
  const model = HAIKU_CLOUD_TASKS.has(taskType) ? MODEL_HAIKU : MODEL_SONNET;
  return {
    tier: "cloud",
    endpoint: "https://api.anthropic.com/v1/messages",
    model,
  };
}

/**
 * Call the routed tier, falling back to cloud on any local error.
 *
 * Always logs exactly one row to `llm_router_log` per call (async, fire-and-forget;
 * logging failures never propagate to the caller).
 */
export async function chatWithFallback(
  prompt: string,
  taskType: TaskType,
  opts: ChatOptions = {},
): Promise<string> {
  const result = await chatWithFallbackDetailed(prompt, taskType, opts);
  return result.text;
}

/**
 * Same as `chatWithFallback` but returns full telemetry. Use when the caller
 * wants to report local-vs-cloud to the user (e.g. batch endpoints).
 */
export async function chatWithFallbackDetailed(
  prompt: string,
  taskType: TaskType,
  opts: ChatOptions = {},
): Promise<ChatResult> {
  const start = Date.now();
  const initial = route(taskType);
  const temperature = opts.temperature ?? 0.7;
  const maxTokens = opts.maxTokens ?? 1024;

  // Try the initial tier. On failure of a LOCAL call, fall back to cloud.
  if (initial.tier === "local") {
    try {
      const local = await callOllama(initial.endpoint, initial.model, prompt, {
        temperature,
        maxTokens,
        system: opts.system,
      });
      const latencyMs = Date.now() - start;
      await logCall({
        userId: opts.userId ?? null,
        tier: "local",
        taskType,
        model: initial.model,
        tokensIn: local.tokensIn,
        tokensOut: local.tokensOut,
        latencyMs,
        fallbackUsed: false,
        errorText: null,
      });
      return {
        text: local.text,
        tier: "local",
        model: initial.model,
        tokensIn: local.tokensIn,
        tokensOut: local.tokensOut,
        latencyMs,
        fallbackUsed: false,
      };
    } catch (localErr) {
      // Fall through to cloud.
      const cloudRouteInfo = cloudRoute(taskType);
      try {
        const cloud = await callAnthropic(
          cloudRouteInfo.model,
          prompt,
          { temperature, maxTokens, system: opts.system },
        );
        const latencyMs = Date.now() - start;
        await logCall({
          userId: opts.userId ?? null,
          tier: "cloud",
          taskType,
          model: cloudRouteInfo.model,
          tokensIn: cloud.tokensIn,
          tokensOut: cloud.tokensOut,
          latencyMs,
          fallbackUsed: true,
          errorText: truncateErr(localErr),
        });
        return {
          text: cloud.text,
          tier: "cloud",
          model: cloudRouteInfo.model,
          tokensIn: cloud.tokensIn,
          tokensOut: cloud.tokensOut,
          latencyMs,
          fallbackUsed: true,
        };
      } catch (cloudErr) {
        const latencyMs = Date.now() - start;
        await logCall({
          userId: opts.userId ?? null,
          tier: "cloud",
          taskType,
          model: cloudRouteInfo.model,
          tokensIn: 0,
          tokensOut: 0,
          latencyMs,
          fallbackUsed: true,
          errorText: `local:${truncateErr(localErr)} cloud:${truncateErr(cloudErr)}`,
        });
        throw cloudErr;
      }
    }
  }

  // Initial tier is cloud.
  try {
    const cloud = await callAnthropic(initial.model, prompt, {
      temperature,
      maxTokens,
      system: opts.system,
    });
    const latencyMs = Date.now() - start;
    await logCall({
      userId: opts.userId ?? null,
      tier: "cloud",
      taskType,
      model: initial.model,
      tokensIn: cloud.tokensIn,
      tokensOut: cloud.tokensOut,
      latencyMs,
      fallbackUsed: false,
      errorText: null,
    });
    return {
      text: cloud.text,
      tier: "cloud",
      model: initial.model,
      tokensIn: cloud.tokensIn,
      tokensOut: cloud.tokensOut,
      latencyMs,
      fallbackUsed: false,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    await logCall({
      userId: opts.userId ?? null,
      tier: "cloud",
      taskType,
      model: initial.model,
      tokensIn: 0,
      tokensOut: 0,
      latencyMs,
      fallbackUsed: false,
      errorText: truncateErr(err),
    });
    throw err;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Provider calls
// ────────────────────────────────────────────────────────────────────────────

interface ProviderCall {
  text: string;
  tokensIn: number;
  tokensOut: number;
}

interface CallOpts {
  temperature: number;
  maxTokens: number;
  system?: string;
}

async function callOllama(
  endpoint: string,
  model: string,
  prompt: string,
  opts: CallOpts,
): Promise<ProviderCall> {
  // Ollama exposes an OpenAI-compatible /v1/chat/completions endpoint.
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const runpodKey = process.env.RUNPOD_API_KEY;
  if (runpodKey && process.env.RUNPOD_OLLAMA_URL) {
    headers["Authorization"] = `Bearer ${runpodKey}`;
  }

  const messages: Array<{ role: string; content: string }> = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: prompt });

  // Hard timeout so a hung local pod doesn't block the user forever.
  const controller = new AbortController();
  const timeoutMs = Number(process.env.LLM_LOCAL_TIMEOUT_MS || 60_000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        stream: false,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new Error(`Ollama ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  const tokensIn = data.usage?.prompt_tokens ?? 0;
  const tokensOut = data.usage?.completion_tokens ?? 0;

  if (!text) {
    throw new Error("Ollama returned empty completion");
  }

  return { text, tokensIn, tokensOut };
}

async function callAnthropic(
  model: string,
  prompt: string,
  opts: CallOpts,
): Promise<ProviderCall> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const body: Record<string, unknown> = {
    model,
    max_tokens: opts.maxTokens,
    temperature: opts.temperature,
    messages: [{ role: "user", content: prompt }],
  };
  if (opts.system) body.system = opts.system;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? "";
  const tokensIn = data.usage?.input_tokens ?? 0;
  const tokensOut = data.usage?.output_tokens ?? 0;

  if (!text) {
    throw new Error("Anthropic returned empty completion");
  }

  return { text, tokensIn, tokensOut };
}

// ────────────────────────────────────────────────────────────────────────────
// Telemetry
// ────────────────────────────────────────────────────────────────────────────

interface LogRow {
  userId: string | null;
  tier: Tier;
  taskType: TaskType;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  fallbackUsed: boolean;
  errorText: string | null;
}

async function logCall(row: LogRow): Promise<void> {
  // Fire-and-forget: never let telemetry break a user request.
  try {
    const svc = createServiceClient();
    await svc.from("llm_router_log").insert({
      user_id: row.userId,
      tier: row.tier,
      task_type: row.taskType,
      model: row.model,
      tokens_in: row.tokensIn,
      tokens_out: row.tokensOut,
      latency_ms: row.latencyMs,
      fallback_used: row.fallbackUsed,
      error_text: row.errorText,
    });
  } catch {
    // swallow — logging is best-effort
  }
}

function truncateErr(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.slice(0, 500);
}

// ────────────────────────────────────────────────────────────────────────────
// Cost helpers (used by dashboard)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Given one log row's tokens+model, return the USD price we would have paid
 * had the call gone to cloud at the equivalent model tier. Local calls return
 * 0. Cloud calls return their actual cost. The dashboard uses this to compute
 * `savingsUSD` by comparing local rows against their equivalent-cloud price.
 */
export function priceRowUSD(row: {
  tier: Tier;
  model: string;
  tokens_in: number;
  tokens_out: number;
}): number {
  if (row.tier === "local") return 0;
  const isSonnet = row.model.includes("sonnet");
  const inP = isSonnet ? TOKEN_COST.sonnet_in_per_m : TOKEN_COST.haiku_in_per_m;
  const outP = isSonnet ? TOKEN_COST.sonnet_out_per_m : TOKEN_COST.haiku_out_per_m;
  return (row.tokens_in * inP + row.tokens_out * outP) / 1_000_000;
}

/**
 * Had a given LOCAL row gone to cloud (Haiku-equivalent), what would it cost?
 * Used to compute dollars-saved by shifting bulk traffic off Anthropic.
 */
export function counterfactualCloudUSD(row: {
  tokens_in: number;
  tokens_out: number;
}): number {
  return (
    (row.tokens_in * TOKEN_COST.haiku_in_per_m +
      row.tokens_out * TOKEN_COST.haiku_out_per_m) /
    1_000_000
  );
}
