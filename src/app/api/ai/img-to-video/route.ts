import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import { getMaxReferenceFile } from "@/lib/plan-config";

/**
 * Stable Video Diffusion (SVD) — Image-to-Video on RunPod.
 * Animates a still image into a short video clip (2-5 seconds).
 * Perfect for: product showcases, logo animations, hero sections, social content.
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
  const imageUrl = formData.get("image_url") as string | null;
  const motionBucket = parseInt(formData.get("motion_bucket") as string) || 127; // 1-255, higher = more motion
  const fps = parseInt(formData.get("fps") as string) || 6;
  const numFrames = parseInt(formData.get("num_frames") as string) || 25; // 14-25
  const decodeChunkSize = parseInt(formData.get("decode_chunk_size") as string) || 8;
  const noiseAugStrength = parseFloat(formData.get("noise_aug_strength") as string) || 0.02;

  if (!file && !imageUrl) {
    return NextResponse.json({ error: "Provide an image file or image_url" }, { status: 400 });
  }

  const svdUrl = process.env.RUNPOD_SVD_URL;
  const runpodKey = process.env.RUNPOD_API_KEY;

  if (!svdUrl || !runpodKey) {
    return NextResponse.json({ error: "Image-to-video not configured" }, { status: 500 });
  }

  try {
    let imageBase64: string | null = null;

    if (file) {
      const maxSize = getMaxReferenceFile(profile?.plan_tier);
      if (maxSize !== -1 && file.size > maxSize) {
        return NextResponse.json({ error: "File too large for your plan" }, { status: 413 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      imageBase64 = buffer.toString("base64");
    }

    const res = await fetch(`${svdUrl}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${runpodKey}`,
      },
      body: JSON.stringify({
        input: {
          ...(imageBase64 ? { image_base64: imageBase64 } : { image_url: imageUrl }),
          motion_bucket_id: Math.min(Math.max(motionBucket, 1), 255),
          fps,
          num_frames: Math.min(Math.max(numFrames, 14), 25),
          decode_chunk_size: decodeChunkSize,
          noise_aug_strength: noiseAugStrength,
          seed: Math.floor(Math.random() * 2147483647),
        },
      }),
    });

    const job = await res.json();

    if (job.status === "COMPLETED" && job.output) {
      const output = job.output;
      return NextResponse.json({
        success: true,
        video: output.video_base64 || output.video_url || output.result,
        frames: output.num_frames || numFrames,
        fps,
      });
    }

    if (job.id) {
      return NextResponse.json({
        success: true,
        job_id: job.id,
        status: job.status || "IN_QUEUE",
        status_url: `/api/ai/img-to-video?job_id=${job.id}`,
      });
    }

    return NextResponse.json({ error: "Video generation failed" }, { status: 500 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// GET — Poll job status
export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("job_id");
  if (!jobId) return NextResponse.json({ error: "job_id required" }, { status: 400 });

  const svdUrl = process.env.RUNPOD_SVD_URL;
  const runpodKey = process.env.RUNPOD_API_KEY;
  if (!svdUrl || !runpodKey) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(`${svdUrl}/status/${jobId}`, {
      headers: { Authorization: `Bearer ${runpodKey}` },
    });
    const data = await res.json();

    if (data.status === "COMPLETED" && data.output) {
      return NextResponse.json({
        status: "completed",
        video: data.output.video_base64 || data.output.video_url || data.output.result,
      });
    }

    return NextResponse.json({ status: data.status?.toLowerCase() || "processing" });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
