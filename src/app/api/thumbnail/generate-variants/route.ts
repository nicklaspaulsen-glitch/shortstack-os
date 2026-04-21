import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { checkLimit, recordUsage } from "@/lib/usage-limits";

// Each FLUX variant costs ~1000 "tokens" in the plan budget — keep this
// in sync with the constant in thumbnail/generate/route.ts.
const THUMBNAIL_TOKEN_COST = 1000;

// ──────────────────────────────────────────────────────────────────────────
// POST /api/thumbnail/generate-variants
// Body: {
//   prompt: string,
//   variants?: 2 | 3 | 4,        // default 4 (beats Pikzels' 1)
//   style?: string,
//   aspect?: "16:9"|"9:16"|"1:1",
//   client_id?: string,
//   negative_prompt?: string,
// }
//
// Fires N FLUX jobs in parallel — each with a different random seed and a
// slight style-variant prompt tweak so the outputs look meaningfully different.
// Returns { ok: true, variants: [{ thumbnail_id, job_id, variant_label }, ...] }.
//
// CTR ranking happens separately via POST /api/thumbnail/generate-variants/rank
// once the caller has polled /status and has image URLs for all variants.
// ──────────────────────────────────────────────────────────────────────────

export const maxDuration = 60;

const VARIANT_TWEAKS = [
  { label: "cinematic", modifier: "cinematic widescreen composition, dramatic volumetric lighting, teal and orange color grading, anamorphic lens" },
  { label: "vibrant", modifier: "extremely vibrant saturated colors, pop-art neon energy, high contrast bold palette, electric feel" },
  { label: "minimal", modifier: "ultra-clean minimal composition, lots of negative space, single strong focal point, solid gradient background" },
  { label: "bold-text", modifier: "bold graphic design composition, strong geometric shapes, clean separation of subject and background, designed for large text overlay" },
];

