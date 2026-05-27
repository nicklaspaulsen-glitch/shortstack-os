/**
 * Local Whisper provider — runs the `whisper` CLI (openai-whisper pip package)
 * as a child process. Zero API cost, fully offline-capable.
 *
 * Useful for:
 *   - Hetzner VPS content engine (batch transcription with no API spend)
 *   - Local development (free, no network dependency)
 *   - Fallback when RunPod endpoints are cold and OpenAI API is down
 *
 * Requires:
 *   - `pip install openai-whisper` (or `pipx install openai-whisper`)
 *   - `WHISPER_ENABLED=true` env var
 *   - `whisper` CLI on PATH
 *
 * Model selection via `WHISPER_MODEL` env var. Defaults to `base`.
 * Options: tiny, base, small, medium, large, large-v2, large-v3.
 * Larger models need more VRAM/RAM and take longer but produce better output.
 *
 * No diarization — stock Whisper doesn't do speaker separation. The router
 * skips this provider when `diarize: true` is requested.
 */

import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, parse as parsePath } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import {
  TranscriptionProviderError,
  type TranscribeOptions,
  type TranscribeResult,
  type TranscribeSegment,
  type TranscriptionProviderImpl,
} from "./provider";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_MODELS = new Set([
  "tiny",
  "tiny.en",
  "base",
  "base.en",
  "small",
  "small.en",
  "medium",
  "medium.en",
  "large",
  "large-v2",
  "large-v3",
]);

/** Kill the whisper process after 5 minutes. */
const PROCESS_TIMEOUT_MS = 300_000;

/** Max audio download size: 500 MB. Prevents OOM on rogue URLs. */
const MAX_DOWNLOAD_BYTES = 500 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Whisper JSON output shape
// ---------------------------------------------------------------------------

interface WhisperJsonSegment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
}

