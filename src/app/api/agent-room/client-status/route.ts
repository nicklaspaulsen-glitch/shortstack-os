import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// Client-scoped variant of /api/agent-room/status.
//
// Same response shape, but filters trinity_log by client_id so the agency-
// room view in the *client portal* shows only work that touched THIS client.
// The agency-wide /api/agent-room/status remains unchanged so the agency view
// keeps showing every agent across every client.
//
// Auth model:
//   - Caller must be authenticated (Supabase session)
//   - The requested client_id must belong to the caller (clients.profile_id =
//     auth.uid()), OR the caller must already be impersonating that client
//     via the agency admin flow. We enforce ownership server-side here so a
//     malicious profile can't probe other agencies' client_ids.

export const runtime = "nodejs";

const LIVE_WINDOW_MS = 5 * 60 * 1000;
const RECENT_WINDOW_MS = 60 * 60 * 1000;

type AgentStatus = "live" | "recent" | "idle" | "error" | "disabled";

interface AgentRollup {
  id: string;
  status: AgentStatus;
  last_run_at: string | null;
  last_status: string | null;
  last_description: string | null;
  error_count_1h: number;
  total_runs_1h: number;
}

function deriveStatusFromRuns(
  lastRunAt: string | null,
  errorCount: number,
  totalRuns: number,
): AgentStatus {
  if (!lastRunAt) return "idle";
  const age = Date.now() - new Date(lastRunAt).getTime();
  if (totalRuns > 0 && errorCount / totalRuns >= 0.5) return "error";
  if (age <= LIVE_WINDOW_MS) return "live";
  if (age <= RECENT_WINDOW_MS) return "recent";
  return "idle";
}

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("client_id");
  if (!clientId) {
    return NextResponse.json({ error: "client_id required" }, { status: 400 });
  }

  // Ownership check — service client because RLS on `clients` is set up to
  // hide other agencies' rows entirely; we want the explicit "Forbidden" so
  // the caller knows their request was rejected.
  const service = createServiceClient();
  const { data: client } = await service
    .from("clients")
    .select("id, profile_id")
    .eq("id", clientId)
    .maybeSingle();

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  if (client.profile_id !== user.id) {
    // The caller's profile doesn't own this client. We do NOT support
    // cross-tenant client viewing here — the agency-side admin impersonation
    // flow would need a separate route if it ever needs to see this view.
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Pull the last hour of trinity_log entries that mention this client_id.
  // Some legacy log rows store client_id in `result` or `metadata` — we
  // scope to the typed column for now and let the query stay cheap +
  // indexed. Backfilling old rows is a separate cleanup.
  const oneHourAgo = new Date(Date.now() - RECENT_WINDOW_MS).toISOString();
  const { data: logs } = await service
    .from("trinity_log")
    .select("agent, action_type, description, status, created_at")
    .eq("client_id", clientId)
    .gte("created_at", oneHourAgo)
    .order("created_at", { ascending: false })
    .limit(500);

  const agentMap: Record<string, AgentRollup> = {};
  for (const row of logs ?? []) {
    const id = (row.agent as string | null) ?? "unknown";
    const entry = (agentMap[id] ??= {
      id,
      status: "idle",
      last_run_at: null,
      last_status: null,
      last_description: null,
      error_count_1h: 0,
      total_runs_1h: 0,
    });
    entry.total_runs_1h += 1;
    if ((row.status as string | null) === "failed") entry.error_count_1h += 1;
    if (!entry.last_run_at) {
      entry.last_run_at = row.created_at as string;
      entry.last_status = (row.status as string | null) ?? null;
      entry.last_description = (row.description as string | null) ?? null;
    }
  }

  for (const entry of Object.values(agentMap)) {
    entry.status = deriveStatusFromRuns(
      entry.last_run_at,
      entry.error_count_1h,
      entry.total_runs_1h,
    );
  }

  // Client-scoped view does NOT include integration env-var gates — those
  // are agency plumbing and shouldn't be visible to clients.
  return NextResponse.json({
    generated_at: new Date().toISOString(),
    client_id: clientId,
    agents: agentMap,
    integrations: {},
  });
}
