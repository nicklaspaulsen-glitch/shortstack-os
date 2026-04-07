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

// GET — get single workflow with full details (nodes, connections)
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const data = await n8nFetch(`/workflows/${params.id}`);
    return NextResponse.json({ success: true, workflow: data });
  } catch {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }
}

// PATCH — update workflow (toggle active, update nodes, rename)
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  // Only admin can delete
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role === "client") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  try {
    await n8nFetch(`/workflows/${params.id}`, { method: "DELETE" });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete workflow" }, { status: 500 });
  }
}
