import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/workflows
 * Returns all workflows for the signed-in user, newest first.
 */
export async function GET() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("workflows")
    .select("id, name, description, nodes, edges, active, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ workflows: data ?? [] });
}

/**
 * POST /api/workflows
 * Upserts a workflow by (user_id, name). Saving the same name twice replaces
 * the previous nodes/edges for that name so users can iterate on one workflow.
 *
 * Body: { name: string, nodes: unknown[], edges: unknown[], description?: string, active?: boolean }
 */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    name?: unknown;
    nodes?: unknown;
    edges?: unknown;
    description?: unknown;
    active?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Workflow name is required" }, { status: 400 });
  }

  const nodes = Array.isArray(body.nodes) ? body.nodes : [];
  const edges = Array.isArray(body.edges) ? body.edges : [];
  const description = typeof body.description === "string" ? body.description : null;
  const active = typeof body.active === "boolean" ? body.active : true;

  const { data, error } = await supabase
    .from("workflows")
    .upsert(
      {
        user_id: user.id,
        name,
        description,
        nodes,
        edges,
        active,
      },
      { onConflict: "user_id,name" },
    )
    .select("id, name, description, nodes, edges, active, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ workflow: data });
}
