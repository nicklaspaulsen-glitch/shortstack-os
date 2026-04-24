/**
 * POST /api/meetings/[id]/transcribe
 *
 * Fetches the meeting's `audio_url`, streams it through Whisper, and writes
 * `transcript_raw` + `transcript_speaker_labeled` + `duration_seconds` onto
 * the row. Sets status to 'ready' on success, 'failed' on error.
 *
 * Returns 501 if OPENAI_API_KEY is missing (non-fatal, UI shows a hint).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { hasOpenAIKey, transcribeAudio } from "@/lib/meetings/whisper";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasOpenAIKey()) {
    return NextResponse.json(
      { error: "transcription disabled, configure OPENAI_API_KEY" },
      { status: 501 },
    );
  }

  const { data: meeting } = await supabase
    .from("meetings")
    .select("id, audio_url, created_by")
    .eq("id", params.id)
    .eq("created_by", user.id)
    .maybeSingle();
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!meeting.audio_url) {
    return NextResponse.json(
      { error: "Upload audio first before transcribing" },
      { status: 400 },
    );
  }

  try {
    const audioResp = await fetch(meeting.audio_url);
    if (!audioResp.ok) {
      throw new Error(`Failed to fetch audio (status ${audioResp.status})`);
    }
    const blob = await audioResp.blob();
    const filenameGuess = meeting.audio_url.split("/").pop()?.split("?")[0] || "audio.webm";

    const result = await transcribeAudio(blob, { filename: filenameGuess });

    const { data: updated, error: updErr } = await supabase
      .from("meetings")
      .update({
        transcript_raw: result.text,
        transcript_speaker_labeled: result.segments,
        duration_seconds: result.duration_seconds ?? null,
        status: "ready",
      })
      .eq("id", params.id)
      .eq("created_by", user.id)
      .select()
      .single();

    if (updErr) {
      console.error("[meetings/transcribe] update error:", updErr);
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ meeting: updated, segments_count: result.segments.length });
  } catch (err) {
    console.error("[meetings/transcribe] error:", err);
    // Mark failed so the UI can offer a retry.
    await supabase
      .from("meetings")
      .update({ status: "failed" })
      .eq("id", params.id)
      .eq("created_by", user.id);
    const message = err instanceof Error ? err.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
