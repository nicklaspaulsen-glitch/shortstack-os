/**
 * Meetings — list + create.
 *
 * GET  /api/meetings?page=0&limit=20
 *   → paginated list, newest first, scoped to the caller.
 *
 * POST /api/meetings
 *   body: { title: string, scheduled_at?: string, client_id?: string }
 *   → creates a meeting row with status='scheduled'.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

const DEFAULT_PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const page = Math.max(0, Number(url.searchParams.get("page") || 0));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || DEFAULT_PAGE_SIZE)));
  const from = page * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabase
    .from("meetings")
    .select(
      "id, title, client_id, scheduled_at, started_at, ended_at, duration_seconds, audio_url, status, summary, created_at",
      { count: "exact" },
    )
    .eq("created_by", user.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("[meetings] list error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    meetings: data || [],
    page,
    limit,
    total: count ?? 0,
  });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { title?: string; scheduled_at?: string; client_id?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = String(body.title || "").trim();
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  // If a client_id is supplied, verify the caller's tenant owns that client.
  // Without this an authenticated user can pin a meeting against any
  // tenant's client_id — pollutes cross-tenant data integrity even though
  // it doesn't expose data directly.
  if (body.client_id) {
    const { data: client } = await supabase
      .from("clients")
      .select("profile_id")
      .eq("id", body.client_id)
      .maybeSingle();
    if (!client || client.profile_id !== user.id) {
      return NextResponse.json({ error: "client_id not found in your workspace" }, { status: 404 });
    }
  }

  const { data, error } = await supabase
    .from("meetings")
    .insert({
      created_by: user.id,
      title,
      scheduled_at: body.scheduled_at || null,
      client_id: body.client_id || null,
      status: "scheduled",
    })
    .select()
    .single();

  if (error) {
    console.error("[meetings] create error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ meeting: data });
}
