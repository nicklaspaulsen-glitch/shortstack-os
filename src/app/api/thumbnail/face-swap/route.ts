import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// ──────────────────────────────────────────────────────────────────────────
// POST /api/thumbnail/face-swap
// Accepts EITHER:
//   { thumbnail_id: string, face_image_url: string }   — swap face into an
//                                                       existing generated thumbnail
//   { prompt: string, face_image_url: string, style?, aspect?, client_id? }
//                                                     — generate a new thumbnail
//                                                       with the user's face
//
// Uses the RunPod FLUX endpoint with an InstantID-style ComfyUI workflow. If
// the required InstantID nodes aren't in the FLUX worker, the endpoint returns
// a clear error telling the operator to deploy a face-swap-capable worker.
//
// Writes a `generated_images` row with metadata.source = "face_swap" so the
// UI can filter these out.
// ──────────────────────────────────────────────────────────────────────────

export const maxDuration = 60;

interface FluxInstantIdNode {
  inputs: Record<string, unknown>;
  class_type: string;
  _meta?: { title: string };
}

function buildInstantIdWorkflow(opts: {
  prompt: string;
  faceImageUrl: string;
  width: number;
  height: number;
  seed: number;
  negativePrompt: string;
}): Record<string, FluxInstantIdNode> {
  // ComfyUI InstantID-style workflow for FLUX. The `LoadImageFromUrl` +
  // `InstantIDFaceAnalysis` + `ApplyInstantID` nodes must exist in the worker's
  // ComfyUI node set. If they don't, the worker returns an error mentioning the
  // missing node type — we detect that downstream and translate it to our
  // "deploy the faceswap worker" error.
  return {
    "1": {
      inputs: { ckpt_name: "flux1-dev-fp8.safetensors" },
      class_type: "CheckpointLoaderSimple",
      _meta: { title: "Load FLUX Checkpoint" },
    },
    "2": {
      inputs: { url: opts.faceImageUrl },
      class_type: "LoadImageFromUrl",
      _meta: { title: "Load Face Image from URL" },
    },
    "3": {
      inputs: { provider: "CPU" },
      class_type: "InstantIDFaceAnalysis",
      _meta: { title: "InstantID Face Analysis" },
    },
    "4": {
      inputs: { instantid_file: "instantid-ip-adapter.bin" },
      class_type: "InstantIDModelLoader",
      _meta: { title: "Load InstantID Model" },
    },
    "5": {
      inputs: { control_net_name: "instantid-controlnet.safetensors" },
      class_type: "ControlNetLoader",
      _meta: { title: "Load InstantID ControlNet" },
    },
    "6": {
      inputs: { text: opts.prompt, clip: ["1", 1] },
      class_type: "CLIPTextEncode",
      _meta: { title: "CLIP Text Encode (Positive)" },
    },
    "7": {
      inputs: { text: opts.negativePrompt, clip: ["1", 1] },
      class_type: "CLIPTextEncode",
      _meta: { title: "CLIP Text Encode (Negative)" },
    },
    "8": {
      inputs: {
        weight: 0.8,
        start_at: 0,
        end_at: 1,
        instantid: ["4", 0],
        insightface: ["3", 0],
        control_net: ["5", 0],
        image: ["2", 0],
        model: ["1", 0],
        positive: ["6", 0],
        negative: ["7", 0],
      },
      class_type: "ApplyInstantID",
      _meta: { title: "Apply InstantID" },
    },
    "9": {
      inputs: { width: opts.width, height: opts.height, batch_size: 1 },
      class_type: "EmptySD3LatentImage",
      _meta: { title: "Empty Latent" },
    },
    "10": {
      inputs: {
        seed: opts.seed,
        steps: 14,
        cfg: 1.2,
        sampler_name: "euler",
        scheduler: "simple",
        denoise: 1,
        model: ["8", 0],
        positive: ["8", 1],
        negative: ["8", 2],
        latent_image: ["9", 0],
      },
      class_type: "KSampler",
      _meta: { title: "KSampler" },
    },
    "11": {
      inputs: { samples: ["10", 0], vae: ["1", 2] },
      class_type: "VAEDecode",
      _meta: { title: "VAE Decode" },
    },
    "12": {
      inputs: { filename_prefix: "FaceSwap", images: ["11", 0] },
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
    face_image_url?: unknown;
    prompt?: unknown;
    style?: unknown;
    aspect?: unknown;
    client_id?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const faceImageUrl = typeof body.face_image_url === "string" ? body.face_image_url.trim() : "";
  if (!faceImageUrl) {
    return NextResponse.json(
      { ok: false, error: "face_image_url required (upload to /faces bucket first)" },
      { status: 400 },
    );
  }

  const thumbnailId = typeof body.thumbnail_id === "string" ? body.thumbnail_id : "";
  const rawPrompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const style = typeof body.style === "string" ? body.style : "youtube_classic";
  const aspect = typeof body.aspect === "string" ? body.aspect : "16:9";
  let clientIdInput = typeof body.client_id === "string" ? body.client_id : "";

  const db = createServiceClient();

  // Resolve effective owner (team_members roll up to parent agency).
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, parent_agency_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ ok: false, error: "Profile not found" }, { status: 404 });
  }
  const role = (profile as { role: string }).role;
  const ownerId =
    role === "team_member" && (profile as { parent_agency_id?: string }).parent_agency_id
      ? (profile as { parent_agency_id: string }).parent_agency_id
      : user.id;

  // If client_id provided, verify ownership. Clients are auto-scoped.
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

  // Resolve the prompt: from thumbnail_id OR direct body.
  let prompt = rawPrompt;
  if (thumbnailId && !prompt) {
    const { data: existing } = await db
      .from("generated_images")
      .select("prompt, profile_id")
      .eq("id", thumbnailId)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Thumbnail not found" }, { status: 404 });
    }
    if ((existing as { profile_id: string }).profile_id !== ownerId) {
      return NextResponse.json({ ok: false, error: "Thumbnail access denied" }, { status: 403 });
    }
    prompt = (existing as { prompt: string | null }).prompt || "";
  }
  if (!prompt) {
    return NextResponse.json(
      { ok: false, error: "Provide either { thumbnail_id } of an existing generation or a { prompt }" },
      { status: 400 },
    );
  }

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
  const genWidth = Math.min(dims.width, 1024);
  const genHeight = Math.min(dims.height, 1024);

  const negativePrompt =
    "blurry, low quality, deformed, ugly, watermark, signature, cropped, worst quality, jpeg artifacts, " +
    "duplicate, mutated hands, poorly drawn face, bad anatomy, different person, face swap artifacts, " +
    "uncanny valley, plastic skin, dead eyes, asymmetric face";

  const seed = Math.floor(Math.random() * 2147483647);
  const workflow = buildInstantIdWorkflow({
    prompt,
    faceImageUrl,
    width: genWidth,
    height: genHeight,
    seed,
    negativePrompt,
  });

  let jobId: string | null = null;
  let faceswapUnsupported = false;
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

    // Detect "missing InstantID nodes" — the worker responds with an error
    // mentioning the unknown class_type. Anything hinting at InstantID/Apply/Load
    // failure means the worker isn't face-swap capable.
    const errText =
      typeof job?.error === "string"
        ? job.error
        : typeof (job?.message as string) === "string"
          ? (job.message as string)
          : "";
    if (
      errText &&
      /InstantID|LoadImageFromUrl|ApplyInstantID|InstantIDModelLoader|unknown class_type/i.test(errText)
    ) {
      faceswapUnsupported = true;
      runpodErrorMessage = errText;
    } else if (typeof job?.id === "string") {
      jobId = job.id as string;
    } else if (errText) {
      runpodErrorMessage = errText;
    }
  } catch (err) {
    runpodErrorMessage = err instanceof Error ? err.message : "RunPod request failed";
  }

  if (faceswapUnsupported) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "FaceSwap requires InstantID nodes — deploy the faceswap worker. " +
          "Add `comfyui-instantid` and `comfyui-custom-nodes` to the RUNPOD_FLUX_URL worker image, " +
          "and place `instantid-ip-adapter.bin` + `instantid-controlnet.safetensors` into the models dir.",
        worker_error: runpodErrorMessage,
      },
      { status: 501 },
    );
  }

  if (!jobId) {
    return NextResponse.json(
      { ok: false, error: runpodErrorMessage || "RunPod did not return a job id" },
      { status: 502 },
    );
  }

  // Persist the generated_images row.
  const { data: row, error: insertErr } = await db
    .from("generated_images")
    .insert({
      profile_id: ownerId,
      client_id: clientIdInput || null,
      prompt,
      model: "flux1-dev-fp8-instantid",
      width: dims.width,
      height: dims.height,
      status: "processing",
      job_id: jobId,
      metadata: {
        source: "face_swap",
        face_image_url: faceImageUrl,
        parent_thumbnail_id: thumbnailId || null,
        style,
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

  return NextResponse.json({
    ok: true,
    thumbnail_id: (row as { id: string }).id,
    status: "processing",
    job_id: jobId,
    poll_url: `/api/thumbnail/status?job_id=${jobId}`,
  });
}
