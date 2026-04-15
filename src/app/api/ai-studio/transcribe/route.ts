import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import { getMaxReferenceFile } from "@/lib/plan-config";

/**
 * AI Studio — Transcribe (Whisper Speech-to-Text)
 *
 * POST: Accept audio/video file or URL, transcribe via OpenAI Whisper or RunPod.
 * Falls back to OpenAI Whisper API if RunPod is not configured.
 * Returns timestamped transcript segments + full text.
 */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", user.id)
    .single();

  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const audioUrl = formData.get("audio_url") as string | null;
  const language = (formData.get("language") as string) || "auto";
  const task = (formData.get("task") as string) || "transcribe";

  if (!file && !audioUrl) {
    return NextResponse.json({ error: "Provide a file or audio_url" }, { status: 400 });
  }

  // ── Strategy 1: RunPod Whisper (self-hosted) ──────────────────
  const whisperUrl = process.env.RUNPOD_WHISPER_URL;
  const runpodKey = process.env.RUNPOD_API_KEY;

  if (whisperUrl && runpodKey) {
    try {
      let audioBase64: string | null = null;
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
            ...(audioBase64 ? { audio_base64: audioBase64 } : { audio_url: audioUrl }),
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
        return NextResponse.json({
          success: true,
          text: job.output.text || job.output.transcription || "",
          segments: job.output.segments || [],
          language: job.output.language || language,
          duration: job.output.duration || null,
        });
      }

      if (job.id) {
        return NextResponse.json({
          success: true,
          job_id: job.id,
          status: job.status || "IN_QUEUE",
          poll_url: `/api/ai-studio/transcribe?job_id=${job.id}`,
        });
      }

      return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  // ── Strategy 2: OpenAI Whisper API ────────────────────────────
  const openaiKey = process.env.OPENAI_API_KEY;

  if (openaiKey && file) {
    try {
      const maxSize = getMaxReferenceFile(profile?.plan_tier);
      if (maxSize !== -1 && file.size > maxSize) {
        return NextResponse.json({ error: "File too large for your plan" }, { status: 413 });
      }

      const fd = new FormData();
      fd.append("file", file);
      fd.append("model", "whisper-1");
      fd.append("response_format", "verbose_json");
      fd.append("timestamp_granularities[]", "segment");
      if (language !== "auto") fd.append("language", language);

      const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: fd,
      });

      const data = await res.json();

      if (data.text) {
        return NextResponse.json({
          success: true,
          text: data.text,
          segments: (data.segments || []).map((s: { start: number; end: number; text: string }) => ({
            start: s.start,
            end: s.end,
            text: s.text,
          })),
          language: data.language || language,
          duration: data.duration || null,
        });
      }

      return NextResponse.json({ error: data.error?.message || "Transcription failed" }, { status: 500 });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  // ── No provider configured ────────────────────────────────────
  return NextResponse.json({
    error: "setup_required",
    message: "Configure RUNPOD_API_KEY + RUNPOD_WHISPER_URL or OPENAI_API_KEY in settings to use Transcribe.",
  }, { status: 501 });
}

/** GET — Poll RunPod job status */
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
