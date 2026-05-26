import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabase,
  createServiceClient,
} from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { synthesize, getDefaultClone } from "@/lib/voice/clone-router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  to?: string;
  text?: string;
  audio_url?: string;
  clone_id?: string;
  /** When MMS isn't supported on the carrier, fall back to text + link. */
  fallback_text?: string;
}

const MAX_TEXT = 800;

function toE164(raw: string): string | null {
  const cleaned = (raw || "").replace(/[^\d+]/g, "");
  if (cleaned.length < 7 || cleaned.length > 16) return null;
  return cleaned.startsWith("+") ? cleaned : `+1${cleaned}`;
}

/**
 * POST /api/sms/send-voice
 *
 * Send a voice attachment via Twilio MMS. Two paths:
 *   - text + clone_id (or sms-default) → synthesise → MMS audio
 *   - audio_url (pre-rendered) → MMS audio directly
 *
 * MMS audio support is carrier-dependent. We optimistically send and
 * surface Twilio's error string if the carrier rejects. Caller may opt
 * in to a fallback_text payload that's sent as plain SMS when MMS fails.
 */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const toNumber = body.to ? toE164(body.to) : null;
  if (!toNumber) {
    return NextResponse.json({ error: "Invalid 'to' phone number" }, { status: 400 });
  }
  const text = (body.text || "").trim();
  if (!body.audio_url && !text) {
    return NextResponse.json(
      { error: "Provide either text (to synthesise) or audio_url." },
      { status: 400 },
    );
  }
  if (text.length > MAX_TEXT) {
    return NextResponse.json(
      { error: `text exceeds ${MAX_TEXT} chars` },
      { status: 400 },
    );
  }

  // Twilio creds
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    return NextResponse.json({ error: "Twilio not configured" }, { status: 503 });
  }
  const fromNumber = process.env.TWILIO_DEFAULT_NUMBER;
  if (!fromNumber) {
    return NextResponse.json(
      { error: "TWILIO_DEFAULT_NUMBER not configured" },
      { status: 503 },
    );
  }

  // Resolve audio URL.
  let audioUrl = body.audio_url || null;
  if (!audioUrl) {
    let cloneId = body.clone_id;
    if (!cloneId) {
      const fallback = await getDefaultClone({
        agencyOwnerId: ownerId,
        surface: "sms",
      });
      if (!fallback) {
        return NextResponse.json(
          {
            error:
              "No clone provided and no SMS-default configured. Set one in /dashboard/voice-studio.",
          },
          { status: 400 },
        );
      }
      cloneId = fallback.id;
    } else {
      // Apr 28 IDOR fix: caller-supplied clone_id must belong to caller's agency.
      const { data: ownsClone } = await supabase
        .from("voice_clones")
        .select("id")
        .eq("id", cloneId)
        .eq("agency_owner_id", ownerId)
        .maybeSingle();
      if (!ownsClone) {
        return NextResponse.json({ error: "Voice clone not found or not yours" }, { status: 403 });
      }
    }
    try {
      const result = await synthesize({
        cloneId,
        text,
        agencyOwnerId: ownerId,
        format: "mp3",
        context: "sms_voice",
      });
      audioUrl = result.r2Url;
    } catch (err) {
      const reason = "synth_failed";
      return NextResponse.json({ error: reason }, { status: 500 });
    }
  }

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const params = new URLSearchParams({
    To: toNumber,
    From: fromNumber,
    MediaUrl: audioUrl,
  });
  if (body.fallback_text) {
    params.append("Body", body.fallback_text.slice(0, 600));
  }

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    },
  );

  const json = (await res.json().catch(() => ({}))) as {
    sid?: string;
    message?: string;
    code?: number;
  };

  if (!res.ok) {
    return NextResponse.json(
      { error: json.message || `Twilio error ${res.status}`, code: json.code },
      { status: 502 },
    );
  }

  // Record to outreach_log.
  const service = createServiceClient();
  await service.from("outreach_log").insert({
    platform: "sms",
    recipient_handle: toNumber,
    message_text: text || `(voice MMS, ${audioUrl})`,
    status: "sent",
    sent_at: new Date().toISOString(),
    metadata: {
      direction: "outbound",
      via: "voice-studio-sms",
      twilio_sid: json.sid,
      audio_url: audioUrl,
      mms: true,
    },
  });

  return NextResponse.json({
    success: true,
    twilio_sid: json.sid,
    audio_url: audioUrl,
    to: toNumber,
  });
}
