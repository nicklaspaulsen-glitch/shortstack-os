/**
 * GET /api/admin/llm-costs
 *
 * Admin/founder dashboard data — aggregates llm_usage_events into the
 * shapes the dashboard needs:
 *   - this-month spend / last-month spend (with delta)
 *   - top tasks by cost
 *   - top models by cost
 *   - simple optimisation suggestions (e.g. "20% of code_review is on Sonnet,
 *     try qwen3-coder")
 *
 * Gated to role === "admin" or "founder".
 */
import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface UsageRow {
  task_type: string;
  provider: string;
  model: string;
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  duration_ms: number | null;
  context: string | null;
  created_at: string;
}

interface TaskBucket {
  task_type: string;
  cost_usd: number;
  call_count: number;
  total_tokens: number;
  models: Record<string, number>; // model -> cost
}

interface ModelBucket {
  model: string;
  provider: string;
  cost_usd: number;
  call_count: number;
  total_tokens: number;
}

interface OptimisationHint {
  severity: "low" | "medium" | "high";
  message: string;
  estimated_savings_usd?: number;
}

interface CostsResponse {
  this_month_usd: number;
  last_month_usd: number;
  delta_pct: number;
  total_calls_this_month: number;
  top_tasks: Array<{
    task_type: string;
    cost_usd: number;
    call_count: number;
    avg_cost_usd: number;
  }>;
  top_models: Array<{
    model: string;
    provider: string;
    cost_usd: number;
    call_count: number;
  }>;
  daily_series: Array<{ date: string; cost_usd: number; calls: number }>;
  hints: OptimisationHint[];
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function startOfPrevMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
}

