/**
 * POST /api/meetings/[id]/transcribe
 *
 * Fetches the meeting's `audio_url`, streams it through the transcription
 * router (`@/lib/transcription/router`), and writes `transcript_raw` +
 * `transcript_speaker_labeled` + `duration_seconds` onto the row. Sets
 * status to 'ready' on success, 'failed' on error.
 *
 * Provider order:
 *   1. WhisperX (if configured) — diarized SPEAKER_xx labels for the AI
 *      Sales Coach + meeting transcript view.
 *   2. faster-whisper (if configured) — 4x faster than stock Whisper, no
 *      diarization but same accuracy.
 *   3. OpenAI Whisper API — fallback, $0.006/min, no diarization.
 *
 * Returns 501 if no provider is configured so the UI can show a "configure
 * provider" hint.
 *
 * Async path: when RunPod returns a job id (cold start exceeded the
 * runsync window), we persist a `transcription_jobs` row, mark the meeting
 * `transcribing`, and let `/api/cron/poll-transcription-jobs` finish the
 * work. The UI polls the meeting row for `status: 'ready'`.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  transcribe,
  getTranscriptionProviderStatus,
} from "@/lib/transcription/router";
import { writeTranscriptToSource } from "@/lib/transcription/job-completion";
import { captureVoiceSample } from "@/lib/ai/voice-profile";

// Whisper transcription on a 60-min recording can run ~90s on cold start.
// Vercel default is 10s — bump to 5 min so we can wait for the worker
// (or surface the job-id async path).
export const maxDuration = 300;

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const providerStatus = getTranscriptionProviderStatus();
  const anyAvailable = providerStatus.some((p) => p.available);
  if (!anyAvailable) {
    return NextResponse.json(
      {
        error:
          "transcription disabled — set RUNPOD_WHISPERX_ENDPOINT (preferred for diarization), RUNPOD_FASTER_WHISPER_ENDPOINT, or OPENAI_API_KEY",
      },
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
    const result = await transcribe({
      audioUrl: meeting.audio_url,
      diarize: true,
      // Sales calls are 2-party by default — helps WhisperX cluster cleanly.
      speakerCountHint: 2,
      userId: user.id,
      context: "/api/meetings/[id]/transcribe",
    });

    // Async / cold-start path: provider returned a job id; persist a
    // transcription_jobs row and let the cron handler finish.
    if (result.job_id) {
      await supabase
        .from("meetings")
        .update({ status: "transcribing" })
        .eq("id", params.id)
        .eq("created_by", user.id);

      await supabase.from("transcription_jobs").insert({
        agency_owner_id: user.id,
        source_table: "meetings",
        source_id: params.id,
        audio_url: meeting.audio_url,
        provider: result.provider,
        provider_job_id: result.job_id,
        status: "processing",
        diarize: true,
        speaker_count_hint: 2,
      });

      return NextResponse.json({
        meeting: { id: params.id, status: "transcribing" },
        async: true,
        provider: result.provider,
        job_id: result.job_id,
      });
    }

    // Sync path — write transcript back inline.
    const ok = await writeTranscriptToSource({
      supabase,
      sourceTable: "meetings",
      sourceId: params.id,
      result,
    });
    if (!ok) {
      return NextResponse.json(
        { error: "transcript stored but source row update failed" },
        { status: 500 },
      );
    }

    const { data: updated } = await supabase
      .from("meetings")
      .select()
      .eq("id", params.id)
      .eq("created_by", user.id)
      .single();

    // Capture meeting transcript segments for voice profiles. Fire-and-forget.
    try {
      const segs = (result.segments || []) as Array<{ speaker?: string; text?: string }>;
      const bySpeaker = new Map<string, string[]>();
      for (const s of segs) {
        const speaker = (s.speaker || "speaker_0").toLowerCase();
        const text = (s.text || "").trim();
        if (!text) continue;
        const list = bySpeaker.get(speaker) ?? [];
        list.push(text);
        bySpeaker.set(speaker, list);
      }
      const userSpeaker = segs.find((s) => s.speaker)?.speaker?.toLowerCase();
      for (const [speaker, parts] of Array.from(bySpeaker.entries())) {
        const body = parts.join(" ").trim();
        if (!body) continue;
        if (speaker === userSpeaker && meeting.created_by) {
          captureVoiceSample({
            agencyOwnerId: meeting.created_by,
            subjectKind: "user",
            subjectId: meeting.created_by,
            source: "meeting_transcript",
            body,
            channel: "meeting",
          }).catch((err) => console.warn("[voice-capture/meeting]", err));
        }
      }
    } catch (err) {
      console.warn("[voice-capture/meeting] sweep failed", err);
    }

    return NextResponse.json({
      meeting: updated,
      provider: result.provider,
      segments_count: result.segments.length,
    });
  } catch (err) {
    console.error("[meetings/transcribe] error:", err);
    await supabase
      .from("meetings")
      .update({ status: "failed" })
      .eq("id", params.id)
      .eq("created_by", user.id);
    const message = err instanceof Error ? err.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
