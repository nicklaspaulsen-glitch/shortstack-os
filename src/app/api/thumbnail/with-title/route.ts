import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { anthropic, MODEL_HAIKU, getResponseText, safeJsonParse } from "@/lib/ai/claude-helpers";

// ──────────────────────────────────────────────────────────────────────────
// POST /api/thumbnail/with-title
// Body: { topic: string, style?: string, client_id?: string,
//         aspect?: "16:9"|"9:16"|"1:1", variants?: number }
//
// Step A: Haiku generates a punchy YouTube title (<60 chars), a 1-6-word
//         thumbnail text overlay, and a detailed FLUX image prompt for the
//         thumbnail scene.
// Step B: Fires N FLUX jobs in parallel (default 1) using the generated
//         prompt and records them in generated_images.
//
// Response: { ok: true, title, thumbnail_text_overlay, prompt, thumbnail_id,
//             job_id, poll_url, variants?: [{ thumbnail_id, job_id, seed }] }
// ──────────────────────────────────────────────────────────────────────────

export const maxDuration = 60;

interface TitleAiPayload {
  title: string;
  thumbnail_text_overlay: string;
  flux_prompt: string;
}

function buildFluxTxt2ImgWorkflow(opts: {
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  seed: number;
}) {
  return {
    "6": {
      inputs: { text: opts.prompt, clip: ["30", 1] },
      class_type: "CLIPTextEncode",
      _meta: { title: "CLIP Text Encode (Positive)" },
    },
    "8": {
      inputs: { samples: ["31", 0], vae: ["30", 2] },
      class_type: "VAEDecode",
      _meta: { title: "VAE Decode" },
    },
    "9": {
      inputs: { filename_prefix: "WithTitle", images: ["8", 0] },
      class_type: "SaveImage",
      _meta: { title: "Save Image" },
    },
    "27": {
      inputs: { width: opts.width, height: opts.height, batch_size: 1 },
      class_type: "EmptySD3LatentImage",
      _meta: { title: "Empty Latent" },
    },
    "30": {
      inputs: { ckpt_name: "flux1-dev-fp8.safetensors" },
      class_type: "CheckpointLoaderSimple",
      _meta: { title: "Load Checkpoint" },
    },
    "31": {
      inputs: {
        seed: opts.seed,
        steps: 12,
        cfg: 1,
        sampler_name: "euler",
        scheduler: "simple",
        denoise: 1,
        model: ["30", 0],
        positive: ["35", 0],
        negative: ["33", 0],
        latent_image: ["27", 0],
      },
      class_type: "KSampler",
      _meta: { title: "KSampler" },
    },
    "33": {
      inputs: { text: opts.negativePrompt, clip: ["30", 1] },
      class_type: "CLIPTextEncode",
      _meta: { title: "CLIP Text Encode (Negative)" },
    },
    "35": {
      inputs: { guidance: 3.5, conditioning: ["6", 0] },
      class_type: "FluxGuidance",
      _meta: { title: "FluxGuidance" },
    },
  };
}

