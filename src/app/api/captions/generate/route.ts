import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";

/**
 * POST /api/captions/generate
 *
 * Runs Runpod Whisper against a video URL, returns word-level kinetic-caption
 * data, and stores the track in the `video_captions` table scoped to caller.
 *
 * Request:
 *   {
 *     video_url: string,
 *     style?: "kinetic" | "classic" | "highlight",
 *     language?: string,
 *     video_project_id?: string,
 *     client_id?: string
 *   }
 *
 * Response (success):
 *   {
 *     ok: true,
 *     caption_id: string,
 *     words: [{ text, start_ms, end_ms, emphasis?: boolean }],
 *     style: "kinetic" | "classic" | "highlight",
 *     duration_ms: number,
 *     language: string
 *   }
 *
 * Response (failure):
 *   { ok: false, error: string }
 */

type CaptionStyle = "kinetic" | "classic" | "highlight";

interface CaptionWord {
  text: string;
  start_ms: number;
  end_ms: number;
  emphasis?: boolean;
}

interface WhisperWord {
  word?: string;
  text?: string;
  start?: number; // seconds
  end?: number; // seconds
  probability?: number;
}

interface WhisperSegment {
  start?: number;
  end?: number;
  text?: string;
  words?: WhisperWord[];
}

interface WhisperResponse {
  text?: string;
  language?: string;
  segments?: WhisperSegment[];
  words?: WhisperWord[];
  duration?: number;
  output?: WhisperResponse; // runpod often nests under output
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "of",
  "a",
  "to",
  "in",
  "is",
  "it",
  "for",
  "on",
  "with",
  "that",
  "this",
  "an",
  "as",
  "at",
  "by",
  "be",
  "or",
  "are",
  "was",
  "from",
  "you",
  "i",
  "we",
  "they",
  "he",
  "she",
]);

function normalizeStyle(raw: unknown): CaptionStyle {
  if (raw === "classic" || raw === "highlight") return raw;
  return "kinetic";
}

function pickEmphasis(words: CaptionWord[], style: CaptionStyle): CaptionWord[] {
  if (style === "classic") {
    return words.map((w) => ({ ...w, emphasis: false }));
  }
  // For kinetic: every non-stop-word OR longer-than-4-chars word is emphasized.
  // For highlight: emphasize only the single longest/most impactful word per short window (~1s).
  if (style === "kinetic") {
    return words.map((w) => {
      const clean = w.text.toLowerCase().replace(/[^a-z0-9]/g, "");
      const emph = clean.length > 3 && !STOP_WORDS.has(clean);
      return { ...w, emphasis: emph };
    });
  }
  // highlight: one emphasis per ~1000ms window
  const out: CaptionWord[] = [];
  let windowStart = 0;
  let bestIdx = -1;
  let bestScore = -1;
  const flush = () => {
    if (bestIdx >= 0) {
      out[bestIdx] = { ...out[bestIdx], emphasis: true };
    }
    bestIdx = -1;
    bestScore = -1;
  };
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    out.push({ ...w, emphasis: false });
    if (w.start_ms - windowStart > 1000) {
      flush();
      windowStart = w.start_ms;
    }
    const clean = w.text.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (STOP_WORDS.has(clean)) continue;
    const score = clean.length;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  flush();
  return out;
}

function extractWhisperWords(raw: WhisperResponse): {
  words: CaptionWord[];
  language: string;
  durationMs: number;
} {
  // Support the common "wrapped under .output" RunPod response
  const data = raw.output || raw;
  const flatWords: CaptionWord[] = [];
  if (Array.isArray(data.words)) {
    for (const w of data.words) {
      const text = (w.word || w.text || "").trim();
      if (!text) continue;
      flatWords.push({
        text,
        start_ms: Math.round((w.start || 0) * 1000),
        end_ms: Math.round((w.end || 0) * 1000),
      });
    }
  }
  if (!flatWords.length && Array.isArray(data.segments)) {
    for (const seg of data.segments) {
      if (Array.isArray(seg.words)) {
        for (const w of seg.words) {
          const text = (w.word || w.text || "").trim();
          if (!text) continue;
          flatWords.push({
            text,
            start_ms: Math.round((w.start || 0) * 1000),
            end_ms: Math.round((w.end || 0) * 1000),
          });
        }
      } else if (seg.text) {
        // Fallback: split segment text into fake word timings
        const segStart = seg.start || 0;
        const segEnd = seg.end || segStart + 1;
        const tokens = seg.text.trim().split(/\s+/);
        const per = (segEnd - segStart) / Math.max(1, tokens.length);
        tokens.forEach((tok, idx) => {
          flatWords.push({
            text: tok,
            start_ms: Math.round((segStart + idx * per) * 1000),
            end_ms: Math.round((segStart + (idx + 1) * per) * 1000),
          });
        });
      }
    }
  }
  const language = typeof data.language === "string" && data.language ? data.language : "en";
  const durationMs = Math.round(
    (data.duration || flatWords[flatWords.length - 1]?.end_ms / 1000 || 0) * 1000
  );
  return { words: flatWords, language, durationMs };
}

