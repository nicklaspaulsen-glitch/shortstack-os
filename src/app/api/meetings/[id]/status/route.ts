/**
 * GET /api/meetings/[id]/status
 *
 * Lightweight polling endpoint for the new-meeting flow. Returns just the
 * fields the UI needs to render a progress indicator without paying the
 * full /api/meetings/[id] payload cost (transcript_raw can be 50+ KB on
 * a long call).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("meetings")
    .select(
      "id, status, duration_seconds, audio_url, summary, cost_usd, completed_at, created_at",
    )
    .eq("id", params.id)
    .eq("created_by", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Booleans the UI actually wants — derived rather than stored so they
  // stay in sync with the source-of-truth `status` field.
  const hasTranscript = data.status === "ready" || Boolean(data.summary);
  const hasSummary = Boolean(data.summary);

  return NextResponse.json({
    id: data.id,
    status: data.status,
    duration_seconds: data.duration_seconds,
    audio_url: data.audio_url,
    cost_usd: Number(data.cost_usd ?? 0),
    completed_at: data.completed_at,
    created_at: data.created_at,
    has_transcript: hasTranscript,
    has_summary: hasSummary,
  });
}
