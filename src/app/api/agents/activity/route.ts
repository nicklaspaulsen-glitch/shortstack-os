import { NextRequest, NextResponse } from "next/server";
import { getAgentAuth } from "@/lib/supabase/agent-auth";
import { createServiceClient } from "@/lib/supabase/server";

// ── POST /api/agents/activity ──────────────────────────────────
// Electron agent logs tool executions for audit & analytics.
// Writes to trinity_log with agent="desktop-agent".
export async function POST(request: NextRequest) {
  const auth = await getAgentAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { user } = auth;

  try {
    const { actions } = await request.json();

    if (!Array.isArray(actions) || actions.length === 0) {
      return NextResponse.json({ error: "actions array required" }, { status: 400 });
    }

    const service = createServiceClient();

    const rows = actions.map((a: { name: string; input?: unknown; result?: string; success?: boolean }) => ({
      user_id: user.id,
      agent: "desktop-agent",
      action_type: "custom",
      description: `Tool: ${a.name} — ${a.success ? "success" : "failed"}${a.result ? ": " + String(a.result).slice(0, 200) : ""}`,
      status: a.success ? "completed" : "failed",
      metadata: {
        tool: a.name,
        input: a.input,
        success: a.success,
        source: "electron",
      },
    }));

    const { error } = await service.from("trinity_log").insert(rows);

    if (error) {
      console.error("[agents/activity] insert error:", error);
      return NextResponse.json({ error: "Failed to log activity" }, { status: 500 });
    }

    return NextResponse.json({ success: true, logged: rows.length });
  } catch (err) {
    console.error("[agents/activity] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
