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

// Shared role guard — mirrors the existing DELETE handler. Anyone with
// a non-client role can read/edit/delete shared workflows.
//
// FAIL-CLOSED: a missing profiles row means we can't classify the user
// — reject. Earlier version used `if (profile?.role === "client")`
// which let users without a profile through.
async function rejectIfClient(supabase: ReturnType<typeof createServerSupabase>, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (!profile || profile.role === "client") {
    return NextResponse.json({ error: "Operators only" }, { status: 403 });
  }
  return null;
}

// GET — get single workflow with full details (nodes, connections)
//
// SECURITY (Apr 26): role-gated. n8n is a shared instance — pre-fix any
// authed user (including clients) could enumerate any workflow by id and
// read its nodes/connections, which often contain credentials in plain
// text on the n8n side.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const reject = await rejectIfClient(supabase, user.id);
  if (reject) return reject;

  try {
    const data = await n8nFetch(`/workflows/${params.id}`);
    return NextResponse.json({ success: true, workflow: data });
  } catch {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }
}

// PATCH — update workflow (toggle active, update nodes, rename)
//
// SECURITY (Apr 26): role-gated to match the sibling DELETE handler.
// Pre-fix any authenticated tenant could PATCH any n8n workflow by id —
// renaming, toggling active, editing nodes — across all tenants in the
// shared n8n instance.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const reject = await rejectIfClient(supabase, user.id);
  if (reject) return reject;

  const updates = await request.json();

  try {
    const data = await n8nFetch(`/workflows/${params.id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
    return NextResponse.json({ success: true, workflow: data });
  } catch {
    return NextResponse.json({ error: "Failed to update workflow" }, { status: 500 });
  }
}

// DELETE — delete workflow from n8n
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const reject = await rejectIfClient(supabase, user.id);
  if (reject) return reject;

  try {
    await n8nFetch(`/workflows/${params.id}`, { method: "DELETE" });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete workflow" }, { status: 500 });
  }
}
