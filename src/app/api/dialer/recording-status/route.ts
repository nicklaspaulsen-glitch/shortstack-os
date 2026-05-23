import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { validateTwilioSignature } from "@/lib/services/voice-calls";

// POST /api/dialer/recording-status
//
// Twilio recording-status callback, fired by the <Dial record="...">
// attribute in /api/dialer/twiml. Twilio sends this when a dual-channel
// recording is ready (RecordingStatus = "completed").
//
// Params (form-encoded POST, Twilio-signed):
//   CallSid          — the parent call SID (matches voice_calls.twilio_call_sid)
//   RecordingSid     — unique ID of this recording
//   RecordingUrl     — HTTPS URL of the MP3/WAV (append ".mp3" for MP3)
//   RecordingStatus  — "completed" | "failed" | "absent"
//   RecordingDuration — seconds, as string
//
// On success: upserts voice_calls by twilio_call_sid, writing recording_url.
// On RecordingStatus != "completed": logs a warn and returns 200 (no retry).
// Signature failure: 403 fail-closed.

export const maxDuration = 15;

export async function POST(request: NextRequest) {
  // --- 1. Parse body as form-encoded params ---
  const text = await request.text();
  const params = new URLSearchParams(text);

  // --- 2. Validate Twilio HMAC-SHA1 signature ---
  if (!validateTwilioSignature(request, params)) {
    console.warn("[dialer/recording-status] Twilio signature validation failed — 403");
    return new NextResponse("Forbidden", { status: 403 });
  }

  const callSid = params.get("CallSid") ?? "";
  const recordingSid = params.get("RecordingSid") ?? "";
  const recordingUrl = params.get("RecordingUrl") ?? "";
  const recordingStatus = params.get("RecordingStatus") ?? "";
  const rawDuration = params.get("RecordingDuration") ?? "";

  if (!callSid) {
    console.warn("[dialer/recording-status] missing CallSid — ignoring");
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Twilio also fires with RecordingStatus = "failed" or "absent" — nothing
  // to store in those cases, but we return 200 so Twilio doesn't retry.
  if (recordingStatus !== "completed") {
    console.info(
      `[dialer/recording-status] non-completed status=${recordingStatus} sid=${callSid} — skip`,
    );
    return NextResponse.json({ ok: true, skipped: true, recordingStatus });
  }

  if (!recordingUrl) {
    console.warn("[dialer/recording-status] RecordingStatus=completed but no RecordingUrl — skip");
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Twilio serves recordings as .wav by default; append .mp3 for smaller files
  // that the browser's <audio> element handles without additional codecs.
  const mp3Url = recordingUrl.endsWith(".mp3") ? recordingUrl : `${recordingUrl}.mp3`;

  const duration = rawDuration ? parseInt(rawDuration, 10) : null;

  const supabase = createServiceClient();

  // Upsert by twilio_call_sid so the row exists whether or not the
  // voice-status-callback already created it.
  const update: Record<string, unknown> = {
    twilio_call_sid: callSid,
    recording_url: mp3Url,
    metadata: {
      recording_sid: recordingSid,
      recording_status_callback: true,
    },
  };
  if (duration !== null && !Number.isNaN(duration)) {
    update.duration_seconds = duration;
  }

  const { error } = await supabase
    .from("voice_calls")
    .update(update)
    .eq("twilio_call_sid", callSid);

  if (error) {
    // Row might not exist yet (race with voice-status-callback). Log and
    // return 200 — Twilio retries on non-2xx responses which creates noise.
    console.error("[dialer/recording-status] update failed:", {
      callSid,
      recordingSid,
      error: error.message,
    });
    return NextResponse.json({ ok: false, error: error.message }, { status: 200 });
  }

  console.info(
    `[dialer/recording-status] recording_url set sid=${callSid} rec=${recordingSid} dur=${duration}s`,
  );
  return NextResponse.json({ ok: true, callSid, recordingSid });
}

// GET — health check so tests can confirm the route is reachable.
export async function GET() {
  return NextResponse.json({ status: "ok", route: "dialer/recording-status" });
}
