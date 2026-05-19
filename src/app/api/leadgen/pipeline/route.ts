import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/leadgen/pipeline
 * Returns all leads in the pipeline for the authenticated owner.
 * Query params:
 *   stage?    — filter by stage
 *   platform? — filter by platform
 *   limit?    — max results (default 100)
 *   offset?   — pagination offset
 *
 * PATCH /api/leadgen/pipeline
 * Update a lead's stage, notes, or lead_info.
 * Body: { lead_id, stage?, notes?, lead_info? }
 */
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const stage = url.searchParams.get("stage");
  const platform = url.searchParams.get("platform");
  const limit = Math.min(Number(url.searchParams.get("limit") || "100"), 250);
  const offset = Number(url.searchParams.get("offset") || "0");

  let query = supabase
    .from("lead_pipeline")
    .select(
      "id, platform, handle, display_name, stage, lead_info, voice_message_url, outreach_sent_at, last_reply_at, files, generated_content, notes, created_at, updated_at",
      { count: "exact" },
    )
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (stage) query = query.eq("stage", stage);
  if (platform) query = query.eq("platform", platform);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    leads: data || [],
    total: count || 0,
    offset,
    limit,
  });
}

const ALLOWED_STAGES = new Set([
  "outreach_pending", "outreach_sent", "replied",
  "qualifying", "qualified", "content_ready", "converted", "dead",
]);

export async function PATCH(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  interface PatchBody {
    lead_id: string;
    stage?: string;
    notes?: string;
    lead_info?: Record<string, unknown>;
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.lead_id) {
    return NextResponse.json({ error: "lead_id required" }, { status: 400 });
  }
  if (body.stage && !ALLOWED_STAGES.has(body.stage)) {
    return NextResponse.json({ error: `Invalid stage. Allowed: ${Array.from(ALLOWED_STAGES).join(", ")}` }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.stage !== undefined) updates.stage = body.stage;
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.lead_info !== undefined) updates.lead_info = body.lead_info;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("lead_pipeline")
    .update(updates)
    .eq("id", body.lead_id)
    .eq("owner_id", ownerId)
    .select("id, stage")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, lead: data });
}
