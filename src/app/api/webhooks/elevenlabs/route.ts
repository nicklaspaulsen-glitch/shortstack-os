import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { claimEvent, completeEvent } from "@/lib/webhooks/idempotency";
// IDEMPOTENCY: ElevenLabs retries on non-2xx. Without dedup, retries cause
// duplicate outreach_log updates, duplicate lead-status flips, and duplicate
// trinity_log inserts. We use conversation_id as the stable per-event key.

// POST /api/webhooks/elevenlabs
// Receives conversation events from ElevenLabs Conversational AI.
// Configure this URL in ElevenLabs agent platform_settings.webhooks.
//
// SECURITY: if ELEVENLABS_WEBHOOK_SECRET is configured, we verify the
// HMAC-SHA256 signature ElevenLabs sends in the `ElevenLabs-Signature`
// header. Without this check, anyone on the internet could POST fake
// call outcomes and corrupt lead status / transcripts. The verification
// is fail-closed when the secret IS set; if it isn't, we log and accept
// (back-compat for setups that haven't rotated in the webhook secret).
export async function POST(request: NextRequest) {
  // Read raw body first so we can verify signature against the exact bytes.
  const rawBody = await request.text();

  const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error(
      "[webhooks/elevenlabs] ELEVENLABS_WEBHOOK_SECRET is not set — rejecting request. Configure the secret in ElevenLabs + Vercel to enable HMAC verification.",
    );
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const sigHeader =
    request.headers.get("elevenlabs-signature") ||
    request.headers.get("ElevenLabs-Signature") ||
    request.headers.get("x-elevenlabs-signature") ||
    "";
  if (!sigHeader) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }
  // ElevenLabs signature format is `t=<ts>,v0=<hex-hmac>` (Stripe-like).
  // We support both the full header and a bare hex value.
  const parts = Object.fromEntries(
    sigHeader.split(",").map((kv) => {
      const [k, ...v] = kv.trim().split("=");
      return [k, v.join("=")];
    }),
  );
  const timestamp = parts.t;
  const provided = parts.v0 || sigHeader; // fallback: raw hex
  const payloadToSign = timestamp ? `${timestamp}.${rawBody}` : rawBody;
  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(payloadToSign)
    .digest("hex");
  // Constant-time compare to avoid timing attacks
  const providedBuf = Buffer.from(provided, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (
    providedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(providedBuf, expectedBuf)
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  // Reject replays >5 min old if we have a timestamp
  if (timestamp) {
    const ts = Number(timestamp);
    if (Number.isFinite(ts) && Math.abs(Date.now() / 1000 - ts) > 300) {
      return NextResponse.json({ error: "Timestamp out of window" }, { status: 401 });
    }
  }

  try {
    const body = JSON.parse(rawBody);
    const eventType = body.type || body.event_type;
    const conversationId = body.conversation_id;

    if (!conversationId) {
      return NextResponse.json({ ok: true, skipped: "no conversation_id" });
    }

    const service = createServiceClient();

    // ── Inbound Voice Receptionist join (Apr 27) ────────────────────────
    // The Twilio voice-webhook (route /api/twilio/voice-webhook) hands
    // inbound calls to ElevenLabs ConvAI via a <Connect><Stream> TwiML
    // tag with `twilio_call_sid` passed as a dynamic Parameter. ElevenLabs
    // echoes that variable back on every conversation event, which lets us
    // link the elevenlabs `conversation_id` to the originating Twilio
    // call_sid (and from there to the voice_calls row).
    //
    // Run BEFORE the dedup claim — link is idempotent (filtered on
    // eleven_conversation_id IS NULL) so a re-delivered event won't double-
    // write. We need this to run on retries too in case the original handler
    // crashed before linking.
    const dynamicVars =
      (body.conversation_initiation_client_data?.dynamic_variables as
        | Record<string, unknown>
        | undefined) ??
      (body.dynamic_variables as Record<string, unknown> | undefined) ??
      undefined;
    const twilioCallSid =
      typeof dynamicVars?.twilio_call_sid === "string"
        ? (dynamicVars.twilio_call_sid as string)
        : null;

    if (twilioCallSid) {
      // Best-effort: link voice_calls.eleven_conversation_id. Failures are
      // non-fatal — the call still proceeds, we just lose the join for this
      // one conversation.
      const { error: linkErr } = await service
        .from("voice_calls")
        .update({ eleven_conversation_id: conversationId })
        .eq("twilio_call_sid", twilioCallSid)
        .is("eleven_conversation_id", null);
      if (linkErr) {
        console.warn(
          "[webhooks/elevenlabs] voice_calls link failed:",
          linkErr.message,
        );
      }
    }

    // Claim the event atomically. Returns 'already_done' or 'in_flight' if a
    // prior attempt already ran (or is running). This prevents duplicate
    // outreach_log updates and duplicate trinity_log inserts on retries.
    const claim = await claimEvent(service, "elevenlabs", conversationId);
    if (claim === "already_done") {
      return NextResponse.json({ ok: true, deduped: true });
    }
    if (claim === "in_flight") {
      return NextResponse.json({ ok: true, deduped: true, in_flight: true });
    }

    if (eventType === "conversation_ended" || eventType === "post_conversation") {
      const transcript = body.transcript as Array<{ role: string; message: string }> | undefined;
      const duration = body.call_duration_secs || body.metadata?.call_duration_secs;
      const outcome = body.analysis?.outcome || body.outcome;
      const fullTranscript = (transcript || []).map((t: { role: string; message: string }) => `${t.role}: ${t.message}`).join("\n");

      // ── voice_calls update for inbound receptionist calls ────────────
      // Match by eleven_conversation_id (set above on conversation_initiation
      // or earlier). This is what makes the transcript flow back to the
      // Voice Receptionist dashboard. Falls through to the existing
      // outreach_log path for outbound lead-gen calls (unchanged).
      const { data: voiceCallRow } = await service
        .from("voice_calls")
        .select("id, twilio_call_sid, transcript, outcome, metadata")
        .eq("eleven_conversation_id", conversationId)
        .maybeSingle();

      if (voiceCallRow?.id) {
        const callOutcomeForVoice = outcome || detectOutcome(fullTranscript);
        // Map ElevenLabs outcomes to the voice_calls outcome enum
        // (booked / qualified / unqualified / spam) used by the Claude
        // Haiku classifier in voice-status-callback.
        const mapped =
          callOutcomeForVoice === "interested" ? "qualified"
          : callOutcomeForVoice === "voicemail" ? "spam"
          : callOutcomeForVoice === "not_interested" ? "unqualified"
          : callOutcomeForVoice === "no_answer" ? "spam"
          : "unqualified";
        const existingMeta = (voiceCallRow.metadata as Record<string, unknown>) || {};
        await service
          .from("voice_calls")
          .update({
            transcript: fullTranscript.slice(0, 100_000),
            outcome: mapped,
            duration_seconds: duration ?? null,
            ended_at: new Date().toISOString(),
            metadata: {
              ...existingMeta,
              elevenlabs_outcome_raw: callOutcomeForVoice,
              elevenlabs_conversation_id: conversationId,
              transcript_preview: fullTranscript.slice(0, 500),
              webhook_processed: new Date().toISOString(),
            },
          })
          .eq("id", voiceCallRow.id);
      }

      // Find the outreach log entry for this conversation
      const { data: outreachEntries } = await service
        .from("outreach_log")
        .select("id, lead_id, business_name, metadata")
        .eq("platform", "call")
        .like("message_text", `%conv:${conversationId}%`)
        .limit(1);

      const entry = outreachEntries?.[0];

      if (entry) {
        const meta = (entry.metadata as Record<string, unknown>) || {};

        // Determine status from conversation
        const callOutcome = outcome || detectOutcome(fullTranscript);
        const newStatus = callOutcome === "interested" ? "replied"
          : callOutcome === "voicemail" ? "sent"
          : callOutcome === "not_interested" ? "failed"
          : "sent";

        // Update outreach log
        await service.from("outreach_log").update({
          status: newStatus,
          metadata: {
            ...meta,
            conversation_id: conversationId,
            outcome: callOutcome,
            duration_secs: duration,
            transcript_preview: fullTranscript.slice(0, 500),
            webhook_processed: new Date().toISOString(),
          },
        }).eq("id", entry.id);

        // Update lead status if interested
        if (entry.lead_id && callOutcome === "interested") {
          await service.from("leads").update({ status: "replied" }).eq("id", entry.lead_id);
        } else if (entry.lead_id && callOutcome === "not_interested") {
          await service.from("leads").update({ status: "lost" }).eq("id", entry.lead_id);
        }

        // Log transcript
        await service.from("trinity_log").insert({
          action_type: "lead_gen",
          description: `Call ended: ${entry.business_name || "Unknown"} — ${callOutcome} (${duration || 0}s)`,
          status: "completed",
          metadata: {
            conversation_id: conversationId,
            outcome: callOutcome,
            duration_secs: duration,
            transcript: fullTranscript.slice(0, 5000),
            lead_id: entry.lead_id,
            source: "elevenlabs_webhook",
          },
        });
      }
    }

    await completeEvent(service, "elevenlabs", conversationId);
    return NextResponse.json({ ok: true, event: eventType });
  } catch (err) {
    // Do NOT call completeEvent — leave row as 'processing' so the provider
    // retry can reclaim it after the 5-min stale window and re-run.
    console.error("[webhooks/elevenlabs] error:", err);
    throw err;
  }
}

function detectOutcome(transcript: string): string {
  const lower = transcript.toLowerCase();
  if (!transcript || transcript.length < 20) return "no_answer";
  if (lower.includes("leave a message") || lower.includes("voicemail")) return "voicemail";
  if (lower.includes("sounds good") || lower.includes("interested") || lower.includes("book") || lower.includes("schedule") || lower.includes("tell me more")) return "interested";
  if (lower.includes("not interested") || lower.includes("no thanks") || lower.includes("don't call") || lower.includes("stop calling")) return "not_interested";
  return "unknown";
}
