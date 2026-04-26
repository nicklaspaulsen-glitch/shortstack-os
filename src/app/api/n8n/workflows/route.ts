import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

const N8N_URL = process.env.N8N_URL || "https://n8n-production-97d7.up.railway.app";
const N8N_API_KEY = process.env.N8N_API_KEY || "";

async function n8nFetch(path: string, options?: RequestInit) {
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

// GET — list all n8n workflows (admin sees all, clients see only theirs)
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
    let workflows = data.data || [];

    // Clients only see workflows tagged with their client ID
    if (profile?.role === "client" && profile?.client_id) {
      workflows = workflows.filter((w: Record<string, unknown>) => {
        const tags = (w.tags as Array<{ name: string }>) || [];
        const name = (w.name as string) || "";
        return (
          tags.some((t) => t.name === profile.client_id) ||
          name.toLowerCase().includes(profile.client_id.toLowerCase())
        );
      });
    }

    return NextResponse.json({
      success: true,
      workflows: workflows.map((w: Record<string, unknown>) => ({
        id: w.id,
        name: w.name,
        active: w.active,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
        tags: (w.tags as Array<{ name: string }>) || [],
        nodes: ((w.nodes as Array<unknown>) || []).length,
      })),
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
