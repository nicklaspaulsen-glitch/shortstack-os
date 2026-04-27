/**
 * Meetings — detail / update / delete.
 *
 * GET    /api/meetings/[id]  → full record (including transcript JSON)
 * PATCH  /api/meetings/[id]  → update title/status/action_items (and a few more fields)
 * DELETE /api/meetings/[id]  → hard delete (CASCADE from auth.users handles audit)
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

const UPDATABLE_FIELDS = new Set([
  "title",
  "status",
  "scheduled_at",
  "started_at",
  "ended_at",
  "duration_seconds",
  "audio_url",
  "client_id",
  "lead_id",
  "deal_id",
  "transcript_raw",
  "transcript_speaker_labeled",
  "summary",
  "action_items",
  "decisions",
  "key_moments",
  "participants",
  "metadata",
]);

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", params.id)
    .eq("created_by", user.id)
    .maybeSingle();

  if (error) {
    console.error("[meetings] detail error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ meeting: data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (UPDATABLE_FIELDS.has(key)) patch[key] = value;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
  }

  // Cross-tenant guard on CRM linking. Without this an authenticated user
  // could PATCH a meeting and pin a lead_id/deal_id from a different agency.
  if (typeof patch.lead_id === "string" || typeof patch.deal_id === "string") {
    const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;
    if (typeof patch.lead_id === "string" && patch.lead_id) {
      const { data: lead } = await supabase
        .from("leads")
        .select("id, user_id")
        .eq("id", patch.lead_id)
        .maybeSingle();
      if (!lead || lead.user_id !== ownerId) {
        return NextResponse.json({ error: "lead_id not in workspace" }, { status: 404 });
      }
    }
    if (typeof patch.deal_id === "string" && patch.deal_id) {
      const { data: deal } = await supabase
        .from("deals")
        .select("id, user_id")
        .eq("id", patch.deal_id)
        .maybeSingle();
      if (!deal || deal.user_id !== ownerId) {
        return NextResponse.json({ error: "deal_id not in workspace" }, { status: 404 });
      }
    }
  }

  const { data, error } = await supabase
    .from("meetings")
    .update(patch)
    .eq("id", params.id)
    .eq("created_by", user.id)
    .select()
    .single();

  if (error) {
    console.error("[meetings] patch error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ meeting: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Best-effort: clean up the audio object first so we don't leave it
  // orphaned in Storage. Failure here is non-fatal — the row delete is
  // the source of truth.
  const { data: existing } = await supabase
    .from("meetings")
    .select("audio_r2_key")
    .eq("id", params.id)
    .eq("created_by", user.id)
    .maybeSingle();
  if (existing?.audio_r2_key) {
    const { error: storageErr } = await supabase.storage
      .from("meetings")
      .remove([existing.audio_r2_key]);
    if (storageErr) {
      console.error("[meetings] storage cleanup failed:", storageErr);
    }
  }

  const { error } = await supabase
    .from("meetings")
    .delete()
    .eq("id", params.id)
    .eq("created_by", user.id);

  if (error) {
    console.error("[meetings] delete error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
