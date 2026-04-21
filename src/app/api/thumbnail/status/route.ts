import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// GET — Poll thumbnail job status.
// Supports:
//   ?job_id=X                       (RunPod FLUX/SDXL, default)
//   ?job_id=X&provider=replicate    (Replicate prediction)
//
// SECURITY: requires auth + cross-checks that the job_id belongs to a
// generated_images row owned by the caller. (bug-hunt-apr20-v2 MEDIUM #5 —
// previously anyone who knew a job id could retrieve another tenant's
// thumbnail output.)
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobId = request.nextUrl.searchParams.get("job_id");
  const provider = request.nextUrl.searchParams.get("provider");

  if (!jobId) {
    return NextResponse.json(
      { error: "job_id is required" },
      { status: 400 }
    );
  }

  // Only allow polling job ids that belong to the caller (or their agency
  // if they're a team_member). The row is created synchronously by the
  // generation endpoint before the job is queued, so this should always
  // exist by the time the client polls.
  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;
  const service = createServiceClient();
  const { data: owned } = await service
    .from("generated_images")
    .select("id, profile_id")
    .eq("job_id", jobId)
    .eq("profile_id", ownerId)
    .maybeSingle();
  if (!owned) {
    return NextResponse.json({ error: "Forbidden — not your job" }, { status: 403 });
  }

  // ── Replicate path ────────────────────────────────────────────────
  if (provider === "replicate") {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return NextResponse.json({ error: "REPLICATE_API_TOKEN not set" }, { status: 503 });
    }
    try {
      const res = await fetch(`https://api.replicate.com/v1/predictions/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        return NextResponse.json({ error: `Replicate returned ${res.status}` }, { status: res.status });
      }
      const data = (await res.json()) as {
        id: string;
        status: string;
        output?: unknown;
        error?: string;
      };

      let imageUrl: string | null = null;
      if (data.status === "succeeded" && data.output) {
        if (typeof data.output === "string") imageUrl = data.output;
        else if (Array.isArray(data.output) && typeof data.output[0] === "string") {
          imageUrl = data.output[0];
        } else if (typeof data.output === "object") {
          const first = Object.values(data.output as Record<string, unknown>).find(
            (v): v is string => typeof v === "string",
          );
          imageUrl = first ?? null;
        }
      }

      // Normalize to the same shape as the RunPod path.
      const normalized =
        data.status === "succeeded"
          ? "COMPLETED"
          : data.status === "failed" || data.status === "canceled"
            ? "FAILED"
            : "IN_PROGRESS";

      return NextResponse.json({
        job_id: jobId,
        status: normalized,
        imageUrl,
        executionTime: null,
        error: data.error || null,
      });
    } catch (err) {
      console.error("Replicate status check error:", err);
      return NextResponse.json({ error: "Failed to check Replicate status" }, { status: 500 });
    }
  }

  // ── RunPod path (FLUX first, SDXL fallback) ──────────────────────
  const fluxUrl = process.env.RUNPOD_FLUX_URL;
  const sdxlUrl = process.env.RUNPOD_SDXL_URL;
  const runpodKey = process.env.RUNPOD_API_KEY;
  const endpointUrl = fluxUrl || sdxlUrl;

  if (!endpointUrl || !runpodKey) {
    return NextResponse.json(
      { error: "Image generation service not configured" },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(`${endpointUrl}/status/${jobId}`, {
      headers: {
        Authorization: `Bearer ${runpodKey}`,
      },
    });

    if (!res.ok) {
      // If FLUX endpoint fails, try SDXL as fallback
      if (fluxUrl && sdxlUrl && endpointUrl === fluxUrl) {
        const fallbackRes = await fetch(`${sdxlUrl}/status/${jobId}`, {
          headers: { Authorization: `Bearer ${runpodKey}` },
        });
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          return handleResponse(jobId, fallbackData);
        }
      }
      return NextResponse.json(
        { error: `RunPod returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return handleResponse(jobId, data);
  } catch (err) {
    console.error("Thumbnail status check error:", err);
    return NextResponse.json(
      { error: "Failed to check job status" },
      { status: 500 }
    );
  }
}

function handleResponse(jobId: string, data: Record<string, unknown>) {
  let imageUrl: string | null = null;
  const output = data.output as Record<string, unknown> | string | null;

  if (data.status === "COMPLETED" && output) {
    if (typeof output === "string") {
      // Direct base64 string
      imageUrl = output;
    } else if (typeof output === "object") {
      // ComfyUI/FLUX format: { message: "data:image/png;base64,..." }
      if (typeof output.message === "string" && (output.message as string).startsWith("data:image")) {
        imageUrl = output.message as string;
      }
      // SDXL format: { image_url: "base64..." }
      else if (output.image_url) {
        imageUrl = output.image_url as string;
      }
      // SDXL format: { images: ["base64..."] }
      else if (Array.isArray(output.images) && output.images.length > 0) {
        imageUrl = output.images[0] as string;
      }
    }
  }

  return NextResponse.json({
    job_id: jobId,
    status: data.status as string,
    imageUrl,
    executionTime: (data.executionTime as number) || null,
    error: (data.error as string) || null,
  });
}
