import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { checkLimit, recordUsage } from "@/lib/usage-limits";
import {
  anthropic,
  MODEL_SONNET,
  safeJsonParse,
  getResponseText,
} from "@/lib/ai/claude-helpers";
import type Anthropic from "@anthropic-ai/sdk";

/**
 * POST /api/video/classify-footage
 *
 * Auto-detect what TYPE of content a clip is (webcam talking head, vlog,
 * b-roll, screen recording, gameplay, product shot, …) and suggest a
 * preset pack + editing decisions. Backs the "Detected: X" pill in the
 * video editor.
 *
 * Caveat on frame extraction: Claude Sonnet Vision currently accepts
 * IMAGE inputs only (no native video). The route fetches the `video_url`
 * and feeds it to Claude as an image source. For MP4/MOV URLs the caller
 * should pass a frame still (thumbnail) URL — this keeps the route thin,
 * avoids bundling ffmpeg on Vercel, and defers multi-frame sampling to
 * a follow-up (`frame_sample_count` is accepted and echoed for API
 * forward-compat but only the first still is sent today). See top-level
 * comment in `src/app/api/video/analyze-reference/route.ts` which uses
 * the same contract.
 */

export const maxDuration = 60;

// ── Types ────────────────────────────────────────────────────────────────

type FootageType =
  | "webcam_talking_head"
  | "vlog"
  | "screen_recording"
  | "gameplay"
  | "b_roll"
  | "interview_seated"
  | "product_close_up"
  | "action_handheld"
  | "drone_aerial"
  | "animation_motion_graphics"
  | "dance_performance"
  | "text_only_slide"
  | "unknown";

const FOOTAGE_TYPES: readonly FootageType[] = [
  "webcam_talking_head",
  "vlog",
  "screen_recording",
  "gameplay",
  "b_roll",
  "interview_seated",
  "product_close_up",
  "action_handheld",
  "drone_aerial",
  "animation_motion_graphics",
  "dance_performance",
  "text_only_slide",
  "unknown",
] as const;

export interface ClassifyFootageInput {
  video_url?: string;
  client_id?: string;
  frame_sample_count?: number;
}

export interface ClassifyFootageOutput {
  footage_type: FootageType;
  confidence: number;
  detected_subjects: string[];
  lighting: string;
  motion_level: "none" | "low" | "medium" | "high" | "very-high";
  color_palette: string[];
  recommended_creator_pack_id: string;
  suggested_edits: string[];
  frame_sample_count: number;
  model: string;
}

// ── Prompt ───────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a professional video editor and footage librarian who classifies raw clips in one glance. Given a still frame extracted from an uploaded clip, you decide what TYPE of content it is and return a strictly-typed JSON classification that the editor app uses to pre-select a creator preset pack.

CLASSIFICATION CATEGORIES (pick exactly one)
- webcam_talking_head  → single person to camera, fixed angle, tight shot, usually desk / room background (YouTube/explainer).
- vlog                 → handheld or selfie-style, moving, lifestyle / day-in-life energy.
- screen_recording     → software UI, code editor, browser, tutorial capture — no camera footage.
- gameplay             → video game footage, HUD / UI, stylized 3D rendering.
- b_roll               → scenery, nature, product, abstract filler with no primary subject speaking.
- interview_seated     → two or more people seated across from each other, podcast / interview setup.
- product_close_up     → single product, shallow depth of field, studio lighting, e-comm style.
- action_handheld      → fast-moving, sports, activity, first-person perspective.
- drone_aerial         → overhead / sweeping / high-altitude perspective.
- animation_motion_graphics → vector, 2D cartoon, kinetic type, After Effects look.
- dance_performance    → full-body human performance / dance / choreography.
- text_only_slide      → slide deck, bold text on solid/gradient background, no photo subject.
- unknown              → when you genuinely can't tell (rare; prefer the closest real match).

RECOMMENDED CREATOR PACK IDS (pick the closest — return exactly one string)
- creator_ali_abdaal          → clean YouTube explainer, warm desk light, muted captions
- creator_casey_neistat       → fast handheld vlog, punchy cuts, tight captions
- creator_mrbeast             → extreme zoom-ins, bold captions, high energy
- creator_mkbhd               → clean product shots, minimal captions, tech-review polish
- creator_emma_chamberlain    → lo-fi vlog, film grain, playful captions
- creator_valuetainment       → seated interview, lower thirds, serious tone
- creator_corridor_digital    → gameplay / VFX, stylized overlays, kinetic energy
- creator_fstoppers           → drone / cinematic b-roll, teal-orange grade, minimal text
- creator_dude_perfect        → action sports, hype music, bold on-screen score
- creator_vox                 → motion-graphics / data-driven, narrated, clean typography
- creator_tiktok_dance        → dance / performance, beat-synced captions, vertical
- creator_generic_minimal     → fallback: clean neutral pack when no specific creator fits

OUTPUT FORMAT — respond with ONLY raw JSON matching exactly this shape (no markdown, no commentary):
{
  "footage_type": "<one of the categories above>",
  "confidence": <0..1>,
  "detected_subjects": ["person", "desk", "microphone"],
  "lighting": "<softbox natural | window daylight | overhead fluorescent | low-key moody | sunset golden | overcast flat | stage / performance | studio strobe | screen-glow>",
  "motion_level": "<none | low | medium | high | very-high>",
  "color_palette": ["<named colour>", "<named colour>", "<named colour>"],
  "recommended_creator_pack_id": "<one of the creator pack ids above>",
  "suggested_edits": [
    "<concrete editing instruction 1>",
    "<concrete editing instruction 2>",
    "<concrete editing instruction 3>"
  ]
}

