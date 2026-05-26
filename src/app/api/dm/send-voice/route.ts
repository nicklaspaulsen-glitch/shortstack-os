import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabase,
  createServiceClient,
} from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { synthesize, getDefaultClone } from "@/lib/voice/clone-router";
import {
  sendVoiceDm,
  type VoiceDmPlatform,
} from "@/lib/voice/voice-dm-router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PLATFORMS: ReadonlyArray<VoiceDmPlatform> = [
  "instagram",
  "facebook",
  "telegram",
  "whatsapp",
  "linkedin",
  "twitter",
  "x",
  "tiktok",
];

interface VoiceDmBody {
  platform?: string;
  recipient?: string;
  text?: string;
  /** Skip synthesis, send a pre-rendered audio_url directly. */
  audio_url?: string;
  clone_id?: string;
  caption?: string;
}

const MAX_TEXT = 600;

/**
 * POST /api/dm/send-voice
 *
 * Two paths:
 *   - text + clone_id (or default voicemail clone) → synthesise → upload → DM
 *   - audio_url (already rendered) → DM directly (skip synthesis)
 *
 * Records to outreach_log either way (status='sent' / 'queued' / 'failed').
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

  let body: VoiceDmBody;
  try {
    body = (await request.json()) as VoiceDmBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const platform = body.platform as VoiceDmPlatform | undefined;
  if (!platform || !VALID_PLATFORMS.includes(platform)) {
    return NextResponse.json(
      {
        error: `platform must be one of: ${VALID_PLATFORMS.join(", ")}`,
      },
      { status: 400 },
    );
  }
  const recipient = (body.recipient || "").trim().replace(/^@/, "");
  if (!recipient) {
    return NextResponse.json({ error: "Missing recipient" }, { status: 400 });
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

  // Resolve audio URL — synthesise on demand if only text was given.
  let audioUrl = body.audio_url || null;
  if (!audioUrl) {
    let cloneId = body.clone_id;
    if (!cloneId) {
      const fallback = await getDefaultClone({
        agencyOwnerId: ownerId,
        surface: "dm",
      });
      if (!fallback) {
        return NextResponse.json(
          {
            error:
              "No clone provided and no DM-default configured. Set one in /dashboard/voice-studio.",
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
        context: `dm_voice:${platform}`,
      });
      audioUrl = result.r2Url;
    } catch (err) {
      const reason = "synth_failed";
      return NextResponse.json({ error: reason }, { status: 500 });
    }
  }

  const result = await sendVoiceDm({
    platform,
    recipient,
    audioUrl,
    caption: body.caption,
  });

  // Record outreach_log row regardless of outcome.
  const service = createServiceClient();
  let status = "failed";
  if (result.ok) status = "sent";
  else if (result.queued) status = "queued";

  await service.from("outreach_log").insert({
    platform,
    recipient_handle: recipient,
    message_text: text || `(voice note, ${audioUrl})`,
    status,
    sent_at: result.ok ? new Date().toISOString() : null,
    metadata: {
      direction: "outbound",
      via: "voice-studio-dm",
      owner_id: ownerId,
      audio_url: audioUrl,
      provider_message_id: result.messageId || null,
      reason: result.reason || null,
      unsupported: Boolean(result.unsupported),
    },
  });

  if (result.unsupported) {
    return NextResponse.json(
      {
        ok: false,
        unsupported: true,
        reason: result.reason || `Voice DM not supported on ${platform}.`,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: result.ok,
    queued: result.queued || false,
    message_id: result.messageId || null,
    audio_url: audioUrl,
    reason: result.reason || null,
  });
}
