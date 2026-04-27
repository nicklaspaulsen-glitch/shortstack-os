/**
 * Langfuse open-source LLM observability layer.
 *
 * Wraps the official `langfuse` SDK so our code never touches it directly.
 * Public API:
 *
 *   const result = await traceLLMCall({
 *     agencyOwnerId,
 *     surface: "cold_email",
 *     taskType: "generation_short",
 *     subject: { kind: "lead", id },
 *     run: () => callLLM({...}),  // returns whatever your LLM call returns
 *   });
 *
 * The wrapper:
 *   - opens a Langfuse trace + span
 *   - runs your function
 *   - records duration, tokens, cost, and pass/fail status
 *   - mirrors a row into `agent_trace_index` so the admin dashboard can list
 *     traces without round-tripping to Langfuse
 *   - swallows all observability errors so the LLM call itself never fails
 *     because of tracing.
 *
 * ## Soft-fail
 *
 * When `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` are not both set, we
 * skip Langfuse entirely and just await the run.
 */

import type { Langfuse } from "langfuse";
import { createServiceClient } from "@/lib/supabase/server";

export interface LLMRunResult {
  text: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
}

export interface TraceLLMCallInput<T extends LLMRunResult> {
  agencyOwnerId: string;
  /** Logical surface name — 'cold_email' | 'sales_coach' | 'trinity_autonomous' | etc. */
  surface: string;
  /** LLM router task type — 'generation_short' | 'complex_analysis' | etc. */
  taskType: string;
  /** Optional subject context — used for trace tagging and dashboard filters. */
  subject?: {
    kind: "lead" | "client" | "user" | "team_member" | "agent";
    id: string;
  };
  /** Trace input payload (system+user prompts, model id, etc.) — recorded for dashboard inspection. */
  inputForTrace?: unknown;
  /** Function that performs the actual LLM call and returns the result. */
  run: () => Promise<T>;
}

let cachedClient: Langfuse | null = null;
let initAttempted = false;

function getLangfuse(): Langfuse | null {
  if (initAttempted) return cachedClient;
  initAttempted = true;

  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  if (!publicKey || !secretKey) {
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Langfuse: LangfuseClass } = require("langfuse") as typeof import("langfuse");
    cachedClient = new LangfuseClass({
      publicKey,
      secretKey,
      baseUrl: process.env.LANGFUSE_BASE_URL,
    });
    return cachedClient;
  } catch (err) {
    console.error("[langfuse-client] init failed", err);
    return null;
  }
}

/**
 * Mirror a trace summary into `agent_trace_index` so the admin dashboard
 * can render filterable lists without hitting Langfuse for every page load.
 */
async function indexTrace(args: {
  agencyOwnerId: string;
  langfuseTraceId: string;
  surface: string;
  taskType?: string;
  subjectKind?: string;
  subjectId?: string;
  totalTokens: number;
  totalCostUsd: number;
  latencyMs: number;
  status: "success" | "error" | "fallback";
  errorMessage?: string | null;
}): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from("agent_trace_index").insert({
      agency_owner_id: args.agencyOwnerId,
      langfuse_trace_id: args.langfuseTraceId,
      agent_surface: args.surface,
      related_subject_kind: args.subjectKind ?? null,
      related_subject_id: args.subjectId ?? null,
      task_type: args.taskType ?? null,
      total_tokens: args.totalTokens,
      total_cost_usd: args.totalCostUsd,
      latency_ms: args.latencyMs,
      status: args.status,
      error_message: args.errorMessage ?? null,
    });
  } catch (err) {
    console.error("[langfuse-client] indexTrace failed", err);
  }
}

/**
 * Run an LLM call and trace it to Langfuse + mirror the summary into our DB.
 * Always returns the run's result — tracing failures never fail the call.
 */
export async function traceLLMCall<T extends LLMRunResult>(
  input: TraceLLMCallInput<T>,
): Promise<T> {
  const langfuse = getLangfuse();

  // Path 1 — Langfuse not configured. Just run the function.
  if (!langfuse) {
    return await input.run();
  }

  // Path 2 — Langfuse configured. Wrap with trace + mirror.
  const trace = langfuse.trace({
    name: `${input.surface}.${input.taskType}`,
    userId: input.agencyOwnerId,
    metadata: {
      surface: input.surface,
      taskType: input.taskType,
      subjectKind: input.subject?.kind ?? null,
      subjectId: input.subject?.id ?? null,
    },
    tags: [
      `surface:${input.surface}`,
      `task:${input.taskType}`,
      ...(input.subject ? [`subject:${input.subject.kind}`] : []),
    ],
    input: input.inputForTrace,
  });

  const startedAt = Date.now();
  const generation = trace.generation({
    name: input.surface,
    input: input.inputForTrace,
    metadata: { taskType: input.taskType },
  });

  let result: T;
  try {
    result = await input.run();
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    const errorMessage = err instanceof Error ? err.message : String(err);
    try {
      generation.end({
        output: null,
        level: "ERROR",
        statusMessage: errorMessage.slice(0, 500),
      });
      trace.update({ output: { error: errorMessage } });
    } catch {
      /* ignore observability errors */
    }
    void indexTrace({
      agencyOwnerId: input.agencyOwnerId,
      langfuseTraceId: trace.id,
      surface: input.surface,
      taskType: input.taskType,
      subjectKind: input.subject?.kind,
      subjectId: input.subject?.id,
      totalTokens: 0,
      totalCostUsd: 0,
      latencyMs,
      status: "error",
      errorMessage: errorMessage.slice(0, 500),
    });
    // Best-effort flush so the trace lands even on cold-start serverless.
    try {
      await langfuse.flushAsync();
    } catch {
      /* ignore */
    }
    throw err;
  }

  const latencyMs = Date.now() - startedAt;
  const totalTokens = result.inputTokens + result.outputTokens;

  try {
    generation.end({
      output: result.text,
      model: result.model,
      usage: {
        input: result.inputTokens,
        output: result.outputTokens,
        total: totalTokens,
        unit: "TOKENS",
        inputCost: undefined,
        outputCost: undefined,
        totalCost: result.costUsd,
      },
    });
    trace.update({
      output: { text: result.text.slice(0, 2000) },
    });
  } catch (err) {
    console.error("[langfuse-client] generation.end failed", err);
  }

  void indexTrace({
    agencyOwnerId: input.agencyOwnerId,
    langfuseTraceId: trace.id,
    surface: input.surface,
    taskType: input.taskType,
    subjectKind: input.subject?.kind,
    subjectId: input.subject?.id,
    totalTokens,
    totalCostUsd: result.costUsd,
    latencyMs,
    status: "success",
  });

  // Best-effort flush — works around serverless cold-start losing background sends.
  try {
    await langfuse.flushAsync();
  } catch {
    /* ignore */
  }

  return result;
}

/**
 * Whether Langfuse is configured. Useful for hiding empty admin pages.
 */
export function isLangfuseConfigured(): boolean {
  return Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);
}

/**
 * Build the public Langfuse trace URL for click-through from our admin page.
 * Default base is the public cloud; override with `LANGFUSE_BASE_URL` for
 * self-hosted installs.
 */
export function langfuseTraceUrl(traceId: string): string {
  const base = (process.env.LANGFUSE_BASE_URL ?? "https://cloud.langfuse.com").replace(/\/$/, "");
  return `${base}/trace/${traceId}`;
}
