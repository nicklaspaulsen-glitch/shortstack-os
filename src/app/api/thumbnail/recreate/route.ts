import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// ──────────────────────────────────────────────────────────────────────────
// POST /api/thumbnail/recreate
// Body: { url: string, style_modifier?: string, client_id?: string, aspect?: "16:9"|"9:16"|"1:1" }
//
// 1. Extracts the YouTube video ID from the URL (watch, shorts, or youtu.be).
// 2. Fetches the public maxresdefault.jpg from ytimg (no API key needed).
// 3. Kicks off a FLUX img2img job using the thumbnail as reference image plus
//    an optional style_modifier text prompt.
// 4. Inserts a generated_images row with metadata.source = "recreate" and
//    returns the thumbnail_id + job_id for polling via /api/thumbnail/status.
// ──────────────────────────────────────────────────────────────────────────

export const maxDuration = 30;

function extractVideoId(raw: string): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");

  // youtu.be/<id>
  if (host === "youtu.be") {
    const seg = url.pathname.replace(/^\//, "").split("/")[0];
    return seg && /^[A-Za-z0-9_-]{6,}$/.test(seg) ? seg : null;
  }

  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    // /watch?v=<id>
    const v = url.searchParams.get("v");
    if (v && /^[A-Za-z0-9_-]{6,}$/.test(v)) return v;

    // /shorts/<id> or /embed/<id> or /live/<id>
    const pathMatch = url.pathname.match(/\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{6,})/);
    if (pathMatch) return pathMatch[1];
  }

  return null;
}

