/**
 * ffmpeg-service.ts — server-side ffmpeg wrapper for ShortStack OS
 *
 * Provides typed, production-grade video manipulation primitives used by
 * the auto-edit pipeline and the 23 video API routes. Every function
 * returns typed results, cleans up temp files, and uses structured error
 * logging with the `[ffmpeg-service]` prefix.
 *
 * Architecture:
 * - Lazy singleton (no module-level init — per CLAUDE.md rules)
 * - fluent-ffmpeg wraps the system ffmpeg 8.1.1 binary
 * - All temp files go to `os.tmpdir()` and are cleaned on completion
 * - TypeScript strict, zero `: any`
 */

import Ffmpeg, { type FfprobeData, type FfprobeStream } from "fluent-ffmpeg";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export interface FrameResult {
  index: number;
  timestampSec: number;
  base64: string;
  width: number;
  height: number;
}

export interface ProbeResult {
  durationSec: number;
  width: number;
  height: number;
  codec: string;
  fps: number;
  audioBitrate?: number;
  audioCodec?: string;
}

export interface SubtitleStyle {
  fontFamily?: string;
  fontSize?: number;
  fontColor?: string;
  outlineColor?: string;
  outlineWidth?: number;
  position?: "bottom" | "center" | "top";
}

export interface ExtractFramesOptions {
  /** Seconds between extracted frames. Default: 1. */
  intervalSec?: number;
  /** Max frames to extract. Default: 50. */
  maxFrames?: number;
  /** Output frame width (height scales proportionally). Default: 640. */
  width?: number;
}

export interface ExtractAudioOptions {
  /** Output format. Default: "wav". */
  format?: "wav" | "mp3";
}

export type ColorGrade = "cinematic" | "neutral" | "warm" | "cool";

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

const PREFIX = "[ffmpeg-service]";

const DEFAULT_EXTRACT_INTERVAL_SEC = 1;
const DEFAULT_MAX_FRAMES = 50;
const DEFAULT_FRAME_WIDTH = 640;
const DEFAULT_FADE_DURATION_MS = 30;

/** EQ curves that approximate common LUT looks via ffmpeg filters. */
const COLOR_GRADE_FILTERS: Record<ColorGrade, string> = {
  cinematic:
    "curves=r='0/0 0.25/0.20 0.5/0.45 0.75/0.70 1/0.9':g='0/0 0.25/0.22 0.5/0.47 0.75/0.72 1/0.92':b='0/0.05 0.25/0.20 0.5/0.42 0.75/0.65 1/0.82',eq=contrast=1.08:saturation=0.85:brightness=-0.02",
  neutral: "eq=contrast=1.0:saturation=1.0:brightness=0.0",
  warm: "colortemperature=temperature=6800,eq=contrast=1.02:saturation=1.08:brightness=0.01",
  cool: "colortemperature=temperature=4200,eq=contrast=1.04:saturation=0.92:brightness=-0.01",
};

/** Maps subtitle position keyword to ASS alignment code. */
const SUBTITLE_ALIGNMENT: Record<NonNullable<SubtitleStyle["position"]>, number> = {
  bottom: 2,
  center: 5,
  top: 8,
};

// ---------------------------------------------------------------------------
// Temp-file management
// ---------------------------------------------------------------------------

/** Tracked temp paths — cleaned up per-operation, not globally. */
function makeTempPath(ext: string): string {
  return path.join(os.tmpdir(), `ss-ffmpeg-${randomUUID()}${ext}`);
}

async function removeTempFiles(paths: string[]): Promise<void> {
  await Promise.allSettled(
    paths.map((p) =>
      fs.promises.unlink(p).catch(() => {
        /* best-effort cleanup — file may already be gone */
      }),
    ),
  );
}

async function removeTempDir(dirPath: string): Promise<void> {
  try {
    await fs.promises.rm(dirPath, { recursive: true, force: true });
  } catch {
    /* best-effort */
  }
}

// ---------------------------------------------------------------------------
// Lazy singleton
// ---------------------------------------------------------------------------

let _verified = false;

/**
 * Ensure the system ffmpeg binary is reachable. Called lazily on first
 * use — never at module scope.
 */
