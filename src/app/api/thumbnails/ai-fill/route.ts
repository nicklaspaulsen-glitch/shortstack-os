import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// AI generative fill — user draws a selection, sends a prompt, we inpaint
// the selection region. Calls FLUX inpaint on RunPod when configured;
// falls back to a 202 with a placeholder gradient in dev / offline mode.
//
// Kill-switch: FEATURE_AI_FILL=false disables the route entirely.
// Secret: RUNPOD_FLUX_SECRET is the OUTBOUND auth to RunPod, NOT inbound
// auth. Inbound auth is enforced by Supabase session below — without it,
// the route was open to anonymous traffic and would burn AI credits on
// every drive-by hit (bug-hunt round 4, Apr 27).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AIFillBody {
  imageBase64?: string; // full-canvas image
  maskBase64?: string; // white = fill, black = keep
  prompt: string;
  width: number;
  height: number;
  selection: { x: number; y: number; width: number; height: number };
}

export async function POST(req: NextRequest) {
  // Kill-switch
  if (process.env.FEATURE_AI_FILL === "false") {
    return NextResponse.json(
      { error: "AI fill is disabled by feature flag." },
      { status: 503 },
    );
  }

  // Auth gate — burns Anthropic + RunPod credits per call, must require login.
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: AIFillBody;
  try {
    body = (await req.json()) as AIFillBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.prompt || typeof body.prompt !== "string") {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const fluxUrl = process.env.RUNPOD_FLUX_URL;
  const fluxSecret = process.env.RUNPOD_FLUX_SECRET || process.env.RUNPOD_API_KEY;

  if (!fluxUrl || !fluxSecret) {
    // Dev / offline fallback — return a placeholder gradient that the
    // client can composite into the selection region. 202 signals
    // "accepted but not really processed" so the UI can show a toast.
    return NextResponse.json(
      {
        status: "accepted",
        placeholder: true,
        gradient: makePlaceholderGradient(body.prompt),
        message:
          "RunPod FLUX not configured — rendered a placeholder gradient. Set RUNPOD_FLUX_URL + RUNPOD_FLUX_SECRET for real inpainting.",
      },
      { status: 202 },
    );
  }

  try {
    // Translate to the ComfyUI inpaint workflow expected by our FLUX worker.
    // The worker consumes a JSON of { image, mask, prompt } and returns
    // a base64-encoded PNG of the region. Matching the existing thumbnail
    // generate route's shape so the worker binary is reusable.
    const response = await fetch(`${fluxUrl}/runsync`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${fluxSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          mode: "inpaint",
          image: body.imageBase64,
          mask: body.maskBase64,
          prompt: body.prompt,
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
          error: `FLUX inpaint failed (${response.status})`,
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
        error: "FLUX inpaint call threw",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}

// Deterministic placeholder gradient — colors derived from the prompt so
// the user sees a repeatable "you asked for purple X" cue.
function makePlaceholderGradient(prompt: string) {
  let hash = 0;
  for (let i = 0; i < prompt.length; i++) {
    hash = ((hash << 5) - hash + prompt.charCodeAt(i)) | 0;
  }
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 120) % 360;
  return {
    from: `hsl(${h1}, 70%, 55%)`,
    to: `hsl(${h2}, 70%, 45%)`,
    angle: Math.abs(hash) % 360,
  };
}
