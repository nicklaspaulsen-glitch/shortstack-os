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

// Platform-admin guard — n8n is a SHARED instance with no per-tenant
// namespace. Any non-admin user reaching n8n can enumerate and read
// ANY other tenant's workflows by sequential integer ID, and those
// workflow nodes often contain credentials in plaintext.
//
// Restricting to `role === "admin"` (platform founders only) closes
// the cross-tenant IDOR. Agency owners who need workflow management
// should go through their own scoped integrations, not raw n8n API.
//
// FAIL-CLOSED: missing profile row → reject. Earlier version used
// `role !== "client"` which left inter-agency lateral movement open.
async function requirePlatformAdmin(supabase: ReturnType<typeof createServerSupabase>, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Platform admins only" }, { status: 403 });
  }
  return null;
}

// GET — get single workflow with full details (nodes, connections)
//
// SECURITY (Apr 26): role-gated to non-client.
// SECURITY (May 26): tightened to platform-admin only. n8n is a shared
// instance with no per-tenant namespace; non-admin users could enumerate
// any other tenant's workflows by sequential integer ID. Workflow nodes
// often contain API credentials in plaintext on the n8n side.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const reject = await requirePlatformAdmin(supabase, user.id);
  if (reject) return reject;

  try {
    const data = await n8nFetch(`/workflows/${params.id}`);
    return NextResponse.json({ success: true, workflow: data });
  } catch (err) {
    console.error("[n8n/workflows/:id] GET error:", err);
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }
}

// PATCH — update workflow (toggle active, update nodes, rename)
//
// SECURITY (Apr 26): role-gated to non-client.
// SECURITY (May 26): tightened to platform-admin only (see GET comment).
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const reject = await requirePlatformAdmin(supabase, user.id);
  if (reject) return reject;

  const updates = await request.json();

  try {
    const data = await n8nFetch(`/workflows/${params.id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
    return NextResponse.json({ success: true, workflow: data });
  } catch (err) {
    console.error("[n8n/workflows/:id] PATCH error:", err);
    return NextResponse.json({ error: "Failed to update workflow" }, { status: 500 });
  }
}

// DELETE — delete workflow from n8n
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const reject = await requirePlatformAdmin(supabase, user.id);
  if (reject) return reject;

  try {
    await n8nFetch(`/workflows/${params.id}`, { method: "DELETE" });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[n8n/workflows/:id] DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete workflow" }, { status: 500 });
  }
}
