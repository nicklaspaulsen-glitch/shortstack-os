import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import {
  anthropic,
  MODEL_HAIKU,
  safeJsonParse,
  getResponseText,
} from "@/lib/ai/claude-helpers";
import { ADS_MUSIC_LIBRARY, filterMusicByMood } from "@/lib/video-presets/ads";

/**
 * POST /api/video/music-match
 *
 * Request:
 *   { script_mood?: string, duration?: number, preset?: string, script?: string, client_id?: string }
 *
 * Response (success):
 *   {
 *     ok: true,
 *     track: { id, title, mood, bpm, duration_sec, source, url, license, tags },
 *     alternatives: [...]  // 3 other candidates
 *   }
 *
 * Response (failure):
 *   { ok: false, error: string }
 *
 * Claude Haiku picks the best single track from ADS_MUSIC_LIBRARY based on
 * mood/duration/script hints. If Claude is unavailable, falls back to a
 * deterministic match-by-mood scan against the library.
 */

const SYSTEM_PROMPT = `You are a music supervisor for IG Reels / TikTok ads. You pick the single best track from a fixed library and 3 alternatives.

PICK RULES
- Prefer tracks whose bpm suits the pacing (fast ads: 120-150 bpm)
- Respect script_mood / preset hints
- If duration given, prefer tracks with duration_sec >= requested duration
- Never pick a track outside the provided library

OUTPUT FORMAT
Respond with ONLY raw JSON:
{
  "track_id": "ads_mus_XX",
  "alternative_ids": ["ads_mus_XX", "ads_mus_XX", "ads_mus_XX"],
  "reasoning": "1 sentence why this fits"
}
No markdown fences.`;

interface MatchResponse {
  track_id: string;
  alternative_ids: string[];
  reasoning?: string;
}

function deterministicFallback(mood: string | undefined, duration: number) {
  const moodFiltered = mood ? filterMusicByMood([mood]) : ADS_MUSIC_LIBRARY;
  // prefer length >= duration, then higher bpm for ads
  const ranked = [...(moodFiltered.length ? moodFiltered : ADS_MUSIC_LIBRARY)].sort((a, b) => {
    const aFits = a.duration_sec >= duration ? 1 : 0;
    const bFits = b.duration_sec >= duration ? 1 : 0;
    if (aFits !== bFits) return bFits - aFits;
    return b.bpm - a.bpm;
  });
  return {
    track: ranked[0],
    alternatives: ranked.slice(1, 4),
    reasoning: `Deterministic match: mood=${mood || "any"}, duration>=${duration}s, highest bpm first.`,
  };
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
    script_mood?: unknown;
    duration?: unknown;
    preset?: unknown;
    script?: unknown;
    client_id?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const mood = typeof body.script_mood === "string" ? body.script_mood.trim().toLowerCase() : undefined;
  const duration = Math.max(5, Math.min(180, Number(body.duration) || 30));
  const preset = typeof body.preset === "string" ? body.preset.trim() : undefined;
  const script = typeof body.script === "string" ? body.script.trim().slice(0, 1500) : undefined;
  const clientId = typeof body.client_id === "string" ? body.client_id : null;

  // If Claude is not configured, skip straight to fallback
  if (!process.env.ANTHROPIC_API_KEY) {
    const r = deterministicFallback(mood, duration);
    return NextResponse.json({
      ok: true,
      track: r.track,
      alternatives: r.alternatives,
      reasoning: r.reasoning,
      source: "fallback",
    });
  }

  try {
    const libraryJson = JSON.stringify(
      ADS_MUSIC_LIBRARY.map((t) => ({
        id: t.id,
        title: t.title,
        mood: t.mood,
        bpm: t.bpm,
        duration_sec: t.duration_sec,
        tags: t.tags,
      }))
    );

    const response = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 400,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: `LIBRARY:\n${libraryJson}\n\nSCRIPT_MOOD: ${mood || "n/a"}\nDURATION: ${duration}s\nPRESET: ${preset || "n/a"}${script ? `\nSCRIPT: "${script}"` : ""}\n\nJSON only.`,
        },
      ],
    });

    const text = getResponseText(response);
    const parsed = safeJsonParse<MatchResponse>(text);

    let chosen = parsed?.track_id ? ADS_MUSIC_LIBRARY.find((t) => t.id === parsed.track_id) : undefined;
    const altIds = Array.isArray(parsed?.alternative_ids) ? parsed!.alternative_ids : [];
    let alternatives = altIds
      .map((id) => ADS_MUSIC_LIBRARY.find((t) => t.id === id))
      .filter((t): t is NonNullable<typeof t> => !!t);

    if (!chosen) {
      // Fallback if AI returned nothing usable
      const r = deterministicFallback(mood, duration);
      chosen = r.track;
      alternatives = r.alternatives;
    }

    if (alternatives.length < 3) {
      const extras = ADS_MUSIC_LIBRARY.filter(
        (t) => t.id !== chosen!.id && !alternatives.some((a) => a.id === t.id)
      ).slice(0, 3 - alternatives.length);
      alternatives = [...alternatives, ...extras];
    }

    // Log
    const serviceSupabase = createServiceClient();
    void serviceSupabase.from("trinity_log").insert({
      action_type: "ai_video_music_match",
      description: `Music match: ${chosen.title}`,
      profile_id: user.id,
      client_id: clientId,
      status: "completed",
      result: {
        track_id: chosen.id,
        mood: mood || null,
        duration,
      },
    });

    return NextResponse.json({
      ok: true,
      track: chosen,
      alternatives,
      reasoning: parsed?.reasoning || null,
      source: "ai",
    });
  } catch (err) {
    console.error("[video/music-match] error", err);
    const r = deterministicFallback(mood, duration);
    return NextResponse.json({
      ok: true,
      track: r.track,
      alternatives: r.alternatives,
      reasoning: r.reasoning,
      source: "fallback",
      fallback_reason: err instanceof Error ? err.message : "claude error",
    });
  }
}
