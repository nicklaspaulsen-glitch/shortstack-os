import { NextRequest, NextResponse } from "next/server";
import { getAgentAuth } from "@/lib/supabase/agent-auth";
import { createServiceClient } from "@/lib/supabase/server";

// ── POST /api/agents/sync ───────────────────────────────────────────
// Electron agent uploads workspace metadata so the SaaS dashboard can
// display what lives on the client's machine.
export async function POST(request: NextRequest) {
  const auth = await getAgentAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { user } = auth;

  try {
    const body = await request.json();
    const service = createServiceClient();

    // ── Action: complete-task ────────────────────────────────────────
    if (body.action === "complete-task") {
      const { taskId, result } = body;
      if (!taskId) {
        return NextResponse.json({ error: "taskId required" }, { status: 400 });
      }

      const { data, error } = await service
        .from("agent_tasks")
        .update({
          status: "completed",
          result: result || null,
          completed_at: new Date().toISOString(),
        })
        .eq("id", taskId)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) {
        console.error("[agents/sync] complete-task error:", error);
        return NextResponse.json({ error: "Failed to complete task" }, { status: 500 });
      }

      return NextResponse.json({ success: true, task: data });
    }

    // ── Action: fail-task ────────────────────────────────────────────
    if (body.action === "fail-task") {
      const { taskId, error: failError } = body;
      if (!taskId) {
        return NextResponse.json({ error: "taskId required" }, { status: 400 });
      }

      const { data, error } = await service
        .from("agent_tasks")
        .update({
          status: "failed",
          result: failError || "Unknown error",
          completed_at: new Date().toISOString(),
        })
        .eq("id", taskId)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) {
        console.error("[agents/sync] fail-task error:", error);
        return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
      }

      return NextResponse.json({ success: true, task: data });
    }

    // ── Default: workspace sync ──────────────────────────────────────
    const { workspace_path, files, projects } = body;

    if (!workspace_path || !Array.isArray(files) || !Array.isArray(projects)) {
      return NextResponse.json(
        {
          error:
            "Request body must include workspace_path (string), files (array), and projects (array) — or an action field",
        },
        { status: 400 }
      );
    }

    const { data, error } = await service
      .from("agent_workspace")
      .upsert(
        {
          user_id: user.id,
          workspace_path,
          files,
          projects,
          file_count: files.length,
          project_count: projects.length,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (error) {
      console.error("[agents/sync] upsert error:", error);
      return NextResponse.json(
        { error: "Failed to sync workspace" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      workspace: data,
    });
  } catch (err) {
    console.error("[agents/sync] POST error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ── GET /api/agents/sync ────────────────────────────────────────────
// Electron agent pulls pending tasks, content briefs, and scheduled
// items it should work on locally.
export async function GET(request: NextRequest) {
  const auth = await getAgentAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { user } = auth;

  try {
    // Use service client so RLS cannot hide rows from the agent
    const service = createServiceClient();

    const { data: tasks, error } = await service
      .from("agent_tasks")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[agents/sync] tasks query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch tasks" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      tasks: tasks ?? [],
      synced_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[agents/sync] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
