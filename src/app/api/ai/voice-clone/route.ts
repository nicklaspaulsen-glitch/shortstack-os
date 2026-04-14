import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";

/**
 * Voice Clone + TTS — Coqui XTTS v2 on RunPod.
 * Clone a voice from 6+ seconds of audio, then generate speech in that voice.
 * Two modes:
 *   1. clone — Upload reference audio to create a voice profile
 *   2. speak — Use a cloned voice (or preset) to speak text
 */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = checkAiRateLimit(user.id);
  if (limited) return limited;

  const formData = await request.formData();
  const mode = (formData.get("mode") as string) || "speak"; // clone | speak
  const text = formData.get("text") as string | null;
  const voiceFile = formData.get("voice_file") as File | null;
  const voiceUrl = formData.get("voice_url") as string | null;
  const voiceId = formData.get("voice_id") as string | null; // previously saved voice
  const language = (formData.get("language") as string) || "en";
  const speed = parseFloat(formData.get("speed") as string) || 1.0;

  const xttsUrl = process.env.RUNPOD_XTTS_URL;
  const runpodKey = process.env.RUNPOD_API_KEY;

  if (!xttsUrl || !runpodKey) {
    return NextResponse.json({ error: "Voice clone not configured" }, { status: 500 });
  }

  try {
    // MODE: Clone — save reference audio as voice profile
    if (mode === "clone") {
      if (!voiceFile && !voiceUrl) {
        return NextResponse.json({ error: "Provide voice_file (6+ sec audio) or voice_url" }, { status: 400 });
      }

      let audioBase64: string | null = null;
      if (voiceFile) {
        if (voiceFile.size > 25 * 1024 * 1024) {
          return NextResponse.json({ error: "Audio too large (max 25MB)" }, { status: 413 });
        }
        const buffer = Buffer.from(await voiceFile.arrayBuffer());
        audioBase64 = buffer.toString("base64");
      }

      // Extract speaker embedding via XTTS
      const res = await fetch(`${xttsUrl}/runsync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${runpodKey}`,
        },
        body: JSON.stringify({
          input: {
            task: "extract_embedding",
            ...(audioBase64 ? { audio_base64: audioBase64 } : { audio_url: voiceUrl }),
          },
        }),
      });

      const job = await res.json();

      if (job.status === "COMPLETED" && job.output) {
        // Save voice profile to Supabase
        const { data: savedVoice, error: saveError } = await supabase
          .from("voice_profiles")
          .insert({
            user_id: user.id,
            name: (formData.get("voice_name") as string) || "Custom Voice",
            embedding: job.output.embedding || job.output.speaker_embedding,
            sample_duration: job.output.duration || null,
          })
          .select("id, name")
          .single();

        if (saveError) {
          return NextResponse.json({
            success: true,
            voice_id: "temp",
            embedding: job.output.embedding || job.output.speaker_embedding,
            message: "Voice cloned (save to DB failed, use embedding directly)",
          });
        }

        return NextResponse.json({
          success: true,
          voice_id: savedVoice?.id,
          voice_name: savedVoice?.name,
          message: "Voice cloned and saved successfully",
        });
      }

      return NextResponse.json({ error: "Voice cloning failed" }, { status: 500 });
    }

    // MODE: Speak — generate speech from text using cloned voice
    if (!text) {
      return NextResponse.json({ error: "Text required for speech generation" }, { status: 400 });
    }

    if (text.length > 5000) {
      return NextResponse.json({ error: "Text too long (max 5000 chars)" }, { status: 400 });
    }

    // Get voice embedding from saved profile or reference audio
    let speakerEmbedding: unknown = null;
    let referenceAudio: string | null = null;

    if (voiceId && voiceId !== "temp") {
      const { data: voice } = await supabase
        .from("voice_profiles")
        .select("embedding")
        .eq("id", voiceId)
        .eq("user_id", user.id)
        .single();
      speakerEmbedding = voice?.embedding;
    } else if (voiceFile) {
      const buffer = Buffer.from(await voiceFile.arrayBuffer());
      referenceAudio = buffer.toString("base64");
    } else if (voiceUrl) {
      referenceAudio = voiceUrl;
    }

    const res = await fetch(`${xttsUrl}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${runpodKey}`,
      },
      body: JSON.stringify({
        input: {
          task: "tts",
          text,
          language,
          speed,
          ...(speakerEmbedding ? { speaker_embedding: speakerEmbedding } : {}),
          ...(referenceAudio ? {
            ...(typeof referenceAudio === "string" && referenceAudio.startsWith("http")
              ? { reference_audio_url: referenceAudio }
              : { reference_audio_base64: referenceAudio }),
          } : {}),
        },
      }),
    });

    const job = await res.json();

    if (job.status === "COMPLETED" && job.output) {
      return NextResponse.json({
        success: true,
        audio: job.output.audio_base64 || job.output.audio_url || job.output.result,
        duration: job.output.duration || null,
      });
    }

    if (job.id) {
      return NextResponse.json({
        success: true,
        job_id: job.id,
        status: job.status || "IN_QUEUE",
        status_url: `/api/ai/voice-clone?job_id=${job.id}`,
      });
    }

    return NextResponse.json({ error: "Speech generation failed" }, { status: 500 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// GET — Poll job status or list saved voices
export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("job_id");
  const listVoices = request.nextUrl.searchParams.get("list") === "true";

  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // List saved voices
  if (listVoices) {
    const { data: voices } = await supabase
      .from("voice_profiles")
      .select("id, name, created_at, sample_duration")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    return NextResponse.json({ voices: voices || [] });
  }

  // Poll job
  if (!jobId) return NextResponse.json({ error: "job_id or list=true required" }, { status: 400 });

  const xttsUrl = process.env.RUNPOD_XTTS_URL;
  const runpodKey = process.env.RUNPOD_API_KEY;
  if (!xttsUrl || !runpodKey) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(`${xttsUrl}/status/${jobId}`, {
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
