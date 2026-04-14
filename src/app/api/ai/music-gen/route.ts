import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";

/**
 * MusicGen — AI Music Generation on RunPod.
 * Generate royalty-free background music for videos.
 * Supports text prompts describing mood, genre, tempo, instruments.
 * Returns: WAV audio file (base64 or URL)
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
    duration = 15,    // seconds (max 30)
    model = "medium", // small | medium | large
    temperature = 1.0,
    top_k = 250,
    top_p = 0.0,
    cfg_coef = 3.0,   // classifier-free guidance strength
  } = body;

  if (!prompt) {
    return NextResponse.json({ error: "Music prompt required" }, { status: 400 });
  }

  const musicUrl = process.env.RUNPOD_MUSICGEN_URL;
  const runpodKey = process.env.RUNPOD_API_KEY;

  if (!musicUrl || !runpodKey) {
    return NextResponse.json({ error: "Music generator not configured" }, { status: 500 });
  }

  // Build descriptive prompt from simple input
  const enhancedPrompt = buildMusicPrompt(prompt, body.mood, body.genre, body.tempo);

  try {
    const res = await fetch(`${musicUrl}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${runpodKey}`,
      },
      body: JSON.stringify({
        input: {
          prompt: enhancedPrompt,
          duration: Math.min(Math.max(duration, 5), 30),
          model_name: `facebook/musicgen-${model}`,
          temperature,
          top_k,
          top_p,
          cfg_coef,
          output_format: "wav",
        },
      }),
    });

    const job = await res.json();

    if (job.status === "COMPLETED" && job.output) {
      return NextResponse.json({
        success: true,
        audio: job.output.audio_base64 || job.output.audio_url || job.output.result,
        duration: job.output.duration || duration,
        prompt: enhancedPrompt,
      });
    }

    if (job.id) {
      return NextResponse.json({
        success: true,
        job_id: job.id,
        status: job.status || "IN_QUEUE",
        status_url: `/api/ai/music-gen?job_id=${job.id}`,
      });
    }

    return NextResponse.json({ error: "Music generation failed" }, { status: 500 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
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
  };

  if (mood && moodMap[mood]) parts.push(moodMap[mood]);
  if (genre && genreMap[genre]) parts.push(genreMap[genre]);
  if (tempo) parts.push(`${tempo} BPM tempo`);

  parts.push("high quality, professional mix, broadcast ready");
  return parts.join(", ");
}

// GET — Poll job status
export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("job_id");
  if (!jobId) return NextResponse.json({ error: "job_id required" }, { status: 400 });

  const musicUrl = process.env.RUNPOD_MUSICGEN_URL;
  const runpodKey = process.env.RUNPOD_API_KEY;
  if (!musicUrl || !runpodKey) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(`${musicUrl}/status/${jobId}`, {
      headers: { Authorization: `Bearer ${runpodKey}` },
    });
    const data = await res.json();

    if (data.status === "COMPLETED" && data.output) {
      return NextResponse.json({
        status: "completed",
        audio: data.output.audio_base64 || data.output.audio_url || data.output.result,
        duration: data.output.duration || null,
      });
    }

    return NextResponse.json({ status: data.status?.toLowerCase() || "processing" });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