function deltaPct(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Build optimisation hints. Heuristics:
 *  - If a task has >X% spend on a more expensive model than its cheap fallback
 *    (e.g. code_review on Sonnet rather than qwen3-coder), suggest the swap.
 *  - If Opus accounts for >50% of total spend, flag it as the biggest saver.
 */
function buildHints(
  topTasks: CostsResponse["top_tasks"],
  taskBuckets: Map<string, TaskBucket>,
  totalCost: number,
): OptimisationHint[] {
  const hints: OptimisationHint[] = [];

  for (const t of topTasks) {
    const bucket = taskBuckets.get(t.task_type);
    if (!bucket) continue;

    // Code review on Sonnet — qwen3-coder is the cheap target.
    if (t.task_type === "code_review") {
      const sonnetCost = Object.entries(bucket.models)
        .filter(([m]) => m.includes("sonnet"))
        .reduce((acc, [, c]) => acc + c, 0);
      if (sonnetCost > 0 && bucket.cost_usd > 0) {
        const sonnetShare = sonnetCost / bucket.cost_usd;
        if (sonnetShare > 0.2) {
          hints.push({
            severity: "medium",
            message: `${(sonnetShare * 100).toFixed(0)}% of code_review spend is on Sonnet — set OPENROUTER_API_KEY so qwen3-coder takes the primary slot.`,
            estimated_savings_usd: sonnetCost * 0.85,
          });
        }
      }
    }

    // Caption generation should mostly be Haiku/Llama. Flag any Opus drift.
    if (t.task_type === "caption_generation") {
      const opusCost = Object.entries(bucket.models)
        .filter(([m]) => m.includes("opus"))
        .reduce((acc, [, c]) => acc + c, 0);
      if (opusCost > 0) {
        hints.push({
          severity: "high",
          message: `Opus is being used for caption_generation ($${opusCost.toFixed(2)}). Captions should ride Haiku — investigate any forceModel calls.`,
          estimated_savings_usd: opusCost * 0.93,
        });
      }
    }
  }

  // Opus is dominating overall spend.
  let opusTotal = 0;
  taskBuckets.forEach((bucket) => {
    for (const [model, cost] of Object.entries(bucket.models)) {
      if (model.includes("opus")) opusTotal += Number(cost);
    }
  });
  if (totalCost > 0 && opusTotal / totalCost > 0.5) {
    hints.push({
      severity: "high",
      message: `Opus is ${((opusTotal / totalCost) * 100).toFixed(0)}% of monthly spend. Audit which task types are routing to Opus and consider Sonnet for any non-complex_analysis flows.`,
      estimated_savings_usd: opusTotal * 0.8,
    });
  }

  if (hints.length === 0) {
    hints.push({
      severity: "low",
      message: "Routing looks healthy — no obvious cost outliers detected.",
    });
  }

  return hints;
}

export async function GET() {
  const authClient = createServerSupabase();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await authClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin" && profile?.role !== "founder") {
    return NextResponse.json({ error: "Admin or founder only" }, { status: 403 });
  }

  const service = createServiceClient();
  const now = new Date();
  const monthStart = startOfMonth(now);
  const prevMonthStart = startOfPrevMonth(now);

  // Pull both months in one query — bounded by created_at >= prevMonthStart.
  const { data, error } = await service
    .from("llm_usage_events")
    .select(
      "task_type, provider, model, cost_usd, input_tokens, output_tokens, duration_ms, context, created_at",
    )
    .gte("created_at", prevMonthStart.toISOString())
    .order("created_at", { ascending: false })
    .limit(50000);

  if (error) {
    console.error("[admin/llm-costs] supabase error", error);
    return NextResponse.json(
      { error: "Failed to load usage events" },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as UsageRow[];

  let thisMonthCost = 0;
  let lastMonthCost = 0;
  let thisMonthCalls = 0;
  const taskBuckets = new Map<string, TaskBucket>();
  const modelBuckets = new Map<string, ModelBucket>();
  const dailySeriesMap = new Map<string, { cost_usd: number; calls: number }>();

  for (const r of rows) {
    const created = new Date(r.created_at);
    const inThisMonth = created >= monthStart;
    const cost = Number(r.cost_usd) || 0;

    if (inThisMonth) {
      thisMonthCost += cost;
      thisMonthCalls += 1;

      // task bucket
      const tb = taskBuckets.get(r.task_type) ?? {
        task_type: r.task_type,
        cost_usd: 0,
        call_count: 0,
        total_tokens: 0,
        models: {},
      };
      tb.cost_usd += cost;
      tb.call_count += 1;
      tb.total_tokens += (r.input_tokens || 0) + (r.output_tokens || 0);
      tb.models[r.model] = (tb.models[r.model] ?? 0) + cost;
      taskBuckets.set(r.task_type, tb);

      // model bucket
      const mb = modelBuckets.get(r.model) ?? {
        model: r.model,
        provider: r.provider,
        cost_usd: 0,
        call_count: 0,
        total_tokens: 0,
      };
      mb.cost_usd += cost;
      mb.call_count += 1;
      mb.total_tokens += (r.input_tokens || 0) + (r.output_tokens || 0);
      modelBuckets.set(r.model, mb);

      // daily series — UTC date key
      const key = created.toISOString().slice(0, 10);
      const existing = dailySeriesMap.get(key) ?? { cost_usd: 0, calls: 0 };
      existing.cost_usd += cost;
      existing.calls += 1;
      dailySeriesMap.set(key, existing);
    } else {
      lastMonthCost += cost;
    }
  }

  const topTasks = Array.from(taskBuckets.values())
    .sort((a, b) => b.cost_usd - a.cost_usd)
    .slice(0, 10)
    .map((b) => ({
      task_type: b.task_type,
      cost_usd: Number(b.cost_usd.toFixed(4)),
      call_count: b.call_count,
      avg_cost_usd: Number((b.cost_usd / Math.max(1, b.call_count)).toFixed(4)),
    }));

  const topModels = Array.from(modelBuckets.values())
    .sort((a, b) => b.cost_usd - a.cost_usd)
    .slice(0, 10)
    .map((b) => ({
      model: b.model,
      provider: b.provider,
      cost_usd: Number(b.cost_usd.toFixed(4)),
      call_count: b.call_count,
    }));

  const dailySeries = Array.from(dailySeriesMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      cost_usd: Number(v.cost_usd.toFixed(4)),
      calls: v.calls,
    }));

  const response: CostsResponse = {
    this_month_usd: Number(thisMonthCost.toFixed(4)),
    last_month_usd: Number(lastMonthCost.toFixed(4)),
    delta_pct: Number(deltaPct(thisMonthCost, lastMonthCost).toFixed(2)),
    total_calls_this_month: thisMonthCalls,
    top_tasks: topTasks,
    top_models: topModels,
    daily_series: dailySeries,
    hints: buildHints(topTasks, taskBuckets, thisMonthCost),
  };

  return NextResponse.json(response);
}
