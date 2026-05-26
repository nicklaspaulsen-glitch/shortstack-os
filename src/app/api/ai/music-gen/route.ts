import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";

/**
 * MusicGen / ACE-Step — AI Music Generation on RunPod.
 * Provider priority: ACE-Step (RUNPOD_ACESTEP_URL) → MusicGen (RUNPOD_MUSICGEN_URL).
 * Both soft-fail if their env var is unset.
 *
 * ACE-Step advantages over MusicGen:
 *   - Longer outputs (up to 5 min vs 30s)
 *   - Higher audio quality
 *   - Optional lyrics input
 *   - Better genre adherence
 */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = checkAiRateLimit(user.id);
  if (limited) return limited;

  const body = await request.json();
  const {
    prompt,           // "upbeat corporate background music with light drums and synth"
    duration = 15,    // seconds
    mood,
    genre,
    tempo,
    lyrics,           // optional — ACE-Step only
    provider,         // "acestep" | "musicgen" | undefined (auto)
  } = body;

  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json({ error: "Music prompt required" }, { status: 400 });
  }

  const aceStepUrl = process.env.RUNPOD_ACESTEP_URL;
  const musicGenUrl = process.env.RUNPOD_MUSICGEN_URL;
  const runpodKey = process.env.RUNPOD_API_KEY;

  if (!runpodKey) {
    return NextResponse.json({ error: "RunPod API key not configured" }, { status: 500 });
  }

  const enhancedPrompt = buildMusicPrompt(prompt, mood, genre, tempo);
  const clampedDuration = Math.min(Math.max(duration, 5), 300);

  // Prefer ACE-Step when available (unless caller explicitly requests musicgen)
  const useAceStep = provider !== "musicgen" && !!aceStepUrl;
  const useMusicGen = !useAceStep && !!musicGenUrl;

  if (!useAceStep && !useMusicGen) {
    return NextResponse.json({ error: "No music generator configured. Set RUNPOD_ACESTEP_URL or RUNPOD_MUSICGEN_URL." }, { status: 500 });
  }

  try {
    if (useAceStep) {
      return await runAceStep({ aceStepUrl: aceStepUrl!, runpodKey, prompt: enhancedPrompt, duration: clampedDuration, lyrics });
    }
    return await runMusicGen({ musicGenUrl: musicGenUrl!, runpodKey, prompt: enhancedPrompt, duration: clampedDuration, body });
  } catch (err) {
    console.error("[music-gen] generation failed:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Music generation failed" }, { status: 500 });
  }
}

async function runAceStep({
  aceStepUrl,
  runpodKey,
  prompt,
  duration,
  lyrics,
}: {
  aceStepUrl: string;
  runpodKey: string;
  prompt: string;
  duration: number;
  lyrics?: string;
}) {
  const res = await fetch(`${aceStepUrl}/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${runpodKey}`,
    },
    body: JSON.stringify({
      input: {
        tags: prompt,
        lyrics: lyrics || "[verse]\n[chorus]",  // minimal structure when no lyrics provided
        audio_duration: Math.min(duration, 300),
        infer_step: 60,
        guidance_scale: 5.0,
        scheduler_type: "euler",
        use_erg_tag: true,
        use_erg_lyric: false,
        use_erg_diffusion: true,
        output_format: "wav",
      },
    }),
  });

  const job = await res.json();

  if (job.status === "COMPLETED" && job.output) {
    return NextResponse.json({
      success: true,
      provider: "acestep",
      audio: job.output.audio_base64 || job.output.audio_url || job.output.result,
      duration: job.output.duration || duration,
      prompt,
    });
  }

  if (job.id) {
    return NextResponse.json({
      success: true,
      provider: "acestep",
      job_id: job.id,
      status: job.status || "IN_QUEUE",
      status_url: `/api/ai/music-gen?job_id=${job.id}&provider=acestep`,
    });
  }

  return NextResponse.json({ error: "ACE-Step generation failed" }, { status: 500 });
}

