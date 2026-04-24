/* ────────────────────────────────────────────────────────────────
 * Audio peaks — Web Audio API min/max-per-bucket extraction.
 *
 * Used to render waveform thumbnails on <canvas> for audio clips.
 * The peak array is normalised to 0..1 (max of |min|, |max| per bucket).
 * ────────────────────────────────────────────────────────────────*/

export interface Peaks {
  /** Normalised 0..1 sample peaks, one per horizontal pixel bucket. */
  samples: number[];
  /** Duration of the source file in seconds. */
  duration: number;
}

/** Extract peaks from a remote audio URL by decoding via Web Audio API. */
export async function extractPeaksFromUrl(
  url: string,
  bucketCount: number
): Promise<Peaks> {
  if (typeof window === "undefined") {
    return { samples: [], duration: 0 };
  }
  const AudioCtx =
    (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      .AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) {
    return { samples: [], duration: 0 };
  }
  const ctx = new AudioCtx();
  try {
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    const audio = await ctx.decodeAudioData(buf);
    const peaks = extractPeaksFromBuffer(audio, bucketCount);
    return peaks;
  } finally {
    // Best-effort close; some browsers will throw if already closed.
    try {
      void ctx.close();
    } catch {
      /* noop */
    }
  }
}

/** Bucket-based min/max peaks from an already-decoded AudioBuffer. */
export function extractPeaksFromBuffer(
  buffer: AudioBuffer,
  bucketCount: number
): Peaks {
  const ch0 = buffer.getChannelData(0);
  const len = ch0.length;
  const bucketSize = Math.max(1, Math.floor(len / bucketCount));
  const samples: number[] = new Array(bucketCount).fill(0);
  for (let b = 0; b < bucketCount; b++) {
    const start = b * bucketSize;
    const end = Math.min(len, start + bucketSize);
    let max = 0;
    for (let i = start; i < end; i++) {
      const v = Math.abs(ch0[i]);
      if (v > max) max = v;
    }
    samples[b] = Math.min(1, max);
  }
  return { samples, duration: buffer.duration };
}

/** Render peaks to a canvas. Caller owns `canvas` sizing. */
export function renderPeaksToCanvas(
  canvas: HTMLCanvasElement,
  peaks: number[],
  accent: string
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = accent;
  const mid = height / 2;
  const step = Math.max(1, Math.floor(peaks.length / width));
  for (let x = 0; x < width; x++) {
    const sampleIdx = Math.min(peaks.length - 1, x * step);
    const v = peaks[sampleIdx] || 0;
    const h = Math.max(1, v * (height - 4));
    ctx.fillRect(x, mid - h / 2, 1, h);
  }
}
