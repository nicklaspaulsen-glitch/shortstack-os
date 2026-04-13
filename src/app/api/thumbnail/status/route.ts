import { NextRequest, NextResponse } from "next/server";

// GET — Poll RunPod job status (supports both FLUX/ComfyUI and SDXL response formats)
export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("job_id");

  if (!jobId) {
    return NextResponse.json(
      { error: "job_id is required" },
      { status: 400 }
    );
  }

  // Try FLUX endpoint first, then SDXL
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
