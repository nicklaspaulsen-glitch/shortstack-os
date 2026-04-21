import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import { limitsForTier, normalizePlanTier } from "@/lib/plan-limits";
import {
  anthropic,
  MODEL_HAIKU,
  safeJsonParse,
  getResponseText,
} from "@/lib/ai/claude-helpers";
import {
  ADS_PRESET,
  ADS_MUSIC_LIBRARY,
  filterMusicByMood,
  type AdsMusicTrack,
} from "@/lib/video-presets/ads";

/**
 * POST /api/video/script-to-ad
 *
 * One-shot "product description → fully-populated ad video project" pipeline:
 *   Step A: Claude Haiku writes a 30-second ad script (hook / benefits / CTA)
 *   Step B: calls /api/video/b-roll internally to get timed B-roll suggestions
 *   Step C: calls /api/video/music-match internally to pick a music track
 *   Step D: inserts a row in video_projects with everything wired up
 *
 * Request:
 *   { product_description: string, client_id?: string, duration?: number }
 *
 * Response (success):
 *   {
 *     ok: true,
 *     video_id: uuid,
 *     script: string,
 *     broll: [...],
 *     music: {...},
 *     edit_url: "/dashboard/video-editor/{id}",
 *     preset: "ads"
 *   }
 *
 * Response (failure):
 *   { ok: false, error: string, step?: "script"|"broll"|"music"|"persist" }
 */

interface GeneratedAdScript {
  hook: string; // 1-3s attention grabber
  benefits: string[]; // 2-4 bullet lines of value prop
  cta: string; // call to action
  full_script: string; // concatenated spoken narration
  suggested_mood: "upbeat" | "energetic" | "hype" | "motivational";
}

interface BrollResult {
  ok: boolean;
  suggestions?: unknown;
  error?: string;
}

interface MusicResult {
  ok: boolean;
  track?: AdsMusicTrack;
  alternatives?: AdsMusicTrack[];
  error?: string;
}

const SCRIPT_SYSTEM_PROMPT = `You are a direct-response copywriter who writes 30-second IG Reels / TikTok ad scripts that convert.

STRUCTURE (for a ${30}s ad):
- hook (0-3s): a pattern-interrupt line. Bold claim, provocative question, or surprising stat.
- benefits (3-25s): 2-4 punchy value statements. Each 1 sentence. Speak to the viewer directly ("you / your").
- cta (25-30s): one clear action line ("tap the link", "try it free", etc.)

STYLE RULES
- Conversational, not corporate. Use contractions.
- Short sentences. Cut filler words.
- One benefit per line. Each under 12 words.
- Never mention "AI" or "generated"
- Never use hashtags

OUTPUT FORMAT
Respond with ONLY raw JSON:
{
  "hook": "...",
  "benefits": ["...", "..."],
  "cta": "...",
  "full_script": "<hook> <benefit1> <benefit2> ... <cta>",
  "suggested_mood": "upbeat" | "energetic" | "hype" | "motivational"
}
No markdown fences.`;

async function generateAdScript(
  productDescription: string,
  duration: number
): Promise<GeneratedAdScript | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const response = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 800,
      system: [
        {
          type: "text",
          text: SCRIPT_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `PRODUCT / OFFER:\n"""\n${productDescription}\n"""\n\nTOTAL DURATION: ${duration}s\n\nJSON only.`,
        },
      ],
    });
    const text = getResponseText(response);
    const parsed = safeJsonParse<GeneratedAdScript>(text);
    if (!parsed) return null;
    if (!parsed.full_script || !parsed.hook || !parsed.cta) return null;
    const mood =
      parsed.suggested_mood === "upbeat" ||
      parsed.suggested_mood === "energetic" ||
      parsed.suggested_mood === "hype" ||
      parsed.suggested_mood === "motivational"
        ? parsed.suggested_mood
        : "upbeat";
    return {
      hook: parsed.hook.trim(),
      benefits: Array.isArray(parsed.benefits)
        ? parsed.benefits.map((b) => String(b).trim()).filter(Boolean)
        : [],
      cta: parsed.cta.trim(),
      full_script: parsed.full_script.trim(),
      suggested_mood: mood,
    };
  } catch (err) {
    console.error("[script-to-ad] script gen failed", err);
    return null;
  }
}

async function internalFetch(
  request: NextRequest,
  path: string,
  payload: unknown
): Promise<Response | null> {
  // Build an absolute URL from the incoming request so relative internal calls
  // work regardless of deploy environment (vercel preview, prod, local).
  const origin = request.nextUrl.origin;
  const url = `${origin}${path}`;
  try {
    const cookie = request.headers.get("cookie") || "";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie, // forward auth
      },
      body: JSON.stringify(payload),
    });
    return res;
  } catch (err) {
    console.error(`[script-to-ad] internal fetch ${path} failed`, err);
    return null;
  }
}

