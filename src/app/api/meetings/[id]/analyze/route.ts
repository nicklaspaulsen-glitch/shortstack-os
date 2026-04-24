/**
 * POST /api/meetings/[id]/analyze
 *
 * Given a meeting row with `transcript_raw` present, calls Claude and writes
 * `summary`, `action_items`, `decisions`, and `key_moments` to the row.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { analyzeTranscript } from "@/lib/meetings/analyzer";

interface MeetingSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: meeting, error: fetchErr } = await supabase
    .from("meetings")
    .select("id, transcript_raw, transcript_speaker_labeled, scheduled_at, created_at")
    .eq("id", params.id)
    .eq("created_by", user.id)
    .maybeSingle();
  if (fetchErr) {
    console.error("[meetings/analyze] fetch error:", fetchErr);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!meeting.transcript_raw) {
    return NextResponse.json(
      { error: "Transcribe the meeting before running analysis" },
      { status: 400 },
    );
  }

  const meetingDate = (
    meeting.scheduled_at || meeting.created_at || new Date().toISOString()
  ).slice(0, 10);

  const segments: MeetingSegment[] = Array.isArray(meeting.transcript_speaker_labeled)
    ? (meeting.transcript_speaker_labeled as MeetingSegment[])
    : [];

  try {
    const analysis = await analyzeTranscript(meeting.transcript_raw, {
      meetingDate,
      segments,
    });

    const { data: updated, error: updErr } = await supabase
      .from("meetings")
      .update({
        summary: analysis.summary,
        action_items: analysis.action_items,
        decisions: analysis.decisions,
        key_moments: analysis.key_moments,
        status: "ready",
      })
      .eq("id", params.id)
      .eq("created_by", user.id)
      .select()
      .single();

    if (updErr) {
      console.error("[meetings/analyze] update error:", updErr);
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ meeting: updated, analysis });
  } catch (err) {
    console.error("[meetings/analyze] error:", err);
    const message = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
