import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { anthropic, MODEL_HAIKU } from "@/lib/ai/claude-helpers";

// POST /api/video/best-frame
// Accepts a set of video frames (base64 data URLs) extracted client-side,
// sends them to Claude Vision for quality scoring, and returns the index of
// the best frame along with a brief reason.
//
// Body: { frames: string[], prompt: string }
//   frames  — array of data URLs (JPEG/PNG), max 8 frames
//   prompt  — the original video generation prompt (used as quality context)
//
// Response: { best_index: number, reason: string, best_frame: string }

const MAX_FRAMES = 8;

export async function POST(req: NextRequest) {
  // Auth gate
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { frames?: unknown; prompt?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { frames, prompt } = body;

  if (!Array.isArray(frames) || frames.length === 0) {
    return NextResponse.json({ error: "frames must be a non-empty array" }, { status: 400 });
  }

  // Clamp to max and validate each entry is a string data URL
  const clamped = (frames as unknown[]).slice(0, MAX_FRAMES);
  const validFrames: string[] = [];
  for (const f of clamped) {
    if (typeof f !== "string" || !f.startsWith("data:image/")) {
      return NextResponse.json({ error: "Each frame must be a data:image/ URL" }, { status: 400 });
    }
    validFrames.push(f);
  }

  const safePrompt = typeof prompt === "string" ? prompt.slice(0, 300) : "video scene";

  // Build the Claude Vision message content.
  // Each frame becomes an image content block, labelled so Claude can
  // reference it by number in its response.
  type ImageBlock = {
    type: "image";
    source: {
      type: "base64";
      media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
      data: string;
    };
  };
  type TextBlock = { type: "text"; text: string };
  type ContentBlock = ImageBlock | TextBlock;

  const contentBlocks: ContentBlock[] = [];

  for (let i = 0; i < validFrames.length; i++) {
    const dataUrl = validFrames[i];
    const [header, base64Data] = dataUrl.split(",");
    const mediaTypeMatch = header.match(/data:([^;]+);/);
    const rawMedia = mediaTypeMatch?.[1] ?? "image/jpeg";
    const mediaType = (
      ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(rawMedia)
        ? rawMedia
        : "image/jpeg"
    ) as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

    contentBlocks.push({ type: "text", text: `Frame ${i + 1}:` });
    contentBlocks.push({
      type: "image",
      source: { type: "base64", media_type: mediaType, data: base64Data },
    });
  }

  contentBlocks.push({
    type: "text",
    text: [
      `The video was generated from this prompt: "${safePrompt}"`,
      "",
      `You are shown ${validFrames.length} frames extracted at equal intervals from the video.`,
      "Pick the single best frame to use as a thumbnail.",
      "",
      "Criteria (in order of importance):",
      "1. Sharpness and clarity — no motion blur, no artifact smearing",
      "2. Compositional strength — subject centred, balanced foreground/background",
      "3. Lighting quality — well-lit subject, no overexposure or crush",
      "4. Visual interest — captures the essence of the prompt",
      "",
      'Respond with ONLY valid JSON: {"best_index": <0-based integer>, "reason": "<one sentence, max 120 chars>"}',
      "No markdown, no extra text.",
    ].join("\n"),
  });

  let bestIndex = 0;
  let reason = "First frame selected";

  try {
    const response = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 120,
      temperature: 0,
      system:
        "You are a professional video editor selecting the best thumbnail frame. Be decisive. Output only the JSON object specified.",
      messages: [{ role: "user", content: contentBlocks }],
    });

    const rawText = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    // Strip potential markdown fences
    const cleaned = rawText.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned) as { best_index?: unknown; reason?: unknown };

    if (
      typeof parsed.best_index === "number" &&
      parsed.best_index >= 0 &&
      parsed.best_index < validFrames.length
    ) {
      bestIndex = parsed.best_index;
    }
    if (typeof parsed.reason === "string" && parsed.reason.length > 0) {
      reason = parsed.reason.slice(0, 120);
    }
  } catch (err) {
    console.error("[video/best-frame] Claude error:", err);
    // Fall back to first frame — don't expose errors to the client
  }

  return NextResponse.json({
    best_index: bestIndex,
    reason,
    // Return the winning frame so the client can use it without re-encoding
    best_frame: validFrames[bestIndex],
  });
}
