import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// GET /api/tts/debug
// Diagnostic endpoint — checks which TTS providers are configured and which
// of them actually respond with audio. Use this when Trinity's voice is
// falling back to the Microsoft browser voice and you can't tell why.
//
// Returns JSON like:
// {
//   providers: {
//     xtts:       { configured: true, reachable: false, reason: "404" },
//     openai:     { configured: true, reachable: true },
//     elevenlabs: { configured: true, reachable: false, reason: "402 quota" }
//   },
//   active_order: ["xtts", "openai", "elevenlabs"],
//   recommended_action: "..."
// }
export const runtime = "nodejs";
export const maxDuration = 20;

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const probeText = "hi";

  const results: Record<string, { configured: boolean; reachable?: boolean; reason?: string; bytes?: number }> = {
    xtts: { configured: false },
    openai: { configured: false },
    elevenlabs: { configured: false },
  };

  // ── XTTS probe ────────────────────────────────────────────────
  const xttsUrl = process.env.RUNPOD_XTTS_URL;
  const runpodKey = process.env.RUNPOD_API_KEY;
  if (xttsUrl && runpodKey) {
    results.xtts.configured = true;
    try {
      const res = await fetch(`${xttsUrl}/runsync`, {
        method: "POST",
        headers: { Authorization: `Bearer ${runpodKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ input: { text: probeText, language: "en" } }),
        signal: AbortSignal.timeout(15000),
      });
      results.xtts.reachable = res.ok;
      if (!res.ok) results.xtts.reason = `http_${res.status}`;
    } catch (err) {
      results.xtts.reachable = false;
      results.xtts.reason = err instanceof Error ? err.message : "fetch_error";
    }
  } else {
    results.xtts.reason = "not_configured — set RUNPOD_XTTS_URL + RUNPOD_API_KEY";
  }

  // ── OpenAI TTS probe ──────────────────────────────────────────
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    results.openai.configured = true;
    try {
      const res = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "tts-1",
          voice: process.env.OPENAI_TTS_VOICE || "nova",
          input: probeText,
          response_format: "mp3",
        }),
        signal: AbortSignal.timeout(15000),
      });
      results.openai.reachable = res.ok;
      if (res.ok) {
        const buf = await res.arrayBuffer();
        results.openai.bytes = buf.byteLength;
      } else {
        const body = await res.text().catch(() => "");
        results.openai.reason = `http_${res.status}: ${body.slice(0, 160)}`;
      }
    } catch (err) {
      results.openai.reachable = false;
      results.openai.reason = err instanceof Error ? err.message : "fetch_error";
    }
  } else {
    results.openai.reason = "not_configured — set OPENAI_API_KEY";
  }

  // ── ElevenLabs probe ──────────────────────────────────────────
  const elevenKey = process.env.ELEVENLABS_API_KEY;
  if (elevenKey) {
    results.elevenlabs.configured = true;
    try {
      // Real synthesis probe — NOT /v1/user. The user's key can be valid
      // (/v1/user returns 200) while their TTS quota is exhausted (the
      // actual TTS endpoint returns 402). Only the real endpoint tells
      // the truth, so do a 1-char synthesis and discard the audio.
      const voiceId =
        process.env.ELEVENLABS_VOICE_ID || "XB0fDUnXU5powFXDhCwa";
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "xi-api-key": elevenKey,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text: probeText,
            model_id: "eleven_turbo_v2_5",
            voice_settings: { stability: 0.7, similarity_boost: 0.8 },
          }),
          signal: AbortSignal.timeout(15000),
        },
      );
      results.elevenlabs.reachable = res.ok;
      if (res.ok) {
        const buf = await res.arrayBuffer();
        results.elevenlabs.bytes = buf.byteLength;
      } else {
        const body = await res.text().catch(() => "");
        results.elevenlabs.reason = `http_${res.status}: ${body.slice(0, 160)}`;
      }
    } catch (err) {
      results.elevenlabs.reachable = false;
      results.elevenlabs.reason = err instanceof Error ? err.message : "fetch_error";
    }
  } else {
    results.elevenlabs.reason = "not_configured — set ELEVENLABS_API_KEY";
  }

  // ── Decide recommended action ────────────────────────────────
  const forced = process.env.TRINITY_TTS_PROVIDER;
  const active_order =
    forced === "elevenlabs"
      ? ["elevenlabs", "openai", "xtts"]
      : forced === "openai"
        ? ["openai", "xtts", "elevenlabs"]
        : forced === "xtts"
          ? ["xtts", "openai", "elevenlabs"]
          : ["xtts", "openai", "elevenlabs"];

  // Find the first provider in order that's both configured AND reachable.
  const firstWorking = active_order.find(
    (p) => results[p].configured && results[p].reachable,
  );

  let recommended_action = "";
  if (firstWorking) {
    recommended_action = `✓ ${firstWorking} is ready — Trinity should use it.`;
  } else if (!Object.values(results).some((r) => r.configured)) {
    recommended_action =
      "No provider configured. Add OPENAI_API_KEY in Vercel (easiest, $0.015/1k chars) and redeploy.";
  } else {
    recommended_action =
      "Keys are set but all providers failed at runtime. Check each `reason` field. ElevenLabs 402 = out of quota; OpenAI 401 = bad key; XTTS 404 = worker not running.";
  }

  return NextResponse.json({
    providers: results,
    active_order,
    forced_by_env: forced || null,
    first_working_provider: firstWorking || null,
    recommended_action,
    hint: "If you just added OPENAI_API_KEY in Vercel, you need to trigger a new deploy for it to take effect. Env vars don't propagate to existing running serverless functions.",
  });
}
