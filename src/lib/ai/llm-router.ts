/**
 * Smart LLM Router
 *
 * Routes AI calls to the cheapest model that can reliably handle the task.
 * Each call site declares a `taskType` (e.g. "caption_generation",
 * "complex_analysis") and the router picks the cheapest provider/model that
 * can do the job. Targets 50-80% cost savings vs always using Sonnet.
 *
 * Usage:
 *   import { callLLM } from "@/lib/ai/llm-router";
 *   const result = await callLLM({
 *     taskType: "subject_line",
 *     userPrompt: "...",
 *     systemPrompt: "...",
 *     userId: user.id,
 *     context: "/api/emails/subject-variants",
 *   });
 *   console.log(result.text, result.costUsd);
 *
 * Tracks every call in `llm_usage_events` (best-effort, fire-and-forget).
 */
import { createServiceClient } from "@/lib/supabase/server";
import { callAnthropic, ANTHROPIC_MODEL_IDS } from "./providers/anthropic";
import { callOpenRouter, OPENROUTER_MODELS } from "./providers/openrouter";
import { callOpenAI, OPENAI_MODELS } from "./providers/openai";
import { callRunpodLLM } from "./providers/runpod-llm";
import { reportError } from "@/lib/observability/error-reporter";
import { structuredLog } from "@/lib/observability/structured-log";
import type {
  LLMAttachment,
  ProviderInvokeArgs,
  ProviderInvokeResult,
} from "./providers/types";

export type { LLMAttachment };

export type LLMTaskType =
  | "simple_classification"
  | "summarization"
  | "caption_generation"
  | "subject_line"
  | "polish_copy"
  | "extraction"
  | "generation_short"
  | "generation_long"
  | "agentic_reasoning"
  | "code_review"
  | "vision"
  | "creative_writing"
  | "complex_analysis";

export interface LLMRequest {
  taskType: LLMTaskType;
  systemPrompt?: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  attachments?: LLMAttachment[];
  /** User UUID — required for usage tracking. If absent, tracking skipped. */
  userId?: string;
  /** Calling route name / feature, e.g. "/api/social/auto-upload". */
  context?: string;
  /** Force a specific model id (escape hatch — bypasses routing). */
  forceModel?: string;
  /** Disable fallback chain (test/debug). */
  disableFallback?: boolean;
}

export interface LLMResponse {
  text: string;
  /** Provider key — "anthropic" | "openrouter" | "openai" | "runpod-llm". */
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
}

/**
 * Provider-prefixed model identifiers. Format: "<provider>:<model>".
 * Anthropic models are bare strings (no prefix) for backwards compat with
 * existing Claude helpers.
 */
type ModelSpec = string;

interface RouteRule {
  primary: ModelSpec;
  fallback?: ModelSpec;
}

const TASK_ROUTING: Record<LLMTaskType, RouteRule> = {
  // Tiny one-shot classification — the cheapest path wins.
  simple_classification: {
    primary: "openrouter:meta-llama/llama-3.1-70b-instruct",
    fallback: ANTHROPIC_MODEL_IDS.HAIKU,
  },
  summarization: {
    primary: ANTHROPIC_MODEL_IDS.HAIKU,
    fallback: "openai:gpt-4o-mini",
  },
  caption_generation: {
    primary: ANTHROPIC_MODEL_IDS.HAIKU,
    fallback: "runpod-llm",
  },
  subject_line: { primary: ANTHROPIC_MODEL_IDS.HAIKU },
  polish_copy: { primary: ANTHROPIC_MODEL_IDS.HAIKU },
  extraction: { primary: ANTHROPIC_MODEL_IDS.HAIKU },
  generation_short: { primary: ANTHROPIC_MODEL_IDS.HAIKU },
  // Long-form needs Sonnet quality.
  generation_long: { primary: ANTHROPIC_MODEL_IDS.SONNET },
  agentic_reasoning: { primary: ANTHROPIC_MODEL_IDS.SONNET },
  code_review: {
    primary: "openrouter:qwen/qwen3-coder",
    fallback: ANTHROPIC_MODEL_IDS.SONNET,
  },
  // Vision MUST go to a vision-capable model. Sonnet is solid here.
  vision: { primary: ANTHROPIC_MODEL_IDS.SONNET },
  creative_writing: {
    primary: ANTHROPIC_MODEL_IDS.SONNET,
    fallback: ANTHROPIC_MODEL_IDS.OPUS,
  },
  complex_analysis: {
    primary: ANTHROPIC_MODEL_IDS.OPUS,
    fallback: ANTHROPIC_MODEL_IDS.SONNET,
  },
};

