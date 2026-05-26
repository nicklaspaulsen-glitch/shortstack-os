import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { synthesize, getDefaultClone } from "@/lib/voice/clone-router";
import { sendVoiceDM as zernioVoiceDM, ZERNIO_DM_PLATFORMS } from "@/lib/services/zernio";
import { sendVoiceDm as legacyVoiceDm } from "@/lib/voice/voice-dm-router";
import type { VoiceDmPlatform } from "@/lib/voice/voice-dm-router";
import { secureCompare } from "@/lib/security/ssrf-guard";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/leadgen/voice-outreach
 *
 * n8n calls this when a new potential lead is detected (new follower,
 * comment, or manually triggered). We:
 *   1. Synthesize the owner's cloned voice saying the outreach script.
 *   2. Send the voice DM via the platform.
 *   3. Upsert a row in lead_pipeline at stage=outreach_sent.
 *
 * Auth: WEBHOOK_SECRET header (same key used by /api/webhooks/inbound).
 * This is an internal API — n8n is operator-controlled infrastructure.
 *
 * Body:
 *   owner_id        — agency owner to act on behalf of
 *   handle          — recipient @username / IG PSID / Telegram chat_id
 *   platform        — "instagram" | "telegram" | "facebook"
 *   niche?          — lead's apparent niche (used to personalise the script)
 *   first_name?     — lead's name if known
 *   custom_script?  — override the generated script entirely
 *   n8n_execution_id? — for tracing
 */
interface VoiceOutreachBody {
  owner_id: string;
  handle: string;
  platform: string;
  niche?: string;
  first_name?: string;
  custom_script?: string;
  n8n_execution_id?: string;
}

// Accept any Zernio-supported DM platform (instagram, facebook, twitter, tiktok, linkedin, telegram)
const VALID_PLATFORMS: readonly string[] = ZERNIO_DM_PLATFORMS;

