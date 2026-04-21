import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { checkLimit, recordUsage } from "@/lib/usage-limits";

// Keep in sync with thumbnail/generate/route.ts — one face-swap (Replicate
// or InstantID via RunPod) costs ~1000 "tokens" in the plan-tier budget.
const THUMBNAIL_TOKEN_COST = 1000;

// ──────────────────────────────────────────────────────────────────────────
// POST /api/thumbnail/face-swap
// Accepts EITHER:
//   { thumbnail_id: string, face_image_url: string }   — swap face into an
//                                                       existing generated thumbnail
//   { prompt: string, face_image_url: string, style?, aspect?, client_id? }
//                                                     — generate a new thumbnail
//                                                       with the user's face
//
// Provider order:
//   1. Replicate (preferred: `cdingram/face-swap` for target-swap,
//                 `zsxkib/instant-id` for prompt-based generation) — reliable,
//                 pre-hosted, no InstantID node setup required
//   2. Runpod FLUX with InstantID ComfyUI workflow — requires the face-swap
//                                                    worker; returns 501 if the
//                                                    required nodes are missing
//   3. 501 — no face-swap provider configured
//
// Writes a `generated_images` row with metadata.source = "face_swap" so the
// UI can filter these out.
// ──────────────────────────────────────────────────────────────────────────

export const maxDuration = 60;

// Replicate model version hashes. Update these occasionally; `Prefer: wait`
// tells Replicate to hold the HTTP connection open for up to 60s.
// cdingram/face-swap is an InsightFace/Roop single-shot face-swap model.
// zsxkib/instant-id is an InstantID port (prompt + face → styled image).
const REPLICATE_FACESWAP_MODEL = "cdingram/face-swap";
const REPLICATE_FACESWAP_VERSION = "d1d6ea8c8be89d664a07a457526f7128109dee7030fdac424788d762c71ed111";
const REPLICATE_INSTANTID_MODEL = "zsxkib/instant-id";
const REPLICATE_INSTANTID_VERSION = "491ddf5be6b827f8931f088ef10c6d015f6d99685e6454e6f04c8ac298979686";

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

// ─── Replicate ────────────────────────────────────────────────────────────
type ReplicateOutcome =
  | { ok: true; completed: true; imageUrl: string; model: string }
  | { ok: true; completed: false; predictionId: string; model: string }
  | { ok: false; reason: string };

async function callReplicate(body: Record<string, unknown>): Promise<Response | null> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return null;
  return fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "wait", // hold up to 60s for a sync result
    },
    body: JSON.stringify(body),
  });
}

function firstImageUrl(output: unknown): string | null {
  // Replicate model outputs can be a string URL, an array of URLs, or an
  // object keyed by name. Grab the first URL we can find.
  if (typeof output === "string") return output;
  if (Array.isArray(output) && typeof output[0] === "string") return output[0];
  if (output && typeof output === "object") {
    const first = Object.values(output as Record<string, unknown>).find(
      (v): v is string => typeof v === "string",
    );
    return first ?? null;
  }
  return null;
}

async function synthesizeViaReplicateFaceSwap(
  targetImageUrl: string,
  faceImageUrl: string,
): Promise<ReplicateOutcome> {
  const res = await callReplicate({
    version: REPLICATE_FACESWAP_VERSION,
    input: {
      // cdingram/face-swap convention: input_image = target, swap_image = face.
      input_image: targetImageUrl,
      swap_image: faceImageUrl,
    },
  });
  if (!res) return { ok: false, reason: "not_configured" };
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("[face-swap/replicate]", res.status, errText.slice(0, 300));
    return { ok: false, reason: `http_${res.status}` };
  }
  const prediction = (await res.json()) as {
    id?: string;
    status?: string;
    output?: unknown;
    error?: string;
  };
  if (prediction.status === "succeeded") {
    const url = firstImageUrl(prediction.output);
    if (!url) return { ok: false, reason: "no_image_in_output" };
    return { ok: true, completed: true, imageUrl: url, model: REPLICATE_FACESWAP_MODEL };
  }
  if (prediction.status === "failed" || prediction.error) {
    return { ok: false, reason: prediction.error || "replicate_failed" };
  }
  if (prediction.id) {
    return { ok: true, completed: false, predictionId: prediction.id, model: REPLICATE_FACESWAP_MODEL };
  }
  return { ok: false, reason: "no_prediction_id" };
}

