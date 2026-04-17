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

interface AnalyzeReferenceInput {
  video_url?: string;
  frame_base64?: string;
}

// Mirrors the editorSettings shape from src/app/dashboard/video-editor/page.tsx
interface SuggestedEditorSettings {
  captions: {
    enabled: boolean;
    preset: string;
    fontFamily: string;
    fontSize: number;
    textColor: string;
    strokeColor: string;
    strokeWidth: number;
    position: "top" | "middle" | "bottom";
    maxWordsPerLine: number;
    emphasizeKeywords: boolean;
  };
  textAnimation: {
    enabled: boolean;
    preset: string;
    duration: number;
    easing: string;
  };
  motion: {
    enabled: boolean;
    preset: string;
    intensity: number;
    autoReframe: boolean;
    motionBlur: boolean;
  };
  transitions: {
    enabled: boolean;
    preset: string;
    duration: number;
  };
  color: {
    enabled: boolean;
    lut: string;
    brightness: number;
    contrast: number;
    saturation: number;
    temperature: number;
  };
  audio: {
    enabled: boolean;
    bgGenre: string;
    noiseRemoval: boolean;
    voiceEnhance: boolean;
  };
  aspect: {
    preset: string;
    customW: number;
    customH: number;
  };
}

interface AnalyzeReferenceOutput {
  style_summary: string;
  pacing: string;
  color_grade: string;
  caption_style: string;
  suggested_editor_settings: SuggestedEditorSettings;
}

const SYSTEM_PROMPT = `You are a senior video editor who reverse-engineers the editing playbooks of viral creators. Given a still frame from a reference video, you infer its overall editing style: caption treatment, color grade, pacing hints, motion, audio vibe, and aspect ratio. You produce a production config that another editor could apply to recreate the look and feel.

INFERENCE CHECKLIST
- Aspect ratio: is this vertical (9:16), square (1:1), or horizontal (16:9)?
- Caption style: are captions visible? What style — TikTok-bold, bottom bar, karaoke, centered, minimal, word-highlight?
- Color grade: warm/cool/neutral? cinematic teal-orange? desaturated? punchy?
- Motion: is there a zoom-in on the subject? handheld look? static locked-off shot?
- Text animation: does text fade/slide/bounce/pop?
- Subject framing: tight headshot, medium, wide? signals pacing (tight = fast-paced)
- Background: green-screen replaced? blurred? direct location?

OUTPUT FORMAT
Respond with ONLY raw JSON matching:
{
  "style_summary": "<2-3 sentence human summary of the editing style>",
  "pacing": "<slow | medium | fast | very-fast>",
  "color_grade": "<e.g. warm cinematic, cool desaturated, punchy saturated>",
  "caption_style": "<name of closest caption preset>",
  "suggested_editor_settings": {
    "captions": {
      "enabled": <bool>,
      "preset": "<tiktok_bold | bottom_bar | word_highlight | centered_bold | karaoke | classic_white | subtitle_pro | minimal_gray>",
      "fontFamily": "<Inter | Montserrat | Impact | Bebas Neue | Oswald | Anton>",
      "fontSize": <24-80>,
      "textColor": "#RRGGBB",
      "strokeColor": "#RRGGBB",
      "strokeWidth": <0-8>,
      "position": "top" | "middle" | "bottom",
      "maxWordsPerLine": <2-8>,
      "emphasizeKeywords": <bool>
    },
    "textAnimation": {
      "enabled": <bool>,
      "preset": "<fade_in | slide_up | pop_in | typewriter | bounce_in | zoom_in>",
      "duration": <0.1-1.0>,
      "easing": "<ease-in | ease-out | ease-in-out>"
    },
    "motion": {
      "enabled": <bool>,
      "preset": "<slow_zoom_in | slow_zoom_out | pan_right | shake | none>",
      "intensity": <0-100>,
      "autoReframe": <bool>,
      "motionBlur": <bool>
    },
    "transitions": {
      "enabled": <bool>,
      "preset": "<cut | fade | zoom_blur | whoosh | glitch | swipe>",
      "duration": <0.1-1.0>
    },
    "color": {
      "enabled": <bool>,
      "lut": "<cinematic | warm | cool | b_and_w | vintage | vibrant | desaturated>",
      "brightness": <-50..50>,
      "contrast": <-50..50>,
      "saturation": <-50..50>,
      "temperature": <-50..50>
    },
    "audio": {
      "enabled": <bool>,
      "bgGenre": "<upbeat | chill | cinematic | corporate | trendy | lofi>",
      "noiseRemoval": <bool>,
      "voiceEnhance": <bool>
    },
    "aspect": {
      "preset": "9:16" | "1:1" | "16:9" | "4:5",
      "customW": 9,
      "customH": 16
    }
  }
}

No markdown. No commentary. JSON only.`;

