import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { checkLimit, recordUsage } from "@/lib/usage-limits";
import {
  anthropic,
  MODEL_SONNET,
  safeJsonParse,
  getResponseText,
} from "@/lib/ai/claude-helpers";
import {
  VIRAL_REFERENCE_LIBRARY,
  pickReferenceExemplars,
  renderExemplarsForSystemPrompt,
  type ViralPattern,
} from "@/lib/viral-reference-library";

// ──────────────────────────────────────────────────────────────────────
// POST /api/video/analyze-viral
//
// Body: { source_url, client_id?, store_as_template? }
//   source_url: YouTube / Shorts / TikTok URL.
//
// Flow:
//   1. Auth + ownerId + checkLimit(tokens, 3).
//   2. For YouTube: fetch maxresdefault.jpg + optional oEmbed title/channel.
//      For TikTok: return a graceful error for now.
//   3. Claude Sonnet Vision extracts a ViralPattern using few-shot
//      exemplars from viral-reference-library.
//   4. Optionally persist to viral_templates.
//   5. Return the pattern + a prompt suffix that can be pasted into
//      thumbnail/video generation to nudge the output toward the pattern.
// ──────────────────────────────────────────────────────────────────────

export const maxDuration = 60;

interface AnalyzeViralInput {
  source_url?: string;
  client_id?: string;
  store_as_template?: boolean;
  /** Optional hint — lets the caller bias few-shot exemplar selection. */
  niche_hint?: string;
}

function extractYouTubeId(raw: string): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    const seg = url.pathname.replace(/^\//, "").split("/")[0];
    return seg && /^[A-Za-z0-9_-]{6,}$/.test(seg) ? seg : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    const v = url.searchParams.get("v");
    if (v && /^[A-Za-z0-9_-]{6,}$/.test(v)) return v;
    const m = url.pathname.match(/\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{6,})/);
    if (m) return m[1];
  }
  return null;
}

function isTikTokUrl(raw: string): boolean {
  try {
    const url = new URL(raw.trim());
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    return host === "tiktok.com" || host.endsWith(".tiktok.com") || host === "vm.tiktok.com";
  } catch {
    return false;
  }
}

async function fetchYouTubeThumbnail(
  videoId: string
): Promise<{ buf: Buffer; contentType: string } | null> {
  const candidates = [
    `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
  ];
  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.byteLength > 1000) {
          return { buf, contentType: res.headers.get("content-type") || "image/jpeg" };
        }
      }
    } catch {
      // try next
    }
  }
  return null;
}

async function fetchYouTubeOEmbed(videoId: string): Promise<{ title?: string; author?: string } | null> {
  try {
    const url = `https://www.youtube.com/oembed?url=https://youtu.be/${videoId}&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const j = (await res.json()) as Record<string, unknown>;
    return {
      title: typeof j.title === "string" ? j.title : undefined,
      author: typeof j.author_name === "string" ? j.author_name : undefined,
    };
  } catch {
    return null;
  }
}

function buildApplyToPromptSuffix(pattern: ViralPattern): string {
  const p = pattern.thumbnail_pattern;
  const sig = pattern.estimated_edit_signature;
  const pieces: string[] = [];
  if (p.composition) pieces.push(`composition: ${p.composition}`);
  if (p.subject_emotion) pieces.push(`subject expression: ${p.subject_emotion}`);
  if (p.hook_element) pieces.push(`visual hook: ${p.hook_element}`);
  if (p.text_overlay_style) pieces.push(`text style: ${p.text_overlay_style}`);
  if (Array.isArray(p.dominant_colors) && p.dominant_colors.length) {
    pieces.push(`dominant colors: ${p.dominant_colors.slice(0, 4).join(", ")}`);
  }
  if (sig.color_grade) pieces.push(`color grade: ${sig.color_grade}`);
  if (sig.pacing) pieces.push(`pacing: ${sig.pacing}`);
  return pieces.length ? `Reference the viral pattern — ${pieces.join("; ")}.` : "";
}

function normaliseMediaType(
  mt: string
): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  if (mt.includes("png")) return "image/png";
  if (mt.includes("gif")) return "image/gif";
  if (mt.includes("webp")) return "image/webp";
  return "image/jpeg";
}

