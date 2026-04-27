import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";
import {
  TranscriptionProviderError,
  type TranscribeOptions,
  type TranscribeResult,
  type TranscriptionProvider,
  type TranscriptionProviderImpl,
} from "@/lib/transcription/provider";

// vi.mock factories run before top-level code; reference vars via vi.hoisted.
const fakes = vi.hoisted(() => {
  const make = (
    name: TranscriptionProvider,
    supportsDiarization: boolean,
  ): TranscriptionProviderImpl => ({
    name,
    supportsDiarization,
    available: vi.fn(() => true),
    transcribe: vi.fn(),
  });
  return {
    openai: make("openai_whisper", false),
    fasterWhisper: make("runpod_faster_whisper", false),
    whisperx: make("runpod_whisperx", true),
  };
});

vi.mock("@/lib/transcription/openai-whisper", () => ({
  openAiWhisperProvider: fakes.openai,
}));
vi.mock("@/lib/transcription/runpod-faster-whisper", () => ({
  runpodFasterWhisperProvider: fakes.fasterWhisper,
  pollFasterWhisperJob: vi.fn(),
}));
vi.mock("@/lib/transcription/runpod-whisperx", () => ({
  runpodWhisperXProvider: fakes.whisperx,
  pollWhisperXJob: vi.fn(),
}));

// Import AFTER mocks so the router picks up the fakes.
type RouterModule = typeof import("@/lib/transcription/router");
let transcribe: RouterModule["transcribe"];
let getTranscriptionProviderStatus: RouterModule["getTranscriptionProviderStatus"];
beforeAll(async () => {
  const router = await import("@/lib/transcription/router");
  transcribe = router.transcribe;
  getTranscriptionProviderStatus = router.getTranscriptionProviderStatus;
});

const baseResult = (provider: TranscriptionProvider): TranscribeResult => ({
  text: "hello world",
  segments: [
    { start: 0, end: 1.2, text: "hello world", speaker: "SPEAKER_00" },
  ],
  language: "en",
  duration_seconds: 2,
  provider,
  cost_usd: 0,
  job_id: null,
});

const opts = (override: Partial<TranscribeOptions> = {}): TranscribeOptions => ({
  audioUrl: "https://example.com/audio.mp3",
  ...override,
});

beforeEach(() => {
  vi.clearAllMocks();
  fakes.openai.available = vi.fn(() => true);
  fakes.fasterWhisper.available = vi.fn(() => true);
  fakes.whisperx.available = vi.fn(() => true);
  fakes.openai.transcribe = vi.fn();
  fakes.fasterWhisper.transcribe = vi.fn();
  fakes.whisperx.transcribe = vi.fn();
});

describe("transcription router", () => {
  it("prefers WhisperX when diarize: true", async () => {
    fakes.whisperx.transcribe = vi
      .fn()
      .mockResolvedValueOnce(baseResult("runpod_whisperx"));

    const result = await transcribe(opts({ diarize: true }));
    expect(result.provider).toBe("runpod_whisperx");
    expect(fakes.whisperx.transcribe).toHaveBeenCalledTimes(1);
    expect(fakes.fasterWhisper.transcribe).not.toHaveBeenCalled();
    expect(fakes.openai.transcribe).not.toHaveBeenCalled();
  });

  it("falls back to faster-whisper when WhisperX is unavailable and diarize: true", async () => {
    fakes.whisperx.available = vi.fn(() => false);
    fakes.fasterWhisper.transcribe = vi
      .fn()
      .mockResolvedValueOnce(baseResult("runpod_faster_whisper"));

    const result = await transcribe(opts({ diarize: true }));
    expect(result.provider).toBe("runpod_faster_whisper");
    expect(fakes.fasterWhisper.transcribe).toHaveBeenCalledTimes(1);
  });

  it("uses faster-whisper first when diarize is false", async () => {
    fakes.fasterWhisper.transcribe = vi
      .fn()
      .mockResolvedValueOnce(baseResult("runpod_faster_whisper"));

    const result = await transcribe(opts());
    expect(result.provider).toBe("runpod_faster_whisper");
    expect(fakes.whisperx.transcribe).not.toHaveBeenCalled();
  });

  it("falls back to OpenAI when only OpenAI is configured", async () => {
    fakes.fasterWhisper.available = vi.fn(() => false);
    fakes.whisperx.available = vi.fn(() => false);
    fakes.openai.transcribe = vi
      .fn()
      .mockResolvedValueOnce(baseResult("openai_whisper"));

    const result = await transcribe(opts());
    expect(result.provider).toBe("openai_whisper");
  });

  it("falls through to next provider on TranscriptionProviderError", async () => {
    fakes.fasterWhisper.transcribe = vi
      .fn()
      .mockRejectedValueOnce(
        new TranscriptionProviderError("runpod_faster_whisper", "http_503"),
      );
    fakes.openai.transcribe = vi
      .fn()
      .mockResolvedValueOnce(baseResult("openai_whisper"));

    const result = await transcribe(opts());
    expect(result.provider).toBe("openai_whisper");
    expect(fakes.fasterWhisper.transcribe).toHaveBeenCalledTimes(1);
    expect(fakes.openai.transcribe).toHaveBeenCalledTimes(1);
  });

  it("returns job-pending result without falling through (cold-start path)", async () => {
    const stub: TranscribeResult = {
      ...baseResult("runpod_faster_whisper"),
      text: "",
      segments: [],
      duration_seconds: 0,
      job_id: "rp-job-123",
    };
    fakes.fasterWhisper.transcribe = vi.fn().mockResolvedValueOnce(stub);

    const result = await transcribe(opts());
    expect(result.job_id).toBe("rp-job-123");
    expect(result.provider).toBe("runpod_faster_whisper");
    // Critical: must NOT have re-invoked another provider since we'd then
    // double-pay for audio the GPU is already processing.
    expect(fakes.openai.transcribe).not.toHaveBeenCalled();
  });

  it("throws when no providers are configured", async () => {
    fakes.openai.available = vi.fn(() => false);
    fakes.fasterWhisper.available = vi.fn(() => false);
    fakes.whisperx.available = vi.fn(() => false);
    await expect(transcribe(opts())).rejects.toThrow(
      /All transcription providers failed/,
    );
  });

  it("rejects empty audioUrl", async () => {
    await expect(
      transcribe({ audioUrl: "" } as TranscribeOptions),
    ).rejects.toThrow(/audioUrl is required/);
  });

  it("getTranscriptionProviderStatus reports availability + diarization support", () => {
    const status = getTranscriptionProviderStatus();
    expect(status).toHaveLength(3);
    const wx = status.find((s) => s.name === "runpod_whisperx");
    expect(wx?.supportsDiarization).toBe(true);
    const fw = status.find((s) => s.name === "runpod_faster_whisper");
    expect(fw?.supportsDiarization).toBe(false);
  });
});