/** Parse a provider-prefixed spec like "openrouter:qwen/qwen3-coder". */
function parseSpec(spec: ModelSpec): { provider: string; model: string } {
  if (spec === "runpod-llm") return { provider: "runpod-llm", model: "runpod-llm" };
  const colon = spec.indexOf(":");
  if (colon === -1) {
    // bare anthropic model id
    return { provider: "anthropic", model: spec };
  }
  return { provider: spec.slice(0, colon), model: spec.slice(colon + 1) };
}

async function invokeProvider(
  spec: ModelSpec,
  args: ProviderInvokeArgs,
): Promise<ProviderInvokeResult> {
  const { provider, model } = parseSpec(spec);
  switch (provider) {
    case "anthropic":
      return callAnthropic(model, args);
    case "openrouter":
      return callOpenRouter(model, args);
    case "openai":
      return callOpenAI(model, args);
    case "runpod-llm":
      return callRunpodLLM(args);
    default:
      throw new Error(`[llm-router] Unknown provider in spec: ${spec}`);
  }
}

async function trackUsage(args: {
  userId: string;
  taskType: LLMTaskType;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
  context?: string;
}) {
  try {
    const supabase = createServiceClient();
    await supabase.from("llm_usage_events").insert({
      user_id: args.userId,
      task_type: args.taskType,
      provider: args.provider,
      model: args.model,
      input_tokens: args.inputTokens,
      output_tokens: args.outputTokens,
      cost_usd: args.costUsd,
      duration_ms: args.durationMs,
      context: args.context ?? null,
    });
  } catch (err) {
    // Tracking failure must never break user flow.
    console.error("[llm-router] usage tracking failed", err);
  }
}

/**
 * Main entrypoint. Picks the cheapest model for the task, calls it, falls back
 * if the primary throws, and tracks usage in `llm_usage_events`.
 */
export async function callLLM(req: LLMRequest): Promise<LLMResponse> {
  if (!req.userPrompt || typeof req.userPrompt !== "string") {
    throw new Error("[llm-router] userPrompt is required");
  }

  const rule = TASK_ROUTING[req.taskType];
  if (!rule) throw new Error(`[llm-router] Unknown task type: ${req.taskType}`);

  // forceModel escape hatch
  const primarySpec = req.forceModel ?? rule.primary;
  const fallbackSpec = req.disableFallback ? undefined : rule.fallback;

  const args: ProviderInvokeArgs = {
    systemPrompt: req.systemPrompt,
    userPrompt: req.userPrompt,
    maxTokens: req.maxTokens ?? 1500,
    temperature: req.temperature,
    attachments: req.attachments,
  };

  const startedAt = Date.now();
  let chosenSpec = primarySpec;
  let result: ProviderInvokeResult;

  try {
    result = await invokeProvider(primarySpec, args);
  } catch (primaryErr) {
    if (!fallbackSpec) {
      throw primaryErr;
    }
    structuredLog.warn("[llm-router]", "primary provider failed, falling back", {
      primarySpec,
      fallbackSpec,
      taskType: req.taskType,
      error: primaryErr instanceof Error ? primaryErr.message : String(primaryErr),
    });
    chosenSpec = fallbackSpec;
    try {
      result = await invokeProvider(fallbackSpec, args);
    } catch (fallbackErr) {
      console.error(
        `[llm-router] fallback ${fallbackSpec} also failed`,
        fallbackErr,
      );
      // Both primary and fallback exhausted — page on this. Either we
      // hit a billing/auth issue with multiple providers, or the model
      // ids drifted out of sync with what they accept.
      reportError(fallbackErr, {
        route: "llm-router",
        component: "callLLM",
        taskType: req.taskType,
        primarySpec,
        fallbackSpec,
        userId: req.userId,
        context: req.context,
      });
      throw fallbackErr;
    }
  }

  const durationMs = Date.now() - startedAt;
  const { provider, model } = parseSpec(chosenSpec);

  // Fire-and-forget tracking — we don't await so caller latency stays clean.
  if (req.userId) {
    void trackUsage({
      userId: req.userId,
      taskType: req.taskType,
      provider,
      model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd: result.costUsd,
      durationMs,
      context: req.context,
    });
  }

  return {
    text: result.text,
    provider,
    model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costUsd: result.costUsd,
    durationMs,
  };
}

/**
 * Re-export model id constants so callers can `forceModel` when needed
 * without importing from provider files directly.
 */
export {
  ANTHROPIC_MODEL_IDS,
  OPENROUTER_MODELS,
  OPENAI_MODELS,
};

/** Read the routing table — useful for the cost dashboard. */
export function getTaskRouting(): Readonly<Record<LLMTaskType, RouteRule>> {
  return TASK_ROUTING;
}
