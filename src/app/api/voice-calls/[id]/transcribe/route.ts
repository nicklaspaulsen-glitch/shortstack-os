/**
 * POST /api/voice-calls/[id]/transcribe
 *
 * Transcribes a Twilio recording for a `voice_calls` row that doesn't yet
 * have a transcript (typical when ElevenLabs ConvAI wasn't configured for
 * the call, or its webhook failed). Routes through the new transcription
 * router, no diarization needed (Twilio recordings are single-speaker-side).
 *
 * Long audio: when faster-whisper / WhisperX returns a job id (cold start
 * exceeded the runsync window), we persist a `transcription_jobs` row and
 * the cron poller finishes the work.
 *
 * Returns 501 if no provider is configured.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import {
  transcribe,
  getTranscriptionProviderStatus,
} from "@/lib/transcription/router";
import { writeTranscriptToSource } from "@/lib/transcription/job-completion";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const providerStatus = getTranscriptionProviderStatus();
  if (!providerStatus.some((p) => p.available)) {
    return NextResponse.json(
      {
        error:
          "transcription disabled — set RUNPOD_FASTER_WHISPER_ENDPOINT or OPENAI_API_KEY",
      },
      { status: 501 },
    );
  }

  const service = createServiceClient();
  const { data: call, error: callErr } = await service
    .from("voice_calls")
    .select("id, profile_id, recording_url, transcript, duration_seconds")
    .eq("id", params.id)
    .maybeSingle();
  if (callErr || !call) {
    return NextResponse.json({ error: "Voice call not found" }, { status: 404 });
  }
  if (call.profile_id !== ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!call.recording_url) {
    return NextResponse.json(
      { error: "No recording on this call" },
      { status: 400 },
    );
  }
  if (call.transcript && call.transcript.trim().length > 0) {
    // Idempotent — return the existing transcript instead of re-billing.
    return NextResponse.json({
      ok: true,
      already_transcribed: true,
      transcript: call.transcript,
    });
  }

  try {
    const result = await transcribe({
      audioUrl: call.recording_url,
      // Twilio call legs are mono-side — diarization wouldn't add anything.
      diarize: false,
      userId: ownerId,
      context: "/api/voice-calls/[id]/transcribe",
    });

    if (result.job_id) {
      await service.from("transcription_jobs").insert({
        agency_owner_id: ownerId,
        source_table: "voice_calls",
        source_id: params.id,
        audio_url: call.recording_url,
        provider: result.provider,
        provider_job_id: result.job_id,
        status: "processing",
        diarize: false,
      });
      return NextResponse.json({
        ok: true,
        async: true,
        provider: result.provider,
        job_id: result.job_id,
      });
    }

    // Inline write instead of writeTranscriptToSource so we can add
    // `.eq("profile_id", ownerId)` as defense-in-depth against the TOCTOU
    // window between the ownership check above and this service-client write.
    // writeTranscriptToSource passes the service client which bypasses RLS, so
    // we must supply the ownership column explicitly here.
    const { error: transcriptErr } = await service
      .from("voice_calls")
      .update({
        transcript: result.text,
        duration_seconds: result.duration_seconds || null,
      })
      .eq("id", params.id)
      .eq("profile_id", ownerId);
    if (transcriptErr) {
      console.error("[voice-calls/transcribe] transcript update failed", transcriptErr);
      return NextResponse.json(
        { error: "transcript update failed" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      transcript: result.text,
      provider: result.provider,
      duration_seconds: result.duration_seconds,
    });
  } catch (err) {
    console.error("[voice-calls/transcribe] error:", err);
    const message = err instanceof Error ? err.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
