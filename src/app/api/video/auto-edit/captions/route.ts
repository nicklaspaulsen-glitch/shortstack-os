import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { checkLimit, recordUsage } from "@/lib/usage-limits";

/**
 * POST /api/video/auto-edit/captions
 *
 * Transcribe a video via the existing Runpod Whisper endpoint, then format
 * the resulting word-level timings into caption tokens according to a style:
 *
 *   - "hormozi-bounce"     → 1-2 word chunks (punchy, hype)
 *   - "mrbeast-pop"        → 2-3 word chunks, high-energy, uppercase hint
 *   - "clean-sans"         → line-break at sentences
 *   - "kinetic-colour"     → 2 words per chunk, attention_words flagged
 *   - "subtle-lower-third" → full sentences (for interview / tutorial)
 *   - "vlog-handwritten"   → loose 3-4 word chunks
 *
 * Token cost: 1 token (Whisper transcription is counted against the tokens
 * bucket for billing simplicity — it's cheap-ish in aggregate).
 *
 * Returns timed caption tokens compatible with our renderer:
 *   { captions: Array<{ start, end, text, style_id, attention?: boolean }> }
 */

export const maxDuration = 120;

type CaptionStyleId =
  | "hormozi-bounce"
  | "mrbeast-pop"
  | "clean-sans"
  | "kinetic-colour"
  | "subtle-lower-third"
  | "vlog-handwritten";

const VALID_STYLES: readonly CaptionStyleId[] = [
  "hormozi-bounce",
  "mrbeast-pop",
  "clean-sans",
  "kinetic-colour",
  "subtle-lower-third",
  "vlog-handwritten",
];

interface CaptionsInput {
  video_url?: string;
  style_id?: string;
  client_id?: string;
  language?: string;
}

interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

interface WhisperSegment {
  start?: number;
  end?: number;
  text?: string;
  words?: WordTimestamp[];
}

interface WhisperOutput {
  text?: string;
  transcription?: string;
  segments?: WhisperSegment[];
  language?: string;
  duration?: number;
  words?: WordTimestamp[]; // some runpod templates return a flat list
}

interface CaptionToken {
  start: number;
  end: number;
  text: string;
  style_id: CaptionStyleId;
  attention?: boolean;
}

function coerceStyle(raw: string | undefined): CaptionStyleId {
  if (!raw) return "clean-sans";
  const v = raw.trim().toLowerCase();
  const hit = VALID_STYLES.find((s) => s === v);
  return hit || "clean-sans";
}

