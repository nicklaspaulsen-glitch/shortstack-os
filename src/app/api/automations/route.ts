import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Consolidated automations view.
 * Joins three different tables (each with its own schema conventions) into
 * a single normalized shape the dashboard can render without knowing the
 * source. PATCH uses ?type= to route to the right table.
 */

interface Unified {
  id: string;
  type: "workflow" | "automation" | "sequence";
  name: string;
  description: string | null;
  active: boolean;
  last_ran: string | null;
  error_count: number;
  updated_at: string;
}

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [wfRes, autoRes, seqRes] = await Promise.all([
    supabase.from("workflows").select("id, name, description, active, updated_at").eq("user_id", user.id),
    supabase.from("crm_automations").select("id, name, is_active, updated_at").eq("profile_id", user.id),
    supabase.from("sequences").select("id, name, description, is_active, updated_at").eq("profile_id", user.id),
  ]);

  // For last_ran and error_count on workflows, join workflow_trigger_runs.
  const workflowIds = (wfRes.data || []).map(w => w.id);
  let runsByWorkflow: Record<string, { last_ran: string | null; error_count: number }> = {};
  if (workflowIds.length) {
    const { data: runs } = await supabase
      .from("workflow_trigger_runs")
      .select("workflow_id, status, created_at")
      .in("workflow_id", workflowIds)
      .order("created_at", { ascending: false })
      .limit(500);
    for (const r of runs || []) {
      const prev = runsByWorkflow[r.workflow_id] || { last_ran: null, error_count: 0 };
      if (!prev.last_ran) prev.last_ran = r.created_at;
      if (r.status === "error" || r.status === "failed") prev.error_count += 1;
      runsByWorkflow[r.workflow_id] = prev;
    }
  }

  const unified: Unified[] = [
    ...(wfRes.data || []).map(w => ({
      id: w.id,
      type: "workflow" as const,
      name: w.name,
      description: w.description,
      active: w.active,
      last_ran: runsByWorkflow[w.id]?.last_ran || null,
      error_count: runsByWorkflow[w.id]?.error_count || 0,
      updated_at: w.updated_at,
    })),
    ...(autoRes.data || []).map(a => ({
      id: a.id,
      type: "automation" as const,
      name: a.name,
      description: null,
      active: a.is_active,
      last_ran: null,
      error_count: 0,
      updated_at: a.updated_at,
    })),
    ...(seqRes.data || []).map(s => ({
      id: s.id,
      type: "sequence" as const,
      name: s.name,
      description: s.description,
      active: s.is_active,
      last_ran: null,
      error_count: 0,
      updated_at: s.updated_at,
    })),
  ].sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));

  return NextResponse.json({ automations: unified });
}

export async function PATCH(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { id, type, active } = body as { id?: string; type?: string; active?: boolean };
  if (!id || !type || typeof active !== "boolean") {
    return NextResponse.json({ error: "id, type, active required" }, { status: 400 });
  }

  if (type === "workflow") {
    const { error } = await supabase.from("workflows").update({ active }).eq("id", id).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (type === "automation") {
    const { error } = await supabase.from("crm_automations").update({ is_active: active }).eq("id", id).eq("profile_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (type === "sequence") {
    const { error } = await supabase.from("sequences").update({ is_active: active }).eq("id", id).eq("profile_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    return NextResponse.json({ error: "unknown type" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
