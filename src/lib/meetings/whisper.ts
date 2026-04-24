/**
 * OpenAI Whisper client helper.
 *
 * We lazily construct the OpenAI client so the module can be imported from
 * build-time tooling without forcing a key check. Callers must check for
 * missing key first and return 501 to the client (see /api/meetings/[id]/transcribe).
 */
import OpenAI from "openai";

export interface WhisperVerboseSegment {
  id?: number;
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export interface WhisperTranscriptResult {
  text: string;
  language?: string;
  duration_seconds?: number;
  segments: WhisperVerboseSegment[];
}

export function hasOpenAIKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/**
 * Transcribe an audio file (Blob/File/Buffer) using Whisper's verbose_json
 * response format so we get per-segment timestamps. Speaker labels are not
 * supplied by Whisper itself — we assign rotating 'Speaker 1' / 'Speaker 2'
 * only when we detect large silence gaps, otherwise all segments share
 * 'Speaker 1'. Good enough for v1; diarization can be swapped in later.
 */
export async function transcribeAudio(
  file: File | Blob,
  opts?: { filename?: string; language?: string },
): Promise<WhisperTranscriptResult> {
  if (!hasOpenAIKey()) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // OpenAI's SDK expects a `File`. If we were given a Blob, wrap it.
  const toUpload: File =
    file instanceof File
      ? file
      : new File([file], opts?.filename || "audio.webm", { type: (file as Blob).type || "audio/webm" });

  const response = await client.audio.transcriptions.create({
    file: toUpload,
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
    language: opts?.language,
  });

  // The OpenAI SDK returns a typed response; at runtime we get the verbose
  // JSON payload. Type-assert the pieces we need.
  const raw = response as unknown as {
    text: string;
    language?: string;
    duration?: number;
    segments?: Array<{ id?: number; start: number; end: number; text: string }>;
  };

  const segments = (raw.segments || []).map((seg) => ({
    id: seg.id,
    start: seg.start,
    end: seg.end,
    text: seg.text.trim(),
    speaker: assignSpeakerForSegment(seg, raw.segments || []),
  }));

  return {
    text: raw.text,
    language: raw.language,
    duration_seconds: raw.duration ? Math.round(raw.duration) : undefined,
    segments,
  };
}

/**
 * Naive speaker-turn heuristic: if the gap between the previous segment's end
 * and this one's start is > 1.2s, assume a new speaker. Alternates between
 * Speaker 1 and Speaker 2. Real diarization belongs in a separate service.
 */
function assignSpeakerForSegment(
  seg: { start: number; end: number },
  all: Array<{ start: number; end: number }>,
): string {
  const idx = all.findIndex((s) => s.start === seg.start && s.end === seg.end);
  if (idx <= 0) return "Speaker 1";
  let speakerIdx = 0;
  for (let i = 1; i <= idx; i++) {
    const gap = all[i].start - all[i - 1].end;
    if (gap > 1.2) speakerIdx = speakerIdx === 0 ? 1 : 0;
  }
  return `Speaker ${speakerIdx + 1}`;
}
