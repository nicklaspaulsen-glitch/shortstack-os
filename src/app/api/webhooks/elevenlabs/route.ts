import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// POST /api/webhooks/elevenlabs
// Receives conversation events from ElevenLabs Conversational AI.
// Configure this URL in ElevenLabs agent platform_settings.webhooks.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventType = body.type || body.event_type;
    const conversationId = body.conversation_id;

    if (!conversationId) {
      return NextResponse.json({ ok: true, skipped: "no conversation_id" });
    }

    const service = createServiceClient();

    if (eventType === "conversation_ended" || eventType === "post_conversation") {
      const transcript = body.transcript as Array<{ role: string; message: string }> | undefined;
      const duration = body.call_duration_secs || body.metadata?.call_duration_secs;
      const outcome = body.analysis?.outcome || body.outcome;
      const fullTranscript = (transcript || []).map((t: { role: string; message: string }) => `${t.role}: ${t.message}`).join("\n");

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

    return NextResponse.json({ ok: true, event: eventType });
  } catch (err) {
    console.error("[webhooks/elevenlabs] error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
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
