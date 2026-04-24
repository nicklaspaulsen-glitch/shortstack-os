import { NextRequest, NextResponse } from "next/server";

// AI upscale — pushes the current canvas (or a selection) through the
// RunPod ESRGAN / upscale worker. Falls back to a CSS-scaled placeholder
// in dev so the UI flow can be dogfooded without infrastructure.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AIUpscaleBody {
  imageBase64: string;
  factor?: 2 | 4;
}

export async function POST(req: NextRequest) {
  if (process.env.FEATURE_AI_UPSCALE === "false") {
    return NextResponse.json(
      { error: "AI upscale is disabled by feature flag." },
      { status: 503 },
    );
  }

  let body: AIUpscaleBody;
  try {
    body = (await req.json()) as AIUpscaleBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.imageBase64) {
    return NextResponse.json(
      { error: "imageBase64 is required" },
      { status: 400 },
    );
  }

  const factor = body.factor === 4 ? 4 : 2;
  const fluxUrl = process.env.RUNPOD_FLUX_URL;
  const fluxSecret = process.env.RUNPOD_FLUX_SECRET || process.env.RUNPOD_API_KEY;

  if (!fluxUrl || !fluxSecret) {
    return NextResponse.json(
      {
        status: "accepted",
        placeholder: true,
        factor,
        message:
          "RunPod worker not configured — client can do a CSS-scale placeholder.",
      },
      { status: 202 },
    );
  }

  try {
    const response = await fetch(`${fluxUrl}/runsync`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${fluxSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          mode: "upscale",
          image: body.imageBase64,
          factor,
        },
      }),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return NextResponse.json(
        {
          error: `Upscale failed (${response.status})`,
          detail: text.slice(0, 400),
        },
        { status: 502 },
      );
    }
    const payload = (await response.json()) as {
      output?: { images?: string[] };
      error?: string;
    };
    if (payload.error) {
      return NextResponse.json({ error: payload.error }, { status: 502 });
    }
    const img = payload.output?.images?.[0];
    if (!img) {
      return NextResponse.json(
        { error: "Worker returned no images" },
        { status: 502 },
      );
    }
    return NextResponse.json({
      status: "ok",
      factor,
      image: img.startsWith("data:") ? img : `data:image/png;base64,${img}`,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Upscale call threw",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}