export async function POST(request: NextRequest) {
  const authSupabase = createServerSupabase();
  const {
    data: { user },
  } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await authSupabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", user.id)
    .single();
  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  let body: {
    product_description?: unknown;
    client_id?: unknown;
    duration?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const productDescription =
    typeof body.product_description === "string" ? body.product_description.trim() : "";
  if (!productDescription) {
    return NextResponse.json(
      { ok: false, error: "product_description required" },
      { status: 400 }
    );
  }
  // ── Tier-based video length cap (per-render ceiling, not monthly) ──
  // Shape matches other 402 responses ({ current, limit, plan_tier }).
  // Checked BEFORE the internal 60s clamp so the user sees a clear
  // "upgrade" message rather than a silent truncation.
  const requestedDuration = Number(body.duration) || ADS_PRESET.default_duration;
  const planTierKey = normalizePlanTier(profile?.plan_tier as string | null | undefined);
  const { max_video_seconds: maxVideoSeconds } = limitsForTier(planTierKey);
  if (Number.isFinite(maxVideoSeconds) && requestedDuration > maxVideoSeconds) {
    return NextResponse.json(
      {
        ok: false,
        success: false,
        error: `Video length ${requestedDuration}s exceeds ${planTierKey} plan cap (${maxVideoSeconds}s). Upgrade to continue.`,
        resource: "video_seconds",
        current: requestedDuration,
        limit: maxVideoSeconds,
        plan_tier: planTierKey,
        remaining: 0,
      },
      { status: 402 },
    );
  }

  const duration = Math.max(15, Math.min(60, requestedDuration));
  const clientId = typeof body.client_id === "string" ? body.client_id : null;

  // ── Step A: script ─────────────────────────────────────────────────
  const script = await generateAdScript(productDescription, duration);
  if (!script) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to generate ad script (Claude unavailable or returned invalid JSON)",
        step: "script",
      },
      { status: 502 }
    );
  }

  // ── Step B: b-roll (best-effort, non-fatal) ────────────────────────
  const brollRes = await internalFetch(request, "/api/video/b-roll", {
    script: script.full_script,
    count: 5,
    client_id: clientId,
  });
  const brollData: BrollResult =
    brollRes && brollRes.ok ? ((await brollRes.json()) as BrollResult) : { ok: false };
  const brollSuggestions = brollData.ok && Array.isArray(brollData.suggestions)
    ? brollData.suggestions
    : [];

  // ── Step C: music (best-effort, fall through to deterministic) ─────
  const musicRes = await internalFetch(request, "/api/video/music-match", {
    script_mood: script.suggested_mood,
    duration,
    preset: "ads",
    script: script.full_script,
    client_id: clientId,
  });
  let music: AdsMusicTrack | undefined;
  let musicAlternatives: AdsMusicTrack[] = [];
  if (musicRes && musicRes.ok) {
    const data = (await musicRes.json()) as MusicResult;
    if (data.ok && data.track) {
      music = data.track;
      musicAlternatives = Array.isArray(data.alternatives) ? data.alternatives : [];
    }
  }
  if (!music) {
    const filtered = filterMusicByMood([script.suggested_mood]);
    music = filtered[0] || ADS_MUSIC_LIBRARY[0];
    musicAlternatives = filtered.slice(1, 4);
  }

  // ── Step D: persist video_projects row ─────────────────────────────
  const serviceSupabase = createServiceClient();
  const { data: proj, error: projErr } = await serviceSupabase
    .from("video_projects")
    .insert({
      profile_id: user.id,
      client_id: clientId,
      topic: productDescription.slice(0, 200),
      duration,
      style_preset: "ads",
      title: `Ad: ${productDescription.slice(0, 60)}`,
      script: {
        hook: script.hook,
        benefits: script.benefits,
        cta: script.cta,
        full_script: script.full_script,
        suggested_mood: script.suggested_mood,
      },
      editor_settings: {
        preset: "ads",
        preset_patch: ADS_PRESET.editor_settings_patch,
        broll_suggestions: brollSuggestions,
        music_track: music,
        music_alternatives: musicAlternatives,
        aspect_ratio: ADS_PRESET.aspect_ratio,
        caption_style: ADS_PRESET.caption_style,
      },
      call_to_action: script.cta,
      status: "active",
      render_status: "draft",
    })
    .select("id")
    .single();

  if (projErr || !proj) {
    console.error("[script-to-ad] persist error", projErr);
    return NextResponse.json(
      {
        ok: false,
        error: `Failed to persist video project: ${projErr?.message || "unknown"}`,
        step: "persist",
      },
      { status: 500 }
    );
  }

  void serviceSupabase.from("trinity_log").insert({
    action_type: "ai_video_script_to_ad",
    description: `Generated ad project for: ${productDescription.slice(0, 60)}`,
    profile_id: user.id,
    client_id: clientId,
    status: "completed",
    result: {
      video_id: proj.id,
      broll_count: brollSuggestions.length,
      music_id: music.id,
      duration,
    },
  });

  return NextResponse.json({
    ok: true,
    video_id: proj.id,
    script,
    broll: brollSuggestions,
    music,
    music_alternatives: musicAlternatives,
    preset: "ads",
    edit_url: `/dashboard/video-editor?project=${proj.id}`,
  });
}
