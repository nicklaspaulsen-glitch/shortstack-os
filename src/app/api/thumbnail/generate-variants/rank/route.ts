import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { anthropic, MODEL_SONNET, getResponseText, safeJsonParse } from "@/lib/ai/claude-helpers";

// ──────────────────────────────────────────────────────────────────────────
// POST /api/thumbnail/generate-variants/rank
// Body: {
//   variants: [{ thumbnail_id?: string, image_url: string }, ...]  // 2-4 items
//   context?: string   // optional — "video topic" for Claude to reason about
// }
//
// Uses Claude Sonnet vision to score each thumbnail's predicted CTR on a 0-100
// scale, ranks them, and flags a top_variant_id. Silent no-op on failure — the
// UI keeps showing the unranked grid.
// ──────────────────────────────────────────────────────────────────────────

export const maxDuration = 60;

interface RankVariantInput {
  thumbnail_id?: string;
  image_url: string;
}

interface RankingPayload {
  rankings: Array<{
    index: number;
    score: number;
    reason: string;
  }>;
  top_index: number;
}

async function urlToBase64Image(url: string): Promise<{ data: string; mediaType: "image/png" | "image/jpeg" | "image/webp" } | null> {
  try {
    // Data URL already — extract the base64 + media type directly.
    if (url.startsWith("data:image/")) {
      const match = url.match(/^data:(image\/[a-z]+);base64,(.+)$/i);
      if (!match) return null;
      const mediaType =
        match[1] === "image/png" || match[1] === "image/jpeg" || match[1] === "image/webp"
          ? (match[1] as "image/png" | "image/jpeg" | "image/webp")
          : "image/png";
      return { data: match[2], mediaType };
    }
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type") || "image/png";
    const mediaType: "image/png" | "image/jpeg" | "image/webp" =
      ct.includes("jpeg") ? "image/jpeg" : ct.includes("webp") ? "image/webp" : "image/png";
    return { data: buf.toString("base64"), mediaType };
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

  let body: { variants?: unknown; context?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const rawVariants = Array.isArray(body.variants) ? (body.variants as unknown[]) : [];
  const variants: RankVariantInput[] = rawVariants
    .filter((v): v is Record<string, unknown> => v !== null && typeof v === "object")
    .map((v) => ({
      thumbnail_id: typeof v.thumbnail_id === "string" ? v.thumbnail_id : undefined,
      image_url: typeof v.image_url === "string" ? v.image_url : "",
    }))
    .filter((v) => !!v.image_url);

  if (variants.length < 2 || variants.length > 4) {
    return NextResponse.json(
      { ok: false, error: "Provide 2-4 variants with image_url populated" },
      { status: 400 },
    );
  }

  const contextText = typeof body.context === "string" ? body.context.slice(0, 240) : "";

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }

  // Ownership check — if thumbnail_ids provided, ensure they belong to this user.
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

  const ids = variants.map((v) => v.thumbnail_id).filter((id): id is string => !!id);
  if (ids.length > 0) {
    const { data: rows } = await db
      .from("generated_images")
      .select("id, profile_id")
      .in("id", ids);
    const ownerViolation = (rows || []).some((r) => (r as { profile_id: string }).profile_id !== ownerId);
    if (ownerViolation) {
      return NextResponse.json({ ok: false, error: "One or more variants not owned by caller" }, { status: 403 });
    }
  }

  // Fetch all images to base64 in parallel.
  const images = await Promise.all(variants.map((v) => urlToBase64Image(v.image_url)));
  const missing = images.some((img) => !img);
  if (missing) {
    return NextResponse.json(
      { ok: false, error: "Could not fetch one or more variant images" },
      { status: 502 },
    );
  }

  // Build Claude message with all images + ranking instructions.
  const imageBlocks = (images as Array<NonNullable<Awaited<ReturnType<typeof urlToBase64Image>>>>).map(
    (img, i) =>
      [
        {
          type: "text" as const,
          text: `Variant ${i + 1}:`,
        },
        {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: img.mediaType,
            data: img.data,
          },
        },
      ],
  ).flat();

  const systemPrompt =
    "You are a viral YouTube thumbnail expert. Score each variant on predicted CTR (0-100), " +
    "considering visual hierarchy, emotional impact, contrast, face-energy, clarity at 320x180 preview size, " +
    "curiosity gap, and scroll-stopping power. Output JSON only — no markdown, no preamble.";

  let payload: RankingPayload | null = null;
  try {
    const resp = await anthropic.messages.create({
      model: MODEL_SONNET,
      max_tokens: 600,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                (contextText ? `Video topic: "${contextText}"\n\n` : "") +
                `Rank these ${variants.length} thumbnail variants by predicted CTR. Output this JSON and nothing else:\n` +
                `{\n` +
                `  "rankings": [\n` +
                `    { "index": 0, "score": 78, "reason": "one sentence" },\n` +
                `    { "index": 1, "score": 65, "reason": "one sentence" }\n` +
                `  ],\n` +
                `  "top_index": 0\n` +
                `}\n` +
                `Indexes are 0-based and correspond to Variant 1, Variant 2, etc.`,
            },
            ...imageBlocks,
          ],
        },
      ],
    });
    payload = safeJsonParse<RankingPayload>(getResponseText(resp));
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Claude vision call failed" },
      { status: 502 },
    );
  }

  if (!payload || !Array.isArray(payload.rankings) || payload.rankings.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Claude did not return a parseable ranking" },
      { status: 502 },
    );
  }

  // Normalize: clip scores to 0-100, pair back with thumbnail_ids, compute top.
  const rankings = payload.rankings
    .filter((r) => Number.isFinite(r.index) && Number.isFinite(r.score))
    .map((r) => ({
      index: Math.max(0, Math.min(variants.length - 1, Math.round(r.index))),
      thumbnail_id: variants[Math.max(0, Math.min(variants.length - 1, Math.round(r.index)))]?.thumbnail_id || null,
      score: Math.max(0, Math.min(100, Math.round(r.score))),
      reason: String(r.reason || "").slice(0, 240),
    }));

  if (rankings.length === 0) {
    return NextResponse.json({ ok: false, error: "Ranking payload had no valid entries" }, { status: 502 });
  }

  const topEntry = rankings.reduce((best, cur) => (cur.score > best.score ? cur : best), rankings[0]);

  // Persist the ranking onto each row's metadata so /history can show badges.
  if (ids.length > 0) {
    await Promise.all(
      rankings.map(async (r) => {
        if (!r.thumbnail_id) return;
        const { data: existing } = await db
          .from("generated_images")
          .select("metadata")
          .eq("id", r.thumbnail_id)
          .maybeSingle();
        const prev = ((existing as { metadata: Record<string, unknown> } | null)?.metadata || {}) as Record<string, unknown>;
        await db
          .from("generated_images")
          .update({
            metadata: {
              ...prev,
              ctr_score: r.score,
              ctr_reason: r.reason,
              ctr_is_top: r.thumbnail_id === topEntry.thumbnail_id,
            },
          })
          .eq("id", r.thumbnail_id);
      }),
    );
  }

  return NextResponse.json({
    ok: true,
    rankings,
    top_index: topEntry.index,
    top_thumbnail_id: topEntry.thumbnail_id,
  });
}
