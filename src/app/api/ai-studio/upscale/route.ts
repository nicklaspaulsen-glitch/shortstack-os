import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import { getMaxReferenceFile } from "@/lib/plan-config";

/**
 * AI Studio — Image Upscale
 *
 * POST: Accept image file or URL, upscale via RunPod Real-ESRGAN or Replicate.
 * Returns high-resolution image (2x or 4x).
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
  const imageUrl = formData.get("image_url") as string | null;
  const scale = parseInt(formData.get("scale") as string) || 4;
  const faceEnhance = formData.get("face_enhance") === "true";
  const model = (formData.get("model") as string) || "realesrgan-x4plus";

  if (!file && !imageUrl) {
    return NextResponse.json({ error: "Provide a file or image_url" }, { status: 400 });
  }

  // ── Strategy 1: RunPod Real-ESRGAN (self-hosted) ──────────────
  const upscaleUrl = process.env.RUNPOD_UPSCALE_URL;
  const runpodKey = process.env.RUNPOD_API_KEY;

  if (upscaleUrl && runpodKey) {
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

      const res = await fetch(`${upscaleUrl}/runsync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${runpodKey}`,
        },
        body: JSON.stringify({
          input: {
            ...(imageBase64 ? { image_base64: imageBase64 } : { image_url: imageUrl }),
            scale: Math.min(scale, 4),
            model,
            face_enhance: faceEnhance,
          },
        }),
      });

      const job = await res.json();

      if (job.status === "COMPLETED" && job.output) {
        return NextResponse.json({
          success: true,
          image: job.output.image_base64 || job.output.image_url || job.output.result,
          original_size: job.output.original_size || null,
          upscaled_size: job.output.upscaled_size || null,
          scale,
        });
      }

      if (job.id) {
        return NextResponse.json({
          success: true,
          job_id: job.id,
          status: job.status || "IN_QUEUE",
          poll_url: `/api/ai-studio/upscale?job_id=${job.id}`,
        });
      }

      return NextResponse.json({ error: "Upscaling failed" }, { status: 500 });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  // ── Strategy 2: Replicate (nightmareai/real-esrgan) ───────────
  const replicateToken = process.env.REPLICATE_API_TOKEN;

  if (replicateToken) {
    try {
      let inputPayload: Record<string, unknown> = { scale };

      if (file) {
        const maxSize = getMaxReferenceFile(profile?.plan_tier);
        if (maxSize !== -1 && file.size > maxSize) {
          return NextResponse.json({ error: "File too large for your plan" }, { status: 413 });
        }
        const buffer = Buffer.from(await file.arrayBuffer());
        const base64 = buffer.toString("base64");
        const mime = file.type || "image/png";
        inputPayload = { ...inputPayload, image: `data:${mime};base64,${base64}` };
      } else {
        inputPayload = { ...inputPayload, image: imageUrl };
      }

      if (faceEnhance) {
        inputPayload.face_enhance = true;
      }

      const res = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${replicateToken}`,
          "Content-Type": "application/json",
          Prefer: "wait",
        },
        body: JSON.stringify({
          version: "f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa",
          input: inputPayload,
        }),
      });

      const prediction = await res.json();

      if (prediction.status === "succeeded" && prediction.output) {
        return NextResponse.json({
          success: true,
          image: prediction.output,
          scale,
        });
      }

      if (prediction.id) {
        return NextResponse.json({
          success: true,
          job_id: prediction.id,
          status: prediction.status || "processing",
          poll_url: `/api/ai-studio/upscale?job_id=${prediction.id}`,
        });
      }

      return NextResponse.json({
        error: prediction.error || "Upscaling failed",
      }, { status: 500 });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  // ── No provider configured ────────────────────────────────────
  return NextResponse.json({
    error: "setup_required",
    message: "Configure RUNPOD_API_KEY + RUNPOD_UPSCALE_URL or REPLICATE_API_TOKEN in settings to use Upscale.",
  }, { status: 501 });
}

/** GET — Poll job status */
export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("job_id");
  if (!jobId) return NextResponse.json({ error: "job_id required" }, { status: 400 });

  // Check Replicate first
  const replicateToken = process.env.REPLICATE_API_TOKEN;
  if (replicateToken) {
    try {
      const res = await fetch(`https://api.replicate.com/v1/predictions/${jobId}`, {
        headers: { Authorization: `Bearer ${replicateToken}` },
      });
      const data = await res.json();

      if (data.status === "succeeded") {
        return NextResponse.json({ status: "completed", image: data.output });
      }
      if (data.status === "failed") {
        return NextResponse.json({ status: "failed", error: data.error });
      }
      return NextResponse.json({ status: data.status || "processing" });
    } catch { /* fall through to RunPod */ }
  }

  // Check RunPod
  const upscaleUrl = process.env.RUNPOD_UPSCALE_URL;
  const runpodKey = process.env.RUNPOD_API_KEY;
  if (!upscaleUrl || !runpodKey) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(`${upscaleUrl}/status/${jobId}`, {
      headers: { Authorization: `Bearer ${runpodKey}` },
    });
    const data = await res.json();

    if (data.status === "COMPLETED" && data.output) {
      return NextResponse.json({
        status: "completed",
        image: data.output.image_base64 || data.output.image_url || data.output.result,
        original_size: data.output.original_size || null,
        upscaled_size: data.output.upscaled_size || null,
      });
    }

    return NextResponse.json({ status: data.status?.toLowerCase() || "processing" });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