async function synthesizeViaReplicateInstantId(opts: {
  prompt: string;
  faceImageUrl: string;
  width: number;
  height: number;
  negativePrompt: string;
}): Promise<ReplicateOutcome> {
  const res = await callReplicate({
    version: REPLICATE_INSTANTID_VERSION,
    input: {
      image: opts.faceImageUrl,
      prompt: opts.prompt,
      negative_prompt: opts.negativePrompt,
      width: opts.width,
      height: opts.height,
      num_inference_steps: 30,
      guidance_scale: 5,
      ip_adapter_scale: 0.8,
      controlnet_conditioning_scale: 0.8,
    },
  });
  if (!res) return { ok: false, reason: "not_configured" };
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("[face-swap/replicate-instantid]", res.status, errText.slice(0, 300));
    return { ok: false, reason: `http_${res.status}` };
  }
  const prediction = (await res.json()) as {
    id?: string;
    status?: string;
    output?: unknown;
    error?: string;
  };
  if (prediction.status === "succeeded") {
    const url = firstImageUrl(prediction.output);
    if (!url) return { ok: false, reason: "no_image_in_output" };
    return { ok: true, completed: true, imageUrl: url, model: REPLICATE_INSTANTID_MODEL };
  }
  if (prediction.status === "failed" || prediction.error) {
    return { ok: false, reason: prediction.error || "replicate_failed" };
  }
  if (prediction.id) {
    return { ok: true, completed: false, predictionId: prediction.id, model: REPLICATE_INSTANTID_MODEL };
  }
  return { ok: false, reason: "no_prediction_id" };
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

  // Plan-tier token gate — bug-hunt-apr20-v2 HIGH #12. Gate once up front;
  // we meter exactly once on whichever provider succeeds below.
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

  // Resolve target image + prompt. If a thumbnail_id is given, look up the
  // existing row (image_url + prompt). Prefer swap-onto-target (cheaper + more
  // predictable) when we have a target image. Otherwise generate from prompt.
  let prompt = rawPrompt;
  let targetImageUrl: string | null = null;
  if (thumbnailId) {
    const { data: existing } = await db
      .from("generated_images")
      .select("prompt, profile_id, image_url")
      .eq("id", thumbnailId)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Thumbnail not found" }, { status: 404 });
    }
    if ((existing as { profile_id: string }).profile_id !== ownerId) {
      return NextResponse.json({ ok: false, error: "Thumbnail access denied" }, { status: 403 });
    }
    prompt = prompt || (existing as { prompt: string | null }).prompt || "";
    targetImageUrl = (existing as { image_url: string | null }).image_url || null;
  }

  if (!prompt && !targetImageUrl) {
    return NextResponse.json(
      { ok: false, error: "Provide either { thumbnail_id } (of a rendered thumbnail) or a { prompt }" },
      { status: 400 },
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

  const replicateToken = process.env.REPLICATE_API_TOKEN;
  const fluxUrl = process.env.RUNPOD_FLUX_URL;
  const runpodKey = process.env.RUNPOD_API_KEY;

  // ── Provider 1: Replicate ────────────────────────────────────────────
  if (replicateToken) {
    const outcome = targetImageUrl
      ? await synthesizeViaReplicateFaceSwap(targetImageUrl, faceImageUrl)
      : await synthesizeViaReplicateInstantId({
          prompt,
          faceImageUrl,
          width: genWidth,
          height: genHeight,
          negativePrompt,
        });

    if (outcome.ok) {
      const status = outcome.completed ? "completed" : "processing";
      const jobIdValue = outcome.completed ? null : outcome.predictionId;
      const imageUrlValue = outcome.completed ? outcome.imageUrl : null;

      const { data: row, error: insertErr } = await db
        .from("generated_images")
        .insert({
          profile_id: ownerId,
          client_id: clientIdInput || null,
          prompt,
          model: outcome.model,
          width: dims.width,
          height: dims.height,
          status,
          job_id: jobIdValue,
          image_url: imageUrlValue,
          metadata: {
            source: "face_swap",
            provider: "replicate",
            face_image_url: faceImageUrl,
            parent_thumbnail_id: thumbnailId || null,
            target_image_url: targetImageUrl,
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

      await recordUsage(ownerId, "tokens", THUMBNAIL_TOKEN_COST, { kind: "thumbnail_face_swap" });

      return NextResponse.json({
        ok: true,
        thumbnail_id: (row as { id: string }).id,
        status,
        image_url: imageUrlValue,
        job_id: jobIdValue,
        poll_url: outcome.completed
          ? null
          : `/api/thumbnail/status?job_id=${outcome.predictionId}&provider=replicate`,
        provider: "replicate",
        model: outcome.model,
      });
    }

    console.warn(`[face-swap] Replicate failed (${outcome.reason}), trying Runpod`);
  }

  // ── Provider 2: Runpod FLUX InstantID ────────────────────────────────
  if (fluxUrl && runpodKey) {
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
      // Only return the "deploy the worker" error if we didn't already have
      // Replicate configured. If Replicate was set but failed, surface the
      // Replicate failure instead — that's more actionable.
      if (!replicateToken) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "FaceSwap requires InstantID nodes — deploy the faceswap worker or set REPLICATE_API_TOKEN. " +
              "Replicate is the simpler path: grab a token from replicate.com/account and add it to Vercel.",
            worker_error: runpodErrorMessage,
          },
          { status: 501 },
        );
      }
      return NextResponse.json(
        {
          ok: false,
          error:
            "FaceSwap unavailable — Replicate returned an error and the Runpod worker lacks InstantID nodes.",
          worker_error: runpodErrorMessage,
        },
        { status: 502 },
      );
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
        prompt,
        model: "flux1-dev-fp8-instantid",
        width: dims.width,
        height: dims.height,
        status: "processing",
        job_id: jobId,
        metadata: {
          source: "face_swap",
          provider: "runpod",
          face_image_url: faceImageUrl,
          parent_thumbnail_id: thumbnailId || null,
          target_image_url: targetImageUrl,
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

    await recordUsage(ownerId, "tokens", THUMBNAIL_TOKEN_COST, { kind: "thumbnail_face_swap" });

    return NextResponse.json({
      ok: true,
      thumbnail_id: (row as { id: string }).id,
      status: "processing",
      job_id: jobId,
      poll_url: `/api/thumbnail/status?job_id=${jobId}`,
      provider: "runpod",
      model: "flux1-dev-fp8-instantid",
    });
  }

  // ── No provider configured ──────────────────────────────────────────
  return NextResponse.json(
    {
      ok: false,
      error:
        "FaceSwap unavailable — set REPLICATE_API_TOKEN (easy path) or configure RUNPOD_FLUX_URL with an InstantID-capable worker.",
    },
    { status: 501 },
  );
}
