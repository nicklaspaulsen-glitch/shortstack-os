import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import { getMaxReferenceFile } from "@/lib/plan-config";

/**
 * Whisper Speech-to-Text — transcribe audio/video files to text.
 * Uses self-hosted Whisper Large V3 on RunPod serverless.
 * Supports: mp3, wav, mp4, webm, m4a, ogg, flac
 * Returns: timestamped transcript segments + full text
 */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("plan_tier").eq("id", user.id).single();
  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const audioUrl = formData.get("audio_url") as string | null;
  const language = (formData.get("language") as string) || "auto";
  const task = (formData.get("task") as string) || "transcribe"; // transcribe | translate

  if (!file && !audioUrl) {
    return NextResponse.json({ error: "Provide a file or audio_url" }, { status: 400 });
  }

  const whisperUrl = process.env.RUNPOD_WHISPER_URL;
  const runpodKey = process.env.RUNPOD_API_KEY;

  if (!whisperUrl || !runpodKey) {
    return NextResponse.json({ error: "Whisper not configured" }, { status: 500 });
  }

  try {
    let audioBase64: string | null = null;
    const sourceUrl: string | null = audioUrl;

    // Convert file to base64 if uploaded directly
    if (file) {
      const maxSize = getMaxReferenceFile(profile?.plan_tier);
      if (maxSize !== -1 && file.size > maxSize) {
        return NextResponse.json({ error: "File too large for your plan" }, { status: 413 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      audioBase64 = buffer.toString("base64");
    }

    const res = await fetch(`${whisperUrl}/runsync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${runpodKey}`,
      },
      body: JSON.stringify({
        input: {
          ...(audioBase64 ? { audio_base64: audioBase64 } : { audio_url: sourceUrl }),
          model: "large-v3",
          language: language === "auto" ? null : language,
          task,
          word_timestamps: true,
          return_timestamps: true,
        },
      }),
    });

    const job = await res.json();

    if (job.status === "COMPLETED" && job.output) {
      const output = job.output;
      return NextResponse.json({
        success: true,
        text: output.text || output.transcription || "",
        segments: output.segments || [],
        language: output.language || language,
        duration: output.duration || null,
      });
    }

    // Async job — return ID for polling
    if (job.id) {
      return NextResponse.json({
        success: true,
        job_id: job.id,
        status: job.status || "IN_QUEUE",
        status_url: `/api/ai/transcribe?job_id=${job.id}`,
      });
    }

    return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// GET — Poll job status
export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("job_id");
  if (!jobId) return NextResponse.json({ error: "job_id required" }, { status: 400 });

  const whisperUrl = process.env.RUNPOD_WHISPER_URL;
  const runpodKey = process.env.RUNPOD_API_KEY;
  if (!whisperUrl || !runpodKey) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(`${whisperUrl}/status/${jobId}`, {
      headers: { Authorization: `Bearer ${runpodKey}` },
    });
    const data = await res.json();

    if (data.status === "COMPLETED" && data.output) {
      return NextResponse.json({
        status: "completed",
        text: data.output.text || data.output.transcription || "",
        segments: data.output.segments || [],
        language: data.output.language || null,
        duration: data.output.duration || null,
      });
    }

    return NextResponse.json({
      status: data.status?.toLowerCase() || "processing",
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
