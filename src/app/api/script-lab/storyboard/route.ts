import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import { anthropic, MODEL_HAIKU, safeJsonParse, getResponseText } from "@/lib/ai/claude-helpers";

type StoryboardFormat =
  | "ugc"
  | "ad"
  | "motion_graphics"
  | "talking_head"
  | "product_demo"
  | "explainer"
  | "cinematic"
  | "podcast_clip";

interface StoryboardShot {
  shot_number: number;
  duration_sec: number;
  visual_description: string;
  camera: string;
  dialog: string;
  action: string;
  transition_in: string;
  transition_out: string;
  on_screen_text: string;
  b_roll_suggestions: string[];
  music_cue: string;
}

interface StoryboardResult {
  total_duration_sec: number;
  format: StoryboardFormat;
  shots: StoryboardShot[];
  style_notes: string;
  total_shots: number;
}

const FORMAT_PROFILES: Record<StoryboardFormat, { desc: string; default_duration: number }> = {
  ugc: {
    desc:
      "UGC / authentic raw-style: handheld camera, close-ups, natural lighting, direct-to-camera talking, casual vibe. Shot on iPhone aesthetic. No professional lighting. Typical length 15-30 seconds.",
    default_duration: 30,
  },
  ad: {
    desc:
      "Paid ad: punchy fast cuts, product hero shots, polished color grade, clear CTA ending, professional lighting. Tight pacing. Typical length 15-60 seconds.",
    default_duration: 30,
  },
  motion_graphics: {
    desc:
      "Motion graphics only — NO live action. Kinetic typography animations, shape transitions, animated icons, bold transitions. Include detailed sound-design cues. Typical length 10-30 seconds.",
    default_duration: 20,
  },
  talking_head: {
    desc:
      "Talking head: single person, single wide framing plus two close-ups for A/B roll cutaways. Clean consistent background, minimal distractions, consistent framing throughout. Typical length 60-180 seconds.",
    default_duration: 90,
  },
  product_demo: {
    desc:
      "Product demo: tabletop lighting, hand-on-product shots, zoom-ins to key features, slow smooth pans, clear product reveal. Typical length 30-90 seconds.",
    default_duration: 60,
  },
  explainer: {
    desc:
      "Explainer: screen recordings intercut with talking head, overlay graphics, bullet list reveals, animated arrows/highlights. Typical length 60-180 seconds.",
    default_duration: 90,
  },
  cinematic: {
    desc:
      "Cinematic: wide establishing shot, b-roll montage, slow graceful camera moves (dolly, slider, gimbal), music-driven cuts, dramatic color grade. Length driven by music.",
    default_duration: 60,
  },
  podcast_clip: {
    desc:
      "Podcast clip: waveform overlay, key quote captions, minimal additional visuals, focus is on audio. Speaker headshot or simple b-roll of recording setup. Typical length 30-60 seconds.",
    default_duration: 45,
  },
};

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("plan_tier").eq("id", user.id).single();
  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const {
    script_text,
    format,
    platform,
    duration,
    script_id,
  } = body as {
    script_text?: string;
    format?: StoryboardFormat;
    platform?: string;
    duration?: number;
    script_id?: string | null;
  };

  if (!script_text || typeof script_text !== "string" || script_text.trim().length < 10) {
    return NextResponse.json({ error: "script_text is required" }, { status: 400 });
  }

  const fmt: StoryboardFormat = (format && FORMAT_PROFILES[format] ? format : "ugc");
  const profileInfo = FORMAT_PROFILES[fmt];
  const targetDuration = typeof duration === "number" && duration > 0 ? duration : profileInfo.default_duration;

  const prompt = `You are a professional video director and storyboard artist. Break a script down into a precise shot-by-shot visual plan.

FORMAT: ${fmt}
FORMAT PROFILE: ${profileInfo.desc}
TARGET DURATION: ~${targetDuration} seconds
PLATFORM: ${platform || "generic social"}

SCRIPT:
"""
${script_text.slice(0, 8000)}
"""

Produce a shot-by-shot storyboard. Respect the FORMAT PROFILE above — camera choices, lighting, and visual style must match.

Return ONLY valid JSON matching exactly this schema (no markdown, no commentary):
{
  "total_duration_sec": number (roughly match TARGET DURATION),
  "format": "${fmt}",
  "shots": [
    {
      "shot_number": 1,
      "duration_sec": number,
      "visual_description": "vivid, specific visual description (what the frame looks like)",
      "camera": "camera choice: framing + movement + lens (e.g., 'Handheld close-up, slight shake, 35mm' or 'Static wide, tripod')",
      "dialog": "exact dialog or narration spoken in this shot (empty string if none)",
      "action": "what the subject physically does in this shot",
      "transition_in": "transition into this shot (e.g., 'Hard cut', 'Quick zoom-in', 'Fade from black')",
      "transition_out": "transition out of this shot",
      "on_screen_text": "any on-screen text/caption overlay for this shot (empty string if none)",
      "b_roll_suggestions": ["1-3 short b-roll ideas relevant to this shot"],
      "music_cue": "music direction for this shot (e.g., 'Start — low ambient pad', 'Beat drop', 'Quiet', 'Outro fade')"
    }
  ],
  "style_notes": "2-3 sentence overall visual direction covering lighting, color, energy, and aesthetic",
  "total_shots": number (equal to shots.length)
}

Rules:
- Number shots sequentially starting at 1
- Sum of shot durations should approximate total_duration_sec
- For motion_graphics: do NOT include live action; camera should describe motion/animation style instead
- For podcast_clip: keep visuals minimal, emphasize audio; most shots should reference waveform / quote captions
- For talking_head: alternate wide / close-up A / close-up B to enable A/B roll cutaways
- Every shot must have all fields (use empty string "" or empty array [] where not applicable)
- 4-14 shots is typical; match to target duration`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = getResponseText(response);
    const parsed = safeJsonParse<StoryboardResult>(text);

    if (!parsed || !Array.isArray(parsed.shots) || parsed.shots.length === 0) {
      return NextResponse.json({ error: "Failed to parse storyboard", raw: text.slice(0, 500) }, { status: 500 });
    }

    // Normalise shots: ensure fields exist and are typed correctly
    const normalizedShots: StoryboardShot[] = parsed.shots.map((s, idx) => ({
      shot_number: typeof s.shot_number === "number" ? s.shot_number : idx + 1,
      duration_sec: typeof s.duration_sec === "number" ? s.duration_sec : 3,
      visual_description: String(s.visual_description || ""),
      camera: String(s.camera || ""),
      dialog: String(s.dialog || ""),
      action: String(s.action || ""),
      transition_in: String(s.transition_in || ""),
      transition_out: String(s.transition_out || ""),
      on_screen_text: String(s.on_screen_text || ""),
      b_roll_suggestions: Array.isArray(s.b_roll_suggestions) ? s.b_roll_suggestions.map(String) : [],
      music_cue: String(s.music_cue || ""),
    }));

    const totalDuration =
      typeof parsed.total_duration_sec === "number"
        ? parsed.total_duration_sec
        : normalizedShots.reduce((acc, s) => acc + (s.duration_sec || 0), 0);

    const result: StoryboardResult = {
      total_duration_sec: totalDuration,
      format: fmt,
      shots: normalizedShots,
      style_notes: String(parsed.style_notes || ""),
      total_shots: normalizedShots.length,
    };

    // Persist
    const { data: inserted, error: insertErr } = await supabase
      .from("storyboards")
      .insert({
        user_id: user.id,
        script_id: script_id || null,
        format: fmt,
        platform: platform || null,
        total_duration_sec: result.total_duration_sec,
        shots: result.shots,
        style_notes: result.style_notes,
      })
      .select("id")
      .single();

    return NextResponse.json({
      success: true,
      storyboard: result,
      storyboard_id: inserted?.id || null,
      save_error: insertErr?.message || null,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