function isStopWord(w: string): boolean {
  const stop = new Set([
    "the", "and", "of", "a", "to", "in", "on", "for", "it", "is",
    "i", "you", "he", "she", "they", "we", "my", "your", "our", "an",
    "at", "or", "as", "but", "if", "by", "with", "be", "are", "was",
  ]);
  return stop.has(w.toLowerCase().replace(/[^a-z']/gi, ""));
}

function extractWords(output: WhisperOutput): WordTimestamp[] {
  if (Array.isArray(output.words) && output.words.length > 0) return output.words;
  const out: WordTimestamp[] = [];
  for (const seg of output.segments || []) {
    if (Array.isArray(seg.words)) {
      for (const w of seg.words) {
        if (typeof w.word === "string" && typeof w.start === "number" && typeof w.end === "number") {
          out.push({ word: w.word.trim(), start: w.start, end: w.end });
        }
      }
    } else if (typeof seg.text === "string" && typeof seg.start === "number" && typeof seg.end === "number") {
      // Fall back to segment-level timing — split text evenly across words.
      const words = seg.text.trim().split(/\s+/).filter(Boolean);
      if (words.length === 0) continue;
      const step = (seg.end - seg.start) / words.length;
      for (let i = 0; i < words.length; i++) {
        out.push({
          word: words[i],
          start: seg.start + i * step,
          end: seg.start + (i + 1) * step,
        });
      }
    }
  }
  return out;
}

function chunkWords(
  words: WordTimestamp[],
  perChunk: number,
): Array<{ start: number; end: number; text: string }> {
  if (words.length === 0) return [];
  const out: Array<{ start: number; end: number; text: string }> = [];
  for (let i = 0; i < words.length; i += perChunk) {
    const group = words.slice(i, i + perChunk);
    out.push({
      start: group[0].start,
      end: group[group.length - 1].end,
      text: group.map((g) => g.word).join(" ").trim(),
    });
  }
  return out;
}

function chunkBySentences(words: WordTimestamp[]): Array<{ start: number; end: number; text: string }> {
  if (words.length === 0) return [];
  const out: Array<{ start: number; end: number; text: string }> = [];
  let buf: WordTimestamp[] = [];
  const flush = () => {
    if (buf.length === 0) return;
    out.push({
      start: buf[0].start,
      end: buf[buf.length - 1].end,
      text: buf.map((b) => b.word).join(" ").trim(),
    });
    buf = [];
  };
  for (const w of words) {
    buf.push(w);
    if (/[.!?]$/.test(w.word)) flush();
  }
  flush();
  return out;
}

function buildCaptions(words: WordTimestamp[], style: CaptionStyleId): CaptionToken[] {
  let chunks: Array<{ start: number; end: number; text: string }> = [];
  const markAttention = style === "kinetic-colour" || style === "mrbeast-pop";

  switch (style) {
    case "hormozi-bounce":
      chunks = chunkWords(words, 2);
      break;
    case "mrbeast-pop":
      chunks = chunkWords(words, 3);
      break;
    case "clean-sans":
    case "subtle-lower-third":
      chunks = chunkBySentences(words);
      if (chunks.length === 0) chunks = chunkWords(words, 6);
      break;
    case "kinetic-colour":
      chunks = chunkWords(words, 2);
      break;
    case "vlog-handwritten":
      chunks = chunkWords(words, 4);
      break;
  }

  return chunks.map((c) => {
    const token: CaptionToken = {
      start: Math.round(c.start * 100) / 100,
      end: Math.round(c.end * 100) / 100,
      text: c.text,
      style_id: style,
    };
    if (markAttention) {
      // First non-stopword in the chunk becomes the "attention" word.
      const w = c.text.split(/\s+/).find((x) => !isStopWord(x));
      if (w) token.attention = true;
    }
    if (style === "mrbeast-pop") {
      token.text = token.text.toUpperCase();
    }
    return token;
  });
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
        current: limit.current,
        limit: limit.limit,
      },
      { status: 429 },
    );
  }

  let body: CaptionsInput;
  try {
    body = (await request.json()) as CaptionsInput;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const videoUrl = typeof body.video_url === "string" ? body.video_url.trim() : "";
  if (!videoUrl) {
    return NextResponse.json(
      { ok: false, error: "video_url is required" },
      { status: 400 },
    );
  }
  const styleId = coerceStyle(typeof body.style_id === "string" ? body.style_id : undefined);
  const language =
    typeof body.language === "string" && body.language.trim()
      ? body.language.trim()
      : "auto";

  const whisperUrl = process.env.RUNPOD_WHISPER_URL;
  const runpodKey = process.env.RUNPOD_API_KEY;
  if (!whisperUrl || !runpodKey) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Whisper is not configured (set RUNPOD_WHISPER_URL + RUNPOD_API_KEY). Use /api/ai-studio/transcribe for OpenAI fallback.",
      },
      { status: 501 },
    );
  }

  try {
    const res = await fetch(`${whisperUrl}/runsync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${runpodKey}`,
      },
      body: JSON.stringify({
        input: {
          audio_url: videoUrl,
          model: "large-v3",
          language: language === "auto" ? null : language,
          task: "transcribe",
          word_timestamps: true,
          return_timestamps: true,
        },
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return NextResponse.json(
        { ok: false, error: `Runpod Whisper returned ${res.status}`, detail: detail.slice(0, 400) },
        { status: 502 },
      );
    }

    const job = (await res.json()) as { status?: string; output?: WhisperOutput; id?: string };
    if (job.status !== "COMPLETED" || !job.output) {
      // Whisper queued or failed — return the job id so the caller can poll.
      return NextResponse.json({
        ok: false,
        error: "Whisper job did not complete synchronously — poll via /api/ai-studio/transcribe",
        job_id: job.id || null,
        status: job.status || "UNKNOWN",
      }, { status: 202 });
    }

    const words = extractWords(job.output);
    if (words.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Transcript had no word-level timings — enable word_timestamps in Whisper." },
        { status: 502 },
      );
    }

    const captions = buildCaptions(words, styleId);

    // Light-touch usage record — Whisper is priced differently than Claude
    // but we expose it via the tokens bucket for consistency.
    void recordUsage(ownerId, "tokens", 500, {
      source: "auto_edit_captions",
      style_id: styleId,
      caption_count: captions.length,
    });

    const serviceSupabase = createServiceClient();
    void serviceSupabase.from("trinity_log").insert({
      action_type: "ai_auto_edit_captions",
      description: `Generated ${captions.length} captions (${styleId})`,
      profile_id: user.id,
      status: "completed",
      result: {
        style_id: styleId,
        caption_count: captions.length,
        duration: job.output.duration || null,
      },
    });

    return NextResponse.json({
      ok: true,
      style_id: styleId,
      captions,
      total: captions.length,
      language: job.output.language || language,
      duration_sec: job.output.duration || (words[words.length - 1]?.end ?? 0),
    });
  } catch (err) {
    console.error("[video/auto-edit/captions] error", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
