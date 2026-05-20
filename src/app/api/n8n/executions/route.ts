import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// GET /api/n8n/executions
//
// Proxies the n8n executions API and computes derived analytics so the
// workflows analytics tab can show real numbers instead of hardcoded zeros.
//
// Query params:
//   limit?       — number of executions to fetch (default 50, max 100)
//   workflowId?  — filter to a specific workflow
//
// Auth: session required (clients are blocked server-side).
// Requires N8N_URL + N8N_API_KEY env vars — returns { available: false } when unset.
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.role === "client") {
    return NextResponse.json({ error: "Operators only" }, { status: 403 });
  }

  const n8nUrl = process.env.N8N_URL;
  const n8nKey = process.env.N8N_API_KEY;

  if (!n8nUrl || !n8nKey) {
    return NextResponse.json({ available: false, executions: [], analytics: null });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") || "50"), 100);
  const workflowId = searchParams.get("workflowId") || "";

  try {
    const qs = new URLSearchParams({ limit: String(limit), ...(workflowId ? { workflowId } : {}) });
    const res = await fetch(`${n8nUrl}/api/v1/executions?${qs}`, {
      headers: { "X-N8N-API-KEY": n8nKey },
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      console.error("[n8n/executions] n8n returned", res.status, msg);
      return NextResponse.json({ error: "n8n request failed", status: res.status }, { status: 502 });
    }

    const raw = await res.json();
    // n8n returns { data: [...], nextCursor? } for paginated endpoints
    const executions: Array<{
      id: string;
      finished: boolean;
      mode: string;
      startedAt: string;
      stoppedAt?: string;
      status: string;
      workflowId: string;
      workflowData?: { name?: string };
    }> = Array.isArray(raw) ? raw : (raw.data ?? []);

    // Compute analytics from the fetched batch
    const total = executions.length;
    const succeeded = executions.filter(e => e.status === "success").length;
    const failed = executions.filter(e => e.status === "error" || e.status === "crashed").length;
    const successRate = total > 0 ? Math.round((succeeded / total) * 100) : 0;

    const durationsMs = executions
      .filter(e => e.startedAt && e.stoppedAt)
      .map(e => new Date(e.stoppedAt!).getTime() - new Date(e.startedAt).getTime())
      .filter(d => d >= 0 && d < 3_600_000); // ignore bogus values > 1 hour

    const avgDurationMs = durationsMs.length > 0
      ? durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length
      : 0;
    const avgDuration = avgDurationMs >= 60_000
      ? `${Math.round(avgDurationMs / 60_000)}m`
      : avgDurationMs >= 1_000
        ? `${(avgDurationMs / 1_000).toFixed(1)}s`
        : "--";

    // Rough "hours saved" heuristic: each successful run ≈ 5 min of manual work
    const savedHours = Math.round((succeeded * 5) / 60);

    // Normalised run-history rows for the Recent Runs table
    const runHistory = executions.slice(0, 25).map(e => {
      const durationMs = e.startedAt && e.stoppedAt
        ? new Date(e.stoppedAt).getTime() - new Date(e.startedAt).getTime()
        : null;
      const durationStr = durationMs != null && durationMs >= 0
        ? durationMs >= 60_000
          ? `${Math.round(durationMs / 60_000)}m ${Math.round((durationMs % 60_000) / 1_000)}s`
          : `${(durationMs / 1_000).toFixed(1)}s`
        : "--";

      const ts = e.startedAt
        ? new Date(e.startedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
        : "--";

      return {
        id: String(e.id).slice(-6),
        workflow: e.workflowData?.name || `wf-${e.workflowId}`,
        status: (e.status === "success" ? "success" : "failed") as "success" | "failed",
        duration: durationStr,
        steps: 0, // n8n executions list doesn't include step count without fetching each execution
        timestamp: ts,
      };
    });

    return NextResponse.json({
      available: true,
      executions,
      analytics: {
        totalRuns: total,
        successRate,
        avgDuration,
        failedRuns: failed,
        savedHours,
      },
      runHistory,
    });
  } catch (err) {
    console.error("[n8n/executions] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
