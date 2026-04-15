import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import { getMaxReferenceFile } from "@/lib/plan-config";

/**
 * AI Studio — Remove Background
 *
 * POST: Accept image file or URL, remove background via RunPod REMBG,
 * Replicate, or remove.bg API.
 * Returns PNG with alpha channel.
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
  const model = (formData.get("model") as string) || "u2net";
  const returnFormat = (formData.get("format") as string) || "png";
  const bgColor = formData.get("bg_color") as string | null;

  if (!file && !imageUrl) {
    return NextResponse.json({ error: "Provide a file or image_url" }, { status: 400 });
  }

  // ── Strategy 1: RunPod REMBG (self-hosted) ────────────────────
  const rembgUrl = process.env.RUNPOD_REMBG_URL;
  const runpodKey = process.env.RUNPOD_API_KEY;

  if (rembgUrl && runpodKey) {
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
        return NextResponse.json({
          success: true,
          image: job.output.image_base64 || job.output.image || job.output.result,
          format: returnFormat,
        });
      }

      if (job.id) {
        return NextResponse.json({
          success: true,
          job_id: job.id,
          status: job.status || "IN_QUEUE",
          poll_url: `/api/ai-studio/remove-bg?job_id=${job.id}`,
        });
      }

      return NextResponse.json({ error: "Background removal failed" }, { status: 500 });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  // ── Strategy 2: Replicate (cjwbw/rembg) ──────────────────────
  const replicateToken = process.env.REPLICATE_API_TOKEN;

  if (replicateToken) {
    try {
      let inputPayload: Record<string, unknown> = {};

      if (file) {
        const maxSize = getMaxReferenceFile(profile?.plan_tier);
        if (maxSize !== -1 && file.size > maxSize) {
          return NextResponse.json({ error: "File too large for your plan" }, { status: 413 });
        }
        const buffer = Buffer.from(await file.arrayBuffer());
        const base64 = buffer.toString("base64");
        const mime = file.type || "image/png";
        inputPayload = { image: `data:${mime};base64,${base64}` };
      } else {
        inputPayload = { image: imageUrl };
      }

      const res = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${replicateToken}`,
          "Content-Type": "application/json",
          Prefer: "wait",
        },
        body: JSON.stringify({
          version: "fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003",
          input: inputPayload,
        }),
      });

      const prediction = await res.json();

      if (prediction.status === "succeeded" && prediction.output) {
        return NextResponse.json({
          success: true,
          image: prediction.output,
          format: "png",
        });
      }

      if (prediction.id) {
        return NextResponse.json({
          success: true,
          job_id: prediction.id,
          status: prediction.status || "processing",
          poll_url: `/api/ai-studio/remove-bg?job_id=${prediction.id}`,
        });
      }

      return NextResponse.json({
        error: prediction.error || "Background removal failed",
      }, { status: 500 });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  // ── Strategy 3: remove.bg API ─────────────────────────────────
  const removeBgKey = process.env.REMOVE_BG_API_KEY;

  if (removeBgKey && (file || imageUrl)) {
    try {
      const fd = new FormData();
      if (file) {
        fd.append("image_file", file);
      } else if (imageUrl) {
        fd.append("image_url", imageUrl);
      }
      fd.append("size", "auto");
      if (bgColor) fd.append("bg_color", bgColor.replace("#", ""));

      const res = await fetch("https://api.remove.bg/v1.0/removebg", {
        method: "POST",
        headers: { "X-Api-Key": removeBgKey },
        body: fd,
      });

      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        const base64 = buffer.toString("base64");
        return NextResponse.json({
          success: true,
          image: base64,
          format: "png",
        });
      }

      const err = await res.json().catch(() => ({ errors: [{ title: "Unknown error" }] }));
      return NextResponse.json({
        error: err.errors?.[0]?.title || "Background removal failed",
      }, { status: 500 });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  // ── No provider configured ────────────────────────────────────
  return NextResponse.json({
    error: "setup_required",
    message: "Configure RUNPOD_API_KEY + RUNPOD_REMBG_URL, REPLICATE_API_TOKEN, or REMOVE_BG_API_KEY in settings to use Remove BG.",
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
