/**
 * GET /api/coach/analyses/[id]
 *
 * Returns a single analysis row plus the linked source (voice_call /
 * meeting / email thread) so the detail page can render the transcript
 * alongside insights without a second round-trip.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabase,
  createServiceClient,
} from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const service = createServiceClient();

  const { data: analysis, error } = await service
    .from("coach_analyses")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", ownerId)
    .maybeSingle();

  if (error) {
    console.error("[coach/analyses/id] fetch error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!analysis) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Pull the linked source so the UI has transcript context.
  let source: Record<string, unknown> | null = null;
  if (analysis.source_type === "voice_call") {
    const { data } = await service
      .from("voice_calls")
      .select(
        "id, profile_id, transcript, duration_seconds, from_number, to_number, started_at, recording_url, outcome",
      )
      .eq("id", analysis.source_id)
      .maybeSingle();
    if (data && data.profile_id === ownerId) source = data;
  } else if (analysis.source_type === "meeting") {
    const { data } = await service
      .from("meetings")
      .select(
        "id, created_by, title, transcript_raw, transcript_speaker_labeled, summary, scheduled_at, duration_seconds",
      )
      .eq("id", analysis.source_id)
      .maybeSingle();
    if (data && data.created_by === ownerId) source = data;
  } else if (analysis.source_type === "email_thread") {
    const { data: lead } = await service
      .from("leads")
      .select("id, profile_id, business_name")
      .eq("id", analysis.source_id)
      .maybeSingle();
    if (lead && lead.profile_id === ownerId) {
      const { data: rows } = await service
        .from("outreach_log")
        .select(
          "id, message_text, reply_text, sent_at, replied_at, recipient_handle, created_at",
        )
        .eq("lead_id", analysis.source_id)
        .order("created_at", { ascending: true })
        .limit(50);
      source = { lead, messages: rows ?? [] };
    }
  }

  return NextResponse.json({ ok: true, analysis, source });
}
