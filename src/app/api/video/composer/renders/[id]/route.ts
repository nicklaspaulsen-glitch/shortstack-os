import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// GET /api/video/composer/renders/[id]
// Returns a single render row (status, output_url, etc.) for polling.
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("hyperframes_renders")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json({ render: data });
}

// POST /api/video/composer/renders/[id]
// Callback endpoint for the hyperframes-worker. Authenticated via
// RUNPOD_HYPERFRAMES_SECRET (bearer token) instead of user cookies.
// Body: { status: 'complete'|'failed', output_url?, error?, duration_seconds?,
//          file_size_bytes?, asset_id? }
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const secret = process.env.RUNPOD_HYPERFRAMES_SECRET;
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const status = body.status as string;
  if (!["complete", "failed", "rendering"].includes(status)) {
    return NextResponse.json(
      { error: "Invalid status (must be complete|failed|rendering)" },
      { status: 400 }
    );
  }

  const update: Record<string, unknown> = { status };
  if (status === "complete") {
    update.rendered_at = new Date().toISOString();
    if (body.output_url) update.output_url = body.output_url;
    if (body.duration_seconds != null)
      update.duration_seconds = Number(body.duration_seconds);
    if (body.file_size_bytes != null)
      update.file_size_bytes = Number(body.file_size_bytes);
    if (body.asset_id) update.asset_id = body.asset_id;
    if (body.error) update.error = null;
  } else if (status === "failed") {
    if (body.error) update.error = String(body.error).slice(0, 2000);
  }

  // Use service client - the callback has no user session
  const service = createServiceClient();
  const { data, error } = await service
    .from("hyperframes_renders")
    .update(update)
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ render: data });
}
