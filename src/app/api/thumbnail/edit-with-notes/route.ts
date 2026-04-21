import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { checkLimit, recordUsage } from "@/lib/usage-limits";

// Keep in sync with thumbnail/generate/route.ts — each FLUX render costs
// ~1000 "tokens" in the plan-tier budget.
const THUMBNAIL_TOKEN_COST = 1000;

// ──────────────────────────────────────────────────────────────────────────
// POST /api/thumbnail/edit-with-notes
//
// Pikzels-style "Edit With Simple Notes". Given an existing thumbnail_id
// plus a natural-language instruction ("make the text bigger and red",
// "swap the background to a basketball court", "remove the watermark"),
// re-generates the thumbnail via FLUX img2img at moderate denoise so the
// composition survives but the edit lands.
//
// Body:
//   { thumbnail_id: string, instruction: string,
//     denoise?: number (0.3–0.8, default 0.5),
//     client_id?: string, aspect?: "16:9"|"9:16"|"1:1" }
//
// Response: { ok, thumbnail_id, job_id, status, poll_url }
// ──────────────────────────────────────────────────────────────────────────

export const maxDuration = 30;

interface WorkflowNode {
  inputs: Record<string, unknown>;
  class_type: string;
  _meta?: { title: string };
}

function buildImg2ImgWorkflow(opts: {
  prompt: string;
  negativePrompt: string;
  referenceUrl: string;
  seed: number;
  denoise: number;
}): Record<string, WorkflowNode> {
  // FLUX img2img: load ref → VAE encode → sample at denoise=X → decode.
  return {
    "1": {
      inputs: { ckpt_name: "flux1-dev-fp8.safetensors" },
      class_type: "CheckpointLoaderSimple",
      _meta: { title: "Load FLUX Checkpoint" },
    },
    "2": {
      inputs: { url: opts.referenceUrl },
      class_type: "LoadImageFromUrl",
      _meta: { title: "Load Source Thumbnail" },
    },
    "3": {
      inputs: { pixels: ["2", 0], vae: ["1", 2] },
      class_type: "VAEEncode",
      _meta: { title: "VAE Encode" },
    },
    "4": {
      inputs: { text: opts.prompt, clip: ["1", 1] },
      class_type: "CLIPTextEncode",
      _meta: { title: "Positive" },
    },
    "5": {
      inputs: { text: opts.negativePrompt, clip: ["1", 1] },
      class_type: "CLIPTextEncode",
      _meta: { title: "Negative" },
    },
    "6": {
      inputs: {
        seed: opts.seed,
        steps: 20,
        cfg: 1.5,
        sampler_name: "euler",
        scheduler: "simple",
        denoise: opts.denoise,
        model: ["1", 0],
        positive: ["4", 0],
        negative: ["5", 0],
        latent_image: ["3", 0],
      },
      class_type: "KSampler",
      _meta: { title: "KSampler" },
    },
    "7": {
      inputs: { samples: ["6", 0], vae: ["1", 2] },
      class_type: "VAEDecode",
      _meta: { title: "VAE Decode" },
    },
    "8": {
      inputs: { filename_prefix: "EditNotes", images: ["7", 0] },
      class_type: "SaveImage",
      _meta: { title: "Save Image" },
    },
  };
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: {
    thumbnail_id?: unknown;
    instruction?: unknown;
    denoise?: unknown;
    client_id?: unknown;
    aspect?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const thumbnailId = typeof body.thumbnail_id === "string" ? body.thumbnail_id : "";
  const instruction = typeof body.instruction === "string" ? body.instruction.trim() : "";
  const aspect = typeof body.aspect === "string" ? body.aspect : "16:9";
  const denoise = Math.max(0.3, Math.min(0.8, typeof body.denoise === "number" ? body.denoise : 0.5));
  let clientIdInput = typeof body.client_id === "string" ? body.client_id : "";

  if (!thumbnailId) {
    return NextResponse.json({ ok: false, error: "thumbnail_id required" }, { status: 400 });
  }
  if (!instruction) {
    return NextResponse.json(
      { ok: false, error: "instruction required — describe the change in plain English" },
      { status: 400 },
    );
  }

  const db = createServiceClient();

  // Effective owner.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, parent_agency_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ ok: false, error: "Profile not found" }, { status: 404 });
  const role = (profile as { role: string }).role;
  const ownerId =
    role === "team_member" && (profile as { parent_agency_id?: string }).parent_agency_id
      ? (profile as { parent_agency_id: string }).parent_agency_id
      : user.id;

  if (role === "client") {
    const { data: ownClient } = await db
      .from("clients")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();
    clientIdInput = (ownClient as { id?: string } | null)?.id ?? "";
  } else if (clientIdInput) {
    const { data: c } = await db
      .from("clients")
      .select("id, profile_id")
      .eq("id", clientIdInput)
      .maybeSingle();
    if (!c || (c as { profile_id: string }).profile_id !== ownerId) {
      return NextResponse.json({ ok: false, error: "Client not found or access denied" }, { status: 403 });
    }
  }

  // Plan-tier token gate — bug-hunt-apr20-v2 HIGH #12. Each edit dispatches
  // a fresh FLUX img2img job — no free re-roll.
  const gate = await checkLimit(ownerId, "tokens", THUMBNAIL_TOKEN_COST);
  if (!gate.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: gate.reason || "Monthly token budget reached for your plan.",
        current: gate.current,
        limit: gate.limit,
        plan_tier: gate.plan_tier,
        remaining: gate.remaining,
      },
      { status: 402 },
    );
  }

  // Look up the source thumbnail.
  const { data: existing } = await db
    .from("generated_images")
    .select("prompt, profile_id, image_url, metadata")
    .eq("id", thumbnailId)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Thumbnail not found" }, { status: 404 });
  }
  if ((existing as { profile_id: string }).profile_id !== ownerId) {
    return NextResponse.json({ ok: false, error: "Thumbnail access denied" }, { status: 403 });
  }
  const sourceUrl = (existing as { image_url: string | null }).image_url;
  const sourcePrompt = (existing as { prompt: string | null }).prompt || "";
  if (!sourceUrl) {
    return NextResponse.json(
      { ok: false, error: "Source thumbnail has no image_url yet (still rendering?)" },
      { status: 409 },
    );
  }

  // Compose the edit prompt. We keep the original prompt as context so the
  // model preserves the subject's intent, then append the user's instruction
  // with the key directive "EDIT: …" so the model knows what to change.
  const editPrompt =
    (sourcePrompt ? `${sourcePrompt}. ` : "") +
    `EDIT: ${instruction}. ` +
    "Preserve the overall composition, subject placement, and aspect. " +
    "Only apply the requested change. Maintain viral YouTube thumbnail quality.";

  const negativePrompt =
    "blurry, low quality, deformed, ugly, watermark, signature, cropped, worst quality, jpeg artifacts, " +
    "duplicate subjects, garbled text, different composition, different subject, different layout";

  const fluxUrl = process.env.RUNPOD_FLUX_URL;
  const runpodKey = process.env.RUNPOD_API_KEY;
  if (!fluxUrl || !runpodKey) {
    return NextResponse.json(
      { ok: false, error: "RUNPOD_FLUX_URL / RUNPOD_API_KEY not configured" },
      { status: 503 },
    );
  }

  const dims =
    aspect === "9:16"
      ? { width: 720, height: 1280 }
      : aspect === "1:1"
        ? { width: 1024, height: 1024 }
        : { width: 1280, height: 720 };

  const seed = Math.floor(Math.random() * 2147483647);
  const workflow = buildImg2ImgWorkflow({
    prompt: editPrompt,
    negativePrompt,
    referenceUrl: sourceUrl,
    seed,
    denoise,
  });

  let jobId: string | null = null;
  let runpodErrorMessage: string | null = null;
  try {
    const res = await fetch(`${fluxUrl}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${runpodKey}`,
      },
      body: JSON.stringify({ input: { workflow } }),
    });
    const job = (await res.json()) as Record<string, unknown>;
    if (typeof job?.id === "string") {
      jobId = job.id as string;
    } else {
      const errText =
        typeof job?.error === "string"
          ? job.error
          : typeof (job?.message as string) === "string"
            ? (job.message as string)
            : "";
      runpodErrorMessage = errText || "RunPod returned no job id";
    }
  } catch (err) {
    runpodErrorMessage = err instanceof Error ? err.message : "RunPod request failed";
  }

  if (!jobId) {
    return NextResponse.json(
      { ok: false, error: runpodErrorMessage || "RunPod did not return a job id" },
      { status: 502 },
    );
  }

  const { data: row, error: insertErr } = await db
    .from("generated_images")
    .insert({
      profile_id: ownerId,
      client_id: clientIdInput || null,
      prompt: editPrompt,
      model: "flux1-dev-fp8-img2img",
      width: dims.width,
      height: dims.height,
      status: "processing",
      job_id: jobId,
      metadata: {
        source: "edit_with_notes",
        parent_thumbnail_id: thumbnailId,
        instruction,
        denoise,
        aspect,
      },
    })
    .select("id")
    .single();

  if (insertErr || !row) {
    return NextResponse.json(
      { ok: false, error: insertErr?.message || "Failed to persist thumbnail row" },
      { status: 500 },
    );
  }

  await recordUsage(ownerId, "tokens", THUMBNAIL_TOKEN_COST, { kind: "thumbnail_edit_with_notes" });

  return NextResponse.json({
    ok: true,
    thumbnail_id: (row as { id: string }).id,
    parent_thumbnail_id: thumbnailId,
    instruction,
    status: "processing",
    job_id: jobId,
    poll_url: `/api/thumbnail/status?job_id=${jobId}`,
  });
}
