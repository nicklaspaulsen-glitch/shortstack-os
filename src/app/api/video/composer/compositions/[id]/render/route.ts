import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// POST /api/video/composer/compositions/[id]/render
//
// Queues a hyperframes render job. Because hyperframes is a CLI that needs
// headless Chrome + FFmpeg (incompatible with Vercel serverless) we POST to
// an external RunPod pod that runs the hyperframes-worker service
// (see services/hyperframes-worker). If RUNPOD_HYPERFRAMES_URL is not set
// the render row is still inserted as 'queued' and a human-readable hint is
// returned so the UI can surface the missing configuration.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Load composition
  const { data: comp, error: compErr } = await supabase
    .from("hyperframes_compositions")
    .select("*")
    .eq("id", params.id)
    .single();

  if (compErr || !comp) {
    return NextResponse.json(
      { error: compErr?.message || "Composition not found" },
      { status: 404 }
    );
  }

  // Compute next version
  const { data: latest } = await supabase
    .from("hyperframes_renders")
    .select("version")
    .eq("composition_id", params.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (latest?.version ?? 0) + 1;

  // Insert queued render row
  const { data: render, error: renderErr } = await supabase
    .from("hyperframes_renders")
    .insert({
      composition_id: params.id,
      version: nextVersion,
      status: "queued",
      duration_seconds: comp.duration_seconds,
      created_by: user.id,
    })
    .select()
    .single();

  if (renderErr) {
    return NextResponse.json({ error: renderErr.message }, { status: 500 });
  }

  // Try to dispatch to RunPod hyperframes worker
  const workerUrl = process.env.RUNPOD_HYPERFRAMES_URL;
  const workerSecret = process.env.RUNPOD_HYPERFRAMES_SECRET;
  const origin = request.nextUrl.origin;

  if (!workerUrl) {
    return NextResponse.json(
      {
        render,
        warning:
          "RUNPOD_HYPERFRAMES_URL not configured - render queued but will not start automatically. " +
          "See services/hyperframes-worker/README.md for setup.",
      },
      { status: 202 }
    );
  }

  try {
    const dispatchRes = await fetch(`${workerUrl.replace(/\/$/, "")}/render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(workerSecret ? { Authorization: `Bearer ${workerSecret}` } : {}),
      },
      body: JSON.stringify({
        render_id: render.id,
        composition_id: comp.id,
        html_source: comp.html_source,
        duration_seconds: comp.duration_seconds,
        fps: comp.fps,
        width: comp.width,
        height: comp.height,
        // Worker calls back to mark complete/failed with the output URL
        callback_url: `${origin}/api/video/composer/renders/${render.id}`,
        callback_secret: workerSecret || "",
      }),
    });

    if (!dispatchRes.ok) {
      const text = await dispatchRes.text();
      await supabase
        .from("hyperframes_renders")
        .update({
          status: "failed",
          error: `Worker dispatch failed (${dispatchRes.status}): ${text.slice(0, 500)}`,
        })
        .eq("id", render.id);
      return NextResponse.json(
        { error: "Worker dispatch failed", detail: text },
        { status: 502 }
      );
    }

    await supabase
      .from("hyperframes_renders")
      .update({ status: "rendering" })
      .eq("id", render.id);

    return NextResponse.json({ render: { ...render, status: "rendering" } }, { status: 202 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase
      .from("hyperframes_renders")
      .update({ status: "failed", error: `Worker unreachable: ${msg}` })
      .eq("id", render.id);
    return NextResponse.json(
      { error: "Worker unreachable", detail: msg },
      { status: 502 }
    );
  }
}
