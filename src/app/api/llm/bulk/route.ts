import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  chatWithFallbackDetailed,
  counterfactualCloudUSD,
  priceRowUSD,
  type TaskType,
} from "@/lib/llm/router";

/**
 * POST /api/llm/bulk
 *
 * Batch LLM endpoint — routes each prompt through the dual-engine router
 * (local Ollama/RunPod when possible, cloud fallback otherwise).
 *
 * Body:
 *   {
 *     taskType: TaskType,        // required — drives local vs cloud routing
 *     prompts: string[],         // required — 1..50 prompts
 *     temperature?: number,
 *     maxTokens?: number,
 *     system?: string,           // optional shared system prompt
 *   }
 *
 * Returns:
 *   {
 *     results: [{ text, tier, model, latencyMs, fallbackUsed }],
 *     stats: {
 *       localCount, cloudCount, fallbackCount,
 *       totalMs, costUSD, savingsUSD
 *     }
 *   }
 */

const VALID_TASK_TYPES = new Set<TaskType>([
  "summarize",
  "classify",
  "extract",
  "score",
  "draft",
  "brainstorm",
  "translate",
  "explain",
  "first_pass",
  "code",
  "decide",
  "customer_facing",
  "tool_use",
  "security_review",
]);

const MAX_BATCH = 50;

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    taskType?: string;
    prompts?: unknown;
    temperature?: number;
    maxTokens?: number;
    system?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { taskType, prompts, temperature, maxTokens, system } = body;

  if (!taskType || !VALID_TASK_TYPES.has(taskType as TaskType)) {
    return NextResponse.json(
      { error: `Invalid taskType. Must be one of: ${Array.from(VALID_TASK_TYPES).join(", ")}` },
      { status: 400 },
    );
  }

  if (!Array.isArray(prompts) || prompts.length === 0) {
    return NextResponse.json(
      { error: "prompts must be a non-empty array of strings" },
      { status: 400 },
    );
  }

  if (prompts.length > MAX_BATCH) {
    return NextResponse.json(
      { error: `Batch size exceeds max (${MAX_BATCH})` },
      { status: 400 },
    );
  }

  if (!prompts.every((p) => typeof p === "string" && p.trim().length > 0)) {
    return NextResponse.json(
      { error: "All prompts must be non-empty strings" },
      { status: 400 },
    );
  }

  const typedTaskType = taskType as TaskType;

  // Run the batch in parallel — each call logs independently.
  const settled = await Promise.allSettled(
    (prompts as string[]).map((p) =>
      chatWithFallbackDetailed(p, typedTaskType, {
        temperature,
        maxTokens,
        system,
        userId: user.id,
      }),
    ),
  );

  const results: Array<{
    ok: boolean;
    text?: string;
    tier?: "local" | "cloud";
    model?: string;
    latencyMs?: number;
    fallbackUsed?: boolean;
    error?: string;
  }> = [];

  let localCount = 0;
  let cloudCount = 0;
  let fallbackCount = 0;
  let totalMs = 0;
  let costUSD = 0;
  let savingsUSD = 0;

  for (const s of settled) {
    if (s.status === "fulfilled") {
      const r = s.value;
      results.push({
        ok: true,
        text: r.text,
        tier: r.tier,
        model: r.model,
        latencyMs: r.latencyMs,
        fallbackUsed: r.fallbackUsed,
      });
      if (r.tier === "local") {
        localCount++;
        savingsUSD += counterfactualCloudUSD({
          tokens_in: r.tokensIn,
          tokens_out: r.tokensOut,
        });
      } else {
        cloudCount++;
        if (r.fallbackUsed) fallbackCount++;
        costUSD += priceRowUSD({
          tier: "cloud",
          model: r.model,
          tokens_in: r.tokensIn,
          tokens_out: r.tokensOut,
        });
      }
      totalMs += r.latencyMs;
    } else {
      results.push({
        ok: false,
        error: s.reason instanceof Error ? s.reason.message : String(s.reason),
      });
    }
  }

  return NextResponse.json({
    results,
    stats: {
      localCount,
      cloudCount,
      fallbackCount,
      totalMs,
      costUSD: Number(costUSD.toFixed(6)),
      savingsUSD: Number(savingsUSD.toFixed(6)),
    },
  });
}