const OUTPUT_SHAPE_NOTE = `OUTPUT — respond with ONLY raw JSON matching:
{
  "thumbnail_pattern": {
    "composition": string (concise, kebab-case preferred, e.g. "centered-face-with-giant-number"),
    "dominant_colors": string[]  // 2-4 CSS hex colors
    "text_overlay_style": string,
    "subject_emotion": string,
    "hook_element": string
  },
  "estimated_edit_signature": {
    "pacing": "fast" | "medium" | "slow",
    "likely_cut_frequency_sec": number (0.5..10),
    "probable_sfx_categories": string[]  // e.g. ["whoosh","impact","riser","meme","pop","cinematic","ambient","ui-click"]
    "probable_captions": boolean,
    "color_grade": string
  },
  "recommended_creator_pack_id": string | null,  // one of the creator_<name> ids you recognize, else null
  "key_elements_to_replicate": string[]  // 3-6 bullet-style action items
}
No markdown fences. No commentary.`;

function buildSystemPrompt(fewShot: string): string {
  return `You are a senior YouTube creative director who reverse-engineers what makes viral thumbnails and edits work.

Given (a) a still thumbnail and (b) optional title + view count, extract a structured pattern that another creator could replicate in their own niche.

Use these annotated exemplars as reference for the output shape and level of detail:

${fewShot}

${OUTPUT_SHAPE_NOTE}`;
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ ok: false, error: "Profile not found" }, { status: 404 });
  }

  // Plan-tier metering — analyse = 3 tokens (frame + vision + formatting).
  const check = await checkLimit(ownerId, "tokens", 3);
  if (!check.allowed) {
    return NextResponse.json(
      { ok: false, error: check.reason || "Monthly token limit reached", limit: check },
      { status: 429 }
    );
  }

  let body: AnalyzeViralInput;
  try {
    body = (await request.json()) as AnalyzeViralInput;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const sourceUrl = typeof body.source_url === "string" ? body.source_url.trim() : "";
  if (!sourceUrl) {
    return NextResponse.json({ ok: false, error: "source_url required" }, { status: 400 });
  }
  const storeAsTemplate = body.store_as_template === true;
  const nicheHint = typeof body.niche_hint === "string" ? body.niche_hint.trim() : "";
  let clientIdInput = typeof body.client_id === "string" ? body.client_id : "";

  const db = createServiceClient();

  // Resolve client scope — mirror the recreate route so clients are auto-scoped
  // and agencies can't attach to a client that isn't theirs.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, parent_agency_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ ok: false, error: "Profile not found" }, { status: 404 });
  }
  const role = (profile as { role: string }).role;
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

  // ── 1. Resolve source ─────────────────────────────────────────────
  const videoId = extractYouTubeId(sourceUrl);
  const tikTok = !videoId && isTikTokUrl(sourceUrl);

  if (!videoId && tikTok) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "TikTok extraction is not wired yet — for now, please paste a YouTube, Shorts, or youtu.be URL. TikTok support will ship once upstream scraping is compliant.",
        tiktok_detected: true,
      },
      { status: 422 }
    );
  }
  if (!videoId) {
    return NextResponse.json(
      { ok: false, error: "Unsupported URL — expected a YouTube video, Shorts, or youtu.be link" },
      { status: 400 }
    );
  }

  // ── 2. Fetch thumbnail + oEmbed metadata ──────────────────────────
  const thumb = await fetchYouTubeThumbnail(videoId);
  if (!thumb) {
    return NextResponse.json(
      {
        ok: false,
        error: `Could not fetch thumbnail for video ${videoId} (may be private or deleted)`,
      },
      { status: 404 }
    );
  }
  const oembed = await fetchYouTubeOEmbed(videoId);

  // ── 3. Claude Sonnet Vision — extract pattern ────────────────────
  const exemplars = pickReferenceExemplars(
    { niche: nicheHint || null, creator_pack_id: null },
    5
  );
  const systemPrompt = buildSystemPrompt(renderExemplarsForSystemPrompt(exemplars));

  const metaLine =
    `Video metadata:\n` +
    `- youtube_id: ${videoId}\n` +
    (oembed?.title ? `- title: ${oembed.title}\n` : "") +
    (oembed?.author ? `- channel: ${oembed.author}\n` : "") +
    (nicheHint ? `- niche hint: ${nicheHint}\n` : "") +
    `Source: ${sourceUrl}`;

  let pattern: ViralPattern | null = null;
  let aiError: string | null = null;
  try {
    const imageSource: Anthropic.ImageBlockParam["source"] = {
      type: "base64",
      media_type: normaliseMediaType(thumb.contentType),
      data: thumb.buf.toString("base64"),
    };
    const resp = await anthropic.messages.create({
      model: MODEL_SONNET,
      max_tokens: 1600,
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: imageSource },
            {
              type: "text",
              text:
                `${metaLine}\n\n` +
                `Extract the viral pattern for this video. Focus on what a creator in a different niche would need to replicate to hit the same attention triggers. Output JSON only.`,
            },
          ],
        },
      ],
    });
    const raw = getResponseText(resp);
    const parsed = safeJsonParse<ViralPattern>(raw);
    if (parsed && parsed.thumbnail_pattern && parsed.estimated_edit_signature) {
      // Normalise enum-ish fields + guard downstream consumers.
      const thumbnail_pattern = {
        composition: String(parsed.thumbnail_pattern.composition || ""),
        dominant_colors: Array.isArray(parsed.thumbnail_pattern.dominant_colors)
          ? (parsed.thumbnail_pattern.dominant_colors as unknown[])
              .filter((v) => typeof v === "string")
              .slice(0, 6) as string[]
          : [],
        text_overlay_style: String(parsed.thumbnail_pattern.text_overlay_style || ""),
        subject_emotion: String(parsed.thumbnail_pattern.subject_emotion || ""),
        hook_element: String(parsed.thumbnail_pattern.hook_element || ""),
      };
      const pacingRaw = String(parsed.estimated_edit_signature.pacing || "").toLowerCase();
      const pacing: "fast" | "medium" | "slow" =
        pacingRaw === "fast" || pacingRaw === "slow" ? pacingRaw : "medium";
      const sfx = Array.isArray(parsed.estimated_edit_signature.probable_sfx_categories)
        ? (parsed.estimated_edit_signature.probable_sfx_categories as unknown[])
            .filter((v) => typeof v === "string")
            .slice(0, 8) as string[]
        : [];
      const estimated_edit_signature = {
        pacing,
        likely_cut_frequency_sec: Number(parsed.estimated_edit_signature.likely_cut_frequency_sec) || 3,
        probable_sfx_categories: sfx,
        probable_captions: parsed.estimated_edit_signature.probable_captions === true,
        color_grade: String(parsed.estimated_edit_signature.color_grade || ""),
      };
      const keyElems = Array.isArray(parsed.key_elements_to_replicate)
        ? (parsed.key_elements_to_replicate as unknown[])
            .filter((v) => typeof v === "string")
            .slice(0, 8) as string[]
        : [];
      pattern = {
        thumbnail_pattern,
        estimated_edit_signature,
        recommended_creator_pack_id:
          typeof parsed.recommended_creator_pack_id === "string"
            ? parsed.recommended_creator_pack_id
            : undefined,
        key_elements_to_replicate: keyElems,
      };
    } else {
      aiError = "Claude returned an unparseable pattern payload.";
    }
  } catch (err) {
    aiError = err instanceof Error ? err.message : "Claude call failed";
  }

  if (!pattern) {
    return NextResponse.json(
      { ok: false, error: aiError || "Failed to analyze viral pattern" },
      { status: 502 }
    );
  }

  // ── 4. Optionally persist as template ─────────────────────────────
  let templateId: string | null = null;
  if (storeAsTemplate) {
    const templateName =
      oembed?.title ||
      `Viral template ${videoId}`;
    const { data: row, error: insertErr } = await db
      .from("viral_templates")
      .insert({
        user_id: ownerId,
        source_url: sourceUrl,
        name: templateName.slice(0, 180),
        pattern,
      })
      .select("id")
      .single();
    if (!insertErr && row) {
      templateId = (row as { id: string }).id;
    }
  }

  // ── 5. Record usage + respond ────────────────────────────────────
  await recordUsage(ownerId, "tokens", 3, {
    feature: "analyze_viral",
    youtube_id: videoId,
  });

  const applyToPrompt = buildApplyToPromptSuffix(pattern);

  return NextResponse.json({
    ok: true,
    source: {
      youtube_id: videoId,
      title: oembed?.title || null,
      channel: oembed?.author || null,
      thumbnail_url: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    },
    pattern,
    apply_to_prompt: applyToPrompt,
    template_id: templateId,
    stored_as_template: Boolean(templateId),
    client_id: clientIdInput || null,
    limit: check,
  });
}

// Expose the reference library via GET so the dashboard can render it when
// users want to browse curated examples before analysing their own.
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const nicheParam = request.nextUrl.searchParams.get("niche");
  const entries = nicheParam
    ? VIRAL_REFERENCE_LIBRARY.filter((e) => e.niche === nicheParam)
    : VIRAL_REFERENCE_LIBRARY;
  return NextResponse.json({
    ok: true,
    count: entries.length,
    entries,
    niches: Array.from(new Set(VIRAL_REFERENCE_LIBRARY.map((e) => e.niche))).sort(),
  });
}
