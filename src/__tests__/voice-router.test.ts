import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  type VoiceProviderImpl,
  type VoiceSynthRequest,
  type VoiceSynthResponse,
  VoiceProviderError,
} from "@/lib/voice/provider";

// `vi.mock` factories run before any other top-level code, so any vars
// they reference must be declared with `vi.hoisted`. This is the canonical
// vitest pattern for module-replacement fakes that we mutate per-test.
const fakes = vi.hoisted(() => {
  const make = (
    name: "runpod_xtts" | "openai_tts" | "elevenlabs",
    costPerCharUsd: number,
  ) => ({
    name,
    costPerCharUsd,
    available: vi.fn(() => true),
    synthesize: vi.fn(),
  });
  return {
    runpod: make("runpod_xtts", 0.00002),
    openai: make("openai_tts", 0.000015),
    eleven: make("elevenlabs", 0.00018),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: () => ({
      insert: () => Promise.resolve({ error: null }),
    }),
  }),
}));
vi.mock("@/lib/voice/providers/runpod-xtts", () => ({
  runpodXttsProvider: fakes.runpod,
}));
vi.mock("@/lib/voice/providers/elevenlabs", () => ({
  elevenLabsProvider: fakes.eleven,
}));
vi.mock("@/lib/voice/providers/openai-tts", () => ({
  openaiTtsProvider: fakes.openai,
}));

import {
  synthesizeVoice,
  getVoiceProvider,
  getProviderStatus,
} from "@/lib/voice/router";

const okResponse = (
  provider: VoiceProviderImpl["name"],
): VoiceSynthResponse => ({
  audio: Buffer.from([1, 2, 3]),
  contentType: "audio/mpeg",
  provider,
  costEstimate: 0.0001,
});

const baseReq: VoiceSynthRequest = { text: "Hello world" };

describe("voice router", () => {
  beforeEach(() => {
    delete process.env.VOICE_PROVIDER_DEFAULT;
    delete process.env.VOICE_PROVIDER_PREMIUM;
    delete process.env.TRINITY_TTS_PROVIDER;

    [fakes.runpod, fakes.openai, fakes.eleven].forEach((p) => {
      p.available.mockReset().mockReturnValue(true);
      p.synthesize.mockReset();
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("defaults to runpod_xtts when no preference is given", async () => {
    fakes.runpod.synthesize.mockResolvedValue(okResponse("runpod_xtts"));

    const res = await synthesizeVoice(baseReq);
    expect(res.provider).toBe("runpod_xtts");
    expect(fakes.runpod.synthesize).toHaveBeenCalledTimes(1);
    expect(fakes.openai.synthesize).not.toHaveBeenCalled();
    expect(fakes.eleven.synthesize).not.toHaveBeenCalled();
  });

  it("uses elevenlabs when premium=true", async () => {
    fakes.eleven.synthesize.mockResolvedValue(okResponse("elevenlabs"));

    const res = await synthesizeVoice(baseReq, { premium: true });
    expect(res.provider).toBe("elevenlabs");
    expect(fakes.eleven.synthesize).toHaveBeenCalledTimes(1);
    expect(fakes.runpod.synthesize).not.toHaveBeenCalled();
  });

  it("falls through to the next provider on synthesis failure", async () => {
    fakes.runpod.synthesize.mockRejectedValue(
      new VoiceProviderError("runpod_xtts", "http_500"),
    );
    fakes.openai.synthesize.mockResolvedValue(okResponse("openai_tts"));

    const res = await synthesizeVoice(baseReq);
    expect(res.provider).toBe("openai_tts");
    expect(fakes.runpod.synthesize).toHaveBeenCalledTimes(1);
    expect(fakes.openai.synthesize).toHaveBeenCalledTimes(1);
  });

  it("skips unavailable providers without invoking synthesize", async () => {
    fakes.runpod.available.mockReturnValue(false);
    fakes.openai.available.mockReturnValue(false);
    fakes.eleven.synthesize.mockResolvedValue(okResponse("elevenlabs"));

    const res = await synthesizeVoice(baseReq);
    expect(res.provider).toBe("elevenlabs");
    expect(fakes.runpod.synthesize).not.toHaveBeenCalled();
    expect(fakes.openai.synthesize).not.toHaveBeenCalled();
  });

  it("throws when every provider fails", async () => {
    fakes.runpod.synthesize.mockRejectedValue(
      new VoiceProviderError("runpod_xtts", "http_500"),
    );
    fakes.openai.synthesize.mockRejectedValue(
      new VoiceProviderError("openai_tts", "http_401"),
    );
    fakes.eleven.synthesize.mockRejectedValue(
      new VoiceProviderError("elevenlabs", "http_402"),
    );

    await expect(synthesizeVoice(baseReq)).rejects.toThrow(
      /All voice providers failed/,
    );
  });

  it("respects opts.prefer over default", async () => {
    fakes.openai.synthesize.mockResolvedValue(okResponse("openai_tts"));

    const res = await synthesizeVoice(baseReq, { prefer: "openai_tts" });
    expect(res.provider).toBe("openai_tts");
    expect(fakes.runpod.synthesize).not.toHaveBeenCalled();
  });

  it("respects VOICE_PROVIDER_DEFAULT env override", async () => {
    process.env.VOICE_PROVIDER_DEFAULT = "openai_tts";
    fakes.openai.synthesize.mockResolvedValue(okResponse("openai_tts"));

    const res = await synthesizeVoice(baseReq);
    expect(res.provider).toBe("openai_tts");
  });

  it("translates legacy TRINITY_TTS_PROVIDER=xtts to runpod_xtts", async () => {
    process.env.TRINITY_TTS_PROVIDER = "xtts";
    fakes.runpod.synthesize.mockResolvedValue(okResponse("runpod_xtts"));

    const res = await synthesizeVoice(baseReq);
    expect(res.provider).toBe("runpod_xtts");
  });

  it("getVoiceProvider returns first available", () => {
    fakes.runpod.available.mockReturnValue(false);
    expect(getVoiceProvider().name).toBe("openai_tts");
  });

  it("getVoiceProvider throws when nothing is configured", () => {
    [fakes.runpod, fakes.openai, fakes.eleven].forEach((p) =>
      p.available.mockReturnValue(false),
    );
    expect(() => getVoiceProvider()).toThrow(/No voice provider configured/);
  });

  it("getProviderStatus reports availability for all providers", () => {
    fakes.runpod.available.mockReturnValue(true);
    fakes.openai.available.mockReturnValue(false);
    fakes.eleven.available.mockReturnValue(true);

    const status = getProviderStatus();
    expect(status).toHaveLength(3);
    expect(status.find((s) => s.name === "runpod_xtts")?.available).toBe(true);
    expect(status.find((s) => s.name === "openai_tts")?.available).toBe(false);
    expect(status.find((s) => s.name === "elevenlabs")?.available).toBe(true);
  });
});
