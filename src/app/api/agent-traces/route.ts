/**
 * Agent traces API.
 *
 * GET /api/agent-traces?surface=&subject_kind=&since=&status=&limit=
 *
 * Lists rows from `agent_trace_index` (our local mirror of Langfuse traces)
 * for the calling agency owner. Each row carries a `langfuse_trace_id` which
 * the UI uses to deep-link into the Langfuse dashboard.
 *
 * Filters (all optional):
 *   surface       - 'cold_email' | 'sales_coach' | etc.
 *   subject_kind  - 'lead' | 'client' | etc.
 *   status        - 'success' | 'error' | 'fallback'
 *   since         - ISO timestamp; defaults to 24h ago
 *   limit         - 1..200, defaults to 50
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { langfuseTraceUrl } from "@/lib/ai/langfuse-client";

export const dynamic = "force-dynamic";

function parseLimit(raw: string | null): number {
  if (!raw) return 50;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return 50;
  return Math.max(1, Math.min(200, n));
}

function parseSince(raw: string | null): string {
  if (raw && !Number.isNaN(Date.parse(raw))) return new Date(raw).toISOString();
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const surface = params.get("surface");
  const subjectKind = params.get("subject_kind");
  const status = params.get("status");
  const since = parseSince(params.get("since"));
  const limit = parseLimit(params.get("limit"));

  let query = supabase
    .from("agent_trace_index")
    .select(
      "id, langfuse_trace_id, agent_surface, related_subject_kind, related_subject_id, task_type, total_tokens, total_cost_usd, latency_ms, status, error_message, created_at",
    )
    .eq("agency_owner_id", ownerId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (surface) query = query.eq("agent_surface", surface);
  if (subjectKind) query = query.eq("related_subject_kind", subjectKind);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "Failed to load traces" },
      { status: 500 },
    );
  }

  // Decorate every row with the public Langfuse deep-link.
  const decorated = (data ?? []).map((row) => ({
    ...row,
    langfuse_url: langfuseTraceUrl(row.langfuse_trace_id),
  }));

  // Aggregate stats over the same window.
  const totals = decorated.reduce(
    (acc, row) => {
      acc.totalCalls += 1;
      acc.totalTokens += row.total_tokens ?? 0;
      acc.totalCostUsd += Number(row.total_cost_usd ?? 0);
      acc.totalLatencyMs += row.latency_ms ?? 0;
      if (row.status === "error") acc.errorCount += 1;
      return acc;
    },
    {
      totalCalls: 0,
      totalTokens: 0,
      totalCostUsd: 0,
      totalLatencyMs: 0,
      errorCount: 0,
    },
  );

  return NextResponse.json({
    success: true,
    data: decorated,
    meta: {
      total: decorated.length,
      since,
      stats: {
        total_calls: totals.totalCalls,
        total_tokens: totals.totalTokens,
        total_cost_usd: Math.round(totals.totalCostUsd * 10000) / 10000,
        avg_latency_ms:
          totals.totalCalls > 0
            ? Math.round(totals.totalLatencyMs / totals.totalCalls)
            : 0,
        error_rate:
          totals.totalCalls > 0
            ? Math.round((totals.errorCount / totals.totalCalls) * 1000) / 1000
            : 0,
      },
    },
  });
}
