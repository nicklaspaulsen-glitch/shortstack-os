import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { checkFetchUrl } from "@/lib/security/ssrf";
import { checkLimit, recordUsage } from "@/lib/usage-limits";
import {
  anthropic,
  MODEL_SONNET,
  getResponseText,
  safeJsonParse,
} from "@/lib/ai/claude-helpers";

/**
 * POST /api/thumbnail/analyze
 *
 * Body: { image_url: string }
 *
 * Runs Claude Sonnet Vision over the thumbnail and returns a structured
 * analysis (composition, dominant colors, text overlay heuristics, subject
 * emotion, predicted CTR 0-100, and improvement suggestions).
 *
 * Metered with `checkLimit(ownerId, "tokens", 1)`.
 */

export const maxDuration = 60;

interface AnalyzeInput {
  image_url?: unknown;
}

interface AnalysisPayload {
  composition?: string;
  dominant_colors?: string[] | unknown;
  text_overlay?: {
    present?: boolean;
    position?: string;
    legibility?: string;
    text?: string;
  } | unknown;
  subject_emotion?: string;
  predicted_ctr?: number;
  improvement_suggestions?: string[] | unknown;
}

async function urlToBase64(url: string): Promise<
  | { data: string; mediaType: "image/png" | "image/jpeg" | "image/webp" }
  | null
> {
  try {
    if (url.startsWith("data:image/")) {
      const match = url.match(/^data:(image\/[a-z]+);base64,(.+)$/i);
      if (!match) return null;
      const mediaType: "image/png" | "image/jpeg" | "image/webp" =
        match[1] === "image/jpeg"
          ? "image/jpeg"
          : match[1] === "image/webp"
            ? "image/webp"
            : "image/png";
      return { data: match[2], mediaType };
    }
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type") || "image/png";
    const mediaType: "image/png" | "image/jpeg" | "image/webp" = ct.includes(
      "jpeg",
    )
      ? "image/jpeg"
      : ct.includes("webp")
        ? "image/webp"
        : "image/png";
    return { data: buf.toString("base64"), mediaType };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ ok: false, error: "Profile not found" }, { status: 403 });
  }

  const limit = await checkLimit(ownerId, "tokens", 1);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: limit.reason || "Monthly token limit reached — upgrade to continue.",
        plan_tier: limit.plan_tier,
      },
      { status: 429 },
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "ANTHROPIC_API_KEY not configured" },
      { status: 503 },
    );
  }

  let body: AnalyzeInput;
  try {
    body = (await request.json()) as AnalyzeInput;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const imageUrl =
    typeof body.image_url === "string" ? body.image_url.trim() : "";
  if (!imageUrl) {
    return NextResponse.json(
      { ok: false, error: "image_url is required" },
      { status: 400 },
    );
  }

  // SSRF guard: reject loopback / private-IP / metadata-endpoint URLs.
  // data:image/… is fine (not a network fetch); https on public hosts only.
  const ssrfErr = checkFetchUrl(imageUrl);
  if (ssrfErr) {
    return NextResponse.json(
      { ok: false, error: `image_url rejected: ${ssrfErr}` },
      { status: 400 },
    );
  }

  const img = await urlToBase64(imageUrl);
  if (!img) {
    return NextResponse.json(
      { ok: false, error: "Could not fetch image_url" },
      { status: 502 },
    );
  }

  const systemPrompt =
    "You are a viral YouTube thumbnail analyst. Given a thumbnail image, produce a structured critique: " +
    "composition (how the subject fills the frame and guides the eye), dominant colors (3-5 hex codes), " +
    "whether there is text overlay and its position/legibility, the subject's primary emotion, a predicted " +
    "click-through-rate on a 0-100 scale based on how this would perform at 320x180 in a YouTube feed, " +
    "and 3-5 concrete improvement suggestions. Output JSON only — no markdown, no preamble.";

  let parsed: AnalysisPayload | null = null;
  let tokensUsed = 0;
  try {
    const resp = await anthropic.messages.create({
      model: MODEL_SONNET,
      max_tokens: 900,
      temperature: 0.2,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `Analyze this thumbnail. Output:\n` +
                `{\n  "composition": "...",\n  "dominant_colors": ["#ffffff", "#000000"],\n  "text_overlay": { "present": true, "position": "top-left|top-center|top-right|bottom-left|bottom-center|bottom-right|center", "legibility": "high|medium|low", "text": "..." },\n  "subject_emotion": "surprised|happy|angry|serious|mysterious|neutral|...",\n  "predicted_ctr": 78,\n  "improvement_suggestions": ["short bullet", "short bullet"]\n}`,
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: img.mediaType,
                data: img.data,
              },
            },
          ],
        },
      ],
    });
    tokensUsed =
      (resp.usage?.input_tokens || 0) + (resp.usage?.output_tokens || 0);
    parsed = safeJsonParse<AnalysisPayload>(getResponseText(resp));
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Claude vision call failed",
      },
      { status: 502 },
    );
  }

  if (!parsed) {
    return NextResponse.json(
      { ok: false, error: "Claude did not return parseable JSON" },
      { status: 502 },
    );
  }

  // Normalise — clamp predicted_ctr, cap arrays.
  const clamp = (n: unknown, lo: number, hi: number, fallback: number) =>
    typeof n === "number" && Number.isFinite(n)
      ? Math.max(lo, Math.min(hi, Math.round(n)))
      : fallback;
  const dominant = Array.isArray(parsed.dominant_colors)
    ? (parsed.dominant_colors as unknown[])
        .filter((x): x is string => typeof x === "string")
        .slice(0, 5)
    : [];
  const improvements = Array.isArray(parsed.improvement_suggestions)
    ? (parsed.improvement_suggestions as unknown[])
        .filter((x): x is string => typeof x === "string")
        .slice(0, 6)
    : [];
  const textOverlay =
    parsed.text_overlay && typeof parsed.text_overlay === "object"
      ? (parsed.text_overlay as Record<string, unknown>)
      : {};

  const result = {
    composition:
      typeof parsed.composition === "string"
        ? parsed.composition.slice(0, 400)
        : "",
    dominant_colors: dominant,
    text_overlay: {
      present:
        typeof textOverlay.present === "boolean" ? textOverlay.present : false,
      position:
        typeof textOverlay.position === "string" ? textOverlay.position : "",
      legibility:
        typeof textOverlay.legibility === "string"
          ? textOverlay.legibility
          : "",
      text: typeof textOverlay.text === "string" ? textOverlay.text.slice(0, 120) : "",
    },
    subject_emotion:
      typeof parsed.subject_emotion === "string"
        ? parsed.subject_emotion.slice(0, 60)
        : "",
    predicted_ctr: clamp(parsed.predicted_ctr, 0, 100, 50),
    improvement_suggestions: improvements,
  };

  void recordUsage(ownerId, "tokens", tokensUsed || 1800, {
    source: "thumbnail_analyze",
  });

  try {
    const service = createServiceClient();
    void service.from("trinity_log").insert({
      action_type: "thumbnail_analyze",
      description: `Analysed thumbnail — predicted CTR ${result.predicted_ctr}`,
      profile_id: user.id,
      status: "completed",
      result,
    });
  } catch {
    /* ignore */
  }

  return NextResponse.json({ ok: true, ...result });
}
