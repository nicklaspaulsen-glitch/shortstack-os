import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import {
  anthropic,
  MODEL_HAIKU,
  safeJsonParse,
  getResponseText,
} from "@/lib/ai/claude-helpers";

/**
 * POST /api/video/b-roll
 *
 * Request:
 *   { script: string, count?: number (default 5), client_id?: string }
 *
 * Response (success):
 *   {
 *     ok: true,
 *     suggestions: [
 *       { time_range: [startSec, endSec], description, search_terms: string[], priority: "high"|"medium"|"low", pexels_video_url?: string }
 *     ]
 *   }
 *
 * Response (failure):
 *   { ok: false, error: string }
 *
 * Uses Claude Haiku to read the script and emit timed B-roll suggestions.
 * When PEXELS_API_KEY is configured, tries to attach a preview video URL for
 * the top search term per suggestion. Graceful degradation: if Pexels fails
 * we simply return the search_terms without pexels_video_url.
 */

const SYSTEM_PROMPT = `You are a senior video editor who places B-roll for short-form ads.

GIVEN a narration script, you identify the 3-5 best moments to cut to B-roll and for each moment return:
- time_range: [startSec, endSec] during the script (estimate based on ~2.5 words/sec narration)
- description: 1 sentence describing the visual
- search_terms: 3-5 stock-footage search queries that would find this visual
- priority: "high" (ad hook/CTA), "medium" (benefit proof), "low" (ambience)

RULES
- Pick moments where a visual cutaway adds persuasion, not filler
- First suggestion MUST be the opening hook (starts at 0s or within first 3s)
- At least one "high" priority suggestion tied to the product/benefit
- At least one suggestion with the word "close-up" OR "product" in search_terms
- Total suggestions: match count requested (default 5). Never exceed 6.

OUTPUT FORMAT
Respond with ONLY raw JSON:
{
  "suggestions": [
    { "time_range": [0, 3], "description": "...", "search_terms": ["..."], "priority": "high" }
  ]
}
No markdown fences. No commentary.`;

interface BrollSuggestion {
  time_range: [number, number];
  description: string;
  search_terms: string[];
  priority: "high" | "medium" | "low";
  pexels_video_url?: string;
  pexels_thumbnail?: string;
}

async function fetchPexelsVideo(query: string): Promise<{ video_url: string; thumbnail: string } | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  try {
    const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=1&orientation=portrait`;
    const res = await fetch(url, { headers: { Authorization: key } });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      videos?: Array<{
        image?: string;
        video_files?: Array<{ link?: string; quality?: string; width?: number }>;
      }>;
    };
    const first = json.videos?.[0];
    if (!first) return null;
    // prefer 'hd' or widest file
    const files = first.video_files || [];
    const preferred =
      files.find((f) => f.quality === "hd") ||
      files.sort((a, b) => (b.width || 0) - (a.width || 0))[0];
    if (!preferred?.link) return null;
    return { video_url: preferred.link, thumbnail: first.image || "" };
  } catch {
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

  let body: { script?: unknown; count?: unknown; client_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const script = typeof body.script === "string" ? body.script.trim() : "";
  if (!script) {
    return NextResponse.json({ ok: false, error: "script required" }, { status: 400 });
  }
  const count = Math.max(3, Math.min(6, Number(body.count) || 5));
  const clientId = typeof body.client_id === "string" ? body.client_id : null;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "AI not configured (missing ANTHROPIC_API_KEY)" },
      { status: 500 }
    );
  }

  try {
    const response = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 1500,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: `SCRIPT:\n"""\n${script}\n"""\n\nCOUNT: ${count}\n\nJSON only.`,
        },
      ],
    });

    const text = getResponseText(response);
    const parsed = safeJsonParse<{ suggestions: BrollSuggestion[] }>(text);
    if (!parsed || !Array.isArray(parsed.suggestions)) {
      return NextResponse.json(
        { ok: false, error: "Claude returned invalid response", raw: text.slice(0, 400) },
        { status: 502 }
      );
    }

    // Normalize
    const suggestions: BrollSuggestion[] = parsed.suggestions
      .filter(
        (s): s is BrollSuggestion =>
          !!s &&
          Array.isArray(s.time_range) &&
          typeof s.description === "string" &&
          Array.isArray(s.search_terms)
      )
      .map((s): BrollSuggestion => ({
        time_range: [Number(s.time_range[0]) || 0, Number(s.time_range[1]) || 0] as [number, number],
        description: s.description.trim(),
        search_terms: s.search_terms.map((t) => String(t).trim()).filter(Boolean).slice(0, 5),
        priority:
          s.priority === "high" || s.priority === "medium" || s.priority === "low"
            ? s.priority
            : "medium",
      }))
      .slice(0, count);

    // Optional: enrich with Pexels
    if (process.env.PEXELS_API_KEY && suggestions.length) {
      await Promise.all(
        suggestions.map(async (s) => {
          const topTerm = s.search_terms[0];
          if (!topTerm) return;
          const pex = await fetchPexelsVideo(topTerm);
          if (pex) {
            s.pexels_video_url = pex.video_url;
            s.pexels_thumbnail = pex.thumbnail;
          }
        })
      );
    }

    // Log (fire-and-forget)
    const serviceSupabase = createServiceClient();
    void serviceSupabase.from("trinity_log").insert({
      action_type: "ai_video_broll_suggest",
      description: `B-roll suggestions: ${suggestions.length}`,
      profile_id: user.id,
      client_id: clientId,
      status: "completed",
      result: {
        count: suggestions.length,
        pexels_enriched: !!process.env.PEXELS_API_KEY,
      },
    });

    return NextResponse.json({
      ok: true,
      suggestions,
      pexels_enriched: !!process.env.PEXELS_API_KEY,
    });
  } catch (err) {
    console.error("[video/b-roll] error", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