function buildFluxTxt2ImgWorkflow(opts: {
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  seed: number;
}) {
  return {
    "6": { inputs: { text: opts.prompt, clip: ["30", 1] }, class_type: "CLIPTextEncode" },
    "8": { inputs: { samples: ["31", 0], vae: ["30", 2] }, class_type: "VAEDecode" },
    "9": { inputs: { filename_prefix: "Variant", images: ["8", 0] }, class_type: "SaveImage" },
    "27": { inputs: { width: opts.width, height: opts.height, batch_size: 1 }, class_type: "EmptySD3LatentImage" },
    "30": { inputs: { ckpt_name: "flux1-dev-fp8.safetensors" }, class_type: "CheckpointLoaderSimple" },
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
    },
    "33": { inputs: { text: opts.negativePrompt, clip: ["30", 1] }, class_type: "CLIPTextEncode" },
    "35": { inputs: { guidance: 3.5, conditioning: ["6", 0] }, class_type: "FluxGuidance" },
  };
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: {
    prompt?: unknown;
    variants?: unknown;
    style?: unknown;
    aspect?: unknown;
    client_id?: unknown;
    negative_prompt?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return NextResponse.json({ ok: false, error: "prompt required" }, { status: 400 });

  const rawCount = Number(body.variants);
  const count = Math.max(2, Math.min(4, Number.isFinite(rawCount) ? Math.round(rawCount) : 4));
  const style = typeof body.style === "string" ? body.style : "youtube_classic";
  const aspect = typeof body.aspect === "string" ? body.aspect : "16:9";
  let clientIdInput = typeof body.client_id === "string" ? body.client_id : "";
  const userNegative = typeof body.negative_prompt === "string" ? body.negative_prompt.trim() : "";

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
    const { data: ownClient } = await db.from("clients").select("id").eq("profile_id", user.id).maybeSingle();
    clientIdInput = (ownClient as { id?: string } | null)?.id ?? "";
  } else if (clientIdInput) {
    const { data: c } = await db.from("clients").select("id, profile_id").eq("id", clientIdInput).maybeSingle();
    if (!c || (c as { profile_id: string }).profile_id !== ownerId) {
      return NextResponse.json({ ok: false, error: "Client not found or access denied" }, { status: 403 });
    }
  }

  // Plan-tier token gate — variants multiply the infra cost by N, so this
  // is the hottest route to leave ungated. (bug-hunt-apr20-v2 HIGH #12)
  const estimatedTokens = THUMBNAIL_TOKEN_COST * count;
  const gate = await checkLimit(ownerId, "tokens", estimatedTokens);
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

  const defaultNegative =
    "blurry, low quality, deformed, ugly, watermark, signature, cropped, worst quality, jpeg artifacts, " +
    "text in image, words in image, letters, writing, typography rendered, cluttered background";
  const negativePrompt = userNegative || defaultNegative;

  const tweaks = VARIANT_TWEAKS.slice(0, count);
  const jobs = await Promise.all(
    tweaks.map(async (tweak, i) => {
      const variantPrompt = `${prompt}, ${tweak.modifier}`;
      const seed = Math.floor(Math.random() * 2147483647) + i * 1000;
      try {
        const res = await fetch(`${fluxUrl}/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${runpodKey}` },
          body: JSON.stringify({
            input: {
              workflow: buildFluxTxt2ImgWorkflow({
                prompt: variantPrompt,
                negativePrompt,
                width: genWidth,
                height: genHeight,
                seed,
              }),
            },
          }),
        });
        const job = (await res.json()) as Record<string, unknown>;
        const jobId = typeof job?.id === "string" ? job.id : null;
        return {
          label: tweak.label,
          modifier: tweak.modifier,
          prompt: variantPrompt,
          seed,
          jobId,
          error: jobId ? null : ((job?.error as string) || (job?.message as string) || `RunPod ${res.status}`),
        };
      } catch (err) {
        return {
          label: tweak.label,
          modifier: tweak.modifier,
          prompt: variantPrompt,
          seed,
          jobId: null,
          error: err instanceof Error ? err.message : "RunPod request failed",
        };
      }
    }),
  );

  const successes = jobs.filter((j) => j.jobId);
  if (successes.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "All FLUX jobs failed to queue",
        worker_errors: jobs.map((j) => j.error).filter(Boolean),
      },
      { status: 502 },
    );
  }

  const rowsToInsert = successes.map((j) => ({
    profile_id: ownerId,
    client_id: clientIdInput || null,
    prompt: j.prompt,
    model: "flux1-dev-fp8",
    width: dims.width,
    height: dims.height,
    status: "processing" as const,
    job_id: j.jobId,
    metadata: {
      source: "variants",
      variant_label: j.label,
      variant_modifier: j.modifier,
      base_prompt: prompt,
      style,
      aspect,
      seed: j.seed,
    },
  }));

  const { data: inserted, error: insertErr } = await db
    .from("generated_images")
    .insert(rowsToInsert)
    .select("id, job_id, metadata");
  if (insertErr || !inserted) {
    return NextResponse.json(
      { ok: false, error: insertErr?.message || "Failed to persist variant rows" },
      { status: 500 },
    );
  }

  // Meter on actual queued count (not requested) so partial failures don't
  // double-charge the plan budget.
  if (inserted.length > 0) {
    await recordUsage(
      ownerId,
      "tokens",
      THUMBNAIL_TOKEN_COST * inserted.length,
      { kind: "thumbnail_variants", count: inserted.length },
    );
  }

  return NextResponse.json({
    ok: true,
    variants: (inserted as Array<{ id: string; job_id: string; metadata: { variant_label?: string; seed?: number } }>).map(
      (r) => ({
        thumbnail_id: r.id,
        job_id: r.job_id,
        variant_label: r.metadata?.variant_label || null,
        seed: r.metadata?.seed ?? null,
        poll_url: `/api/thumbnail/status?job_id=${r.job_id}`,
      }),
    ),
    failures: jobs
      .filter((j) => !j.jobId)
      .map((j) => ({ label: j.label, error: j.error })),
  });
}