async function runMusicGen({
  musicGenUrl,
  runpodKey,
  prompt,
  duration,
  body,
}: {
  musicGenUrl: string;
  runpodKey: string;
  prompt: string;
  duration: number;
  body: Record<string, unknown>;
}) {
  const VALID_MODELS = ["small", "medium", "large"] as const;
  type MusicGenModel = typeof VALID_MODELS[number];
  const rawModel: unknown = body.model ?? "medium";
  const model: MusicGenModel = VALID_MODELS.includes(rawModel as MusicGenModel)
    ? (rawModel as MusicGenModel)
    : "medium";

  const res = await fetch(`${musicGenUrl}/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${runpodKey}`,
    },
    body: JSON.stringify({
      input: {
        prompt,
        duration: Math.min(duration, 30),  // MusicGen max 30s
        model_name: `facebook/musicgen-${model}`,
        temperature: (body.temperature as number) ?? 1.0,
        top_k: (body.top_k as number) ?? 250,
        top_p: (body.top_p as number) ?? 0.0,
        cfg_coef: (body.cfg_coef as number) ?? 3.0,
        output_format: "wav",
      },
    }),
  });

  const job = await res.json();

  if (job.status === "COMPLETED" && job.output) {
    return NextResponse.json({
      success: true,
      provider: "musicgen",
      audio: job.output.audio_base64 || job.output.audio_url || job.output.result,
      duration: job.output.duration || duration,
      prompt,
    });
  }

  if (job.id) {
    return NextResponse.json({
      success: true,
      provider: "musicgen",
      job_id: job.id,
      status: job.status || "IN_QUEUE",
      status_url: `/api/ai/music-gen?job_id=${job.id}&provider=musicgen`,
    });
  }

  return NextResponse.json({ error: "MusicGen generation failed" }, { status: 500 });
}

function buildMusicPrompt(base: string, mood?: string, genre?: string, tempo?: string): string {
  const parts = [base];

  const moodMap: Record<string, string> = {
    upbeat: "energetic, positive, driving rhythm",
    chill: "relaxed, mellow, smooth, ambient",
    dramatic: "cinematic, epic, orchestral swells, tension",
    motivational: "inspiring, uplifting, building crescendo",
    corporate: "professional, clean, light background",
    emotional: "heartfelt, piano-driven, gentle strings",
    trendy: "modern trap beats, bass-heavy, viral energy",
    dark: "moody, minor key, atmospheric, suspenseful",
    jazz: "jazz harmonies, piano, brushed drums, walking bass",
    lofi: "lo-fi hip hop, vinyl crackle, mellow keys, nostalgic",
    epic: "epic cinematic, orchestral, massive drums, sweeping strings",
    acoustic: "acoustic guitar, organic instruments, warm, natural",
  };

  const genreMap: Record<string, string> = {
    electronic: "electronic synths, digital production",
    acoustic: "acoustic guitar, organic instruments",
    hiphop: "hip-hop beats, 808 bass, trap hi-hats",
    lofi: "lo-fi hip hop, vinyl crackle, mellow keys",
    orchestral: "full orchestra, strings, brass, woodwinds",
    pop: "pop production, catchy melody, modern",
    jazz: "jazz harmonies, piano, brushed drums, bass",
    ambient: "ambient textures, pads, atmospheric soundscape",
    rock: "electric guitar, drums, bass, rock energy",
    cinematic: "cinematic score, strings, brass, epic production",
  };

  if (mood && moodMap[mood]) parts.push(moodMap[mood]);
  if (genre && genreMap[genre]) parts.push(genreMap[genre]);
  if (tempo) parts.push(`${tempo} BPM tempo`);

  parts.push("high quality, professional mix, broadcast ready, royalty free");
  return parts.join(", ");
}

// GET — Poll job status
export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("job_id");
  const provider = request.nextUrl.searchParams.get("provider") || "musicgen";

  if (!jobId) return NextResponse.json({ error: "job_id required" }, { status: 400 });

  const runpodKey = process.env.RUNPOD_API_KEY;
  const endpointUrl = provider === "acestep"
    ? process.env.RUNPOD_ACESTEP_URL
    : process.env.RUNPOD_MUSICGEN_URL;

  if (!endpointUrl || !runpodKey) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(`${endpointUrl}/status/${jobId}`, {
      headers: { Authorization: `Bearer ${runpodKey}` },
    });
    const data = await res.json();

    if (data.status === "COMPLETED" && data.output) {
      return NextResponse.json({
        status: "completed",
        provider,
        audio: data.output.audio_base64 || data.output.audio_url || data.output.result,
        duration: data.output.duration || null,
      });
    }

    return NextResponse.json({ status: data.status?.toLowerCase() || "processing", provider });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
