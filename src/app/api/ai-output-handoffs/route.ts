import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

/*
  Table: ai_output_handoffs
  ─────────────────────────
  Short-lived store for passing AI-generated outputs from a generator page
  into an editor page. Used by the "Edit after AI" flow. TTL = 15 minutes.

  id          uuid        primary key
  user_id     uuid        references auth.users(id) on delete cascade
  kind        text        'thumbnail' | 'video' | 'script' | 'image' | 'caption'
  payload     jsonb       opaque — whatever the editor on the other side needs
  created_at  timestamptz default now()
  expires_at  timestamptz default now() + interval '15 minutes'
*/

export const dynamic = "force-dynamic";

// POST /api/ai-output-handoffs  — create a new handoff
// Returns { id } on success. Caller navigates to the editor with `?from=<id>`.
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { kind?: string; payload?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const kind = typeof body.kind === "string" ? body.kind : "";
  const allowed = new Set(["thumbnail", "video", "script", "image", "caption"]);
  if (!allowed.has(kind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }
  if (body.payload === undefined || body.payload === null) {
    return NextResponse.json({ error: "Missing payload" }, { status: 400 });
  }

  // Cap payload size so a runaway client can't spam big rows.
  const serialized = JSON.stringify(body.payload);
  if (serialized.length > 512 * 1024) {
    return NextResponse.json({ error: "Payload too large (max 512KB)" }, { status: 413 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("ai_output_handoffs")
    .insert({ user_id: user.id, kind, payload: body.payload })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}

// GET /api/ai-output-handoffs?id=<uuid>  — fetch a handoff (only if it's yours
// and not yet expired). The editor page calls this once on mount.
export async function GET(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("ai_output_handoffs")
    .select("id, kind, payload, created_at, expires_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = Date.now();
  const expiresAt = new Date(data.expires_at).getTime();
  if (expiresAt < now) {
    return NextResponse.json({ error: "Expired" }, { status: 410 });
  }

  return NextResponse.json({ handoff: data });
}
