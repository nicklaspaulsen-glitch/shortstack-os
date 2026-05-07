import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Poll job status for async video generation (Mochi/RunPod or fal.ai)
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobId = request.nextUrl.searchParams.get("job_id");
  if (!jobId) return NextResponse.json({ error: "job_id required" }, { status: 400 });

  const source = request.nextUrl.searchParams.get("source"); // "fal" | null (RunPod default)

  // fal.ai async job polling
  if (source === "fal") {
    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 500 });
    }
    const falModel = request.nextUrl.searchParams.get("fal_model") || "fal-ai/ltx-video";

    const res = await fetch(
      `https://queue.fal.run/${falModel}/requests/${jobId}/status?logs=0`,
      { headers: { Authorization: `Key ${falKey}` } }
    );
    if (!res.ok) {
      return NextResponse.json(
        { error: `fal.ai status HTTP ${res.status}` },
        { status: 502 }
      );
    }
    const job = (await res.json()) as {
      status?: string;
      output?: { video?: { url?: string }; url?: string };
      error?: string;
    };

    let url: string | null = null;
    if (job.status === "COMPLETED" && job.output) {
      url = job.output.video?.url || job.output.url || null;
    }

    return NextResponse.json({
      job_id: jobId,
      source: "fal",
      fal_model: falModel,
      status: job.status ?? "UNKNOWN",
      url,
      error: job.error || null,
    });
  }

  // RunPod/Mochi polling (default)
  const videoUrl = process.env.HIGGSFIELD_URL;
  const runpodKey = process.env.RUNPOD_API_KEY;
  if (!videoUrl || !runpodKey) {
    return NextResponse.json({ error: "Video generation endpoint not configured" }, { status: 500 });
  }

  const res = await fetch(`${videoUrl}/status/${jobId}`, {
    headers: { Authorization: `Bearer ${runpodKey}` },
  });
  const job = await res.json();

  // Mochi output format: { result: "upload_url" } or { video_url: "..." }
  let videoResultUrl: string | null = null;
  if (job.status === "COMPLETED" && job.output) {
    videoResultUrl = job.output.result || job.output.video_url || job.output.url || null;
  }

  return NextResponse.json({
    job_id: jobId,
    source: "mochi",
    status: job.status,
    url: videoResultUrl,
    error: job.error || null,
    executionTime: job.executionTime || null,
  });
}
