import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { upsertInboundMessage } from "@/lib/conversations";
import { exitRunsForContact } from "@/lib/sequences/engine";
import { captureVoiceSample } from "@/lib/ai/voice-profile";
import crypto from "crypto";

// Zernio webhook → Conversations.
//
// Zernio forwards inbound Instagram (and other platform) DMs. Expected
// payload shape (verified against Zernio docs April 2026):
//   {
//     platform: "instagram",
//     profile_id: "abc123",       — the zernio_profile_id on clients
//     thread_id: "ig_thread_xyz",
//     message_id: "...",
//     from: { id: "sender_ig_id", username: "their_handle" },
//     to: { id: "recipient_ig_id", username: "our_handle" },
//     text: "Hey!",
//     attachments: [{ url, type }],
//     timestamp: "2026-04-23T..."
//   }
//
// Owner resolution: match `profile_id` against clients.zernio_profile_id,
// then use that client's profile_id as the agency owner.
//
// Register at: https://zernio.com/app/settings/webhooks
// URL:         https://app.shortstack.work/api/webhooks/zernio
// Set ZERNIO_WEBHOOK_SECRET for HMAC verification.

export const runtime = "nodejs";
export const maxDuration = 15;

function verifyZernioSignature(raw: string, signature: string | null): boolean {
  const secret = process.env.ZERNIO_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhooks/zernio] ZERNIO_WEBHOOK_SECRET is not set — rejecting request. Configure the secret in Vercel env.");
    return false; // fail-closed
  }
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  // Decode hex strings to bytes before timingSafeEqual. utf8 decoding
  // (the default) of a hex string produces a buffer twice the size of
  // the actual digest, so length checks always fail. See discord webhook
  // for the same fix; both were never verifying a valid signature
  // before this patch.
  try {
    const sigBytes = Buffer.from(signature, "hex");
    const expectedBytes = Buffer.from(expected, "hex");
    if (sigBytes.length !== expectedBytes.length) return false;
    return crypto.timingSafeEqual(sigBytes, expectedBytes);
  } catch {
    return false;
  }
}

