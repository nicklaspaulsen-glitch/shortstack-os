/**
 * Claude API cost-reduction layer.
 *
 * Wraps @anthropic-ai/sdk with:
 *   - sendCached()       → synchronous call with prompt caching (90% discount on cache hits)
 *   - submitBatch()      → Message Batches API (50% discount, 24h SLA)
 *   - getBatchResults()  → poll + retrieve completed batch jobs
 *   - logUsage()         → persist token usage + cache hit stats per call
 *
 * Kill-switch: set `DISABLE_AI_OPTIMIZATIONS=true` to fall back to
 * synchronous uncached calls (batch submissions route to sendCached instead).
 */
import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/server";
import { MODEL_HAIKU, MODEL_SONNET, getResponseText } from "@/lib/ai/claude-helpers";

// -------------------------------------------------------------------------
// Pricing (USD per million tokens) — keep in sync with Anthropic price page.
// -------------------------------------------------------------------------
type ModelKey = "haiku" | "sonnet" | "opus";

interface ModelPricing {
  input: number;        // base input
  output: number;       // output
  cacheWrite: number;   // 5m cache write
  cacheRead: number;    // cache hit (90% cheaper than input)
}

const PRICING: Record<ModelKey, ModelPricing> = {
  haiku: { input: 1.0, output: 5.0, cacheWrite: 1.25, cacheRead: 0.1 },
  sonnet: { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.3 },
  opus: { input: 5.0, output: 25.0, cacheWrite: 6.25, cacheRead: 0.5 },
};

const BATCH_DISCOUNT = 0.5; // 50% off on message batches

export function modelKey(model: string): ModelKey {
  if (model.includes("haiku")) return "haiku";
  if (model.includes("opus")) return "opus";
  return "sonnet";
}

function estimateCost(
  input: number,
  output: number,
  cacheWrite: number,
  cacheRead: number,
  model: string,
  batched = false,
): number {
  const p = PRICING[modelKey(model)];
  const cost =
    (input / 1_000_000) * p.input +
    (output / 1_000_000) * p.output +
    (cacheWrite / 1_000_000) * p.cacheWrite +
    (cacheRead / 1_000_000) * p.cacheRead;
  return batched ? cost * BATCH_DISCOUNT : cost;
}

// -------------------------------------------------------------------------
// Usage logging
// -------------------------------------------------------------------------
export interface UsageLogInput {
  user_id?: string | null;
  endpoint: string;        // "smart-manage", "daily-briefing", "lead-scoring", ...
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  batched?: boolean;
  had_cache_hit?: boolean;
}

export async function logUsage(entry: UsageLogInput): Promise<void> {
  try {
    const cacheWrite = entry.cache_creation_input_tokens || 0;
    const cacheRead = entry.cache_read_input_tokens || 0;
    const cost = estimateCost(
      entry.input_tokens,
      entry.output_tokens,
      cacheWrite,
      cacheRead,
      entry.model,
      !!entry.batched,
    );
    // What it would have cost without any optimization (no batch, no cache):
    const baselineCost = estimateCost(
      entry.input_tokens + cacheWrite + cacheRead,
      entry.output_tokens,
      0,
      0,
      entry.model,
      false,
    );
    const savings = Math.max(0, baselineCost - cost);

    const supabase = createServiceClient();
    await supabase.from("ai_cache_stats").insert({
      user_id: entry.user_id || null,
      endpoint: entry.endpoint,
      model: entry.model,
      input_tokens: entry.input_tokens,
      output_tokens: entry.output_tokens,
      cache_creation_tokens: cacheWrite,
      cache_read_tokens: cacheRead,
      batched: !!entry.batched,
      had_cache_hit: !!entry.had_cache_hit || cacheRead > 0,
      estimated_cost_usd: cost,
      baseline_cost_usd: baselineCost,
      savings_usd: savings,
    });
  } catch (err) {
    // Never break the caller if logging fails.
    console.error("[claude-client] logUsage failed:", err);
  }
}