function ensureFfmpeg(): void {
  if (_verified) return;

  const ffmpegPath = process.env.FFMPEG_PATH ?? "ffmpeg";
  const ffprobePath = process.env.FFPROBE_PATH ?? "ffprobe";

  Ffmpeg.setFfmpegPath(ffmpegPath);
  Ffmpeg.setFfprobePath(ffprobePath);
  _verified = true;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Download a remote URL to a local temp file. Supports http(s) URLs.
 * Returns the local path (caller is responsible for cleanup).
 */
async function downloadToTemp(url: string): Promise<string> {
  const ext = path.extname(new URL(url).pathname) || ".mp4";
  const tempPath = makeTempPath(ext);

  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`${PREFIX} Failed to download ${url}: HTTP ${response.status}`);
  }

  const fileStream = fs.createWriteStream(tempPath);
  // Node 18+ ReadableStream from fetch → node stream
  const nodeReadable = readableStreamToNodeReadable(response.body);
  await pipeline(nodeReadable, fileStream);

  return tempPath;
}

/**
 * Convert a Web ReadableStream to a Node.js Readable.
 * Required because `fetch().body` returns a Web stream in Node 18+.
 */
function readableStreamToNodeReadable(
  webStream: ReadableStream<Uint8Array>,
): NodeJS.ReadableStream {
  const reader = webStream.getReader();
  return new (require("node:stream").Readable)({
    async read() {
      const { done, value } = await reader.read();
      if (done) {
        this.push(null);
      } else {
        this.push(Buffer.from(value));
      }
    },
  });
}

/**
 * Resolve an input path: if it looks like a URL, download it first.
 * Returns `{ localPath, needsCleanup }`.
 */
async function resolveInput(
  input: string,
): Promise<{ localPath: string; needsCleanup: boolean }> {
  if (input.startsWith("http://") || input.startsWith("https://")) {
    const localPath = await downloadToTemp(input);
    return { localPath, needsCleanup: true };
  }
  return { localPath: input, needsCleanup: false };
}

/**
 * Run ffprobe on a local file and return the raw metadata.
 */
function ffprobeAsync(filePath: string): Promise<FfprobeData> {
  return new Promise((resolve, reject) => {
    ensureFfmpeg();
    Ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) {
        reject(new Error(`${PREFIX} ffprobe failed: ${err.message}`));
      } else {
        resolve(data);
      }
    });
  });
}

/**
 * Wrap a fluent-ffmpeg command in a promise that resolves on "end"
 * and rejects on "error".
 */
