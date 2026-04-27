/**
 * RunPod Whisper Large-V3 client for the meeting notetaker.
 *
 * Uses the same serverless endpoint pattern as
 * `/api/ai/transcribe/route.ts` (the original Whisper consumer in this
 * repo). Lazy env-var read — module is safe to import at build time and
 * only fails when actually invoked. See CLAUDE.md "Module-level SDK init
 * is BANNED" rule.
 *
 * Tradeoff vs OpenAI Whisper:
 * - RunPod: self-hosted, no per-minute cost, runs Large-V3 (better accuracy
 *   on accents/jargon). Cold start ~10-15s. Caps file size at 250 MB.
 * - OpenAI: $0.006/min, faster cold start, smaller model. Good fallback.
 *
 * Default: try RunPod first (cheaper for agency call volume), fall back to
 * OpenAI when RunPod isn't configured.
 */
import { hasOpenAIKey, transcribeAudio as transcribeWithOpenAI } from "./whisper";
import type { WhisperTranscriptResult } from "./whisper";

export type { WhisperTranscriptResult } from "./whisper";

export function hasRunpodWhisper(): boolean {
  return Boolean(process.env.RUNPOD_WHISPER_URL && process.env.RUNPOD_API_KEY);
}

interface RunpodSegment {
  id?: number;
  start: number;
  end: number;
  text: string;
}

interface RunpodOutput {
  text?: string;
  transcription?: string;
  language?: string;
  duration?: number;
  segments?: RunpodSegment[];
}

interface RunpodResponse {
  status?: string;
  id?: string;
  output?: RunpodOutput;
}

const POLL_INTERVAL_MS = 2_000;
const POLL_MAX_TRIES = 150; // 150 * 2s = 5 min cap

/**
 * Transcribe audio (Blob/File/Buffer) via the RunPod serverless Whisper
 * Large-V3 worker. Falls back to OpenAI Whisper if RunPod isn't configured
 * but OpenAI is. Throws if neither is available.
 */
export async function transcribeAudio(
  file: File | Blob,
  opts?: { filename?: string; language?: string },
): Promise<WhisperTranscriptResult> {
  if (hasRunpodWhisper()) {
    return transcribeWithRunpod(file, opts);
  }
  if (hasOpenAIKey()) {
    return transcribeWithOpenAI(file, opts);
  }
  throw new Error(
    "No transcription provider configured. Set RUNPOD_WHISPER_URL + RUNPOD_API_KEY, or OPENAI_API_KEY.",
  );
}

async function transcribeWithRunpod(
  file: File | Blob,
  opts?: { filename?: string; language?: string },
): Promise<WhisperTranscriptResult> {
  const whisperUrl = process.env.RUNPOD_WHISPER_URL;
  const runpodKey = process.env.RUNPOD_API_KEY;
  if (!whisperUrl || !runpodKey) {
    throw new Error("RUNPOD_WHISPER_URL or RUNPOD_API_KEY not configured");
  }

  // Convert blob to base64 (RunPod accepts audio_base64).
  const buffer = Buffer.from(await file.arrayBuffer());
  const audioBase64 = buffer.toString("base64");

  const startRes = await fetch(`${whisperUrl}/runsync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${runpodKey}`,
    },
    body: JSON.stringify({
      input: {
        audio_base64: audioBase64,
        model: "large-v3",
        language: opts?.language || null,
        task: "transcribe",
        word_timestamps: false,
        return_timestamps: true,
      },
    }),
  });

  if (!startRes.ok) {
    const errText = await startRes.text().catch(() => "");
    throw new Error(`RunPod Whisper failed: ${startRes.status} ${errText.slice(0, 200)}`);
  }

  let job: RunpodResponse = await startRes.json();

  // Sync mode may complete immediately, or it may return a job id when the
  // worker is cold and hits the runsync timeout. Poll status if so.
  if (job.status !== "COMPLETED" && job.id) {
    job = await pollRunpodJob(whisperUrl, runpodKey, job.id);
  }

  if (job.status !== "COMPLETED" || !job.output) {
    throw new Error(`RunPod Whisper did not complete: status=${job.status}`);
  }

  return parseRunpodOutput(job.output);
}

async function pollRunpodJob(
  baseUrl: string,
  key: string,
  jobId: string,
): Promise<RunpodResponse> {
  for (let i = 0; i < POLL_MAX_TRIES; i++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    const statusRes = await fetch(`${baseUrl}/status/${jobId}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!statusRes.ok) continue;
    const data: RunpodResponse = await statusRes.json();
    if (data.status === "COMPLETED" || data.status === "FAILED") {
      return data;
    }
  }
  throw new Error("RunPod Whisper polling timed out after 5 min");
}

function parseRunpodOutput(output: RunpodOutput): WhisperTranscriptResult {
  const text = output.text || output.transcription || "";
  const rawSegments = Array.isArray(output.segments) ? output.segments : [];

  const segments = rawSegments.map((seg, idx) => ({
    id: seg.id ?? idx,
    start: seg.start,
    end: seg.end,
    text: seg.text.trim(),
    speaker: assignSpeakerForSegment(idx, rawSegments),
  }));

  return {
    text,
    language: output.language,
    duration_seconds: output.duration ? Math.round(output.duration) : undefined,
    segments,
  };
}

/**
 * Naive turn-taking heuristic, mirrors `whisper.ts`. Real diarization
 * (who said what) is deferred to v2 — see PR description.
 */
function assignSpeakerForSegment(
  idx: number,
  all: Array<{ start: number; end: number }>,
): string {
  if (idx <= 0 || all.length === 0) return "Speaker 1";
  let speakerIdx = 0;
  for (let i = 1; i <= idx; i++) {
    const gap = all[i].start - all[i - 1].end;
    if (gap > 1.2) speakerIdx = speakerIdx === 0 ? 1 : 0;
  }
  return `Speaker ${speakerIdx + 1}`;
}

/**
 * Cost estimate for tracking. RunPod Whisper Large-V3 on a 24 GB GPU
 * is ~$0.0004/sec billed. OpenAI Whisper is $0.006/min ($0.0001/sec).
 * Numbers are rough — used for displaying "cost so far" in the UI, not
 * for billing.
 */
export function estimateTranscriptionCost(
  durationSeconds: number,
  provider: "runpod" | "openai" | "unknown",
): number {
  if (provider === "runpod") return durationSeconds * 0.0004;
  if (provider === "openai") return (durationSeconds / 60) * 0.006;
  return 0;
}
