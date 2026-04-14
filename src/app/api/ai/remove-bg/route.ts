import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import { getMaxReferenceFile } from "@/lib/plan-config";

/**
 * Background Removal — REMBG / Segment Anything (SAM) on RunPod.
 * One-click transparent background for product shots, portraits, etc.
 * Returns: PNG with alpha channel
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
  const model = (formData.get("model") as string) || "u2net"; // u2net | isnet-general | sam
  const returnFormat = (formData.get("format") as string) || "png"; // png | webp
  const bgColor = formData.get("bg_color") as string | null; // null = transparent, or hex like "#ffffff"

  if (!file && !imageUrl) {
    return NextResponse.json({ error: "Provide a file or image_url" }, { status: 400 });
  }

  const rembgUrl = process.env.RUNPOD_REMBG_URL;
  const runpodKey = process.env.RUNPOD_API_KEY;

  if (!rembgUrl || !runpodKey) {
    return NextResponse.json({ error: "Background removal not configured" }, { status: 500 });
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

    const res = await fetch(`${rembgUrl}/runsync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${runpodKey}`,
      },
      body: JSON.stringify({
        input: {
          ...(imageBase64 ? { image_base64: imageBase64 } : { image_url: imageUrl }),
          model,
          return_format: returnFormat,
          bg_color: bgColor,
          alpha_matting: true,
          alpha_matting_foreground_threshold: 240,
          alpha_matting_background_threshold: 10,
        },
      }),
    });

    const job = await res.json();

    if (job.status === "COMPLETED" && job.output) {
      const output = job.output;
      return NextResponse.json({
        success: true,
        image: output.image_base64 || output.image || output.result,
        format: returnFormat,
      });
    }

    if (job.id) {
      return NextResponse.json({
        success: true,
        job_id: job.id,
        status: job.status || "IN_QUEUE",
        status_url: `/api/ai/remove-bg?job_id=${job.id}`,
      });
    }

    return NextResponse.json({ error: "Background removal failed" }, { status: 500 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// GET — Poll job status
export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("job_id");
  if (!jobId) return NextResponse.json({ error: "job_id required" }, { status: 400 });

  const rembgUrl = process.env.RUNPOD_REMBG_URL;
  const runpodKey = process.env.RUNPOD_API_KEY;
  if (!rembgUrl || !runpodKey) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(`${rembgUrl}/status/${jobId}`, {
      headers: { Authorization: `Bearer ${runpodKey}` },
    });
    const data = await res.json();

    if (data.status === "COMPLETED" && data.output) {
      return NextResponse.json({
        status: "completed",
        image: data.output.image_base64 || data.output.image || data.output.result,
      });
    }

    return NextResponse.json({ status: data.status?.toLowerCase() || "processing" });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