async function generateTitleAndPrompt(topic: string, style: string): Promise<TitleAiPayload | null> {
  try {
    const resp = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 400,
      temperature: 0.8,
      system:
        "You are a viral YouTube creative director. Given a topic and visual style, produce JSON only — " +
        "no preamble, no markdown fences, just the JSON object.",
      messages: [
        {
          role: "user",
          content:
            `Topic: "${topic}"\n` +
            `Style: "${style}"\n\n` +
            `Output exactly this JSON shape and nothing else:\n` +
            `{\n` +
            `  "title": string (under 60 chars, punchy, curiosity gap, no clickbait lies),\n` +
            `  "thumbnail_text_overlay": string (1-6 words, ALL CAPS OK, the big text that goes ON the thumbnail),\n` +
            `  "flux_prompt": string (60-120 words describing the thumbnail image — exaggerated expressions MrBeast-style, bold 2-3 color palette, clean background with blur, dramatic studio lighting, single strong focal point; do NOT describe any text — we overlay text separately)\n` +
            `}`,
        },
      ],
    });
    const parsed = safeJsonParse<TitleAiPayload>(getResponseText(resp));
    if (!parsed || !parsed.title || !parsed.flux_prompt) return null;
    return {
      title: String(parsed.title).slice(0, 120),
      thumbnail_text_overlay: String(parsed.thumbnail_text_overlay || "").slice(0, 60),
      flux_prompt: String(parsed.flux_prompt),
    };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: {
    topic?: unknown;
    style?: unknown;
    client_id?: unknown;
    aspect?: unknown;
    variants?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  if (!topic) return NextResponse.json({ ok: false, error: "topic required" }, { status: 400 });
  const style = typeof body.style === "string" ? body.style : "youtube_classic";
  const aspect = typeof body.aspect === "string" ? body.aspect : "16:9";
  const variantCount = Math.max(1, Math.min(4, Number(body.variants) || 1));
  let clientIdInput = typeof body.client_id === "string" ? body.client_id : "";

  const db = createServiceClient();

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

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }

  // Step A — title + overlay + FLUX prompt
  const ai = await generateTitleAndPrompt(topic, style);
  if (!ai) {
    return NextResponse.json(
      { ok: false, error: "Title AI failed — could not parse JSON response from Claude" },
      { status: 502 },
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
    "text in image, words in image, letters, writing, font, typography rendered, " +
    "cluttered background, busy composition, multiple focal points, amateur photography";

  // Step B — kick off N FLUX jobs in parallel.
  const seeds = Array.from({ length: variantCount }, (_, i) => Math.floor(Math.random() * 2147483647) + i * 1000);
  const jobPromises = seeds.map(async (seed) => {
    try {
      const res = await fetch(`${fluxUrl}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${runpodKey}` },
        body: JSON.stringify({
          input: {
            workflow: buildFluxTxt2ImgWorkflow({
              prompt: ai.flux_prompt,
              negativePrompt,
              width: genWidth,
              height: genHeight,
              seed,
            }),
          },
        }),
      });
      const job = (await res.json()) as Record<string, unknown>;
      if (typeof job?.id === "string") return { seed, jobId: job.id };
      return {
        seed,
        jobId: null,
        error: (job?.error as string) || (job?.message as string) || `RunPod ${res.status}`,
      };
    } catch (err) {
      return { seed, jobId: null, error: err instanceof Error ? err.message : "RunPod request failed" };
    }
  });
  const jobs = await Promise.all(jobPromises);

  // Insert rows for every successful job.
  const rowsToInsert = jobs
    .filter((j) => j.jobId)
    .map((j) => ({
      profile_id: ownerId,
      client_id: clientIdInput || null,
      prompt: ai.flux_prompt,
      model: "flux1-dev-fp8",
      width: dims.width,
      height: dims.height,
      status: "processing" as const,
      job_id: j.jobId,
      metadata: {
        source: "with_title",
        topic,
        title: ai.title,
        thumbnail_text_overlay: ai.thumbnail_text_overlay,
        style,
        aspect,
        seed: j.seed,
      },
    }));

  if (rowsToInsert.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "All FLUX jobs failed to queue",
        title: ai.title,
        thumbnail_text_overlay: ai.thumbnail_text_overlay,
        worker_errors: jobs.map((j) => j.error).filter(Boolean),
      },
      { status: 502 },
    );
  }

  const { data: insertedRows, error: insertErr } = await db
    .from("generated_images")
    .insert(rowsToInsert)
    .select("id, job_id, metadata");
  if (insertErr || !insertedRows) {
    return NextResponse.json(
      { ok: false, error: insertErr?.message || "Failed to persist rows" },
      { status: 500 },
    );
  }

  const firstRow = insertedRows[0] as { id: string; job_id: string };

  return NextResponse.json({
    ok: true,
    title: ai.title,
    thumbnail_text_overlay: ai.thumbnail_text_overlay,
    prompt: ai.flux_prompt,
    thumbnail_id: firstRow.id,
    job_id: firstRow.job_id,
    poll_url: `/api/thumbnail/status?job_id=${firstRow.job_id}`,
    variants:
      insertedRows.length > 1
        ? (insertedRows as Array<{ id: string; job_id: string; metadata: { seed?: number } }>).map((r) => ({
            thumbnail_id: r.id,
            job_id: r.job_id,
            seed: r.metadata?.seed ?? null,
          }))
        : undefined,
  });
}