export async function POST(request: NextRequest) {
  // Auth: WEBHOOK_SECRET
  const key =
    request.headers.get("x-webhook-key") ||
    new URL(request.url).searchParams.get("key");
  const expectedKey = process.env.WEBHOOK_SECRET;
  if (!expectedKey) {
    return NextResponse.json({ error: "WEBHOOK_SECRET not configured" }, { status: 503 });
  }
  if (!key || !secureCompare(key, expectedKey)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: VoiceOutreachBody;
  try {
    body = (await request.json()) as VoiceOutreachBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { owner_id, handle, platform, niche, first_name, custom_script, n8n_execution_id } = body;

  if (!owner_id) return NextResponse.json({ error: "Missing owner_id" }, { status: 400 });
  if (!handle?.trim()) return NextResponse.json({ error: "Missing handle" }, { status: 400 });
  if (!platform || !VALID_PLATFORMS.includes(platform as typeof VALID_PLATFORMS[number])) {
    return NextResponse.json(
      { error: `platform must be one of: ${VALID_PLATFORMS.join(", ")}` },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  // Verify the owner_id actually exists
  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("id, full_name, agency_name")
    .eq("id", owner_id)
    .maybeSingle();
  if (!ownerProfile) {
    return NextResponse.json({ error: "owner_id not found" }, { status: 404 });
  }

  // Avoid duplicate outreach: if we already sent a voice DM to this lead in
  // the last 7 days (and it's still active), return the existing record.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await supabase
    .from("lead_pipeline")
    .select("id, stage, voice_message_url")
    .eq("owner_id", owner_id)
    .eq("platform", platform)
    .eq("handle", handle.replace(/^@/, ""))
    .gte("created_at", sevenDaysAgo)
    .not("stage", "eq", "dead")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "duplicate_within_7d",
      lead_id: existing.id,
      stage: existing.stage,
    });
  }

  // Build the outreach script
  const recipientName = first_name ? first_name : "there";
  const nicheContext = niche ? ` who work in ${niche}` : "";
  const agencyName = ownerProfile.agency_name || ownerProfile.full_name || "our agency";

  const script =
    custom_script?.trim() ||
    `Hey ${recipientName}! I noticed you and wanted to reach out. At ${agencyName} we help business owners${nicheContext} with content creation and paid ads that actually convert. If you're looking to grow your brand and get more leads, I'd love to help. Just shoot me a message and we can figure out if there's a fit. No pressure at all!`;

  // Resolve the owner's default DM clone
  const defaultClone = await getDefaultClone({ agencyOwnerId: owner_id, surface: "dm" });
  if (!defaultClone) {
    // No clone available — create the pipeline record as outreach_pending
    const { data: pendingRow } = await supabase
      .from("lead_pipeline")
      .insert({
        owner_id,
        platform,
        handle: handle.replace(/^@/, ""),
        stage: "outreach_pending",
        outreach_text: script,
        source: "voice_outreach",
        n8n_execution_id: n8n_execution_id || null,
      })
      .select("id")
      .single();

    // Notify the owner so they know a lead is waiting (not silently queued).
    await notifyTelegram(
      `⏳ Lead queued (no voice clone): @${handle.replace(/^@/, "")} on ${platform}\n` +
      `Configure a voice clone at /dashboard/voice-studio to send voice DMs automatically.`,
    );

    return NextResponse.json({
      ok: false,
      queued: true,
      reason: "no_voice_clone_configured",
      lead_id: pendingRow?.id || null,
      message: "Configure a voice clone in /dashboard/voice-studio to enable voice DMs.",
    });
  }

  // Synthesize voice
  let audioUrl: string;
  try {
    const synth = await synthesize({
      cloneId: defaultClone.id,
      text: script,
      agencyOwnerId: owner_id,
      format: "mp3",
      context: `leadgen_outreach:${platform}`,
    });
    audioUrl = synth.r2Url;
  } catch (err) {
    const reason = "synth_failed";
    console.error("[leadgen/voice-outreach] synthesis failed:", reason);
    return NextResponse.json({ ok: false, error: `Voice synthesis failed: ${reason}` }, { status: 500 });
  }

  // Send voice DM — Zernio first (all platforms), legacy fallback for instagram/facebook/telegram
  const normalHandle = handle.replace(/^@/, "");
  const zResult = await zernioVoiceDM({
    platform,
    handle: normalHandle,
    audioUrl,
    caption: "Hey! Listen to my quick message 👋",
  });

  let dmResult: { ok: boolean; queued?: boolean; reason?: string; messageId?: string };
  if (zResult.ok) {
    dmResult = { ok: true, messageId: zResult.messageId };
  } else {
    // Zernio failed — try legacy voice-dm-router for supported platforms
    const legacyPlatforms: VoiceDmPlatform[] = ["instagram", "facebook", "telegram"];
    if (legacyPlatforms.includes(platform as VoiceDmPlatform)) {
      const legacy = await legacyVoiceDm({
        platform: platform as VoiceDmPlatform,
        recipient: normalHandle,
        audioUrl,
        caption: "Hey! Listen to my quick message 👋",
      });
      dmResult = legacy;
    } else {
      dmResult = { ok: false, reason: zResult.error || "Zernio voice DM failed" };
    }
  }

  const stage = dmResult.ok ? "outreach_sent" : (dmResult.queued ? "outreach_sent" : "outreach_pending");

  // Persist to lead_pipeline
  const { data: pipelineRow, error: dbErr } = await supabase
    .from("lead_pipeline")
    .insert({
      owner_id,
      platform,
      handle: handle.replace(/^@/, ""),
      stage,
      voice_message_url: audioUrl,
      outreach_text: script,
      outreach_sent_at: (dmResult.ok || dmResult.queued) ? new Date().toISOString() : null,
      source: "voice_outreach",
      n8n_execution_id: n8n_execution_id || null,
      message_history: JSON.stringify([
        {
          role: "assistant",
          content: `[voice message] ${script}`,
          timestamp: new Date().toISOString(),
        },
      ]),
    })
    .select("id")
    .single();

  if (dbErr) {
    console.error("[leadgen/voice-outreach] db insert failed:", dbErr.message);
  }

  return NextResponse.json({
    ok: dmResult.ok || Boolean(dmResult.queued),
    queued: Boolean(dmResult.queued),
    sent: dmResult.ok,
    lead_id: pipelineRow?.id || null,
    audio_url: audioUrl,
    stage,
    reason: dmResult.reason || null,
  });
}

async function notifyTelegram(msg: string): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!chatId || !botToken) return;
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: msg }),
  }).catch(() => {});
}