async function fetchYouTubeThumbnail(videoId: string): Promise<{ buf: Buffer; contentType: string } | null> {
  const candidates = [
    `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
  ];
  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (res.ok && (res.headers.get("content-length") ?? "0") !== "0") {
        const buf = Buffer.from(await res.arrayBuffer());
        // YouTube serves a 120x90 placeholder image for missing thumbs; skip tiny files.
        if (buf.byteLength > 1000) {
          return { buf, contentType: res.headers.get("content-type") || "image/jpeg" };
        }
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: {
    url?: unknown;
    style_modifier?: unknown;
    client_id?: unknown;
    aspect?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
  const styleModifier = typeof body.style_modifier === "string" ? body.style_modifier.trim() : "";
  const aspect = typeof body.aspect === "string" ? body.aspect : "16:9";
  let clientIdInput = typeof body.client_id === "string" ? body.client_id : "";

  if (!rawUrl) return NextResponse.json({ ok: false, error: "url required" }, { status: 400 });
  const videoId = extractVideoId(rawUrl);
  if (!videoId) {
    return NextResponse.json(
      { ok: false, error: "Unsupported URL — expected a YouTube video, Shorts, or youtu.be link" },
      { status: 400 },
    );
  }

  const db = createServiceClient();

  // Resolve effective owner.
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

  // Fetch the source thumbnail from ytimg.
  const thumb = await fetchYouTubeThumbnail(videoId);
  if (!thumb) {
    return NextResponse.json(
      { ok: false, error: `Could not fetch thumbnail for video ${videoId} (may be private or deleted)` },
      { status: 404 },
    );
  }

  // Upload to content-assets so the FLUX worker can fetch it back. Public
  // bucket keeps the URL simple; we namespace under `recreate-refs/{user}/`.
  const refKey = `recreate-refs/${user.id}/${videoId}-${Date.now()}.jpg`;
  const { error: upErr } = await db.storage
    .from("content-assets")
    .upload(refKey, thumb.buf, { contentType: thumb.contentType, upsert: true });
  if (upErr) {
    return NextResponse.json({ ok: false, error: `Reference upload failed: ${upErr.message}` }, { status: 500 });
  }
  const refPublic = db.storage.from("content-assets").getPublicUrl(refKey).data.publicUrl;

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
  // NOTE: img2img derives latent dimensions from the VAE-encoded reference image,
  // so we don't need to feed a width/height to EmptySD3LatentImage here. `dims`
  // is still persisted on the row so the downloaded output can be resized.

  const basePrompt =
    "recreate this YouTube thumbnail composition with fresh art direction, " +
    "preserve the layout, subject placement, and visual hook but produce a brand new image, " +
    "high-CTR viral thumbnail quality, sharp focus, vivid colors, strong focal point";
  const prompt = styleModifier ? `${basePrompt}, ${styleModifier}` : basePrompt;
  const negativePrompt =
    "blurry, low quality, deformed, ugly, watermark, signature, cropped, worst quality, " +
    "duplicate subjects, text artifacts, garbled text, copy of original, identical image";
  const seed = Math.floor(Math.random() * 2147483647);

  // FLUX img2img workflow — LoadImageFromUrl feeds into VAEEncode, which becomes
  // the initial latent at denoise=0.65 (enough to re-render, little enough to
  // preserve the composition).
  const workflow = {
    "1": {
      inputs: { ckpt_name: "flux1-dev-fp8.safetensors" },
      class_type: "CheckpointLoaderSimple",
      _meta: { title: "Load FLUX Checkpoint" },
    },
    "2": {
      inputs: { url: refPublic },
      class_type: "LoadImageFromUrl",
      _meta: { title: "Load YT Reference" },
    },
    "3": {
      inputs: { pixels: ["2", 0], vae: ["1", 2] },
      class_type: "VAEEncode",
      _meta: { title: "VAE Encode (reference)" },
    },
    "4": {
      inputs: { text: prompt, clip: ["1", 1] },
      class_type: "CLIPTextEncode",
      _meta: { title: "CLIP Text Encode (Positive)" },
    },
    "5": {
      inputs: { text: negativePrompt, clip: ["1", 1] },
      class_type: "CLIPTextEncode",
      _meta: { title: "CLIP Text Encode (Negative)" },
    },
    "6": {
      inputs: { guidance: 3.5, conditioning: ["4", 0] },
      class_type: "FluxGuidance",
      _meta: { title: "FluxGuidance" },
    },
    "7": {
      inputs: {
        seed,
        steps: 14,
        cfg: 1,
        sampler_name: "euler",
        scheduler: "simple",
        denoise: 0.65,
        model: ["1", 0],
        positive: ["6", 0],
        negative: ["5", 0],
        latent_image: ["3", 0],
      },
      class_type: "KSampler",
      _meta: { title: "KSampler" },
    },
    "8": {
      inputs: { samples: ["7", 0], vae: ["1", 2] },
      class_type: "VAEDecode",
      _meta: { title: "VAE Decode" },
    },
    "9": {
      inputs: { filename_prefix: "Recreate", images: ["8", 0] },
      class_type: "SaveImage",
      _meta: { title: "Save Image" },
    },
  };

  let jobId: string | null = null;
  let errorMessage: string | null = null;
  try {
    const res = await fetch(`${fluxUrl}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${runpodKey}` },
      body: JSON.stringify({ input: { workflow } }),
    });
    const job = (await res.json()) as Record<string, unknown>;
    if (typeof job?.id === "string") {
      jobId = job.id;
    } else {
      errorMessage =
        (typeof job?.error === "string" && job.error) ||
        (typeof job?.message === "string" && job.message) ||
        `RunPod returned ${res.status}`;
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "RunPod request failed";
  }

  if (!jobId) {
    return NextResponse.json({ ok: false, error: errorMessage || "RunPod did not return a job id" }, { status: 502 });
  }

  const { data: row, error: insertErr } = await db
    .from("generated_images")
    .insert({
      profile_id: ownerId,
      client_id: clientIdInput || null,
      prompt,
      model: "flux1-dev-fp8-img2img",
      width: dims.width,
      height: dims.height,
      status: "processing",
      job_id: jobId,
      metadata: {
        source: "recreate",
        youtube_video_id: videoId,
        reference_url: refPublic,
        style_modifier: styleModifier || null,
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
    job_id: jobId,
    status: "processing",
    video_id: videoId,
    reference_url: refPublic,
    poll_url: `/api/thumbnail/status?job_id=${jobId}`,
  });
}
