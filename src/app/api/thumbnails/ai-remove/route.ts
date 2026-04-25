import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// AI erase (background / object removal). Functionally identical to
// ai-fill but sends an "erase" prompt so the worker inpaints with a
// context-aware fill instead of re-generating to prompt text. Kept
// as a separate route so the UI and the billing layer can tell them
// apart. Requires Supabase session — see ai-fill route for rationale.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AIRemoveBody {
  imageBase64?: string;
  maskBase64?: string; // white = remove, black = keep
  width: number;
  height: number;
  selection: { x: number; y: number; width: number; height: number };
}

export async function POST(req: NextRequest) {
  if (process.env.FEATURE_AI_FILL === "false") {
    return NextResponse.json(
      { error: "AI erase is disabled by feature flag." },
      { status: 503 },
    );
  }

  // Auth gate — burns RunPod credits per call.
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: AIRemoveBody;
  try {
    body = (await req.json()) as AIRemoveBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const fluxUrl = process.env.RUNPOD_FLUX_URL;
  const fluxSecret = process.env.RUNPOD_FLUX_SECRET || process.env.RUNPOD_API_KEY;

  if (!fluxUrl || !fluxSecret) {
    return NextResponse.json(
      {
        status: "accepted",
        placeholder: true,
        message:
          "RunPod FLUX not configured — erase would clear the masked region. Set RUNPOD_FLUX_URL + RUNPOD_FLUX_SECRET for context-aware erase.",
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
          mode: "erase",
          image: body.imageBase64,
          mask: body.maskBase64,
          // Context-aware erase prompt — tells the model to extend the
          // surrounding background rather than generate novel content.
          prompt:
            "seamless background continuation, clean natural fill, no subject, " +
            "matches surrounding context, photorealistic",
          width: body.width,
          height: body.height,
          selection: body.selection,
        },
      }),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return NextResponse.json(
        {
          error: `FLUX erase failed (${response.status})`,
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
        { error: "FLUX returned no images" },
        { status: 502 },
      );
    }
    return NextResponse.json({
      status: "ok",
      image: img.startsWith("data:") ? img : `data:image/png;base64,${img}`,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "FLUX erase call threw",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}
