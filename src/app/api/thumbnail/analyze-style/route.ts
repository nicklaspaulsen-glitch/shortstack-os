import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import Anthropic from "@anthropic-ai/sdk";
import {
  anthropic,
  MODEL_SONNET,
  safeJsonParse,
  getResponseText,
} from "@/lib/ai/claude-helpers";

interface AnalyzeStyleInput {
  image_url?: string;
  image_base64?: string;
  niche?: string;
}

interface SuggestedTypography {
  enabled: boolean;
  fontId: string;
  weight: number;
  textCase: "uppercase" | "lowercase" | "titlecase" | "astyped";
  strokeEnabled: boolean;
  strokeWidth: number;
  strokeColor: string;
  shadowEnabled: boolean;
  shadowX: number;
  shadowY: number;
  shadowBlur: number;
  shadowColor: string;
  gradientEnabled: boolean;
  gradientFrom: string;
  gradientTo: string;
  letterSpacing: number;
  highlightWords: string;
  highlightColor: string;
}

interface SuggestedFace {
  autoCutoutEnabled: boolean;
  enhanceEnabled: boolean;
  eyePopEnabled: boolean;
  position: "left" | "center" | "right";
  layout: 1 | 2 | 3;
}

interface SuggestedBackground {
  mode: "solid" | "gradient" | "pattern" | "image" | "ai";
  solidColor: string;
  brightness: number;
  blurEnabled: boolean;
  blurAmount: number;
}

interface SuggestedConfig {
  typography: SuggestedTypography;
  face: SuggestedFace;
  background: SuggestedBackground;
  colors: { paletteId: string | null };
  elements: { ids: string[] };
}

interface AnalyzeStyleOutput {
  style_name: string;
  dominant_colors: string[];
  font_suggestion: string;
  layout: string;
  mood: string;
  suggested_config: SuggestedConfig;
}

const SYSTEM_PROMPT = `You are an elite YouTube thumbnail design analyst. Given a thumbnail image, you break down its visual DNA — style, color palette, typography, layout, subject placement, and mood — and return a precise JSON config that would let someone recreate a thumbnail in that same style.

WHAT TO EXTRACT
- Dominant colors (3-5 hex codes, most prominent first)
- Typography: what kind of font is used (impact, sans-serif, serif, handwritten, display)?
- Font treatment: is there stroke/outline? shadow? gradient fill? highlight words?
- Face/subject: is a person visible? what is their position (left/center/right)?
- Background: solid color, gradient, photographic scene, or abstract?
- Mood: dramatic, energetic, mysterious, educational, luxurious, playful, etc.
- Layout: centered-hero, split-screen, text-overlay, full-face, product-focus
- Graphical elements: arrows, circles, emojis, stickers, callouts?

OUTPUT SHAPE — respond with ONLY raw JSON matching:
{
  "style_name": "<short name for this style>",
  "dominant_colors": ["#RRGGBB", ...],
  "font_suggestion": "<one of: impact | anton | bebas | inter | poppins | montserrat | oswald | bangers>",
  "layout": "<one of: centered | left-face | right-face | split | full-bleed | text-hero>",
  "mood": "<one word>",
  "suggested_config": {
    "typography": {
      "enabled": true,
      "fontId": "<font id>",
      "weight": <100-900>,
      "textCase": "uppercase" | "lowercase" | "titlecase" | "astyped",
      "strokeEnabled": <bool>,
      "strokeWidth": <1-10>,
      "strokeColor": "#RRGGBB",
      "shadowEnabled": <bool>,
      "shadowX": <-20..20>,
      "shadowY": <-20..20>,
      "shadowBlur": <0..40>,
      "shadowColor": "#RRGGBB",
      "gradientEnabled": <bool>,
      "gradientFrom": "#RRGGBB",
      "gradientTo": "#RRGGBB",
      "letterSpacing": <-5..20>,
      "highlightWords": "<comma-separated words to highlight, or empty>",
      "highlightColor": "#RRGGBB"
    },
    "face": {
      "autoCutoutEnabled": <bool>,
      "enhanceEnabled": <bool>,
      "eyePopEnabled": <bool>,
      "position": "left" | "center" | "right",
      "layout": 1 | 2 | 3
    },
    "background": {
      "mode": "solid" | "gradient" | "pattern" | "image" | "ai",
      "solidColor": "#RRGGBB",
      "brightness": <60..140>,
      "blurEnabled": <bool>,
      "blurAmount": <0..30>
    },
    "colors": { "paletteId": "<palette id or null>" },
    "elements": { "ids": ["<element ids if any>"] }
  }
}

Return JSON only. No markdown, no commentary.`;

