/**
 * Input-hash-keyed AI output cache.
 *
 * Stores Claude responses keyed by sha256(model+system+messages+temperature)
 * with a 7-day TTL. Hits increment `hits` and refresh `last_hit_at`.
 *
 * This sits ON TOP of Anthropic's prompt-caching (which reduces input cost
 * within a session); output-cache reduces cost to zero when the same exact
 * input is re-sent across sessions/machines.
 *
 * Kill-switch: DISABLE_OUTPUT_CACHE=true bypasses all reads/writes.
 */

import { createHash } from "crypto";

import { createServiceClient } from "@/lib/supabase/server";

export interface HashInput {
  model: string;
  system?: string;
  messages: Array<{ role: string; content: unknown }>;
  temperature?: number;
}

export interface CachedEntry {
  output: string;
  cachedAt: string;
  hits: number;
  outputTokens: number;
}

function killSwitchOn(): boolean {
  return process.env.DISABLE_OUTPUT_CACHE === "true";
}

/**
 * Deterministic sha256 of the full Claude input payload.
 * Stringifies with sorted keys so cache keys are stable across serialization order.
 */
export function hashInput(input: HashInput): string {
  const canonical = {
    model: input.model,
    system: input.system ?? "",
    messages: input.messages,
    temperature: input.temperature ?? 0,
  };
  const json = stableStringify(canonical);
  return createHash("sha256").update(json).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map((v) => stableStringify(v)).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    "{" +
    keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") +
    "}"
  );
}

/**
 * Look up a cached output by hash. Returns null on miss or if expired.
 * On hit, increments `hits` and refreshes `last_hit_at`.
 */
export async function getCached(hash: string): Promise<CachedEntry | null> {
  if (killSwitchOn()) return null;
  if (!hash) return null;

  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("ai_output_cache")
    .select("id, output_content, output_tokens, created_at, hits, expires_at")
    .eq("input_hash", hash)
    .gt("expires_at", nowIso)
    .maybeSingle();

  if (error) {
    console.error("[output-cache] getCached failed", error);
    return null;
  }
  if (!data) return null;

  // Touch — fire and forget
  const newHits = Number(data.hits ?? 0) + 1;
  supabase
    .from("ai_output_cache")
    .update({ hits: newHits, last_hit_at: nowIso })
    .eq("id", data.id)
    .then(({ error: touchErr }) => {
      if (touchErr) console.error("[output-cache] touch failed", touchErr);
    });

  return {
    output: data.output_content,
    cachedAt: data.created_at,
    hits: newHits,
    outputTokens: Number(data.output_tokens ?? 0),
  };
}

export interface SetCachedArgs {
  hash: string;
  output: string;
  model: string;
  outputTokens: number;
  orgId?: string | null;
}

/**
 * Store a response. Idempotent via unique(input_hash).
 * If a row already exists (concurrent writes), we silently swallow the conflict.
 */
export async function setCached(args: SetCachedArgs): Promise<void> {
  if (killSwitchOn()) return;
  if (!args.hash || !args.output) return;

  const supabase = createServiceClient();
  const { error } = await supabase.from("ai_output_cache").insert({
    input_hash: args.hash,
    model: args.model,
    output_content: args.output,
    output_tokens: args.outputTokens,
    created_by_org_id: args.orgId ?? null,
  });

  if (error && !isUniqueViolation(error)) {
    console.error("[output-cache] setCached failed", error);
  }
}

function isUniqueViolation(err: { code?: string; message?: string }): boolean {
  return err?.code === "23505" || /duplicate key/i.test(err?.message ?? "");
}

/**
 * Delete expired rows. Called from the daily maintenance cron.
 * Returns the number of rows deleted.
 */
export async function cleanup(): Promise<{ deleted: number }> {
  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();

  const { error, count } = await supabase
    .from("ai_output_cache")
    .delete({ count: "exact" })
    .lt("expires_at", nowIso);

  if (error) {
    console.error("[output-cache] cleanup failed", error);
    return { deleted: 0 };
  }
  return { deleted: count ?? 0 };
}

/**
 * Aggregate stats for the AI-cost dashboard.
 */
export interface CacheStats {
  totalRows: number;
  rowsWithHits: number;
  totalHits: number;
  hitRatePct: number;
  estOutputTokensSaved: number;
  estUsdSaved: number;
}

// Rough blended rate for Sonnet output: ~$15/MTok. Conservative.
const USD_PER_OUTPUT_TOKEN = 15 / 1_000_000;

export async function getStats(): Promise<CacheStats> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("ai_output_cache")
    .select("hits, output_tokens");

  if (error || !data) {
    return {
      totalRows: 0,
      rowsWithHits: 0,
      totalHits: 0,
      hitRatePct: 0,
      estOutputTokensSaved: 0,
      estUsdSaved: 0,
    };
  }

  const totalRows = data.length;
  let rowsWithHits = 0;
  let totalHits = 0;
  let estOutputTokensSaved = 0;

  for (const row of data) {
    const hits = Number(row.hits ?? 0);
    const tokens = Number(row.output_tokens ?? 0);
    if (hits > 0) rowsWithHits++;
    totalHits += hits;
    estOutputTokensSaved += hits * tokens;
  }

  // Every cache hit = one API call avoided. Rough "total calls" = totalRows + totalHits.
  const totalCalls = totalRows + totalHits;
  const hitRatePct =
    totalCalls > 0 ? Math.round((totalHits / totalCalls) * 10000) / 100 : 0;
  const estUsdSaved =
    Math.round(estOutputTokensSaved * USD_PER_OUTPUT_TOKEN * 10000) / 10000;

  return {
    totalRows,
    rowsWithHits,
    totalHits,
    hitRatePct,
    estOutputTokensSaved,
    estUsdSaved,
  };
}