async function callWhisper(videoUrl: string, language?: string): Promise<WhisperResponse | null> {
  const base = process.env.RUNPOD_WHISPER_URL;
  const key = process.env.RUNPOD_API_KEY;
  if (!base || !key) return null;

  // RunPod serverless endpoint. Standard shape: POST /runsync { input: {...} }
  const endpoint = base.endsWith("/runsync") ? base : `${base.replace(/\/+$/, "")}/runsync`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      input: {
        audio: videoUrl,
        audio_url: videoUrl, // some whisper templates use different keys
        url: videoUrl,
        word_timestamps: true,
        word_level_timestamps: true,
        language: language || "en",
        model: "large-v3",
      },
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Whisper HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }
  return (await res.json()) as WhisperResponse;
}

export async function POST(request: NextRequest) {
  const authSupabase = createServerSupabase();
  const {
    data: { user },
  } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await authSupabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", user.id)
    .single();
  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  let body: {
    video_url?: unknown;
    style?: unknown;
    language?: unknown;
    video_project_id?: unknown;
    client_id?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const videoUrl = typeof body.video_url === "string" ? body.video_url.trim() : "";
  if (!videoUrl) {
    return NextResponse.json({ ok: false, error: "video_url required" }, { status: 400 });
  }
  const style = normalizeStyle(body.style);
  const language =
    typeof body.language === "string" && body.language.length <= 8
      ? body.language.toLowerCase()
      : "en";
  const videoProjectId =
    typeof body.video_project_id === "string" ? body.video_project_id : null;
  const clientId = typeof body.client_id === "string" ? body.client_id : null;

  if (!process.env.RUNPOD_WHISPER_URL || !process.env.RUNPOD_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "Whisper not configured (missing RUNPOD_WHISPER_URL or RUNPOD_API_KEY)" },
      { status: 500 }
    );
  }

  try {
    const raw = await callWhisper(videoUrl, language);
    if (!raw) {
      return NextResponse.json(
        { ok: false, error: "Whisper returned no response" },
        { status: 502 }
      );
    }

    const { words: flatWords, language: detectedLang, durationMs } = extractWhisperWords(raw);
    if (!flatWords.length) {
      return NextResponse.json(
        { ok: false, error: "No words extracted from Whisper output" },
        { status: 502 }
      );
    }

    const words = pickEmphasis(flatWords, style);
    const finalLang = detectedLang || language;

    // Store in video_captions (scoped to caller). Uses service client for
    // consistent inserts regardless of RLS cookies.
    const serviceSupabase = createServiceClient();
    const { data: insertRow, error: insertErr } = await serviceSupabase
      .from("video_captions")
      .insert({
        profile_id: user.id,
        client_id: clientId,
        video_project_id: videoProjectId,
        video_url: videoUrl,
        words,
        style,
        language: finalLang,
        duration_ms: durationMs,
      })
      .select("id")
      .single();

    if (insertErr || !insertRow) {
      console.error("[captions/generate] insert error", insertErr);
      return NextResponse.json(
        { ok: false, error: `Failed to store captions: ${insertErr?.message || "unknown"}` },
        { status: 500 }
      );
    }

    void serviceSupabase.from("trinity_log").insert({
      action_type: "ai_video_captions_whisper",
      description: `Generated ${words.length} kinetic caption words (${style})`,
      profile_id: user.id,
      client_id: clientId,
      status: "completed",
      result: {
        caption_id: insertRow.id,
        word_count: words.length,
        duration_ms: durationMs,
        style,
        language: finalLang,
      },
    });

    return NextResponse.json({
      ok: true,
      caption_id: insertRow.id,
      words,
      style,
      duration_ms: durationMs,
      language: finalLang,
    });
  } catch (err) {
    console.error("[captions/generate] error", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
