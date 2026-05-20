import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Do NOT fall back to a hardcoded URL — that would commit infrastructure
// topology to git history and route traffic to the wrong instance if the
// env var is accidentally unset.
const N8N_URL = process.env.N8N_URL ?? "";
const N8N_API_KEY = process.env.N8N_API_KEY || "";

async function n8nFetch(path: string, options?: RequestInit) {
  if (!N8N_URL) throw new Error("N8N_URL env var not configured");
  const res = await fetch(`${N8N_URL}/api/v1${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-N8N-API-KEY": N8N_API_KEY,
      ...options?.headers,
    },
  });
  return res.json();
}

// ── Types for n8n API responses ───────────────────────────────────────────────

interface N8NWorkflowRaw {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  tags?: Array<{ id?: string; name: string }>;
  nodes?: Array<{ type: string; [key: string]: unknown }>;
}

interface N8NExecutionRaw {
  id: string;
  workflowId: string;
  finished: boolean;
  mode: string;
  startedAt: string;
  stoppedAt?: string;
  status?: string;
}

function normaliseStatus(
  raw?: string,
): "success" | "error" | "running" | "waiting" | undefined {
  if (!raw) return undefined;
  if (raw === "success") return "success";
  if (raw === "error" || raw === "crashed" || raw === "failed") return "error";
  if (raw === "running" || raw === "new") return "running";
  if (raw === "waiting") return "waiting";
  return undefined;
}

// GET — list all n8n workflows with last-execution status (admin/operators only)
export async function GET(_request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get user profile for role check
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, client_id")
    .eq("id", user.id)
    .single();

  try {
    const data = await n8nFetch("/workflows?limit=100");
    let workflows: N8NWorkflowRaw[] = data.data || [];

    // Clients only see workflows tagged with their client ID
    if (profile?.role === "client" && profile?.client_id) {
      workflows = workflows.filter((w) => {
        const tags = w.tags || [];
        const name = w.name || "";
        return (
          tags.some((t) => t.name === profile.client_id) ||
          name.toLowerCase().includes((profile.client_id as string).toLowerCase())
        );
      });
    }

    // Best-effort: fetch recent 100 executions in one shot, group by workflowId
    // so each workflow row can show its last-run status without N+1 queries.
    const executionsMap: Record<string, N8NExecutionRaw> = {};
    try {
      const execData = await n8nFetch("/executions?limit=100&includeData=false");
      const execs: N8NExecutionRaw[] = Array.isArray(execData)
        ? execData
        : (execData.data ?? []);
      // Executions are returned newest-first; first match per workflowId = latest
      for (const exec of execs) {
        const wid = String(exec.workflowId);
        if (!executionsMap[wid]) executionsMap[wid] = exec;
      }
    } catch {
      // Non-fatal — page gracefully shows "No runs" when lastExecution is null
    }

    return NextResponse.json({
      success: true,
      workflows: workflows.map((w) => {
        const rawExec = executionsMap[String(w.id)] ?? null;
        return {
          id: w.id,
          name: w.name,
          active: w.active,
          createdAt: w.createdAt,
          updatedAt: w.updatedAt,
          tags: w.tags || [],
          nodes: (w.nodes || []).map((n) => ({ type: n.type })),
          lastExecution: rawExec
            ? {
                id: String(rawExec.id),
                workflowId: String(rawExec.workflowId),
                finished: rawExec.finished,
                mode: rawExec.mode,
                startedAt: rawExec.startedAt,
                stoppedAt: rawExec.stoppedAt,
                status: normaliseStatus(rawExec.status),
              }
            : null,
        };
      }),
    });
  } catch {
    return NextResponse.json({
      success: false,
      error: "Could not connect to n8n. Check N8N_URL and N8N_API_KEY.",
      workflows: [],
    });
  }
}

// POST — create a new workflow in n8n
//
// SECURITY (Apr 26): role-gated to match the per-id PATCH/DELETE handlers.
// n8n is a shared instance — clients should never spawn workflows directly.
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fail-closed: missing profile → reject. profile?.role === "client"
  // alone would let users without a profile through.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.role === "client") {
    return NextResponse.json({ error: "Operators only" }, { status: 403 });
  }

  const { name, nodes, connections, client_id } = await request.json();

  try {
    const payload: Record<string, unknown> = {
      name: name || "New Workflow",
      nodes: nodes || [],
      connections: connections || {},
      settings: { executionOrder: "v1" },
    };

    const data = await n8nFetch("/workflows", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    // Log creation
    await supabase.from("trinity_log").insert({
      action_type: "automation",
      description: `n8n workflow created: ${name}`,
      client_id: client_id || null,
      status: "completed",
      result: { n8n_id: data.id, name },
    });

    return NextResponse.json({ success: true, workflow: data });
  } catch {
    return NextResponse.json({ error: "Failed to create workflow in n8n" }, { status: 500 });
  }
}
