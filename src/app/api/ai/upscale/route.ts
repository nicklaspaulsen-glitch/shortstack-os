import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import { getMaxReferenceFile } from "@/lib/plan-config";

/**
 * Real-ESRGAN Image Upscaler — 2x/4x AI upscaling on RunPod.
 * Takes low-res client assets → print-quality output.
 * Supports: jpg, png, webp
 * Models: realesrgan-x4plus (photos), realesrgan-x4plus-anime (illustrations)
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
  const scale = parseInt(formData.get("scale") as string) || 4; // 2 or 4
  const model = (formData.get("model") as string) || "realesrgan-x4plus";
  const faceEnhance = formData.get("face_enhance") === "true";

  if (!file && !imageUrl) {
    return NextResponse.json({ error: "Provide a file or image_url" }, { status: 400 });
  }

  const upscaleUrl = process.env.RUNPOD_UPSCALE_URL;
  const runpodKey = process.env.RUNPOD_API_KEY;

  if (!upscaleUrl || !runpodKey) {
    return NextResponse.json({ error: "Upscaler not configured" }, { status: 500 });
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
          face_enhance: faceEnhance, // GFPGAN face restoration
        },
      }),
    });

    const job = await res.json();

    if (job.status === "COMPLETED" && job.output) {
      const output = job.output;
      const resultImage = output.image_base64 || output.image_url || output.result;
      return NextResponse.json({
        success: true,
        image: resultImage,
        original_size: output.original_size || null,
        upscaled_size: output.upscaled_size || null,
        scale,
      });
    }

    if (job.id) {
      return NextResponse.json({
        success: true,
        job_id: job.id,
        status: job.status || "IN_QUEUE",
        status_url: `/api/ai/upscale?job_id=${job.id}`,
      });
    }

    return NextResponse.json({ error: "Upscaling failed" }, { status: 500 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// GET — Poll job status
export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("job_id");
  if (!jobId) return NextResponse.json({ error: "job_id required" }, { status: 400 });

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
