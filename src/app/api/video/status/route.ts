import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Poll job status for async video generation (Mochi/RunPod, fal.ai, or Higgsfield)
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Accept both "job_id" (legacy) and "id" (sent by render route for Higgsfield/fal)
  const jobId = request.nextUrl.searchParams.get("job_id") ?? request.nextUrl.searchParams.get("id");
  if (!jobId) return NextResponse.json({ error: "job_id or id required" }, { status: 400 });

  // Accept both "source" (legacy fal path) and "provider" (new routing param)
  const source = request.nextUrl.searchParams.get("source");
  const provider = request.nextUrl.searchParams.get("provider");

  // ── Higgsfield Creative AI polling ──
  // render route sends: ?provider=higgsfield&id=<render_id>
  if (provider === "higgsfield") {
    const higgsKey = process.env.HIGGSFIELD_API_KEY;
    if (!higgsKey) {
      return NextResponse.json({ error: "HIGGSFIELD_API_KEY not configured" }, { status: 500 });
    }

    try {
      const res = await fetch(`https://api.higgsfield.ai/v1/render/${jobId}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${higgsKey}`,
        },
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "(no body)");
        return NextResponse.json(
          { error: `Higgsfield status HTTP ${res.status}: ${errText.slice(0, 120)}` },
          { status: 502 },
        );
      }
      const job = (await res.json()) as {
        id?: string;
        render_id?: string;
        status?: string;
        url?: string;
        video_url?: string;
        error?: string;
      };

      const completedUrl = job.url ?? job.video_url ?? null;
      const normalizedStatus = job.status?.toLowerCase() ?? "processing";

      return NextResponse.json({
        job_id: jobId,
        source: "higgsfield",
        status: normalizedStatus === "completed" ? "completed" : normalizedStatus,
        url: normalizedStatus === "completed" ? completedUrl : null,
        error: job.error || null,
      });
    } catch (err) {
      return NextResponse.json(
        { error: `Higgsfield: ${"Internal server error"}` },
        { status: 500 },
      );
    }
  }

  // ── fal.ai async job polling ──
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

  // ── RunPod/Mochi polling (default) ──
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