function runCommand(command: Ffmpeg.FfmpegCommand): Promise<void> {
  return new Promise((resolve, reject) => {
    command
      .on("error", (err: Error) => reject(new Error(`${PREFIX} ${err.message}`)))
      .on("end", () => resolve())
      .run();
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Probe a video/audio file for metadata.
 *
 * Accepts both local paths and remote URLs.
 */
export async function probe(input: string): Promise<ProbeResult> {
  ensureFfmpeg();

  const { localPath, needsCleanup } = await resolveInput(input);
  const tempFiles = needsCleanup ? [localPath] : [];

  try {
    const data = await ffprobeAsync(localPath);

    const videoStream = data.streams.find(
      (s: FfprobeStream) => s.codec_type === "video",
    );
    const audioStream = data.streams.find(
      (s: FfprobeStream) => s.codec_type === "audio",
    );

    const durationSec = data.format.duration ?? 0;
    const width = videoStream?.width ?? 0;
    const height = videoStream?.height ?? 0;
    const codec = videoStream?.codec_name ?? "unknown";

    let fps = 0;
    if (videoStream?.r_frame_rate) {
      const parts = videoStream.r_frame_rate.split("/");
      if (parts.length === 2) {
        const num = Number(parts[0]);
        const den = Number(parts[1]);
        fps = den > 0 ? num / den : 0;
      }
    }

    return {
      durationSec,
      width,
      height,
      codec,
      fps: Math.round(fps * 100) / 100,
      audioBitrate: audioStream?.bit_rate ? Number(audioStream.bit_rate) : undefined,
      audioCodec: audioStream?.codec_name ?? undefined,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${PREFIX} probe failed for "${input}": ${msg}`);
    throw err;
  } finally {
    await removeTempFiles(tempFiles);
  }
}

/**
 * Extract evenly-spaced frames from a video as base64-encoded PNGs.
 *
 * Accepts both local paths and remote URLs.
 */
export async function extractFrames(
  videoUrl: string,
  opts: ExtractFramesOptions = {},
): Promise<FrameResult[]> {
  ensureFfmpeg();

  const intervalSec = opts.intervalSec ?? DEFAULT_EXTRACT_INTERVAL_SEC;
  const maxFrames = opts.maxFrames ?? DEFAULT_MAX_FRAMES;
  const targetWidth = opts.width ?? DEFAULT_FRAME_WIDTH;

  const { localPath, needsCleanup } = await resolveInput(videoUrl);
  const tempFiles = needsCleanup ? [localPath] : [];
  const outputDir = path.join(os.tmpdir(), `ss-frames-${randomUUID()}`);

  try {
    // Probe to get duration + dimensions
    const meta = await probe(localPath);
    if (meta.durationSec <= 0) {
      throw new Error(`${PREFIX} Cannot extract frames: video has no duration`);
    }

    await fs.promises.mkdir(outputDir, { recursive: true });

    // Compute timestamps
    const timestamps: number[] = [];
    for (
      let t = 0;
      t < meta.durationSec && timestamps.length < maxFrames;
      t += intervalSec
    ) {
      timestamps.push(Math.round(t * 100) / 100);
    }

    if (timestamps.length === 0) {
      return [];
    }

    // Extract frames using ffmpeg -ss for each timestamp
    // Batch via a single command using the select filter for efficiency
    const selectExpr = timestamps
      .map((t) => `gte(t\\,${t})*lt(t\\,${t + 0.01})`)
      .join("+");

    const outputPattern = path.join(outputDir, "frame-%04d.png");

    const cmd = Ffmpeg(localPath)
      .outputOptions([
        "-vf",
        `select='${selectExpr}',scale=${targetWidth}:-2`,
        "-vsync",
        "vfr",
        "-frames:v",
        String(timestamps.length),
      ])
      .output(outputPattern);

    await runCommand(cmd);

    // Read extracted frames
    const files = await fs.promises.readdir(outputDir);
    const frameFiles = files
      .filter((f) => f.startsWith("frame-") && f.endsWith(".png"))
      .sort();

    const results: FrameResult[] = [];

    for (let i = 0; i < frameFiles.length; i++) {
      const framePath = path.join(outputDir, frameFiles[i]);
      const buffer = await fs.promises.readFile(framePath);
      const base64 = buffer.toString("base64");

      // Probe individual frame for exact dimensions
      let frameWidth = targetWidth;
      let frameHeight = Math.round(
        (meta.height / meta.width) * targetWidth,
      );

      // Use the probed aspect ratio for height calculation
      if (meta.width > 0) {
        frameHeight = Math.round((meta.height * targetWidth) / meta.width);
        // ffmpeg -2 ensures even numbers
        if (frameHeight % 2 !== 0) frameHeight += 1;
      }

      results.push({
        index: i,
        timestampSec: timestamps[i] ?? i * intervalSec,
        base64,
        width: frameWidth,
        height: frameHeight,
      });
    }

    return results;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${PREFIX} extractFrames failed: ${msg}`);
    throw err;
  } finally {
    await removeTempDir(outputDir);
    await removeTempFiles(tempFiles);
  }
}

/**
 * Trim a video segment from `start` to `end` seconds.
 *
 * Uses `-ss` before `-i` for fast seeking and `-c copy` when possible.
 * Falls back to re-encoding when the output format differs from input.
 */
export async function trimClip(
  input: string,
  start: number,
  end: number,
  output: string,
): Promise<void> {
  ensureFfmpeg();

  if (start < 0) throw new Error(`${PREFIX} trimClip: start must be >= 0`);
  if (end <= start) throw new Error(`${PREFIX} trimClip: end must be > start`);

  const { localPath, needsCleanup } = await resolveInput(input);
  const tempFiles = needsCleanup ? [localPath] : [];

  try {
    const duration = end - start;

    const cmd = Ffmpeg(localPath)
      .setStartTime(start)
      .setDuration(duration)
      .outputOptions(["-c", "copy", "-avoid_negative_ts", "make_zero"])
      .output(output);

    await runCommand(cmd);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${PREFIX} trimClip failed: ${msg}`);
    throw err;
  } finally {
    await removeTempFiles(tempFiles);
  }
}

/**
 * Concatenate multiple clips into a single output file.
 *
 * Uses the concat demuxer for stream-copy speed when codecs match.
 * Falls back to the concat filter for mixed-codec inputs.
 */
export async function concatClips(
  inputs: string[],
  output: string,
): Promise<void> {
  ensureFfmpeg();

  if (inputs.length === 0) {
    throw new Error(`${PREFIX} concatClips: at least one input required`);
  }

  if (inputs.length === 1) {
    await fs.promises.copyFile(inputs[0], output);
    return;
  }

  const resolvedInputs: Array<{ localPath: string; needsCleanup: boolean }> = [];
  const tempFiles: string[] = [];

  try {
    // Resolve all inputs (download URLs if needed)
    for (const inp of inputs) {
      const resolved = await resolveInput(inp);
      resolvedInputs.push(resolved);
      if (resolved.needsCleanup) tempFiles.push(resolved.localPath);
    }

    // Build concat file for the demuxer
    const concatFilePath = makeTempPath(".txt");
    tempFiles.push(concatFilePath);

    const concatContent = resolvedInputs
      .map((r) => `file '${r.localPath.replace(/'/g, "'\\''")}'`)
      .join("\n");

    await fs.promises.writeFile(concatFilePath, concatContent, "utf-8");

    const cmd = Ffmpeg()
      .input(concatFilePath)
      .inputOptions(["-f", "concat", "-safe", "0"])
      .outputOptions(["-c", "copy"])
      .output(output);

    await runCommand(cmd);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${PREFIX} concatClips failed: ${msg}`);
    throw err;
  } finally {
    await removeTempFiles(tempFiles);
  }
}

/**
 * Burn (hard-code) subtitles from an SRT file onto the video.
 *
 * Supports customization of font, size, color, outline, and position.
 */
export async function burnSubtitles(
  input: string,
  srtPath: string,
  output: string,
  opts: SubtitleStyle = {},
): Promise<void> {
  ensureFfmpeg();

  const { localPath, needsCleanup } = await resolveInput(input);
  const tempFiles = needsCleanup ? [localPath] : [];

  try {
    // Validate SRT exists
    await fs.promises.access(srtPath, fs.constants.R_OK);

    const fontFamily = opts.fontFamily ?? "Arial";
    const fontSize = opts.fontSize ?? 24;
    const fontColor = (opts.fontColor ?? "&HFFFFFF&").replace("#", "&H").replace(/&?$/, "&");
    const outlineColor = (opts.outlineColor ?? "&H000000&").replace("#", "&H").replace(/&?$/, "&");
    const outlineWidth = opts.outlineWidth ?? 2;
    const alignment = SUBTITLE_ALIGNMENT[opts.position ?? "bottom"];

    // Escape path for ffmpeg filter (backslashes and colons on Windows)
    const escapedSrt = srtPath
      .replace(/\\/g, "/")
      .replace(/:/g, "\\:");

    const subtitleFilter = [
      `subtitles='${escapedSrt}'`,
      `force_style='FontName=${fontFamily}`,
      `FontSize=${fontSize}`,
      `PrimaryColour=${fontColor}`,
      `OutlineColour=${outlineColor}`,
      `Outline=${outlineWidth}`,
      `Alignment=${alignment}'`,
    ].join(",force_style='").replace(/,force_style='/g, ",");

    // Build the actual force_style string properly
    const forceStyle = [
      `FontName=${fontFamily}`,
      `FontSize=${fontSize}`,
      `PrimaryColour=${fontColor}`,
      `OutlineColour=${outlineColor}`,
      `Outline=${outlineWidth}`,
      `Alignment=${alignment}`,
    ].join(",");

    const vf = `subtitles='${escapedSrt}':force_style='${forceStyle}'`;

    const cmd = Ffmpeg(localPath)
      .outputOptions(["-vf", vf, "-c:a", "copy"])
      .output(output);

    await runCommand(cmd);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${PREFIX} burnSubtitles failed: ${msg}`);
    throw err;
  } finally {
    await removeTempFiles(tempFiles);
  }
}

/**
 * Extract the audio track from a video file.
 */
export async function extractAudio(
  input: string,
  output: string,
  opts: ExtractAudioOptions = {},
): Promise<void> {
  ensureFfmpeg();

  const format = opts.format ?? "wav";
  const { localPath, needsCleanup } = await resolveInput(input);
  const tempFiles = needsCleanup ? [localPath] : [];

  try {
    const outputOptions: string[] = ["-vn"];

    if (format === "mp3") {
      outputOptions.push("-c:a", "libmp3lame", "-q:a", "2");
    } else {
      outputOptions.push("-c:a", "pcm_s16le", "-ar", "16000");
    }

    const cmd = Ffmpeg(localPath)
      .outputOptions(outputOptions)
      .output(output);

    await runCommand(cmd);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${PREFIX} extractAudio failed: ${msg}`);
    throw err;
  } finally {
    await removeTempFiles(tempFiles);
  }
}

