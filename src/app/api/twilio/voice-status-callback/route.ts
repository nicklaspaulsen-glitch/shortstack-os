import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  validateTwilioSignature,
  resolveClientByToNumber,
  resolveClientById,
  mapTwilioStatus,
  classifyCallOutcome,
  fireVoiceCallCompletedTrigger,
} from "@/lib/services/voice-calls";

// Twilio StatusCallback endpoint — fires on every call lifecycle event
// (ringing → in-progress → completed) as well as recording completion when
// Record is enabled. Twilio's POST body carries CallSid + CallStatus + Duration
// + RecordingUrl (on recording-status variant).
//
// This endpoint is responsible for:
//   1. Keeping voice_calls.status + duration + ended_at in sync
//   2. On `completed`: classify outcome via Claude Haiku (if transcript
//      present in metadata — pushed from ElevenLabs webhook or a future
//      transcript fetcher), log to trinity_log, fire the voice_call_completed
//      workflow trigger.
//
// Wired during provisioning via TwilioIncomingPhoneNumber.StatusCallback.
export async function POST(request: NextRequest) {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const clientIdHint = searchParams.get("client_id");

  const formData = await request.formData();
  const callSid = (formData.get("CallSid") as string) || null;
  const from = (formData.get("From") as string) || null;
  const to = (formData.get("To") as string) || null;
  const callStatus = (formData.get("CallStatus") as string) || null;
  const callDuration = formData.get("CallDuration") as string | null;
  const direction = (formData.get("Direction") as string) || null;
  const recordingUrl =
    (formData.get("RecordingUrl") as string) ||
    (formData.get("recordingUrl") as string) ||
    null;
  const transcriptFromForm =
    (formData.get("Transcript") as string) ||
    (formData.get("transcript") as string) ||
    null;

  // Validate Twilio signature — fails closed when unreachable in prod.
  const bodyParams = new URLSearchParams();
  formData.forEach((value, key) => bodyParams.append(key, String(value)));
  if (!validateTwilioSignature(request, bodyParams)) {
    return NextResponse.json({ ok: false, error: "bad signature" }, { status: 403 });
  }

  if (!callSid) {
    return NextResponse.json({ ok: false, error: "missing CallSid" }, { status: 400 });
  }

  const client =
    (await resolveClientByToNumber(supabase, to)) ||
    (await resolveClientById(supabase, clientIdHint));

  if (!client) {
    // No owning client — write what we know and bail; still idempotent.
    console.warn("[voice-status] no client for call_sid=", callSid, "to=", to);
    return NextResponse.json({ ok: true, orphan: true });
  }

  const mappedStatus = mapTwilioStatus(callStatus) ?? "in_progress";
  const duration = callDuration ? parseInt(callDuration, 10) : null;
  const isCompleted = mappedStatus === "completed";
  const twilioDirection = direction?.toLowerCase().startsWith("inbound")
    ? "inbound"
    : direction
      ? "outbound"
      : null;

  // Upsert current lifecycle state. started_at stays pinned on first insert
  // (only set when row doesn't exist yet).
  const update: Record<string, unknown> = {
    profile_id: client.profileId,
    client_id: client.clientId,
    twilio_call_sid: callSid,
    from_number: from,
    to_number: to,
    status: mappedStatus,
  };
  if (twilioDirection) update.direction = twilioDirection;
  if (typeof duration === "number" && !Number.isNaN(duration)) {
    update.duration_seconds = duration;
  }
  if (recordingUrl) update.recording_url = recordingUrl;
  if (isCompleted) update.ended_at = new Date().toISOString();

  const { data: existing } = await supabase
    .from("voice_calls")
    .select("id, transcript, outcome, started_at")
    .eq("twilio_call_sid", callSid)
    .maybeSingle();

  if (!existing) {
    // No prior row (first event happens to be a status callback) — seed one.
    update.started_at = new Date().toISOString();
    update.outcome = "pending";
  }

  if (transcriptFromForm && !existing?.transcript) {
    update.transcript = transcriptFromForm;
  }

  const { data: row } = await supabase
    .from("voice_calls")
    .upsert(update, { onConflict: "twilio_call_sid" })
    .select("id, transcript, duration_seconds, outcome, direction")
    .maybeSingle();

  // On completion: classify, log, fire trigger — fire-and-forget so Twilio
  // gets a fast response. Failures are swallowed but logged.
  if (isCompleted && row?.id) {
    const finalTranscript = (row.transcript as string | null) || transcriptFromForm || "";
    const finalDuration =
      (row.duration_seconds as number | null) ??
      (typeof duration === "number" ? duration : 0);
    const alreadyClassified =
      row.outcome && row.outcome !== "pending";

    // Kick off classification in the background — don't await Twilio response.
    (async () => {
      try {
        let outcome: string = row.outcome as string;
        if (!alreadyClassified) {
          const classified = await classifyCallOutcome({
            transcript: finalTranscript,
            durationSeconds: finalDuration || 0,
          });
          outcome = classified.outcome;
          await supabase
            .from("voice_calls")
            .update({
              outcome,
              metadata: {
                classifier_reason: classified.reason,
              },
            })
            .eq("id", row.id);
        }

        // Trinity timeline row
        await supabase.from("trinity_log").insert({
          action_type: "ai_receptionist",
          description: `Voice call ${outcome}: ${from || "unknown"} → ${to || "unknown"} (${finalDuration}s)`,
          client_id: client.clientId,
          profile_id: client.profileId,
          status: "completed",
          result: {
            type: "voice_call",
            twilio_call_sid: callSid,
            outcome,
            duration_seconds: finalDuration,
            from_number: from,
            to_number: to,
          },
        });

        // Fire workflow trigger with filter-matchable payload.
        await fireVoiceCallCompletedTrigger(supabase, client.profileId, {
          call_id: row.id as string,
          twilio_call_sid: callSid,
          client_id: client.clientId,
          from_number: from,
          to_number: to,
          direction: (row.direction as string | null) ?? twilioDirection,
          duration_seconds: finalDuration,
          outcome,
          transcript: finalTranscript || null,
        });
      } catch (err) {
        console.warn("[voice-status] post-completion pipeline failed:", err);
      }
    })();
  }

  return NextResponse.json({ ok: true });
}
