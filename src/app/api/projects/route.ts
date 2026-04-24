import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/projects — list projects the caller can see (via RLS).
 * Optional query params: ?status=active&client_id=xxx&q=search
 */
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const clientId = searchParams.get("client_id");
  const q = searchParams.get("q");

  let query = supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (clientId) query = query.eq("client_id", clientId);
  if (q) query = query.ilike("name", `%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ projects: data ?? [] });
}

/**
 * POST /api/projects — create a new project.
 * Body: { name, brief?, deadline?, status?, client_id? }
 * The caller becomes owner_id automatically.
 */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    name?: unknown;
    brief?: unknown;
    deadline?: unknown;
    status?: unknown;
    client_id?: unknown;
    org_id?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const brief = typeof body.brief === "string" ? body.brief : null;
  const deadline = typeof body.deadline === "string" ? body.deadline : null;
  const clientId = typeof body.client_id === "string" ? body.client_id : null;
  const orgId = typeof body.org_id === "string" ? body.org_id : null;

  const allowedStatus = ["draft", "active", "review", "complete", "archived"];
  const status = typeof body.status === "string" && allowedStatus.includes(body.status)
    ? body.status
    : "draft";

  const { data, error } = await supabase
    .from("projects")
    .insert({
      name,
      brief,
      deadline,
      status,
      client_id: clientId,
      org_id: orgId,
      owner_id: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-add creator as 'lead' member
  await supabase.from("project_members").insert({
    project_id: data.id,
    user_id: user.id,
    role: "lead",
  });

  return NextResponse.json({ project: data }, { status: 201 });
}