RULES
- Confidence must reflect how much the frame actually shows. A blurry frame = lower confidence.
- suggested_edits must be 3 concrete, actionable instructions (caption style, motion, music mood, colour grade).
- Never invent fields or nest objects beyond the shape above.`;

// ── Helpers ──────────────────────────────────────────────────────────────

function normalizeMediaType(
  mt: string,
): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  if (mt.includes("png")) return "image/png";
  if (mt.includes("gif")) return "image/gif";
  if (mt.includes("webp")) return "image/webp";
  return "image/jpeg";
}

async function downloadAsBase64(
  url: string,
): Promise<{ data: string; mediaType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch frame (${res.status})`);
  const contentType = res.headers.get("content-type") || "image/jpeg";
  // Video MIME types cannot be sent to Claude Vision — reject upfront so the
  // caller knows to extract a still first rather than silently 500.
  if (contentType.startsWith("video/")) {
    throw new Error(
      "video/* MIME received — Claude Vision needs an image still; extract a frame client-side or pass a thumbnail URL.",
    );
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return { data: buf.toString("base64"), mediaType: contentType };
}

function coerceFootageType(raw: unknown): FootageType {
  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    const hit = FOOTAGE_TYPES.find((t) => t === normalized);
    if (hit) return hit;
  }
  return "unknown";
}

function coerceMotionLevel(
  raw: unknown,
): ClassifyFootageOutput["motion_level"] {
  const allowed: ClassifyFootageOutput["motion_level"][] = [
    "none",
    "low",
    "medium",
    "high",
    "very-high",
  ];
  if (typeof raw === "string" && allowed.includes(raw as never)) {
    return raw as ClassifyFootageOutput["motion_level"];
  }
  return "medium";
}

function coerceStringArray(raw: unknown, fallback: string[]): string[] {
  if (!Array.isArray(raw)) return fallback;
  return raw
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function coerceConfidence(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0.5;
  return Math.max(0, Math.min(1, raw));
}

// ── Handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "AI not configured (missing ANTHROPIC_API_KEY)." },
      { status: 500 },
    );
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Profile not found" }, { status: 403 });
  }

  // Plan-tier monthly metering — Vision calls cost money.
  const limit = await checkLimit(ownerId, "tokens", 1);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: limit.reason || "Monthly token limit reached — upgrade to continue.",
        plan_tier: limit.plan_tier,
        current: limit.current,
        limit: limit.limit,
      },
      { status: 429 },
    );
  }

  let body: ClassifyFootageInput;
  try {
    body = (await request.json()) as ClassifyFootageInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const videoUrl = typeof body.video_url === "string" ? body.video_url.trim() : "";
  if (!videoUrl) {
    return NextResponse.json(
      { error: "video_url is required (public URL to the clip or a frame still)." },
      { status: 400 },
    );
  }

  const frameSampleCount = Math.max(
    1,
    Math.min(5, typeof body.frame_sample_count === "number" ? body.frame_sample_count : 3),
  );

  let imageSource: Anthropic.ImageBlockParam["source"];
  try {
    const { data, mediaType } = await downloadAsBase64(videoUrl);
    imageSource = {
      type: "base64",
      media_type: normalizeMediaType(mediaType),
      data,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: "Failed to load frame", detail: message },
      { status: 400 },
    );
  }

  try {
    const response = await anthropic.messages.create({
      model: MODEL_SONNET,
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: imageSource },
            {
              type: "text",
              text: "Classify this footage frame and return the JSON described in the system prompt. JSON only.",
            },
          ],
        },
      ],
    });

    const text = getResponseText(response);
    const parsed = safeJsonParse<Partial<ClassifyFootageOutput>>(text);

    if (!parsed || typeof parsed !== "object") {
      return NextResponse.json(
        {
          error: "Claude returned an invalid response",
          raw: text.slice(0, 500),
        },
        { status: 502 },
      );
    }

    const out: ClassifyFootageOutput = {
      footage_type: coerceFootageType(parsed.footage_type),
      confidence: coerceConfidence(parsed.confidence),
      detected_subjects: coerceStringArray(parsed.detected_subjects, []),
      lighting:
        typeof parsed.lighting === "string" && parsed.lighting.trim()
          ? parsed.lighting.trim()
          : "unknown",
      motion_level: coerceMotionLevel(parsed.motion_level),
      color_palette: coerceStringArray(parsed.color_palette, []),
      recommended_creator_pack_id:
        typeof parsed.recommended_creator_pack_id === "string" &&
        parsed.recommended_creator_pack_id.trim()
          ? parsed.recommended_creator_pack_id.trim()
          : "creator_generic_minimal",
      suggested_edits: coerceStringArray(parsed.suggested_edits, []),
      frame_sample_count: frameSampleCount,
      model: MODEL_SONNET,
    };

    // Best-effort usage tracking — don't fail the request if either side fails.
    const totalTokens =
      (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);
    void recordUsage(ownerId, "tokens", totalTokens || 1500, {
      source: "video_classify_footage",
      footage_type: out.footage_type,
      confidence: out.confidence,
    });

    const serviceSupabase = createServiceClient();
    void serviceSupabase.from("trinity_log").insert({
      action_type: "ai_video_classify_footage",
      description: `Classified clip as ${out.footage_type} (${Math.round(
        out.confidence * 100,
      )}%)`,
      profile_id: user.id,
      status: "completed",
      result: {
        footage_type: out.footage_type,
        confidence: out.confidence,
        recommended_creator_pack_id: out.recommended_creator_pack_id,
        generated_at: new Date().toISOString(),
      },
    });

    return NextResponse.json(out);
  } catch (err) {
    console.error("[video/classify-footage] error", err);
    const message = err instanceof Error ? err.message : "Unknown Claude API error";
    return NextResponse.json(
      { error: "Failed to classify footage", detail: message },
      { status: 500 },
    );
  }
}