const FALLBACK_SETTINGS: SuggestedEditorSettings = {
  captions: {
    enabled: true,
    preset: "tiktok_bold",
    fontFamily: "Inter",
    fontSize: 48,
    textColor: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: 4,
    position: "bottom",
    maxWordsPerLine: 4,
    emphasizeKeywords: true,
  },
  textAnimation: { enabled: true, preset: "pop_in", duration: 0.3, easing: "ease-out" },
  motion: { enabled: true, preset: "slow_zoom_in", intensity: 30, autoReframe: false, motionBlur: false },
  transitions: { enabled: true, preset: "cut", duration: 0.2 },
  color: { enabled: true, lut: "cinematic", brightness: 0, contrast: 10, saturation: 10, temperature: 0 },
  audio: { enabled: true, bgGenre: "upbeat", noiseRemoval: true, voiceEnhance: true },
  aspect: { preset: "9:16", customW: 9, customH: 16 },
};

function normalizeMediaType(
  mt: string
): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  if (mt.includes("png")) return "image/png";
  if (mt.includes("gif")) return "image/gif";
  if (mt.includes("webp")) return "image/webp";
  return "image/jpeg";
}

async function downloadAsBase64(
  url: string
): Promise<{ data: string; mediaType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image (${res.status})`);
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const buf = Buffer.from(await res.arrayBuffer());
  return { data: buf.toString("base64"), mediaType: contentType };
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

  let body: AnalyzeReferenceInput;
  try {
    body = (await request.json()) as AnalyzeReferenceInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.video_url && !body.frame_base64) {
    return NextResponse.json(
      {
        error: "Either video_url (publicly accessible frame URL) or frame_base64 is required",
      },
      { status: 400 }
    );
  }

  // For video_url we currently treat it as an image URL (the caller should
  // extract a representative frame client-side). We do NOT attempt to decode
  // video server-side — that is out of scope for this route.
  let imageSource: Anthropic.ImageBlockParam["source"];
  try {
    if (body.frame_base64) {
      const m = body.frame_base64.match(
        /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
      );
      const data = m ? m[2] : body.frame_base64;
      const mediaType = normalizeMediaType(m ? m[1] : "image/jpeg");
      imageSource = { type: "base64", media_type: mediaType, data };
    } else if (body.video_url) {
      const { data, mediaType } = await downloadAsBase64(body.video_url);
      imageSource = {
        type: "base64",
        media_type: normalizeMediaType(mediaType),
        data,
      };
    } else {
      return NextResponse.json({ error: "No frame provided" }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: "Failed to load reference frame", detail: message },
      { status: 400 }
    );
  }

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
            {
              type: "text",
              text: "Analyze the editing style of this reference frame and return a JSON editor config.",
            },
          ],
        },
      ],
    });

    const text = getResponseText(response);
    const parsed = safeJsonParse<AnalyzeReferenceOutput>(text);

    if (!parsed || !parsed.suggested_editor_settings) {
      return NextResponse.json(
        { error: "Claude returned an invalid response", raw: text.slice(0, 500) },
        { status: 502 }
      );
    }

    const settings: SuggestedEditorSettings = {
      captions: { ...FALLBACK_SETTINGS.captions, ...parsed.suggested_editor_settings.captions },
      textAnimation: { ...FALLBACK_SETTINGS.textAnimation, ...parsed.suggested_editor_settings.textAnimation },
      motion: { ...FALLBACK_SETTINGS.motion, ...parsed.suggested_editor_settings.motion },
      transitions: { ...FALLBACK_SETTINGS.transitions, ...parsed.suggested_editor_settings.transitions },
      color: { ...FALLBACK_SETTINGS.color, ...parsed.suggested_editor_settings.color },
      audio: { ...FALLBACK_SETTINGS.audio, ...parsed.suggested_editor_settings.audio },
      aspect: { ...FALLBACK_SETTINGS.aspect, ...parsed.suggested_editor_settings.aspect },
    };

    const out: AnalyzeReferenceOutput = {
      style_summary: parsed.style_summary || "Custom editing style",
      pacing: parsed.pacing || "medium",
      color_grade: parsed.color_grade || "neutral",
      caption_style: parsed.caption_style || settings.captions.preset,
      suggested_editor_settings: settings,
    };

    const serviceSupabase = createServiceClient();
    void serviceSupabase.from("trinity_log").insert({
      action_type: "ai_video_analyze_reference",
      description: `Analyzed reference: ${out.style_summary.slice(0, 80)}`,
      profile_id: user.id,
      status: "completed",
      result: {
        pacing: out.pacing,
        color_grade: out.color_grade,
        generated_at: new Date().toISOString(),
      },
    });

    return NextResponse.json(out);
  } catch (err) {
    console.error("[video/analyze-reference] error", err);
    const message = err instanceof Error ? err.message : "Unknown Claude API error";
    return NextResponse.json(
      { error: "Failed to analyze reference", detail: message },
      { status: 500 }
    );
  }
}