const FALLBACK_CONFIG: SuggestedConfig = {
  typography: {
    enabled: true,
    fontId: "impact",
    weight: 900,
    textCase: "uppercase",
    strokeEnabled: true,
    strokeWidth: 4,
    strokeColor: "#000000",
    shadowEnabled: true,
    shadowX: 2,
    shadowY: 2,
    shadowBlur: 6,
    shadowColor: "#000000",
    gradientEnabled: false,
    gradientFrom: "#F59E0B",
    gradientTo: "#DC2626",
    letterSpacing: 0,
    highlightWords: "",
    highlightColor: "#FBBF24",
  },
  face: {
    autoCutoutEnabled: false,
    enhanceEnabled: false,
    eyePopEnabled: false,
    position: "right",
    layout: 1,
  },
  background: {
    mode: "solid",
    solidColor: "#0F172A",
    brightness: 100,
    blurEnabled: false,
    blurAmount: 0,
  },
  colors: { paletteId: null },
  elements: { ids: [] },
};

async function downloadAsBase64(url: string): Promise<{ data: string; mediaType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image (${res.status})`);
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const buf = Buffer.from(await res.arrayBuffer());
  return { data: buf.toString("base64"), mediaType: contentType };
}

function normalizeMediaType(mt: string): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  if (mt.includes("png")) return "image/png";
  if (mt.includes("gif")) return "image/gif";
  if (mt.includes("webp")) return "image/webp";
  return "image/jpeg";
}

export async function POST(request: NextRequest) {
  const authSupabase = createServerSupabase();
  const {
    data: { user },
  } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await authSupabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", user.id)
    .single();
  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  let body: AnalyzeStyleInput;
  try {
    body = (await request.json()) as AnalyzeStyleInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.image_url && !body.image_base64) {
    return NextResponse.json(
      { error: "Either image_url or image_base64 is required" },
      { status: 400 }
    );
  }

  // Build the image content block. Claude supports url-source for http(s) images,
  // but we normalize to base64 for consistency and to avoid egress blocking in prod.
  let imageSource: Anthropic.ImageBlockParam["source"];
  try {
    if (body.image_base64) {
      // Strip data URL prefix if present
      const m = body.image_base64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      const data = m ? m[2] : body.image_base64;
      const mediaType = normalizeMediaType(m ? m[1] : "image/jpeg");
      imageSource = { type: "base64", media_type: mediaType, data };
    } else if (body.image_url) {
      const { data, mediaType } = await downloadAsBase64(body.image_url);
      imageSource = {
        type: "base64",
        media_type: normalizeMediaType(mediaType),
        data,
      };
    } else {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: "Failed to load image", detail: message },
      { status: 400 }
    );
  }

  const userText = `Analyze this thumbnail and return the JSON config.
Niche hint: ${body.niche ?? "general YouTube"}`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL_SONNET,
      max_tokens: 2048,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: imageSource },
            { type: "text", text: userText },
          ],
        },
      ],
    });

    const text = getResponseText(response);
    const parsed = safeJsonParse<AnalyzeStyleOutput>(text);

    if (!parsed || !parsed.suggested_config) {
      return NextResponse.json(
        {
          error: "Claude returned an invalid response",
          raw: text.slice(0, 500),
        },
        { status: 502 }
      );
    }

    // Merge with fallback defaults so any missing nested keys are populated
    const merged: AnalyzeStyleOutput = {
      style_name: parsed.style_name || "Custom Style",
      dominant_colors: Array.isArray(parsed.dominant_colors)
        ? parsed.dominant_colors.slice(0, 6)
        : [],
      font_suggestion: parsed.font_suggestion || "impact",
      layout: parsed.layout || "centered",
      mood: parsed.mood || "bold",
      suggested_config: {
        typography: { ...FALLBACK_CONFIG.typography, ...parsed.suggested_config.typography },
        face: { ...FALLBACK_CONFIG.face, ...parsed.suggested_config.face },
        background: { ...FALLBACK_CONFIG.background, ...parsed.suggested_config.background },
        colors: { ...FALLBACK_CONFIG.colors, ...parsed.suggested_config.colors },
        elements: { ...FALLBACK_CONFIG.elements, ...parsed.suggested_config.elements },
      },
    };

    const serviceSupabase = createServiceClient();
    void serviceSupabase.from("trinity_log").insert({
      action_type: "ai_thumbnail_analyze_style",
      description: `Analyzed thumbnail style: ${merged.style_name}`,
      profile_id: user.id,
      status: "completed",
      result: {
        style_name: merged.style_name,
        mood: merged.mood,
        generated_at: new Date().toISOString(),
      },
    });

    return NextResponse.json(merged);
  } catch (err) {
    console.error("[thumbnail/analyze-style] error", err);
    const message = err instanceof Error ? err.message : "Unknown Claude API error";
    return NextResponse.json(
      { error: "Failed to analyze style", detail: message },
      { status: 500 }
    );
  }
}
