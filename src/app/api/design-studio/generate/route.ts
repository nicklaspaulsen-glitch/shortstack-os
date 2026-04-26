/**
 * Design Studio — /api/design-studio/generate
 *
 * POST: Generate an image from a text prompt using FLUX (RunPod).
 *       Uploads result to R2 and inserts a design_assets row.
 *       Returns { url, r2_key, asset_id } for the caller to patch into a layer.
 *
 * Security:
 *   - Auth gate (Supabase session)
 *   - Rate limit via checkAiRateLimit
 *   - R2 key is namespaced: designs/{ownerId}/{designId}/assets/{uuid}.png
 *   - No raw user input in R2 keys
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireOwnedClient } from "@/lib/security/require-owned-client";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import { uploadToR2 } from "@/lib/server/r2-client";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface GenerateBody {
  prompt: string;
  design_id: string;
  width?: number;
  height?: number;
  negative_prompt?: string;
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = await requireOwnedClient(supabase, user.id);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Rate limit — same pattern as agents/chief
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", user.id)
    .single();

  const rateLimited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (rateLimited) return rateLimited;

  let body: GenerateBody;
  try {
    body = (await req.json()) as GenerateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const PROMPT_MAX_LENGTH = 2000;

  if (typeof body.prompt !== "string" || body.prompt.trim().length === 0) {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }
  if (body.prompt.length > PROMPT_MAX_LENGTH) {
    return NextResponse.json(
      { error: `prompt exceeds ${PROMPT_MAX_LENGTH} chars` },
      { status: 400 },
    );
  }
  if (
    body.negative_prompt !== undefined &&
    (typeof body.negative_prompt !== "string" ||
      body.negative_prompt.length > PROMPT_MAX_LENGTH)
  ) {
    return NextResponse.json({ error: "invalid negative_prompt" }, { status: 400 });
  }
  if (!body.design_id || typeof body.design_id !== "string") {
    return NextResponse.json({ error: "design_id is required" }, { status: 400 });
  }

  // Verify design belongs to owner
  const { data: design } = await supabase
    .from("designs")
    .select("id, user_id")
    .eq("id", body.design_id)
    .single();
  if (!design || design.user_id !== ctx.ownerId) {
    return NextResponse.json({ error: "Design not found" }, { status: 404 });
  }

  const width = body.width ?? 1024;
  const height = body.height ?? 1024;

  const fluxUrl = process.env.RUNPOD_FLUX_URL;
  const fluxSecret = process.env.RUNPOD_FLUX_SECRET ?? process.env.RUNPOD_API_KEY;

  // Dev / offline fallback
  if (!fluxUrl || !fluxSecret) {
    return NextResponse.json(
      {
        status: "accepted",
        placeholder: true,
        url: `https://placehold.co/${width}x${height}/1a1a2e/C9A84C?text=FLUX+placeholder`,
        r2_key: null,
        asset_id: null,
        message: "RUNPOD_FLUX_URL not configured — returning placeholder.",
      },
      { status: 202 },
    );
  }

  try {
    const fluxResponse = await fetch(`${fluxUrl}/runsync`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${fluxSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          mode: "text_to_image",
          prompt: body.prompt.trim(),
          negative_prompt: body.negative_prompt ?? "",
          width,
          height,
          steps: 28,
          cfg: 7,
        },
      }),
    });

    if (!fluxResponse.ok) {
      const errText = await fluxResponse.text().catch(() => "");
      console.error("[design-studio/generate] RunPod error", fluxResponse.status, errText);
      return NextResponse.json(
        { error: "AI generation failed" },
        { status: 502 },
      );
    }

    const fluxData = (await fluxResponse.json()) as {
      output?: { image?: string };
    };

    const base64 = fluxData.output?.image;
    if (!base64) {
      return NextResponse.json({ error: "No image returned from AI" }, { status: 502 });
    }

    // Upload to R2 — key is namespaced, never contains raw user input
    const assetId = uuidv4();
    const r2Key = `designs/${ctx.ownerId}/${body.design_id}/assets/${assetId}.png`;
    const imageBuffer = Buffer.from(base64, "base64");
    const publicUrl = await uploadToR2(r2Key, imageBuffer, "image/png");

    // Record asset in DB
    const { data: asset } = await supabase
      .from("design_assets")
      .insert({
        user_id: ctx.ownerId,
        design_id: body.design_id,
        kind: "flux",
        prompt: body.prompt.trim(),
        r2_key: r2Key,
        mime: "image/png",
        width,
        height,
      })
      .select("id")
      .single();

    return NextResponse.json({
      url: publicUrl,
      r2_key: r2Key,
      asset_id: asset?.id ?? null,
    });
  } catch (err) {
    console.error("[design-studio/generate] unexpected error", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