// -------------------------------------------------------------------------
// Shared client
// -------------------------------------------------------------------------
function client(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function optimizationsDisabled(): boolean {
  return process.env.DISABLE_AI_OPTIMIZATIONS === "true";
}

// -------------------------------------------------------------------------
// sendCached — single call with prompt caching
// -------------------------------------------------------------------------
export interface SendCachedOptions {
  model?: string;
  system: string;                         // the large, reusable prefix we want cached
  userMessage: string;                    // the volatile per-request content
  maxTokens?: number;
  temperature?: number;
  endpoint: string;                       // for usage logging
  userId?: string | null;
  cacheSystem?: boolean;                  // default true — only set false if system < 1024 tokens
}

export interface SendCachedResult {
  text: string;
  usage: Anthropic.Messages.Usage;
  cached: boolean;                        // true when cache_read_input_tokens > 0
}

export async function sendCached(opts: SendCachedOptions): Promise<SendCachedResult> {
  const model = opts.model || MODEL_HAIKU;
  const maxTokens = opts.maxTokens ?? 1024;
  const cacheSystem = opts.cacheSystem !== false;

  const anth = client();

  // Build system. When cacheSystem is true and optimizations are ON, mark the
  // system prompt as ephemeral-cacheable. Otherwise pass as a plain string.
  const systemParam: string | Array<Anthropic.Messages.TextBlockParam> =
    cacheSystem && !optimizationsDisabled()
      ? [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }]
      : opts.system;

  const response = await anth.messages.create({
    model,
    max_tokens: maxTokens,
    ...(typeof opts.temperature === "number" ? { temperature: opts.temperature } : {}),
    system: systemParam,
    messages: [{ role: "user", content: opts.userMessage }],
  });

  const text = getResponseText(response);
  const usage = response.usage;
  const cached = (usage.cache_read_input_tokens || 0) > 0;

  // Fire-and-forget usage log
  void logUsage({
    user_id: opts.userId,
    endpoint: opts.endpoint,
    model,
    input_tokens: usage.input_tokens || 0,
    output_tokens: usage.output_tokens || 0,
    cache_creation_input_tokens: usage.cache_creation_input_tokens || 0,
    cache_read_input_tokens: usage.cache_read_input_tokens || 0,
    batched: false,
    had_cache_hit: cached,
  });

  return { text, usage, cached };
}

// -------------------------------------------------------------------------
// Batch API
// -------------------------------------------------------------------------
export interface BatchItem {
  custom_id: string;                      // your key to match results back
  system: string;
  userMessage: string;
  maxTokens?: number;
  temperature?: number;
}

export interface SubmitBatchOptions {
  model?: string;
  endpoint: string;                       // for logging
  userId?: string | null;
  items: BatchItem[];
  cacheSystem?: boolean;
}

export interface SubmitBatchResult {
  batch_id: string;
  item_count: number;
  /** True when batch was routed to sendCached because optimizations disabled or empty. */
  fallback_synchronous?: boolean;
  /** Populated only when fallback_synchronous is true. */
  synchronous_results?: Array<{ custom_id: string; text: string }>;
}

/**
 * Submit a set of messages to the Anthropic Message Batches API.
 * Returns the batch_id; poll via getBatchResults() later.
 *
 * If DISABLE_AI_OPTIMIZATIONS=true, falls back to synchronous sendCached
 * calls and returns the results inline so callers can keep the same flow.
 */
