import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Poll RunPod job status for async video generation (Mochi / Higgsfield)
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobId = request.nextUrl.searchParams.get("job_id");
  if (!jobId) return NextResponse.json({ error: "job_id required" }, { status: 400 });

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
    status: job.status,
    url: videoResultUrl,
    error: job.error || null,
    executionTime: job.executionTime || null,
  });
}