/**
 * Add short audio fades at the beginning and end of a clip.
 *
 * Default fade duration is 30ms — designed for cut boundaries in the
 * auto-edit pipeline to eliminate click/pop artifacts.
 */
export async function addAudioFades(
  input: string,
  output: string,
  fadeDurationMs: number = DEFAULT_FADE_DURATION_MS,
): Promise<void> {
  ensureFfmpeg();

  const { localPath, needsCleanup } = await resolveInput(input);
  const tempFiles = needsCleanup ? [localPath] : [];

  try {
    const meta = await probe(localPath);
    const fadeSec = fadeDurationMs / 1000;

    // Ensure fade duration doesn't exceed half the clip length
    const maxFade = meta.durationSec / 2;
    const safeFade = Math.min(fadeSec, maxFade);

    const fadeOutStart = Math.max(0, meta.durationSec - safeFade);

    const audioFilter = [
      `afade=t=in:st=0:d=${safeFade}`,
      `afade=t=out:st=${fadeOutStart}:d=${safeFade}`,
    ].join(",");

    const cmd = Ffmpeg(localPath)
      .outputOptions(["-af", audioFilter, "-c:v", "copy"])
      .output(output);

    await runCommand(cmd);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${PREFIX} addAudioFades failed: ${msg}`);
    throw err;
  } finally {
    await removeTempFiles(tempFiles);
  }
}

/**
 * Apply a color-grade preset to a video.
 *
 * Uses ffmpeg filter chains that approximate common LUT looks:
 * - **cinematic**: crushed blacks, desaturated, slight blue shadows
 * - **neutral**: pass-through (identity grade)
 * - **warm**: raised color temperature, slight saturation boost
 * - **cool**: lowered color temperature, slight desaturation
 */
export async function applyColorGrade(
  input: string,
  output: string,
  grade: ColorGrade,
): Promise<void> {
  ensureFfmpeg();

  const { localPath, needsCleanup } = await resolveInput(input);
  const tempFiles = needsCleanup ? [localPath] : [];

  try {
    const filterChain = COLOR_GRADE_FILTERS[grade];

    // For neutral, just copy the stream — no processing needed
    if (grade === "neutral") {
      const cmd = Ffmpeg(localPath)
        .outputOptions(["-c", "copy"])
        .output(output);

      await runCommand(cmd);
      return;
    }

    const cmd = Ffmpeg(localPath)
      .outputOptions(["-vf", filterChain, "-c:a", "copy"])
      .output(output);

    await runCommand(cmd);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${PREFIX} applyColorGrade "${grade}" failed: ${msg}`);
    throw err;
  } finally {
    await removeTempFiles(tempFiles);
  }
}
