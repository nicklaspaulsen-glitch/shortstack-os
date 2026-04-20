import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { checkLimit, recordUsage } from "@/lib/usage-limits";
import {
  anthropic,
  MODEL_HAIKU,
  safeJsonParse,
  getResponseText,
} from "@/lib/ai/claude-helpers";
import {
  isValidScene,
  type Scene,
} from "@/lib/auto-edit-types";

/**
 * POST /api/video/auto-edit/broll-candidates
 *
 * For scenes flagged scene_type: "talking_head" (and any low-variety scenes
 * the caller wants to fill), generate concrete search queries with Claude
 * Haiku, then hit the Pexels stock-video API to return 3 candidates per
 * scene. Each candidate includes license + preview + download URL.
 *
 * Token cost: 1 token (Haiku query generation).
 *
 * When PEXELS_API_KEY is not set, we still generate queries — the response
 * then carries `candidates: []` for each scene alongside a clear reason.
 * That way the UI can still show "here are the ideas we'd search for".
 */

export const maxDuration = 60;

interface BrollCandidatesInput {
  video_url?: string;
  scenes?: unknown;
  client_id?: string;
}

interface SceneQuery {
  scene_index: number;
  scene_start_sec: number;
  scene_end_sec: number;
  queries: string[];
  reasoning: string;
}

interface PexelsVideoFile {
  link?: string;
  quality?: string;
  width?: number;
  height?: number;
  file_type?: string;
}

interface PexelsVideo {
  id?: number;
  url?: string;
  image?: string;
  duration?: number;
  user?: { name?: string; url?: string };
  video_files?: PexelsVideoFile[];
}

interface PexelsCandidate {
  provider: "pexels";
  video_id: string;
  page_url: string;
  preview_image: string;
  preview_video_url: string;
  duration_sec: number;
  license: string;
  attribution: string;
  query: string;
}

interface SceneBrollBlock {
  scene_index: number;
  scene_start_sec: number;
  scene_end_sec: number;
  queries: string[];
  candidates: PexelsCandidate[];
  reasoning: string;
  note?: string;
}

const SYSTEM_PROMPT = `You generate stock-video search queries for filling B-roll over talking-head scenes. Given a list of scenes that need B-roll, you emit 2-3 concrete, concise, VISUALLY-DISTINCT search queries per scene.

RULES
- Queries must be short phrases (2-4 words) that work on stock sites (Pexels, Pixabay).
- Prefer concrete nouns over abstract concepts ("laptop coding desk" beats "productivity").
- When the scene's dominant_colors hint at a mood (dark/light/warm/cool), reflect that in at least one query.
- Never suggest anything that looks identical to the talking head itself (no close-up faces unless the scene is product).
- Output ONLY raw JSON:

{
  "scenes": [
    {
      "scene_index": 0,
      "queries": ["city skyline timelapse", "neon street night"],
      "reasoning": "Dark dominant colours + high energy → moody urban filler."
    }
  ]
}
No markdown. No commentary.`;

async function generateQueries(scenes: Scene[]): Promise<{
  results: SceneQuery[];
  tokens: number;
}> {
  // Pick scenes we think need B-roll. Default: talking_head + low motion.
  const needBroll = scenes
    .map((s, idx) => ({ s, idx }))
    .filter(({ s }) => {
      if (s.scene_type === "talking_head") return true;
      if (s.scene_type === "text_slide" && s.motion_level === "low") return true;
      return false;
    });

  if (needBroll.length === 0) {
    return { results: [], tokens: 0 };
  }

  const prompt = `Scenes needing B-roll:\n${JSON.stringify(
    needBroll.map(({ s, idx }) => ({ scene_index: idx, ...s })),
    null,
    2,
  )}\n\nGenerate queries. JSON only.`;

  const response = await anthropic.messages.create({
    model: MODEL_HAIKU,
    max_tokens: 1500,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: prompt }],
  });

  const text = getResponseText(response);
  const parsed = safeJsonParse<{
    scenes?: Array<{
      scene_index?: number;
      queries?: unknown;
      reasoning?: unknown;
    }>;
  }>(text);

  const results: SceneQuery[] = [];
  if (parsed && Array.isArray(parsed.scenes)) {
    for (const block of parsed.scenes) {
      const idx =
        typeof block.scene_index === "number" ? Math.floor(block.scene_index) : -1;
      if (idx < 0 || idx >= scenes.length) continue;
      const queries = Array.isArray(block.queries)
        ? block.queries.filter((q): q is string => typeof q === "string").slice(0, 3)
        : [];
      if (queries.length === 0) continue;
      results.push({
        scene_index: idx,
        scene_start_sec: scenes[idx].start_sec,
        scene_end_sec: scenes[idx].end_sec,
        queries,
        reasoning:
          typeof block.reasoning === "string" && block.reasoning.trim()
            ? block.reasoning.trim()
            : "Fill talking-head scene with contextual B-roll.",
      });
    }
  }

  return {
    results,
    tokens:
      (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
  };
}