export async function submitBatch(opts: SubmitBatchOptions): Promise<SubmitBatchResult> {
  const model = opts.model || MODEL_HAIKU;
  if (!opts.items.length) {
    return { batch_id: "", item_count: 0, fallback_synchronous: true, synchronous_results: [] };
  }

  // Kill-switch — synchronous fallback.
  if (optimizationsDisabled()) {
    const results = await Promise.all(
      opts.items.map(async (it) => {
        const r = await sendCached({
          model,
          system: it.system,
          userMessage: it.userMessage,
          maxTokens: it.maxTokens,
          temperature: it.temperature,
          endpoint: opts.endpoint,
          userId: opts.userId,
          cacheSystem: opts.cacheSystem,
        });
        return { custom_id: it.custom_id, text: r.text };
      }),
    );
    return {
      batch_id: "",
      item_count: opts.items.length,
      fallback_synchronous: true,
      synchronous_results: results,
    };
  }

  const anth = client();
  const cacheSystem = opts.cacheSystem !== false;

  const requests = opts.items.map((it) => {
    const systemParam: string | Array<Anthropic.Messages.TextBlockParam> = cacheSystem
      ? [{ type: "text", text: it.system, cache_control: { type: "ephemeral" } }]
      : it.system;
    return {
      custom_id: it.custom_id,
      params: {
        model,
        max_tokens: it.maxTokens ?? 1024,
        ...(typeof it.temperature === "number" ? { temperature: it.temperature } : {}),
        system: systemParam,
        messages: [{ role: "user" as const, content: it.userMessage }],
      },
    };
  });

  // @ts-expect-error - batches API typing may vary by SDK minor version
  const batch = await anth.messages.batches.create({ requests });

  // Persist job record so we can poll + aggregate savings later.
  try {
    const supabase = createServiceClient();
    await supabase.from("ai_batch_jobs").insert({
      batch_id: batch.id,
      user_id: opts.userId || null,
      endpoint: opts.endpoint,
      model,
      item_count: opts.items.length,
      status: "in_progress",
      submitted_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[claude-client] batch_jobs insert failed:", err);
  }

  return { batch_id: batch.id, item_count: opts.items.length };
}

// -------------------------------------------------------------------------
// getBatchResults — poll a batch + drain results into caller
// -------------------------------------------------------------------------
export interface BatchResultEntry {
  custom_id: string;
  text: string | null;
  error: string | null;
  usage: Anthropic.Messages.Usage | null;
}

export interface GetBatchResultsOutput {
  status: "in_progress" | "ended" | "canceled" | "expired";
  results: BatchResultEntry[];
}

export async function getBatchResults(batchId: string): Promise<GetBatchResultsOutput> {
  if (!batchId) return { status: "ended", results: [] };

  const anth = client();

  // @ts-expect-error - batches API typing may vary by SDK minor version
  const batch = await anth.messages.batches.retrieve(batchId);

  const status =
    batch.processing_status === "in_progress"
      ? "in_progress"
      : batch.processing_status === "canceled"
        ? "canceled"
        : batch.processing_status === "expired"
          ? "expired"
          : "ended";

  if (status !== "ended") {
    return { status, results: [] };
  }

  const entries: BatchResultEntry[] = [];
  try {
    // @ts-expect-error - results iterator typing varies
    const stream = await anth.messages.batches.results(batchId);
    for await (const item of stream) {
      const customId: string = item.custom_id;
      if (item.result?.type === "succeeded") {
        const msg = item.result.message;
        const text = (msg.content || [])
          .filter((b: { type: string }) => b.type === "text")
          .map((b: { text: string }) => b.text)
          .join("");
        entries.push({ custom_id: customId, text, error: null, usage: msg.usage });
      } else if (item.result?.type === "errored") {
        entries.push({
          custom_id: customId,
          text: null,
          error: item.result.error?.message || "errored",
          usage: null,
        });
      } else {
        entries.push({
          custom_id: customId,
          text: null,
          error: item.result?.type || "unknown",
          usage: null,
        });
      }
    }
  } catch (err) {
    console.error("[claude-client] results iterator failed:", err);
  }

  // Mark job completed + roll up totals into ai_cache_stats for the dashboard.
  try {
    const supabase = createServiceClient();
    const { data: job } = await supabase
      .from("ai_batch_jobs")
      .select("*")
      .eq("batch_id", batchId)
      .maybeSingle();
    if (job) {
      await supabase
        .from("ai_batch_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          successful: entries.filter((e) => !e.error).length,
          failed: entries.filter((e) => e.error).length,
        })
        .eq("batch_id", batchId);

      // Aggregate usage across entries and log as one row per job.
      const totalInput = entries.reduce((s, e) => s + (e.usage?.input_tokens || 0), 0);
      const totalOutput = entries.reduce((s, e) => s + (e.usage?.output_tokens || 0), 0);
      const totalCacheWrite = entries.reduce(
        (s, e) => s + (e.usage?.cache_creation_input_tokens || 0),
        0,
      );
      const totalCacheRead = entries.reduce(
        (s, e) => s + (e.usage?.cache_read_input_tokens || 0),
        0,
      );
      await logUsage({
        user_id: job.user_id,
        endpoint: job.endpoint,
        model: job.model,
        input_tokens: totalInput,
        output_tokens: totalOutput,
        cache_creation_input_tokens: totalCacheWrite,
        cache_read_input_tokens: totalCacheRead,
        batched: true,
        had_cache_hit: totalCacheRead > 0,
      });
    }
  } catch (err) {
    console.error("[claude-client] batch completion bookkeeping failed:", err);
  }

  return { status: "ended", results: entries };
}

// Re-export common model constants for convenience.
export { MODEL_HAIKU, MODEL_SONNET };