interface WhisperJsonOutput {
  text: string;
  segments: WhisperJsonSegment[];
  language: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getWhisperModel(): string {
  const model = process.env.WHISPER_MODEL?.trim() || "base";
  if (!VALID_MODELS.has(model)) {
    console.warn(
      `[transcription/local-whisper] WHISPER_MODEL="${model}" is not recognised; falling back to "base"`,
    );
    return "base";
  }
  return model;
}

/**
 * Check whether the `whisper` CLI is on PATH. Uses `where` on Windows,
 * `which` everywhere else. Synchronous would block the event loop for too
 * long on cold PATH lookups, so we use the async execFile variant.
 */
function whisperCliExists(): Promise<boolean> {
  const cmd = process.platform === "win32" ? "where" : "which";
  return new Promise((resolve) => {
    execFile(cmd, ["whisper"], { timeout: 5_000 }, (err) => {
      resolve(!err);
    });
  });
}

/**
 * Download audio from a URL to a local temp file. Returns the file path.
 * Creates a unique temp directory per invocation so concurrent calls never
 * collide.
 */
async function downloadAudio(audioUrl: string): Promise<{ filePath: string; tempDir: string }> {
  const tempDir = join(tmpdir(), `whisper-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  await mkdir(tempDir, { recursive: true });

  // Derive a filename from the URL, stripping query params.
  const urlPath = new URL(audioUrl).pathname;
  const baseName = parsePath(urlPath).base || "audio.webm";
  const filePath = join(tempDir, baseName);

  let response: Response;
  try {
    response = await fetch(audioUrl, { signal: AbortSignal.timeout(60_000) });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "audio download fetch error";
    throw new TranscriptionProviderError("local_whisper", `audio_download_failed: ${reason}`);
  }

  if (!response.ok) {
    throw new TranscriptionProviderError(
      "local_whisper",
      `audio_download_http_${response.status}`,
    );
  }

  if (!response.body) {
    throw new TranscriptionProviderError("local_whisper", "audio_download_empty_body");
  }

  // Guard against absurdly large files.
  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_DOWNLOAD_BYTES) {
    throw new TranscriptionProviderError(
      "local_whisper",
      `audio_too_large: ${contentLength} bytes exceeds ${MAX_DOWNLOAD_BYTES} limit`,
    );
  }

  const writeStream = createWriteStream(filePath);
  // Node's Readable.fromWeb typings are stricter than the web ReadableStream
  // generic — cast through unknown to bridge the ArrayBufferLike variance.
  const nodeStream = Readable.fromWeb(
    response.body as unknown as Parameters<typeof Readable.fromWeb>[0],
  );

  let bytesWritten = 0;
  nodeStream.on("data", (chunk: Buffer) => {
    bytesWritten += chunk.length;
    if (bytesWritten > MAX_DOWNLOAD_BYTES) {
      nodeStream.destroy(new Error("audio_too_large"));
    }
  });

  try {
    await pipeline(nodeStream, writeStream);
  } catch (err) {
    // Clean up partial file on failure.
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    const reason = err instanceof Error ? err.message : "stream_error";
    throw new TranscriptionProviderError("local_whisper", `audio_download_failed: ${reason}`);
  }

  return { filePath, tempDir };
}

/**
 * Run the whisper CLI and return the parsed JSON output.
 */
function runWhisperCli(
  audioFilePath: string,
  outputDir: string,
  language: string | undefined,
): Promise<WhisperJsonOutput> {
  const model = getWhisperModel();

  const args = [
    audioFilePath,
    "--model", model,
    "--output_format", "json",
    "--output_dir", outputDir,
  ];

  if (language) {
    args.push("--language", language);
  }

  return new Promise((resolve, reject) => {
    const child = execFile(
      "whisper",
      args,
      {
        timeout: PROCESS_TIMEOUT_MS,
        maxBuffer: 10 * 1024 * 1024, // 10 MB stdout/stderr buffer
      },
      async (err, _stdout, stderr) => {
        if (err) {
          const isTimeout = "killed" in err && err.killed;
          const reason = isTimeout
            ? `process_timeout_${PROCESS_TIMEOUT_MS}ms`
            : `cli_error: ${(err.message || "").slice(0, 200)}`;

          if (stderr) {
            console.warn(
              `[transcription/local-whisper] stderr: ${stderr.slice(0, 500)}`,
            );
          }

          reject(
            new TranscriptionProviderError("local_whisper", reason, !isTimeout),
          );
          return;
        }

        // Whisper writes <basename_without_ext>.json in the output dir.
        const audioBaseName = parsePath(audioFilePath).name;
        const jsonPath = join(outputDir, `${audioBaseName}.json`);

        try {
          const raw = await readFile(jsonPath, "utf-8");
          const parsed: unknown = JSON.parse(raw);

          if (
            typeof parsed !== "object" ||
            parsed === null ||
            !("text" in parsed) ||
            !("segments" in parsed)
          ) {
            reject(
              new TranscriptionProviderError(
                "local_whisper",
                "malformed_json_output: missing text or segments",
              ),
            );
            return;
          }

          resolve(parsed as WhisperJsonOutput);
        } catch (readErr) {
          const reason =
            readErr instanceof Error ? readErr.message : "json_read_error";
          reject(
            new TranscriptionProviderError(
              "local_whisper",
              `output_parse_failed: ${reason}`,
            ),
          );
        }
      },
    );

    // Safety net: if the child process somehow outlives the timeout
    // (e.g. timeout option doesn't fire on all platforms), force kill.
    const killTimer = setTimeout(() => {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }, PROCESS_TIMEOUT_MS + 5_000);

    child.on("exit", () => {
      clearTimeout(killTimer);
    });
  });
}

/**
 * Convert Whisper's `avg_logprob` (negative, closer to 0 = more confident)
 * into a 0..1 confidence score. Same heuristic as the OpenAI and RunPod
 * providers for consistency across the pipeline.
 */
function normaliseConfidence(avgLogprob: number): number | undefined {
  if (!Number.isFinite(avgLogprob)) return undefined;
  const normalised = Math.max(0, Math.min(1, 1 + avgLogprob / 1.5));
  return Math.round(normalised * 1000) / 1000;
}

/**
 * Map Whisper JSON segments to the shared TranscribeSegment shape.
 */
function mapSegments(segments: WhisperJsonSegment[]): TranscribeSegment[] {
  return segments.map((seg) => ({
    start: seg.start,
    end: seg.end,
    text: (seg.text || "").trim(),
    confidence: normaliseConfidence(seg.avg_logprob),
  }));
}

/**
 * Derive audio duration from segments. Whisper doesn't include a top-level
 * duration field in its JSON output, so we take the `end` of the last segment.
 */
function deriveDuration(segments: WhisperJsonSegment[]): number {
  if (segments.length === 0) return 0;
  const last = segments[segments.length - 1];
  return Math.round(last.end);
}

// ---------------------------------------------------------------------------
// Provider export
// ---------------------------------------------------------------------------

/**
 * Cached availability result. Re-checked at most once per 30 seconds to avoid
 * hammering `which`/`where` on every router call.
 */
let availabilityCache: { value: boolean; checkedAt: number } | null = null;
const AVAILABILITY_TTL_MS = 30_000;

export const localWhisperProvider: TranscriptionProviderImpl = {
  name: "local_whisper",
  supportsDiarization: false,

  available(): boolean {
    // Fast gate: env var must be explicitly set.
    if (process.env.WHISPER_ENABLED !== "true") return false;

    // CLI check is async, but `available()` is sync per the interface.
    // We use a cached result from the last async probe. On first call
    // before the cache is populated, we optimistically return true and
    // let `transcribe()` fail gracefully if the CLI is actually missing.
    if (
      availabilityCache &&
      Date.now() - availabilityCache.checkedAt < AVAILABILITY_TTL_MS
    ) {
      return availabilityCache.value;
    }

    // Fire-and-forget async check to populate cache for next call.
    whisperCliExists().then((exists) => {
      availabilityCache = { value: exists, checkedAt: Date.now() };
      if (!exists) {
        console.warn(
          "[transcription/local-whisper] WHISPER_ENABLED=true but `whisper` CLI not found on PATH",
        );
      }
    });

    // Return cached value if we have one, otherwise optimistic true.
    return availabilityCache?.value ?? true;
  },

  async transcribe(opts: TranscribeOptions): Promise<TranscribeResult> {
    // Hard gate: verify the CLI exists before doing expensive work.
    const cliExists = await whisperCliExists();
    if (!cliExists) {
      availabilityCache = { value: false, checkedAt: Date.now() };
      throw new TranscriptionProviderError(
        "local_whisper",
        "whisper CLI not found on PATH — install with `pip install openai-whisper`",
        false,
      );
    }

    let tempDir: string | null = null;

    try {
      // 1. Download audio to temp file.
      const downloaded = await downloadAudio(opts.audioUrl);
      tempDir = downloaded.tempDir;

      // 2. Run whisper CLI.
      const whisperOutput = await runWhisperCli(
        downloaded.filePath,
        downloaded.tempDir,
        opts.language,
      );

      // 3. Map to standard result shape.
      const segments = mapSegments(whisperOutput.segments);
      const duration = deriveDuration(whisperOutput.segments);

      return {
        text: whisperOutput.text.trim(),
        segments,
        language: whisperOutput.language || opts.language || "en",
        duration_seconds: duration,
        provider: "local_whisper",
        cost_usd: 0,
        job_id: null,
      };
    } finally {
      // 4. Clean up temp files regardless of success or failure.
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  },
};