type ZernioInbound = {
  platform?: string;
  profile_id?: string;
  thread_id?: string;
  message_id?: string;
  from?: { id?: string; username?: string };
  to?: { id?: string; username?: string };
  text?: string;
  attachments?: Array<{ url: string; type?: string; filename?: string }>;
  timestamp?: string;
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const sig = request.headers.get("x-zernio-signature") || request.headers.get("x-webhook-signature");
  if (!verifyZernioSignature(rawBody, sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: ZernioInbound;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload.thread_id || !payload.profile_id) {
    return NextResponse.json({ ok: true, skipped: "missing_ids" });
  }

  // Platform mapping: Zernio spans multiple networks, but for the inbox we
  // currently only model Instagram. Other platforms are logged but skip
  // the conversation write (extend when we add tiktok/linkedin threads).
  const channel = payload.platform === "instagram" ? "instagram" : null;
  if (!channel) return NextResponse.json({ ok: true, skipped: "unsupported_platform" });

  const supabase = createServiceClient();

  // Resolve owner: the Zernio profile belongs to a client, which points to
  // an agency profile_id.
  const { data: client } = await supabase
    .from("clients")
    .select("id, profile_id")
    .eq("zernio_profile_id", payload.profile_id)
    .maybeSingle();
  const ownerId = (client as { profile_id?: string } | null)?.profile_id;
  const contactId = (client as { id?: string } | null)?.id ?? null;

  if (!ownerId) {
    return NextResponse.json({ ok: true, skipped: "no_owner" });
  }

  const sentAt = payload.timestamp ? new Date(payload.timestamp) : new Date();

  await upsertInboundMessage({
    supabase,
    userId: ownerId,
    channel,
    externalThreadId: payload.thread_id,
    fromIdentifier: payload.from?.username || payload.from?.id || "unknown",
    toIdentifier: payload.to?.username || payload.to?.id,
    body: payload.text,
    externalMessageId: payload.message_id,
    attachments: (payload.attachments || []).map((a) => ({
      url: a.url,
      filename: a.filename,
      mimetype: a.type,
    })),
    contactId,
    sentAt,
  });

  // Multi-channel sequences: try to map the sender's IG handle to a lead
  // (leads.instagram_url) and exit any active sequence runs. Soft-fail —
  // most DMs won't map to a tracked lead, that's expected.
  const senderHandle = payload.from?.username;
  if (senderHandle) {
    const { data: matchedLead } = await supabase
      .from("leads")
      .select("id")
      .eq("user_id", ownerId)
      .ilike("instagram_url", `%${senderHandle}%`)
      .limit(1)
      .maybeSingle();
    if (matchedLead?.id) {
      await exitRunsForContact(supabase, matchedLead.id, "replied_dm").catch((err) => {
        console.warn("[zernio-webhook] exitRunsForContact failed:", err);
      });
    }
  }

  // Capture client DM voice — anchor to the contact (client) when we have one.
  // Fire-and-forget: storage failures must never break the inbound webhook.
  if (contactId && payload.text) {
    captureVoiceSample({
      agencyOwnerId: ownerId,
      subjectKind: "client",
      subjectId: contactId,
      source: "reply_dm",
      body: payload.text,
      channel: "dm",
    }).catch((err) => console.warn("[voice-capture/zernio]", err));
  }

  // ── Lead Pipeline routing ─────────────────────────────────────────────────
  // Match the sender to a lead in the pipeline and route based on their stage.
  if (senderHandle && ownerId) {
    const { data: pipelineLead } = await supabase
      .from("lead_pipeline")
      .select("id, stage, owner_id")
      .eq("owner_id", ownerId)
      .eq("platform", "instagram")
      .ilike("handle", senderHandle)
      .not("stage", "in", '("dead","converted","closed","delivered")')
      .limit(1)
      .maybeSingle();

    if (pipelineLead?.id) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work";
      const webhookKey = process.env.WEBHOOK_SECRET || "";
      const stage = pipelineLead.stage as string;

      // ── Early stages: outreach_sent / replied / qualifying / qualified ──
      // Route to AI qualification agent
      if (
        ["outreach_sent", "replied", "qualifying", "qualified",
         "payment_sent", "payment_received"].includes(stage) &&
        payload.text
      ) {
        // Advance to "replied" on first inbound
        if (stage === "outreach_sent") {
          await supabase
            .from("lead_pipeline")
            .update({ stage: "replied", last_reply_at: new Date().toISOString() })
            .eq("id", pipelineLead.id);
        }

        fetch(`${appUrl}/api/leadgen/qualify`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-webhook-key": webhookKey },
          body: JSON.stringify({
            lead_id: pipelineLead.id,
            message: payload.text,
            attachments: (payload.attachments || []).map((a) => ({
              url: a.url,
              type: a.type,
              filename: a.filename,
            })),
          }),
        }).catch((err) =>
          console.warn("[zernio-webhook] leadgen qualify trigger failed:", err),
        );
      }

      // ── Onboarding stage: collecting credentials ───────────────────────
      else if (stage === "onboarding" && payload.text) {
        fetch(`${appUrl}/api/leadgen/onboard`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-webhook-key": webhookKey },
          body: JSON.stringify({
            lead_id: pipelineLead.id,
            owner_id: pipelineLead.owner_id,
            inbound_message: payload.text,
          }),
        }).catch((err) =>
          console.warn("[zernio-webhook] leadgen onboard trigger failed:", err),
        );
      }

      // ── Scripting stage: waiting for footage ───────────────────────────
      // Route to footage processor when the lead sends a video attachment
      // (or a text message indicating they want AI-generated content)
      else if (stage === "scripting") {
        const hasVideoAttachment = (payload.attachments || []).some((a) => {
          if (a.type && a.type.startsWith("video/")) return true;
          const ext =
            (a.filename ?? "").split(".").pop()?.toLowerCase() ??
            a.url.split(".").pop()?.split("?")[0].toLowerCase() ??
            "";
          return ["mp4", "mov", "avi", "webm", "mkv", "m4v"].includes(ext);
        });

        const isAiRequest =
          payload.text &&
          /ai generat|generate|create.*video|make.*video/i.test(payload.text);

        if (hasVideoAttachment || isAiRequest) {
          const videoAttachment = (payload.attachments || []).find((a) => {
            if (a.type && a.type.startsWith("video/")) return true;
            const ext =
              (a.filename ?? "").split(".").pop()?.toLowerCase() ??
              a.url.split(".").pop()?.split("?")[0].toLowerCase() ??
              "";
            return ["mp4", "mov", "avi", "webm", "mkv", "m4v"].includes(ext);
          });

          const needsThumbnail =
            payload.text ? /thumbnail/i.test(payload.text) : false;

          fetch(`${appUrl}/api/leadgen/process-footage`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-webhook-key": webhookKey },
            body: JSON.stringify({
              lead_id: pipelineLead.id,
              owner_id: pipelineLead.owner_id,
              footage_url: videoAttachment?.url || "",
              needs_thumbnail: needsThumbnail,
              brief: payload.text || "",
              attachments: payload.attachments || [],
            }),
          }).catch((err) =>
            console.warn("[zernio-webhook] leadgen process-footage trigger failed:", err),
          );
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