async function searchPexels(query: string, key: string): Promise<PexelsCandidate | null> {
  try {
    const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=1&orientation=portrait`;
    const res = await fetch(url, { headers: { Authorization: key } });
    if (!res.ok) return null;
    const json = (await res.json()) as { videos?: PexelsVideo[] };
    const first = json.videos?.[0];
    if (!first) return null;
    const files = first.video_files || [];
    const preferred =
      files.find((f) => f.quality === "hd") ||
      files.sort((a, b) => (b.width || 0) - (a.width || 0))[0];
    if (!preferred?.link) return null;
    return {
      provider: "pexels",
      video_id: String(first.id ?? query),
      page_url: first.url || "",
      preview_image: first.image || "",
      preview_video_url: preferred.link,
      duration_sec: first.duration ?? 0,
      license: "Pexels License (free for commercial use, attribution optional)",
      attribution: first.user?.name ? `Video by ${first.user.name} on Pexels` : "Pexels",
      query,
    };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "AI not configured (missing ANTHROPIC_API_KEY)." },
      { status: 500 },
    );
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ ok: false, error: "Profile not found" }, { status: 403 });
  }

  const limit = await checkLimit(ownerId, "tokens", 1);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: limit.reason || "Monthly token limit reached — upgrade to continue.",
        plan_tier: limit.plan_tier,
        current: limit.current,
        limit: limit.limit,
      },
      { status: 429 },
    );
  }

  let body: BrollCandidatesInput;
  try {
    body = (await request.json()) as BrollCandidatesInput;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const scenes: Scene[] = Array.isArray(body.scenes)
    ? body.scenes.filter(isValidScene)
    : [];
  if (scenes.length === 0) {
    return NextResponse.json(
      { ok: false, error: "scenes[] is required — call /api/video/auto-edit/detect-scenes first." },
      { status: 400 },
    );
  }

  try {
    const { results, tokens } = await generateQueries(scenes);

    const pexelsKey = process.env.PEXELS_API_KEY;
    const noKeyMessage = pexelsKey
      ? undefined
      : "PEXELS_API_KEY not configured — returning query ideas only. Set the env var to fetch stock video candidates.";

    const enriched: SceneBrollBlock[] = await Promise.all(
      results.map(async (block) => {
        let candidates: PexelsCandidate[] = [];
        if (pexelsKey) {
          // Run 3 searches in parallel (one per query, up to 3 candidates).
          const searched = await Promise.all(
            block.queries.slice(0, 3).map((q) => searchPexels(q, pexelsKey)),
          );
          candidates = searched.filter((c): c is PexelsCandidate => !!c);
        }
        return {
          scene_index: block.scene_index,
          scene_start_sec: block.scene_start_sec,
          scene_end_sec: block.scene_end_sec,
          queries: block.queries,
          candidates,
          reasoning: block.reasoning,
          note: noKeyMessage,
        };
      }),
    );

    void recordUsage(ownerId, "tokens", tokens || 800, {
      source: "auto_edit_broll_candidates",
      scene_blocks: enriched.length,
      pexels_enabled: !!pexelsKey,
    });

    const serviceSupabase = createServiceClient();
    void serviceSupabase.from("trinity_log").insert({
      action_type: "ai_auto_edit_broll_candidates",
      description: `B-roll candidates generated for ${enriched.length} scenes`,
      profile_id: user.id,
      status: "completed",
      result: {
        scene_blocks: enriched.length,
        pexels_enabled: !!pexelsKey,
      },
    });

    return NextResponse.json({
      ok: true,
      scene_blocks: enriched,
      total_scenes_needing_broll: enriched.length,
      pexels_enabled: !!pexelsKey,
      note: noKeyMessage,
    });
  } catch (err) {
    console.error("[video/auto-edit/broll-candidates] error", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
